from flask import Flask, request, jsonify, session
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import mysql.connector
from mysql.connector import Error
import jwt
from datetime import datetime, timedelta, timezone
from functools import wraps
import os
import logging
from typing import Dict, List, Optional, Tuple
import uuid
import json 
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'palmed-clinic-secret-key-2025')
# Allow CORS from configured frontends (comma-separated) or common localhost defaults
frontend_origins = os.environ.get('FRONTEND_ORIGINS')
if frontend_origins:
    allowed_origins = [o.strip() for o in frontend_origins.split(',') if o.strip()]
else:
    allowed_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]

CORS(
    app,
    supports_credentials=True,
    origins=allowed_origins,
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)

# Utilities
def _to_jsonable(obj):
    try:
        from datetime import datetime as _dt_datetime, date as _dt_date, time as _dt_time, timedelta as _dt_timedelta
        if isinstance(obj, (_dt_datetime, _dt_date, _dt_time)):
            return obj.isoformat()
        if isinstance(obj, _dt_timedelta):
            total_seconds = int(obj.total_seconds())
            hours = total_seconds // 3600
            minutes = (total_seconds % 3600) // 60
            seconds = total_seconds % 60
            return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    except Exception:
        pass
    if isinstance(obj, dict):
        return {k: _to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_to_jsonable(v) for v in obj]
    return obj

# Database configuration
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'database': os.environ.get('DB_NAME', 'palmed_clinic_erp'),
    'user': os.environ.get('DB_USER', 'root'),
    'password': os.environ.get('DB_PASSWORD', 'Transport@2025'),
    'port': int(os.environ.get('DB_PORT', 3306)),
    'autocommit': False,
    'use_unicode': True,
    'charset': 'utf8mb4'
}

class DatabaseManager:
    """Database connection and query management"""
    
    @staticmethod
    def get_connection():
        try:
            connection = mysql.connector.connect(**DB_CONFIG)
            if connection.is_connected():
                logger.info("Database connection successful")
                return connection
        except Error as e:
            logger.error(f"Database connection error: {e}")
            return None
    
    @staticmethod
    def execute_query(query: str, params: tuple = None, fetch: bool = False):
        connection = DatabaseManager.get_connection()
        if not connection:
            logger.error("No database connection available")
            return None
        
        try:
            cursor = connection.cursor(dictionary=True)
            logger.info(f"Executing query: {query}")
            if params:
                logger.info(f"With parameters: {params}")
                
            cursor.execute(query, params or ())
            
            if fetch:
                result = cursor.fetchall()
                logger.info(f"Query returned {len(result) if result else 0} rows")
            else:
                connection.commit()
                result = cursor.rowcount
                logger.info(f"Query affected {result} rows")
            
            return result
        except Error as e:
            logger.error(f"Query execution error: {e}")
            if connection:
                connection.rollback()
            return None
        finally:
            if connection and connection.is_connected():
                cursor.close()
                connection.close()

def token_required(f):
    """JWT token authentication decorator"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        
        if not token:
            return jsonify({'success': False, 'error': 'Token is missing'}), 401
        
        try:
            if token.startswith('Bearer '):
                token = token[7:]
            
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user_id = data['user_id']
            
            # Get user details from database - using correct schema columns
            user_query = """
            SELECT u.*, ur.role_name 
            FROM users u 
            JOIN user_roles ur ON u.role_id = ur.id 
            WHERE u.id = %s AND u.is_active = TRUE
            """
            user = DatabaseManager.execute_query(user_query, (current_user_id,), fetch=True)
            
            if not user:
                return jsonify({'success': False, 'error': 'Invalid token'}), 401
            
            request.current_user = user[0]
            
        except jwt.ExpiredSignatureError:
            return jsonify({'success': False, 'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'success': False, 'error': 'Invalid token'}), 401
        
        return f(*args, **kwargs)
    
    return decorated

def role_required(allowed_roles: List[str]):
    """Role-based access control decorator (case-insensitive, normalized)."""
    # Normalize the allowed roles once
    allowed_normalized = {str(r).strip().lower().replace(' ', '_') for r in allowed_roles}

    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if not hasattr(request, 'current_user'):
                return jsonify({'success': False, 'error': 'Authentication required'}), 401

            raw_role = request.current_user.get('role_name', '')
            user_role = str(raw_role).strip().lower().replace(' ', '_')

            if user_role not in allowed_normalized:
                return jsonify({'success': False, 'error': 'Insufficient permissions'}), 403

            return f(*args, **kwargs)
        return decorated
    return decorator

# ============================================================================
# AUTHENTICATION ENDPOINTS
# ============================================================================

@app.route('/api/auth/login', methods=['POST'])
def login():
    """User authentication endpoint - Fixed to match database schema"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'Invalid request format'}), 400
            
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        logger.info(f"Login attempt for email: {email}")

        if not email or not password:
            return jsonify({'success': False, 'error': 'Email and password are required'}), 400

        if '@' not in email or '.' not in email:
            return jsonify({'success': False, 'error': 'Please enter a valid email address'}), 400

        # Get user from database - using correct schema with JOIN to get role name
        query = """
        SELECT u.*, ur.role_name 
        FROM users u 
        JOIN user_roles ur ON u.role_id = ur.id 
        WHERE u.email = %s AND u.is_active = TRUE
        """
        user = DatabaseManager.execute_query(query, (email,), fetch=True)

        if not user:
            logger.info(f"No active user found for email: {email}")
            return jsonify({'success': False, 'error': 'Invalid email or password'}), 401

        user_data = user[0]
        logger.info(f"User found: {user_data['email']} with role: {user_data['role_name']}")

        # Verify password (gracefully handle unsupported legacy hash formats)
        try:
            valid_password = check_password_hash(user_data['password_hash'], password)
        except Exception as pw_err:
            logger.warning(f"Password hash format error for user {email}: {pw_err}")
            valid_password = False

        if not valid_password:
            logger.info(f"Password mismatch for user: {email}")
            return jsonify({'success': False, 'error': 'Invalid email or password'}), 401

        # Check if user requires approval
        if user_data.get('requires_approval') and not user_data.get('approved_at'):
            return jsonify({'success': False, 'error': 'Your account is pending approval'}), 401

        # Generate JWT token using correct user ID field
        token_payload = {
            'user_id': user_data['id'],  # Using 'id' instead of 'user_id'
            'email': user_data['email'],
            'role': user_data['role_name'],  # Using role_name from JOIN
            'exp': datetime.now(timezone.utc) + timedelta(hours=24),
            'iat': datetime.now(timezone.utc)
        }

        token = jwt.encode(token_payload, app.config['SECRET_KEY'], algorithm='HS256')

        # Update last login
        try:
            update_login_query = "UPDATE users SET last_login = %s WHERE id = %s"
            DatabaseManager.execute_query(update_login_query, (datetime.now(timezone.utc), user_data['id']))
        except Exception as update_error:
            logger.warning(f"Failed to update last login: {update_error}")

        # Log login activity
        try:
            log_query = """
            INSERT INTO audit_log (user_id, table_name, record_id, action, ip_address, user_agent, created_at)
            VALUES (%s, 'users', %s, 'LOGIN', %s, %s, %s)
            """
            DatabaseManager.execute_query(log_query, (
                user_data['id'],
                user_data['id'],
                request.remote_addr,
                request.headers.get('User-Agent', ''),
                datetime.now(timezone.utc)
            ))
        except Exception as log_error:
            logger.warning(f"Failed to log login activity: {log_error}")

        # Parse geographic restrictions
        geographic_restrictions = None
        if user_data.get('geographic_restrictions'):
            try:
                import json
                geographic_restrictions = json.loads(user_data['geographic_restrictions'])
            except:
                geographic_restrictions = []

        response_data = {
            'success': True,
            'data': {
                'token': token,
                'user': {
                    'user_id': user_data['id'],
                    'email': user_data['email'],
                    'first_name': user_data['first_name'],
                    'last_name': user_data['last_name'],
                    'role': user_data['role_name'],  # Using role_name
                    'assigned_province': geographic_restrictions[0] if geographic_restrictions else None,
                    'mp_number': user_data.get('mp_number')
                }
            },
            'message': 'Login successful'
        }

        logger.info(f"Login successful for user: {email}")
        return jsonify(response_data), 200

    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error occurred'}), 500

@app.route('/api/auth/register', methods=['POST'])
def register():
    """User registration endpoint - Fixed to match database schema"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'Invalid request format'}), 400

        required_fields = ['email', 'password', 'first_name', 'last_name', 'role', 'phone_number']
        for field in required_fields:
            if not data.get(field, '').strip():
                return jsonify({'success': False, 'error': f'{field} is required'}), 400

        email = data['email'].strip().lower()
        
        # Validate email format
        if '@' not in email or '.' not in email:
            return jsonify({'success': False, 'error': 'Please enter a valid email address'}), 400

        # Check if user already exists
        existing_user = DatabaseManager.execute_query(
            "SELECT id FROM users WHERE email = %s",
            (email,),
            fetch=True
        )

        if existing_user:
            return jsonify({'success': False, 'error': 'User with this email already exists'}), 409

        # Get role ID
        role_query = "SELECT id FROM user_roles WHERE role_name = %s"
        role_result = DatabaseManager.execute_query(role_query, (data['role'],), fetch=True)
        
        if not role_result:
            return jsonify({'success': False, 'error': f'Invalid role: {data["role"]}'}), 400
        
        role_id = role_result[0]['id']

        # Validate role-specific requirements
        if data['role'] == 'doctor' and not data.get('mp_number', '').strip():
            return jsonify({'success': False, 'error': 'MP number is required for doctors'}), 400

        # Validate password strength
        if len(data['password']) < 6:
            return jsonify({'success': False, 'error': 'Password must be at least 6 characters long'}), 400

        # Generate unique username if not provided
        username = data.get('username', f"{data['first_name'].lower()}_{data['last_name'].lower()}").replace(' ', '_')
        
        # Check if username exists and make it unique
        counter = 1
        original_username = username
        while True:
            existing_username = DatabaseManager.execute_query(
                "SELECT id FROM users WHERE username = %s", (username,), fetch=True
            )
            if not existing_username:
                break
            username = f"{original_username}_{counter}"
            counter += 1

        # Create user with appropriate approval status
        requires_approval = data['role'] == 'doctor'
        is_active = not requires_approval

        # Prepare geographic restrictions
        geographic_restrictions = data.get('assigned_province')
        if geographic_restrictions:
            import json
            geographic_restrictions = json.dumps([geographic_restrictions])

        insert_query = """
        INSERT INTO users (username, email, password_hash, role_id, first_name, last_name, 
                          phone_number, mp_number, geographic_restrictions, is_active, 
                          requires_approval, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        result = DatabaseManager.execute_query(insert_query, (
            username,
            email,
            generate_password_hash(data['password']),
            role_id,
            data['first_name'].strip(),
            data['last_name'].strip(),
            data['phone_number'].strip(),
            data.get('mp_number', '').strip() or None,
            geographic_restrictions,
            is_active,
            requires_approval,
            datetime.now(timezone.utc)
        ))

        if result:
            message = 'Registration successful' if is_active else 'Registration submitted for approval'
            status = 'active' if is_active else 'pending'
            
            return jsonify({
                'success': True,
                'message': message,
                'username': username,
                'status': status
            }), 201
        else:
            return jsonify({'success': False, 'error': 'Registration failed'}), 500

    except Exception as e:
        logger.error(f"Registration error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/auth/verify-token', methods=['GET'])
@token_required
def verify_token():
    """Verify JWT token validity"""
    return jsonify({
        'success': True,
        'user': {
            'user_id': request.current_user['id'],
            'email': request.current_user['email'],
            'first_name': request.current_user['first_name'],
            'last_name': request.current_user['last_name'],
            'role': request.current_user['role_name']
        }
    }), 200

# ============================================================================
# PATIENT MANAGEMENT ENDPOINTS
# ============================================================================

@app.route('/api/patients', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'clerk', 'social_work', 'social_worker'])
def get_patients():
    """Get patients list with filtering and pagination"""
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 20))
        search = request.args.get('search', '')
        
        offset = (page - 1) * limit
        
        # Build query
        base_query = """
        SELECT p.*, 
               COUNT(pv.id) as total_visits,
               MAX(pv.visit_date) as last_visit
        FROM patients p
        LEFT JOIN patient_visits pv ON p.id = pv.patient_id
        WHERE 1=1
        """
        
        params = []
        
        if search:
            base_query += " AND (p.first_name LIKE %s OR p.last_name LIKE %s OR p.medical_aid_number LIKE %s)"
            search_param = f"%{search}%"
            params.extend([search_param, search_param, search_param])
        
        # Role-based filtering using geographic restrictions
        user_role = request.current_user.get('role_name')
        if user_role == 'doctor':
            geographic_restrictions = request.current_user.get('geographic_restrictions')
            if geographic_restrictions:
                try:
                    import json
                    provinces = json.loads(geographic_restrictions)
                    if provinces and len(provinces) > 0:
                        province_placeholders = ','.join(['%s'] * len(provinces))
                        base_query += f" AND p.province IN ({province_placeholders})"
                        params.extend(provinces)
                except:
                    pass
        
        base_query += " GROUP BY p.id ORDER BY p.created_at DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        
        patients = DatabaseManager.execute_query(base_query, tuple(params), fetch=True)
        
        # Get total count
        count_query = "SELECT COUNT(DISTINCT p.id) as total FROM patients p WHERE 1=1"
        count_params = []
        if search:
            count_query += " AND (p.first_name LIKE %s OR p.last_name LIKE %s OR p.medical_aid_number LIKE %s)"
            search_param = f"%{search}%"
            count_params.extend([search_param, search_param, search_param])
        
        total_result = DatabaseManager.execute_query(count_query, tuple(count_params), fetch=True)
        total = total_result[0]['total'] if total_result else 0
        
        return jsonify({
            'success': True,
            'patients': patients or [],
            'pagination': {
                'page': page,
                'limit': limit,
                'total': total,
                'pages': (total + limit - 1) // limit
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Get patients error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/patients', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor', 'clerk'])
def create_patient():
    """Create new patient record"""
    try:
        data = request.get_json() or {}
        
        logger.info(f"[PATIENT_CREATE] Received data from user {request.current_user.get('email', 'unknown')}: {data}")
        logger.info(f"[PATIENT_CREATE] Request content type: {request.content_type}")
        logger.info(f"[PATIENT_CREATE] Request headers: {dict(request.headers)}")

        # Support payloads with full_name and telephone_number, etc.
        if 'first_name' not in data and data.get('full_name'):
            full_name = str(data.get('full_name', '')).strip()
            parts = [p for p in full_name.split(' ') if p]
            if parts:
                data['first_name'] = parts[0]
                data['last_name'] = ' '.join(parts[1:]) if len(parts) > 1 else 'N/A'
                logger.info(f"[PATIENT_CREATE] Split full_name '{full_name}' into first_name='{data['first_name']}' and last_name='{data['last_name']}'")
            
        # Handle various phone number field names
        if 'phone_number' not in data:
            if data.get('telephone'):
                data['phone_number'] = data.get('telephone')
                logger.info(f"[PATIENT_CREATE] Mapped telephone to phone_number: {data['phone_number']}")
            elif data.get('telephone_number'):
                data['phone_number'] = data.get('telephone_number')
                logger.info(f"[PATIENT_CREATE] Mapped telephone_number to phone_number: {data['phone_number']}")
            
        if 'physical_address' not in data and data.get('address'):
            data['physical_address'] = data.get('address')
            
        if 'is_palmed_member' not in data and data.get('is_member') is not None:
            data['is_palmed_member'] = bool(data.get('is_member'))
            
        if 'member_type' not in data and data.get('membership_status'):
            data['member_type'] = data.get('membership_status')

        # Map alternate keys for date of birth
        if not data.get('date_of_birth'):
            for alt_key in ['dateOfBirth', 'dob', 'birth_date', 'birthDate', 'dateofbirth']:
                if data.get(alt_key):
                    data['date_of_birth'] = data.get(alt_key)
                    logger.info(f"[PATIENT_CREATE] Mapped {alt_key} to date_of_birth: {data['date_of_birth']}")
                    break

        # Map alternate keys for gender
        if not data.get('gender'):
            alt_gender = data.get('Gender') or data.get('sex') or data.get('Sex') or data.get('gender_identity')
            if alt_gender is not None and str(alt_gender).strip():
                data['gender'] = alt_gender
                logger.info(f"[PATIENT_CREATE] Mapped alternate gender key to gender: {data['gender']}")

        # If member flag not provided, infer from presence of medical_aid_number
        if 'is_palmed_member' not in data and data.get('medical_aid_number'):
            data['is_palmed_member'] = True

        logger.info(f"[PATIENT_CREATE] After normalization:")
        logger.info(f"[PATIENT_CREATE] first_name: '{data.get('first_name')}' (type: {type(data.get('first_name'))})")
        logger.info(f"[PATIENT_CREATE] last_name: '{data.get('last_name')}' (type: {type(data.get('last_name'))})")
        logger.info(f"[PATIENT_CREATE] date_of_birth: '{data.get('date_of_birth')}' (type: {type(data.get('date_of_birth'))})")
        logger.info(f"[PATIENT_CREATE] gender: '{data.get('gender')}' (type: {type(data.get('gender'))})")
        logger.info(f"[PATIENT_CREATE] phone_number: '{data.get('phone_number')}' (type: {type(data.get('phone_number'))})")

        # Require minimal fields; allow missing date_of_birth and default gender later
        required_fields = ['first_name', 'last_name', 'phone_number']
        missing_fields = []
        
        for field in required_fields:
            value = data.get(field)
            logger.info(f"[PATIENT_CREATE] Validating field '{field}': value='{value}', type={type(value)}")
            
            if value is None:
                missing_fields.append(field)
                logger.error(f"[PATIENT_CREATE] Field '{field}' is None")
            elif isinstance(value, str) and not value.strip():
                missing_fields.append(field)
                logger.error(f"[PATIENT_CREATE] Field '{field}' is empty or whitespace-only: '{value}'")
            else:
                logger.info(f"[PATIENT_CREATE] Field '{field}' is valid: '{value}'")
        
        if missing_fields:
            error_msg = f'Missing required fields: {", ".join(missing_fields)}'
            logger.error(f"[PATIENT_CREATE] Validation failed: {error_msg}")
            logger.error(f"[PATIENT_CREATE] Complete data received: {json.dumps(data, indent=2)}")
            return jsonify({
                'success': False, 
                'error': error_msg,
                'debug_info': {
                    'received_fields': list(data.keys()),
                    'missing_fields': missing_fields,
                    'field_values': {field: data.get(field) for field in required_fields}
                }
            }), 400

        # If a DOB is provided, validate its format; otherwise allow NULL
        if data.get('date_of_birth'):
            try:
                datetime.strptime(data['date_of_birth'], '%Y-%m-%d')
            except ValueError:
                logger.error(f"[PATIENT_CREATE] Invalid date format: {data.get('date_of_birth')}")
                return jsonify({
                    'success': False, 
                    'error': 'date_of_birth must be in YYYY-MM-DD format'
                }), 400
        
        # Gender: default to 'Other' if not provided, else normalize/validate
        valid_genders = ['Male', 'Female', 'Other']
        if not data.get('gender'):
            data['gender'] = 'Other'
        else:
            gender_input = str(data['gender']).strip()
            gender_match = None
            for valid_gender in valid_genders:
                if gender_input.lower() == valid_gender.lower():
                    gender_match = valid_gender
                    break
            if not gender_match:
                logger.error(f"[PATIENT_CREATE] Invalid gender: {gender_input}")
                return jsonify({
                    'success': False, 
                    'error': f'gender must be one of: {valid_genders}'
                }), 400
            data['gender'] = gender_match

        if data.get('id_number'):
            existing_id = DatabaseManager.execute_query(
                "SELECT id FROM patients WHERE id_number = %s",
                (data['id_number'],),
                fetch=True
            )
            if existing_id:
                return jsonify({'success': False, 'error': 'Patient with this ID number already exists'}), 409
        
        if data.get('medical_aid_number'):
            existing_medical_aid = DatabaseManager.execute_query(
                "SELECT id FROM patients WHERE medical_aid_number = %s",
                (data['medical_aid_number'],),
                fetch=True
            )
            if existing_medical_aid:
                return jsonify({'success': False, 'error': 'Patient with this medical aid number already exists'}), 409
        
        chronic_conditions = data.get('chronic_conditions', [])
        allergies = data.get('allergies', [])
        current_medications = data.get('current_medications', [])
        
        if isinstance(chronic_conditions, list):
            chronic_conditions = json.dumps(chronic_conditions)
        elif isinstance(chronic_conditions, str) and chronic_conditions.strip():
            chronic_conditions = json.dumps([chronic_conditions.strip()])
        else:
            chronic_conditions = json.dumps([])
            
        if isinstance(allergies, list):
            allergies = json.dumps(allergies)
        elif isinstance(allergies, str) and allergies.strip():
            allergies = json.dumps([allergies.strip()])
        else:
            allergies = json.dumps([])
            
        if isinstance(current_medications, list):
            current_medications = json.dumps(current_medications)
        elif isinstance(current_medications, str) and current_medications.strip():
            current_medications = json.dumps([current_medications.strip()])
        else:
            current_medications = json.dumps([])

        insert_query = """
        INSERT INTO patients (medical_aid_number, first_name, last_name, date_of_birth,
                             gender, id_number, phone_number, email, physical_address,
                             emergency_contact_name, emergency_contact_phone, is_palmed_member,
                             member_type, chronic_conditions, allergies, current_medications,
                             created_by, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        insert_values = (
            data.get('medical_aid_number'),
            data['first_name'],
            data['last_name'],
            data['date_of_birth'],
            data['gender'],
            data.get('id_number'),
            data['phone_number'],
            data.get('email'),
            data.get('physical_address'),
            data.get('emergency_contact_name'),
            data.get('emergency_contact_phone'),
            data.get('is_palmed_member', False),
            data.get('member_type', 'Non-member'),
            chronic_conditions,
            allergies,
            current_medications,
            request.current_user['id'],
            datetime.utcnow()
        )
        
        logger.info(f"Executing insert with values: {insert_values}")
        
        result = DatabaseManager.execute_query(insert_query, insert_values)
        
        if result and result > 0:
            try:
                log_query = """
                INSERT INTO audit_log (user_id, table_name, action, new_values, created_at)
                VALUES (%s, 'patients', 'INSERT', %s, %s)
                """
                new_values = json.dumps({
                    'first_name': data['first_name'],
                    'last_name': data['last_name'],
                    'medical_aid_number': data.get('medical_aid_number')
                })
                DatabaseManager.execute_query(log_query, (
                    request.current_user['id'],
                    new_values,
                    datetime.now(timezone.utc)
                ))
            except Exception as log_error:
                logger.warning(f"[PATIENT_CREATE] Failed to log patient creation: {log_error}")
            
            logger.info(f"[PATIENT_CREATE] Patient created successfully by user {request.current_user.get('email')}, affected rows: {result}")
            
            return jsonify({
                'success': True,
                'message': 'Patient created successfully',
                'patient_id': result
            }), 201
        else:
            logger.error("[PATIENT_CREATE] Database insert failed - no rows affected")
            return jsonify({'success': False, 'error': 'Failed to create patient'}), 500
            
    except Exception as e:
        logger.error(f"[PATIENT_CREATE] Unexpected error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500
        
@app.route('/api/patients/<int:patient_id>/visits', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor', 'nurse'])
def create_patient_visit(patient_id: int):
    """Create new patient visit aligned with schema (patient_visits.id as AUTO_INCREMENT)"""
    try:
        data = request.get_json(silent=True) or {}

        # Accept optional values, otherwise default to current date/time
        visit_date = data.get('visit_date') or datetime.now(timezone.utc).date()
        visit_time = data.get('visit_time') or datetime.now(timezone.utc).strftime('%H:%M:%S')
        route_id = data.get('route_id')
        location = (data.get('location') or '').strip() or None

        # Resolve province context for geographic validation
        user_record = request.current_user or {}
        user_geo = user_record.get('geographic_restrictions')
        allowed_provinces = []
        try:
            if user_geo:
                allowed_provinces = json.loads(user_geo)
        except Exception:
            allowed_provinces = []

        route_province = None
        if route_id:
            r = DatabaseManager.execute_query(
                "SELECT province FROM routes WHERE id = %s",
                (route_id,),
                fetch=True,
            )
            if r:
                route_province = r[0].get('province')

        # Choose an effective province: prefer route province, else first allowed, else system default
        effective_province = route_province
        if not effective_province and allowed_provinces:
            effective_province = allowed_provinces[0]
        if not effective_province:
            s = DatabaseManager.execute_query(
                "SELECT setting_value FROM system_settings WHERE setting_key = 'default_province'",
                fetch=True,
            )
            if s:
                effective_province = s[0].get('setting_value')

        # If a route is selected but the user lacks access to its province, reject early with 403
        if route_province and allowed_provinces and route_province not in allowed_provinces:
            return jsonify({'success': False, 'error': f'You do not have geographic access to {route_province}'}), 403

        # If no explicit location, set a generic location including province suffix that the trigger expects
        if not location and effective_province:
            location = f"Clinic Visit, {effective_province}"
        chief_complaint = data.get('chief_complaint')

        insert_query = """
        INSERT INTO patient_visits (
            patient_id, visit_date, visit_time, route_id, location, chief_complaint, current_stage_id, created_by
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """

        # current_stage_id is optional; leave NULL by default
        result = DatabaseManager.execute_query(
            insert_query,
            (
                patient_id,
                visit_date,
                visit_time,
                route_id,
                location,
                chief_complaint,
                None,  # current_stage_id
                request.current_user['id']
            )
        )

        if not result:
            return jsonify({'success': False, 'error': 'Failed to create visit'}), 500

        # Retrieve the newly created visit id (best-effort)
        sel = DatabaseManager.execute_query(
            """
            SELECT id FROM patient_visits
            WHERE patient_id = %s AND created_by = %s
            ORDER BY id DESC
            LIMIT 1
            """,
            (patient_id, request.current_user['id']),
            fetch=True,
        )
        new_visit_id = sel[0]['id'] if sel else None

        return jsonify({
            'success': True,
            'message': 'Visit created successfully',
            'visit_id': new_visit_id
        }), 201

    except Exception as e:
        logger.error(f"Create visit error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

# ----------------------------------------------------------------------------
# VITAL SIGNS ENDPOINTS
# ----------------------------------------------------------------------------

@app.route('/api/visits/<int:visit_id>/vital-signs', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor', 'nurse'])
def add_vital_signs(visit_id: int):
    """Record vital signs for a visit; optionally capture nursing assessment notes"""
    try:
        data = request.get_json(silent=True) or {}

        def to_int(val):
            try:
                return int(val) if val is not None and str(val).strip() != '' else None
            except (ValueError, TypeError):
                return None

        def to_float(val):
            try:
                return float(val) if val is not None and str(val).strip() != '' else None
            except (ValueError, TypeError):
                return None

        systolic_bp = to_int(data.get('systolic_bp'))
        diastolic_bp = to_int(data.get('diastolic_bp'))
        heart_rate = to_int(data.get('heart_rate'))
        temperature = to_float(data.get('temperature'))
        weight = to_float(data.get('weight'))
        height = to_float(data.get('height'))
        oxygen_saturation = to_int(data.get('oxygen_saturation'))
        blood_glucose = to_float(data.get('blood_glucose'))
        respiratory_rate = to_int(data.get('respiratory_rate'))

        additional = data.get('additional_measurements') or {}
        if respiratory_rate is not None:
            additional['respiratory_rate'] = respiratory_rate

        ok = DatabaseManager.execute_query(
            """
            INSERT INTO vital_signs (
                visit_id, recorded_by, systolic_bp, diastolic_bp, heart_rate, temperature,
                weight, height, oxygen_saturation, blood_glucose, additional_measurements
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                visit_id,
                request.current_user['id'],
                systolic_bp,
                diastolic_bp,
                heart_rate,
                temperature,
                weight,
                height,
                oxygen_saturation,
                blood_glucose,
                json.dumps(additional) if additional else None,
            ),
            fetch=False,
        )

        if not ok:
            return jsonify({'success': False, 'error': 'Failed to record vital signs'}), 500

        # Optional nursing assessment note
        nursing_notes = (data.get('nursing_notes') or '').strip()
        if nursing_notes:
            DatabaseManager.execute_query(
                """
                INSERT INTO clinical_notes (
                    visit_id, note_type, content, created_by
                ) VALUES (%s, 'Assessment', %s, %s)
                """,
                (visit_id, nursing_notes, request.current_user['id']),
                fetch=False,
            )

        return jsonify({'success': True, 'message': 'Vital signs recorded'}), 201

    except Exception as e:
        logger.error(f"Add vital signs error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/patients/<int:patient_id>/visits/latest', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'clerk', 'social_work', 'social_worker'])
def get_latest_visit(patient_id: int):
    """Return the most recent visit for a patient (by id desc)."""
    try:
        row = DatabaseManager.execute_query(
            """
            SELECT id, patient_id, visit_date, visit_time, route_id, location, current_stage_id, created_at
            FROM patient_visits
            WHERE patient_id = %s
            ORDER BY id DESC
            LIMIT 1
            """,
            (patient_id,),
            fetch=True,
        )
        payload = _to_jsonable(row[0]) if row else None
        return jsonify({'success': True, 'data': payload}), 200
    except Exception as e:
        logger.error(f"Get latest visit error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/visits/<int:visit_id>/vital-signs', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'clerk', 'social_work', 'social_worker'])
def get_visit_vitals(visit_id: int):
    """Return vitals summary for a visit (count and latest record)."""
    try:
        summary = DatabaseManager.execute_query(
            "SELECT COUNT(*) AS count FROM vital_signs WHERE visit_id = %s",
            (visit_id,),
            fetch=True,
        )
        latest = DatabaseManager.execute_query(
            """
            SELECT id, recorded_at, systolic_bp, diastolic_bp, heart_rate, temperature,
                   weight, height, oxygen_saturation, blood_glucose
            FROM vital_signs
            WHERE visit_id = %s
            ORDER BY id DESC
            LIMIT 1
            """,
            (visit_id,),
            fetch=True,
        )
        # Provide last non-null values to help the UI display Pulse/Temp even when the latest entry omitted them
        last_non_null = DatabaseManager.execute_query(
            """
            SELECT
                (SELECT heart_rate  FROM vital_signs WHERE visit_id = %s AND heart_rate  IS NOT NULL ORDER BY id DESC LIMIT 1) AS heart_rate,
                (SELECT temperature FROM vital_signs WHERE visit_id = %s AND temperature IS NOT NULL ORDER BY id DESC LIMIT 1) AS temperature
            """,
            (visit_id, visit_id),
            fetch=True,
        )
        last_non_null_payload = _to_jsonable(last_non_null[0]) if last_non_null else None
        payload = {
            'count': (summary[0]['count'] if summary else 0),
            'latest': (_to_jsonable(latest[0]) if latest else None),
            'last_non_null': last_non_null_payload,
        }
        return jsonify({'success': True, 'data': payload}), 200
    except Exception as e:
        logger.error(f"Get visit vitals error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

# ============================================================================
# ROUTE PLANNING ENDPOINTS
# ============================================================================

@app.route('/api/routes', methods=['GET'])
@token_required
# Allow read access for roles that have 'routes: read' capability
@role_required(['administrator', 'doctor', 'nurse', 'clerk', 'social_work', 'social_worker'])
def get_routes():
    """Get routes list with filtering"""
    try:
        province = request.args.get('province', '')
        date_from = request.args.get('date_from', '')
        date_to = request.args.get('date_to', '')
        
        # Return UI-friendly fields to match the frontend expectations
        query = """
        SELECT 
            r.id,
            r.route_name AS name,
            r.description,
            r.province,
            r.route_type,
            -- Map to UI location_type values for icons
            CASE 
                WHEN r.route_type = 'Police Stations' THEN 'police_station'
                WHEN r.route_type = 'Schools' THEN 'school'
                WHEN r.route_type = 'Community Centers' THEN 'community_center'
                ELSE 'mixed'
            END AS location_type,
            -- Representative location and times from associated route locations (if any)
            COALESCE(MIN(l.location_name), r.province) AS location,
            r.start_date AS scheduled_date,
            MIN(rl.start_time) AS start_time,
            MAX(rl.end_time) AS end_time,
            r.max_appointments_per_day AS max_appointments,
            CASE 
                WHEN r.is_active = TRUE AND CURDATE() BETWEEN r.start_date AND r.end_date THEN 'active'
                WHEN r.is_active = TRUE AND CURDATE() < r.start_date THEN 'published'
                WHEN CURDATE() > r.end_date THEN 'completed'
                WHEN r.is_active = FALSE THEN 'draft'
                ELSE 'draft'
            END AS status,
            u.first_name, u.last_name,
            COUNT(a.id) as total_appointments,
            COUNT(CASE WHEN a.status = 'Booked' THEN 1 END) as booked_appointments
        FROM routes r
        LEFT JOIN users u ON r.created_by = u.id
        LEFT JOIN route_locations rl ON r.id = rl.route_id
        LEFT JOIN locations l ON rl.location_id = l.id
        LEFT JOIN appointments a ON rl.id = a.route_location_id
        WHERE r.is_active = TRUE
        """
        
        params = []
        
        if province:
            query += " AND r.province = %s"
            params.append(province)
        
        if date_from:
            query += " AND r.start_date >= %s"
            params.append(date_from)
        
        if date_to:
            query += " AND r.end_date <= %s"
            params.append(date_to)
        
        # Role-based filtering
        user_role = request.current_user.get('role_name')
        if user_role == 'doctor':
            geographic_restrictions = request.current_user.get('geographic_restrictions')
            if geographic_restrictions:
                try:
                    import json
                    provinces = json.loads(geographic_restrictions)
                    if provinces and len(provinces) > 0:
                        province_placeholders = ','.join(['%s'] * len(provinces))
                        query += f" AND r.province IN ({province_placeholders})"
                        params.extend(provinces)
                except:
                    pass
        
        query += " GROUP BY r.id ORDER BY r.start_date DESC"
        
        routes = DatabaseManager.execute_query(query, tuple(params), fetch=True)
        
        return jsonify({
            'success': True,
            'routes': routes or []
        }), 200
        
    except Exception as e:
        logger.error(f"Get routes error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/routes', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor'])
def create_route():
    """Create a new route (minimal persist). Note: route_locations are not created here."""
    try:
        data = request.get_json() or {}

        route_name = str(data.get('route_name', '')).strip()
        description = str(data.get('description', '')).strip() or None
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        province = str(data.get('province', '')).strip()
        max_per_day = int(data.get('max_appointments_per_day') or 100)

        # Derive route_type or default
        route_type_input = (data.get('route_type') or '').strip()
        valid_types = ['Police Stations', 'Schools', 'Community Centers', 'Mixed']
        if route_type_input in valid_types:
            route_type = route_type_input
        else:
            # Try to infer from a provided location_type
            lt = (data.get('location_type') or '').strip().lower()
            if lt == 'police_station':
                route_type = 'Police Stations'
            elif lt == 'school':
                route_type = 'Schools'
            elif lt == 'community_center':
                route_type = 'Community Centers'
            else:
                route_type = 'Mixed'

        # Basic validation
        missing = []
        if not route_name: missing.append('route_name')
        if not start_date: missing.append('start_date')
        if not end_date: missing.append('end_date')
        if not province: missing.append('province')

        if missing:
            return jsonify({'success': False, 'error': f"Missing required fields: {', '.join(missing)}"}), 400

        insert_sql = (
            """
            INSERT INTO routes (route_name, description, start_date, end_date, province, route_type,
                                max_appointments_per_day, created_by, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, TRUE)
            """
        )
        user_id = request.current_user.get('id')
        result = DatabaseManager.execute_query(
            insert_sql,
            (route_name, description, start_date, end_date, province, route_type, max_per_day, user_id),
            fetch=False,
        )

        logger.info(f"Insert routes rowcount: {result}")

        if not result:
            return jsonify({'success': False, 'error': 'Failed to create route'}), 500

        # Best-effort fetch of the inserted id (no reliance on LAST_INSERT_ID across connections)
        sel = DatabaseManager.execute_query(
            "SELECT id FROM routes WHERE route_name = %s AND created_by = %s ORDER BY id DESC LIMIT 1",
            (route_name, user_id),
            fetch=True,
        )
        new_id = sel[0]['id'] if sel else None

        # Return a UI-friendly record similar to GET /api/routes
        route_row = DatabaseManager.execute_query(
            """
            SELECT 
                r.id,
                r.route_name AS name,
                r.description,
                r.province,
                r.route_type,
                CASE 
                    WHEN r.route_type = 'Police Stations' THEN 'police_station'
                    WHEN r.route_type = 'Schools' THEN 'school'
                    WHEN r.route_type = 'Community Centers' THEN 'community_center'
                    ELSE 'mixed'
                END AS location_type,
                COALESCE((SELECT MIN(l.location_name) FROM route_locations rl JOIN locations l ON rl.location_id = l.id WHERE rl.route_id = r.id), r.province) AS location,
                r.start_date AS scheduled_date,
                (SELECT MIN(rl.start_time) FROM route_locations rl WHERE rl.route_id = r.id) AS start_time,
                (SELECT MAX(rl.end_time) FROM route_locations rl WHERE rl.route_id = r.id) AS end_time,
                r.max_appointments_per_day AS max_appointments,
                CASE 
                    WHEN r.is_active = TRUE AND CURDATE() BETWEEN r.start_date AND r.end_date THEN 'active'
                    WHEN r.is_active = TRUE AND CURDATE() < r.start_date THEN 'published'
                    WHEN CURDATE() > r.end_date THEN 'completed'
                    WHEN r.is_active = FALSE THEN 'draft'
                    ELSE 'draft'
                END AS status
            FROM routes r
            WHERE r.id = %s
            """,
            (new_id,),
            fetch=True,
        )

        logger.info(f"Route created successfully with id={new_id}, name={route_name}, province={province}, type={route_type}")
        return jsonify({'success': True, 'data': route_row[0] if route_row else {'id': new_id}}), 201

    except Exception as e:
        logger.error(f"Create route error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

# ============================================================================
# REFERRAL MANAGEMENT ENDPOINTS
# ============================================================================

@app.route('/api/patients/<int:patient_id>/referrals', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'clerk', 'social_work', 'social_worker'])
def list_referrals(patient_id: int):
    """List referrals for a patient"""
    try:
        rows = DatabaseManager.execute_query(
            """
            SELECT r.*, u.first_name AS created_by_first, u.last_name AS created_by_last
            FROM referrals r
            LEFT JOIN users u ON u.id = r.created_by
            WHERE r.patient_id = %s
            ORDER BY r.created_at DESC
            """,
            (patient_id,),
            fetch=True,
        )
        return jsonify({'success': True, 'data': rows or []}), 200
    except Exception as e:
        logger.error(f"List referrals error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/patients/<int:patient_id>/referrals', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'social_work', 'social_worker'])
def create_referral(patient_id: int):
    """Create a referral (internal or external)"""
    try:
        data = request.get_json(silent=True) or {}
        referral_type = (data.get('referral_type') or 'internal').lower()
        from_stage = data.get('from_stage')
        to_stage = data.get('to_stage') if referral_type == 'internal' else None
        external_provider = data.get('external_provider') if referral_type == 'external' else None
        department = data.get('department') if referral_type == 'external' else None
        reason = (data.get('reason') or '').strip()
        notes = data.get('notes')
        visit_id = data.get('visit_id')  # optional INT
        appointment_date = data.get('appointment_date')  # optional 'YYYY-MM-DD'

        missing = []
        if not from_stage: missing.append('from_stage')
        if referral_type == 'internal' and not to_stage: missing.append('to_stage')
        if referral_type == 'external' and not external_provider: missing.append('external_provider')
        if not reason: missing.append('reason')
        if missing:
            return jsonify({'success': False, 'error': f"Missing required fields: {', '.join(missing)}"}), 400

        if appointment_date:
            try:
                datetime.strptime(appointment_date, '%Y-%m-%d')
            except ValueError:
                return jsonify({'success': False, 'error': 'appointment_date must be YYYY-MM-DD'}), 400

        ok = DatabaseManager.execute_query(
            """
            INSERT INTO referrals
            (patient_id, visit_id, referral_type, from_stage, to_stage, external_provider, department,
             reason, notes, status, appointment_date, created_by, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', %s, %s, %s)
            """,
            (
                patient_id, visit_id,
                'external' if referral_type == 'external' else 'internal',
                from_stage, to_stage, external_provider, department,
                reason, notes, appointment_date,
                request.current_user['id'], datetime.now(timezone.utc),
            ),
            fetch=False,
        )
        if not ok:
            return jsonify({'success': False, 'error': 'Failed to create referral'}), 500

        row = DatabaseManager.execute_query(
            """
            SELECT r.*, u.first_name AS created_by_first, u.last_name AS created_by_last
            FROM referrals r
            LEFT JOIN users u ON u.id = r.created_by
            WHERE r.patient_id = %s
            ORDER BY r.id DESC
            LIMIT 1
            """,
            (patient_id,),
            fetch=True,
        )
        return jsonify({'success': True, 'data': (row[0] if row else None)}), 201
    except Exception as e:
        logger.error(f"Create referral error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/referrals/<int:referral_id>', methods=['PATCH'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'social_work', 'social_worker', 'clerk'])
def update_referral(referral_id: int):
    """Update referral status, appointment date, or notes"""
    try:
        data = request.get_json(silent=True) or {}
        sets, params = [], []

        status = data.get('status')
        if status:
            if status not in ['pending','sent','accepted','completed','cancelled']:
                return jsonify({'success': False, 'error': 'Invalid status'}), 400
            sets.append("status = %s"); params.append(status)

        appointment_date = data.get('appointment_date')
        if appointment_date:
            try:
                datetime.strptime(appointment_date, '%Y-%m-%d')
            except ValueError:
                return jsonify({'success': False, 'error': 'appointment_date must be YYYY-MM-DD'}), 400
            sets.append("appointment_date = %s"); params.append(appointment_date)

        if 'notes' in data:
            sets.append("notes = %s"); params.append(data.get('notes'))

        if not sets:
            return jsonify({'success': False, 'error': 'No changes provided'}), 400

        sets.append("updated_at = %s"); params.append(datetime.now(timezone.utc))
        params.append(referral_id)

        ok = DatabaseManager.execute_query(
            f"UPDATE referrals SET {', '.join(sets)} WHERE id = %s",
            tuple(params),
            fetch=False,
        )
        if not ok:
            return jsonify({'success': False, 'error': 'Update failed'}), 500

        row = DatabaseManager.execute_query(
            """
            SELECT r.*, u.first_name AS created_by_first, u.last_name AS created_by_last
            FROM referrals r
            LEFT JOIN users u ON u.id = r.created_by
            WHERE r.id = %s
            """,
            (referral_id,),
            fetch=True,
        )
        return jsonify({'success': True, 'data': (row[0] if row else None)}), 200
    except Exception as e:
        logger.error(f"Update referral error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

# ============================================================================
# INVENTORY MANAGEMENT ENDPOINTS
# ============================================================================
# Removed duplicate legacy inventory endpoints to avoid route conflicts.

# ============================================================================
# DASHBOARD AND ANALYTICS ENDPOINTS
# ============================================================================

@app.route('/api/dashboard/stats', methods=['GET'])
@token_required
def get_dashboard_stats():
    """Get role-specific dashboard statistics"""
    try:
        # Get user role and normalize it
        raw_role = (request.current_user or {}).get('role_name', '')
        user_role = str(raw_role).strip().lower().replace(' ', '_')
        user_id = request.current_user.get('id')

        # Base stats structure
        stats = {
            'todayPatients': 0,
            'weeklyPatients': 0,
            'monthlyPatients': 0,
            'pendingAppointments': 0,
            'completedWorkflows': 0,
            'activeRoutes': 0,
            'lowStockAlerts': 0,
            'maintenanceAlerts': 0,
            'recentActivity': [],
            'upcomingTasks': [],
            'roleSpecificMetrics': {}
        }

        # Role-specific metrics with proper queries
        if user_role == 'clerk':
            # Clerk: Track registrations and appointment bookings
            reg_stats = DatabaseManager.execute_query(
                """
                SELECT 
                    COUNT(CASE WHEN DATE(p.created_at) = CURDATE() THEN 1 END) AS today_registrations,
                    COUNT(CASE WHEN DATE(p.created_at) >= CURDATE() - INTERVAL 7 DAY THEN 1 END) AS week_registrations,
                    COUNT(CASE WHEN DATE(p.created_at) >= CURDATE() - INTERVAL 30 DAY THEN 1 END) AS month_registrations
                FROM patients p
                WHERE p.created_by = %s
                """,
                (user_id,),
                fetch=True,
            )
            
            booking_stats = DatabaseManager.execute_query(
                """
                SELECT 
                    COUNT(CASE WHEN DATE(a.booked_at) = CURDATE() AND a.status = 'Booked' THEN 1 END) AS today_bookings,
                    COUNT(CASE WHEN DATE(a.booked_at) >= CURDATE() - INTERVAL 7 DAY AND a.status = 'Booked' THEN 1 END) AS week_bookings,
                    COUNT(CASE WHEN DATE(a.booked_at) >= CURDATE() - INTERVAL 30 DAY AND a.status = 'Booked' THEN 1 END) AS month_bookings
                FROM appointments a
                """,
                fetch=True,
            )
            
            reg_data = reg_stats[0] if reg_stats else {}
            booking_data = booking_stats[0] if booking_stats else {}
            
            stats['todayPatients'] = int(reg_data.get('today_registrations', 0))
            stats['weeklyPatients'] = int(reg_data.get('week_registrations', 0))
            stats['monthlyPatients'] = int(reg_data.get('month_registrations', 0))
            
            stats['roleSpecificMetrics'] = {
                'todayBookings': int(booking_data.get('today_bookings', 0)),
                'weekBookings': int(booking_data.get('week_bookings', 0)),
                'monthBookings': int(booking_data.get('month_bookings', 0)),
                'metricType': 'registrations'
            }

        elif user_role == 'nurse':
            # Nurse: Track vital signs and nursing assessments
            vitals_stats = DatabaseManager.execute_query(
                """
                SELECT 
                    COUNT(CASE WHEN DATE(vs.recorded_at) = CURDATE() THEN 1 END) AS today_vitals,
                    COUNT(CASE WHEN DATE(vs.recorded_at) >= CURDATE() - INTERVAL 7 DAY THEN 1 END) AS week_vitals,
                    COUNT(CASE WHEN DATE(vs.recorded_at) >= CURDATE() - INTERVAL 30 DAY THEN 1 END) AS month_vitals
                FROM vital_signs vs
                WHERE vs.recorded_by = %s
                """,
                (user_id,),
                fetch=True,
            )
            
            assessment_stats = DatabaseManager.execute_query(
                """
                SELECT 
                    COUNT(DISTINCT CASE WHEN DATE(cn.created_at) = CURDATE() THEN cn.visit_id END) AS today_assessments,
                    COUNT(DISTINCT CASE WHEN DATE(cn.created_at) >= CURDATE() - INTERVAL 7 DAY THEN cn.visit_id END) AS week_assessments,
                    COUNT(DISTINCT CASE WHEN DATE(cn.created_at) >= CURDATE() - INTERVAL 30 DAY THEN cn.visit_id END) AS month_assessments
                FROM clinical_notes cn
                WHERE cn.created_by = %s AND cn.note_type = 'Assessment'
                """,
                (user_id,),
                fetch=True,
            )
            
            vitals_data = vitals_stats[0] if vitals_stats else {}
            assessment_data = assessment_stats[0] if assessment_stats else {}
            
            stats['todayPatients'] = int(vitals_data.get('today_vitals', 0))
            stats['weeklyPatients'] = int(vitals_data.get('week_vitals', 0))
            stats['monthlyPatients'] = int(vitals_data.get('month_vitals', 0))
            
            stats['roleSpecificMetrics'] = {
                'todayAssessments': int(assessment_data.get('today_assessments', 0)),
                'weekAssessments': int(assessment_data.get('week_assessments', 0)),
                'monthAssessments': int(assessment_data.get('month_assessments', 0)),
                'metricType': 'vitals'
            }

        elif user_role == 'doctor':
            # Doctor: Track diagnoses and treatments
            clinical_stats = DatabaseManager.execute_query(
                """
                SELECT 
                    COUNT(DISTINCT CASE WHEN DATE(cn.created_at) = CURDATE() THEN cn.visit_id END) AS today_clinical,
                    COUNT(DISTINCT CASE WHEN DATE(cn.created_at) >= CURDATE() - INTERVAL 7 DAY THEN cn.visit_id END) AS week_clinical,
                    COUNT(DISTINCT CASE WHEN DATE(cn.created_at) >= CURDATE() - INTERVAL 30 DAY THEN cn.visit_id END) AS month_clinical
                FROM clinical_notes cn
                WHERE cn.created_by = %s AND cn.note_type IN ('Diagnosis', 'Treatment')
                """,
                (user_id,),
                fetch=True,
            )
            
            diagnosis_stats = DatabaseManager.execute_query(
                """
                SELECT 
                    COUNT(CASE WHEN DATE(cn.created_at) = CURDATE() AND cn.note_type = 'Diagnosis' THEN 1 END) AS today_diagnosis,
                    COUNT(CASE WHEN DATE(cn.created_at) = CURDATE() AND cn.note_type = 'Treatment' THEN 1 END) AS today_treatment
                FROM clinical_notes cn
                WHERE cn.created_by = %s
                """,
                (user_id,),
                fetch=True,
            )
            
            clinical_data = clinical_stats[0] if clinical_stats else {}
            diagnosis_data = diagnosis_stats[0] if diagnosis_stats else {}
            
            stats['todayPatients'] = int(clinical_data.get('today_clinical', 0))
            stats['weeklyPatients'] = int(clinical_data.get('week_clinical', 0))
            stats['monthlyPatients'] = int(clinical_data.get('month_clinical', 0))
            
            stats['roleSpecificMetrics'] = {
                'todayDiagnoses': int(diagnosis_data.get('today_diagnosis', 0)),
                'todayTreatments': int(diagnosis_data.get('today_treatment', 0)),
                'metricType': 'clinical'
            }

        elif user_role == 'social_worker':
            # Social Worker: Track counseling sessions and referrals
            counseling_stats = DatabaseManager.execute_query(
                """
                SELECT 
                    COUNT(DISTINCT CASE WHEN DATE(cn.created_at) = CURDATE() THEN cn.visit_id END) AS today_counseling,
                    COUNT(DISTINCT CASE WHEN DATE(cn.created_at) >= CURDATE() - INTERVAL 7 DAY THEN cn.visit_id END) AS week_counseling,
                    COUNT(DISTINCT CASE WHEN DATE(cn.created_at) >= CURDATE() - INTERVAL 30 DAY THEN cn.visit_id END) AS month_counseling
                FROM clinical_notes cn
                WHERE cn.created_by = %s AND cn.note_type IN ('Counseling', 'Referral')
                """,
                (user_id,),
                fetch=True,
            )
            
            referral_stats = DatabaseManager.execute_query(
                """
                SELECT 
                    COUNT(CASE WHEN DATE(r.created_at) = CURDATE() THEN 1 END) AS today_referrals,
                    COUNT(CASE WHEN DATE(r.created_at) >= CURDATE() - INTERVAL 7 DAY THEN 1 END) AS week_referrals
                FROM referrals r
                WHERE r.created_by = %s
                """,
                (user_id,),
                fetch=True,
            )
            
            counseling_data = counseling_stats[0] if counseling_stats else {}
            referral_data = referral_stats[0] if referral_stats else {}
            
            stats['todayPatients'] = int(counseling_data.get('today_counseling', 0))
            stats['weeklyPatients'] = int(counseling_data.get('week_counseling', 0))
            stats['monthlyPatients'] = int(counseling_data.get('month_counseling', 0))
            
            stats['roleSpecificMetrics'] = {
                'todayReferrals': int(referral_data.get('today_referrals', 0)),
                'weekReferrals': int(referral_data.get('week_referrals', 0)),
                'metricType': 'counseling'
            }

        else:
            # Administrator or unknown role: Overall system metrics
            system_stats = DatabaseManager.execute_query(
                """
                SELECT 
                    COUNT(CASE WHEN visit_date = CURDATE() THEN 1 END) AS visits_today,
                    COUNT(CASE WHEN visit_date >= CURDATE() - INTERVAL 7 DAY THEN 1 END) AS visits_7d,
                    COUNT(CASE WHEN visit_date >= CURDATE() - INTERVAL 30 DAY THEN 1 END) AS visits_30d
                FROM patient_visits
                """,
                fetch=True,
            )
            
            system_data = system_stats[0] if system_stats else {}
            stats['todayPatients'] = int(system_data.get('visits_today', 0))
            stats['weeklyPatients'] = int(system_data.get('visits_7d', 0))
            stats['monthlyPatients'] = int(system_data.get('visits_30d', 0))
            
            stats['roleSpecificMetrics'] = {
                'metricType': 'system_overview'
            }

        # Common metrics for all roles
        
        # Pending appointments for today
        pending_appointments = DatabaseManager.execute_query(
            """
            SELECT COUNT(*) AS pending
            FROM appointments a
            JOIN route_locations rl ON a.route_location_id = rl.id
            WHERE rl.visit_date = CURDATE() AND a.status = 'Booked'
            """,
            fetch=True,
        )
        stats['pendingAppointments'] = int((pending_appointments or [{}])[0].get('pending') or 0)

        # Completed workflows (user-specific for non-admins)
        if user_role != 'administrator':
            completed_wf = DatabaseManager.execute_query(
                """
                SELECT COUNT(*) AS completed
                FROM visit_workflow_progress vwp
                WHERE vwp.assigned_user_id = %s
                AND vwp.is_completed = TRUE
                AND vwp.completed_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
                """,
                (user_id,),
                fetch=True,
            )
        else:
            completed_wf = DatabaseManager.execute_query(
                """
                SELECT COUNT(*) AS completed
                FROM visit_workflow_progress
                WHERE is_completed = TRUE
                AND completed_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
                """,
                fetch=True,
            )
        stats['completedWorkflows'] = int((completed_wf or [{}])[0].get('completed') or 0)

        # Active routes
        active_routes = DatabaseManager.execute_query(
            """
            SELECT COUNT(*) AS active
            FROM routes
            WHERE is_active = TRUE AND CURDATE() BETWEEN start_date AND end_date
            """,
            fetch=True,
        )
        stats['activeRoutes'] = int((active_routes or [{}])[0].get('active') or 0)

        # Inventory alerts (only for relevant roles)
        if user_role in ['administrator', 'doctor', 'nurse']:
            low_stock = DatabaseManager.execute_query(
                """
                SELECT COUNT(*) AS low_stock
                FROM inventory_stock s
                JOIN consumables c ON s.consumable_id = c.id
                WHERE s.quantity_current <= c.reorder_level
                """,
                fetch=True,
            )
            stats['lowStockAlerts'] = int((low_stock or [{}])[0].get('low_stock') or 0)

            maintenance = DatabaseManager.execute_query(
                """
                SELECT COUNT(*) AS maintenance_alerts
                FROM assets
                WHERE status = 'Maintenance Required'
                   OR (next_maintenance_date IS NOT NULL AND next_maintenance_date <= CURDATE())
                """,
                fetch=True,
            )
            stats['maintenanceAlerts'] = int((maintenance or [{}])[0].get('maintenance_alerts') or 0)

        # Recent activity (user-specific)
        recent_activity = DatabaseManager.execute_query(
            """
            SELECT 
                al.id,
                al.action,
                al.table_name,
                al.created_at,
                CASE 
                    WHEN al.table_name = 'patients' THEN 'patient'
                    WHEN al.table_name = 'appointments' THEN 'appointment'
                    WHEN al.table_name = 'inventory_usage' THEN 'inventory'
                    WHEN al.table_name = 'routes' THEN 'route'
                    ELSE 'system'
                END AS activity_type,
                CASE 
                    WHEN al.action = 'INSERT' THEN CONCAT('Created new ', al.table_name, ' record')
                    WHEN al.action = 'UPDATE' THEN CONCAT('Updated ', al.table_name, ' record')
                    ELSE CONCAT(al.action, ' ', al.table_name)
                END AS description
            FROM audit_log al
            WHERE al.user_id = %s
            AND al.created_at >= CURDATE() - INTERVAL 7 DAY
            ORDER BY al.created_at DESC
            LIMIT 10
            """,
            (user_id,),
            fetch=True,
        )

        stats['recentActivity'] = [
            {
                'id': str(activity['id']),
                'type': activity['activity_type'],
                'description': activity['description'],
                'timestamp': activity['created_at'].isoformat() if activity['created_at'] else '',
                'status': 'completed'
            }
            for activity in (recent_activity or [])
        ]

        return jsonify({'success': True, 'stats': stats}), 200

    except Exception as e:
        logger.error(f"Dashboard stats error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'error': 'Internal server error'}), 500

# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        # Test database connection
        connection = DatabaseManager.get_connection()
        if connection:
            connection.close()
            db_status = 'healthy'
        else:
            db_status = 'unhealthy'
        
        return jsonify({
            'status': 'healthy' if db_status == 'healthy' else 'unhealthy',
            'database': db_status,
            'timestamp': datetime.utcnow().isoformat()
        }), 200 if db_status == 'healthy' else 503
        
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 503

# ============================================================================
# CLINICAL WORKFLOW ENDPOINTS
# ============================================================================

@app.route('/api/workflow/stages', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'clerk', 'social_work', 'social_worker'])
def get_workflow_stages():
    """Get all workflow stages in order"""
    try:
        stages = DatabaseManager.execute_query(
            """
            SELECT ws.*, ur.role_name as required_role
            FROM workflow_stages ws
            JOIN user_roles ur ON ws.required_role_id = ur.id
            ORDER BY ws.stage_order
            """,
            fetch=True
        )
        
        return jsonify({
            'success': True,
            'stages': stages or []
        }), 200
        
    except Exception as e:
        logger.error(f"Get workflow stages error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/visits/<int:visit_id>/workflow', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'clerk', 'social_work', 'social_worker'])
def get_visit_workflow(visit_id: int):
    """Get workflow progress for a visit"""
    try:
        workflow = DatabaseManager.execute_query(
            """
            SELECT vwp.*, ws.stage_name, ws.stage_order, ur.role_name as required_role,
                   u.first_name, u.last_name
            FROM visit_workflow_progress vwp
            JOIN workflow_stages ws ON vwp.stage_id = ws.id
            JOIN user_roles ur ON ws.required_role_id = ur.id
            LEFT JOIN users u ON vwp.assigned_user_id = u.id
            WHERE vwp.visit_id = %s
            ORDER BY ws.stage_order
            """,
            (visit_id,),
            fetch=True
        )
        
        return jsonify({
            'success': True,
            'workflow': workflow or []
        }), 200
        
    except Exception as e:
        logger.error(f"Get visit workflow error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/visits/<int:visit_id>/workflow/status', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'clerk', 'social_work', 'social_worker'])
def get_visit_workflow_status(visit_id: int):
    """Return high-level workflow status for a visit used by the frontend to route roles.

    Stages covered (in order):
    - Registration (assumed complete when a visit exists)
    - Nursing Assessment (completed when any vital_signs exist for the visit)
    - Doctor Consultation (completed when any clinical_notes of type Assessment/Diagnosis/Treatment exist)
    - Counseling Session (completed when a clinical_note of type Counseling exists)
    - File Closure (completed when a clinical_note of type Closure exists)
    """
    try:
        # Visit metadata (for Registration timestamp)
        visit_rows = DatabaseManager.execute_query(
            """
            SELECT id, created_at
            FROM patient_visits
            WHERE id = %s
            """,
            (visit_id,),
            fetch=True,
        )
        if not visit_rows:
            return jsonify({'success': False, 'error': 'Visit not found'}), 404

        visit_created_at = visit_rows[0].get('created_at')

        # Nursing: any vitals captured?
        nursing = DatabaseManager.execute_query(
            "SELECT COUNT(*) AS c, MAX(recorded_at) AS latest FROM vital_signs WHERE visit_id = %s",
            (visit_id,),
            fetch=True,
        )
        nursing_count = (nursing[0]['c'] if nursing else 0) or 0
        nursing_latest = nursing[0].get('latest') if nursing else None

        # Doctor Consultation: only count Diagnosis/Treatment notes created by a Doctor
        doctor_row = DatabaseManager.execute_query(
            """
            SELECT MAX(cn.created_at) AS latest
            FROM clinical_notes cn
            JOIN users u ON u.id = cn.created_by
            JOIN user_roles ur ON ur.id = u.role_id
            WHERE cn.visit_id = %s
                AND cn.note_type IN ('Diagnosis','Treatment')
                AND ur.role_name = 'Doctor'
            """,
            (visit_id,),
            fetch=True,
        )
        doctor_latest = doctor_row[0].get('latest') if doctor_row else None
        doctor_done = bool(doctor_latest)

        # Counseling Session: only count Counseling notes created by a Social Worker
        counseling_row = DatabaseManager.execute_query(
            """
            SELECT MAX(cn.created_at) AS latest
            FROM clinical_notes cn
            JOIN users u ON u.id = cn.created_by
            JOIN user_roles ur ON ur.id = u.role_id
            WHERE cn.visit_id = %s
                AND cn.note_type = 'Counseling'
                AND ur.role_name = 'Social Worker'
            """,
            (visit_id,),
            fetch=True,
        )
        counseling_latest = counseling_row[0].get('latest') if counseling_row else None
        counseling_done = bool(counseling_latest)

        # File Closure: any Closure note regardless of role (typically doctor)
        closure_row = DatabaseManager.execute_query(
            """
            SELECT MAX(created_at) AS latest
            FROM clinical_notes
            WHERE visit_id = %s AND note_type = 'Closure'
            """,
            (visit_id,),
            fetch=True,
        )
        closure_latest = closure_row[0].get('latest') if closure_row else None
        closure_done = bool(closure_latest)

        workflow = [
            {
                'stage': 'Registration',
                'completed': True,
                'completed_at': _to_jsonable(visit_created_at),
            },
            {
                'stage': 'Nursing Assessment',
                'completed': nursing_count > 0,
                'completed_at': _to_jsonable(nursing_latest) if nursing_count > 0 else None,
            },
            {
                'stage': 'Doctor Consultation',
                'completed': bool(doctor_done),
                'completed_at': _to_jsonable(doctor_latest) if doctor_done else None,
            },
            {
                'stage': 'Counseling Session',
                'completed': bool(counseling_done),
                'completed_at': _to_jsonable(counseling_latest) if counseling_done else None,
            },
            {
                'stage': 'File Closure',
                'completed': bool(closure_done),
                'completed_at': _to_jsonable(closure_latest) if closure_done else None,
            },
        ]

        return jsonify({'success': True, 'workflow': workflow}), 200
    except Exception as e:
        logger.error(f"Get workflow status error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/visits/<int:visit_id>/workflow/advance', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'clerk', 'social_work', 'social_worker'])
def advance_workflow_stage(visit_id: int):
    """Advance workflow to next stage"""
    try:
        data = request.get_json() or {}
        current_stage_id = data.get('current_stage_id')
        notes = data.get('notes', '')
        data_collected = data.get('data_collected', {})
        
        if not current_stage_id:
            return jsonify({'success': False, 'error': 'current_stage_id is required'}), 400
        
        connection = DatabaseManager.get_connection()
        if not connection:
            return jsonify({'success': False, 'error': 'Database connection failed'}), 500
        
        try:
            cursor = connection.cursor()
            cursor.callproc('sp_advance_workflow_stage', [
                visit_id,
                current_stage_id,
                request.current_user['id'],
                notes,
                json.dumps(data_collected) if data_collected else None
            ])
            
            # Get the result
            for result in cursor.stored_results():
                row = result.fetchone()
                if row:
                    result_message = row[0]
                    break
            
            connection.commit()
            
            if result_message.startswith('SUCCESS'):
                return jsonify({
                    'success': True,
                    'message': result_message
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'error': result_message
                }), 400
                
        finally:
            cursor.close()
            connection.close()
        
    except Exception as e:
        logger.error(f"Advance workflow error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/visits/<int:visit_id>/workflow/initialize', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'clerk', 'social_work', 'social_worker'])
def initialize_visit_workflow(visit_id: int):
    """Initialize workflow for a visit"""
    try:
        connection = DatabaseManager.get_connection()
        if not connection:
            return jsonify({'success': False, 'error': 'Database connection failed'}), 500
        
        try:
            cursor = connection.cursor()
            cursor.callproc('sp_initialize_visit_workflow', [visit_id])
            
            # Get the result
            for result in cursor.stored_results():
                row = result.fetchone()
                if row:
                    result_message = row[0]
                    break
            
            connection.commit()
            
            if result_message.startswith('SUCCESS'):
                return jsonify({
                    'success': True,
                    'message': 'Workflow initialized successfully'
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'error': result_message
                }), 400
                
        finally:
            cursor.close()
            connection.close()
        
    except Exception as e:
        logger.error(f"Initialize workflow error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

# ============================================================================
# CLINICAL NOTES ENDPOINTS
# ============================================================================

@app.route('/api/visits/<int:visit_id>/clinical-notes', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'social_work', 'social_worker'])
def get_clinical_notes(visit_id: int):
    """Get clinical notes for a visit"""
    try:
        notes = DatabaseManager.execute_query(
            """
            SELECT cn.*, u.first_name, u.last_name
            FROM clinical_notes cn
            JOIN users u ON cn.created_by = u.id
            WHERE cn.visit_id = %s
            ORDER BY cn.created_at DESC
            """,
            (visit_id,),
            fetch=True
        )
        
        return jsonify({
            'success': True,
            'notes': notes or []
        }), 200
        
    except Exception as e:
        logger.error(f"Get clinical notes error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/visits/<int:visit_id>/clinical-notes', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'social_work', 'social_worker'])
def create_clinical_note(visit_id: int):
    """Create a clinical note"""
    try:
        data = request.get_json() or {}
        
        note_type = data.get('note_type')
        content = data.get('content', '').strip()
        icd10_codes = data.get('icd10_codes', [])
        medications_prescribed = data.get('medications_prescribed', [])
        follow_up_required = data.get('follow_up_required', False)
        follow_up_date = data.get('follow_up_date')
        
        if not note_type or not content:
            return jsonify({'success': False, 'error': 'note_type and content are required'}), 400
        
        valid_note_types = ['Assessment', 'Diagnosis', 'Treatment', 'Referral', 'Counseling', 'Closure']
        if note_type not in valid_note_types:
            return jsonify({'success': False, 'error': f'note_type must be one of: {valid_note_types}'}), 400
        
        result = DatabaseManager.execute_query(
            """
            INSERT INTO clinical_notes (
                visit_id, note_type, content, icd10_codes, medications_prescribed,
                follow_up_required, follow_up_date, created_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                visit_id,
                note_type,
                content,
                json.dumps(icd10_codes) if icd10_codes else None,
                json.dumps(medications_prescribed) if medications_prescribed else None,
                follow_up_required,
                follow_up_date,
                request.current_user['id']
            )
        )
        
        if result:
            return jsonify({
                'success': True,
                'message': 'Clinical note created successfully'
            }), 201
        else:
            return jsonify({'success': False, 'error': 'Failed to create clinical note'}), 500
        
    except Exception as e:
        logger.error(f"Create clinical note error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

# ============================================================================
# APPOINTMENT BOOKING SYSTEM
# ============================================================================

@app.route('/api/appointments/available', methods=['GET'])
def get_available_appointments():
    """Get available appointment slots (public endpoint)"""
    try:
        province = request.args.get('province', '')
        date_from = request.args.get('date_from', '')
        date_to = request.args.get('date_to', '')
        location_type = request.args.get('location_type', '')
        
        query = """
        SELECT 
            a.id,
            a.appointment_time,
            a.duration_minutes,
            rl.visit_date,
            l.location_name,
            l.province,
            l.city,
            lt.type_name as location_type,
            r.route_name,
            r.route_type
        FROM appointments a
        JOIN route_locations rl ON a.route_location_id = rl.id
        JOIN routes r ON rl.route_id = r.id
        JOIN locations l ON rl.location_id = l.id
        JOIN location_types lt ON l.location_type_id = lt.id
        WHERE a.status = 'Available'
        AND r.is_active = TRUE
        AND rl.visit_date >= CURDATE()
        """
        
        params = []
        
        if province:
            query += " AND l.province = %s"
            params.append(province)
        
        if date_from:
            query += " AND rl.visit_date >= %s"
            params.append(date_from)
        
        if date_to:
            query += " AND rl.visit_date <= %s"
            params.append(date_to)
        
        if location_type:
            query += " AND lt.type_name = %s"
            params.append(location_type)
        
        query += " ORDER BY rl.visit_date, a.appointment_time"
        
        appointments = DatabaseManager.execute_query(query, tuple(params), fetch=True)
        
        return jsonify({
            'success': True,
            'appointments': appointments or []
        }), 200
        
    except Exception as e:
        logger.error(f"Get available appointments error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/appointments/<int:appointment_id>/book', methods=['POST'])
def book_appointment(appointment_id: int):
    """Book an appointment (public endpoint)"""
    try:
        data = request.get_json() or {}
        
        patient_id = data.get('patient_id')
        booked_by_name = data.get('booked_by_name', '').strip()
        booked_by_phone = data.get('booked_by_phone', '').strip()
        booked_by_email = data.get('booked_by_email', '').strip()
        special_requirements = data.get('special_requirements', '').strip()
        
        if not booked_by_name or not booked_by_phone:
            return jsonify({'success': False, 'error': 'Name and phone number are required'}), 400
        
        connection = DatabaseManager.get_connection()
        if not connection:
            return jsonify({'success': False, 'error': 'Database connection failed'}), 500
        
        try:
            cursor = connection.cursor()
            cursor.callproc('sp_book_appointment', [
                appointment_id,
                patient_id,
                booked_by_name,
                booked_by_phone,
                booked_by_email,
                special_requirements
            ])
            
            # Get the results
            booking_reference = None
            result_message = None
            for result in cursor.stored_results():
                row = result.fetchone()
                if row:
                    booking_reference = row[0]
                    result_message = row[1]
                    break
            
            connection.commit()
            
            if result_message and result_message.startswith('SUCCESS'):
                return jsonify({
                    'success': True,
                    'booking_reference': booking_reference,
                    'message': 'Appointment booked successfully'
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'error': result_message or 'Failed to book appointment'
                }), 400
                
        finally:
            cursor.close()
            connection.close()
        
    except Exception as e:
        logger.error(f"Book appointment error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/route-locations/<int:route_location_id>/generate-slots', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor'])
def generate_appointment_slots(route_location_id: int):
    """Generate appointment slots for a route location"""
    try:
        connection = DatabaseManager.get_connection()
        if not connection:
            return jsonify({'success': False, 'error': 'Database connection failed'}), 500
        
        try:
            cursor = connection.cursor()
            cursor.callproc('sp_generate_appointment_slots', [route_location_id])
            
            # Get the result
            for result in cursor.stored_results():
                row = result.fetchone()
                if row:
                    result_message = row[0]
                    break
            
            connection.commit()
            
            if result_message.startswith('SUCCESS'):
                return jsonify({
                    'success': True,
                    'message': result_message
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'error': result_message
                }), 400
                
        finally:
            cursor.close()
            connection.close()
        
    except Exception as e:
        logger.error(f"Generate appointment slots error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

# ============================================================================
# ENHANCED INVENTORY MANAGEMENT
# ============================================================================

@app.route('/api/inventory/assets', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'clerk'])
def get_assets():
    """Get assets with category information and maintenance status"""
    try:
        status = request.args.get('status', '')
        category = request.args.get('category', '')
        location = request.args.get('location', '')
        maintenance_due = request.args.get('maintenance_due', '')
        
        query = """
        SELECT a.*, 
               ac.category_name,
               ac.requires_calibration,
               ac.calibration_frequency_months,
               u.first_name as assigned_first_name,
               u.last_name as assigned_last_name,
               CASE 
                   WHEN a.warranty_expiry IS NOT NULL AND a.warranty_expiry < CURDATE() THEN 'Expired'
                   WHEN a.warranty_expiry IS NOT NULL AND a.warranty_expiry <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'Expiring Soon'
                   WHEN a.warranty_expiry IS NOT NULL THEN 'Valid'
                   ELSE 'No Warranty'
               END as warranty_status,
               CASE 
                   WHEN a.next_maintenance_date IS NOT NULL AND a.next_maintenance_date < CURDATE() THEN 'Overdue'
                   WHEN a.next_maintenance_date IS NOT NULL AND a.next_maintenance_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 'Due This Week'
                   WHEN a.next_maintenance_date IS NOT NULL AND a.next_maintenance_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'Due This Month'
                   WHEN a.next_maintenance_date IS NOT NULL THEN 'Scheduled'
                   ELSE 'No Schedule'
               END as maintenance_status,
               DATEDIFF(a.warranty_expiry, CURDATE()) as warranty_days_remaining,
               DATEDIFF(a.next_maintenance_date, CURDATE()) as maintenance_days_remaining
        FROM assets a
        LEFT JOIN asset_categories ac ON a.category_id = ac.id
        LEFT JOIN users u ON a.assigned_to = u.id
        WHERE 1=1
        """
        
        params = []
        
        if status:
            query += " AND a.status = %s"
            params.append(status)
        
        if category:
            query += " AND a.category_id = %s"
            params.append(category)
            
        if location:
            query += " AND a.location LIKE %s"
            params.append(f"%{location}%")
            
        if maintenance_due == 'overdue':
            query += " AND a.next_maintenance_date < CURDATE()"
        elif maintenance_due == 'due_soon':
            query += " AND a.next_maintenance_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)"
        
        query += " ORDER BY a.asset_name"
        
        assets = DatabaseManager.execute_query(query, tuple(params), fetch=True)
        
        return jsonify({
            'success': True,
            'data': {
                'assets': _to_jsonable(assets) or []
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Get assets error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/inventory/assets', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor', 'nurse'])
def create_asset():
    """Create a new medical asset"""
    try:
        data = request.get_json() or {}
        
        required_fields = ['asset_name', 'asset_tag', 'manufacturer', 'category_id']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return jsonify({
                'success': False, 
                'error': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400

        # Check if asset tag already exists
        existing_asset = DatabaseManager.execute_query(
            "SELECT id FROM assets WHERE asset_tag = %s",
            (data['asset_tag'],),
            fetch=True
        )
        
        if existing_asset:
            return jsonify({
                'success': False, 
                'error': 'Asset with this tag already exists'
            }), 409

        # Set next maintenance date based on category if not provided
        next_maintenance = data.get('next_maintenance_date')
        if not next_maintenance and data.get('purchase_date'):
            category_info = DatabaseManager.execute_query(
                "SELECT calibration_frequency_months FROM asset_categories WHERE id = %s",
                (data['category_id'],),
                fetch=True
            )
            if category_info and category_info[0]['calibration_frequency_months']:
                frequency = category_info[0]['calibration_frequency_months']
                purchase_date = datetime.strptime(data['purchase_date'], '%Y-%m-%d')
                next_maintenance = (purchase_date + timedelta(days=frequency * 30)).strftime('%Y-%m-%d')

        insert_query = """
        INSERT INTO assets (
            asset_tag, serial_number, asset_name, category_id, manufacturer, model,
            purchase_date, warranty_expiry, status, location, assigned_to,
            purchase_cost, current_value, maintenance_notes, next_maintenance_date,
            created_at, updated_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        result = DatabaseManager.execute_query(insert_query, (
            data['asset_tag'],
            data.get('serial_number'),
            data['asset_name'],
            data['category_id'],
            data['manufacturer'],
            data.get('model'),
            data.get('purchase_date'),
            data.get('warranty_expiry'),
            data.get('status', 'Operational'),
            data.get('location', 'Mobile Clinic'),
            data.get('assigned_to'),
            data.get('purchase_cost', 0),
            data.get('current_value', data.get('purchase_cost', 0)),
            data.get('maintenance_notes'),
            next_maintenance,
            datetime.now(timezone.utc),
            datetime.now(timezone.utc)
        ))
        
        if result:
            return jsonify({
                'success': True,
                'message': 'Asset created successfully'
            }), 201
        else:
            return jsonify({'success': False, 'error': 'Failed to create asset'}), 500
            
    except Exception as e:
        logger.error(f"Create asset error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/inventory/assets/<int:asset_id>', methods=['PUT'])
@token_required
@role_required(['administrator', 'doctor', 'nurse'])
def update_asset(asset_id):
    """Update an existing asset"""
    try:
        data = request.get_json() or {}
        
        update_fields = []
        params = []
        
        updatable_fields = [
            'asset_name', 'serial_number', 'manufacturer', 'model', 'status', 
            'location', 'assigned_to', 'purchase_cost', 'current_value', 
            'maintenance_notes', 'last_maintenance_date', 'next_maintenance_date', 
            'warranty_expiry'
        ]
        
        for field in updatable_fields:
            if field in data:
                update_fields.append(f"{field} = %s")
                params.append(data[field])
        
        if not update_fields:
            return jsonify({'success': False, 'error': 'No fields to update'}), 400
        
        update_fields.append("updated_at = %s")
        params.append(datetime.now(timezone.utc))
        params.append(asset_id)
        
        update_query = f"UPDATE assets SET {', '.join(update_fields)} WHERE id = %s"
        result = DatabaseManager.execute_query(update_query, tuple(params))
        
        if result:
            return jsonify({
                'success': True,
                'message': 'Asset updated successfully'
            }), 200
        else:
            return jsonify({'success': False, 'error': 'Asset not found or update failed'}), 404
            
    except Exception as e:
        logger.error(f"Update asset error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/inventory/assets/<int:asset_id>/maintenance', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor', 'nurse'])
def record_asset_maintenance(asset_id):
    """Record maintenance performed on an asset"""
    try:
        data = request.get_json() or {}
        
        maintenance_date = data.get('maintenance_date', datetime.now().strftime('%Y-%m-%d'))
        maintenance_notes = data.get('maintenance_notes', '').strip()
        next_maintenance_date = data.get('next_maintenance_date')
        
        if not maintenance_notes:
            return jsonify({'success': False, 'error': 'Maintenance notes are required'}), 400
        
        # Get asset category to calculate next maintenance if not provided
        if not next_maintenance_date:
            asset_info = DatabaseManager.execute_query(
                """
                SELECT ac.calibration_frequency_months 
                FROM assets a 
                JOIN asset_categories ac ON a.category_id = ac.id 
                WHERE a.id = %s
                """,
                (asset_id,),
                fetch=True
            )
            if asset_info and asset_info[0]['calibration_frequency_months']:
                frequency = asset_info[0]['calibration_frequency_months']
                maint_date = datetime.strptime(maintenance_date, '%Y-%m-%d')
                next_maintenance_date = (maint_date + timedelta(days=frequency * 30)).strftime('%Y-%m-%d')
        
        # Update asset maintenance record
        update_query = """
        UPDATE assets 
        SET last_maintenance_date = %s, 
            next_maintenance_date = %s,
            maintenance_notes = %s,
            status = CASE WHEN status = 'Maintenance Required' THEN 'Operational' ELSE status END,
            updated_at = %s
        WHERE id = %s
        """
        
        result = DatabaseManager.execute_query(update_query, (
            maintenance_date,
            next_maintenance_date,
            maintenance_notes,
            datetime.now(timezone.utc),
            asset_id
        ))
        
        if result:
            return jsonify({
                'success': True,
                'message': 'Maintenance recorded successfully'
            }), 200
        else:
            return jsonify({'success': False, 'error': 'Asset not found'}), 404
            
    except Exception as e:
        logger.error(f"Record maintenance error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/inventory/asset-categories', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'clerk'])
def get_asset_categories():
    """List asset categories"""
    try:
        rows = DatabaseManager.execute_query(
            """
            SELECT id, category_name, description, requires_calibration, calibration_frequency_months,
                   COUNT(a.id) as asset_count
            FROM asset_categories ac
            LEFT JOIN assets a ON ac.id = a.category_id
            GROUP BY ac.id
            ORDER BY ac.category_name
            """,
            fetch=True,
        )
        return jsonify({
            'success': True, 
            'data': {
                'categories': rows or []
            }
        }), 200
    except Exception as e:
        logger.error(f"Get asset categories error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

# Dedicated categories endpoint for Asset Management form
@app.route('/api/inventory/assets/categories', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'clerk'])
def get_asset_categories_for_assets():
    """List asset categories (form-specific endpoint)"""
    try:
        rows = DatabaseManager.execute_query(
            """
            SELECT id, category_name, description, requires_calibration, calibration_frequency_months
            FROM asset_categories
            ORDER BY category_name
            """,
            fetch=True,
        )
        return jsonify({
            'success': True,
            'data': {
                'categories': rows or []
            }
        }), 200
    except Exception as e:
        logger.error(f"Get asset categories (assets) error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

# ============================================================================
# CONSUMABLES MANAGEMENT ENDPOINTS
# ============================================================================

@app.route('/api/inventory/consumables', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'clerk'])
def get_consumables():
    """Get consumables with aggregated stock information"""
    try:
        category = request.args.get('category', '')
        expiry_filter = request.args.get('expiry_filter', '')
        stock_filter = request.args.get('stock_filter', '')
        
        query = """
        SELECT 
            c.id,
            c.item_code,
            c.item_name,
            c.category_id,
            cc.category_name,
            c.generic_name,
            c.strength,
            c.dosage_form,
            c.unit_of_measure,
            c.reorder_level,
            c.max_stock_level,
            c.storage_temperature_min,
            c.storage_temperature_max,
            c.is_controlled_substance,
            c.created_at,
            COALESCE(SUM(CASE WHEN ist.status = 'Active' THEN ist.quantity_current ELSE 0 END), 0) as total_quantity,
            COUNT(CASE WHEN ist.status = 'Active' THEN ist.id END) as active_batches,
            MIN(CASE WHEN ist.status = 'Active' THEN ist.expiry_date END) as earliest_expiry,
            MAX(CASE WHEN ist.status = 'Active' THEN ist.received_date END) as latest_received,
            AVG(CASE WHEN ist.status = 'Active' THEN ist.unit_cost END) as avg_unit_cost,
            CASE 
                WHEN MIN(CASE WHEN ist.status = 'Active' THEN ist.expiry_date END) IS NOT NULL 
                     AND MIN(CASE WHEN ist.status = 'Active' THEN ist.expiry_date END) <= CURDATE() THEN 'expired'
                WHEN MIN(CASE WHEN ist.status = 'Active' THEN ist.expiry_date END) IS NOT NULL 
                     AND MIN(CASE WHEN ist.status = 'Active' THEN ist.expiry_date END) <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'expiring_soon'
                WHEN MIN(CASE WHEN ist.status = 'Active' THEN ist.expiry_date END) IS NOT NULL 
                     AND MIN(CASE WHEN ist.status = 'Active' THEN ist.expiry_date END) <= DATE_ADD(CURDATE(), INTERVAL 90 DAY) THEN 'warning'
                ELSE 'good'
            END as expiry_status,
            CASE 
                WHEN COALESCE(SUM(CASE WHEN ist.status = 'Active' THEN ist.quantity_current ELSE 0 END), 0) = 0 THEN 'out_of_stock'
                WHEN COALESCE(SUM(CASE WHEN ist.status = 'Active' THEN ist.quantity_current ELSE 0 END), 0) <= c.reorder_level THEN 'low_stock'
                WHEN COALESCE(SUM(CASE WHEN ist.status = 'Active' THEN ist.quantity_current ELSE 0 END), 0) >= c.max_stock_level THEN 'overstock'
                ELSE 'normal'
            END as stock_status
        FROM consumables c
        LEFT JOIN consumable_categories cc ON c.category_id = cc.id
        LEFT JOIN inventory_stock ist ON c.id = ist.consumable_id
        WHERE 1=1
        """
        
        params = []
        
        if category:
            query += " AND c.category_id = %s"
            params.append(category)
        
        query += " GROUP BY c.id"
        
        # Apply filters based on computed values
        having_conditions = []
        if expiry_filter == 'expired':
            having_conditions.append("MIN(CASE WHEN ist.status = 'Active' THEN ist.expiry_date END) <= CURDATE()")
        elif expiry_filter == 'expiring_soon':
            having_conditions.append("MIN(CASE WHEN ist.status = 'Active' THEN ist.expiry_date END) <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)")
        elif expiry_filter == 'warning':
            having_conditions.append("MIN(CASE WHEN ist.status = 'Active' THEN ist.expiry_date END) <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)")
            
        if stock_filter == 'low_stock':
            having_conditions.append("COALESCE(SUM(CASE WHEN ist.status = 'Active' THEN ist.quantity_current ELSE 0 END), 0) <= c.reorder_level")
        elif stock_filter == 'out_of_stock':
            having_conditions.append("COALESCE(SUM(CASE WHEN ist.status = 'Active' THEN ist.quantity_current ELSE 0 END), 0) = 0")
        
        if having_conditions:
            query += " HAVING " + " AND ".join(having_conditions)
        
        query += " ORDER BY c.item_name"
        
        consumables = DatabaseManager.execute_query(query, tuple(params), fetch=True)
        
        return jsonify({
            'success': True,
            'data': {
                'consumables': _to_jsonable(consumables) or []
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Get consumables error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/inventory/consumables/<int:consumable_id>/batches', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'clerk'])
def get_consumable_batches(consumable_id):
    """Get all batches for a specific consumable"""
    try:
        query = """
        SELECT ist.*, s.supplier_name,
               CASE 
                   WHEN ist.expiry_date <= CURDATE() THEN 'expired'
                   WHEN ist.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'expiring_soon'
                   WHEN ist.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY) THEN 'warning'
                   ELSE 'good'
               END as expiry_status,
               DATEDIFF(ist.expiry_date, CURDATE()) as days_to_expiry,
               (ist.quantity_current * ist.unit_cost) as total_value
        FROM inventory_stock ist
        LEFT JOIN suppliers s ON ist.supplier_id = s.id
        WHERE ist.consumable_id = %s
        ORDER BY ist.expiry_date ASC, ist.received_date ASC
        """
        
        batches = DatabaseManager.execute_query(query, (consumable_id,), fetch=True)
        
        return jsonify({
            'success': True,
            'data': {
                'batches': _to_jsonable(batches) or []
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Get consumable batches error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/inventory/consumables', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor', 'nurse'])
def create_consumable():
    """Create a new consumable item"""
    try:
        data = request.get_json() or {}
        
        required_fields = ['item_name', 'item_code', 'unit_of_measure', 'category_id']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return jsonify({
                'success': False, 
                'error': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400

        # Check if item code already exists
        existing_item = DatabaseManager.execute_query(
            "SELECT id FROM consumables WHERE item_code = %s",
            (data['item_code'],),
            fetch=True
        )
        
        if existing_item:
            return jsonify({
                'success': False, 
                'error': 'Item with this code already exists'
            }), 409

        insert_query = """
        INSERT INTO consumables (
            item_code, item_name, category_id, generic_name, strength, dosage_form,
            unit_of_measure, reorder_level, max_stock_level, storage_temperature_min,
            storage_temperature_max, is_controlled_substance, created_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        result = DatabaseManager.execute_query(insert_query, (
            data['item_code'],
            data['item_name'],
            data['category_id'],
            data.get('generic_name'),
            data.get('strength'),
            data.get('dosage_form'),
            data['unit_of_measure'],
            data.get('reorder_level', 10),
            data.get('max_stock_level', 1000),
            data.get('storage_temperature_min'),
            data.get('storage_temperature_max'),
            data.get('is_controlled_substance', False),
            datetime.now(timezone.utc)
        ))
        
        if result:
            return jsonify({
                'success': True,
                'message': 'Consumable created successfully'
            }), 201
        else:
            return jsonify({'success': False, 'error': 'Failed to create consumable'}), 500
            
    except Exception as e:
        logger.error(f"Create consumable error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/inventory/consumables/<int:consumable_id>', methods=['PUT'])
@token_required
@role_required(['administrator', 'doctor', 'nurse'])
def update_consumable(consumable_id):
    """Update an existing consumable"""
    try:
        data = request.get_json() or {}
        
        update_fields = []
        params = []
        
        updatable_fields = [
            'item_name', 'generic_name', 'strength', 'dosage_form',
            'unit_of_measure', 'reorder_level', 'max_stock_level',
            'storage_temperature_min', 'storage_temperature_max', 'is_controlled_substance'
        ]
        
        for field in updatable_fields:
            if field in data:
                update_fields.append(f"{field} = %s")
                params.append(data[field])
        
        if not update_fields:
            return jsonify({'success': False, 'error': 'No fields to update'}), 400
        
        params.append(consumable_id)
        update_query = f"UPDATE consumables SET {', '.join(update_fields)} WHERE id = %s"
        result = DatabaseManager.execute_query(update_query, tuple(params))
        
        if result:
            return jsonify({
                'success': True,
                'message': 'Consumable updated successfully'
            }), 200
        else:
            return jsonify({'success': False, 'error': 'Consumable not found or update failed'}), 404
            
    except Exception as e:
        logger.error(f"Update consumable error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/inventory/consumable-categories', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'clerk'])
def get_consumable_categories():
    """List consumable categories with item counts"""
    try:
        rows = DatabaseManager.execute_query(
            """
            SELECT cc.*, COUNT(c.id) as item_count
            FROM consumable_categories cc
            LEFT JOIN consumables c ON cc.id = c.category_id
            GROUP BY cc.id
            ORDER BY cc.category_name
            """,
            fetch=True,
        )
        return jsonify({
            'success': True, 
            'data': {
                'categories': rows or []
            }
        }), 200
    except Exception as e:
        logger.error(f"Get consumable categories error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

# ============================================================================
# INVENTORY STOCK MANAGEMENT
# ============================================================================

@app.route('/api/inventory/stock/receive', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor', 'nurse'])
def receive_inventory_stock():
    """Receive new inventory stock"""
    try:
        data = request.get_json() or {}
        
        required_fields = ['consumable_id', 'batch_number', 'supplier_id', 'quantity_received', 'expiry_date', 'unit_cost']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return jsonify({
                'success': False, 
                'error': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400

        # Validate expiry date format
        try:
            expiry_date = datetime.strptime(data['expiry_date'], '%Y-%m-%d').date()
            if expiry_date <= datetime.now().date():
                return jsonify({
                    'success': False, 
                    'error': 'Expiry date must be in the future'
                }), 400
        except ValueError:
            return jsonify({
                'success': False, 
                'error': 'Invalid expiry date format. Use YYYY-MM-DD'
            }), 400

        # Check if batch already exists for this consumable
        existing_batch = DatabaseManager.execute_query(
            "SELECT id FROM inventory_stock WHERE consumable_id = %s AND batch_number = %s",
            (data['consumable_id'], data['batch_number']),
            fetch=True
        )
        
        if existing_batch:
            return jsonify({
                'success': False, 
                'error': 'Batch number already exists for this consumable'
            }), 409

        insert_query = """
        INSERT INTO inventory_stock (
            consumable_id, batch_number, supplier_id, quantity_received, quantity_current,
            unit_cost, manufacture_date, expiry_date, received_date, received_by, 
            location, status, created_at, updated_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'Active', %s, %s)
        """
        
        result = DatabaseManager.execute_query(insert_query, (
            data['consumable_id'],
            data['batch_number'],
            data['supplier_id'],
            data['quantity_received'],
            data['quantity_received'],  # quantity_current starts same as received
            data['unit_cost'],
            data.get('manufacture_date'),
            data['expiry_date'],
            data.get('received_date', datetime.now().strftime('%Y-%m-%d')),
            request.current_user['id'],
            data.get('location', 'Mobile Clinic'),
            datetime.now(timezone.utc),
            datetime.now(timezone.utc)
        ))
        
        if result:
            return jsonify({
                'success': True,
                'message': 'Stock received successfully'
            }), 201
        else:
            return jsonify({'success': False, 'error': 'Failed to receive stock'}), 500
            
    except Exception as e:
        logger.error(f"Receive inventory stock error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/inventory/stock/<int:stock_id>/adjust', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor', 'nurse'])
def adjust_inventory_stock(stock_id):
    """Adjust inventory stock quantities"""
    try:
        data = request.get_json() or {}
        
        adjustment_type = data.get('adjustment_type')  # 'increase', 'decrease', 'set'
        quantity = data.get('quantity')
        reason = data.get('reason', '').strip()
        
        if not adjustment_type or quantity is None:
            return jsonify({
                'success': False, 
                'error': 'adjustment_type and quantity are required'
            }), 400
            
        if adjustment_type not in ['increase', 'decrease', 'set']:
            return jsonify({
                'success': False, 
                'error': 'adjustment_type must be increase, decrease, or set'
            }), 400

        if not reason:
            return jsonify({
                'success': False, 
                'error': 'Reason for adjustment is required'
            }), 400

        # Get current stock
        current_stock = DatabaseManager.execute_query(
            "SELECT quantity_current, consumable_id FROM inventory_stock WHERE id = %s",
            (stock_id,),
            fetch=True
        )
        
        if not current_stock:
            return jsonify({'success': False, 'error': 'Stock record not found'}), 404
            
        current_quantity = current_stock[0]['quantity_current']
        consumable_id = current_stock[0]['consumable_id']
        
        # Calculate new quantity
        if adjustment_type == 'increase':
            new_quantity = current_quantity + quantity
        elif adjustment_type == 'decrease':
            new_quantity = max(0, current_quantity - quantity)
        else:  # set
            new_quantity = quantity
            
        if new_quantity < 0:
            return jsonify({
                'success': False, 
                'error': 'Resulting quantity cannot be negative'
            }), 400

        # Update stock
        update_result = DatabaseManager.execute_query(
            "UPDATE inventory_stock SET quantity_current = %s, updated_at = %s WHERE id = %s",
            (new_quantity, datetime.now(timezone.utc), stock_id)
        )
        
        if update_result:
            # Log the adjustment
            try:
                log_query = """
                INSERT INTO audit_log (user_id, table_name, record_id, action, old_values, new_values, created_at)
                VALUES (%s, 'inventory_stock', %s, 'UPDATE', %s, %s, %s)
                """
                old_values = json.dumps({'quantity_current': current_quantity, 'reason': 'stock_adjustment'})
                new_values = json.dumps({'quantity_current': new_quantity, 'adjustment_type': adjustment_type, 'reason': reason})
                
                DatabaseManager.execute_query(log_query, (
                    request.current_user['id'],
                    stock_id,
                    old_values,
                    new_values,
                    datetime.now(timezone.utc)
                ))
            except Exception as log_error:
                logger.warning(f"Failed to log stock adjustment: {log_error}")
            
            return jsonify({
                'success': True,
                'message': f'Stock adjusted from {current_quantity} to {new_quantity}'
            }), 200
        else:
            return jsonify({'success': False, 'error': 'Failed to adjust stock'}), 500
            
    except Exception as e:
        logger.error(f"Adjust inventory stock error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/inventory/usage', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor', 'nurse'])
def record_inventory_usage():
    """Record inventory usage with FIFO stock management"""
    try:
        data = request.get_json() or {}
        
        consumable_id = data.get('consumable_id')
        quantity_used = data.get('quantity_used')
        visit_id = data.get('visit_id')
        location = data.get('location', 'Mobile Clinic')
        notes = data.get('notes', '')
        
        if not consumable_id or not quantity_used or quantity_used <= 0:
            return jsonify({
                'success': False, 
                'error': 'consumable_id and valid quantity_used are required'
            }), 400

        # Get available stock using FIFO (First In, First Out) - earliest expiry first
        available_stock = DatabaseManager.execute_query(
            """
            SELECT id, quantity_current, batch_number, expiry_date
            FROM inventory_stock
            WHERE consumable_id = %s AND status = 'Active' AND quantity_current > 0
            ORDER BY expiry_date ASC, received_date ASC
            """,
            (consumable_id,),
            fetch=True
        )
        
        if not available_stock:
            return jsonify({
                'success': False, 
                'error': 'No stock available for this consumable'
            }), 400
        
        # Check total available quantity
        total_available = sum(stock['quantity_current'] for stock in available_stock)
        if total_available < quantity_used:
            return jsonify({
                'success': False, 
                'error': f'Insufficient stock. Available: {total_available}, Requested: {quantity_used}'
            }), 400
        
        # Process usage across batches using FIFO
        remaining_to_use = quantity_used
        usage_records = []
        
        for stock in available_stock:
            if remaining_to_use <= 0:
                break
                
            stock_id = stock['id']
            available_in_batch = stock['quantity_current']
            
            # Use as much as possible from this batch
            quantity_from_batch = min(remaining_to_use, available_in_batch)
            
            # Update stock quantity
            new_quantity = available_in_batch - quantity_from_batch
            DatabaseManager.execute_query(
                "UPDATE inventory_stock SET quantity_current = %s, updated_at = %s WHERE id = %s",
                (new_quantity, datetime.now(timezone.utc), stock_id)
            )
            
            # Record usage
            DatabaseManager.execute_query(
                """
                INSERT INTO inventory_usage 
                (stock_id, visit_id, quantity_used, used_by, usage_date, usage_time, location, notes, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    stock_id,
                    visit_id,
                    quantity_from_batch,
                    request.current_user['id'],
                    datetime.now().strftime('%Y-%m-%d'),
                    datetime.now().strftime('%H:%M:%S'),
                    location,
                    notes,
                    datetime.now(timezone.utc)
                )
            )
            
            usage_records.append({
                'batch_number': stock['batch_number'],
                'quantity_used': quantity_from_batch,
                'remaining_in_batch': new_quantity
            })
            
            remaining_to_use -= quantity_from_batch
        
        return jsonify({
            'success': True,
            'message': 'Inventory usage recorded successfully',
            'data': {
                'total_used': quantity_used,
                'batches_used': usage_records
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Record inventory usage error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/inventory/usage/history', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'clerk'])
def get_usage_history():
    """Get inventory usage history with filtering"""
    try:
        consumable_id = request.args.get('consumable_id')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        user_id = request.args.get('user_id')
        visit_id = request.args.get('visit_id')
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 50))
        
        offset = (page - 1) * limit
        
        query = """
        SELECT iu.*, 
               c.item_name, c.item_code, c.unit_of_measure,
               ist.batch_number, ist.expiry_date,
               u.first_name, u.last_name,
               p.first_name as patient_first_name, p.last_name as patient_last_name
        FROM inventory_usage iu
        JOIN inventory_stock ist ON iu.stock_id = ist.id
        JOIN consumables c ON ist.consumable_id = c.id
        JOIN users u ON iu.used_by = u.id
        LEFT JOIN patient_visits pv ON iu.visit_id = pv.id
        LEFT JOIN patients p ON pv.patient_id = p.id
        WHERE 1=1
        """
        
        params = []
        
        if consumable_id:
            query += " AND ist.consumable_id = %s"
            params.append(consumable_id)
            
        if date_from:
            query += " AND iu.usage_date >= %s"
            params.append(date_from)
            
        if date_to:
            query += " AND iu.usage_date <= %s"
            params.append(date_to)
            
        if user_id:
            query += " AND iu.used_by = %s"
            params.append(user_id)
            
        if visit_id:
            query += " AND iu.visit_id = %s"
            params.append(visit_id)
        
        # Get total count
        count_query = f"SELECT COUNT(*) as total FROM ({query}) as usage_count"
        total_result = DatabaseManager.execute_query(count_query, tuple(params), fetch=True)
        total = total_result[0]['total'] if total_result else 0
        
        # Add pagination
        query += " ORDER BY iu.usage_date DESC, iu.usage_time DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        
        usage_history = DatabaseManager.execute_query(query, tuple(params), fetch=True)
        
        return jsonify({
            'success': True,
            'data': {
                'usage_history': _to_jsonable(usage_history) or [],
                'pagination': {
                    'page': page,
                    'limit': limit,
                    'total': total,
                    'pages': (total + limit - 1) // limit
                }
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Get usage history error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

# ============================================================================
# SUPPLIER MANAGEMENT ENDPOINTS
# ============================================================================

@app.route('/api/inventory/suppliers', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'clerk'])
def get_suppliers():
    """Get suppliers list with stock information"""
    try:
        is_active = request.args.get('is_active')
        
        query = """
        SELECT s.*,
               COUNT(DISTINCT ist.consumable_id) as items_supplied,
               COUNT(ist.id) as total_batches,
               SUM(CASE WHEN ist.status = 'Active' THEN ist.quantity_current * ist.unit_cost ELSE 0 END) as active_stock_value
        FROM suppliers s
        LEFT JOIN inventory_stock ist ON s.id = ist.supplier_id
        WHERE 1=1
        """
        
        params = []
        
        if is_active is not None:
            query += " AND s.is_active = %s"
            params.append(is_active.lower() == 'true')
        
        query += " GROUP BY s.id ORDER BY s.supplier_name"
        
        suppliers = DatabaseManager.execute_query(query, tuple(params), fetch=True)
        
        return jsonify({
            'success': True,
            'data': {
                'suppliers': _to_jsonable(suppliers) or []
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Get suppliers error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/inventory/suppliers', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor', 'nurse'])
def create_supplier():
    """Create a new supplier"""
    try:
        data = request.get_json() or {}
        
        required_fields = ['supplier_name']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return jsonify({
                'success': False, 
                'error': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400

        # Check if supplier already exists
        existing_supplier = DatabaseManager.execute_query(
            "SELECT id FROM suppliers WHERE supplier_name = %s",
            (data['supplier_name'],),
            fetch=True
        )
        
        if existing_supplier:
            return jsonify({
                'success': False, 
                'error': 'Supplier with this name already exists'
            }), 409

        insert_query = """
        INSERT INTO suppliers (
            supplier_name, contact_person, phone, email, address, tax_number, is_active, created_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        result = DatabaseManager.execute_query(insert_query, (
            data['supplier_name'],
            data.get('contact_person'),
            data.get('phone'),
            data.get('email'),
            data.get('address'),
            data.get('tax_number'),
            data.get('is_active', True),
            datetime.now(timezone.utc)
        ))
        
        if result:
            return jsonify({
                'success': True,
                'message': 'Supplier created successfully'
            }), 201
        else:
            return jsonify({'success': False, 'error': 'Failed to create supplier'}), 500
            
    except Exception as e:
        logger.error(f"Create supplier error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/inventory/suppliers/<int:supplier_id>', methods=['PUT'])
@token_required
@role_required(['administrator', 'doctor', 'nurse'])
def update_supplier(supplier_id):
    """Update an existing supplier"""
    try:
        data = request.get_json() or {}
        
        update_fields = []
        params = []
        
        updatable_fields = ['supplier_name', 'contact_person', 'phone', 'email', 'address', 'tax_number', 'is_active']
        
        for field in updatable_fields:
            if field in data:
                update_fields.append(f"{field} = %s")
                params.append(data[field])
        
        if not update_fields:
            return jsonify({'success': False, 'error': 'No fields to update'}), 400
        
        params.append(supplier_id)
        update_query = f"UPDATE suppliers SET {', '.join(update_fields)} WHERE id = %s"
        result = DatabaseManager.execute_query(update_query, tuple(params))
        
        if result:
            return jsonify({
                'success': True,
                'message': 'Supplier updated successfully'
            }), 200
        else:
            return jsonify({'success': False, 'error': 'Supplier not found or update failed'}), 404
            
    except Exception as e:
        logger.error(f"Update supplier error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

# ============================================================================
# INVENTORY ALERTS AND REPORTING
# ============================================================================

@app.route('/api/inventory/alerts/expiry', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor', 'nurse'])
def get_expiry_alerts():
    """Get inventory expiry alerts"""
    try:
        days_ahead = int(request.args.get('days_ahead', 90))
        alert_level = request.args.get('alert_level', '')  # 'expired', 'critical', 'warning'
        
        query = """
        SELECT ist.id as stock_id,
               c.item_name, c.item_code, c.unit_of_measure,
               cc.category_name,
               ist.batch_number,
               ist.expiry_date,
               ist.quantity_current,
               ist.unit_cost,
               (ist.quantity_current * ist.unit_cost) as total_value,
               s.supplier_name,
               DATEDIFF(ist.expiry_date, CURDATE()) as days_to_expiry,
               CASE 
                   WHEN ist.expiry_date <= CURDATE() THEN 'expired'
                   WHEN ist.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 'critical'
                   WHEN ist.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'warning'
                   ELSE 'notice'
               END as alert_level
        FROM inventory_stock ist
        JOIN consumables c ON ist.consumable_id = c.id
        LEFT JOIN consumable_categories cc ON c.category_id = cc.id
        LEFT JOIN suppliers s ON ist.supplier_id = s.id
        WHERE ist.status = 'Active' 
        AND ist.quantity_current > 0
        AND ist.expiry_date <= DATE_ADD(CURDATE(), INTERVAL %s DAY)
        """
        
        params = [days_ahead]
        
        if alert_level:
            if alert_level == 'expired':
                query += " AND ist.expiry_date <= CURDATE()"
            elif alert_level == 'critical':
                query += " AND ist.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND ist.expiry_date > CURDATE()"
            elif alert_level == 'warning':
                query += " AND ist.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) AND ist.expiry_date > DATE_ADD(CURDATE(), INTERVAL 7 DAY)"
        
        query += " ORDER BY ist.expiry_date ASC, c.item_name ASC"
        
        alerts = DatabaseManager.execute_query(query, tuple(params), fetch=True)
        
        # Summary statistics
        summary = {
            'total_alerts': len(alerts) if alerts else 0,
            'expired': 0,
            'critical': 0,
            'warning': 0,
            'total_value_at_risk': 0
        }
        
        if alerts:
            for alert in alerts:
                level = alert['alert_level']
                if level in summary:
                    summary[level] += 1
                summary['total_value_at_risk'] += float(alert['total_value'] or 0)
        
        return jsonify({
            'success': True,
            'data': {
                'alerts': _to_jsonable(alerts) or [],
                'summary': summary
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Get expiry alerts error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/inventory/alerts/stock', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor', 'nurse'])
def get_stock_alerts():
    """Get low stock alerts"""
    try:
        query = """
        SELECT c.id as consumable_id,
               c.item_name, c.item_code, c.unit_of_measure,
               cc.category_name,
               c.reorder_level,
               c.max_stock_level,
               COALESCE(SUM(CASE WHEN ist.status = 'Active' THEN ist.quantity_current ELSE 0 END), 0) as current_stock,
               COUNT(CASE WHEN ist.status = 'Active' THEN ist.id END) as active_batches,
               AVG(CASE WHEN ist.status = 'Active' THEN ist.unit_cost END) as avg_unit_cost,
               CASE 
                   WHEN COALESCE(SUM(CASE WHEN ist.status = 'Active' THEN ist.quantity_current ELSE 0 END), 0) = 0 THEN 'out_of_stock'
                   WHEN COALESCE(SUM(CASE WHEN ist.status = 'Active' THEN ist.quantity_current ELSE 0 END), 0) <= c.reorder_level THEN 'low_stock'
                   ELSE 'normal'
               END as stock_level
        FROM consumables c
        LEFT JOIN consumable_categories cc ON c.category_id = cc.id
        LEFT JOIN inventory_stock ist ON c.id = ist.consumable_id
        GROUP BY c.id
        HAVING stock_level IN ('out_of_stock', 'low_stock')
        ORDER BY stock_level, c.item_name
        """
        
        alerts = DatabaseManager.execute_query(query, fetch=True)
        
        # Summary statistics
        summary = {
            'out_of_stock': 0,
            'low_stock': 0,
            'total_items_affected': len(alerts) if alerts else 0
        }
        
        if alerts:
            for alert in alerts:
                level = alert['stock_level']
                if level in summary:
                    summary[level] += 1
        
        return jsonify({
            'success': True,
            'data': {
                'alerts': _to_jsonable(alerts) or [],
                'summary': summary
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Get stock alerts error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/inventory/reports/valuation', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor'])
def get_inventory_valuation():
    """Get inventory valuation report"""
    try:
        category_id = request.args.get('category_id')
        include_expired = request.args.get('include_expired', 'false').lower() == 'true'
        
        query = """
        SELECT cc.category_name,
               c.item_name, c.item_code,
               COUNT(CASE WHEN ist.status = 'Active' THEN ist.id END) as active_batches,
               COALESCE(SUM(CASE WHEN ist.status = 'Active' THEN ist.quantity_current ELSE 0 END), 0) as total_quantity,
               COALESCE(AVG(CASE WHEN ist.status = 'Active' THEN ist.unit_cost END), 0) as avg_unit_cost,
               COALESCE(SUM(CASE WHEN ist.status = 'Active' THEN ist.quantity_current * ist.unit_cost ELSE 0 END), 0) as total_value,
               MIN(CASE WHEN ist.status = 'Active' THEN ist.expiry_date END) as earliest_expiry
        FROM consumables c
        LEFT JOIN consumable_categories cc ON c.category_id = cc.id
        LEFT JOIN inventory_stock ist ON c.id = ist.consumable_id
        WHERE 1=1
        """
        
        params = []
        
        if category_id:
            query += " AND c.category_id = %s"
            params.append(category_id)
            
        if not include_expired:
            query += " AND (ist.status != 'Expired' OR ist.status IS NULL)"
        
        query += """
        GROUP BY c.id, cc.category_name
        ORDER BY cc.category_name, c.item_name
        """
        
        valuation_data = DatabaseManager.execute_query(query, tuple(params), fetch=True)
        
        # Calculate totals
        total_value = sum(float(item['total_value'] or 0) for item in valuation_data) if valuation_data else 0
        total_items = len(valuation_data) if valuation_data else 0
        
        # Group by category for summary
        category_summary = {}
        if valuation_data:
            for item in valuation_data:
                category = item['category_name'] or 'Uncategorized'
                if category not in category_summary:
                    category_summary[category] = {
                        'item_count': 0,
                        'total_value': 0,
                        'total_quantity': 0
                    }
                category_summary[category]['item_count'] += 1
                category_summary[category]['total_value'] += float(item['total_value'] or 0)
                category_summary[category]['total_quantity'] += int(item['total_quantity'] or 0)
        
        return jsonify({
            'success': True,
            'data': {
                'items': _to_jsonable(valuation_data) or [],
                'summary': {
                    'total_value': total_value,
                    'total_items': total_items,
                    'category_breakdown': category_summary
                },
                'generated_at': datetime.now(timezone.utc).isoformat()
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Get inventory valuation error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/inventory/reports/turnover', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor'])
def get_inventory_turnover():
    """Get inventory turnover analysis"""
    try:
        period_months = int(request.args.get('period_months', 12))
        category_id = request.args.get('category_id')
        
        query = """
        SELECT c.id as consumable_id,
               c.item_name, c.item_code,
               cc.category_name,
               COALESCE(SUM(iu.quantity_used), 0) as total_used,
               COALESCE(AVG(ist.quantity_current), 0) as avg_stock_level,
               COUNT(DISTINCT iu.usage_date) as usage_days,
               COALESCE(SUM(iu.quantity_used * ist.unit_cost), 0) as total_usage_value,
               CASE 
                   WHEN AVG(ist.quantity_current) > 0 AND SUM(iu.quantity_used) > 0 
                   THEN (SUM(iu.quantity_used) / AVG(ist.quantity_current)) / (%s / 12.0)
                   ELSE 0 
               END as annualized_turnover_ratio
        FROM consumables c
        LEFT JOIN consumable_categories cc ON c.category_id = cc.id
        LEFT JOIN inventory_stock ist ON c.id = ist.consumable_id AND ist.status = 'Active'
        LEFT JOIN inventory_usage iu ON ist.id = iu.stock_id 
                                     AND iu.usage_date >= DATE_SUB(CURDATE(), INTERVAL %s MONTH)
        WHERE 1=1
        """
        
        params = [period_months, period_months]
        
        if category_id:
            query += " AND c.category_id = %s"
            params.append(category_id)
        
        query += """
        GROUP BY c.id, cc.category_name
        HAVING total_used > 0
        ORDER BY annualized_turnover_ratio DESC
        """
        
        turnover_data = DatabaseManager.execute_query(query, tuple(params), fetch=True)
        
        return jsonify({
            'success': True,
            'data': {
                'turnover_analysis': _to_jsonable(turnover_data) or [],
                'period_months': period_months,
                'generated_at': datetime.now(timezone.utc).isoformat()
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Get inventory turnover error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

# ============================================================================
# OFFLINE SYNC CAPABILITIES
# ============================================================================

@app.route('/api/sync/status', methods=['GET'])
@token_required
def get_sync_status():
    """Get synchronization status for offline operations"""
    try:
        device_id = request.args.get('device_id')
        
        query = """
        SELECT 
            table_name,
            COUNT(*) as total_records,
            COUNT(CASE WHEN sync_status = 'Pending' THEN 1 END) as pending_sync,
            COUNT(CASE WHEN sync_status = 'Failed' THEN 1 END) as failed_sync,
            COUNT(CASE WHEN sync_status = 'Conflict' THEN 1 END) as conflicts,
            MAX(server_timestamp) as last_sync
        FROM sync_status
        WHERE user_id = %s
        """
        
        params = [request.current_user['id']]
        
        if device_id:
            query += " AND device_id = %s"
            params.append(device_id)
        
        query += " GROUP BY table_name ORDER BY table_name"
        
        sync_status = DatabaseManager.execute_query(query, tuple(params), fetch=True)
        
        return jsonify({
            'success': True,
            'sync_status': sync_status or []
        }), 200
        
    except Exception as e:
        logger.error(f"Get sync status error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/sync/pending', methods=['POST'])
@token_required
def sync_pending_records():
    """Sync pending offline records to server"""
    try:
        data = request.get_json() or {}
        device_id = data.get('device_id')
        records = data.get('records', [])
        
        if not device_id or not records:
            return jsonify({'success': False, 'error': 'device_id and records are required'}), 400
        
        synced_count = 0
        failed_count = 0
        
        for record in records:
            try:
                DatabaseManager.execute_query(
                    """
                    INSERT INTO sync_status (
                        table_name, record_id, operation_type, sync_status,
                        device_id, user_id, local_timestamp
                    ) VALUES (%s, %s, %s, 'Pending', %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                        sync_status = 'Pending',
                        retry_count = retry_count + 1,
                        last_retry_at = NOW()
                    """,
                    (
                        record.get('table_name'),
                        record.get('record_id'),
                        record.get('operation_type'),
                        device_id,
                        request.current_user['id'],
                        record.get('timestamp')
                    )
                )
                synced_count += 1
            except Exception as sync_error:
                logger.error(f"Sync record error: {sync_error}")
                failed_count += 1
        
        return jsonify({
            'success': True,
            'synced_count': synced_count,
            'failed_count': failed_count,
            'message': f'Synced {synced_count} records, {failed_count} failed'
        }), 200
        
    except Exception as e:
        logger.error(f"Sync pending records error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

# ============================================================================
# POLMED INTEGRATION ENDPOINTS
# ============================================================================

@app.route('/api/palmed/member-lookup', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'clerk'])
def palmed_member_lookup():
    """Look up POLMED member information"""
    try:
        medical_aid_number = request.args.get('medical_aid_number', '').strip()
        
        if not medical_aid_number:
            return jsonify({'success': False, 'error': 'medical_aid_number is required'}), 400
        
        existing_patient = DatabaseManager.execute_query(
            "SELECT * FROM patients WHERE medical_aid_number = %s",
            (medical_aid_number,),
            fetch=True
        )
        
        if existing_patient:
            return jsonify({
                'success': True,
                'member_found': True,
                'member_data': existing_patient[0],
                'source': 'local_database'
            }), 200

        # TODO: Implement actual POLMED API integration
        # For now, return mock data structure
        mock_member_data = {
            'medical_aid_number': medical_aid_number,
            'first_name': 'John',
            'last_name': 'Doe',
            'date_of_birth': '1980-01-01',
            'gender': 'Male',
            'member_type': 'Principal',
            'is_palmed_member': True,
            'phone_number': '0123456789',
            'email': 'john.doe@example.com',
            'physical_address': '123 Main Street, Johannesburg'
        }

        return jsonify({
            'success': True,
            'member_found': True,
            'member_data': mock_member_data,
            'source': 'palmed_api',
            'note': 'Mock data - POLMED API integration pending'
        }), 200

    except Exception as e:
        logger.error(f"POLMED member lookup error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/palmed/sync-member', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'clerk'])
def sync_palmed_member():
    """Sync patient data with POLMED systems"""
    try:
        data = request.get_json() or {}
        patient_id = data.get('patient_id')
        
        if not patient_id:
            return jsonify({'success': False, 'error': 'patient_id is required'}), 400
        
        # Get patient data
        patient = DatabaseManager.execute_query(
            "SELECT * FROM patients WHERE id = %s",
            (patient_id,),
            fetch=True
        )
        
        if not patient:
            return jsonify({'success': False, 'error': 'Patient not found'}), 404

        patient_data = patient[0]

        # TODO: Implement actual POLMED API sync
        # For now, just log the sync attempt
        logger.info(f"POLMED sync requested for patient {patient_id}: {patient_data['first_name']} {patient_data['last_name']}")

        return jsonify({
            'success': True,
            'message': 'Patient data sync initiated with POLMED systems',
            'sync_status': 'pending',
            'note': 'POLMED API integration pending'
        }), 200
        
    except Exception as e:
        logger.error(f"PALMED sync error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

if __name__ == '__main__':
    # Disable the reloader to avoid SystemExit in debuggers (parent process exit).
    app.run(debug=True, host='0.0.0.0', port=5000, use_reloader=False)
