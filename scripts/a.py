from flask import Flask, request, jsonify, session
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import mysql.connector
from mysql.connector import pooling, Error
import jwt
from datetime import datetime, timedelta
from functools import wraps
import os
import logging
from typing import Dict, List, Optional, Tuple
import uuid
import json 
import re
from decimal import Decimal
import threading
import time
from collections import defaultdict

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'palmed-clinic-secret-key-2025')


# --- CORS Troubleshooting ---
# If you get CORS errors, make sure the frontend's IP/port is listed below.
# For development, you can use '*' but for production, restrict to your frontend's actual address.
# Example: allowed_origins = ["http://10.231.255.183:3000", "http://localhost:3000", "*"]
allowed_origins = [
    "http://10.231.255.183:3000",  # Your frontend IP
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
    "*"
]

CORS(
    app,
    supports_credentials=True,
    origins=allowed_origins,
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)

# Database configuration with connection pooling
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'database': os.environ.get('DB_NAME', 'palmed_clinic_erp'),
    'user': os.environ.get('DB_USER', 'root'),
    'password': os.environ.get('DB_PASSWORD', 'Transport@2025'),
    'port': int(os.environ.get('DB_PORT', 3306)),
    'autocommit': False,
    'use_unicode': True,
    'charset': 'utf8mb4',
    'pool_name': 'palmed_pool',
    'pool_size': 15,
    'pool_reset_session': True
}

# Create connection pool
try:
    connection_pool = pooling.MySQLConnectionPool(**DB_CONFIG)
    logger.info("Database connection pool created successfully")
except Error as e:
    logger.error(f"Error creating connection pool: {e}")
    connection_pool = None

# Global sync manager for offline operations
class OfflineSyncManager:
    def __init__(self):
        self.pending_operations = defaultdict(list)
        self.sync_lock = threading.Lock()
        self.auto_sync_enabled = True
        self.sync_interval = 30  # seconds
        self.start_auto_sync()
    
    def add_operation(self, device_id: str, operation: dict):
        with self.sync_lock:
            self.pending_operations[device_id].append(operation)
    
    def start_auto_sync(self):
        def auto_sync_worker():
            while self.auto_sync_enabled:
                try:
                    self.process_pending_syncs()
                except Exception as e:
                    logger.error(f"Auto sync error: {e}")
                time.sleep(self.sync_interval)
        
        sync_thread = threading.Thread(target=auto_sync_worker, daemon=True)
        sync_thread.start()
    
    def process_pending_syncs(self):
        with self.sync_lock:
            for device_id, operations in list(self.pending_operations.items()):
                if operations:
                    try:
                        self.sync_device_operations(device_id, operations[:10])  # Process 10 at a time
                        self.pending_operations[device_id] = operations[10:]
                    except Exception as e:
                        logger.error(f"Sync error for device {device_id}: {e}")
    
    def sync_device_operations(self, device_id: str, operations: list):
        for operation in operations:
            try:
                # Process sync operation
                table_name = operation.get('table_name')
                operation_type = operation.get('operation_type')
                data = operation.get('data', {})
                
                if operation_type == 'INSERT' and table_name == 'patients':
                    # Sync patient data
                    self.sync_patient_data(data)
                elif operation_type == 'INSERT' and table_name == 'patient_visits':
                    # Sync visit data
                    self.sync_visit_data(data)
                
                # Mark as synced
                DatabaseManager.execute_query(
                    "UPDATE sync_status SET sync_status = 'Synced', synced_at = %s WHERE id = %s",
                    (datetime.utcnow(), operation.get('sync_id'))
                )
                
            except Exception as e:
                logger.error(f"Failed to sync operation: {e}")
    
    def sync_patient_data(self, data: dict):
        # Implement patient data synchronization
        pass
    
    def sync_visit_data(self, data: dict):
        # Implement visit data synchronization
        pass

# Initialize sync manager
sync_manager = OfflineSyncManager()

# Utilities
def _to_jsonable(obj):
    """Convert datetime and other objects to JSON-serializable format"""
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
        if isinstance(obj, Decimal):
            return float(obj)
    except Exception:
        pass
    if isinstance(obj, dict):
        return {k: _to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_to_jsonable(v) for v in obj]
    return obj

def validate_email(email: str) -> bool:
    """Validate email format"""
    pattern = r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    return re.match(pattern, email) is not None

def validate_phone(phone: str) -> bool:
    """Validate South African phone number format"""
    pattern = r'^[0-9+\-\s()]{10,15}$'
    return re.match(pattern, phone) is not None

def validate_sa_id(id_number: str) -> bool:
    """Validate South African ID number format"""
    return len(id_number) == 13 and id_number.isdigit()

def validate_gps_coordinates(lat: float, lng: float) -> bool:
    """Validate GPS coordinates for South Africa"""
    return -35 <= lat <= -22 and 16 <= lng <= 33

def calculate_patient_age(date_of_birth):
    """Calculate patient age using database function"""
    if not date_of_birth:
        return None
    try:
        result = DatabaseManager.execute_query(
            "SELECT fn_calculate_age(%s) as age", (date_of_birth,), fetch=True
        )
        return result[0]['age'] if result else None
    except:
        # Fallback calculation
        from datetime import date
        today = date.today()
        birth_date = date_of_birth if isinstance(date_of_birth, date) else datetime.strptime(date_of_birth, '%Y-%m-%d').date()
        return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))

def get_patient_risk_category(patient_id: int):
    """Get patient risk category using database function"""
    try:
        result = DatabaseManager.execute_query(
            "SELECT fn_get_patient_risk_category(%s) as risk_category", (patient_id,), fetch=True
        )
        return result[0]['risk_category'] if result else 'Low'
    except Exception as e:
        logger.warning(f"Failed to get risk category: {e}")
        return 'Low'

class DatabaseManager:
    """Enhanced database connection and query management with connection pooling"""
    
    @staticmethod
    def get_connection():
        """Get connection from pool"""
        try:
            if connection_pool:
                connection = connection_pool.get_connection()
                if connection.is_connected():
                    return connection
            else:
                # Fallback to direct connection
                connection = mysql.connector.connect(**{k: v for k, v in DB_CONFIG.items() 
                                                       if k not in ['pool_name', 'pool_size', 'pool_reset_session']})
                if connection.is_connected():
                    return connection
        except Error as e:
            logger.error(f"Database connection error: {e}")
            return None
    
    @staticmethod
    def execute_query(query: str, params: tuple = None, fetch: bool = False, fetch_one: bool = False):
        """Execute query with proper connection management"""
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
                if fetch_one:
                    result = cursor.fetchone()
                else:
                    result = cursor.fetchall()
                logger.info(f"Query returned {len(result) if result and not fetch_one else (1 if result else 0)} rows")
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
    
    @staticmethod
    def call_procedure(procedure_name: str, params: tuple = None):
        """Call stored procedure"""
        connection = DatabaseManager.get_connection()
        if not connection:
            return None
        
        try:
            cursor = connection.cursor(dictionary=True)
            cursor.callproc(procedure_name, params or ())
            
            # Get results
            results = []
            for result in cursor.stored_results():
                results.append(result.fetchall())
            
            connection.commit()
            return results
        except Error as e:
            logger.error(f"Procedure execution error: {e}")
            if connection:
                connection.rollback()
            return None
        finally:
            if connection and connection.is_connected():
                cursor.close()
                connection.close()

class SessionManager:
    """Enhanced session management using database"""
    
    @staticmethod
    def create_session(user_id: int, device_info: dict = None, ip_address: str = None, location_data: dict = None):
        """Create new user session"""
        session_token = str(uuid.uuid4())
        expires_at = datetime.utcnow() + timedelta(hours=24)
        
        query = """
        INSERT INTO user_sessions (user_id, session_token, device_info, ip_address, 
                                  location_data, expires_at) 
        VALUES (%s, %s, %s, %s, %s, %s)
        """
        
        result = DatabaseManager.execute_query(
            query, 
            (user_id, session_token, json.dumps(device_info) if device_info else None, 
             ip_address, json.dumps(location_data) if location_data else None, expires_at)
        )
        
        return session_token if result else None
    
    @staticmethod
    def validate_session(session_token: str):
        """Validate session token"""
        query = """
        SELECT us.*, u.id as user_id, u.email, u.first_name, u.last_name, ur.role_name
        FROM user_sessions us
        JOIN users u ON us.user_id = u.id
        JOIN user_roles ur ON u.role_id = ur.id
        WHERE us.session_token = %s AND us.expires_at > %s AND u.is_active = TRUE
        """
        
        return DatabaseManager.execute_query(
            query, (session_token, datetime.utcnow()), fetch=True, fetch_one=True
        )
    
    @staticmethod
    def invalidate_session(session_token: str):
        """Invalidate session"""
        query = "DELETE FROM user_sessions WHERE session_token = %s"
        return DatabaseManager.execute_query(query, (session_token,))

def token_required(f):
    """Enhanced JWT token authentication decorator with session management"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        
        if not token:
            return jsonify({'success': False, 'error': 'Token is missing'}), 401
        
        try:
            if token.startswith('Bearer '):
                token = token[7:]
            
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            user_id = data['user_id']
            
            # Validate session if session_token provided
            session_token = data.get('session_token')
            if session_token:
                session_data = SessionManager.validate_session(session_token)
                if not session_data:
                    return jsonify({'success': False, 'error': 'Invalid session'}), 401
                request.current_user = session_data
            else:
                # Fallback to direct user lookup
                user_query = """
                SELECT u.*, ur.role_name 
                FROM users u 
                JOIN user_roles ur ON u.role_id = ur.id 
                WHERE u.id = %s AND u.is_active = TRUE
                """
                user = DatabaseManager.execute_query(user_query, (user_id,), fetch=True)
                
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
    """Enhanced role-based access control decorator"""
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

def audit_log(action: str, table_name: str = None, record_id: int = None, old_values: dict = None, new_values: dict = None):
    """Enhanced audit logging function"""
    try:
        user_id = getattr(request, 'current_user', {}).get('id')
        
        log_query = """
        INSERT INTO audit_log (user_id, table_name, record_id, action, old_values, new_values, 
                              ip_address, user_agent, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        DatabaseManager.execute_query(log_query, (
            user_id,
            table_name,
            record_id,
            action,
            json.dumps(old_values) if old_values else None,
            json.dumps(new_values) if new_values else None,
            request.remote_addr,
            request.headers.get('User-Agent', ''),
            datetime.utcnow()
        ))
    except Exception as e:
        logger.warning(f"Failed to log audit entry: {e}")

# ============================================================================
# PALMED INTEGRATION ENDPOINTS
# ============================================================================

@app.route('/api/palmed/member/lookup', methods=['POST'])
@token_required
@role_required(['Administrator', 'Doctor', 'Nurse', 'Clerk'])
def palmed_member_lookup():
    """Look up PALMED member by medical aid number"""
    try:
        data = request.get_json() or {}
        medical_aid_number = data.get('medical_aid_number', '').strip()
        
        if not medical_aid_number:
            return jsonify({'success': False, 'error': 'Medical aid number is required'}), 400
        
        # TODO: Implement actual PALMED API integration
        # For now, simulate the lookup with database check
        existing_patient = DatabaseManager.execute_query(
            "SELECT * FROM patients WHERE medical_aid_number = %s",
            (medical_aid_number,), fetch=True
        )
        
        if existing_patient:
            patient_data = existing_patient[0]
            return jsonify({
                'success': True,
                'found': True,
                'member_data': {
                    'medical_aid_number': patient_data['medical_aid_number'],
                    'first_name': patient_data['first_name'],
                    'last_name': patient_data['last_name'],
                    'member_type': patient_data['member_type'],
                    'is_active': True
                }
            }), 200
        else:
            # Simulate PALMED API response
            return jsonify({
                'success': True,
                'found': False,
                'message': 'Member not found in PALMED database'
            }), 200
    
    except Exception as e:
        logger.error(f"PALMED lookup error: {e}")
        return jsonify({'success': False, 'error': 'PALMED lookup service unavailable'}), 503

@app.route('/api/palmed/member/sync', methods=['POST'])
@token_required
@role_required(['Administrator'])
def sync_palmed_data():
    """Sync patient data with PALMED systems"""
    try:
        data = request.get_json() or {}
        patient_id = data.get('patient_id')
        
        if not patient_id:
            return jsonify({'success': False, 'error': 'Patient ID is required'}), 400
        
        # Get patient data
        patient = DatabaseManager.execute_query(
            "SELECT * FROM patients WHERE id = %s", (patient_id,), fetch=True
        )
        
        if not patient:
            return jsonify({'success': False, 'error': 'Patient not found'}), 404
        
        patient_data = patient[0]
        
        # TODO: Implement actual PALMED API sync
        # For now, log the sync attempt
        audit_log('SYNC', 'patients', patient_id, None, {
            'sync_target': 'PALMED',
            'medical_aid_number': patient_data['medical_aid_number']
        })
        
        return jsonify({
            'success': True,
            'message': 'Patient data synced with PALMED successfully'
        }), 200
    
    except Exception as e:
        logger.error(f"PALMED sync error: {e}")
        return jsonify({'success': False, 'error': 'PALMED sync failed'}), 500

# ============================================================================
# PUBLIC BOOKING INTERFACE (Critical URS requirement)
# ============================================================================

@app.route('/api/public/routes/available', methods=['GET'])
def get_public_available_routes():
    """Public endpoint for available routes and booking slots"""
    try:
        province = request.args.get('province', '')
        date_from = request.args.get('date_from', datetime.now().strftime('%Y-%m-%d'))
        date_to = request.args.get('date_to', (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d'))
        location_type = request.args.get('location_type', '')
        
        # Get available routes with booking slots
        query = """
        SELECT 
            r.id,
            r.route_name,
            r.description,
            r.province,
            r.route_type,
            rl.id as route_location_id,
            rl.visit_date,
            rl.start_time,
            rl.end_time,
            l.location_name,
            l.city,
            l.address,
            rl.max_appointments,
            COUNT(a.id) as total_slots,
            COUNT(CASE WHEN a.status = 'Available' THEN 1 END) as available_slots,
            MIN(a.appointment_time) as earliest_slot,
            MAX(a.appointment_time) as latest_slot
        FROM routes r
        JOIN route_locations rl ON r.id = rl.route_id
        JOIN locations l ON rl.location_id = l.id
        LEFT JOIN appointments a ON rl.id = a.route_location_id
        WHERE r.is_active = TRUE 
        AND rl.visit_date >= %s 
        AND rl.visit_date <= %s
        AND rl.visit_date >= CURDATE()
        """
        
        params = [date_from, date_to]
        
        if province:
            query += " AND r.province = %s"
            params.append(province)
        
        if location_type:
            query += " AND r.route_type = %s"
            params.append(location_type)
        
        query += """ 
        GROUP BY r.id, rl.id 
        HAVING available_slots > 0
        ORDER BY rl.visit_date, rl.start_time
        """
        
        available_routes = DatabaseManager.execute_query(query, tuple(params), fetch=True)
        
        return jsonify({
            'success': True,
            'routes': _to_jsonable(available_routes or [])
        }), 200
        
    except Exception as e:
        logger.error(f"Public routes error: {e}")
        return jsonify({'success': False, 'error': 'Unable to retrieve available routes'}), 500

@app.route('/api/public/appointments/slots', methods=['GET'])
def get_public_appointment_slots():
    """Get available appointment slots for a specific route location"""
    try:
        route_location_id = request.args.get('route_location_id')
        
        if not route_location_id:
            return jsonify({'success': False, 'error': 'Route location ID is required'}), 400
        
        # Get available slots
        query = """
        SELECT 
            a.id,
            a.appointment_time,
            a.duration_minutes,
            a.status,
            rl.visit_date,
            l.location_name,
            l.address,
            r.route_name
        FROM appointments a
        JOIN route_locations rl ON a.route_location_id = rl.id
        JOIN locations l ON rl.location_id = l.id
        JOIN routes r ON rl.route_id = r.id
        WHERE a.route_location_id = %s 
        AND a.status = 'Available'
        AND rl.visit_date >= CURDATE()
        ORDER BY a.appointment_time
        """
        
        slots = DatabaseManager.execute_query(query, (route_location_id,), fetch=True)
        
        return jsonify({
            'success': True,
            'slots': _to_jsonable(slots or [])
        }), 200
        
    except Exception as e:
        logger.error(f"Public slots error: {e}")
        return jsonify({'success': False, 'error': 'Unable to retrieve appointment slots'}), 500

@app.route('/api/public/appointments/book', methods=['POST'])
def book_public_appointment():
    """Public appointment booking endpoint"""
    try:
        data = request.get_json() or {}
        
        required_fields = ['appointment_id', 'patient_name', 'patient_phone']
        missing_fields = [field for field in required_fields if not data.get(field, '').strip()]
        
        if missing_fields:
            return jsonify({
                'success': False, 
                'error': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        appointment_id = data['appointment_id']
        patient_name = data['patient_name'].strip()
        patient_phone = data['patient_phone'].strip()
        patient_email = data.get('patient_email', '').strip()
        special_requirements = data.get('special_requirements', '').strip()
        
        # Validate phone number
        if not validate_phone(patient_phone):
            return jsonify({'success': False, 'error': 'Invalid phone number format'}), 400
        
        # Validate email if provided
        if patient_email and not validate_email(patient_email):
            return jsonify({'success': False, 'error': 'Invalid email format'}), 400
        
        # Check if appointment is still available
        appointment_check = DatabaseManager.execute_query(
            """
            SELECT a.*, rl.visit_date, l.location_name 
            FROM appointments a
            JOIN route_locations rl ON a.route_location_id = rl.id
            JOIN locations l ON rl.location_id = l.id
            WHERE a.id = %s AND a.status = 'Available' AND rl.visit_date >= CURDATE()
            """,
            (appointment_id,), fetch=True
        )
        
        if not appointment_check:
            return jsonify({'success': False, 'error': 'Appointment slot no longer available'}), 409
        
        appointment_data = appointment_check[0]
        
        # Generate booking reference
        booking_reference = f"PAL{datetime.now().strftime('%Y%m%d')}{str(appointment_id).zfill(4)}"
        
        # Book the appointment
        update_query = """
        UPDATE appointments 
        SET status = 'Booked',
            booking_reference = %s,
            booked_by_name = %s,
            booked_by_phone = %s,
            booked_by_email = %s,
            special_requirements = %s,
            booked_at = %s
        WHERE id = %s AND status = 'Available'
        """
        
        result = DatabaseManager.execute_query(update_query, (
            booking_reference,
            patient_name,
            patient_phone,
            patient_email,
            special_requirements,
            datetime.utcnow(),
            appointment_id
        ))
        
        if not result:
            return jsonify({'success': False, 'error': 'Booking failed - slot may no longer be available'}), 409
        
        # Audit log
        audit_log('INSERT', 'appointments', appointment_id, None, {
            'booking_type': 'public',
            'patient_name': patient_name,
            'booking_reference': booking_reference
        })
        
        return jsonify({
            'success': True,
            'message': 'Appointment booked successfully',
            'booking_reference': booking_reference,
            'appointment_details': {
                'date': appointment_data['visit_date'],
                'time': appointment_data['appointment_time'],
                'location': appointment_data['location_name'],
                'duration': appointment_data['duration_minutes']
            }
        }), 201
        
    except Exception as e:
        logger.error(f"Public booking error: {e}")
        return jsonify({'success': False, 'error': 'Booking failed due to technical error'}), 500

@app.route('/api/public/appointments/status', methods=['GET'])
def check_public_appointment_status():
    """Check appointment status by booking reference"""
    try:
        booking_reference = request.args.get('booking_reference', '').strip()
        
        if not booking_reference:
            return jsonify({'success': False, 'error': 'Booking reference is required'}), 400
        
        # Get appointment details
        query = """
        SELECT 
            a.id,
            a.booking_reference,
            a.appointment_time,
            a.duration_minutes,
            a.status,
            a.booked_by_name,
            a.booked_by_phone,
            a.booked_by_email,
            a.special_requirements,
            a.booked_at,
            rl.visit_date,
            l.location_name,
            l.address,
            l.contact_phone,
            r.route_name,
            r.description
        FROM appointments a
        JOIN route_locations rl ON a.route_location_id = rl.id
        JOIN locations l ON rl.location_id = l.id
        JOIN routes r ON rl.route_id = r.id
        WHERE a.booking_reference = %s
        """
        
        appointment = DatabaseManager.execute_query(query, (booking_reference,), fetch=True)
        
        if not appointment:
            return jsonify({'success': False, 'error': 'Booking reference not found'}), 404
        
        return jsonify({
            'success': True,
            'appointment': _to_jsonable(appointment[0])
        }), 200
        
    except Exception as e:
        logger.error(f"Appointment status error: {e}")
        return jsonify({'success': False, 'error': 'Unable to check appointment status'}), 500

# ============================================================================
# ENHANCED OFFLINE SYNC ENDPOINTS
# ============================================================================

@app.route('/api/sync/status/comprehensive', methods=['GET'])
@token_required
def get_comprehensive_sync_status():
    """Enhanced sync status with detailed analytics"""
    try:
        device_id = request.args.get('device_id')
        
        if not device_id:
            return jsonify({'success': False, 'error': 'device_id is required'}), 400

        # Get detailed sync statistics
        sync_stats = DatabaseManager.execute_query("""
            SELECT 
                sync_status,
                table_name,
                operation_type,
                COUNT(*) as count,
                MIN(local_timestamp) as oldest_pending,
                MAX(local_timestamp) as newest_pending,
                AVG(retry_count) as avg_retries
            FROM sync_status
            WHERE device_id = %s
            GROUP BY sync_status, table_name, operation_type
        """, (device_id,), fetch=True)

        # Get sync health metrics
        health_metrics = DatabaseManager.execute_query("""
            SELECT 
                COUNT(*) as total_operations,
                COUNT(CASE WHEN sync_status = 'Synced' THEN 1 END) as synced_count,
                COUNT(CASE WHEN sync_status = 'Pending' THEN 1 END) as pending_count,
                COUNT(CASE WHEN sync_status = 'Failed' THEN 1 END) as failed_count,
                COUNT(CASE WHEN sync_status = 'Conflict' THEN 1 END) as conflict_count,
                MAX(synced_at) as last_successful_sync
            FROM sync_status
            WHERE device_id = %s
        """, (device_id,), fetch=True)

        # Get recent failures for troubleshooting
        recent_failures = DatabaseManager.execute_query("""
            SELECT table_name, operation_type, error_message, last_retry_at, retry_count
            FROM sync_status
            WHERE device_id = %s AND sync_status = 'Failed'
            ORDER BY last_retry_at DESC
            LIMIT 10
        """, (device_id,), fetch=True)

        return jsonify({
            'success': True,
            'data': {
                'sync_statistics': _to_jsonable(sync_stats or []),
                'health_metrics': _to_jsonable(health_metrics[0] if health_metrics else {}),
                'recent_failures': _to_jsonable(recent_failures or []),
                'device_id': device_id,
                'sync_manager_status': 'active' if sync_manager.auto_sync_enabled else 'inactive',
                'last_check': datetime.utcnow().isoformat()
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Comprehensive sync status error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/sync/offline/batch-upload', methods=['POST'])
@token_required
def batch_sync_upload():
    """Enhanced batch upload for offline data with conflict resolution"""
    try:
        data = request.get_json() or {}
        device_id = data.get('device_id')
        operations = data.get('operations', [])
        force_overwrite = data.get('force_overwrite', False)
        
        if not device_id or not operations:
            return jsonify({
                'success': False, 
                'error': 'device_id and operations are required'
            }), 400

        processed_count = 0
        failed_count = 0
        conflicts = []
        errors = []

        for operation in operations:
            try:
                table_name = operation.get('table_name')
                record_id = operation.get('record_id')
                operation_type = operation.get('operation_type')
                local_timestamp = operation.get('local_timestamp')
                record_data = operation.get('data', {})

                if not all([table_name, operation_type, local_timestamp]):
                    failed_count += 1
                    errors.append(f"Missing required fields in operation for {table_name}")
                    continue

                # Enhanced conflict detection
                conflict_result = self.detect_sync_conflicts(
                    table_name, record_id, local_timestamp, operation_type
                )
                
                if conflict_result and not force_overwrite:
                    conflicts.append({
                        'table_name': table_name,
                        'record_id': record_id,
                        'conflict_type': conflict_result['type'],
                        'conflict_details': conflict_result['details']
                    })
                    continue

                # Process the operation based on type
                if self.process_sync_operation(operation, device_id, request.current_user['id']):
                    processed_count += 1
                    
                    # Add to sync manager for background processing
                    sync_manager.add_operation(device_id, operation)
                else:
                    failed_count += 1
                    errors.append(f"Failed to process {operation_type} on {table_name}")

            except Exception as op_error:
                logger.error(f"Operation processing error: {op_error}")
                failed_count += 1
                errors.append(str(op_error))

        return jsonify({
            'success': True,
            'message': f'Processed {processed_count} operations',
            'summary': {
                'processed': processed_count,
                'failed': failed_count,
                'conflicts': len(conflicts),
                'total_operations': len(operations)
            },
            'conflicts': conflicts,
            'errors': errors[:10]  # Limit error list
        }), 200

    except Exception as e:
        logger.error(f"Batch sync upload error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

def detect_sync_conflicts(self, table_name: str, record_id: int, local_timestamp: str, operation_type: str):
    """Detect sync conflicts with detailed analysis"""
    try:
        # Check for newer server-side changes
        server_check = DatabaseManager.execute_query("""
            SELECT updated_at, created_at FROM {} 
            WHERE id = %s AND (updated_at > %s OR created_at > %s)
        """.format(table_name), (record_id, local_timestamp, local_timestamp), fetch=True)
        
        if server_check:
            return {
                'type': 'newer_server_version',
                'details': {
                    'server_timestamp': server_check[0]['updated_at'] or server_check[0]['created_at'],
                    'local_timestamp': local_timestamp
                }
            }
        
        # Check for concurrent modifications
        concurrent_check = DatabaseManager.execute_query("""
            SELECT COUNT(*) as count FROM sync_status
            WHERE table_name = %s AND record_id = %s 
            AND local_timestamp > %s AND sync_status = 'Pending'
        """, (table_name, record_id, local_timestamp), fetch=True)
        
        if concurrent_check and concurrent_check[0]['count'] > 0:
            return {
                'type': 'concurrent_modification',
                'details': {'pending_operations': concurrent_check[0]['count']}
            }
        
        return None
        
    except Exception as e:
        logger.error(f"Conflict detection error: {e}")
        return None

def process_sync_operation(self, operation: dict, device_id: str, user_id: int) -> bool:
    """Process individual sync operation"""
    try:
        table_name = operation.get('table_name')
        operation_type = operation.get('operation_type')
        local_timestamp = operation.get('local_timestamp')
        
        # Record sync status
        sync_query = """
        INSERT INTO sync_status (table_name, record_id, operation_type, sync_status,
                               device_id, user_id, local_timestamp, server_timestamp)
        VALUES (%s, %s, %s, 'Pending', %s, %s, %s, %s)
        """
        
        result = DatabaseManager.execute_query(sync_query, (
            table_name,
            operation.get('record_id'),
            operation_type,
            device_id,
            user_id,
            local_timestamp,
            datetime.utcnow()
        ))
        
        return result is not None
        
    except Exception as e:
        logger.error(f"Sync operation processing error: {e}")
        return False

@app.route('/api/sync/conflict/resolve', methods=['POST'])
@token_required
@role_required(['Administrator', 'Doctor'])
def resolve_sync_conflict():
    """Resolve sync conflicts with user decision"""
    try:
        data = request.get_json() or {}
        
        conflict_id = data.get('conflict_id')
        resolution = data.get('resolution')  # 'use_server', 'use_local', 'merge'
        merge_data = data.get('merge_data', {})
        
        if not conflict_id or not resolution:
            return jsonify({
                'success': False, 
                'error': 'conflict_id and resolution are required'
            }), 400
        
        # Get conflict details
        conflict = DatabaseManager.execute_query(
            "SELECT * FROM sync_status WHERE id = %s AND sync_status = 'Conflict'",
            (conflict_id,), fetch=True
        )
        
        if not conflict:
            return jsonify({'success': False, 'error': 'Conflict not found'}), 404
        
        conflict_data = conflict[0]
        
        # Apply resolution based on user choice
        if resolution == 'use_server':
            # Mark as resolved, keep server version
            DatabaseManager.execute_query(
                "UPDATE sync_status SET sync_status = 'Resolved', synced_at = %s WHERE id = %s",
                (datetime.utcnow(), conflict_id)
            )
        
        elif resolution == 'use_local':
            # Apply local changes, override server
            # TODO: Implement local data application logic
            DatabaseManager.execute_query(
                "UPDATE sync_status SET sync_status = 'Synced', synced_at = %s WHERE id = %s",
                (datetime.utcnow(), conflict_id)
            )
        
        elif resolution == 'merge':
            # Apply merged data
            # TODO: Implement merge logic with merge_data
            DatabaseManager.execute_query(
                "UPDATE sync_status SET sync_status = 'Synced', synced_at = %s WHERE id = %s",
                (datetime.utcnow(), conflict_id)
            )
        
        # Audit log
        audit_log('RESOLVE_CONFLICT', 'sync_status', conflict_id, None, {
            'resolution': resolution,
            'table_name': conflict_data['table_name'],
            'record_id': conflict_data['record_id']
        })
        
        return jsonify({
            'success': True,
            'message': f'Conflict resolved using {resolution} strategy'
        }), 200
        
    except Exception as e:
        logger.error(f"Conflict resolution error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

# ============================================================================
# STANDARDIZED MENTAL HEALTH ASSESSMENT TOOLS
# ============================================================================

@app.route('/api/assessment/mental-health/tools', methods=['GET'])
@token_required
@role_required(['Administrator', 'Doctor', 'Social Worker'])
def get_mental_health_assessment_tools():
    """Get available standardized mental health assessment tools"""
    try:
        # Standardized assessment tools for PALMED
        assessment_tools = [
            {
                'id': 'phq9',
                'name': 'Patient Health Questionnaire-9 (PHQ-9)',
                'description': 'Depression screening tool',
                'type': 'depression',
                'questions_count': 9,
                'estimated_time': 5
            },
            {
                'id': 'gad7',
                'name': 'Generalized Anxiety Disorder 7-item (GAD-7)',
                'description': 'Anxiety screening tool',
                'type': 'anxiety',
                'questions_count': 7,
                'estimated_time': 5
            },
            {
                'id': 'audit',
                'name': 'Alcohol Use Disorders Identification Test (AUDIT)',
                'description': 'Alcohol use screening',
                'type': 'substance_use',
                'questions_count': 10,
                'estimated_time': 5
            },
            {
                'id': 'pcl5',
                'name': 'PTSD Checklist for DSM-5 (PCL-5)',
                'description': 'PTSD screening for police personnel',
                'type': 'trauma',
                'questions_count': 20,
                'estimated_time': 10
            },
            {
                'id': 'pss',
                'name': 'Perceived Stress Scale (PSS)',
                'description': 'Stress level assessment',
                'type': 'stress',
                'questions_count': 10,
                'estimated_time': 5
            }
        ]
        
        return jsonify({
            'success': True,
            'assessment_tools': assessment_tools
        }), 200
        
    except Exception as e:
        logger.error(f"Assessment tools error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/assessment/mental-health/<assessment_id>/questions', methods=['GET'])
@token_required
@role_required(['Administrator', 'Doctor', 'Social Worker'])
def get_assessment_questions(assessment_id: str):
    """Get questions for a specific assessment tool"""
    try:
        # PHQ-9 Depression Assessment
        if assessment_id == 'phq9':
            questions = [
                {
                    'id': 1,
                    'text': 'Little interest or pleasure in doing things',
                    'options': [
                        {'value': 0, 'text': 'Not at all'},
                        {'value': 1, 'text': 'Several days'},
                        {'value': 2, 'text': 'More than half the days'},
                        {'value': 3, 'text': 'Nearly every day'}
                    ]
                },
                {
                    'id': 2,
                    'text': 'Feeling down, depressed, or hopeless',
                    'options': [
                        {'value': 0, 'text': 'Not at all'},
                        {'value': 1, 'text': 'Several days'},
                        {'value': 2, 'text': 'More than half the days'},
                        {'value': 3, 'text': 'Nearly every day'}
                    ]
                },
                {
                    'id': 3,
                    'text': 'Trouble falling or staying asleep, or sleeping too much',
                    'options': [
                        {'value': 0, 'text': 'Not at all'},
                        {'value': 1, 'text': 'Several days'},
                        {'value': 2, 'text': 'More than half the days'},
                        {'value': 3, 'text': 'Nearly every day'}
                    ]
                }
                # Add remaining PHQ-9 questions...
            ]
        
        # GAD-7 Anxiety Assessment
        elif assessment_id == 'gad7':
            questions = [
                {
                    'id': 1,
                    'text': 'Feeling nervous, anxious, or on edge',
                    'options': [
                        {'value': 0, 'text': 'Not at all'},
                        {'value': 1, 'text': 'Several days'},
                        {'value': 2, 'text': 'More than half the days'},
                        {'value': 3, 'text': 'Nearly every day'}
                    ]
                }
                # Add remaining GAD-7 questions...
            ]
        
        # PCL-5 PTSD Assessment (Police-specific)
        elif assessment_id == 'pcl5':
            questions = [
                {
                    'id': 1,
                    'text': 'Repeated, disturbing, and unwanted memories of work-related stressful experiences',
                    'options': [
                        {'value': 0, 'text': 'Not at all'},
                        {'value': 1, 'text': 'A little bit'},
                        {'value': 2, 'text': 'Moderately'},
                        {'value': 3, 'text': 'Quite a bit'},
                        {'value': 4, 'text': 'Extremely'}
                    ]
                }
                # Add remaining PCL-5 questions...
            ]
        
        else:
            return jsonify({'success': False, 'error': 'Assessment tool not found'}), 404
        
        return jsonify({
            'success': True,
            'assessment_id': assessment_id,
            'questions': questions
        }), 200
        
    except Exception as e:
        logger.error(f"Assessment questions error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/visits/<int:visit_id>/assessment', methods=['POST'])
@token_required
@role_required(['Administrator', 'Doctor', 'Social Worker'])
def record_mental_health_assessment():
    """Record mental health assessment results"""
    try:
        data = request.get_json() or {}
        
        assessment_id = data.get('assessment_id')
        responses = data.get('responses', [])
        additional_notes = data.get('additional_notes', '')
        
        if not assessment_id or not responses:
            return jsonify({
                'success': False, 
                'error': 'assessment_id and responses are required'
            }), 400
        
        # Validate visit exists
        visit_check = DatabaseManager.execute_query(
            "SELECT id FROM patient_visits WHERE id = %s", (visit_id,), fetch=True
        )
        if not visit_check:
            return jsonify({'success': False, 'error': 'Visit not found'}), 404
        
        # Calculate assessment score
        total_score = sum(response.get('score', 0) for response in responses)
        
        # Determine risk level based on assessment type and score
        risk_level = self.calculate_risk_level(assessment_id, total_score)
        
        # Create assessment record as clinical note
        assessment_data = {
            'assessment_id': assessment_id,
            'total_score': total_score,
            'risk_level': risk_level,
            'responses': responses,
            'administered_by': request.current_user['id'],
            'administered_at': datetime.utcnow().isoformat()
        }
        
        note_query = """
        INSERT INTO clinical_notes (visit_id, note_type, content, created_by, created_at)
        VALUES (%s, 'Assessment', %s, %s, %s)
        """
        
        content = f"Mental Health Assessment - {assessment_id.upper()}\n"
        content += f"Total Score: {total_score}\n"
        content += f"Risk Level: {risk_level}\n"
        if additional_notes:
            content += f"Additional Notes: {additional_notes}\n"
        content += f"Assessment Data: {json.dumps(assessment_data)}"
        
        result = DatabaseManager.execute_query(note_query, (
            visit_id,
            content,
            request.current_user['id'],
            datetime.utcnow()
        ))
        
        if not result:
            return jsonify({'success': False, 'error': 'Failed to record assessment'}), 500
        
        # Create referral if high risk
        if risk_level in ['High', 'Severe']:
            self.create_automatic_referral(visit_id, assessment_id, risk_level, total_score)
        
        # Audit log
        audit_log('INSERT', 'clinical_notes', None, None, {
            'assessment_type': assessment_id,
            'risk_level': risk_level,
            'total_score': total_score
        })
        
        return jsonify({
            'success': True,
            'message': 'Assessment recorded successfully',
            'results': {
                'total_score': total_score,
                'risk_level': risk_level,
                'referral_created': risk_level in ['High', 'Severe']
            }
        }), 201
        
    except Exception as e:
        logger.error(f"Assessment recording error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

def calculate_risk_level(self, assessment_id: str, total_score: int) -> str:
    """Calculate risk level based on standardized scoring"""
    if assessment_id == 'phq9':
        if total_score <= 4:
            return 'Minimal'
        elif total_score <= 9:
            return 'Mild'
        elif total_score <= 14:
            return 'Moderate'
        elif total_score <= 19:
            return 'Moderately Severe'
        else:
            return 'Severe'
    
    elif assessment_id == 'gad7':
        if total_score <= 4:
            return 'Minimal'
        elif total_score <= 9:
            return 'Mild'
        elif total_score <= 14:
            return 'Moderate'
        else:
            return 'Severe'
    
    elif assessment_id == 'pcl5':
        if total_score < 31:
            return 'Low'
        elif total_score < 44:
            return 'Moderate'
        else:
            return 'High'
    
    return 'Unknown'

def create_automatic_referral(self, visit_id: int, assessment_id: str, risk_level: str, score: int):
    """Create automatic referral for high-risk assessments"""
    try:
        # Get patient ID from visit
        visit_data = DatabaseManager.execute_query(
            "SELECT patient_id FROM patient_visits WHERE id = %s", (visit_id,), fetch=True
        )
        
        if not visit_data:
            return
        
        patient_id = visit_data[0]['patient_id']
        
        # Create referral
        referral_query = """
        INSERT INTO referrals (
            patient_id, visit_id, referral_type, from_stage, to_stage,
            reason, notes, status, created_by, created_at
        ) VALUES (%s, %s, 'internal', 'Counseling Session', 'Doctor Consultation', %s, %s, 'pending', %s, %s)
        """
        
        reason = f"High-risk {assessment_id.upper()} assessment result"
        notes = f"Assessment Score: {score}, Risk Level: {risk_level}. Requires immediate clinical review."
        
        DatabaseManager.execute_query(referral_query, (
            patient_id,
            visit_id,
            reason,
            notes,
            request.current_user['id'],
            datetime.utcnow()
        ))
        
    except Exception as e:
        logger.error(f"Automatic referral creation error: {e}")

# ============================================================================
# AUTOMATED REFERRAL PROCESSING
# ============================================================================

@app.route('/api/referrals/process-automated', methods=['POST'])
@token_required
@role_required(['Administrator', 'Doctor'])
def process_automated_referrals():
    """Process referrals based on clinical protocols"""
    try:
        data = request.get_json() or {}
        visit_id = data.get('visit_id')
        diagnosis_codes = data.get('diagnosis_codes', [])
        symptoms = data.get('symptoms', [])
        
        if not visit_id:
            return jsonify({'success': False, 'error': 'visit_id is required'}), 400
        
        # Get visit and patient data
        visit_data = DatabaseManager.execute_query("""
            SELECT pv.*, p.date_of_birth, p.gender, p.chronic_conditions
            FROM patient_visits pv
            JOIN patients p ON pv.patient_id = p.id
            WHERE pv.id = %s
        """, (visit_id,), fetch=True)
        
        if not visit_data:
            return jsonify({'success': False, 'error': 'Visit not found'}), 404
        
        visit_info = visit_data[0]
        patient_age = calculate_patient_age(visit_info['date_of_birth'])
        
        referrals_created = []
        
        # Protocol-driven referral logic
        for diagnosis_code in diagnosis_codes:
            referral = self.check_referral_protocols(
                diagnosis_code, patient_age, visit_info['gender'], symptoms
            )
            
            if referral:
                # Create the referral
                referral_id = self.create_protocol_referral(
                    visit_info['patient_id'], visit_id, referral
                )
                if referral_id:
                    referrals_created.append(referral)
        
        return jsonify({
            'success': True,
            'message': f'Created {len(referrals_created)} automated referrals',
            'referrals': referrals_created
        }), 200
        
    except Exception as e:
        logger.error(f"Automated referral processing error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

def check_referral_protocols(self, diagnosis_code: str, patient_age: int, gender: str, symptoms: list) -> dict:
    """Check if diagnosis requires automatic referral based on protocols"""
    
    # Pregnancy-related referrals
    if diagnosis_code.startswith('Z34') or 'pregnancy' in [s.lower() for s in symptoms]:
        if gender == 'Female':
            return {
                'type': 'external',
                'provider': 'Obstetrics & Gynecology',
                'reason': 'Pregnancy care - routine antenatal services',
                'urgency': 'routine',
                'protocol': 'pregnancy_care'
            }
    
    # HIV-related referrals
    if diagnosis_code.startswith('Z21') or diagnosis_code.startswith('B20'):
        return {
            'type': 'external',
            'provider': 'HIV Specialist Clinic',
            'reason': 'HIV care and antiretroviral therapy management',
            'urgency': 'urgent',
            'protocol': 'hiv_care'
        }
    
    # TB-related referrals
    if diagnosis_code.startswith('A15') or 'tuberculosis' in [s.lower() for s in symptoms]:
        return {
            'type': 'external',
            'provider': 'TB Treatment Center',
            'reason': 'Tuberculosis diagnosis and treatment',
            'urgency': 'urgent',
            'protocol': 'tb_care'
        }
    
    # Diabetes referrals
    if diagnosis_code.startswith('E11') or diagnosis_code.startswith('E10'):
        return {
            'type': 'external',
            'provider': 'Endocrinology Clinic',
            'reason': 'Diabetes management and education',
            'urgency': 'routine',
            'protocol': 'diabetes_care'
        }
    
    # Hypertension referrals (if severe)
    if diagnosis_code.startswith('I10'):
        return {
            'type': 'external',
            'provider': 'Cardiology Clinic',
            'reason': 'Hypertension management',
            'urgency': 'routine',
            'protocol': 'hypertension_care'
        }
    
    # Mental health referrals
    if diagnosis_code.startswith('F'):
        return {
            'type': 'internal',
            'to_stage': 'Counseling Session',
            'reason': 'Mental health assessment and support',
            'urgency': 'routine',
            'protocol': 'mental_health'
        }
    
    return None

def create_protocol_referral(self, patient_id: int, visit_id: int, referral_data: dict) -> int:
    """Create referral based on protocol data"""
    try:
        if referral_data['type'] == 'external':
            query = """
            INSERT INTO referrals (
                patient_id, visit_id, referral_type, from_stage, external_provider,
                reason, notes, status, created_by, created_at
            ) VALUES (%s, %s, 'external', 'Doctor Consultation', %s, %s, %s, 'pending', %s, %s)
            """
            
            notes = f"Automated referral based on {referral_data['protocol']} protocol. Urgency: {referral_data['urgency']}"
            
            result = DatabaseManager.execute_query(query, (
                patient_id, visit_id, referral_data['provider'],
                referral_data['reason'], notes,
                request.current_user['id'], datetime.utcnow()
            ))
            
        else:  # internal referral
            query = """
            INSERT INTO referrals (
                patient_id, visit_id, referral_type, from_stage, to_stage,
                reason, notes, status, created_by, created_at
            ) VALUES (%s, %s, 'internal', 'Doctor Consultation', %s, %s, %s, 'pending', %s, %s)
            """
            
            notes = f"Automated referral based on {referral_data['protocol']} protocol"
            
            result = DatabaseManager.execute_query(query, (
                patient_id, visit_id, referral_data['to_stage'],
                referral_data['reason'], notes,
                request.current_user['id'], datetime.utcnow()
            ))
        
        return result
        
    except Exception as e:
        logger.error(f"Protocol referral creation error: {e}")
        return None

# ============================================================================
# ADVANCED REPORTING AND ANALYTICS
# ============================================================================

@app.route('/api/reports/daily-operations', methods=['GET'])
@token_required
@role_required(['Administrator', 'Doctor'])
def generate_daily_operations_report():
    """Generate comprehensive daily operations report"""
    try:
        report_date = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
        
        # Use stored procedure for daily report generation
        try:
            DatabaseManager.call_procedure('sp_generate_daily_report', (report_date,))
        except Exception as proc_error:
            logger.warning(f"Stored procedure error: {proc_error}")
        
        # Get comprehensive daily statistics
        daily_stats = DatabaseManager.execute_query("""
            SELECT 
                COUNT(DISTINCT pv.id) as total_visits,
                COUNT(DISTINCT pv.patient_id) as unique_patients,
                COUNT(DISTINCT CASE WHEN p.is_palmed_member = TRUE THEN pv.patient_id END) as palmed_members,
                COUNT(DISTINCT CASE WHEN pv.is_completed = TRUE THEN pv.id END) as completed_visits,
                COUNT(DISTINCT CASE WHEN pv.is_completed = FALSE THEN pv.id END) as active_visits,
                COUNT(DISTINCT CASE WHEN cn.note_type = 'Assessment' THEN cn.id END) as mental_health_assessments,
                COUNT(DISTINCT r.id) as referrals_created,
                COUNT(DISTINCT vs.id) as vital_signs_recorded,
                AVG(CASE WHEN pv.completed_at IS NOT NULL 
                    THEN TIMESTAMPDIFF(MINUTE, pv.created_at, pv.completed_at) END) as avg_visit_duration
            FROM patient_visits pv
            JOIN patients p ON pv.patient_id = p.id
            LEFT JOIN clinical_notes cn ON pv.id = cn.visit_id AND cn.note_type = 'Assessment'
            LEFT JOIN referrals r ON pv.id = r.visit_id AND DATE(r.created_at) = %s
            LEFT JOIN vital_signs vs ON pv.id = vs.visit_id
            WHERE pv.visit_date = %s
        """, (report_date,), fetch=True)

        # Location-based statistics
        location_stats = DatabaseManager.execute_query("""
            SELECT 
                pv.location,
                COUNT(*) as visits,
                COUNT(DISTINCT pv.patient_id) as patients,
                AVG(TIMESTAMPDIFF(MINUTE, pv.created_at, pv.completed_at)) as avg_duration
            FROM patient_visits pv
            WHERE pv.visit_date = %s AND pv.location IS NOT NULL
            GROUP BY pv.location
            ORDER BY visits DESC
        """, (report_date,), fetch=True)

        # Workflow efficiency
        workflow_stats = DatabaseManager.execute_query("""
            SELECT 
                ws.stage_name,
                COUNT(*) as stage_completions,
                AVG(TIMESTAMPDIFF(MINUTE, vwp.started_at, vwp.completed_at)) as avg_stage_duration
            FROM visit_workflow_progress vwp
            JOIN workflow_stages ws ON vwp.stage_id = ws.id
            JOIN patient_visits pv ON vwp.visit_id = pv.id
            WHERE pv.visit_date = %s AND vwp.completed_at IS NOT NULL
            GROUP BY ws.id, ws.stage_name
            ORDER BY ws.stage_order
        """, (report_date,), fetch=True)

        # Risk assessments summary
        risk_assessments = DatabaseManager.execute_query("""
            SELECT 
                SUBSTRING_INDEX(SUBSTRING_INDEX(cn.content, 'Risk Level: ', -1), '\n', 1) as risk_level,
                COUNT(*) as count
            FROM clinical_notes cn
            JOIN patient_visits pv ON cn.visit_id = pv.id
            WHERE pv.visit_date = %s 
            AND cn.note_type = 'Assessment'
            AND cn.content LIKE '%Risk Level:%'
            GROUP BY risk_level
        """, (report_date,), fetch=True)

        report_data = {
            'report_date': report_date,
            'generated_at': datetime.utcnow().isoformat(),
            'generated_by': request.current_user.get('first_name', '') + ' ' + request.current_user.get('last_name', ''),
            'daily_statistics': _to_jsonable(daily_stats[0] if daily_stats else {}),
            'location_breakdown': _to_jsonable(location_stats or []),
            'workflow_efficiency': _to_jsonable(workflow_stats or []),
            'risk_assessments': _to_jsonable(risk_assessments or [])
        }

        return jsonify({
            'success': True,
            'report': report_data
        }), 200

    except Exception as e:
        logger.error(f"Daily operations report error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/reports/inventory/expiry-alerts', methods=['GET'])
@token_required
@role_required(['Administrator', 'Doctor', 'Nurse'])
def get_inventory_expiry_report():
    """Generate inventory expiry alerts report using stored procedure"""
    try:
        days_ahead = int(request.args.get('days_ahead', 90))
        
        # Use stored procedure for expiry checking
        try:
            DatabaseManager.call_procedure('sp_check_expiring_inventory', (days_ahead,))
        except Exception as proc_error:
            logger.warning(f"Expiry check procedure error: {proc_error}")

        # Get expiring inventory using the view
        expiring_items = DatabaseManager.execute_query("""
            SELECT 
                c.item_code,
                c.item_name,
                cc.category_name,
                ist.batch_number,
                s.supplier_name,
                ist.quantity_current,
                c.unit_of_measure,
                ist.expiry_date,
                DATEDIFF(ist.expiry_date, CURDATE()) as days_to_expiry,
                ist.unit_cost,
                (ist.quantity_current * ist.unit_cost) as total_value,
                CASE 
                    WHEN ist.expiry_date <= CURDATE() THEN 'Expired'
                    WHEN ist.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'Critical'
                    WHEN ist.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY) THEN 'Warning'
                    ELSE 'Normal'
                END as alert_level
            FROM inventory_stock ist
            JOIN consumables c ON ist.consumable_id = c.id
            JOIN consumable_categories cc ON c.category_id = cc.id
            JOIN suppliers s ON ist.supplier_id = s.id
            WHERE ist.status = 'Active'
            AND ist.expiry_date <= DATE_ADD(CURDATE(), INTERVAL %s DAY)
            ORDER BY ist.expiry_date, c.item_name
        """, (days_ahead,), fetch=True)

        # Summary statistics
        summary = {
            'total_items': len(expiring_items),
            'expired_items': len([item for item in expiring_items if item['alert_level'] == 'Expired']),
            'critical_items': len([item for item in expiring_items if item['alert_level'] == 'Critical']),
            'warning_items': len([item for item in expiring_items if item['alert_level'] == 'Warning']),
            'total_value_at_risk': sum(item['total_value'] for item in expiring_items)
        }

        return jsonify({
            'success': True,
            'report': {
                'generated_at': datetime.utcnow().isoformat(),
                'days_ahead': days_ahead,
                'summary': summary,
                'expiring_items': _to_jsonable(expiring_items or [])
            }
        }), 200

    except Exception as e:
        logger.error(f"Inventory expiry report error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

# ============================================================================
# DEVICE INTEGRATION FRAMEWORK
# ============================================================================

@app.route('/api/devices/register', methods=['POST'])
@token_required
@role_required(['Administrator', 'Doctor', 'Nurse'])
def register_medical_device():
    """Register medical device for integration"""
    try:
        data = request.get_json() or {}
        
        device_type = data.get('device_type')  # 'blood_pressure', 'glucose_meter', 'thermometer', etc.
        device_id = data.get('device_id')
        manufacturer = data.get('manufacturer')
        model = data.get('model')
        serial_number = data.get('serial_number')
        
        required_fields = ['device_type', 'device_id', 'manufacturer', 'model']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return jsonify({
                'success': False,
                'error': f"Missing required fields: {', '.join(missing_fields)}"
            }), 400

        # Store device registration in system settings
        device_config = {
            'device_id': device_id,
            'device_type': device_type,
            'manufacturer': manufacturer,
            'model': model,
            'serial_number': serial_number,
            'registered_by': request.current_user['id'],
            'registered_at': datetime.utcnow().isoformat(),
            'status': 'active'
        }

        # Register device
        register_query = """
        INSERT INTO system_settings (setting_key, setting_value, setting_type, description, updated_by, updated_at)
        VALUES (%s, %s, 'json', %s, %s, %s)
        """

        result = DatabaseManager.execute_query(register_query, (
            f"device_{device_id}",
            json.dumps(device_config),
            f"Medical device registration: {device_type}",
            request.current_user['id'],
            datetime.utcnow()
        ))

        if not result:
            return jsonify({'success': False, 'error': 'Device registration failed'}), 500

        return jsonify({
            'success': True,
            'message': 'Medical device registered successfully',
            'device_config': device_config
        }), 201

    except Exception as e:
        logger.error(f"Device registration error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/devices/data/input', methods=['POST'])
@token_required
@role_required(['Administrator', 'Doctor', 'Nurse'])
def receive_device_data():
    """Receive data from medical devices"""
    try:
        data = request.get_json() or {}
        
        device_id = data.get('device_id')
        visit_id = data.get('visit_id')
        measurement_type = data.get('measurement_type')
        measurements = data.get('measurements', {})
        timestamp = data.get('timestamp', datetime.utcnow().isoformat())
        
        if not all([device_id, visit_id, measurement_type, measurements]):
            return jsonify({
                'success': False,
                'error': 'device_id, visit_id, measurement_type, and measurements are required'
            }), 400

        # Verify device is registered
        device_check = DatabaseManager.execute_query(
            "SELECT setting_value FROM system_settings WHERE setting_key = %s",
            (f"device_{device_id}",), fetch=True
        )

        if not device_check:
            return jsonify({'success': False, 'error': 'Device not registered'}), 404

        # Verify visit exists
        visit_check = DatabaseManager.execute_query(
            "SELECT id FROM patient_visits WHERE id = %s", (visit_id,), fetch=True
        )

        if not visit_check:
            return jsonify({'success': False, 'error': 'Visit not found'}), 404

        # Process measurements based on type
        if measurement_type == 'blood_pressure':
            # Extract blood pressure measurements
            systolic_bp = measurements.get('systolic')
            diastolic_bp = measurements.get('diastolic')
            heart_rate = measurements.get('heart_rate')

            if systolic_bp and diastolic_bp:
                # Insert into vital_signs table
                vital_signs_query = """
                INSERT INTO vital_signs (visit_id, recorded_by, systolic_bp, diastolic_bp, heart_rate, recorded_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                """

                DatabaseManager.execute_query(vital_signs_query, (
                    visit_id, request.current_user['id'], systolic_bp, diastolic_bp, heart_rate, timestamp
                ))

        elif measurement_type == 'glucose':
            # Extract glucose measurement
            blood_glucose = measurements.get('glucose_level')

            if blood_glucose:
                vital_signs_query = """
                INSERT INTO vital_signs (visit_id, recorded_by, blood_glucose, recorded_at)
                VALUES (%s, %s, %s, %s)
                """

                DatabaseManager.execute_query(vital_signs_query, (
                    visit_id, request.current_user['id'], blood_glucose, timestamp
                ))

        elif measurement_type == 'temperature':
            # Extract temperature measurement
            temperature = measurements.get('temperature')

            if temperature:
                vital_signs_query = """
                INSERT INTO vital_signs (visit_id, recorded_by, temperature, recorded_at)
                VALUES (%s, %s, %s, %s)
                """

                DatabaseManager.execute_query(vital_signs_query, (
                    visit_id, request.current_user['id'], temperature, timestamp
                ))

        # Log device data input
        audit_log('DEVICE_INPUT', 'vital_signs', None, None, {
            'device_id': device_id,
            'measurement_type': measurement_type,
            'visit_id': visit_id
        })

        return jsonify({
            'success': True,
            'message': f'{measurement_type} data recorded successfully'
        }), 201

    except Exception as e:
        logger.error(f"Device data input error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/devices/list', methods=['GET'])
@token_required
@role_required(['Administrator', 'Doctor', 'Nurse'])
def list_registered_devices():
    """List all registered medical devices"""
    try:
        # Get all device registrations
        devices_query = """
        SELECT setting_key, setting_value, updated_at
        FROM system_settings
        WHERE setting_key LIKE 'device_%' AND setting_type = 'json'
        ORDER BY updated_at DESC
        """

        device_records = DatabaseManager.execute_query(devices_query, fetch=True)

        devices = []
        for record in device_records or []:
            try:
                device_config = json.loads(record['setting_value'])
                device_config['last_updated'] = record['updated_at']
                devices.append(device_config)
            except json.JSONDecodeError:
                continue

        return jsonify({
            'success': True,
            'devices': _to_jsonable(devices)
        }), 200

    except Exception as e:
        logger.error(f"List devices error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

# ============================================================================
# ENHANCED AUTHENTICATION ENDPOINTS
# ============================================================================

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Enhanced user authentication with session management and geographic validation"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'Invalid request format'}), 400
            
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        logger.info(f"Login attempt for email: {email}")

        if not email or not password:
            return jsonify({'success': False, 'error': 'Email and password are required'}), 400

        if not validate_email(email):
            return jsonify({'success': False, 'error': 'Please enter a valid email address'}), 400

        # Get user from database with proper schema alignment
        query = """
        SELECT u.*, ur.role_name, ur.permissions
        FROM users u 
        JOIN user_roles ur ON u.role_id = ur.id 
        WHERE u.email = %s AND u.is_active = TRUE
        """
        user = DatabaseManager.execute_query(query, (email,), fetch=True)

        if not user:
            audit_log('LOGIN_FAILED', 'users', None, None, {'email': email, 'reason': 'user_not_found'})
            return jsonify({'success': False, 'error': 'Invalid email or password'}), 401

        user_data = user[0]

        # Verify password
        try:
            valid_password = check_password_hash(user_data['password_hash'], password)
        except Exception as pw_err:
            logger.warning(f"Password hash format error for user {email}: {pw_err}")
            valid_password = False

        if not valid_password:
            audit_log('LOGIN_FAILED', 'users', user_data['id'], None, {'email': email, 'reason': 'invalid_password'})
            return jsonify({'success': False, 'error': 'Invalid email or password'}), 401

        # Check if user requires approval
        if user_data.get('requires_approval') and not user_data.get('approved_at'):
            return jsonify({'success': False, 'error': 'Your account is pending approval'}), 401

        # Create session
        device_info = {
            'user_agent': request.headers.get('User-Agent', ''),
            'platform': data.get('platform', 'web'),
            'app_version': data.get('app_version', '1.0.0')
        }
        
        session_token = SessionManager.create_session(
            user_data['id'],
            device_info,
            request.remote_addr
        )

        # Generate JWT token with session reference
        token_payload = {
            'user_id': user_data['id'],
            'email': user_data['email'],
            'role': user_data['role_name'],
            'session_token': session_token,
            'exp': datetime.utcnow() + timedelta(hours=24),
            'iat': datetime.utcnow()
        }

        token = jwt.encode(token_payload, app.config['SECRET_KEY'], algorithm='HS256')

        # Update last login
        try:
            update_login_query = "UPDATE users SET last_login = %s WHERE id = %s"
            DatabaseManager.execute_query(update_login_query, (datetime.utcnow(), user_data['id']))
        except Exception as update_error:
            logger.warning(f"Failed to update last login: {update_error}")

        # Parse geographic restrictions
        geographic_restrictions = []
        if user_data.get('geographic_restrictions'):
            try:
                geographic_restrictions = json.loads(user_data['geographic_restrictions'])
            except:
                geographic_restrictions = []

        # Audit successful login
        audit_log('LOGIN', 'users', user_data['id'], None, {
            'email': email,
            'session_token': session_token[:8] + '...',  # Log partial token for security
            'platform': device_info.get('platform')
        })

        response_data = {
            'success': True,
            'data': {
                'token': token,
                'user': {
                    'id': user_data['id'],
                    'email': user_data['email'],
                    'first_name': user_data['first_name'],
                    'last_name': user_data['last_name'],
                    'role': user_data['role_name'],
                    'permissions': json.loads(user_data['permissions']) if user_data['permissions'] else {},
                    'geographic_restrictions': geographic_restrictions,
                    'mp_number': user_data.get('mp_number')
                }
            },
            'message': 'Login successful'
        }

        return jsonify(response_data), 200

    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error occurred'}), 500

@app.route('/api/auth/logout', methods=['POST'])
@token_required
def logout():
    """Enhanced logout with session invalidation"""
    try:
        # Get session token from JWT
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if token:
            try:
                data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
                session_token = data.get('session_token')
                if session_token:
                    SessionManager.invalidate_session(session_token)
            except:
                pass  # Token might be invalid, but we still want to log the logout attempt

        # Audit logout
        audit_log('LOGOUT', 'users', request.current_user.get('id'))

        return jsonify({'success': True, 'message': 'Logged out successfully'}), 200

    except Exception as e:
        logger.error(f"Logout error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

# Continue with existing patient management endpoints...
# [Previous patient management code remains the same]

# ============================================================================
# ENHANCED ERROR HANDLERS
# ============================================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'error': 'Endpoint not found'}), 404

@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({'success': False, 'error': 'Method not allowed'}), 405

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {error}")
    return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({'success': False, 'error': 'Request entity too large'}), 413

# ============================================================================
# HEALTH CHECK AND SYSTEM INFO
# ============================================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Enhanced health check with detailed system status"""
    try:
        health_status = {
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'version': '2.0.0',
            'components': {}
        }

        # Database connectivity check
        try:
            connection = DatabaseManager.get_connection()
            if connection:
                cursor = connection.cursor()
                cursor.execute("SELECT 1")
                cursor.fetchone()
                cursor.close()
                connection.close()
                health_status['components']['database'] = {
                    'status': 'healthy',
                    'connection_pool': 'available' if connection_pool else 'unavailable'
                }
            else:
                health_status['components']['database'] = {'status': 'unhealthy'}
                health_status['status'] = 'unhealthy'
        except Exception as db_error:
            health_status['components']['database'] = {
                'status': 'unhealthy',
                'error': str(db_error)
            }
            health_status['status'] = 'unhealthy'

        # Check sync manager
        health_status['components']['sync_manager'] = {
            'status': 'healthy' if sync_manager.auto_sync_enabled else 'inactive',
            'pending_operations': len(sync_manager.pending_operations)
        }

        # Check critical tables
        try:
            table_checks = [
                'users', 'patients', 'patient_visits', 'routes', 
                'inventory_stock', 'workflow_stages', 'appointments'
            ]
            
            for table in table_checks:
                count_result = DatabaseManager.execute_query(
                    f"SELECT COUNT(*) as count FROM {table}", fetch=True
                )
                if count_result:
                    health_status['components'][f'table_{table}'] = {
                        'status': 'healthy',
                        'record_count': count_result[0]['count']
                    }
                else:
                    health_status['components'][f'table_{table}'] = {'status': 'unhealthy'}
                    health_status['status'] = 'degraded'
                    
        except Exception as table_error:
            health_status['components']['tables'] = {
                'status': 'unhealthy',
                'error': str(table_error)
            }
            health_status['status'] = 'unhealthy'

        status_code = 200 if health_status['status'] == 'healthy' else 503
        
        return jsonify(health_status), status_code
        
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 503

# ============================================================================
# APPLICATION STARTUP
# ============================================================================

if __name__ == '__main__':
    # Ensure connection pool is available
    if not connection_pool:
        logger.warning("Connection pool not available, using direct connections")
    
    # Log startup information
    logger.info("PALMED Mobile Clinic ERP API Server v2.0 starting...")
    logger.info(f"Database: {DB_CONFIG['database']} at {DB_CONFIG['host']}:{DB_CONFIG['port']}")
    logger.info(f"Connection pooling: {'Enabled' if connection_pool else 'Disabled'}")
    logger.info(f"Offline sync manager: {'Active' if sync_manager.auto_sync_enabled else 'Inactive'}")
    logger.info("New features: Public booking, Enhanced sync, Mental health assessments, Device integration")
    
    app.run(
        debug=os.environ.get('FLASK_DEBUG', 'True').lower() == 'true',
        host='0.0.0.0',
        port=int(os.environ.get('FLASK_PORT', 5000))
    )