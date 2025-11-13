import re
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import mysql.connector
from mysql.connector import Error, errorcode
import jwt
from datetime import date, datetime, timedelta, timezone, time
from functools import wraps
import os
import logging
from typing import Any, Dict, List, Set, Optional, Sequence
import uuid
import json
import hashlib

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'palmed-clinic-secret-key-2025')

# Specialist workflow metadata (stage id -> role, label, note type)
SPECIALIST_DEFINITIONS: Dict[str, Dict[str, str]] = {
    'dentist': {
        'role': 'dentist',
        'label': 'Dental Consultation',
        'note_type': 'Dentist',
    },
    'optometrist': {
        'role': 'optometrist',
        'label': 'Optometry Assessment',
        'note_type': 'Optometrist',
    },
    'audiologist': {
        'role': 'audiologist',
        'label': 'Audiology Assessment',
        'note_type': 'Audiologist',
    },
    'gynaecologist': {
        'role': 'gynaecologist',
        'label': 'Gynaecology Consultation',
        'note_type': 'Gynaecologist',
    },
    'ultrasound': {
        'role': 'ultrasound',
        'label': 'Ultrasound Scan',
        'note_type': 'Ultrasound',
    },
    'psychology': {
        'role': 'psychologist',
        'label': 'Psychology Session',
        'note_type': 'Psychology',
    },
}
SPECIALIST_STAGE_ORDER: List[str] = [
    'dentist',
    'optometrist',
    'audiologist',
    'gynaecologist',
    'ultrasound',
    'psychology',
]
SPECIALIST_ROLE_NAMES: Set[str] = {definition['role'] for definition in SPECIALIST_DEFINITIONS.values()}
SPECIALIST_LOOKUP: Dict[str, str] = {}
SPECIALIST_NOTE_LOOKUP: Dict[str, str] = {}
for specialist_key, specialist_def in SPECIALIST_DEFINITIONS.items():
    alias_values = {
        specialist_key,
        specialist_def['role'],
        specialist_def['label'],
        specialist_def['note_type'],
    }
    for alias in alias_values:
        normalized_alias = str(alias).strip().lower().replace(' ', '_')
        SPECIALIST_LOOKUP[normalized_alias] = specialist_key
    SPECIALIST_NOTE_LOOKUP[specialist_def['note_type']] = specialist_key

TRUTHY_FLAG_VALUES: Set[Any] = {
    True,
    1,
    '1',
    'true',
    'True',
    'TRUE',
    'yes',
    'Yes',
    'YES',
    'on',
    'On',
    'ON',
    'y',
    'Y',
}

ALLOWED_DOCUMENT_EXTENSIONS: Set[str] = {
    '.pdf',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.tif',
    '.tiff',
    '.bmp',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.csv',
    '.txt',
    '.rtf',
}


def _allowed_document_extension(filename: str) -> bool:
    if not filename or '.' not in filename:
        return False
    extension = filename.rsplit('.', 1)[1].lower()
    return f'.{extension}' in ALLOWED_DOCUMENT_EXTENSIONS


def _parse_bool_flag(value: Any, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    text = str(value).strip()
    if not text:
        return default
    return text in {'1', 'true', 'True', 'TRUE', 'yes', 'Yes', 'YES', 'on', 'On', 'ON'}

# Allow CORS from configured frontends (comma-separated) or common localhost defaults
# Prefer CORS_ALLOWED_ORIGINS (pipeline/app settings) but support legacy FRONTEND_ORIGINS
cors_origins_env = os.environ.get('CORS_ALLOWED_ORIGINS') or os.environ.get('FRONTEND_ORIGINS')
if cors_origins_env:
    allowed_origins = [o.strip() for o in cors_origins_env.split(',') if o.strip()]
else:
    allowed_origins = ["http://localhost:3000", "https://ambitious-smoke-079250a03.2.azurestaticapps.net"]

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

# Optional: Azure MySQL SSL configuration (set via App Settings). If DB_SSL_CA is provided we enable SSL.
DB_SSL_CA = os.environ.get('DB_SSL_CA')  # path to CA certificate in container
DB_SSL_DISABLED = os.environ.get('DB_SSL_DISABLED', '0') in ('1', 'true', 'True')
if DB_SSL_CA and not DB_SSL_DISABLED:
    DB_CONFIG['ssl_ca'] = DB_SSL_CA

_table_columns_cache: Dict[str, Set[str]] = {}


def _ensure_specialist_table() -> None:
    """Create visit_specialists table if it does not already exist."""
    if getattr(_ensure_specialist_table, '_done', False):
        return
    try:
        DatabaseManager.execute_query(
            """
            CREATE TABLE IF NOT EXISTS visit_specialists (
                id INT AUTO_INCREMENT PRIMARY KEY,
                visit_id INT NOT NULL,
                specialist_type VARCHAR(50) NOT NULL,
                required TINYINT(1) NOT NULL DEFAULT 1,
                completed_at DATETIME NULL,
                completed_by INT NULL,
                notes TEXT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_visit_specialist (visit_id, specialist_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """
        )
    except Exception as exc:
        logger.error(f"Failed to ensure visit_specialists table: {exc}")
    finally:
        _ensure_specialist_table._done = True


def _get_visit_specialists(visit_id: int) -> List[Dict[str, Any]]:
    _ensure_specialist_table()
    rows = DatabaseManager.execute_query(
        """
        SELECT visit_id, specialist_type, required, completed_at, completed_by, notes, created_at, updated_at
        FROM visit_specialists
        WHERE visit_id = %s
        """,
        (visit_id,),
        fetch=True,
    )
    return rows or []


def _set_visit_specialists(visit_id: int, required_types: Set[str], *, user_id: int) -> None:
    _ensure_specialist_table()

    existing = {row['specialist_type']: row for row in _get_visit_specialists(visit_id)}
    now = datetime.utcnow()

    for specialist_type, definition in SPECIALIST_DEFINITIONS.items():
        should_require = specialist_type in required_types
        if specialist_type in existing:
            DatabaseManager.execute_query(
                """
                UPDATE visit_specialists
                SET required = %s,
                    notes = CASE WHEN %s = 0 THEN NULL ELSE notes END,
                    completed_at = CASE WHEN %s = 0 THEN NULL ELSE completed_at END,
                    updated_at = %s
                WHERE visit_id = %s AND specialist_type = %s
                """,
                (1 if should_require else 0, 1 if should_require else 0, 1 if should_require else 0, now, visit_id, specialist_type)
            )
        elif should_require:
            DatabaseManager.execute_query(
                """
                INSERT INTO visit_specialists (visit_id, specialist_type, required, created_at, updated_at)
                VALUES (%s, %s, 1, %s, %s)
                """,
                (visit_id, specialist_type, now, now)
            )


def _mark_specialist_completed(
    visit_id: int,
    specialist_type: str,
    *,
    user_id: int,
    notes: Optional[str] = None,
    follow_up_required: Optional[bool] = None,
    follow_up_date: Optional[str] = None,
    record_note: bool = True,
) -> bool:
    if specialist_type not in SPECIALIST_DEFINITIONS:
        return False

    _ensure_specialist_table()

    result = DatabaseManager.execute_query(
        """
        UPDATE visit_specialists
        SET completed_at = %s,
            completed_by = %s,
            notes = %s,
            updated_at = %s
        WHERE visit_id = %s AND specialist_type = %s AND required = 1
        """,
        (datetime.utcnow(), user_id, notes, datetime.utcnow(), visit_id, specialist_type)
    )

    if not result:
        return False

    if not record_note:
        return True

    # Persist a clinical note for auditability if table supports it
    try:
        available_columns = _get_table_columns('clinical_notes')
        required_columns = {'visit_id', 'note_type', 'content', 'created_by'}
        if required_columns.issubset(available_columns):
            insert_columns = ['visit_id', 'note_type', 'content', 'created_by']
            insert_values: List[Any] = [visit_id, SPECIALIST_DEFINITIONS[specialist_type]['note_type'], notes or 'Specialist stage completed.', user_id]
            placeholders = ['%s', '%s', '%s', '%s']

            if 'follow_up_required' in available_columns and follow_up_required is not None:
                insert_columns.append('follow_up_required')
                placeholders.append('%s')
                insert_values.append(1 if follow_up_required else 0)

            if 'follow_up_date' in available_columns and follow_up_date:
                try:
                    parsed_date = datetime.strptime(str(follow_up_date)[:10], '%Y-%m-%d').date()
                    insert_columns.append('follow_up_date')
                    placeholders.append('%s')
                    insert_values.append(parsed_date)
                except ValueError:
                    logger.warning(f"Invalid follow-up date supplied for specialist note: {follow_up_date}")

            DatabaseManager.execute_query(
                f"INSERT INTO clinical_notes ({', '.join(insert_columns)}) VALUES ({', '.join(placeholders)})",
                tuple(insert_values)
            )
    except Exception as exc:
        logger.warning(f"Failed to record specialist clinical note: {exc}")

    return True


def _parse_specialist_selection(payload: Any) -> Set[str]:
    """Normalize specialist selections from mixed payload formats."""
    selected: Set[str] = set()

    def _maybe_add(value: Any, should_include: bool = True) -> None:
        if not should_include:
            return
        normalized = SPECIALIST_LOOKUP.get(str(value).strip().lower().replace(' ', '_'))
        if normalized:
            selected.add(normalized)

    truthy_values = {'true', '1', 'yes', 'y', 'on'}

    if isinstance(payload, dict):
        for key, flag in payload.items():
            include = False
            if isinstance(flag, bool):
                include = flag
            elif isinstance(flag, (int, float)):
                include = bool(flag)
            elif isinstance(flag, str):
                include = flag.strip().lower() in truthy_values
            _maybe_add(key, include)
    elif isinstance(payload, (list, tuple, set)):
        for item in payload:
            _maybe_add(item, True)
    elif isinstance(payload, str):
        parts = [p for p in re.split(r'[;,]', payload) if p.strip()]
        if len(parts) <= 1:
            parts = payload.split()
        for part in parts:
            _maybe_add(part, True)

    return selected


def _get_table_columns(table_name: str) -> Set[str]:
    """Fetch and cache the column names for a given table."""
    if not table_name or not re.match(r"^[a-zA-Z0-9_]+$", table_name):
        return set()

    cached = _table_columns_cache.get(table_name)
    if cached is not None:
        return cached

    rows = DatabaseManager.execute_query(f"SHOW COLUMNS FROM {table_name}", fetch=True)
    columns = {row.get('Field') for row in rows or [] if row.get('Field')}
    _table_columns_cache[table_name] = columns
    return columns


def _normalize_record_id(raw_id: Any) -> int:
    """Convert arbitrary record identifiers into a stable integer."""
    if raw_id is None:
        return 0

    if isinstance(raw_id, bool):
        return int(raw_id)

    if isinstance(raw_id, (int, float)):
        try:
            return int(raw_id)
        except (ValueError, TypeError):
            pass

    try:
        raw_str = str(raw_id).strip()
        if raw_str.isdigit() or (raw_str.startswith("-") and raw_str[1:].isdigit()):
            return int(raw_str)
    except Exception:
        raw_str = None

    hashed_source = raw_str if raw_str is not None else json.dumps(raw_id, default=str)
    digest = hashlib.sha256(hashed_source.encode("utf-8")).hexdigest()[:10]
    # Keep within signed 32-bit range for compatibility with schema expectations
    return int(digest, 16) % 2147483647


def create_patient_notification(
    patient_id: int,
    notification_type: str,
    title: str,
    message: str,
    priority: str = 'medium',
    action_url: Optional[str] = None,
    expires_at: Optional[datetime] = None
) -> Optional[int]:
    """
    Helper function to create a patient notification.
    
    Args:
        patient_id: ID of the patient to notify
        notification_type: Type of notification ('appointment', 'health_update', 'reminder', 'alert', 'system')
        title: Notification title
        message: Notification message
        priority: Priority level ('low', 'medium', 'high', 'urgent')
        action_url: Optional URL for the notification action
        expires_at: Optional expiration datetime
    
    Returns:
        The ID of the created notification, or None if creation failed
    """
    try:
        query = """
            INSERT INTO patient_notifications 
            (patient_id, notification_type, title, message, priority, action_url, expires_at, is_read, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 0, NOW())
        """
        
        db_manager.execute_query(
            query,
            (patient_id, notification_type, title, message, priority, action_url, expires_at),
            fetch=False
        )
        
        # Get the last inserted ID
        id_query = "SELECT LAST_INSERT_ID() as id"
        result = db_manager.execute_query(id_query, fetch=True)
        
        if result and len(result) > 0:
            notification_id = result[0]['id']
            logger.info(f"Created notification {notification_id} for patient {patient_id}: {title}")
            return notification_id
        
        return None
        
    except Exception as e:
        logger.error(f"Failed to create notification for patient {patient_id}: {e}")
        return None


def _infer_endpoint_from_record(record: Dict[str, Any], payload: Optional[Dict[str, Any]] = None) -> Optional[str]:
    """Derive a REST endpoint when the client did not supply one."""
    table_name = str(record.get("table_name") or "").strip().lower()

    base_map = {
        "patient": "/api/patients",
        "patients": "/api/patients",
        "route": "/api/routes",
        "routes": "/api/routes",
        "appointment": "/api/appointments",
        "appointments": "/api/appointments",
        "inventory": "/api/inventory",
        "billing": "/api/billing",
        "user": "/api/users",
        "users": "/api/users",
        "report": "/api/reports",
        "reports": "/api/reports",
    }

    base = base_map.get(table_name)
    if not base:
        return None

    operation = str(record.get("operation_type") or "").strip().upper()
    identifier = None

    if payload and isinstance(payload, dict):
        identifier = payload.get("id") or payload.get("record_id") or payload.get("external_id")

    if identifier is None:
        identifier = record.get("record_id")

    if operation in {"UPDATE", "DELETE"} and identifier is not None:
        return f"{base.rstrip('/')}/{identifier}"

    return base


def _operation_method(operation_type: str, provided_method: Optional[str] = None) -> str:
    if provided_method:
        return provided_method.upper()

    op = (operation_type or "").upper()
    if op == "INSERT":
        return "POST"
    if op == "DELETE":
        return "DELETE"
    return "PUT"


def _persist_sync_status(
    *,
    table_name: str,
    record_id: int,
    operation_type: str,
    status: str,
    device_id: Optional[str],
    user_id: Optional[int],
    timestamp_ms: Optional[int],
    payload: Optional[Dict[str, Any]] = None,
    error_message: Optional[str] = None,
):
    """Insert or update sync_status rows with rich metadata."""
    local_timestamp = None
    if timestamp_ms:
        try:
            local_timestamp = datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc)
        except Exception:
            local_timestamp = None

    if local_timestamp is None:
        local_timestamp = datetime.utcnow().replace(tzinfo=timezone.utc)

    conflict_payload = None
    if payload:
        try:
            conflict_payload = json.dumps(payload)
        except Exception:
            conflict_payload = json.dumps({"payload": str(payload)})

    retry_count_value = 0 if status == "Synced" else 1
    synced_at_value = datetime.utcnow() if status == "Synced" else None

    query = """
    INSERT INTO sync_status (
        table_name, record_id, operation_type, sync_status,
        device_id, user_id, local_timestamp, server_timestamp,
        error_message, conflict_data, retry_count, last_retry_at, synced_at
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), %s, %s, %s, NOW(), %s)
    ON DUPLICATE KEY UPDATE
        operation_type = VALUES(operation_type),
        sync_status = VALUES(sync_status),
        device_id = VALUES(device_id),
        user_id = VALUES(user_id),
        local_timestamp = VALUES(local_timestamp),
        server_timestamp = NOW(),
        error_message = VALUES(error_message),
        conflict_data = VALUES(conflict_data),
        retry_count = CASE WHEN VALUES(sync_status) = 'Synced' THEN 0 ELSE retry_count + 1 END,
        last_retry_at = NOW(),
        synced_at = CASE WHEN VALUES(sync_status) = 'Synced' THEN NOW() ELSE synced_at
    """

    DatabaseManager.execute_query(
        query,
        (
            table_name,
            record_id,
            operation_type,
            status,
            device_id,
            user_id,
            local_timestamp,
            error_message,
            conflict_payload,
            retry_count_value,
            synced_at_value,
        ),
    )


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
        
        cursor = None
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

    @staticmethod
    def call_procedure(proc_name: str, params: list | tuple | None = None, fetch: bool = True):
        """Call a stored procedure and optionally return result sets."""
        connection = DatabaseManager.get_connection()
        if not connection:
            logger.error("No database connection available for stored procedure call")
            return None

        cursor = None
        try:
            cursor = connection.cursor(dictionary=True)
            call_params = list(params or [])
            logger.info(f"Calling stored procedure {proc_name} with params: {call_params}")
            result_args = cursor.callproc(proc_name, call_params)

            result_sets = []
            if fetch:
                for stored in cursor.stored_results():
                    fetched = stored.fetchall()
                    logger.info(f"Procedure {proc_name} returned {len(fetched) if fetched else 0} rows")
                    result_sets.append(fetched)

            connection.commit()
            return {
                'args': result_args,
                'result_sets': result_sets
            }
        except Error as e:
            logger.error(f"Stored procedure {proc_name} execution error: {e}")
            if connection:
                connection.rollback()
            return None
        finally:
            if cursor:
                cursor.close()
            if connection and connection.is_connected():
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

#============================================================================
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
# PATIENT PORTAL ENDPOINTS
# ============================================================================

@app.route('/api/patient/auth/register', methods=['POST'])
def register_patient_portal():
    """Register a new patient through the patient portal (public endpoint)"""
    try:
        data = request.get_json() or {}

        # Required fields
        required_fields = ['first_name', 'last_name', 'email', 'password', 'mobile_number', 'date_of_birth', 'gender']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'error': f'{field} is required'}), 400

    # Validate email format and normalise to lowercase
        email = data['email'].strip().lower()
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            return jsonify({'success': False, 'error': 'Invalid email format'}), 400

        # Validate password strength (mirrors frontend rules)
        password = data['password']
        if len(password) < 8 or not re.search(r'[a-z]', password) or not re.search(r'[A-Z]', password) or not re.search(r'\d', password):
            return jsonify({'success': False, 'error': 'Password must include upper, lower case letters and a number'}), 400

        # Validate mobile number (South African format)
        mobile_number = re.sub(r'\s+', '', data['mobile_number'])
        if not re.match(r'^(\+27|0)[0-9]{9}$', mobile_number):
            return jsonify({'success': False, 'error': 'Please provide a valid South African mobile number'}), 400

        # Ensure key fields are unique before attempting transaction
        existing_patient = DatabaseManager.execute_query(
            "SELECT id FROM patients WHERE email = %s",
            (email,),
            fetch=True,
        )
        if existing_patient:
            return jsonify({'success': False, 'error': 'A patient with this email already exists'}), 400

        existing_auth_email = DatabaseManager.execute_query(
            "SELECT id FROM patient_authentication WHERE email = %s",
            (email,),
            fetch=True,
        )
        if existing_auth_email:
            return jsonify({'success': False, 'error': 'Patient portal access already exists for this email'}), 400

        polmed_number_raw = (data.get('polmed_number') or '').strip().upper()
        polmed_number = polmed_number_raw or None
        is_private_patient = bool(data.get('is_private_patient')) or not polmed_number

        if polmed_number:
            existing_polmed_patient = DatabaseManager.execute_query(
                "SELECT id FROM patients WHERE medical_aid_number = %s",
                (polmed_number,),
                fetch=True,
            )
            if existing_polmed_patient:
                return jsonify({'success': False, 'error': 'A patient with this POLMED number already exists'}), 400

            existing_auth_polmed = DatabaseManager.execute_query(
                "SELECT id FROM patient_authentication WHERE polmed_number = %s",
                (polmed_number,),
                fetch=True,
            )
            if existing_auth_polmed:
                return jsonify({'success': False, 'error': 'Patient portal access already exists for this POLMED number'}), 400

        # Consent tracking (checkboxes required in UI)
        terms_accepted = bool(data.get('terms_accepted'))
        privacy_accepted = bool(data.get('privacy_accepted'))
        marketing_consent = bool(data.get('marketing_consent'))

        if not terms_accepted or not privacy_accepted:
            return jsonify({'success': False, 'error': 'Terms and privacy policy must be accepted to continue'}), 400

        connection = DatabaseManager.get_connection()
        if not connection:
            return jsonify({'success': False, 'error': 'Database connection failed'}), 500

        chronic_conditions = json.dumps([])
        allergies = json.dumps([])
        current_medications = json.dumps([])
        try:
            cursor = connection.cursor(dictionary=True)
            now_utc = datetime.utcnow()

            insert_patient_query = """
                INSERT INTO patients (
                    medical_aid_number,
                    first_name,
                    last_name,
                    date_of_birth,
                    gender,
                    id_number,
                    phone_number,
                    email,
                    physical_address,
                    emergency_contact_name,
                    emergency_contact_phone,
                    is_palmed_member,
                    member_type,
                    chronic_conditions,
                    allergies,
                    current_medications,
                    created_by,
                    created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """

            cursor.execute(
                insert_patient_query,
                (
                    polmed_number,
                    data['first_name'].strip(),
                    data['last_name'].strip(),
                    data['date_of_birth'],
                    data['gender'],
                    None,
                    mobile_number,
                    email,
                    None,
                    None,
                    None,
                    not is_private_patient,
                    'Non-member' if is_private_patient else 'Principal',
                    chronic_conditions,
                    allergies,
                    current_medications,
                    None,
                    now_utc,
                ),
            )

            patient_id = cursor.lastrowid
            if not patient_id:
                raise Error("Failed to retrieve patient ID after insert")

            auth_polmed_number = polmed_number if polmed_number else f"PRIVATE-{patient_id}"

            auth_insert_query = """
                INSERT INTO patient_authentication (
                    patient_id,
                    polmed_number,
                    email,
                    password_hash,
                    mobile_number,
                    is_verified,
                    verification_token,
                    verification_expires,
                    login_attempts,
                    locked_until,
                    last_login,
                    created_at,
                    updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """

            cursor.execute(
                auth_insert_query,
                (
                    patient_id,
                    auth_polmed_number,
                    email,
                    generate_password_hash(password),
                    mobile_number,
                    0,
                    None,
                    None,
                    0,
                    None,
                    None,
                    now_utc,
                    now_utc,
                ),
            )

            audit_insert_query = """
                INSERT INTO audit_log (table_name, record_id, action, new_values, created_at)
                VALUES ('patients', %s, 'INSERT', %s, %s)
            """
            cursor.execute(
                audit_insert_query,
                (
                    patient_id,
                    json.dumps({
                        'first_name': data['first_name'].strip(),
                        'last_name': data['last_name'].strip(),
                        'email': email,
                        'registration_source': 'patient_portal'
                    }),
                    now_utc,
                ),
            )

            connection.commit()

        except Error as db_error:
            connection.rollback()
            logger.error(f"Patient portal registration error: {db_error}")

            if getattr(db_error, 'errno', None) == errorcode.ER_DUP_ENTRY:
                error_message = str(db_error)
                if 'patients.medical_aid_number' in error_message:
                    friendly = 'A patient with this POLMED number already exists'
                elif 'patient_authentication.polmed_number' in error_message:
                    friendly = 'Portal access already exists for this POLMED number'
                elif 'patient_authentication.email' in error_message or 'patients.email' in error_message:
                    friendly = 'Portal access already exists for this email'
                else:
                    friendly = 'Duplicate record detected for patient'
                return jsonify({'success': False, 'error': friendly}), 400

            return jsonify({'success': False, 'error': 'Failed to create patient account'}), 500

        finally:
            if 'cursor' in locals() and cursor:
                cursor.close()
            connection.close()

        return jsonify({
            'success': True,
            'message': 'Patient registration completed successfully.',
            'data': {
                'patient_id': patient_id,
                'requires_verification': False,
                'note': 'Patient profile and authentication record created.'
            }
        }), 201

    except Exception as e:
        logger.error(f"Patient registration error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/patient-portal/login', methods=['POST'])
def patient_portal_login():
    """Authenticate a patient portal user."""
    try:
        data = request.get_json() or {}
        email = str(data.get('email', '')).strip().lower()
        password = data.get('password', '')

        if not email or not password:
            return jsonify({'success': False, 'error': 'Email and password are required'}), 400

        auth_rows = DatabaseManager.execute_query(
            """
            SELECT pa.*, p.first_name, p.last_name, p.medical_aid_number,
                   p.is_palmed_member, p.member_type, p.phone_number, p.email AS patient_email
            FROM patient_authentication pa
            JOIN patients p ON pa.patient_id = p.id
            WHERE pa.email = %s
            """,
            (email,),
            fetch=True,
        )

        if not auth_rows:
            return jsonify({'success': False, 'error': 'Invalid email or password'}), 401

        auth_record = auth_rows[0]

        locked_until = auth_record.get('locked_until')
        if locked_until and locked_until > datetime.utcnow():
            return jsonify({'success': False, 'error': 'Account temporarily locked. Please try again later.'}), 403

        try:
            password_valid = check_password_hash(auth_record['password_hash'], password)
        except Exception:
            password_valid = False

        connection = DatabaseManager.get_connection()
        if not connection:
            return jsonify({'success': False, 'error': 'Database connection failed'}), 500

        session_token = None
        session_expires_at = None
        session_payload = None
        try:
            cursor = connection.cursor()
            if not password_valid:
                new_attempts = int(auth_record.get('login_attempts') or 0) + 1
                lock_until = None
                if new_attempts >= 5:
                    lock_until = datetime.utcnow() + timedelta(minutes=15)
                    new_attempts = 0

                cursor.execute(
                    "UPDATE patient_authentication SET login_attempts = %s, locked_until = %s WHERE id = %s",
                    (new_attempts, lock_until, auth_record['id'])
                )
                connection.commit()
                return jsonify({'success': False, 'error': 'Invalid email or password'}), 401

            # Successful login: reset attempts, update last_login
            now_utc = datetime.utcnow()
            cursor.execute(
                "UPDATE patient_authentication SET login_attempts = %s, locked_until = NULL, last_login = %s, updated_at = %s WHERE id = %s",
                (0, now_utc, now_utc, auth_record['id'])
            )

            # Create session entry to align with patient_sessions schema
            session_token = str(uuid.uuid4())
            session_expires_at = now_utc + timedelta(hours=12)
            ip_address = request.headers.get('X-Forwarded-For', request.remote_addr)
            device_info = {
                'user_agent': request.headers.get('User-Agent'),
                'origin': request.headers.get('Origin'),
            }
            session_payload = {
                'authenticated_at': now_utc.isoformat(),
                'patient_email': auth_record.get('patient_email') or auth_record.get('email'),
            }

            cursor.execute(
                """
                INSERT INTO patient_sessions (patient_id, session_token, device_info, ip_address, location_data, expires_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    auth_record['patient_id'],
                    session_token,
                    json.dumps(device_info),
                    ip_address,
                    json.dumps(session_payload),
                    session_expires_at,
                )
            )

            connection.commit()
        finally:
            cursor.close()
            connection.close()

        payload = {
            'patient_id': auth_record['patient_id'],
            'email': email,
            'type': 'patient_portal',
            'exp': datetime.now(timezone.utc) + timedelta(hours=12),
            'iat': datetime.now(timezone.utc)
        }
        token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

        patient_full_name = f"{auth_record.get('first_name', '').strip()} {auth_record.get('last_name', '').strip()}".strip()

        response_payload = {
            'success': True,
            'data': {
                'token': token,
                'patient_data': {
                    'id': auth_record['patient_id'],
                    'full_name': patient_full_name,
                    'medical_aid_number': auth_record.get('medical_aid_number'),
                    'is_palmed_member': bool(auth_record.get('is_palmed_member')),
                    'member_type': auth_record.get('member_type'),
                    'phone_number': auth_record.get('phone_number') or auth_record.get('mobile_number'),
                    'email': auth_record.get('patient_email') or auth_record.get('email')
                }
            }
        }

        if session_token and session_expires_at:
            response_payload['data']['session'] = {
                'token': session_token,
                'expires_at': session_expires_at.isoformat(),
            }

        # flag to indicate whether portal email verified
        response_payload['data']['patient_data']['is_verified'] = bool(auth_record.get('is_verified'))

        return jsonify(response_payload), 200

    except Exception as e:
        logger.error(f"Patient portal login error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

def patient_portal_token_required(f):
    """JWT token authentication decorator for patient portal endpoints"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        
        if not token:
            return jsonify({'success': False, 'error': 'Token is missing'}), 401
        
        try:
            if token.startswith('Bearer '):
                token = token[7:]
            
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            
            # Validate patient portal token type
            if data.get('type') != 'patient_portal':
                return jsonify({'success': False, 'error': 'Invalid token type'}), 401
            
            patient_id = data.get('patient_id')
            if not patient_id:
                return jsonify({'success': False, 'error': 'Invalid token'}), 401
            
            # Optional: Verify patient still exists and is active
            patient = DatabaseManager.execute_query(
                "SELECT id FROM patients WHERE id = %s",
                (patient_id,),
                fetch=True
            )
            
            if not patient:
                return jsonify({'success': False, 'error': 'Invalid token'}), 401
            
            request.patient_id = patient_id
            
        except jwt.ExpiredSignatureError:
            return jsonify({'success': False, 'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'success': False, 'error': 'Invalid token'}), 401
        
        return f(*args, **kwargs)
    
    return decorated

@app.route('/api/patient-portal/dashboard/<int:patient_id>', methods=['GET'])
@patient_portal_token_required
def patient_portal_dashboard(patient_id: int):
    """Get patient dashboard data (patient portal endpoint)"""
    try:
        # Verify token matches requested patient ID
        if request.patient_id != patient_id:
            return jsonify({'success': False, 'error': 'Access denied'}), 403
        
        # Get patient info
        patient_query = """
        SELECT id, CONCAT(first_name, ' ', last_name) as full_name, medical_aid_number,
               is_palmed_member, member_type, phone_number, email
        FROM patients WHERE id = %s
        """
        patient_info = DatabaseManager.execute_query(patient_query, (patient_id,), fetch=True)
        
        if not patient_info:
            return jsonify({'success': False, 'error': 'Patient not found'}), 404
        
        patient_data = patient_info[0]
        
        # Get upcoming appointments (if appointments table exists)
        upcoming_appointments = []
        try:
            # Get appointments with location info from patient_appointments table
            appointments_query = """
            SELECT pa.id, pa.booking_reference, 
                   DATE(pa.appointment_date) as appointment_date,
                   pa.appointment_time, 
                   COALESCE(l.location_name, 'Mobile Clinic') as location_name,
                   COALESCE(l.city, '') as city,
                   COALESCE(l.province, '') as province,
                   pa.status, COALESCE(pa.appointment_duration, 30) as duration_minutes
            FROM patient_appointments pa
            LEFT JOIN route_locations rl ON pa.route_location_id = rl.id
            LEFT JOIN locations l ON rl.location_id = l.id
            WHERE pa.patient_id = %s AND pa.status IN ('Confirmed', 'Booked')
            ORDER BY pa.appointment_date DESC
            LIMIT 5
            """
            upcoming_appointments = DatabaseManager.execute_query(appointments_query, (patient_id,), fetch=True) or []
        except Exception as e:
            logger.warning(f"Could not fetch appointments: {str(e)}")
            # Fallback query with just basic appointment info
            try:
                fallback_query = """
                SELECT id, booking_reference, 
                       DATE(appointment_date) as appointment_date,
                       appointment_time, 
                       'Mobile Clinic' as location_name,
                       '' as city, '' as province,
                       status, COALESCE(appointment_duration, 30) as duration_minutes
                FROM patient_appointments
                WHERE patient_id = %s AND status IN ('Confirmed', 'Booked')
                ORDER BY appointment_date DESC
                LIMIT 5
                """
                upcoming_appointments = DatabaseManager.execute_query(fallback_query, (patient_id,), fetch=True) or []
            except Exception as fallback_e:
                logger.warning(f"Fallback appointment query also failed: {str(fallback_e)}")
                upcoming_appointments = []
        
        # Get recent visits
        recent_visits_query = """
        SELECT pv.id as visit_id, pv.visit_date, l.location_name, pv.chief_complaint,
               pv.is_completed, 
               (SELECT COUNT(*) FROM visit_workflow_progress vwp WHERE vwp.visit_id = pv.id AND vwp.completed_at IS NOT NULL) as completed_stages,
               (SELECT COUNT(*) FROM workflow_stages) as total_stages
        FROM patient_visits pv
        LEFT JOIN locations l ON pv.location_id = l.id
        WHERE pv.patient_id = %s
        ORDER BY pv.visit_date DESC
        LIMIT 5
        """
        recent_visits = DatabaseManager.execute_query(recent_visits_query, (patient_id,), fetch=True) or []
        
        # Get health summary
        health_summary = {
            'total_visits': len(recent_visits) if recent_visits else 0,
            'chronic_conditions': [],
            'allergies': [],
            'current_medications': [],
            'last_visit_date': recent_visits[0]['visit_date'].isoformat() if recent_visits else None,
            'recent_diagnoses': []
        }
        
        # Parse JSON fields from patient record
        try:
            if patient_data.get('chronic_conditions'):
                health_summary['chronic_conditions'] = json.loads(patient_data['chronic_conditions'])
            if patient_data.get('allergies'):
                health_summary['allergies'] = json.loads(patient_data['allergies'])
            if patient_data.get('current_medications'):
                health_summary['current_medications'] = json.loads(patient_data['current_medications'])
        except (json.JSONDecodeError, TypeError):
            pass
        
        # Get notifications from patient_notifications table
        notifications = []
        try:
            notifications_query = """
                SELECT 
                    id,
                    notification_type,
                    title,
                    message,
                    priority,
                    action_url,
                    is_read,
                    read_at,
                    created_at,
                    expires_at
                FROM patient_notifications
                WHERE patient_id = %s
                    AND (expires_at IS NULL OR expires_at > NOW())
                ORDER BY 
                    CASE priority
                        WHEN 'urgent' THEN 1
                        WHEN 'high' THEN 2
                        WHEN 'medium' THEN 3
                        WHEN 'low' THEN 4
                    END,
                    created_at DESC
                LIMIT 50
            """
            notifications = DatabaseManager.execute_query(notifications_query, (patient_id,), fetch=True) or []
        except Exception as e:
            logger.warning(f"Could not fetch notifications: {str(e)}")
            notifications = []
        
        dashboard_data = {
            'patient_info': {
                'id': patient_data['id'],
                'full_name': patient_data['full_name'],
                'medical_aid_number': patient_data['medical_aid_number'],
                'is_palmed_member': bool(patient_data['is_palmed_member']),
                'member_type': patient_data['member_type'],
                'phone_number': patient_data['phone_number'],
                'email': patient_data['email']
            },
            'upcoming_appointments': [_to_jsonable(appt) for appt in upcoming_appointments],
            'recent_visits': [_to_jsonable(visit) for visit in recent_visits],
            'health_summary': health_summary,
            'notifications': notifications
        }
        
        return jsonify({
            'success': True,
            'data': dashboard_data
        }), 200
        
    except Exception as e:
        logger.error(f"Patient portal dashboard error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/patient-portal/appointments/<int:appointment_id>/book', methods=['POST'])
@patient_portal_token_required
def patient_portal_book_appointment(appointment_id: int):
    """Book an appointment via patient portal (authenticated endpoint)"""
    try:
        data = request.get_json() or {}
        
        # Get patient_id from authenticated token
        patient_id = request.patient_id
        patient_notes = data.get('patient_notes', '').strip()
        
        # Get patient info for booking
        patient_query = """
        SELECT CONCAT(first_name, ' ', last_name) as full_name, phone_number, email
        FROM patients WHERE id = %s
        """
        patient_info = DatabaseManager.execute_query(patient_query, (patient_id,), fetch=True)
        
        if not patient_info:
            return jsonify({'success': False, 'error': 'Patient not found'}), 404
        
        patient_data = patient_info[0]
        booked_by_name = patient_data['full_name']
        booked_by_phone = patient_data['phone_number'] or ''
        booked_by_email = patient_data['email'] or ''
        
        if not booked_by_phone:
            return jsonify({'success': False, 'error': 'Patient phone number is required for booking'}), 400
        
        connection = DatabaseManager.get_connection()
        if not connection:
            return jsonify({'success': False, 'error': 'Database connection failed'}), 500
        
        try:
            cursor = connection.cursor()
            # Prepare args including OUT parameter placeholders
            args = [
                int(appointment_id),
                int(patient_id),
                booked_by_name,
                booked_by_phone,
                booked_by_email,
                patient_notes,
                None,  # OUT p_booking_reference
                None   # OUT p_result
            ]

            # callproc returns a sequence with OUT params populated
            result_args = cursor.callproc('sp_book_appointment', args)

            # OUT params are the last two arguments
            booking_reference = result_args[6]
            result_message = result_args[7]

            connection.commit()

            if result_message and str(result_message).startswith('SUCCESS') and booking_reference:
                return jsonify({
                    'success': True,
                    'data': {
                        'booking_reference': booking_reference,
                        'confirmation_sent': True
                    },
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
        logger.error(f"Patient portal book appointment error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

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
            elif data.get('telephone_number'):
                data['phone_number'] = data.get('telephone_number')
            
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

        # Require minimal fields; allow missing date_of_birth and default gender later
        required_fields = ['first_name', 'last_name', 'phone_number']
        missing_fields = []
        
        for field in required_fields:
            value = data.get(field)
            if value is None or (isinstance(value, str) and not value.strip()):
                missing_fields.append(field)
        
        if missing_fields:
            error_msg = f'Missing required fields: {", ".join(missing_fields)}'
            logger.error(f"[PATIENT_CREATE] Validation failed: {error_msg}")
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

# ============================================================================
# ENHANCED VISIT AND WORKFLOW MANAGEMENT
# ============================================================================

@app.route('/api/patients/<int:patient_id>/visits', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'clerk'])
def create_patient_visit(patient_id: int):
    """Create new patient visit aligned with schema"""
    try:
        data = request.get_json(silent=True) or {}

        requested_specialists: Set[str] = set()
        specialist_fields = [
            data.get('specialists'),
            data.get('required_specialists'),
            data.get('specialist_selection'),
        ]
        for field in specialist_fields:
            if field:
                requested_specialists.update(_parse_specialist_selection(field))

        for specialist_key in SPECIALIST_DEFINITIONS.keys():
            for suffix in ('', '_required', '_needed', '_selected'):
                flag_value = data.get(f"{specialist_key}{suffix}")
                if flag_value is None:
                    continue
                include = flag_value in TRUTHY_FLAG_VALUES
                if isinstance(flag_value, str):
                    stripped = flag_value.strip()
                    include = stripped in TRUTHY_FLAG_VALUES or stripped.lower() in {'true', 'yes', 'on'}
                if include:
                    requested_specialists.add(specialist_key)

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

        # If no explicit location, set a generic location including province suffix
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

        # Log visit creation activity
        if new_visit_id:
            try:
                _set_visit_specialists(new_visit_id, requested_specialists, user_id=request.current_user['id'])
            except Exception as specialist_err:
                logger.error(f"Failed to persist specialist configuration for visit {new_visit_id}: {specialist_err}")

            try:
                # Get patient name for audit log
                patient_info = DatabaseManager.execute_query(
                    "SELECT first_name, last_name FROM patients WHERE id = %s",
                    (patient_id,),
                    fetch=True,
                )
                patient_name = f"{patient_info[0]['first_name']} {patient_info[0]['last_name']}" if patient_info else f"Patient ID {patient_id}"
                
                log_query = """
                INSERT INTO audit_log (user_id, table_name, record_id, action, new_values, created_at)
                VALUES (%s, 'patient_visits', %s, 'INSERT', %s, %s)
                """
                new_values = json.dumps({
                    'patient_id': patient_id,
                    'patient_name': patient_name,
                    'visit_date': visit_date.isoformat() if hasattr(visit_date, 'isoformat') else str(visit_date),
                    'visit_time': visit_time.strftime('%H:%M:%S') if hasattr(visit_time, 'strftime') else str(visit_time),
                    'location': location,
                    'chief_complaint': chief_complaint,
                    'specialist_stages': sorted(requested_specialists)
                })
                DatabaseManager.execute_query(log_query, (
                    request.current_user['id'],
                    new_visit_id,
                    new_values,
                    datetime.utcnow()
                ))
            except Exception as log_error:
                logger.warning(f"Failed to log visit creation: {log_error}")

        return jsonify({
            'success': True,
            'message': 'Visit created successfully',
            'data': {
                'visit_id': new_visit_id,
                'specialist_stages': sorted(requested_specialists)
            }
        }), 201

    except Exception as e:
        logger.error(f"Create visit error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/patients/<int:patient_id>/visits/latest', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'clerk', 'social_work', 'social_worker'] + list(SPECIALIST_ROLE_NAMES))
def get_latest_visit(patient_id: int):
    """Return the most recent visit for a patient"""
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

# ============================================================================
# ENHANCED VITAL SIGNS MANAGEMENT
# ============================================================================

@app.route('/api/visits/<int:visit_id>/vital-signs', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor', 'nurse'])
def add_vital_signs(visit_id: int):
    """Record vital signs for a visit with nursing assessment notes"""
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

        # Insert vital signs
        try:
            logger.info(f"Inserting vitals for visit {visit_id}: BP={systolic_bp}/{diastolic_bp}, HR={heart_rate}, Temp={temperature}, O2={oxygen_saturation}")
            vital_result = DatabaseManager.execute_query(
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
            logger.info(f"Vital signs insert result: {vital_result}")
        except Exception as vital_error:
            logger.error(f"Failed to insert vital signs: {vital_error}", exc_info=True)
            return jsonify({'success': False, 'error': f'Failed to record vital signs: {str(vital_error)}'}), 500

        # Optional nursing assessment note
        nursing_notes = (data.get('nursing_notes') or '').strip()
        if nursing_notes:
            try:
                logger.info(f"Recording nursing notes for visit {visit_id}: {nursing_notes[:100]}")
                # Check if clinical_notes table exists first
                cursor = DatabaseManager.get_connection().cursor()
                cursor.execute("SHOW TABLES LIKE 'clinical_notes'")
                table_exists = cursor.fetchone() is not None
                cursor.close()
                
                if table_exists:
                    DatabaseManager.execute_query(
                        """
                        INSERT INTO clinical_notes (
                            visit_id, note_type, content, created_by
                        ) VALUES (%s, %s, %s, %s)
                        """,
                        (visit_id, 'nursing_assessment', nursing_notes, request.current_user['id']),
                        fetch=False,
                    )
                    logger.info("Nursing notes recorded successfully")
                else:
                    logger.warning("clinical_notes table does not exist")
            except Exception as note_error:
                logger.warning(f"Failed to record nursing notes: {note_error}")
                # Don't fail the entire operation if notes fail

        return jsonify({'success': True, 'message': 'Vital signs recorded successfully'}), 201

    except Exception as e:
        logger.error(f"Add vital signs error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/visits/<int:visit_id>/vital-signs', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'clerk', 'social_work', 'social_worker'] + list(SPECIALIST_ROLE_NAMES))
def get_visit_vitals(visit_id: int):
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

        # Fetch last Assessment note (nurse assessment)
        assessment = DatabaseManager.execute_query(
            """
            SELECT id, content, created_at, created_by
            FROM clinical_notes
            WHERE visit_id = %s AND note_type = 'Assessment'
            ORDER BY id DESC
            LIMIT 1
            """,
            (visit_id,),
            fetch=True,
        )

        last_non_null = DatabaseManager.execute_query(
            """
            SELECT
                (SELECT heart_rate  FROM vital_signs WHERE visit_id = %s AND heart_rate  IS NOT NULL ORDER BY id DESC LIMIT 1) AS heart_rate,
                (SELECT temperature FROM vital_signs WHERE visit_id = %s AND temperature IS NOT NULL ORDER BY id DESC LIMIT 1) AS temperature
            """,
            (visit_id, visit_id),
            fetch=True,
        )

        payload = {
            'count': (summary[0]['count'] if summary else 0),
            'latest': (_to_jsonable(latest[0]) if latest else None),
            'last_non_null': _to_jsonable(last_non_null[0]) if last_non_null else None,
            'nurse_assessment': _to_jsonable(assessment[0]) if assessment else None
        }
        return jsonify({'success': True, 'data': payload}), 200
    except Exception as e:
        logger.error(f"Get visit vitals error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


# ============================================================================
# ENHANCED CLINICAL NOTES MANAGEMENT  
# ============================================================================

@app.route('/api/visits/<int:visit_id>/clinical-notes', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'social_work', 'social_worker'] + list(SPECIALIST_ROLE_NAMES))
def get_clinical_notes(visit_id: int):
    """Get clinical notes for a visit"""
    try:
        notes = DatabaseManager.execute_query(
            """
            SELECT 
                cn.id,
                cn.visit_id,
                pv.patient_id,
                cn.note_type,
                cn.content,
                cn.icd10_codes,
                cn.medications_prescribed,
                cn.prescription_ids,
                cn.investigation_order_ids,
                cn.template_used,
                cn.confidence_score,
                cn.reviewed_by,
                cn.reviewed_at,
                cn.follow_up_required,
                cn.follow_up_date,
                cn.created_by,
                cn.created_at,
                cn.updated_at,
                u.first_name,
                u.last_name,
                ur.role_name
            FROM clinical_notes cn
            JOIN patient_visits pv ON cn.visit_id = pv.id
            JOIN users u ON cn.created_by = u.id
            LEFT JOIN user_roles ur ON u.role_id = ur.id
            WHERE cn.visit_id = %s
            ORDER BY cn.created_at DESC
            """,
            (visit_id,),
            fetch=True
        )
        
        return jsonify({
            'success': True,
            'data': _to_jsonable(notes) or []
        }), 200
        
    except Exception as e:
        logger.error(f"Get clinical notes error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/visits/<int:visit_id>/clinical-notes', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'social_work', 'social_worker'] + list(SPECIALIST_ROLE_NAMES))
def create_clinical_note(visit_id: int):
    """Create a clinical note with enhanced features"""
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
        
        base_note_types = {'Assessment', 'Diagnosis', 'Treatment', 'Referral', 'Counseling', 'Closure'}
        specialist_note_types = {definition['note_type'] for definition in SPECIALIST_DEFINITIONS.values()}
        valid_note_types = base_note_types.union(specialist_note_types)
        if note_type not in valid_note_types:
            return jsonify({'success': False, 'error': f'note_type must be one of: {sorted(valid_note_types)}'}), 400
        
        # Normalise optional payloads
        if isinstance(icd10_codes, str):
            stripped = icd10_codes.strip()
            if stripped:
                try:
                    parsed_codes = json.loads(stripped)
                    if isinstance(parsed_codes, list):
                        icd10_codes = parsed_codes
                    else:
                        icd10_codes = [stripped]
                except json.JSONDecodeError:
                    icd10_codes = [code.strip() for code in stripped.split(',') if code.strip()]
            else:
                icd10_codes = []
        icd10_codes = [str(code).strip() for code in icd10_codes if str(code).strip()] if isinstance(icd10_codes, list) else []

        if isinstance(medications_prescribed, str):
            stripped = medications_prescribed.strip()
            if stripped:
                try:
                    parsed_meds = json.loads(stripped)
                    if isinstance(parsed_meds, list):
                        medications_prescribed = parsed_meds
                    else:
                        medications_prescribed = [stripped]
                except json.JSONDecodeError:
                    medications_prescribed = [med.strip() for med in stripped.split(',') if med.strip()]
            else:
                medications_prescribed = []
        medications_prescribed = [str(med).strip() for med in medications_prescribed if str(med).strip()] if isinstance(medications_prescribed, list) else []

        # Get patient_id from visit
        visit_info = DatabaseManager.execute_query(
            "SELECT patient_id FROM patient_visits WHERE id = %s",
            (visit_id,),
            fetch=True
        )
        
        if not visit_info:
            return jsonify({'success': False, 'error': 'Visit not found'}), 404
            
        patient_id = visit_info[0]['patient_id']

        available_columns = _get_table_columns('clinical_notes')
        required_columns = {'visit_id', 'note_type', 'content', 'created_by'}
        if not required_columns.issubset(available_columns):
            missing = required_columns.difference(available_columns)
            logger.error(f"Clinical notes table missing required columns: {missing}")
            return jsonify({'success': False, 'error': 'Clinical notes storage is not configured correctly'}), 500

        insert_columns = ['visit_id', 'note_type', 'content', 'created_by']
        placeholders = ['%s', '%s', '%s', '%s']
        insert_values = [visit_id, note_type, content, request.current_user['id']]

        if 'icd10_codes' in available_columns and icd10_codes:
            insert_columns.append('icd10_codes')
            placeholders.append('%s')
            insert_values.append(json.dumps(icd10_codes))

        if 'medications_prescribed' in available_columns and medications_prescribed:
            insert_columns.append('medications_prescribed')
            placeholders.append('%s')
            insert_values.append(json.dumps(medications_prescribed))

        bool_follow_up = bool(follow_up_required)
        if 'follow_up_required' in available_columns:
            insert_columns.append('follow_up_required')
            placeholders.append('%s')
            insert_values.append(1 if bool_follow_up else 0)

        follow_up_date_value = None
        if follow_up_date:
            try:
                follow_up_date_value = datetime.strptime(str(follow_up_date)[:10], '%Y-%m-%d').date()
            except ValueError:
                logger.warning(f"Invalid follow_up_date supplied: {follow_up_date}")
                follow_up_date_value = None

        if 'follow_up_date' in available_columns and follow_up_date_value:
            insert_columns.append('follow_up_date')
            placeholders.append('%s')
            insert_values.append(follow_up_date_value)
        
        column_sql = ', '.join(insert_columns)
        placeholder_sql = ', '.join(placeholders)
        result = DatabaseManager.execute_query(
            f"INSERT INTO clinical_notes ({column_sql}) VALUES ({placeholder_sql})",
            tuple(insert_values)
        )
        
        if result:
            if note_type in specialist_note_types:
                specialist_key = SPECIALIST_NOTE_LOOKUP.get(note_type)
                if specialist_key:
                    user_role = str(request.current_user.get('role_name', '')).strip().lower().replace(' ', '_')
                    required_role = SPECIALIST_DEFINITIONS[specialist_key]['role']
                    allowed_specialist_roles = {required_role, 'administrator', 'doctor'}
                    if user_role in allowed_specialist_roles:
                        try:
                            completion_success = _mark_specialist_completed(
                                visit_id,
                                specialist_key,
                                user_id=request.current_user['id'],
                                notes=content,
                                follow_up_required=bool_follow_up,
                                follow_up_date=str(follow_up_date_value) if follow_up_date_value else str(follow_up_date) if follow_up_date else None,
                                record_note=False,
                            )
                            if not completion_success:
                                logger.warning(
                                    "Unable to mark specialist stage %s as complete for visit %s", specialist_key, visit_id
                                )
                        except Exception as specialist_err:
                            logger.error(
                                "Failed to update specialist completion for %s on visit %s: %s",
                                specialist_key,
                                visit_id,
                                specialist_err,
                            )
                    else:
                        logger.info(
                            "User role %s not permitted to close specialist stage %s", user_role, specialist_key
                        )

            return jsonify({
                'success': True,
                'message': 'Clinical note created successfully',
                'data': {
                    'patient_id': patient_id
                }
            }), 201
        else:
            return jsonify({'success': False, 'error': 'Failed to create clinical note'}), 500
        
    except Exception as e:
        logger.error(f"Create clinical note error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/icd10/search', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor', 'nurse'])
def search_icd10_codes():
    """Search ICD-10 codes with autocomplete"""
    try:
        query = request.args.get('q', '').strip()
        limit = int(request.args.get('limit', 20))
        
        if not query or len(query) < 2:
            return jsonify({
                'success': True,
                'data': []
            }), 200
        
        # Search by code or description
        search_query = """
        SELECT 
            code,
            description,
            is_common
        FROM icd10_codes
        WHERE 
            code LIKE %s 
            OR LOWER(description) LIKE %s
        ORDER BY 
            is_common DESC,
            CASE 
                WHEN code LIKE %s THEN 1
                WHEN LOWER(description) LIKE %s THEN 2
                ELSE 3
            END,
            code
        LIMIT %s
        """
        
        search_pattern = f"%{query.lower()}%"
        code_pattern = f"{query.upper()}%"
        
        results = DatabaseManager.execute_query(
            search_query,
            (code_pattern, search_pattern, code_pattern, search_pattern, limit),
            fetch=True
        )
        
        return jsonify({
            'success': True,
            'data': _to_jsonable(results) or []
        }), 200
        
    except Exception as e:
        logger.error(f"ICD-10 search error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


# ============================================================================
# ENHANCED MEDICATION MANAGEMENT
# ============================================================================

@app.route('/api/drug-database', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor', 'nurse'])
def get_drug_database():
    """Get available drugs from database"""
    try:
        search = request.args.get('search', '')
        limit = int(request.args.get('limit', 50))
        
        query = """
        SELECT id, drug_name, generic_name, drug_class, available_strengths, 
               available_forms, standard_dosages, contraindications, side_effects
        FROM drug_database
        WHERE is_active = TRUE
        """
        
        params = []
        if search:
            query += " AND (drug_name LIKE %s OR generic_name LIKE %s OR drug_class LIKE %s)"
            search_param = f"%{search}%"
            params.extend([search_param, search_param, search_param])
        
        query += " ORDER BY drug_name LIMIT %s"
        params.append(limit)
        
        drugs = DatabaseManager.execute_query(query, tuple(params), fetch=True)
        
        return jsonify({
            'success': True,
            'data': _to_jsonable(drugs) or []
        }), 200
        
    except Exception as e:
        logger.error(f"Get drug database error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/visits/<int:visit_id>/prescriptions', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor'])
def create_prescription(visit_id: int):
    """Create a prescription with enhanced tracking"""
    try:
        data = request.get_json() or {}
        
        required_fields = ['drug_id', 'dosage', 'frequency', 'duration']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return jsonify({
                'success': False, 
                'error': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        # Get patient_id and drug info
        visit_info = DatabaseManager.execute_query(
            "SELECT patient_id FROM patient_visits WHERE id = %s",
            (visit_id,),
            fetch=True
        )
        
        if not visit_info:
            return jsonify({'success': False, 'error': 'Visit not found'}), 404
            
        patient_id = visit_info[0]['patient_id']
        
        # Calculate start and end dates
        start_date = data.get('start_date', datetime.now().strftime('%Y-%m-%d'))
        
        # Parse duration to calculate end_date
        duration = data.get('duration', '')
        end_date = None
        
        if duration:
            try:
                # Simple duration parsing (e.g., "5 days", "2 weeks", "1 month")
                duration_lower = duration.lower()
                if 'day' in duration_lower:
                    days = int(re.findall(r'\d+', duration)[0])
                    end_date = (datetime.strptime(start_date, '%Y-%m-%d') + timedelta(days=days)).strftime('%Y-%m-%d')
                elif 'week' in duration_lower:
                    weeks = int(re.findall(r'\d+', duration)[0])
                    end_date = (datetime.strptime(start_date, '%Y-%m-%d') + timedelta(weeks=weeks)).strftime('%Y-%m-%d')
                elif 'month' in duration_lower:
                    months = int(re.findall(r'\d+', duration)[0])
                    end_date = (datetime.strptime(start_date, '%Y-%m-%d') + timedelta(days=months*30)).strftime('%Y-%m-%d')
            except:
                pass  # If parsing fails, leave end_date as None
        
        result = DatabaseManager.execute_query(
            """
            INSERT INTO prescriptions (
                visit_id, patient_id, drug_id, custom_drug_name, dosage, route, frequency, 
                duration, quantity_prescribed, instructions, start_date, end_date, prescribed_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                visit_id,
                patient_id,
                data.get('drug_id'),
                data.get('custom_drug_name'),
                data['dosage'],
                data.get('route', 'oral'),
                data['frequency'],
                data['duration'],
                data.get('quantity_prescribed'),
                data.get('instructions'),
                start_date,
                end_date,
                request.current_user['id']
            )
        )
        
        if result:
            return jsonify({
                'success': True,
                'message': 'Prescription created successfully'
            }), 201
        else:
            return jsonify({'success': False, 'error': 'Failed to create prescription'}), 500
        
    except Exception as e:
        logger.error(f"Create prescription error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/visits/<int:visit_id>/prescriptions', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor', 'nurse'])
def get_visit_prescriptions(visit_id: int):
    """Get prescriptions for a visit"""
    try:
        prescriptions = DatabaseManager.execute_query(
            """
            SELECT p.*, d.drug_name, d.generic_name, d.drug_class,
                   u.first_name, u.last_name
            FROM prescriptions p
            LEFT JOIN drug_database d ON p.drug_id = d.id
            JOIN users u ON p.prescribed_by = u.id
            WHERE p.visit_id = %s
            ORDER BY p.created_at DESC
            """,
            (visit_id,),
            fetch=True
        )
        
        return jsonify({
            'success': True,
            'data': _to_jsonable(prescriptions) or []
        }), 200
        
    except Exception as e:
        logger.error(f"Get visit prescriptions error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

# ============================================================================
# SMART SUGGESTIONS AND AI FEATURES
# ============================================================================

@app.route('/api/smart-suggestions', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor', 'nurse'])
def get_smart_suggestions():
    """Get AI-powered clinical suggestions"""
    try:
        data = request.get_json() or {}
        
        input_text = data.get('input_text', '').lower()
        suggestion_type = data.get('suggestion_type', 'all')  # 'icd10', 'medication', 'investigation', 'all'
        patient_context = data.get('patient_context', {})
        
        suggestions = []
        
        # ICD-10 Code Suggestions
        if suggestion_type in ['icd10', 'all']:
            icd10_suggestions = []
            
            # Common symptom to ICD-10 mappings
            if any(word in input_text for word in ['hypertension', 'high blood pressure', 'bp']):
                icd10_suggestions.append({
                    'type': 'icd10',
                    'code': 'I10',
                    'text': 'Essential hypertension',
                    'confidence': 0.95
                })
            
            if any(word in input_text for word in ['diabetes', 'sugar', 'dm']):
                icd10_suggestions.append({
                    'type': 'icd10', 
                    'code': 'E11.9',
                    'text': 'Type 2 diabetes mellitus without complications',
                    'confidence': 0.90
                })
            
            if any(word in input_text for word in ['headache', 'cephalgia']):
                icd10_suggestions.append({
                    'type': 'icd10',
                    'code': 'R51',
                    'text': 'Headache',
                    'confidence': 0.85
                })
            
            if any(word in input_text for word in ['chest pain', 'angina']):
                icd10_suggestions.append({
                    'type': 'icd10',
                    'code': 'R07.9',
                    'text': 'Chest pain, unspecified',
                    'confidence': 0.80
                })
            
            if any(word in input_text for word in ['fever', 'pyrexia']):
                icd10_suggestions.append({
                    'type': 'icd10',
                    'code': 'R50.9',
                    'text': 'Fever, unspecified',
                    'confidence': 0.85
                })
            
            suggestions.extend(icd10_suggestions)
        
        # Medication Suggestions
        if suggestion_type in ['medication', 'all']:
            medication_suggestions = []
            
            if any(word in input_text for word in ['pain', 'analgesic', 'ache']):
                medication_suggestions.append({
                    'type': 'medication',
                    'text': 'Paracetamol 500mg TDS for 5 days',
                    'confidence': 0.85
                })
                medication_suggestions.append({
                    'type': 'medication',
                    'text': 'Ibuprofen 400mg TDS for 3 days',
                    'confidence': 0.80
                })
            
            if any(word in input_text for word in ['infection', 'antibiotic', 'bacterial']):
                medication_suggestions.append({
                    'type': 'medication',
                    'text': 'Amoxicillin 500mg TDS for 7 days',
                    'confidence': 0.85
                })
            
            if any(word in input_text for word in ['hypertension', 'blood pressure']):
                medication_suggestions.append({
                    'type': 'medication',
                    'text': 'Amlodipine 5mg OD ongoing',
                    'confidence': 0.90
                })
                medication_suggestions.append({
                    'type': 'medication',
                    'text': 'Enalapril 10mg BD ongoing',
                    'confidence': 0.85
                })
            
            if any(word in input_text for word in ['diabetes', 'sugar']):
                medication_suggestions.append({
                    'type': 'medication',
                    'text': 'Metformin 500mg BD with meals ongoing',
                    'confidence': 0.90
                })
            
            suggestions.extend(medication_suggestions)
        
        # Investigation Suggestions
        if suggestion_type in ['investigation', 'all']:
            investigation_suggestions = []
            
            if any(word in input_text for word in ['chest', 'respiratory', 'cough']):
                investigation_suggestions.append({
                    'type': 'investigation',
                    'text': 'Chest X-Ray (CXR)',
                    'confidence': 0.80
                })
            
            if any(word in input_text for word in ['diabetes', 'sugar']):
                investigation_suggestions.append({
                    'type': 'investigation', 
                    'text': 'HbA1c',
                    'confidence': 0.90
                })
                investigation_suggestions.append({
                    'type': 'investigation',
                    'text': 'Fasting Blood Glucose',
                    'confidence': 0.85
                })
            
            if any(word in input_text for word in ['heart', 'cardiac', 'chest pain']):
                investigation_suggestions.append({
                    'type': 'investigation',
                    'text': 'ECG (Electrocardiogram)',
                    'confidence': 0.85
                })
            
            if any(word in input_text for word in ['blood', 'anemia', 'fatigue']):
                investigation_suggestions.append({
                    'type': 'investigation',
                    'text': 'Full Blood Count (FBC)',
                    'confidence': 0.80
                })
            
            if any(word in input_text for word in ['kidney', 'renal', 'creatinine']):
                investigation_suggestions.append({
                    'type': 'investigation',
                    'text': 'Urea & Electrolytes (U&E)',
                    'confidence': 0.85
                })
            
            suggestions.extend(investigation_suggestions)
        
        # Log the suggestion request for learning
        try:
            allowed_types = {"icd10", "medication", "investigation", "template"}
            log_type = suggestion_type if suggestion_type in allowed_types else "template"
            suggestion_payload = json.dumps(suggestions)
            patient_payload = json.dumps(patient_context) if patient_context else None
            max_confidence = 0.0
            if suggestions:
                max_confidence = max(float(s.get('confidence', 0.0)) for s in suggestions)

            proc_result = DatabaseManager.call_procedure(
                'sp_log_smart_suggestion',
                [
                    log_type,
                    input_text,
                    suggestion_payload,
                    round(max_confidence, 3),
                    'heuristic-v1',
                    request.current_user['id'],
                    patient_payload,
                    0
                ],
                fetch=True
            )

            logged_id = None
            if proc_result:
                result_args = proc_result.get('args') or []
                if result_args:
                    logged_id = result_args[-1]
                if not logged_id:
                    result_sets = proc_result.get('result_sets') or []
                    if result_sets and result_sets[0]:
                        logged_id = result_sets[0][0].get('new_id')
            if logged_id:
                logger.info(f"Smart suggestion logged with id {logged_id}")
        except Exception as log_error:
            logger.warning(f"Failed to log smart suggestion via stored procedure: {log_error}")
        
        return jsonify({
            'success': True,
            'suggestions': suggestions
        }), 200
        
    except Exception as e:
        logger.error(f"Smart suggestions error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/smart-suggestions/<int:suggestion_id>/feedback', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor', 'nurse'])
def provide_suggestion_feedback(suggestion_id: int):
    """Provide feedback on AI suggestions for learning"""
    try:
        data = request.get_json() or {}
        
        was_accepted = data.get('was_accepted', False)
        feedback_score = data.get('feedback_score')  # 1-5 rating
        feedback_notes = data.get('feedback_notes', '')
        
        proc_result = DatabaseManager.call_procedure(
            'sp_record_suggestion_feedback',
            [
                suggestion_id,
                int(was_accepted) if was_accepted is not None else None,
                feedback_score,
                feedback_notes
            ],
            fetch=True
        )

        affected = 0
        if proc_result:
            result_sets = proc_result.get('result_sets') or []
            if result_sets and result_sets[0]:
                affected = result_sets[0][0].get('affected_rows', 0)
        
        if affected:
            return jsonify({
                'success': True,
                'message': 'Feedback recorded successfully'
            }), 200
        else:
            return jsonify({'success': False, 'error': 'Suggestion not found'}), 404
        
    except Exception as e:
        logger.error(f"Suggestion feedback error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

# ============================================================================
# ENHANCED WORKFLOW STATUS TRACKING
# ============================================================================


@app.route('/api/workflow/specialists/catalog', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'clerk', 'social_work', 'social_worker'] + list(SPECIALIST_ROLE_NAMES))
def get_specialist_catalog():
    """Expose the configured specialist workflow metadata for frontend consumption."""
    try:
        catalog: List[Dict[str, Any]] = []
        ordered = list(SPECIALIST_STAGE_ORDER)
        for specialist_key in ordered:
            definition = SPECIALIST_DEFINITIONS.get(specialist_key)
            if not definition:
                continue
            catalog.append({
                'specialist_type': specialist_key,
                'label': definition['label'],
                'role': definition['role'],
                'note_type': definition['note_type'],
            })

        for specialist_key, definition in SPECIALIST_DEFINITIONS.items():
            if specialist_key in ordered:
                continue
            catalog.append({
                'specialist_type': specialist_key,
                'label': definition['label'],
                'role': definition['role'],
                'note_type': definition['note_type'],
            })

        return jsonify({'success': True, 'data': catalog}), 200
    except Exception as err:
        logger.error(f"Failed to list specialist catalog: {err}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/visits/<int:visit_id>/workflow/specialists', methods=['PUT', 'PATCH'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'clerk'] + list(SPECIALIST_ROLE_NAMES))
def configure_visit_specialists(visit_id: int):
    """Update the specialist stages required for a visit."""
    try:
        visit_exists = DatabaseManager.execute_query(
            "SELECT id FROM patient_visits WHERE id = %s",
            (visit_id,),
            fetch=True,
        )
        if not visit_exists:
            return jsonify({'success': False, 'error': 'Visit not found'}), 404

        data = request.get_json(silent=True) or {}

        requested_specialists: Set[str] = set()
        selection_fields = [
            data.get('specialists'),
            data.get('required_specialists'),
            data.get('specialist_selection'),
        ]
        for field in selection_fields:
            if field:
                requested_specialists.update(_parse_specialist_selection(field))

        for specialist_key in SPECIALIST_DEFINITIONS.keys():
            for suffix in ('', '_required', '_needed', '_selected'):
                flag_value = data.get(f"{specialist_key}{suffix}")
                if flag_value is None:
                    continue
                include = flag_value in TRUTHY_FLAG_VALUES
                if isinstance(flag_value, str):
                    stripped = flag_value.strip()
                    include = stripped in TRUTHY_FLAG_VALUES or stripped.lower() in {'true', 'yes', 'on'}
                if include:
                    requested_specialists.add(specialist_key)

        _set_visit_specialists(visit_id, requested_specialists, user_id=request.current_user['id'])

        specialist_rows = _get_visit_specialists(visit_id)
        configured = [row for row in specialist_rows if row.get('required')]

        def _ordering_key(spec_key: str) -> tuple:
            base_index = SPECIALIST_STAGE_ORDER.index(spec_key) if spec_key in SPECIALIST_STAGE_ORDER else len(SPECIALIST_STAGE_ORDER)
            return (base_index, spec_key)

        sorted_keys = sorted({row['specialist_type'] for row in configured}, key=_ordering_key)

        return jsonify({
            'success': True,
            'data': {
                'visit_id': visit_id,
                'specialist_stages': sorted_keys,
            }
        }), 200
    except Exception as err:
        logger.error(f"Failed to configure visit specialists for visit {visit_id}: {err}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/visits/<int:visit_id>/workflow/status', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'clerk', 'social_work', 'social_worker'] + list(SPECIALIST_ROLE_NAMES))
def get_visit_workflow_status(visit_id: int):
    """Return high-level workflow status for a visit"""
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

        # Specialist stages: check visit_specialists entries flagged as required
        specialist_rows = _get_visit_specialists(visit_id)
        required_specialists = {
            row['specialist_type']: row
            for row in specialist_rows
            if row.get('required') and row.get('specialist_type') in SPECIALIST_DEFINITIONS
        }

        specialist_stages: List[Dict[str, Any]] = []
        seen_specialists: Set[str] = set()
        for specialist_key in SPECIALIST_STAGE_ORDER:
            if specialist_key not in required_specialists:
                continue
            row = required_specialists[specialist_key]
            definition = SPECIALIST_DEFINITIONS[specialist_key]
            specialist_stages.append({
                'stage': definition['label'],
                'specialist_type': specialist_key,
                'role': definition['role'],
                'note_type': definition['note_type'],
                'required': True,
                'is_specialist': True,
                'completed': bool(row.get('completed_at')),
                'completed_at': _to_jsonable(row.get('completed_at')) if row.get('completed_at') else None,
                'completed_by': row.get('completed_by'),
                'notes': row.get('notes'),
            })
            seen_specialists.add(specialist_key)

        for specialist_key, row in required_specialists.items():
            if specialist_key in seen_specialists:
                continue
            definition = SPECIALIST_DEFINITIONS[specialist_key]
            specialist_stages.append({
                'stage': definition['label'],
                'specialist_type': specialist_key,
                'role': definition['role'],
                'note_type': definition['note_type'],
                'required': True,
                'is_specialist': True,
                'completed': bool(row.get('completed_at')),
                'completed_at': _to_jsonable(row.get('completed_at')) if row.get('completed_at') else None,
                'completed_by': row.get('completed_by'),
                'notes': row.get('notes'),
            })

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
        ]

        workflow.extend(specialist_stages)

        workflow.extend([
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
        ])

        return jsonify({'success': True, 'data': workflow}), 200
    except Exception as e:
        logger.error(f"Get workflow status error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/specialists/assignments', methods=['GET'])
@token_required
@role_required(list(SPECIALIST_ROLE_NAMES))
def get_my_specialist_assignments():
    """Return visits queue for the logged-in specialist."""
    try:
        normalized_role = str(request.current_user.get('role_name', '')).strip().lower().replace(' ', '_')
        specialist_key = None
        for key, definition in SPECIALIST_DEFINITIONS.items():
            if definition['role'] == normalized_role:
                specialist_key = key
                break

        if not specialist_key:
            empty_payload = {'assignments': [], 'summary': {'total': 0, 'pending': 0, 'completed': 0}}
            return jsonify({'success': True, 'data': empty_payload}), 200

        status_filter = (request.args.get('status') or 'pending').strip().lower()
        if status_filter not in {'pending', 'completed', 'all'}:
            status_filter = 'pending'

        try:
            limit = int(request.args.get('limit', 50))
        except (TypeError, ValueError):
            limit = 50
        limit = max(1, min(limit, 200))

        params: List[Any] = [specialist_key]
        where_clauses = ["vs.required = 1", "vs.specialist_type = %s"]

        patient_id_value = request.args.get('patient_id')
        if patient_id_value:
            where_clauses.append("pv.patient_id = %s")
            params.append(patient_id_value)

        if status_filter == 'pending':
            where_clauses.append("vs.completed_at IS NULL")
        elif status_filter == 'completed':
            where_clauses.append("vs.completed_at IS NOT NULL")

        query = f"""
        SELECT
            vs.visit_id,
            vs.specialist_type,
            vs.required,
            vs.completed_at,
            vs.created_at,
            vs.updated_at,
            vs.notes,
            pv.patient_id,
            pv.visit_date,
            pv.visit_time,
            pv.location,
            pv.route_id,
            pv.current_stage_id,
            p.first_name,
            p.last_name,
            p.phone_number,
            p.medical_aid_number,
            p.id_number
        FROM visit_specialists vs
        JOIN patient_visits pv ON pv.id = vs.visit_id
        JOIN patients p ON p.id = pv.patient_id
        WHERE {' AND '.join(where_clauses)}
        ORDER BY
            CASE WHEN vs.completed_at IS NULL THEN 0 ELSE 1 END,
            vs.created_at DESC
        LIMIT %s
        """
        params.append(limit)

        rows = DatabaseManager.execute_query(query, tuple(params), fetch=True) or []
        payload = []
        for row in rows:
            patient_name = (
                f"{(row.get('first_name') or '').strip()} {(row.get('last_name') or '').strip()}".strip()
            ) or None
            payload.append({
                'visit_id': row.get('visit_id'),
                'patient_id': row.get('patient_id'),
                'specialist_type': row.get('specialist_type'),
                'required': bool(row.get('required')),
                'completed_at': _to_jsonable(row.get('completed_at')),
                'created_at': _to_jsonable(row.get('created_at')),
                'updated_at': _to_jsonable(row.get('updated_at')),
                'notes': row.get('notes'),
                'visit_date': _to_jsonable(row.get('visit_date')),
                'visit_time': _to_jsonable(row.get('visit_time')),
                'location': row.get('location'),
                'route_id': row.get('route_id'),
                'current_stage_id': row.get('current_stage_id'),
                'patient_name': patient_name,
                'phone_number': row.get('phone_number'),
                'medical_aid_number': row.get('medical_aid_number'),
                'id_number': row.get('id_number'),
                'status': 'completed' if row.get('completed_at') else 'pending',
            })

        summary = {
            'total': len(payload),
            'pending': sum(1 for item in payload if item['status'] == 'pending'),
            'completed': sum(1 for item in payload if item['status'] == 'completed'),
        }

        return jsonify({'success': True, 'data': {'assignments': payload, 'summary': summary}}), 200
    except Exception as err:
        logger.error(f"Failed to list specialist assignments: {err}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

# ============================================================================
# REFERRAL MANAGEMENT
# ============================================================================

@app.route('/api/patients/<int:patient_id>/referrals', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'clerk', 'social_work', 'social_worker'] + list(SPECIALIST_ROLE_NAMES))
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
        return jsonify({'success': True, 'data': _to_jsonable(rows) or []}), 200
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
        return jsonify({'success': True, 'data': _to_jsonable(row[0]) if row else None}), 201
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
        return jsonify({'success': True, 'data': _to_jsonable(row[0]) if row else None}), 200
    except Exception as e:
        logger.error(f"Update referral error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


# ============================================================================
# ROUTE PLANNING ENDPOINTS
# ============================================================================
@app.route('/api/routes', methods=['GET'])
@token_required
@role_required(['administrator', 'doctor', 'nurse', 'clerk', 'social_work', 'social_worker'])
def get_routes():
    """Get routes list with filtering - SIMPLIFIED VERSION"""
    try:
        province = request.args.get('province', '')
        date_from = request.args.get('date_from', '')
        date_to = request.args.get('date_to', '')
        
        logger.info(f"Fetching routes with filters - province: {province}, date_from: {date_from}, date_to: {date_to}")
        
        # SIMPLIFIED query - only use the routes table to avoid JOIN issues
        query = """
        SELECT 
            id,
            route_name,
            route_name AS name,
            description,
            province,
            route_type,
            start_date,
            start_date AS scheduled_date,
            end_date,
            max_appointments_per_day,
            max_appointments_per_day AS max_appointments,
            created_by,
            is_active,
            CASE 
                WHEN route_type = 'Police Stations' THEN 'police_station'
                WHEN route_type = 'Schools' THEN 'school'
                WHEN route_type = 'Community Centers' THEN 'community_center'
                ELSE 'mixed'
            END AS location_type,
            province AS location,
            '08:00' AS start_time,
            '17:00' AS end_time,
            CASE 
                WHEN is_active = TRUE AND CURDATE() BETWEEN start_date AND end_date THEN 'active'
                WHEN is_active = TRUE AND CURDATE() < start_date THEN 'published'
                WHEN CURDATE() > end_date THEN 'completed'
                WHEN is_active = FALSE THEN 'draft'
                ELSE 'draft'
            END AS status,
            0 AS location_count,
            0 AS total_appointments,
            0 AS booked_appointments
        FROM routes
        WHERE is_active = TRUE
        """
        
        params = []
        
        if province:
            query += " AND province = %s"
            params.append(province)
        
        if date_from:
            query += " AND start_date >= %s"
            params.append(date_from)
        
        if date_to:
            query += " AND end_date <= %s"
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
                        query += f" AND province IN ({province_placeholders})"
                        params.extend(provinces)
                except Exception as e:
                    logger.warning(f"Error parsing geographic restrictions: {e}")
        
        query += " ORDER BY start_date DESC, id DESC"
        
        logger.info(f"Executing simplified query with params: {params}")
        routes = DatabaseManager.execute_query(query, tuple(params), fetch=True)
        
        if routes is None:
            logger.error("Database query returned None")
            return jsonify({'success': False, 'error': 'Database query failed'}), 500
        
        # Transform the data for frontend compatibility
        transformed_routes = []
        for route in routes:
            transformed_route = {
                'id': route['id'],
                'name': route['name'],
                'route_name': route['route_name'],
                'description': route['description'],
                'province': route['province'],
                'route_type': route['route_type'],
                'location_type': route['location_type'],
                'location': route['location'],
                'scheduled_date': route['scheduled_date'].isoformat() if route['scheduled_date'] else None,
                'start_date': route['start_date'].isoformat() if route['start_date'] else None,
                'end_date': route['end_date'].isoformat() if route['end_date'] else None,
                'start_time': route['start_time'],
                'end_time': route['end_time'],
                'max_appointments': route['max_appointments'],
                'max_appointments_per_day': route['max_appointments_per_day'],
                'status': route['status'],
                'created_by': route['created_by'],
                'is_active': route['is_active'],
                'location_count': route['location_count'],
                'total_appointments': route['total_appointments'],
                'booked_appointments': route['booked_appointments'],
                'locations': []  # Empty array for now
            }
            transformed_routes.append(transformed_route)
        
        logger.info(f"Returning {len(transformed_routes)} routes")
        
        return jsonify({
            'success': True,
            'routes': transformed_routes
        }), 200
        
    except Exception as e:
        logger.error(f"Get routes error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': f'Internal server error: {str(e)}'}), 500
    
@app.route('/api/routes', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor'])  # NOTE: Nurses are excluded!
def create_route():
    """Create a new route with location schedules and appointment slots."""
    try:
        data = request.get_json(silent=True) or {}
        logger.info(f"Creating route with data: {data}")

        # Extract core fields
        route_name = str(data.get('route_name') or data.get('name') or '').strip()
        description = str(data.get('description') or '').strip() or None
        start_date_raw = data.get('start_date') or data.get('scheduled_date')
        end_date_raw = data.get('end_date')
        province = str(data.get('province') or '').strip()
        max_per_day_input = int(data.get('max_appointments_per_day') or data.get('max_appointments') or 0)

        if not route_name:
            return jsonify({'success': False, 'error': 'route_name is required'}), 400
        if not start_date_raw or not end_date_raw:
            return jsonify({'success': False, 'error': 'start_date and end_date are required'}), 400
        if not province:
            return jsonify({'success': False, 'error': 'province is required'}), 400

        try:
            start_date_obj = datetime.fromisoformat(str(start_date_raw).replace('Z', '+00:00')).date()
            end_date_obj = datetime.fromisoformat(str(end_date_raw).replace('Z', '+00:00')).date()
        except (ValueError, TypeError) as exc:
            logger.warning(f"Invalid date format supplied: {exc}")
            return jsonify({'success': False, 'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

        if start_date_obj > end_date_obj:
            return jsonify({'success': False, 'error': 'Start date cannot be after end date'}), 400

        if start_date_obj < date.today():
            logger.warning("Attempted to create route starting in the past")
            return jsonify({'success': False, 'error': 'Start date cannot be in the past'}), 400

        locations_payload = data.get('locations') or []
        if not isinstance(locations_payload, list) or len(locations_payload) == 0:
            return jsonify({'success': False, 'error': 'At least one location is required'}), 400

        raw_slots = data.get('time_slots') or data.get('timeSlots') or []
        sanitized_slots = []
        for slot in raw_slots:
            start_token = str(slot.get('start_time') or slot.get('startTime') or '').strip()
            end_token = str(slot.get('end_time') or slot.get('endTime') or '').strip()
            if not start_token or not end_token:
                continue
            try:
                start_time_obj = datetime.strptime(start_token, '%H:%M').time()
                end_time_obj = datetime.strptime(end_token, '%H:%M').time()
                start_dt = datetime.combine(date.today(), start_time_obj)
                end_dt = datetime.combine(date.today(), end_time_obj)
                if end_dt <= start_dt:
                    raise ValueError('End time must be after start time')
                max_appts = int(slot.get('max_appointments') or slot.get('maxAppointments') or 0)
                duration_minutes = max(int((end_dt - start_dt).total_seconds() // 60), 5)
            except Exception as exc:
                logger.warning(f"Skipping invalid time slot {slot}: {exc}")
                continue

            sanitized_slots.append({
                'start_time': start_time_obj,
                'end_time': end_time_obj,
                'max_appointments': max_appts,
                'duration_minutes': duration_minutes,
            })

        if not sanitized_slots:
            # Provide sensible defaults if UI omitted slots
            fallback_slots = [
                ('08:00', '08:30', 10),
                ('08:30', '09:00', 10),
                ('09:00', '09:30', 10),
                ('09:30', '10:00', 10),
            ]
            for start_token, end_token, capacity in fallback_slots:
                start_time_obj = datetime.strptime(start_token, '%H:%M').time()
                end_time_obj = datetime.strptime(end_token, '%H:%M').time()
                duration_minutes = int((datetime.combine(date.today(), end_time_obj) - datetime.combine(date.today(), start_time_obj)).total_seconds() // 60)
                sanitized_slots.append({
                    'start_time': start_time_obj,
                    'end_time': end_time_obj,
                    'max_appointments': capacity,
                    'duration_minutes': duration_minutes,
                })

        sanitized_slots.sort(key=lambda item: item['start_time'])
        per_location_capacity = sum(max(0, slot['max_appointments']) for slot in sanitized_slots)
        per_location_capacity = max(per_location_capacity, 1)
        aggregated_start_time = sanitized_slots[0]['start_time']
        aggregated_end_time = sanitized_slots[-1]['end_time']
        default_duration = sanitized_slots[0]['duration_minutes']

        computed_max_per_day = per_location_capacity * max(1, len(locations_payload))
        max_appointments_per_day = max(max_per_day_input, computed_max_per_day)

        route_type = data.get('route_type') or 'Mixed'
        location_type_hint = str(data.get('location_type') or '').strip().lower()
        if route_type == 'Mixed':
            if location_type_hint == 'police_station':
                route_type = 'Police Stations'
            elif location_type_hint == 'school':
                route_type = 'Schools'
            elif location_type_hint == 'community_center':
                route_type = 'Community Centers'

        user_id = request.current_user.get('id')

        connection = DatabaseManager.get_connection()
        if not connection:
            return jsonify({'success': False, 'error': 'Database connection failed'}), 500

        route_locations_response = []

        def resolve_location_type_id(db_cursor, location_type_value: str):
            lookup_map = {
                'police_station': 'Police Station',
                'police stations': 'Police Station',
                'school': 'School',
                'schools': 'School',
                'community_center': 'Community Center',
                'community centre': 'Community Center',
                'community centers': 'Community Center',
            }
            normalized = str(location_type_value or '').strip().lower()
            candidate = lookup_map.get(normalized, normalized.title())
            db_cursor.execute(
                "SELECT id, type_name FROM location_types WHERE LOWER(type_name) = %s LIMIT 1",
                (candidate.lower(),)
            )
            match = db_cursor.fetchone()
            if match:
                return match['id'], match['type_name']

            db_cursor.execute("SELECT id, type_name FROM location_types ORDER BY id ASC LIMIT 1")
            fallback = db_cursor.fetchone()
            return (fallback['id'], fallback['type_name']) if fallback else (None, None)

        try:
            cursor = connection.cursor(dictionary=True)

            insert_route_sql = """
                INSERT INTO routes (
                    route_name, description, start_date, end_date, province,
                    route_type, max_appointments_per_day, created_by, is_active
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, TRUE)
            """

            cursor.execute(
                insert_route_sql,
                (
                    route_name,
                    description,
                    start_date_obj,
                    end_date_obj,
                    province,
                    route_type,
                    max_appointments_per_day,
                    user_id,
                ),
            )

            route_id = cursor.lastrowid
            logger.info(f"Route inserted with id {route_id}")

            insert_route_location_sql = """
                INSERT INTO route_locations (
                    route_id, location_id, visit_date, start_time, end_time,
                    max_appointments, appointment_duration, notes
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """

            for loc_payload in locations_payload:
                location_name = str(loc_payload.get('name') or '').strip()
                if not location_name:
                    logger.warning(f"Skipping location without a name: {loc_payload}")
                    continue

                loc_province = str(loc_payload.get('province') or province)
                loc_city = str(loc_payload.get('city') or loc_payload.get('address') or loc_province)
                loc_address = str(loc_payload.get('address') or loc_city)
                loc_capacity = int(loc_payload.get('capacity') or per_location_capacity)
                contact_person = loc_payload.get('contact_person') or loc_payload.get('contactPerson')
                contact_phone = loc_payload.get('contact_phone') or loc_payload.get('contactPhone')
                loc_type_key = loc_payload.get('type') or location_type_hint or 'community_center'

                cursor.execute(
                    "SELECT id FROM locations WHERE location_name = %s AND province = %s LIMIT 1",
                    (location_name, loc_province),
                )
                existing_location = cursor.fetchone()

                if existing_location:
                    location_id = existing_location['id']
                else:
                    location_type_id, canonical_type_name = resolve_location_type_id(cursor, loc_type_key)
                    if not location_type_id:
                        raise ValueError('Unable to resolve location_type_id')

                    coordinates = loc_payload.get('coordinates') or {}
                    lat = float(coordinates.get('lat') or 0)
                    lng = float(coordinates.get('lng') or 0)
                    wkt_point = f"POINT({lng} {lat})"

                    insert_location_sql = """
                        INSERT INTO locations (
                            location_name, location_type_id, province, city, address,
                            gps_coordinates, contact_person, contact_phone, is_active
                        ) VALUES (%s, %s, %s, %s, %s, ST_GeomFromText(%s), %s, %s, TRUE)
                    """

                    cursor.execute(
                        insert_location_sql,
                        (
                            location_name,
                            location_type_id,
                            loc_province,
                            loc_city,
                            loc_address,
                            wkt_point,
                            contact_person,
                            contact_phone,
                        ),
                    )

                    location_id = cursor.lastrowid
                    logger.info(f"Created new location {location_id} for {location_name}")

                current_date = start_date_obj
                while current_date <= end_date_obj:
                    cursor.execute(
                        insert_route_location_sql,
                        (
                            route_id,
                            location_id,
                            current_date,
                            aggregated_start_time.strftime('%H:%M:%S'),
                            aggregated_end_time.strftime('%H:%M:%S'),
                            max(loc_capacity, per_location_capacity),
                            default_duration,
                            description,
                        ),
                    )

                    route_location_id = cursor.lastrowid
                    logger.info(
                        f"Route location {route_location_id} created for route {route_id} on {current_date}"
                    )

                    # Generate appointment slots using stored procedure
                    try:
                        # Call stored procedure to generate slots
                        slot_count_result = cursor.callproc('sp_generate_appointment_slots', [route_location_id, 0])
                        slot_count = slot_count_result[1] if len(slot_count_result) > 1 else 0
                        
                        logger.info(f"Stored procedure generated {slot_count} appointment slots for route_location {route_location_id}")
                    except Exception as slot_err:
                        logger.warning(
                            f"Failed to generate appointment slots for route_location {route_location_id}: {slot_err}"
                        )

                    route_locations_response.append({
                        'route_location_id': route_location_id,
                        'location_id': location_id,
                        'name': location_name,
                        'type': str(loc_type_key or ''),
                        'province': loc_province,
                        'city': loc_city,
                        'address': loc_address,
                        'visit_date': current_date.isoformat(),
                        'start_time': aggregated_start_time.strftime('%H:%M'),
                        'end_time': aggregated_end_time.strftime('%H:%M'),
                        'max_appointments': max(loc_capacity, per_location_capacity),
                        'appointment_duration': default_duration,
                        'contact_person': contact_person,
                        'contact_phone': contact_phone,
                    })

                    current_date += timedelta(days=1)

            connection.commit()

            cursor.execute(
                """
                SELECT 
                    id, route_name AS name, route_name, description, province,
                    start_date AS scheduled_date, start_date, end_date,
                    route_type, max_appointments_per_day AS max_appointments,
                    max_appointments_per_day,
                    CASE 
                        WHEN is_active = TRUE AND CURDATE() BETWEEN start_date AND end_date THEN 'active'
                        WHEN is_active = TRUE AND CURDATE() < start_date THEN 'published'
                        WHEN CURDATE() > end_date THEN 'completed'
                        WHEN is_active = FALSE THEN 'draft'
                        ELSE 'draft'
                    END AS status
                FROM routes
                WHERE id = %s
                """,
                (route_id,),
            )
            route_row = cursor.fetchone() or {}

            for date_field in ('scheduled_date', 'start_date', 'end_date'):
                if route_row.get(date_field):
                    route_row[date_field] = route_row[date_field].isoformat()

            response_time_slots = [
                {
                    'start_time': slot['start_time'].strftime('%H:%M'),
                    'end_time': slot['end_time'].strftime('%H:%M'),
                    'max_appointments': slot['max_appointments'],
                    'appointment_duration': slot['duration_minutes'],
                }
                for slot in sanitized_slots
            ]

            logger.info(f"Route {route_id} created with {len(route_locations_response)} location entries")

            return (
                jsonify(
                    {
                        'success': True,
                        'data': {
                            **route_row,
                            'locations': route_locations_response,
                            'time_slots': response_time_slots,
                        },
                        'message': 'Route created successfully',
                    }
                ),
                201,
            )

        except Exception as exc:
            connection.rollback()
            logger.error(f"Create route failed: {exc}", exc_info=True)
            return jsonify({'success': False, 'error': 'Failed to create route'}), 500
        finally:
            try:
                if cursor:
                    cursor.close()
            except Exception:
                pass
            connection.close()

    except Exception as e:
        logger.error(f"Create route error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': f'Internal server error: {str(e)}'}), 500
    

@app.route('/api/routes/<int:route_id>', methods=['PUT'])
@token_required
@role_required(['administrator', 'doctor'])  # NOTE: Nurses are excluded here too!
def update_route(route_id: int):
    """Update an existing route's core fields - IMPROVED VERSION"""
    try:
        data = request.get_json() or {}
        logger.info(f"Updating route {route_id} with data: {data}")

        # Build dynamic update with proper field mapping
        sets = []
        params = []
        
        # Map frontend fields to database fields
        if 'name' in data:
            sets.append('route_name = %s')
            params.append(str(data['name']).strip())
        elif 'route_name' in data:
            sets.append('route_name = %s')
            params.append(str(data['route_name']).strip())
            
        if 'description' in data:
            sets.append('description = %s')
            params.append(str(data['description']).strip() or None)
            
        if 'start_date' in data:
            sets.append('start_date = %s')
            params.append(data['start_date'])
        elif 'scheduled_date' in data:
            sets.append('start_date = %s')
            params.append(data['scheduled_date'])
            
        if 'end_date' in data:
            sets.append('end_date = %s')
            params.append(data['end_date'])
            
        if 'province' in data:
            sets.append('province = %s')
            params.append(str(data['province']).strip())
            
        if 'route_type' in data:
            sets.append('route_type = %s')
            params.append(str(data['route_type']).strip())
            
        if 'max_appointments' in data:
            sets.append('max_appointments_per_day = %s')
            params.append(int(data['max_appointments']))
        elif 'max_appointments_per_day' in data:
            sets.append('max_appointments_per_day = %s')
            params.append(int(data['max_appointments_per_day']))

        if not sets:
            return jsonify({'success': False, 'error': 'No updatable fields provided'}), 400

        params.append(route_id)

        update_sql = f"UPDATE routes SET {', '.join(sets)} WHERE id = %s"
        logger.info(f"Executing update: {update_sql} with params: {params}")
        
        result = DatabaseManager.execute_query(update_sql, tuple(params), fetch=False)
        if result is None:
            return jsonify({'success': False, 'error': 'Failed to update route'}), 500

        # Return updated route data
        updated_route = DatabaseManager.execute_query(
            """
            SELECT 
                id, 
                route_name AS name, 
                route_name,
                description, 
                province, 
                start_date AS scheduled_date,
                start_date,
                end_date,
                route_type, 
                max_appointments_per_day AS max_appointments,
                max_appointments_per_day,
                CASE 
                    WHEN is_active = TRUE AND CURDATE() BETWEEN start_date AND end_date THEN 'active'
                    WHEN is_active = TRUE AND CURDATE() < start_date THEN 'published'
                    WHEN CURDATE() > end_date THEN 'completed'
                    WHEN is_active = FALSE THEN 'draft'
                    ELSE 'draft'
                END AS status
            FROM routes 
            WHERE id = %s
            """,
            (route_id,),
            fetch=True,
        )
        
        route_data = updated_route[0] if updated_route else {'id': route_id}
        
        # Convert dates to strings
        if route_data.get('scheduled_date'):
            route_data['scheduled_date'] = route_data['scheduled_date'].isoformat()
        if route_data.get('start_date'):
            route_data['start_date'] = route_data['start_date'].isoformat()
        if route_data.get('end_date'):
            route_data['end_date'] = route_data['end_date'].isoformat()
        
        logger.info(f"Route {route_id} updated successfully")
        return jsonify({'success': True, 'data': route_data, 'message': 'Route updated successfully'}), 200
        
    except Exception as e:
        logger.error(f"Update route error: {e}", exc_info=True)
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
        location_name = request.args.get('location_name', '')
        city = request.args.get('city', '')
        
        query = """
        SELECT 
            pa.id,
            pa.appointment_time,
            COALESCE(pa.appointment_duration, 30) as duration_minutes,
            rl.visit_date,
            l.location_name,
            l.province,
            l.city,
            lt.type_name as location_type,
            r.route_name,
            r.route_type
        FROM patient_appointments pa
        JOIN route_locations rl ON pa.route_location_id = rl.id
        JOIN routes r ON rl.route_id = r.id
        JOIN locations l ON rl.location_id = l.id
        LEFT JOIN location_types lt ON l.location_type_id = lt.id
        WHERE pa.status = 'Available'
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
        
        if location_name:
            query += " AND l.location_name LIKE %s"
            params.append(f"%{location_name}%")
        
        if city:
            query += " AND l.city = %s"
            params.append(city)
        
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
            # Prepare args including OUT parameter placeholders
            args = [
                int(appointment_id),
                int(patient_id) if patient_id is not None else None,
                booked_by_name,
                booked_by_phone,
                booked_by_email,
                special_requirements,
                None,  # OUT p_booking_reference
                None   # OUT p_result
            ]

            # callproc returns a sequence with OUT params populated
            result_args = cursor.callproc('sp_book_appointment', args)

            # OUT params are the last two arguments
            booking_reference = result_args[6]
            result_message = result_args[7]

            connection.commit()

            if result_message and str(result_message).startswith('SUCCESS') and booking_reference:
                return jsonify({
                    'success': True,
                    'data': { 'booking_reference': booking_reference },
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
            # Provide placeholder for OUT parameter
            proc_args = [int(route_location_id), None]
            result_args = cursor.callproc('sp_generate_appointment_slots', proc_args)

            # OUT parameter is the second argument
            result_message = result_args[1]

            connection.commit()

            if result_message and str(result_message).startswith('SUCCESS'):
                return jsonify({
                    'success': True,
                    'message': result_message
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'error': result_message or 'Failed to generate appointment slots'
                }), 400
                
        finally:
            cursor.close()
            connection.close()
        
    except Exception as e:
        logger.error(f"Generate appointment slots error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

# ============================================================================
# INVENTORY STOCK MANAGEMENT
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
                   WHEN a.warranty_expiry IS NOT NULL AND a.warranty_expiry <= DATE_ADD(CURDATE(), INTERVAL 29 DAY) THEN 'Expiring Soon'
                   WHEN a.warranty_expiry IS NOT NULL THEN 'Valid'
                   ELSE 'No Warranty'
               END as warranty_status,
               CASE 
                   WHEN a.next_maintenance_date IS NOT NULL AND a.next_maintenance_date < CURDATE() THEN 'Overdue'
                   WHEN a.next_maintenance_date IS NOT NULL AND a.next_maintenance_date <= DATE_ADD(CURDATE(), INTERVAL 6 DAY) THEN 'Due This Week'
                   WHEN a.next_maintenance_date IS NOT NULL AND a.next_maintenance_date <= DATE_ADD(CURDATE(), INTERVAL 29 DAY) THEN 'Due This Month'
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
            query += " AND a.next_maintenance_date <= DATE_ADD(CURDATE(), INTERVAL 29 DAY)"

        query += " ORDER BY a.asset_name"

        assets = DatabaseManager.execute_query(query, tuple(params), fetch=True) or []

        return jsonify({
            'success': True,
            'data': {
                'assets': _to_jsonable(assets)
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
        
        # Log inventory usage activity
        try:
            # Get consumable name for audit log
            consumable_info = DatabaseManager.execute_query(
                "SELECT name FROM consumables WHERE id = %s",
                (consumable_id,),
                fetch=True,
            )
            consumable_name = consumable_info[0]['name'] if consumable_info else f"Consumable ID {consumable_id}"
            
            log_query = """
            INSERT INTO audit_log (user_id, table_name, action, new_values, created_at)
            VALUES (%s, 'inventory_usage', 'INSERT', %s, %s)
            """
            new_values = json.dumps({
                'consumable_id': consumable_id,
                'consumable_name': consumable_name,
                'quantity_used': quantity_used,
                'visit_id': visit_id,
                'location': location,
                'batches_affected': len(usage_records)
            })
            DatabaseManager.execute_query(log_query, (
                request.current_user['id'],
                new_values,
                datetime.utcnow()
            ))
        except Exception as log_error:
            logger.warning(f"Failed to log inventory usage: {log_error}")

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
    """Replay queued offline mutations against the live API."""
    try:
        data = request.get_json(silent=True) or {}
        device_id = data.get('device_id')
        records = data.get('records') or []

        if not device_id or not isinstance(records, list) or len(records) == 0:
            return jsonify({'success': False, 'error': 'device_id and records are required'}), 400

        client = app.test_client()
        auth_header = request.headers.get('Authorization')
        headers = {'Authorization': auth_header} if auth_header else {}

        synced_count = 0
        failed_count = 0
        synced_records: List[Dict[str, Any]] = []
        failed_records: List[Dict[str, Any]] = []

        for raw_record in records:
            if not isinstance(raw_record, dict):
                logger.warning(f"Ignoring malformed sync record: {raw_record}")
                failed_count += 1
                failed_records.append({'record': raw_record, 'error': 'Malformed record'})
                continue

            table_name = str(raw_record.get('table_name') or '').strip()
            operation_type = str(raw_record.get('operation_type') or 'UPDATE').upper()
            record_payload = raw_record.get('payload')

            if isinstance(record_payload, str):
                try:
                    record_payload = json.loads(record_payload)
                except Exception:
                    record_payload = {'raw': record_payload}

            if record_payload is None:
                record_payload = {}

            record_identifier = raw_record.get('record_id')
            normalized_id = _normalize_record_id(record_identifier or record_payload.get('id'))

            endpoint = raw_record.get('endpoint') or _infer_endpoint_from_record(raw_record, record_payload)
            if not endpoint:
                error_message = 'Unable to determine API endpoint for sync record'
                failed_count += 1
                failed_records.append({'record': raw_record, 'error': error_message})
                _persist_sync_status(
                    table_name=table_name,
                    record_id=normalized_id,
                    operation_type=operation_type,
                    status='Failed',
                    device_id=device_id,
                    user_id=request.current_user.get('id'),
                    timestamp_ms=raw_record.get('timestamp'),
                    payload=record_payload,
                    error_message=error_message,
                )
                continue

            if not endpoint.startswith('/'):
                endpoint = f'/{endpoint.lstrip()}'

            method = _operation_method(operation_type, raw_record.get('method'))

            request_kwargs: Dict[str, Any] = {
                'path': endpoint,
                'method': method,
                'headers': headers,
            }

            request_body = record_payload if record_payload else None
            if method in {'POST', 'PUT', 'PATCH'}:
                request_kwargs['json'] = request_body or {}
            elif method == 'DELETE' and request_body:
                request_kwargs['json'] = request_body

            logger.info(
                f"[SYNC] Replaying {method} {endpoint} for table '{table_name}' with payload keys: {list((record_payload or {}).keys())}"
            )

            try:
                response = client.open(**request_kwargs)
            except Exception as call_error:
                error_message = f"Request execution failed: {call_error}"
                logger.error(f"[SYNC] {error_message}")
                failed_count += 1
                failed_records.append({'record': raw_record, 'error': error_message})
                _persist_sync_status(
                    table_name=table_name,
                    record_id=normalized_id,
                    operation_type=operation_type,
                    status='Failed',
                    device_id=device_id,
                    user_id=request.current_user.get('id'),
                    timestamp_ms=raw_record.get('timestamp'),
                    payload=record_payload,
                    error_message=error_message,
                )
                continue

            try:
                response_payload = response.get_json(silent=True)
            except Exception:
                response_payload = None

            success = 200 <= (response.status_code or 0) < 300

            if success:
                synced_count += 1
                synced_records.append(
                    {
                        'table_name': table_name,
                        'local_record_id': record_identifier,
                        'normalized_record_id': normalized_id,
                        'operation': operation_type,
                        'status_code': response.status_code,
                        'response': response_payload,
                    }
                )

                _persist_sync_status(
                    table_name=table_name,
                    record_id=normalized_id,
                    operation_type=operation_type,
                    status='Synced',
                    device_id=device_id,
                    user_id=request.current_user.get('id'),
                    timestamp_ms=raw_record.get('timestamp'),
                    payload=record_payload,
                )
            else:
                error_message = None
                if response_payload and isinstance(response_payload, dict):
                    error_message = response_payload.get('error') or response_payload.get('message')
                if not error_message:
                    error_message = f"HTTP {response.status_code}"

                failed_count += 1
                failed_records.append(
                    {
                        'table_name': table_name,
                        'record': raw_record,
                        'status_code': response.status_code,
                        'error': error_message,
                    }
                )

                _persist_sync_status(
                    table_name=table_name,
                    record_id=normalized_id,
                    operation_type=operation_type,
                    status='Failed',
                    device_id=device_id,
                    user_id=request.current_user.get('id'),
                    timestamp_ms=raw_record.get('timestamp'),
                    payload=record_payload,
                    error_message=error_message,
                )

        return jsonify(
            {
                'success': failed_count == 0,
                'synced_count': synced_count,
                'failed_count': failed_count,
                'synced_records': synced_records,
                'failed_records': failed_records,
            }
        ), 200 if failed_count == 0 else 207

    except Exception as exc:
        logger.error(f"Sync pending records error: {exc}", exc_info=True)
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


@app.route('/api/dashboard/stats', methods=['GET'])
@token_required
def get_dashboard_stats():
    """Get role-specific dashboard statistics"""
    try:
        # Get user role and normalize it
        raw_role = (request.current_user or {}).get('role_name', '')
        user_role = str(raw_role).strip().lower().replace(' ', '_')
        user_id = request.current_user.get('id')
        
        logger.info(f"Dashboard stats for user_id={user_id}, raw_role='{raw_role}', normalized_role='{user_role}'")

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
            # Clerk: Track patient registrations and visit scheduling
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
            
            visit_stats = DatabaseManager.execute_query(
                """
                SELECT 
                    COUNT(CASE WHEN DATE(pv.created_at) = CURDATE() THEN 1 END) AS today_visits,
                    COUNT(CASE WHEN DATE(pv.created_at) >= CURDATE() - INTERVAL 7 DAY THEN 1 END) AS week_visits,
                    COUNT(CASE WHEN pv.is_completed = 0 THEN 1 END) AS pending_visits
                FROM patient_visits pv
                WHERE pv.created_by = %s
                """,
                (user_id,),
                fetch=True,
            )
            
            reg_data = reg_stats[0] if reg_stats else {}
            visit_data = visit_stats[0] if visit_stats else {}
            
            stats['todayPatients'] = int(reg_data.get('today_registrations', 0))
            stats['weeklyPatients'] = int(reg_data.get('week_registrations', 0))
            stats['monthlyPatients'] = int(reg_data.get('month_registrations', 0))
            
            stats['roleSpecificMetrics'] = {
                'todayBookings': int(visit_data.get('today_visits', 0)),
                'weekBookings': int(visit_data.get('week_visits', 0)),
                'monthBookings': int(visit_data.get('week_visits', 0)),
                'metricType': 'registrations'
            }

        elif user_role == 'nurse':
            # Nurse: Track vital signs and patient assessments
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
            
            # Alternative: Use visits created by nurse if no vitals
            visit_stats = DatabaseManager.execute_query(
                """
                SELECT 
                    COUNT(CASE WHEN DATE(pv.created_at) = CURDATE() THEN 1 END) AS today_visits,
                    COUNT(CASE WHEN DATE(pv.created_at) >= CURDATE() - INTERVAL 7 DAY THEN 1 END) AS week_visits,
                    COUNT(CASE WHEN DATE(pv.created_at) >= CURDATE() - INTERVAL 30 DAY THEN 1 END) AS month_visits
                FROM patient_visits pv
                WHERE pv.created_by = %s
                """,
                (user_id,),
                fetch=True,
            )
            
            notes_stats = DatabaseManager.execute_query(
                """
                SELECT 
                    COUNT(CASE WHEN cn.note_type = 'Assessment' AND DATE(cn.created_at) = CURDATE() THEN 1 END) AS today_assessments,
                    COUNT(CASE WHEN cn.note_type = 'Assessment' AND DATE(cn.created_at) >= CURDATE() - INTERVAL 7 DAY THEN 1 END) AS week_assessments
                FROM clinical_notes cn
                WHERE cn.created_by = %s
                """,
                (user_id,),
                fetch=True,
            )
            
            vitals_data = vitals_stats[0] if vitals_stats else {}
            visit_data = visit_stats[0] if visit_stats else {}
            notes_data = notes_stats[0] if notes_stats else {}
            
            # Use vitals as primary, fall back to visits
            today_patients = int(vitals_data.get('today_vitals', 0))
            if today_patients == 0:
                today_patients = int(visit_data.get('today_visits', 0))
            
            stats['todayPatients'] = today_patients
            stats['weeklyPatients'] = int(vitals_data.get('week_vitals', visit_data.get('week_visits', 0)))
            stats['monthlyPatients'] = int(vitals_data.get('month_vitals', visit_data.get('month_visits', 0)))
            
            stats['roleSpecificMetrics'] = {
                'todayAssessments': int(notes_data.get('today_assessments', 0)),
                'weekAssessments': int(notes_data.get('week_assessments', 0)),
                'todayVitals': int(vitals_data.get('today_vitals', 0)),
                'metricType': 'vitals'
            }

        elif user_role == 'doctor':
            # Doctor: Track patient visits, clinical notes, and activities
            
            # Get patient visits created/managed by doctor
            visit_stats = DatabaseManager.execute_query(
                """
                SELECT 
                    COUNT(CASE WHEN DATE(pv.created_at) = CURDATE() THEN 1 END) AS today_visits,
                    COUNT(CASE WHEN DATE(pv.created_at) >= CURDATE() - INTERVAL 7 DAY THEN 1 END) AS week_visits,
                    COUNT(CASE WHEN DATE(pv.created_at) >= CURDATE() - INTERVAL 30 DAY THEN 1 END) AS month_visits,
                    COUNT(CASE WHEN pv.is_completed = 1 AND DATE(pv.completed_at) = CURDATE() THEN 1 END) AS today_completed
                FROM patient_visits pv
                WHERE pv.created_by = %s
                """,
                (user_id,),
                fetch=True,
            )
            
            # Get clinical notes by doctor
            notes_stats = DatabaseManager.execute_query(
                """
                SELECT 
                    COUNT(CASE WHEN DATE(cn.created_at) = CURDATE() THEN 1 END) AS today_notes,
                    COUNT(CASE WHEN DATE(cn.created_at) >= CURDATE() - INTERVAL 7 DAY THEN 1 END) AS week_notes,
                    COUNT(CASE WHEN cn.note_type = 'Diagnosis' AND DATE(cn.created_at) = CURDATE() THEN 1 END) AS today_diagnosis,
                    COUNT(CASE WHEN cn.note_type = 'Treatment' AND DATE(cn.created_at) = CURDATE() THEN 1 END) AS today_treatment
                FROM clinical_notes cn
                WHERE cn.created_by = %s
                """,
                (user_id,),
                fetch=True,
            )
            
            visit_data = visit_stats[0] if visit_stats else {}
            notes_data = notes_stats[0] if notes_stats else {}
            
            # Use visits as primary metric, fall back to notes if no visits
            today_patients = int(visit_data.get('today_visits', 0))
            if today_patients == 0:
                today_patients = int(notes_data.get('today_notes', 0))
                
            stats['todayPatients'] = today_patients
            stats['weeklyPatients'] = int(visit_data.get('week_visits', notes_data.get('week_notes', 0)))
            stats['monthlyPatients'] = int(visit_data.get('month_visits', 0))
            
            stats['roleSpecificMetrics'] = {
                'todayDiagnoses': int(notes_data.get('today_diagnosis', 0)),
                'todayTreatments': int(notes_data.get('today_treatment', 0)),
                'todayCompleted': int(visit_data.get('today_completed', 0)),
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
            logger.info(f"Using admin/default dashboard for role: {user_role}")
            
            system_stats = DatabaseManager.execute_query(
                """
                SELECT 
                    COUNT(CASE WHEN DATE(pv.created_at) = CURDATE() THEN 1 END) AS visits_today,
                    COUNT(CASE WHEN DATE(pv.created_at) >= CURDATE() - INTERVAL 7 DAY THEN 1 END) AS visits_7d,
                    COUNT(CASE WHEN DATE(pv.created_at) >= CURDATE() - INTERVAL 30 DAY THEN 1 END) AS visits_30d,
                    COUNT(CASE WHEN pv.is_completed = 1 THEN 1 END) AS completed_visits
                FROM patient_visits pv
                """,
                fetch=True,
            )
            
            user_stats = DatabaseManager.execute_query(
                """
                SELECT 
                    COUNT(CASE WHEN DATE(u.created_at) = CURDATE() THEN 1 END) AS today_users,
                    COUNT(CASE WHEN u.is_active = 1 THEN 1 END) AS active_users
                FROM users u
                """,
                fetch=True,
            )
            
            system_data = system_stats[0] if system_stats else {}
            user_data = user_stats[0] if user_stats else {}
            
            stats['todayPatients'] = int(system_data.get('visits_today', 0))
            stats['weeklyPatients'] = int(system_data.get('visits_7d', 0))
            stats['monthlyPatients'] = int(system_data.get('visits_30d', 0))
            
            stats['roleSpecificMetrics'] = {
                'completedVisits': int(system_data.get('completed_visits', 0)),
                'activeUsers': int(user_data.get('active_users', 0)),
                'newUsersToday': int(user_data.get('today_users', 0)),
                'metricType': 'system_overview'
            }

        # Common metrics for all roles
        
        # Pending visits for today (no appointments table exists)
        pending_visits = DatabaseManager.execute_query(
            """
            SELECT COUNT(*) AS pending
            FROM patient_visits pv
            WHERE DATE(pv.visit_date) = CURDATE() AND pv.is_completed = 0
            """,
            fetch=True,
        )
        stats['pendingAppointments'] = int((pending_visits or [{}])[0].get('pending') or 0)

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

        # Time tracking statistics - Calculate average consultation time and total time spent
        time_tracking_stats = {}
        
        # For user-specific roles, calculate time spent by that user
        if user_role != 'administrator':
            # Average time per workflow stage (in minutes) for today
            time_stats_today = DatabaseManager.execute_query(
                """
                SELECT 
                    COUNT(*) as completed_stages,
                    AVG(TIMESTAMPDIFF(MINUTE, vwp.started_at, vwp.completed_at)) as avg_stage_minutes,
                    SUM(TIMESTAMPDIFF(MINUTE, vwp.started_at, vwp.completed_at)) as total_stage_minutes
                FROM visit_workflow_progress vwp
                WHERE vwp.assigned_user_id = %s
                    AND vwp.is_completed = TRUE
                    AND vwp.started_at IS NOT NULL
                    AND vwp.completed_at IS NOT NULL
                    AND DATE(vwp.completed_at) = CURDATE()
                """,
                (user_id,),
                fetch=True,
            )
            
            # Weekly time stats
            time_stats_week = DatabaseManager.execute_query(
                """
                SELECT 
                    COUNT(*) as completed_stages,
                    AVG(TIMESTAMPDIFF(MINUTE, vwp.started_at, vwp.completed_at)) as avg_stage_minutes,
                    SUM(TIMESTAMPDIFF(MINUTE, vwp.started_at, vwp.completed_at)) as total_stage_minutes
                FROM visit_workflow_progress vwp
                WHERE vwp.assigned_user_id = %s
                    AND vwp.is_completed = TRUE
                    AND vwp.started_at IS NOT NULL
                    AND vwp.completed_at IS NOT NULL
                    AND vwp.completed_at >= CURDATE() - INTERVAL 7 DAY
                """,
                (user_id,),
                fetch=True,
            )
        else:
            # System-wide time tracking for administrators
            time_stats_today = DatabaseManager.execute_query(
                """
                SELECT 
                    COUNT(*) as completed_stages,
                    AVG(TIMESTAMPDIFF(MINUTE, vwp.started_at, vwp.completed_at)) as avg_stage_minutes,
                    SUM(TIMESTAMPDIFF(MINUTE, vwp.started_at, vwp.completed_at)) as total_stage_minutes
                FROM visit_workflow_progress vwp
                WHERE vwp.is_completed = TRUE
                    AND vwp.started_at IS NOT NULL
                    AND vwp.completed_at IS NOT NULL
                    AND DATE(vwp.completed_at) = CURDATE()
                """,
                fetch=True,
            )
            
            time_stats_week = DatabaseManager.execute_query(
                """
                SELECT 
                    COUNT(*) as completed_stages,
                    AVG(TIMESTAMPDIFF(MINUTE, vwp.started_at, vwp.completed_at)) as avg_stage_minutes,
                    SUM(TIMESTAMPDIFF(MINUTE, vwp.started_at, vwp.completed_at)) as total_stage_minutes
                FROM visit_workflow_progress vwp
                WHERE vwp.is_completed = TRUE
                    AND vwp.started_at IS NOT NULL
                    AND vwp.completed_at IS NOT NULL
                    AND vwp.completed_at >= CURDATE() - INTERVAL 7 DAY
                """,
                fetch=True,
            )
        
        today_time = time_stats_today[0] if time_stats_today else {}
        week_time = time_stats_week[0] if time_stats_week else {}
        
        # Format time tracking data
        time_tracking_stats['todayStats'] = {
            'completedStages': int(today_time.get('completed_stages') or 0),
            'avgMinutesPerStage': round(float(today_time.get('avg_stage_minutes') or 0), 1),
            'totalMinutes': int(today_time.get('total_stage_minutes') or 0),
            'totalHours': round(float(today_time.get('total_stage_minutes') or 0) / 60, 1)
        }
        
        time_tracking_stats['weekStats'] = {
            'completedStages': int(week_time.get('completed_stages') or 0),
            'avgMinutesPerStage': round(float(week_time.get('avg_stage_minutes') or 0), 1),
            'totalMinutes': int(week_time.get('total_stage_minutes') or 0),
            'totalHours': round(float(week_time.get('total_stage_minutes') or 0) / 60, 1)
        }
        
        # Average visit completion time (from visit creation to completion)
        visit_time_stats = DatabaseManager.execute_query(
            """
            SELECT 
                AVG(TIMESTAMPDIFF(MINUTE, pv.created_at, pv.completed_at)) as avg_visit_minutes
            FROM patient_visits pv
            WHERE pv.is_completed = TRUE
                AND pv.completed_at IS NOT NULL
                AND pv.completed_at >= CURDATE() - INTERVAL 7 DAY
            """,
            fetch=True,
        )
        
        visit_time = visit_time_stats[0] if visit_time_stats else {}
        time_tracking_stats['avgVisitCompletionMinutes'] = round(float(visit_time.get('avg_visit_minutes') or 0), 1)
        
        stats['timeTracking'] = time_tracking_stats

        def format_audit_change_summary(old_values, new_values):
            """Return a concise change summary derived from audit JSON values."""
            def parse_json_blob(blob):
                if not blob:
                    return {}
                if isinstance(blob, dict):
                    return blob
                try:
                    return json.loads(blob)
                except Exception:
                    return {}

            old_data = parse_json_blob(old_values)
            new_data = parse_json_blob(new_values)

            if not isinstance(new_data, dict) or not new_data:
                return ''

            changes = []
            for key, new_val in new_data.items():
                if key in {'updated_at', 'created_at', 'password', 'token'}:
                    continue
                old_val = old_data.get(key)
                if old_val != new_val:
                    changes.append(f"{key}: {old_val} -> {new_val}")
                if len(changes) >= 5:
                    break

            return '; '.join(changes)

        # Recent activity: only expose to administrators for a system-wide view
        stats['recentActivity'] = []
        if user_role == 'administrator':
            recent_activity = DatabaseManager.execute_query(
                """
                SELECT 
                    al.id,
                    al.action,
                    al.table_name,
                    al.record_id,
                    al.created_at,
                    al.ip_address,
                    al.location_data,
                    al.old_values,
                    al.new_values,
                    u.username,
                    u.first_name,
                    u.last_name,
                    CASE 
                        WHEN al.table_name = 'patients' THEN 'patient'
                        WHEN al.table_name = 'patient_visits' THEN 'visit'
                        WHEN al.table_name = 'appointments' THEN 'appointment'
                        WHEN al.table_name = 'inventory_usage' THEN 'inventory'
                        WHEN al.table_name = 'routes' THEN 'route'
                        ELSE 'system'
                    END AS activity_type
                FROM audit_log al
                LEFT JOIN users u ON al.user_id = u.id
                WHERE al.created_at >= CURDATE() - INTERVAL 7 DAY
                ORDER BY al.created_at DESC
                LIMIT 20
                """,
                fetch=True,
            )

            detailed_activity = []
            for activity in (recent_activity or []):
                actor_name = (f"{(activity.get('first_name') or '')} {(activity.get('last_name') or '')}".strip()
                              or activity.get('username') or 'System')
                action_value = str(activity.get('action') or '').lower() or 'performed'
                table_value = str(activity.get('table_name') or '').replace('_', ' ').strip() or 'record'
                record_id = activity.get('record_id')
                record_suffix = f" record {record_id}" if record_id not in (None, '') else ''
                description = f"{actor_name} {action_value} {table_value}{record_suffix}".strip()

                detailed_activity.append({
                    'id': str(activity['id']),
                    'type': activity.get('activity_type', 'system'),
                    'description': description,
                    'timestamp': activity['created_at'].isoformat() if activity['created_at'] else '',
                    'status': 'completed',
                    'performedBy': actor_name,
                    'action': activity.get('action'),
                    'table': activity.get('table_name'),
                    'recordId': record_id,
                    'ipAddress': activity.get('ip_address'),
                    'changeSummary': format_audit_change_summary(activity.get('old_values'), activity.get('new_values')),
                    'locationData': activity.get('location_data')
                })

            stats['recentActivity'] = detailed_activity

        return jsonify({'success': True, 'data': stats}), 200

    except Exception as e:
        logger.error(f"Dashboard stats error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/activity/recent', methods=['GET'])
@token_required
def get_recent_activity():
    """Get comprehensive recent activity from multiple data sources"""
    try:
        current_user = g.current_user
        user_id = current_user['id']
        user_role = current_user.get('role_name', '').lower().replace(' ', '_')
        
        # Get query parameters
        limit = min(int(request.args.get('limit', 50)), 100)  # Max 100 items
        days = min(int(request.args.get('days', 7)), 30)  # Max 30 days
        
        activities = []
        
        # 1. Audit Log Activities (login, data changes, etc.)
        audit_activities = DatabaseManager.execute_query(
            """
            SELECT 
                al.id,
                al.action,
                al.table_name,
                al.created_at,
                u.first_name,
                u.last_name,
                CASE 
                    WHEN al.table_name = 'patients' THEN 'patient'
                    WHEN al.table_name = 'patient_visits' THEN 'visit'
                    WHEN al.table_name = 'inventory_usage' THEN 'inventory'
                    WHEN al.table_name = 'routes' THEN 'route'
                    WHEN al.table_name = 'users' AND al.action = 'LOGIN' THEN 'login'
                    ELSE 'system'
                END AS activity_type,
                CASE 
                    WHEN al.action = 'INSERT' AND al.table_name = 'patients' THEN 'Registered new patient'
                    WHEN al.action = 'INSERT' AND al.table_name = 'patient_visits' THEN 'Created new patient visit'
                    WHEN al.action = 'UPDATE' AND al.table_name = 'patients' THEN 'Updated patient information'
                    WHEN al.action = 'UPDATE' AND al.table_name = 'patient_visits' THEN 'Updated visit record'
                    WHEN al.action = 'LOGIN' THEN 'Logged into system'
                    WHEN al.action = 'INSERT' THEN CONCAT('Created new ', REPLACE(al.table_name, '_', ' '), ' record')
                    WHEN al.action = 'UPDATE' THEN CONCAT('Updated ', REPLACE(al.table_name, '_', ' '), ' record')
                    ELSE CONCAT(al.action, ' ', REPLACE(al.table_name, '_', ' '))
                END AS description
            FROM audit_log al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.user_id = %s
            AND al.created_at >= NOW() - INTERVAL %s DAY
            ORDER BY al.created_at DESC
            LIMIT %s
            """,
            (user_id, days, limit),
            fetch=True,
        )
        
        for activity in audit_activities or []:
            activities.append({
                'id': f"audit_{activity['id']}",
                'type': activity['activity_type'],
                'description': activity['description'],
                'timestamp': activity['created_at'].isoformat() if activity['created_at'] else '',
                'status': 'completed',
                'source': 'audit_log',
                'user': f"{activity['first_name'] or ''} {activity['last_name'] or ''}".strip() or 'System'
            })
        
        # 2. Patient Visit Activities (for medical staff)
        if user_role in ['doctor', 'nurse', 'social_worker']:
            visit_activities = DatabaseManager.execute_query(
                """
                SELECT 
                    pv.id,
                    pv.visit_date,
                    pv.visit_time,
                    pv.created_at,
                    pv.updated_at,
                    pv.chief_complaint,
                    pv.is_completed,
                    p.first_name as patient_first,
                    p.last_name as patient_last,
                    p.id_number as patient_id_number,
                    CASE 
                        WHEN pv.is_completed = 1 THEN 'completed'
                        WHEN pv.created_at = pv.updated_at THEN 'created'
                        ELSE 'updated'
                    END AS visit_status
                FROM patient_visits pv
                JOIN patients p ON pv.patient_id = p.id
                WHERE pv.created_by = %s
                AND (pv.created_at >= NOW() - INTERVAL %s DAY OR pv.updated_at >= NOW() - INTERVAL %s DAY)
                ORDER BY GREATEST(pv.created_at, pv.updated_at) DESC
                LIMIT %s
                """,
                (user_id, days, days, limit),
                fetch=True,
            )
            
            for visit in visit_activities or []:
                patient_name = f"{visit['patient_first'] or ''} {visit['patient_last'] or ''}".strip()
                visit_date_str = visit['visit_date'].strftime('%Y-%m-%d') if visit['visit_date'] else 'Unknown'
                
                if visit['visit_status'] == 'created':
                    description = f"Scheduled visit for {patient_name} on {visit_date_str}"
                    timestamp = visit['created_at']
                elif visit['visit_status'] == 'completed':
                    description = f"Completed visit for {patient_name}"
                    timestamp = visit['updated_at']
                else:
                    description = f"Updated visit for {patient_name}"
                    timestamp = visit['updated_at']
                
                activities.append({
                    'id': f"visit_{visit['id']}",
                    'type': 'visit',
                    'description': description,
                    'timestamp': timestamp.isoformat() if timestamp else '',
                    'status': visit['visit_status'],
                    'source': 'patient_visits',
                    'patient': patient_name,
                    'complaint': visit['chief_complaint'] or 'No complaint specified'
                })
        
        # 3. User Session Activities (login tracking)
        session_activities = DatabaseManager.execute_query(
            """
            SELECT 
                us.created_at,
                us.ip_address,
                us.device_info,
                'session_start' as activity_type
            FROM user_sessions us
            WHERE us.user_id = %s
            AND us.created_at >= NOW() - INTERVAL %s DAY
            ORDER BY us.created_at DESC
            LIMIT %s
            """,
            (user_id, days, limit),
            fetch=True,
        )
        
        for session in session_activities or []:
            device_info = ''
            if session['device_info']:
                try:
                    device_data = json.loads(session['device_info']) if isinstance(session['device_info'], str) else session['device_info']
                    device_info = f" from {device_data.get('browser', 'Unknown browser')}"
                except:
                    device_info = ''
            
            activities.append({
                'id': f"session_{session['created_at']}",
                'type': 'login',
                'description': f"Started new session{device_info}",
                'timestamp': session['created_at'].isoformat() if session['created_at'] else '',
                'status': 'completed',
                'source': 'user_sessions',
                'ip_address': session['ip_address']
            })
        
        # 4. Role-specific activities
        if user_role == 'administrator':
            # System administration activities
            admin_activities = DatabaseManager.execute_query(
                """
                SELECT 
                    al.created_at,
                    al.action,
                    al.table_name,
                    COUNT(*) as activity_count
                FROM audit_log al
                WHERE al.user_id = %s
                AND al.table_name IN ('users', 'user_roles', 'routes', 'locations')
                AND al.created_at >= NOW() - INTERVAL %s DAY
                GROUP BY DATE(al.created_at), al.table_name, al.action
                ORDER BY al.created_at DESC
                LIMIT %s
                """,
                (user_id, days, limit // 2),
                fetch=True,
            )
            
            for admin in admin_activities or []:
                activities.append({
                    'id': f"admin_{admin['created_at']}_{admin['table_name']}",
                    'type': 'administration',
                    'description': f"System management: {admin['action']} {admin['activity_count']} {admin['table_name']} record(s)",
                    'timestamp': admin['created_at'].isoformat() if admin['created_at'] else '',
                    'status': 'completed',
                    'source': 'admin_activities'
                })
        
        # Sort all activities by timestamp
        activities.sort(key=lambda x: x['timestamp'], reverse=True)
        
        # Limit final results
        activities = activities[:limit]
        
        # Add summary statistics
        activity_summary = {
            'total_activities': len(activities),
            'date_range': {
                'start': (datetime.now() - timedelta(days=days)).isoformat(),
                'end': datetime.now().isoformat(),
                'days': days
            },
            'activity_types': {}
        }
        
        # Count activities by type
        for activity in activities:
            activity_type = activity['type']
            activity_summary['activity_types'][activity_type] = activity_summary['activity_types'].get(activity_type, 0) + 1
        
        return jsonify({
            'success': True, 
            'data': {
                'activities': activities,
                'summary': activity_summary
            }
        }), 200

    except Exception as e:
        logger.error(f"Recent activity error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500
    
# ============================================================================
# MEDSCHEME INTEGRATION ENDPOINTS
# ============================================================================

@app.route('/api/medscheme/alert', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor', 'nurse'])
def create_medscheme_alert():
    """Create alert to medscheme for chronic disease or additional care"""
    try:
        data = request.get_json() or {}
        
        patient_id = data.get('patient_id')
        visit_id = data.get('visit_id')
        alert_type = data.get('alert_type')  # 'chronic_disease' or 'additional_care'
        alert_data = data.get('alert_data', {})
        
        if not patient_id or not alert_type:
            return jsonify({'success': False, 'error': 'patient_id and alert_type are required'}), 400
        
        valid_alert_types = ['chronic_disease', 'additional_care', 'file_closure', 'data_sync']
        if alert_type not in valid_alert_types:
            return jsonify({'success': False, 'error': f'alert_type must be one of: {valid_alert_types}'}), 400
        
        # Insert alert
        insert_query = """
        INSERT INTO medscheme_alerts 
        (patient_id, visit_id, alert_type, alert_status, alert_data, created_by)
        VALUES (%s, %s, %s, 'pending', %s, %s)
        """
        
        result = DatabaseManager.execute_query(
            insert_query,
            (patient_id, visit_id, alert_type, json.dumps(alert_data), request.current_user['id'])
        )
        
        if not result:
            return jsonify({'success': False, 'error': 'Failed to create medscheme alert'}), 500
        
        # TODO: Implement actual medscheme API call here
        # For now, mark as sent
        logger.info(f"Medscheme alert created: {alert_type} for patient {patient_id}")
        
        return jsonify({
            'success': True,
            'message': 'Medscheme alert created successfully',
            'note': 'Medscheme API integration pending'
        }), 201
        
    except Exception as e:
        logger.error(f"Create medscheme alert error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/chronic-disease/enroll', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor'])
def enroll_chronic_disease_program():
    """Enroll patient in chronic disease management program"""
    try:
        data = request.get_json() or {}
        
        patient_id = data.get('patient_id')
        condition_name = data.get('condition_name')
        icd10_code = data.get('icd10_code')
        enrollment_date = data.get('enrollment_date') or datetime.now(timezone.utc).date()
        care_plan = data.get('care_plan', {})
        
        if not patient_id or not condition_name:
            return jsonify({'success': False, 'error': 'patient_id and condition_name are required'}), 400
        
        # Insert enrollment
        insert_query = """
        INSERT INTO chronic_disease_program 
        (patient_id, condition_name, icd10_code, enrollment_date, program_status, care_plan, created_by)
        VALUES (%s, %s, %s, %s, 'active', %s, %s)
        """
        
        result = DatabaseManager.execute_query(
            insert_query,
            (patient_id, condition_name, icd10_code, enrollment_date, json.dumps(care_plan), request.current_user['id'])
        )
        
        if not result:
            return jsonify({'success': False, 'error': 'Failed to enroll in chronic disease program'}), 500
        
        # Create medscheme alert
        alert_data = {
            'condition': condition_name,
            'icd10_code': icd10_code,
            'enrollment_date': str(enrollment_date),
            'requires_additional_care': True
        }
        
        DatabaseManager.execute_query(
            """
            INSERT INTO medscheme_alerts 
            (patient_id, alert_type, alert_status, alert_data, created_by)
            VALUES (%s, 'chronic_disease', 'pending', %s, %s)
            """,
            (patient_id, json.dumps(alert_data), request.current_user['id'])
        )
        
        logger.info(f"Patient {patient_id} enrolled in chronic disease program: {condition_name}")
        
        return jsonify({
            'success': True,
            'message': 'Patient enrolled in chronic disease management program',
            'medscheme_notified': True
        }), 201
        
    except Exception as e:
        logger.error(f"Enroll chronic disease program error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/visits/<int:visit_id>/close', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor'])
def close_visit_with_notification(visit_id: int):
    """Close visit and send email report to beneficiary (POPIA compliant)"""
    try:
        data = request.get_json() or {}
        
        # Get visit and patient data
        visit_query = """
        SELECT pv.*, p.id as patient_id, p.first_name, p.last_name, p.email, 
               p.date_of_birth, p.medical_aid_number, p.member_type
        FROM patient_visits pv
        JOIN patients p ON pv.patient_id = p.id
        WHERE pv.id = %s
        """
        
        visit_data = DatabaseManager.execute_query(visit_query, (visit_id,), fetch=True)
        
        if not visit_data:
            return jsonify({'success': False, 'error': 'Visit not found'}), 404
        
        visit = visit_data[0]
        patient_id = visit['patient_id']
        
        # Calculate patient age
        patient_age = None
        if visit['date_of_birth']:
            today = datetime.now(timezone.utc).date()
            birth_date = visit['date_of_birth']
            patient_age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
        
        # POPIA compliance: Determine recipient
        recipient_email = visit['email']
        recipient_type = 'patient'
        
        if patient_age and patient_age >= 18:
            # Send to dependent (patient) if 18 or older
            recipient_type = 'dependent'
        else:
            # Send to main member/guardian if under 18
            recipient_type = 'main_member'
            # TODO: Fetch main member email from medscheme/database
        
        # Mark visit as completed
        update_query = """
        UPDATE patient_visits 
        SET is_completed = TRUE, completed_at = %s
        WHERE id = %s
        """
        
        DatabaseManager.execute_query(
            update_query,
            (datetime.now(timezone.utc), visit_id)
        )
        
        # Gather report data
        report_data = {
            'visit_id': visit_id,
            'patient_name': f"{visit['first_name']} {visit['last_name']}",
            'visit_date': str(visit['visit_date']),
            'medical_aid_number': visit['medical_aid_number'],
            'closure_date': datetime.now(timezone.utc).isoformat()
        }
        
        # Create email notification record
        notification_query = """
        INSERT INTO visit_closure_notifications 
        (visit_id, patient_id, recipient_email, recipient_type, report_data, 
         email_status, popia_compliant, patient_age_at_send, created_by)
        VALUES (%s, %s, %s, %s, %s, 'pending', TRUE, %s, %s)
        """
        
        DatabaseManager.execute_query(
            notification_query,
            (visit_id, patient_id, recipient_email, recipient_type, 
             json.dumps(report_data), patient_age, request.current_user['id'])
        )
        
        # Create medscheme sync for file closure
        DatabaseManager.execute_query(
            """
            INSERT INTO medscheme_sync_log 
            (patient_id, visit_id, sync_type, sync_status, sync_data)
            VALUES (%s, %s, 'visit_data', 'pending', %s)
            """,
            (patient_id, visit_id, json.dumps(report_data))
        )
        
        # Create patient portal notification
        try:
            notification_title = "Visit Summary Available"
            notification_message = f"Your visit summary from {visit['visit_date']} is now available. You can view your consultation details, prescriptions, and follow-up instructions in your portal."
            
            create_patient_notification(
                patient_id=patient_id,
                notification_type='health_update',
                title=notification_title,
                message=notification_message,
                priority='medium',
                action_url=f'/patient-portal/visits/{visit_id}'
            )
        except Exception as e:
            logger.error(f"Failed to create visit closure notification: {e}")
        
        # TODO: Implement actual email sending
        logger.info(f"Visit {visit_id} closed. Email notification queued for {recipient_email} ({recipient_type})")
        
        return jsonify({
            'success': True,
            'message': 'Visit closed successfully',
            'email_queued': True,
            'recipient_type': recipient_type,
            'popia_compliant': True,
            'medscheme_sync_queued': True
        }), 200
        
    except Exception as e:
        logger.error(f"Close visit error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/medscheme/sync', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor', 'nurse'])
def sync_to_medscheme():
    """Push data to medscheme so they know what's going on"""
    try:
        data = request.get_json() or {}
        
        patient_id = data.get('patient_id')
        visit_id = data.get('visit_id')
        sync_type = data.get('sync_type', 'full_sync')
        
        if not patient_id:
            return jsonify({'success': False, 'error': 'patient_id is required'}), 400
        
        # Gather data to sync
        sync_data = {
            'patient_id': patient_id,
            'visit_id': visit_id,
            'sync_timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        # Create sync log
        insert_query = """
        INSERT INTO medscheme_sync_log 
        (patient_id, visit_id, sync_type, sync_status, sync_data, started_at)
        VALUES (%s, %s, %s, 'pending', %s, %s)
        """
        
        DatabaseManager.execute_query(
            insert_query,
            (patient_id, visit_id, sync_type, json.dumps(sync_data), datetime.now(timezone.utc))
        )
        
        # TODO: Implement actual medscheme API sync
        logger.info(f"Medscheme sync initiated for patient {patient_id}, visit {visit_id}")
        
        return jsonify({
            'success': True,
            'message': 'Data sync to medscheme initiated',
            'sync_type': sync_type,
            'note': 'Medscheme API integration pending'
        }), 200
        
    except Exception as e:
        logger.error(f"Medscheme sync error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/chronic-disease/list/<int:patient_id>', methods=['GET'])
@token_required
def list_chronic_disease_enrollments(patient_id: int):
    """List chronic disease program enrollments for a patient"""
    try:
        query = """
        SELECT * FROM chronic_disease_program
        WHERE patient_id = %s
        ORDER BY enrollment_date DESC
        """
        
        enrollments = DatabaseManager.execute_query(query, (patient_id,), fetch=True)
        
        return jsonify({
            'success': True,
            'data': _to_jsonable(enrollments) or []
        }), 200
        
    except Exception as e:
        logger.error(f"List chronic disease enrollments error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


# ==================== USER MANAGEMENT ENDPOINTS ====================

@app.route('/api/users', methods=['GET'])
@token_required
def get_users():
    """Get list of all users with pagination and filtering"""
    try:
        # Only administrators can access user management
        if not is_admin_or_authorized(request.current_user):
            return jsonify({'success': False, 'error': 'Insufficient permissions'}), 403
        
        # Get query parameters
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 20))
        search = request.args.get('search', '').strip()
        role_filter = request.args.get('role', '').strip()
        status_filter = request.args.get('status', '').strip()
        
        # Calculate offset
        offset = (page - 1) * limit
        
        # Build base query
        query = """
        SELECT 
            u.id,
            u.username,
            u.email,
            u.first_name,
            u.last_name,
            u.phone_number,
            u.mp_number,
            u.geographic_restrictions,
            u.is_active,
            u.requires_approval,
            u.created_at,
            u.updated_at,
            ur.role_name as role,
            ur.role_description
        FROM users u
        JOIN user_roles ur ON u.role_id = ur.id
        WHERE 1=1
        """
        
        params = []
        
        # Add search filter
        if search:
            query += " AND (u.email LIKE %s OR u.first_name LIKE %s OR u.last_name LIKE %s OR u.username LIKE %s)"
            search_term = f"%{search}%"
            params.extend([search_term, search_term, search_term, search_term])
        
        # Add role filter
        if role_filter:
            query += " AND ur.role_name = %s"
            params.append(role_filter)
        
        # Add status filter
        if status_filter == 'active':
            query += " AND u.is_active = 1"
        elif status_filter == 'inactive':
            query += " AND u.is_active = 0"
        elif status_filter == 'pending':
            query += " AND u.requires_approval = 1"
        
        # Add ordering
        query += " ORDER BY u.created_at DESC"
        
        # Get total count for pagination
        count_query = f"SELECT COUNT(*) as total FROM ({query}) as counted"
        count_result = DatabaseManager.execute_query(count_query, tuple(params), fetch=True)
        total = count_result[0]['total'] if count_result else 0
        
        # Add pagination
        query += " LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        
        # Execute main query
        users = DatabaseManager.execute_query(query, tuple(params), fetch=True)
        
        if users is None:
            return jsonify({'success': False, 'error': 'Database query failed'}), 500
        
        # Format response
        response_data = {
            'users': _to_jsonable(users) or [],
            'pagination': {
                'page': page,
                'limit': limit,
                'total': total,
                'pages': (total + limit - 1) // limit if total > 0 else 0
            }
        }
        
        return jsonify({
            'success': True,
            'data': response_data
        }), 200
        
    except Exception as e:
        logger.error(f"Get users error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/users/roles', methods=['GET'])
@token_required
def get_user_roles():
    """Get all available user roles"""
    try:
        # Only administrators can access user roles
        if not is_admin_or_authorized(request.current_user):
            return jsonify({'success': False, 'error': 'Insufficient permissions'}), 403
        
        query = """
        SELECT 
            id,
            role_name,
            role_description,
            created_at
        FROM user_roles 
        ORDER BY role_name
        """
        
        roles = DatabaseManager.execute_query(query, fetch=True)
        
        if roles is None:
            return jsonify({'success': False, 'error': 'Database query failed'}), 500
        
        return jsonify({
            'success': True,
            'data': _to_jsonable(roles) or []
        }), 200
        
    except Exception as e:
        logger.error(f"Get user roles error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/users', methods=['POST'])
@token_required
def create_user():
    """Create a new user"""
    try:
        # Only administrators can create users
        if not is_admin_or_authorized(request.current_user):
            return jsonify({'success': False, 'error': 'Insufficient permissions'}), 403
        
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['email', 'password', 'first_name', 'last_name', 'role_id']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'error': f'Missing required field: {field}'}), 400
        
        # Check if user already exists
        existing_user = DatabaseManager.execute_query(
            "SELECT id FROM users WHERE email = %s",
            (data['email'],),
            fetch=True
        )
        
        if existing_user:
            return jsonify({'success': False, 'error': 'User with this email already exists'}), 400
        
        # Generate username if not provided
        username = data.get('username', data['email'].split('@')[0])
        
        # Hash password
        password_hash = generate_password_hash(data['password'])
        
        # Insert user
        insert_query = """
        INSERT INTO users (
            username, email, password_hash, role_id, first_name, last_name,
            phone_number, mp_number, geographic_restrictions, 
            is_active, requires_approval, created_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        result = DatabaseManager.execute_query(insert_query, (
            username,
            data['email'],
            password_hash,
            data['role_id'],
            data['first_name'],
            data['last_name'],
            data.get('phone_number'),
            data.get('mp_number'),
            data.get('geographic_restrictions', '[]'),
            data.get('is_active', True),
            data.get('requires_approval', False),
            datetime.now()
        ))
        
        if not result:
            return jsonify({'success': False, 'error': 'Failed to create user'}), 500
        
        return jsonify({
            'success': True,
            'message': 'User created successfully'
        }), 201
        
    except Exception as e:
        logger.error(f"Create user error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/users/<int:user_id>', methods=['GET'])
@token_required
def get_user(user_id):
    """Get specific user details"""
    try:
        # Only administrators or the user themselves can access user details
        current_user = request.current_user
        if not (is_admin_or_authorized(current_user) or current_user.get('id') == user_id):
            return jsonify({'success': False, 'error': 'Insufficient permissions'}), 403
        
        query = """
        SELECT 
            u.id,
            u.username,
            u.email,
            u.first_name,
            u.last_name,
            u.phone_number,
            u.mp_number,
            u.geographic_restrictions,
            u.is_active,
            u.requires_approval,
            u.created_at,
            u.updated_at,
            ur.role_name as role,
            ur.role_description
        FROM users u
        JOIN user_roles ur ON u.role_id = ur.id
        WHERE u.id = %s
        """
        
        user = DatabaseManager.execute_query(query, (user_id,), fetch=True)
        
        if not user:
            return jsonify({'success': False, 'error': 'User not found'}), 404
        
        return jsonify({
            'success': True,
            'data': _to_jsonable(user[0])
        }), 200
        
    except Exception as e:
        logger.error(f"Get user error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/users/<int:user_id>', methods=['PATCH'])
@token_required
def update_user(user_id):
    """Update user information"""
    try:
        # Only administrators can update users
        if not is_admin_or_authorized(request.current_user):
            return jsonify({'success': False, 'error': 'Insufficient permissions'}), 403
        
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
        
        # Check if user exists
        existing_user = DatabaseManager.execute_query(
            "SELECT id FROM users WHERE id = %s",
            (user_id,),
            fetch=True
        )
        
        if not existing_user:
            return jsonify({'success': False, 'error': 'User not found'}), 404
        
        # Build update query dynamically
        update_fields = []
        params = []
        
        updatable_fields = [
            'first_name', 'last_name', 'phone_number', 'mp_number',
            'geographic_restrictions', 'is_active', 'requires_approval', 'role_id'
        ]
        
        for field in updatable_fields:
            if field in data:
                update_fields.append(f"{field} = %s")
                params.append(data[field])
        
        # Handle password update
        if 'password' in data and data['password']:
            update_fields.append("password_hash = %s")
            params.append(generate_password_hash(data['password']))
        
        if not update_fields:
            return jsonify({'success': False, 'error': 'No valid fields to update'}), 400
        
        # Add updated_at and user_id
        update_fields.append("updated_at = %s")
        params.extend([datetime.now(), user_id])
        
        query = f"UPDATE users SET {', '.join(update_fields)} WHERE id = %s"
        
        result = DatabaseManager.execute_query(query, tuple(params))
        
        if not result:
            return jsonify({'success': False, 'error': 'Failed to update user'}), 500
        
        return jsonify({
            'success': True,
            'message': 'User updated successfully'
        }), 200
        
    except Exception as e:
        logger.error(f"Update user error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


def is_admin_or_authorized(user):
    """Check if user is administrator or has appropriate permissions"""
    if not user:
        return False
    
    role = user.get('role_name', '').lower()
    return 'administrator' in role or 'admin' in role


@app.route('/health', methods=['GET'])
def health_check():
    """Basic health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'service': 'palmed-clinic-erp'
    }), 200


@app.route('/api/health', methods=['GET'])
def api_health_check():
    """API health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'service': 'palmed-clinic-erp-api',
        'version': '1.0.0'
    }), 200


@app.route('/api/appointments', methods=['GET'])
@token_required
def get_appointments():
    """Get all appointments with filtering and pagination"""
    try:
        # Get query parameters
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 20))
        status_filter = request.args.get('status', '').strip()
        route_id = request.args.get('route_id', '').strip()
        include_available = request.args.get('include_available', 'false').lower() == 'true'
        
        # Calculate offset
        offset = (page - 1) * limit
        
        # Build query using patient_appointments table
        query = """
        SELECT 
            pa.id,
            pa.route_location_id,
            pa.appointment_date,
            pa.appointment_time,
            pa.booking_reference,
            LOWER(pa.status) AS status,
            pa.notes AS special_requirements,
            pa.created_at,
            COALESCE(
                NULLIF(TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))), ''),
                NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''),
                COALESCE(u.username, u.email),
                'Unassigned'
            ) AS patient_name,
            COALESCE(p.phone_number, u.phone_number, '') AS patient_phone,
            COALESCE(p.medical_aid_number, '') AS patient_medical_aid,
            COALESCE(p.email, u.email, '') AS patient_email,
            COALESCE(r.route_name, '') AS route_name,
            COALESCE(l.location_name, 'Mobile Clinic') AS location_name,
            COALESCE(l.city, '') AS location_city,
            COALESCE(l.province, '') AS location_province
        FROM patient_appointments pa
        LEFT JOIN patients p ON pa.patient_id = p.id
        LEFT JOIN users u ON pa.created_by = u.id
        LEFT JOIN route_locations rl ON pa.route_location_id = rl.id
        LEFT JOIN routes r ON rl.route_id = r.id
        LEFT JOIN locations l ON rl.location_id = l.id
        WHERE 1=1
        """
        
        params = []
        
        # By default, exclude "Available" appointments unless explicitly requested
        if not include_available and not status_filter:
            query += " AND LOWER(pa.status) != 'available'"
        
        # Add filters
        if status_filter:
            query += " AND LOWER(pa.status) = %s"
            params.append(status_filter.lower())
        
        if route_id:
            query += " AND pa.route_location_id = %s"
            params.append(int(route_id))
        
        # Add ordering
        query += " ORDER BY pa.appointment_date DESC, pa.appointment_time DESC"
        
        # Get total count
        count_query = f"SELECT COUNT(*) as total FROM ({query}) as counted"
        count_result = DatabaseManager.execute_query(count_query, tuple(params), fetch=True)
        total = count_result[0]['total'] if count_result else 0
        
        # Add pagination
        query += " LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        
        # Execute query
        appointments = DatabaseManager.execute_query(query, tuple(params), fetch=True)
        
        if appointments is None:
            return jsonify({'success': False, 'error': 'Database query failed'}), 500
        
        return jsonify({
            'success': True,
            'data': _to_jsonable(appointments) or [],
            'pagination': {
                'page': page,
                'limit': limit,
                'total': total,
                'pages': (total + limit - 1) // limit if total > 0 else 0
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Get appointments error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


# ============================================================================
# ============================================================================
# PATIENT CHECK-IN WORKFLOW
# ============================================================================

@app.route('/api/appointments/check-in/today', methods=['GET'])
@token_required
@role_required(['administrator', 'clerk', 'nurse'])
def get_todays_checkin_appointments():
    """Get today's booked appointments for check-in"""
    try:
        # Get today's date
        today = datetime.now(timezone.utc).date()
        
        query = """
        SELECT 
            pa.id AS appointment_id,
            pa.appointment_date,
            pa.appointment_time,
            pa.status AS appointment_status,
            pa.booking_reference,
            pa.patient_id,
            pa.route_location_id,
            CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')) AS patient_name,
            p.medical_aid_number,
            p.phone_number AS patient_phone,
            p.email AS patient_email,
            p.date_of_birth,
            p.gender,
            l.location_name,
            l.city,
            l.province,
            r.route_name,
            r.id AS route_id,
            pv.id AS visit_id,
            pv.current_stage_id,
            ws.stage_name AS current_stage_name,
            CASE WHEN pv.id IS NOT NULL THEN TRUE ELSE FALSE END AS is_checked_in
        FROM patient_appointments pa
        INNER JOIN patients p ON pa.patient_id = p.id
        LEFT JOIN route_locations rl ON pa.route_location_id = rl.id
        LEFT JOIN locations l ON rl.location_id = l.id
        LEFT JOIN routes r ON rl.route_id = r.id
        LEFT JOIN patient_visits pv ON pv.patient_id = pa.patient_id 
            AND pv.visit_date = pa.appointment_date
        LEFT JOIN workflow_stages ws ON pv.current_stage_id = ws.id
        WHERE pa.status IN ('Booked', 'Confirmed')
            AND pa.appointment_date = %s
            AND pa.patient_id IS NOT NULL
        ORDER BY pa.appointment_time ASC, pa.created_at ASC
        """
        
        appointments = DatabaseManager.execute_query(query, (today,), fetch=True)
        
        if appointments is None:
            return jsonify({'success': False, 'error': 'Database query failed'}), 500
        
        return jsonify({
            'success': True,
            'data': _to_jsonable(appointments) or [],
            'count': len(appointments) if appointments else 0
        }), 200
        
    except Exception as e:
        logger.error(f"Get today's check-in appointments error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/appointments/<int:appointment_id>/check-in', methods=['POST'])
@token_required
@role_required(['administrator', 'clerk', 'nurse'])
def check_in_patient(appointment_id: int):
    """Check in a patient for their appointment"""
    try:
        # Get appointment details
        appt_query = """
        SELECT 
            pa.id,
            pa.patient_id,
            pa.appointment_date,
            pa.appointment_time,
            pa.route_location_id,
            pa.status,
            rl.route_id,
            l.location_name,
            l.city,
            l.province
        FROM patient_appointments pa
        LEFT JOIN route_locations rl ON pa.route_location_id = rl.id
        LEFT JOIN locations l ON rl.location_id = l.id
        WHERE pa.id = %s
        """
        
        appointment = DatabaseManager.execute_query(appt_query, (appointment_id,), fetch=True)
        
        if not appointment or len(appointment) == 0:
            return jsonify({'success': False, 'error': 'Appointment not found'}), 404
        
        appt = appointment[0]
        
        if not appt['patient_id']:
            return jsonify({'success': False, 'error': 'Appointment has no patient assigned'}), 400
        
        # Check if already checked in (visit exists for this patient and date)
        existing_visit = DatabaseManager.execute_query(
            """SELECT id FROM patient_visits 
               WHERE patient_id = %s AND visit_date = %s""",
            (appt['patient_id'], appt['appointment_date']),
            fetch=True
        )
        
        if existing_visit and len(existing_visit) > 0:
            return jsonify({
                'success': False, 
                'error': 'Patient already checked in',
                'visit_id': existing_visit[0]['id']
            }), 400
        
        # Get first workflow stage (Patient Checkin)
        first_stage = DatabaseManager.execute_query(
            "SELECT id FROM workflow_stages ORDER BY stage_order ASC LIMIT 1",
            fetch=True
        )
        
        if not first_stage or len(first_stage) == 0:
            return jsonify({'success': False, 'error': 'No workflow stages configured'}), 500
        
        first_stage_id = first_stage[0]['id']
        
        # Create patient visit record
        location_str = appt['location_name'] or 'Mobile Clinic'
        if appt['city']:
            location_str += f", {appt['city']}"
        if appt['province']:
            location_str += f", {appt['province']}"
        
        current_time = datetime.now(timezone.utc).strftime('%H:%M:%S')
        
        insert_visit_query = """
        INSERT INTO patient_visits (
            patient_id,
            visit_date,
            visit_time,
            route_id,
            location,
            current_stage_id,
            is_completed,
            created_by,
            created_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        visit_result = DatabaseManager.execute_query(
            insert_visit_query,
            (
                appt['patient_id'],
                appt['appointment_date'],
                current_time,
                appt['route_id'],
                location_str,
                first_stage_id,
                False,
                request.current_user['id'],
                datetime.now(timezone.utc)
            )
        )
        
        if not visit_result:
            return jsonify({'success': False, 'error': 'Failed to create visit record'}), 500
        
        visit_id = visit_result
        
        # Initialize workflow progress for first stage
        insert_progress_query = """
        INSERT INTO visit_workflow_progress (
            visit_id,
            stage_id,
            started_at
        ) VALUES (%s, %s, %s)
        """
        
        DatabaseManager.execute_query(
            insert_progress_query,
            (visit_id, first_stage_id, datetime.now(timezone.utc))
        )
        
        # Update appointment status to Confirmed
        DatabaseManager.execute_query(
            "UPDATE patient_appointments SET status = 'Confirmed', updated_at = %s WHERE id = %s",
            (datetime.now(timezone.utc), appointment_id)
        )
        
        # Create notification for check-in
        try:
            notification_title = "Check-in Successful"
            notification_message = f"You have been checked in. Your visit is now in progress. Please wait to be called for your consultation."
            
            create_patient_notification(
                patient_id=appt['patient_id'],
                notification_type='health_update',
                title=notification_title,
                message=notification_message,
                priority='medium',
                action_url=f'/patient-portal/visits/{visit_id}'
            )
        except Exception as e:
            logger.error(f"Failed to create check-in notification: {e}")
        
        logger.info(f"Patient {appt['patient_id']} checked in for appointment {appointment_id}, visit {visit_id} created")
        
        return jsonify({
            'success': True,
            'visit_id': visit_id,
            'message': 'Patient checked in successfully',
            'data': {
                'visit_id': visit_id,
                'appointment_id': appointment_id,
                'patient_id': appt['patient_id'],
                'check_in_time': current_time,
                'stage_id': first_stage_id
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Check-in patient error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/patients/<int:patient_id>/visit', methods=['POST'])
@token_required
@role_required(['administrator', 'clerk', 'nurse'])
def check_in_patient_visit(patient_id: int):
    """Create a patient visit (check-in without appointment)"""
    try:
        data = request.get_json() or {}
        
        # Check if patient exists
        patient = DatabaseManager.execute_query(
            "SELECT id, first_name, last_name FROM patients WHERE id = %s",
            (patient_id,),
            fetch=True
        )
        
        if not patient or len(patient) == 0:
            return jsonify({'success': False, 'error': 'Patient not found'}), 404
        
        # Check if already checked in today
        today = datetime.now(timezone.utc).date()
        existing_visit = DatabaseManager.execute_query(
            """SELECT id FROM patient_visits 
               WHERE patient_id = %s AND visit_date = %s""",
            (patient_id, today),
            fetch=True
        )
        
        if existing_visit and len(existing_visit) > 0:
            return jsonify({
                'success': False, 
                'error': 'Patient already checked in today',
                'visit_id': existing_visit[0]['id']
            }), 400
        
        # Get first workflow stage
        first_stage = DatabaseManager.execute_query(
            "SELECT id FROM workflow_stages ORDER BY stage_order ASC LIMIT 1",
            fetch=True
        )
        
        if not first_stage or len(first_stage) == 0:
            return jsonify({'success': False, 'error': 'No workflow stages configured'}), 500
        
        first_stage_id = first_stage[0]['id']
        
        # Create patient visit record
        route_id = data.get('route_id')
        location = data.get('location', 'Walk-in')
        current_time = datetime.now(timezone.utc).strftime('%H:%M:%S')
        
        insert_visit_query = """
        INSERT INTO patient_visits (
            patient_id,
            visit_date,
            visit_time,
            route_id,
            location,
            current_stage_id,
            is_completed,
            created_by,
            created_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        visit_result = DatabaseManager.execute_query(
            insert_visit_query,
            (
                patient_id,
                today,
                current_time,
                route_id,
                location,
                first_stage_id,
                False,
                request.current_user['id'],
                datetime.now(timezone.utc)
            )
        )
        
        if not visit_result:
            return jsonify({'success': False, 'error': 'Failed to create visit record'}), 500
        
        visit_id = visit_result
        
        # Initialize workflow progress for first stage
        insert_progress_query = """
        INSERT INTO visit_workflow_progress (
            visit_id,
            stage_id,
            started_at
        ) VALUES (%s, %s, %s)
        """
        
        DatabaseManager.execute_query(
            insert_progress_query,
            (visit_id, first_stage_id, datetime.now(timezone.utc))
        )
        
        logger.info(f"Patient {patient_id} checked in as walk-in, visit {visit_id} created")
        
        return jsonify({
            'success': True,
            'visit_id': visit_id,
            'message': 'Patient checked in successfully',
            'data': {
                'visit_id': visit_id,
                'patient_id': patient_id,
                'check_in_time': current_time,
                'stage_id': first_stage_id
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Create patient visit error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


# ============================================================================
# ============================================================================
# PATIENT DOCUMENT MANAGEMENT (CLINICAL STAFF)
# ============================================================================

@app.route('/api/patients/<int:patient_id>/documents', methods=['POST'])
@token_required
@role_required([
    'administrator',
    'doctor',
    'nurse',
    'dentist',
    'optometrist',
    'audiologist',
    'gynaecologist',
    'ultrasound',
    'psychologist',
    'social_worker',
    'clerk',
])
def upload_patient_document(patient_id: int):
    """Upload a supporting document for a patient visit or specialist workflow stage."""
    try:
        patient_exists = DatabaseManager.execute_query(
            "SELECT id FROM patients WHERE id = %s",
            (patient_id,),
            fetch=True,
        )
        if not patient_exists:
            return jsonify({'success': False, 'error': 'Patient not found'}), 404

        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'Upload payload must include a file'}), 400

        file_storage = request.files['file']
        if not file_storage or not file_storage.filename:
            return jsonify({'success': False, 'error': 'No file selected for upload'}), 400

        if not _allowed_document_extension(file_storage.filename):
            allowed = ', '.join(sorted(ALLOWED_DOCUMENT_EXTENSIONS))
            return jsonify({
                'success': False,
                'error': f'Unsupported file type. Allowed extensions: {allowed}',
            }), 400

        visit_id_value: Optional[int] = None
        visit_id_raw = request.form.get('visit_id')
        if visit_id_raw:
            try:
                visit_id_value = int(str(visit_id_raw).strip())
            except ValueError:
                return jsonify({'success': False, 'error': 'visit_id must be a valid integer'}), 400

            visit_check = DatabaseManager.execute_query(
                "SELECT id FROM patient_visits WHERE id = %s AND patient_id = %s",
                (visit_id_value, patient_id),
                fetch=True,
            )
            if not visit_check:
                return jsonify({'success': False, 'error': 'Visit does not belong to patient'}), 400

        document_type = (request.form.get('document_type') or 'other').strip() or 'other'
        specialist_raw = request.form.get('specialist_type')
        specialist_type = None
        if specialist_raw:
            normalized = specialist_raw.strip().lower().replace(' ', '_')
            specialist_type = SPECIALIST_LOOKUP.get(normalized, normalized)

        workflow_step = request.form.get('workflow_step')
        if workflow_step:
            workflow_step = workflow_step.strip().lower()

        tags_serialized = None
        tags_payload: Optional[Any] = None
        tags_raw = request.form.get('tags')
        if tags_raw:
            try:
                parsed_tags = json.loads(tags_raw)
                if isinstance(parsed_tags, (list, dict)):
                    tags_payload = parsed_tags
                else:
                    tags_payload = str(parsed_tags)
            except json.JSONDecodeError:
                tags_payload = [tag.strip() for tag in tags_raw.split(',') if tag.strip()]

            try:
                tags_serialized = json.dumps(tags_payload)
            except (TypeError, ValueError):
                tags_serialized = None

        notes = request.form.get('notes')
        is_confidential = _parse_bool_flag(request.form.get('is_confidential'), default=False)

        original_filename = file_storage.filename
        safe_filename = secure_filename(original_filename)
        if not safe_filename:
            return jsonify({'success': False, 'error': 'Could not derive a safe filename'}), 400

        upload_root = app.config.get('UPLOAD_FOLDER', 'uploads')
        if not os.path.isabs(upload_root):
            upload_root = os.path.join(os.getcwd(), upload_root)

        patient_folder = os.path.join(upload_root, f'patient_{patient_id}')
        os.makedirs(patient_folder, exist_ok=True)

        unique_prefix = uuid.uuid4().hex
        stored_filename = f"{unique_prefix}_{safe_filename}"
        absolute_path = os.path.join(patient_folder, stored_filename)
        file_storage.save(absolute_path)

        try:
            file_size = os.path.getsize(absolute_path)
        except OSError:
            file_size = None

        stored_relative_path = os.path.relpath(absolute_path, upload_root).replace('\\', '/')

        insert_query = """
        INSERT INTO documents (
            patient_id,
            visit_id,
            document_type,
            file_name,
            file_path,
            file_size,
            mime_type,
            is_confidential,
            uploaded_by,
            specialist_type,
            workflow_step,
            tags,
            notes
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        insert_result = DatabaseManager.execute_query(
            insert_query,
            (
                patient_id,
                visit_id_value,
                document_type,
                original_filename,
                stored_relative_path,
                file_size,
                file_storage.mimetype,
                1 if is_confidential else 0,
                request.current_user['id'],
                specialist_type,
                workflow_step,
                tags_serialized,
                notes,
            ),
        )

        if not insert_result:
            try:
                os.remove(absolute_path)
            except OSError:
                pass
            return jsonify({'success': False, 'error': 'Failed to persist document metadata'}), 500

        fetch_query = """
        SELECT d.*, u.first_name AS uploader_first, u.last_name AS uploader_last
        FROM documents d
        LEFT JOIN users u ON d.uploaded_by = u.id
        WHERE d.file_path = %s
        ORDER BY d.id DESC
        LIMIT 1
        """

        doc_record = DatabaseManager.execute_query(fetch_query, (stored_relative_path,), fetch=True)
        if not doc_record:
            return jsonify({'success': True, 'message': 'Document uploaded', 'data': None}), 201

        document = doc_record[0]

        tags_value = document.get('tags')
        if isinstance(tags_value, str):
            try:
                tags_value = json.loads(tags_value)
            except json.JSONDecodeError:
                pass

        response_payload = {
            'id': document['id'],
            'patient_id': document['patient_id'],
            'visit_id': document.get('visit_id'),
            'document_type': document.get('document_type'),
            'file_name': document.get('file_name'),
            'file_path': document.get('file_path'),
            'file_size': document.get('file_size'),
            'mime_type': document.get('mime_type'),
            'is_confidential': bool(document.get('is_confidential')),
            'uploaded_by': document.get('uploaded_by'),
            'uploaded_by_name': f"{document.get('uploader_first') or ''} {document.get('uploader_last') or ''}".strip() or None,
            'uploaded_at': document.get('uploaded_at').isoformat() if document.get('uploaded_at') else None,
            'specialist_type': document.get('specialist_type'),
            'workflow_step': document.get('workflow_step'),
            'tags': tags_value,
            'notes': document.get('notes'),
            'download_url': f"/api/patient-portal/documents/download/{document['id']}",
        }

        return jsonify({'success': True, 'message': 'Document uploaded successfully', 'data': response_payload}), 201

    except Exception as upload_error:
        logger.error(f"Document upload error for patient {patient_id}: {upload_error}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


# PATIENT PORTAL ADDITIONAL ENDPOINTS
# ============================================================================

@app.route('/api/patient-portal/notifications/<int:patient_id>', methods=['GET'])
@patient_portal_token_required
def get_patient_notifications(patient_id: int):
    """Get patient notifications from database"""
    try:
        # Verify token matches requested patient ID
        if request.patient_id != patient_id:
            return jsonify({'success': False, 'error': 'Access denied'}), 403
        
        # Query patient_notifications table for real data
        query = """
            SELECT 
                id,
                notification_type,
                title,
                message,
                priority,
                action_url,
                is_read,
                read_at,
                created_at,
                expires_at
            FROM patient_notifications
            WHERE patient_id = %s
                AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY 
                CASE priority
                    WHEN 'urgent' THEN 1
                    WHEN 'high' THEN 2
                    WHEN 'medium' THEN 3
                    WHEN 'low' THEN 4
                END,
                created_at DESC
            LIMIT 50
        """
        
        db_manager = DatabaseManager()
        notifications_data = db_manager.execute_query(query, (patient_id,), fetch=True)
        
        # Format notifications
        notifications = []
        for row in notifications_data:
            notifications.append({
                'id': row['id'],
                'type': row['notification_type'],
                'title': row['title'],
                'message': row['message'],
                'priority': row['priority'],
                'action_url': row['action_url'],
                'is_read': bool(row['is_read']),
                'read_at': row['read_at'].isoformat() if row['read_at'] else None,
                'created_at': row['created_at'].isoformat() if row['created_at'] else None,
                'expires_at': row['expires_at'].isoformat() if row['expires_at'] else None
            })
        
        return jsonify({
            'success': True,
            'data': notifications,
            'count': len(notifications)
        }), 200
        
    except Exception as e:
        logger.error(f"Get patient notifications error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/patient-portal/notifications/<int:notification_id>/read', methods=['POST'])
@patient_portal_token_required
def mark_notification_as_read(notification_id: int):
    """Mark a notification as read"""
    try:
        db_manager = DatabaseManager()
        
        # Verify the notification belongs to the authenticated patient
        verify_query = """
            SELECT patient_id 
            FROM patient_notifications 
            WHERE id = %s
        """
        result = db_manager.execute_query(verify_query, (notification_id,), fetch=True)
        
        if not result:
            return jsonify({
                'success': False,
                'error': 'Notification not found'
            }), 404
        
        if result[0]['patient_id'] != request.patient_id:
            return jsonify({
                'success': False,
                'error': 'Access denied'
            }), 403
        
        # Update the notification to mark as read
        update_query = """
            UPDATE patient_notifications
            SET is_read = 1,
                read_at = NOW()
            WHERE id = %s
        """
        db_manager.execute_query(update_query, (notification_id,), fetch=False)
        
        return jsonify({
            'success': True,
            'message': 'Notification marked as read'
        }), 200
        
    except Exception as e:
        logger.error(f"Mark notification as read error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/patient-portal/feedback/<int:patient_id>', methods=['POST'])
@patient_portal_token_required
def submit_patient_feedback(patient_id: int):
    """Submit patient feedback"""
    try:
        # Verify token matches requested patient ID
        if request.patient_id != patient_id:
            return jsonify({'success': False, 'error': 'Access denied'}), 403
        
        data = request.get_json() or {}
        
        # Extract feedback data
        feedback_type = data.get('feedback_type', 'service_rating')
        overall_rating = data.get('overall_rating')
        service_ratings = data.get('service_ratings')
        comments = data.get('comments', '').strip()
        visit_id = data.get('visit_id')
        appointment_id = data.get('appointment_id')
        location_name = data.get('location_name')
        visit_date = data.get('visit_date')
        is_anonymous = data.get('is_anonymous', False)
        
        # Validate feedback type
        valid_types = ['service_rating', 'complaint', 'suggestion', 'compliment']
        if feedback_type not in valid_types:
            return jsonify({'success': False, 'error': f'Invalid feedback type. Must be one of: {", ".join(valid_types)}'}), 400
        
        # Validate overall rating if provided
        if overall_rating is not None and (not isinstance(overall_rating, int) or overall_rating < 1 or overall_rating > 5):
            return jsonify({'success': False, 'error': 'Overall rating must be between 1 and 5'}), 400
        
        # Validate comments for complaint/suggestion types
        if feedback_type in ['complaint', 'suggestion'] and not comments:
            return jsonify({'success': False, 'error': 'Comments are required for complaints and suggestions'}), 400
        
        # Insert feedback into database
        query = """
        INSERT INTO patient_feedback (
            patient_id, visit_id, appointment_id, feedback_type, overall_rating, 
            service_ratings, location_name, visit_date, comments, is_anonymous, 
            status, created_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', NOW())
        """
        
        # Convert service_ratings dict to JSON string if provided
        import json
        service_ratings_json = json.dumps(service_ratings) if service_ratings else None
        
        DatabaseManager.execute_query(
            query,
            (
                patient_id,
                visit_id,
                appointment_id,
                feedback_type,
                overall_rating,
                service_ratings_json,
                location_name,
                visit_date,
                comments,
                is_anonymous
            )
        )
        
        logger.info(f"Patient {patient_id} submitted feedback: Type={feedback_type}, Rating={overall_rating}")
        
        return jsonify({
            'success': True,
            'message': 'Feedback submitted successfully. Thank you for your feedback!',
            'data': {
                'feedback_type': feedback_type,
                'status': 'pending'
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Submit patient feedback error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/patient-portal/feedback/<int:patient_id>', methods=['GET'])
@patient_portal_token_required
def get_patient_feedback_history(patient_id: int):
    """Get patient's feedback history"""
    try:
        # Verify token matches requested patient ID
        if request.patient_id != patient_id:
            return jsonify({'success': False, 'error': 'Access denied'}), 403
        
        # TODO: Implement actual feedback history from database
        # For now, return sample feedback history
        feedback_history = [
            {
                'id': 1,
                'feedback': 'Great service, very professional staff.',
                'rating': 5,
                'category': 'service',
                'submitted_at': '2024-01-10T14:30:00Z',
                'response': 'Thank you for your positive feedback!'
            },
            {
                'id': 2,
                'feedback': 'Waiting time was a bit long, but overall good experience.',
                'rating': 4,
                'category': 'general',
                'submitted_at': '2024-01-05T11:15:00Z',
                'response': None
            }
        ]
        
        return jsonify({
            'success': True,
            'data': feedback_history
        }), 200
        
    except Exception as e:
        logger.error(f"Get patient feedback history error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/patient-portal/appointments/available/<int:patient_id>', methods=['GET'], endpoint='patient_available_appointments_v2')
@patient_portal_token_required
def get_available_appointments_v2(patient_id: int):
    """
    Get available appointment slots for a patient from route_locations.
    Frontend endpoint for appointment scheduler.
    Filters for active/published routes only with valid dates.
    """
    try:
        # Verify token matches requested patient ID
        if request.patient_id != patient_id:
            return jsonify({'success': False, 'error': 'Access denied'}), 403
        
        logger.info(f"Fetching available appointments for patient {patient_id}")
        
        # Get query parameters
        date_from = request.args.get('date_from', str(date.today()))
        date_to = request.args.get('date_to')
        province = request.args.get('province')
        
        # Set default date_to if not provided (30 days from now)
        if not date_to:
            date_to_obj = date.today() + timedelta(days=30)
            date_to = str(date_to_obj)
        
        # Use stored procedure to get available appointments
        logger.info(f"Calling sp_get_available_appointments with date_from={date_from}, date_to={date_to}, province={province}")
        
        connection = DatabaseManager.get_connection()
        if not connection:
            return jsonify({'success': False, 'error': 'Database connection failed'}), 500
        
        cursor = None
        try:
            cursor = connection.cursor(dictionary=True)
            
            # Build direct query (avoid stored procedure collation issues)
            query = """
                SELECT 
                    pa.id,
                    pa.route_location_id,
                    pa.appointment_date,
                    pa.appointment_time,
                    pa.status,
                    rl.visit_date,
                    rl.start_time,
                    rl.end_time,
                    rl.max_appointments,
                    rl.appointment_duration,
                    l.id AS location_id,
                    l.location_name,
                    l.address,
                    l.city,
                    l.province,
                    r.id AS route_id,
                    r.route_name,
                    r.route_type,
                    (rl.max_appointments - COALESCE((
                        SELECT COUNT(*) 
                        FROM patient_appointments pa2 
                        WHERE pa2.route_location_id = rl.id 
                        AND LOWER(pa2.status) IN ('booked', 'confirmed')
                    ), 0)) AS available_slots
                FROM patient_appointments pa
                INNER JOIN route_locations rl ON pa.route_location_id = rl.id
                INNER JOIN locations l ON rl.location_id = l.id
                INNER JOIN routes r ON rl.route_id = r.id
                WHERE 
                    (pa.status IS NULL OR LOWER(pa.status) = 'available')
                    AND pa.appointment_date >= %s
                    AND pa.appointment_date <= %s
                    AND r.is_active = TRUE
            """
            
            params = [date_from, date_to]
            
            # Add province filter if provided
            if province and province != 'Any Province':
                query += " AND l.province = %s"
                params.append(province)
            
            query += " ORDER BY pa.appointment_date ASC, pa.appointment_time ASC"
            
            cursor.execute(query, params)
            available_slots = cursor.fetchall() or []
            logger.info(f"Query returned {len(available_slots)} available appointments")
            
        except Exception as sp_err:
            logger.error(f"Error fetching appointments: {sp_err}")
            return jsonify({'success': False, 'error': f'Failed to fetch appointments: {str(sp_err)}'}), 500
        finally:
            if cursor:
                cursor.close()
            if connection:
                connection.close()
        
        logger.info(f"Found {len(available_slots)} available slots")
        
        # Defensive: Check if route_locations table has data
        if len(available_slots) == 0:
            logger.warning("No available slots found. Checking if route_locations table has any data...")
            check_rl = DatabaseManager.execute_query(
                "SELECT COUNT(*) as cnt FROM route_locations WHERE visit_date >= CURDATE()",
                fetch=True
            ) or []
            if check_rl and check_rl[0]['cnt'] == 0:
                logger.warning("route_locations table is empty. Staff must create routes with locations before patients can book.")
                return jsonify({
                    'success': True,
                    'data': [],
                    'total': 0,
                    'message': 'No routes with available appointments. Please contact clinic staff.'
                }), 200
            else:
                logger.warning(f"route_locations has {check_rl[0]['cnt']} records but none match patient filters")
        
        
        # Format response for frontend
        appointments_data = []
        for slot in available_slots:
            if slot['available_slots'] > 0:
                # Convert dates properly
                appt_date = slot['appointment_date']
                if hasattr(appt_date, 'isoformat'):
                    appt_date_str = appt_date.isoformat()
                else:
                    appt_date_str = str(appt_date)
                
                visit_date = slot['visit_date']
                if hasattr(visit_date, 'isoformat'):
                    visit_date_str = visit_date.isoformat()
                else:
                    visit_date_str = str(visit_date)
                
                # Convert times
                start_time = slot['start_time']
                if hasattr(start_time, 'strftime'):
                    start_time_str = start_time.strftime('%H:%M')
                else:
                    start_time_str = str(start_time) if start_time else None
                
                end_time = slot['end_time']
                if hasattr(end_time, 'strftime'):
                    end_time_str = end_time.strftime('%H:%M')
                else:
                    end_time_str = str(end_time) if end_time else None
                
                appointments_data.append({
                    'appointment_id': slot['id'],
                    'route_location_id': slot['route_location_id'],
                    'route_id': slot['route_id'],
                    'date': appt_date_str,
                    'appointment_date': appt_date_str,
                    'start_time': start_time_str,
                    'appointment_time': start_time_str,
                    'end_time': end_time_str,
                    'available_slots': slot['available_slots'],
                    'duration': slot['appointment_duration'],
                    'distance_km': 0,  # Could be calculated if coordinates available
                    'location_name': slot['location_name'],
                    'address': slot['address'],
                    'city': slot['city'],
                    'province': slot['province'],
                    'location': {
                        'id': slot['location_id'],
                        'name': slot['location_name'],
                        'city': slot['city'],
                        'province': slot['province'],
                        'address': slot['address']
                    },
                    'route': {
                        'id': slot['route_id'],
                        'name': slot['route_name'],
                        'type': slot['route_type']
                    }
                })
        
        logger.info(f"Returning {len(appointments_data)} formatted appointments")
        
        return jsonify({
            'success': True,
            'data': appointments_data,
            'total': len(appointments_data)
        }), 200
            
    except Exception as e:
        logger.error(f"Error fetching available appointments: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/patient-portal/appointments/book', methods=['POST'])
def book_appointment_patient_portal():
    """
    Book an appointment for a patient.
    Now correctly uses appointment_id from the appointments table
    """
    try:
        data = request.get_json()
        patient_id = data.get('patient_id')
        appointment_id = data.get('appointment_id')  # Now expects appointment_id
        reason = data.get('reason', '')
        
        if not patient_id or not appointment_id:
            return jsonify({
                'success': False,
                'error': 'Patient ID and Appointment ID are required'
            }), 400
        
        connection = DatabaseManager.get_connection()
        if not connection:
            return jsonify({'success': False, 'error': 'Database connection failed'}), 500

        cursor = None
        try:
            cursor = connection.cursor(dictionary=True)

            cursor.execute(
                """
                SELECT status FROM appointments
                WHERE appointment_id = %s
                """,
                (appointment_id,),
            )

            appointment = cursor.fetchone()

            if not appointment:
                return jsonify({'success': False, 'error': 'Appointment not found'}), 404

            if appointment['status'] != 'Available':
                return jsonify({'success': False, 'error': 'Appointment is no longer available'}), 400

            cursor.execute(
                """
                UPDATE appointments
                SET patient_id = %s,
                    status = 'Scheduled',
                    reason = %s,
                    updated_at = NOW()
                WHERE appointment_id = %s
                """,
                (patient_id, reason, appointment_id),
            )

            connection.commit()

            return jsonify({
                'success': True,
                'message': 'Appointment booked successfully',
                'appointment_id': appointment_id,
            }), 200

        except Exception as e:
            if connection:
                try:
                    connection.rollback()
                except Exception:
                    pass
            return jsonify({'success': False, 'error': str(e)}), 500
        finally:
            if cursor:
                try:
                    cursor.close()
                except Exception:
                    pass
            if connection and connection.is_connected():
                connection.close()
    except Exception as outer_error:
        logger.error(f"Appointment booking error: {outer_error}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500
    
@app.route('/api/patient-portal/visits/<int:patient_id>', methods=['GET'])
@patient_portal_token_required
def get_patient_visit_history(patient_id: int):
    """Get patient's visit history with detailed information"""
    try:
        # Verify token matches requested patient ID
        if request.patient_id != patient_id:
            logger.warning(f"Access denied: token patient {request.patient_id} != requested {patient_id}")
            return jsonify({'success': False, 'error': 'Access denied'}), 403
        
        logger.info(f"Retrieving visit history for patient {patient_id}")
        
        # Get patient visits - corrected query (no location_id join, use location string directly)
        visits_query = """
        SELECT pv.id, pv.visit_date, pv.visit_time, pv.chief_complaint, 
               pv.is_completed, pv.completed_at,
               pv.location, pv.route_id,
               pv.created_at, pv.updated_at, pv.doctor_id, pv.nurse_id,
               (SELECT COUNT(*) FROM visit_workflow_progress vwp 
                WHERE vwp.visit_id = pv.id AND vwp.completed_at IS NOT NULL) as completed_stages,
               (SELECT COUNT(*) FROM workflow_stages) as total_stages,
               COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'Not Assigned') as doctor_name
        FROM patient_visits pv
        LEFT JOIN users u ON pv.doctor_id = u.id
        WHERE pv.patient_id = %s
        ORDER BY pv.visit_date DESC, pv.visit_time DESC
        LIMIT 100
        """
        
        logger.debug(f"Executing query for patient {patient_id}")
        visits = DatabaseManager.execute_query(visits_query, (patient_id,), fetch=True) or []
        logger.info(f"Query returned {len(visits)} visits for patient {patient_id}")
        
        if not visits:
            logger.info(f"No visits found for patient {patient_id}")
            return jsonify({
                'success': True,
                'data': [],
                'message': 'No visit history found'
            }), 200
        
        # Format visits data
        visits_data = []
        for visit in visits:
            try:
                # Parse visit date and time
                visit_datetime = None
                if visit['visit_date']:
                    try:
                        visit_datetime = datetime.combine(
                            visit['visit_date'],
                            visit['visit_time'] if visit['visit_time'] else time(0, 0)
                        ).isoformat()
                    except Exception as dt_err:
                        logger.warning(f"Error combining date/time for visit {visit['id']}: {dt_err}")
                        visit_datetime = visit['visit_date'].isoformat() if visit['visit_date'] else None
                
                completed_stages = visit['completed_stages'] or 0
                total_stages = visit['total_stages'] or 0
                progress_pct = round((completed_stages / max(total_stages, 1)) * 100) if total_stages > 0 else 0
                
                visit_record = {
                    'id': visit['id'],
                    'visit_id': visit['id'],  # Some clients expect visit_id
                    'visit_date': visit['visit_date'].isoformat() if visit['visit_date'] else None,
                    'visit_time': visit['visit_time'].isoformat() if visit['visit_time'] else None,
                    'visit_datetime': visit_datetime,
                    'chief_complaint': visit['chief_complaint'] or '',
                    'is_completed': bool(visit['is_completed']),
                    'completed_at': visit['completed_at'].isoformat() if visit['completed_at'] else None,
                    'location_name': visit['location'] or 'Unknown Location',
                    'location': visit['location'] or 'Unknown',
                    'doctor_name': visit['doctor_name'] or 'Not Assigned',
                    'completed_stages': completed_stages,
                    'total_stages': total_stages,
                    'progress_percentage': progress_pct,
                    'created_at': visit['created_at'].isoformat() if visit['created_at'] else None,
                    'updated_at': visit['updated_at'].isoformat() if visit['updated_at'] else None
                }
                visits_data.append(visit_record)
            except Exception as visit_err:
                logger.error(f"Error formatting visit {visit.get('id', 'unknown')}: {str(visit_err)}", exc_info=True)
                # Skip this visit and continue with others
                continue
        
        logger.info(f"Successfully formatted {len(visits_data)} visits for patient {patient_id}")
        return jsonify({
            'success': True,
            'data': visits_data,
            'count': len(visits_data)
        }), 200
        
    except Exception as e:
        logger.error(f"Get patient visit history error for patient {patient_id}: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Failed to retrieve visit history',
            'details': str(e) if app.debug else None
        }), 500


# ============================================================================
# MISSING PATIENT PORTAL ENDPOINTS - Phase 1: Critical Features
# ============================================================================

@app.route('/api/patient-portal/prescriptions/<int:patient_id>', methods=['GET'])
@patient_portal_token_required
def get_patient_prescriptions(patient_id: int):
    """Get patient prescriptions with medication details"""
    try:
        # Verify token matches requested patient ID
        if request.patient_id != patient_id:
            return jsonify({'success': False, 'error': 'Access denied'}), 403
        
        # Query prescriptions with medication details
        query = """
        SELECT 
            p.id, p.medication_id, p.dosage, p.frequency, p.duration, p.instructions,
            p.start_date, p.end_date, p.is_active, p.created_at, p.updated_at,
            m.medication_name, m.generic_name, m.dosage_form, m.strength, m.therapeutic_class,
            pv.visit_date, u.first_name as prescriber_first_name, u.last_name as prescriber_last_name
        FROM prescriptions p
        LEFT JOIN medications m ON p.medication_id = m.id
        LEFT JOIN patient_visits pv ON p.visit_id = pv.id
        LEFT JOIN users u ON p.prescribed_by = u.id
        WHERE p.patient_id = %s
        ORDER BY p.start_date DESC
        LIMIT 100
        """
        
        prescriptions = DatabaseManager.execute_query(query, (patient_id,), fetch=True) or []
        
        prescriptions_data = []
        for rx in prescriptions:
            prescriptions_data.append({
                'id': rx['id'],
                'medication_id': rx['medication_id'],
                'medication_name': rx['medication_name'],
                'generic_name': rx['generic_name'],
                'dosage_form': rx['dosage_form'],
                'strength': rx['strength'],
                'therapeutic_class': rx['therapeutic_class'],
                'dosage': rx['dosage'],
                'frequency': rx['frequency'],
                'duration': rx['duration'],
                'instructions': rx['instructions'],
                'start_date': rx['start_date'].isoformat() if rx['start_date'] else None,
                'end_date': rx['end_date'].isoformat() if rx['end_date'] else None,
                'is_active': bool(rx['is_active']),
                'visit_date': rx['visit_date'].isoformat() if rx['visit_date'] else None,
                'prescriber': f"{rx['prescriber_first_name']} {rx['prescriber_last_name']}" if rx['prescriber_first_name'] else None,
                'created_at': rx['created_at'].isoformat() if rx['created_at'] else None,
                'updated_at': rx['updated_at'].isoformat() if rx['updated_at'] else None
            })
        
        return jsonify({
            'success': True,
            'data': prescriptions_data,
            'count': len(prescriptions_data)
        }), 200
        
    except Exception as e:
        logger.error(f"Get prescriptions error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/patient-portal/test-results/<int:patient_id>', methods=['GET'])
@patient_portal_token_required
def get_patient_test_results(patient_id: int):
    """Get patient laboratory test results"""
    try:
        # Verify token matches requested patient ID
        if request.patient_id != patient_id:
            return jsonify({'success': False, 'error': 'Access denied'}), 403
        
        # Query test results
        query = """
        SELECT 
            tr.id, tr.visit_id, tr.test_code, tr.test_name, tr.result_value, tr.unit,
            tr.reference_range, tr.abnormal_flag, tr.test_date, tr.lab_name,
            tr.created_at, tr.updated_at,
            pv.visit_date, u.first_name as ordered_by_first, u.last_name as ordered_by_last
        FROM test_results tr
        LEFT JOIN patient_visits pv ON tr.visit_id = pv.id
        LEFT JOIN users u ON tr.ordered_by = u.id
        WHERE tr.patient_id = %s
        ORDER BY tr.test_date DESC
        LIMIT 200
        """
        
        test_results = DatabaseManager.execute_query(query, (patient_id,), fetch=True) or []
        
        results_data = []
        for result in test_results:
            results_data.append({
                'id': result['id'],
                'visit_id': result['visit_id'],
                'test_code': result['test_code'],
                'test_name': result['test_name'],
                'result_value': result['result_value'],
                'unit': result['unit'],
                'reference_range': result['reference_range'],
                'abnormal_flag': result['abnormal_flag'],  # L=Low, H=High, C=Critical, N=Normal
                'test_date': result['test_date'].isoformat() if result['test_date'] else None,
                'lab_name': result['lab_name'],
                'visit_date': result['visit_date'].isoformat() if result['visit_date'] else None,
                'ordered_by': f"{result['ordered_by_first']} {result['ordered_by_last']}" if result['ordered_by_first'] else None,
                'created_at': result['created_at'].isoformat() if result['created_at'] else None,
                'updated_at': result['updated_at'].isoformat() if result['updated_at'] else None
            })
        
        return jsonify({
            'success': True,
            'data': results_data,
            'count': len(results_data)
        }), 200
        
    except Exception as e:
        logger.error(f"Get test results error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/patient-portal/medical-reports/<int:patient_id>', methods=['GET'])
@patient_portal_token_required
def get_patient_medical_reports(patient_id: int):
    """Get patient's medical reports from completed clinic visits with clinical notes"""
    try:
        # Verify token matches requested patient ID
        if request.patient_id != patient_id:
            logger.warning(f"Access denied: token patient {request.patient_id} != requested {patient_id}")
            return jsonify({'success': False, 'error': 'Access denied'}), 403
        
        logger.info(f"Retrieving medical reports for patient {patient_id}")
        
        # Get query parameters for filtering
        status = request.args.get('status')  # 'completed' or 'pending'
        from_date = request.args.get('from_date')
        to_date = request.args.get('to_date')
        
        # Build base query to get visits with their clinical notes
        # Note: patient_visits uses 'location' as VARCHAR, not location_id
        query = """
        SELECT DISTINCT
            pv.id as visit_id,
            pv.visit_date,
            pv.visit_time,
            pv.chief_complaint,
            pv.location,
            pv.is_completed,
            COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'Not Assigned') as doctor_name,
            pv.created_at,
            pv.updated_at
        FROM patient_visits pv
        LEFT JOIN users u ON pv.doctor_id = u.id
        WHERE pv.patient_id = %s
        """
        
        params = [patient_id]
        
        # Apply status filter
        if status:
            if status == 'completed':
                query += " AND pv.is_completed = 1"
            elif status == 'pending':
                query += " AND pv.is_completed = 0"
        
        # Apply date range filters
        if from_date:
            query += " AND pv.visit_date >= %s"
            params.append(from_date)
        if to_date:
            query += " AND pv.visit_date <= %s"
            params.append(to_date)
        
        query += " ORDER BY pv.visit_date DESC LIMIT 200"
        
        logger.debug(f"Executing query: {query} with params {params}")
        visits = DatabaseManager.execute_query(query, params, fetch=True) or []
        logger.info(f"Found {len(visits)} visits for patient {patient_id}")
        
        # Format reports data
        reports_data = []
        for visit in visits:
            try:
                visit_id = visit['visit_id']
                
                # Get clinical notes (assessment, diagnosis, treatment, counseling, closure) for this visit
                notes_query = """
                SELECT cn.id, cn.note_type, cn.content, cn.icd10_codes, 
                       cn.medications_prescribed, cn.follow_up_required, cn.follow_up_date,
                       cn.created_at, COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'System') as created_by_name
                FROM clinical_notes cn
                LEFT JOIN users u ON cn.created_by = u.id
                WHERE cn.visit_id = %s
                ORDER BY cn.note_type DESC, cn.created_at DESC
                """
                
                clinical_notes = DatabaseManager.execute_query(notes_query, (visit_id,), fetch=True) or []
                logger.debug(f"Retrieved {len(clinical_notes)} clinical notes for visit {visit_id}")
                
                # Organize notes by type
                notes_by_type = {}
                for note in clinical_notes:
                    note_type = note['note_type'] or 'Other'
                    if note_type not in notes_by_type:
                        notes_by_type[note_type] = []
                    notes_by_type[note_type].append(note)
                
                # Build comprehensive report from clinical workflow
                report_content = {
                    'assessment': None,
                    'diagnosis': None,
                    'treatment': None,
                    'counseling': None,
                    'closure': None,
                }
                
                icd10_codes = []
                medications = []
                follow_up_required = False
                follow_up_date = None
                
                # Extract information from each note type
                for note_type, notes_list in notes_by_type.items():
                    if notes_list:
                        latest_note = notes_list[0]
                        report_content[note_type.lower() if note_type.lower() in report_content else 'closure'] = {
                            'content': latest_note['content'],
                            'created_at': latest_note['created_at'].isoformat() if latest_note['created_at'] else None,
                            'created_by': latest_note['created_by_name'],
                            'follow_up_required': bool(latest_note['follow_up_required']),
                            'follow_up_date': latest_note['follow_up_date'].isoformat() if latest_note['follow_up_date'] else None,
                        }
                        
                        # Collect ICD-10 codes
                        if latest_note['icd10_codes']:
                            try:
                                if isinstance(latest_note['icd10_codes'], str):
                                    codes_list = latest_note['icd10_codes'].split(',')
                                    icd10_codes.extend([c.strip() for c in codes_list if c.strip()])
                                else:
                                    icd10_codes.extend(latest_note['icd10_codes'])
                            except Exception as code_err:
                                logger.warning(f"Error parsing ICD-10 codes: {code_err}")
                        
                        # Collect medications
                        if latest_note['medications_prescribed']:
                            try:
                                meds_data = latest_note['medications_prescribed']
                                if isinstance(meds_data, str):
                                    meds_data = json.loads(meds_data)
                                if isinstance(meds_data, list):
                                    medications.extend(meds_data)
                                else:
                                    medications.append(meds_data)
                            except Exception as med_err:
                                logger.warning(f"Error parsing medications: {med_err}")
                        
                        # Track follow-up
                        if latest_note['follow_up_required']:
                            follow_up_required = True
                            follow_up_date = latest_note['follow_up_date'].isoformat() if latest_note['follow_up_date'] else None
                
                # Remove None values and flatten ICD-10 codes
                report_content = {k: v for k, v in report_content.items() if v is not None}
                icd10_codes = list(set(icd10_codes))  # Remove duplicates
                
                reports_data.append({
                    'id': visit_id,
                    'visit_id': visit_id,
                    'visit_date': visit['visit_date'].isoformat() if visit['visit_date'] else None,
                    'visit_time': visit['visit_time'].isoformat() if visit['visit_time'] else None,
                    'location': visit['location'] or 'Unknown Location',
                    'chief_complaint': visit['chief_complaint'] or '',
                    'is_completed': bool(visit['is_completed']),
                    'doctor_name': visit['doctor_name'],
                    'report_type': 'clinical_visit_summary',
                    'clinical_notes': report_content,
                    'icd10_codes': icd10_codes,
                    'medications': medications,
                    'follow_up_required': follow_up_required,
                    'follow_up_date': follow_up_date,
                    'created_at': visit['created_at'].isoformat() if visit['created_at'] else None,
                    'updated_at': visit['updated_at'].isoformat() if visit['updated_at'] else None
                })
                logger.debug(f"Successfully formatted report for visit {visit_id}")
            except Exception as visit_err:
                logger.error(f"Error processing visit {visit.get('visit_id', 'unknown')}: {str(visit_err)}", exc_info=True)
                # Skip this visit and continue with others
                continue
        
        logger.info(f"Successfully formatted {len(reports_data)} medical reports for patient {patient_id}")
        
        return jsonify({
            'success': True,
            'data': reports_data,
            'count': len(reports_data)
        }), 200
        
    except Exception as e:
        logger.error(f"Get patient medical reports error for patient {patient_id}: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Failed to retrieve medical reports',
            'details': str(e) if app.debug else None
        }), 500


@app.route('/api/patient-portal/medical-records/<int:patient_id>', methods=['GET'])
@patient_portal_token_required
def get_patient_medical_records(patient_id: int):
    """Get patient medical records and history"""
    try:
        # Verify token matches requested patient ID
        if request.patient_id != patient_id:
            return jsonify({'success': False, 'error': 'Access denied'}), 403
        
        # Query medical records
        query = """
        SELECT 
            mr.id, mr.visit_id, mr.record_type, mr.record_date, mr.description,
            mr.icd10_code, mr.severity, mr.status, mr.created_at, mr.updated_at,
            pv.visit_date, pv.chief_complaint,
            u.first_name as provider_first, u.last_name as provider_last,
            l.location_name, l.city, l.province
        FROM medical_records mr
        LEFT JOIN patient_visits pv ON mr.visit_id = pv.id
        LEFT JOIN users u ON mr.provider_id = u.id
        LEFT JOIN locations l ON pv.location_id = l.id
        WHERE mr.patient_id = %s
        ORDER BY mr.record_date DESC
        LIMIT 200
        """
        
        medical_records = DatabaseManager.execute_query(query, (patient_id,), fetch=True) or []
        
        records_data = []
        for record in medical_records:
            records_data.append({
                'id': record['id'],
                'visit_id': record['visit_id'],
                'record_type': record['record_type'],  # diagnosis, procedure, allergy, condition, etc
                'record_date': record['record_date'].isoformat() if record['record_date'] else None,
                'description': record['description'],
                'icd10_code': record['icd10_code'],
                'severity': record['severity'],  # mild, moderate, severe
                'status': record['status'],  # active, resolved, archived
                'visit_date': record['visit_date'].isoformat() if record['visit_date'] else None,
                'chief_complaint': record['chief_complaint'],
                'provider': f"{record['provider_first']} {record['provider_last']}" if record['provider_first'] else None,
                'location': {
                    'name': record['location_name'],
                    'city': record['city'],
                    'province': record['province']
                } if record['location_name'] else None,
                'created_at': record['created_at'].isoformat() if record['created_at'] else None,
                'updated_at': record['updated_at'].isoformat() if record['updated_at'] else None
            })
        
        return jsonify({
            'success': True,
            'data': records_data,
            'count': len(records_data)
        }), 200
        
    except Exception as e:
        logger.error(f"Get medical records error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/patient-portal/documents/<int:patient_id>', methods=['GET'])
@patient_portal_token_required
def get_patient_documents(patient_id: int):
    """Get patient documents and uploaded files"""
    try:
        # Verify token matches requested patient ID
        if request.patient_id != patient_id:
            return jsonify({'success': False, 'error': 'Access denied'}), 403
        
        # Query documents
        query = """
        SELECT 
            d.id,
            d.visit_id,
            d.document_type,
            d.file_name,
            d.file_size,
            d.file_path,
            d.mime_type,
            d.is_confidential,
            d.download_count,
            d.created_at,
            d.updated_at,
            d.specialist_type,
            d.workflow_step,
            d.tags,
            d.notes,
            d.uploaded_by,
            pv.visit_date,
            u.first_name as uploader_first,
            u.last_name as uploader_last
        FROM documents d
        LEFT JOIN patient_visits pv ON d.visit_id = pv.id
        LEFT JOIN users u ON d.uploaded_by = u.id
        WHERE d.patient_id = %s
        ORDER BY d.created_at DESC
        LIMIT 200
        """
        
        documents = DatabaseManager.execute_query(query, (patient_id,), fetch=True) or []
        
        documents_data = []
        for doc in documents:
            tags_value = doc.get('tags')
            if isinstance(tags_value, str):
                try:
                    tags_value = json.loads(tags_value)
                except json.JSONDecodeError:
                    tags_value = [tag.strip() for tag in tags_value.split(',') if tag.strip()]

            documents_data.append({
                'id': doc['id'],
                'visit_id': doc['visit_id'],
                'document_type': doc['document_type'],  # prescription, report, certificate, referral, etc
                'file_name': doc['file_name'],
                'file_size': doc['file_size'],
                'file_path': doc['file_path'],
                'mime_type': doc['mime_type'],
                'is_confidential': bool(doc['is_confidential']),
                'download_count': doc['download_count'] or 0,
                'specialist_type': doc.get('specialist_type'),
                'workflow_step': doc.get('workflow_step'),
                'tags': tags_value,
                'notes': doc.get('notes'),
                'uploaded_by_user_id': doc.get('uploaded_by'),
                'visit_date': doc['visit_date'].isoformat() if doc['visit_date'] else None,
                'uploaded_by': f"{doc['uploader_first']} {doc['uploader_last']}" if doc['uploader_first'] else None,
                'created_at': doc['created_at'].isoformat() if doc['created_at'] else None,
                'updated_at': doc['updated_at'].isoformat() if doc['updated_at'] else None,
                'download_url': f'/api/patient-portal/documents/download/{doc["id"]}'
            })
        
        return jsonify({
            'success': True,
            'data': documents_data,
            'count': len(documents_data)
        }), 200
        
    except Exception as e:
        logger.error(f"Get documents error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/patient-portal/documents/download/<int:document_id>', methods=['GET'])
@patient_portal_token_required
def download_patient_document(document_id: int):
    """Download a patient document file"""
    try:
        # Get document info
        query = """
        SELECT d.id, d.patient_id, d.file_path, d.file_name, d.mime_type, d.is_confidential
        FROM documents d
        WHERE d.id = %s
        """
        
        doc = DatabaseManager.execute_query(query, (document_id,), fetch=True)
        if not doc or len(doc) == 0:
            return jsonify({'success': False, 'error': 'Document not found'}), 404
        
        doc = doc[0]
        
        # Verify access - patient can only download their own documents
        if request.patient_id != doc['patient_id']:
            return jsonify({'success': False, 'error': 'Access denied'}), 403
        
        # For now, return document metadata and URL
        # In production, this would serve the actual file from storage
        return jsonify({
            'success': True,
            'data': {
                'id': doc['id'],
                'file_name': doc['file_name'],
                'mime_type': doc['mime_type'],
                'file_path': doc['file_path'],
                'is_confidential': bool(doc['is_confidential']),
                'message': 'Download URL would be generated in production file storage integration'
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Download document error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/patient-portal/diagnoses/<int:patient_id>', methods=['GET'])
@patient_portal_token_required
def get_patient_diagnoses(patient_id: int):
    """Get patient diagnoses"""
    try:
        # Verify token matches requested patient ID
        if request.patient_id != patient_id:
            return jsonify({'success': False, 'error': 'Access denied'}), 403
        
        # Query diagnoses
        query = """
        SELECT 
            d.id, d.visit_id, d.icd10_code, d.diagnosis_text, d.primary_diagnosis,
            d.certainty_level, d.severity, d.status, d.treatment_plan, d.created_at, d.updated_at,
            pv.visit_date, u.first_name as recorded_by_first, u.last_name as recorded_by_last
        FROM diagnoses d
        LEFT JOIN patient_visits pv ON d.visit_id = pv.id
        LEFT JOIN users u ON d.recorded_by = u.id
        WHERE d.patient_id = %s
        ORDER BY d.primary_diagnosis DESC, d.created_at DESC
        LIMIT 100
        """
        
        diagnoses = DatabaseManager.execute_query(query, (patient_id,), fetch=True) or []
        
        diagnoses_data = []
        for diag in diagnoses:
            diagnoses_data.append({
                'id': diag['id'],
                'visit_id': diag['visit_id'],
                'icd10_code': diag['icd10_code'],
                'diagnosis_text': diag['diagnosis_text'],
                'primary_diagnosis': bool(diag['primary_diagnosis']),
                'certainty_level': diag['certainty_level'],  # confirmed, probable, ruled_out
                'severity': diag['severity'],  # mild, moderate, severe
                'status': diag['status'],  # active, resolved, archived
                'treatment_plan': diag['treatment_plan'],
                'visit_date': diag['visit_date'].isoformat() if diag['visit_date'] else None,
                'recorded_by': f"{diag['recorded_by_first']} {diag['recorded_by_last']}" if diag['recorded_by_first'] else None,
                'created_at': diag['created_at'].isoformat() if diag['created_at'] else None,
                'updated_at': diag['updated_at'].isoformat() if diag['updated_at'] else None
            })
        
        return jsonify({
            'success': True,
            'data': diagnoses_data,
            'count': len(diagnoses_data)
        }), 200
        
    except Exception as e:
        logger.error(f"Get diagnoses error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/patient-portal/visits/details/<int:visit_id>', methods=['GET'])
@patient_portal_token_required
def get_visit_details(visit_id: int):
    """Get detailed information about a specific visit"""
    try:
        # First, get the visit and verify patient access
        visit_query = """
        SELECT pv.id, pv.patient_id, pv.visit_date, pv.chief_complaint, pv.is_completed,
               pv.location_id, pv.created_at, pv.updated_at,
               l.location_name, l.city, l.province, l.address
        FROM patient_visits pv
        LEFT JOIN locations l ON pv.location_id = l.id
        WHERE pv.id = %s
        """
        
        visits = DatabaseManager.execute_query(visit_query, (visit_id,), fetch=True)
        if not visits or len(visits) == 0:
            return jsonify({'success': False, 'error': 'Visit not found'}), 404
        
        visit = visits[0]
        
        # Verify patient access
        if request.patient_id != visit['patient_id']:
            return jsonify({'success': False, 'error': 'Access denied'}), 403
        
        # Get vital signs
        vitals_query = """
        SELECT id, temperature, blood_pressure_systolic, blood_pressure_diastolic,
               heart_rate, respiratory_rate, oxygen_saturation, weight, height, created_at
        FROM vital_signs
        WHERE visit_id = %s
        ORDER BY created_at DESC
        LIMIT 1
        """
        vitals = DatabaseManager.execute_query(vitals_query, (visit_id,), fetch=True) or []
        
        # Get diagnoses
        diagnoses_query = """
        SELECT id, icd10_code, diagnosis_text, primary_diagnosis, severity, status, treatment_plan
        FROM diagnoses
        WHERE visit_id = %s
        ORDER BY primary_diagnosis DESC
        """
        diagnoses = DatabaseManager.execute_query(diagnoses_query, (visit_id,), fetch=True) or []
        
        # Get test results
        tests_query = """
        SELECT id, test_code, test_name, result_value, unit, reference_range, abnormal_flag, test_date
        FROM test_results
        WHERE visit_id = %s
        ORDER BY test_date DESC
        """
        tests = DatabaseManager.execute_query(tests_query, (visit_id,), fetch=True) or []
        
        # Get prescriptions
        rx_query = """
        SELECT p.id, p.medication_id, p.dosage, p.frequency, p.duration, p.instructions, p.start_date, p.end_date,
               m.medication_name, m.strength, m.dosage_form
        FROM prescriptions p
        LEFT JOIN medications m ON p.medication_id = m.id
        WHERE p.visit_id = %s
        """
        prescriptions = DatabaseManager.execute_query(rx_query, (visit_id,), fetch=True) or []
        
        # Get visit workflow stages
        stages_query = """
        SELECT stage_name, status, assigned_to, completed_at
        FROM patient_visit_stages
        WHERE visit_id = %s
        ORDER BY created_at
        """
        stages = DatabaseManager.execute_query(stages_query, (visit_id,), fetch=True) or []
        
        # Compile response
        visit_data = {
            'id': visit['id'],
            'patient_id': visit['patient_id'],
            'visit_date': visit['visit_date'].isoformat() if visit['visit_date'] else None,
            'chief_complaint': visit['chief_complaint'],
            'is_completed': bool(visit['is_completed']),
            'location': {
                'name': visit['location_name'],
                'city': visit['city'],
                'province': visit['province'],
                'address': visit['address']
            } if visit['location_name'] else None,
            'vital_signs': {
                'temperature': vitals[0]['temperature'] if vitals else None,
                'blood_pressure': f"{vitals[0]['blood_pressure_systolic']}/{vitals[0]['blood_pressure_diastolic']}" if vitals else None,
                'heart_rate': vitals[0]['heart_rate'] if vitals else None,
                'respiratory_rate': vitals[0]['respiratory_rate'] if vitals else None,
                'oxygen_saturation': vitals[0]['oxygen_saturation'] if vitals else None,
                'weight': vitals[0]['weight'] if vitals else None,
                'height': vitals[0]['height'] if vitals else None,
                'recorded_at': vitals[0]['created_at'].isoformat() if vitals and vitals[0]['created_at'] else None
            },
            'diagnoses': [
                {
                    'id': d['id'],
                    'icd10_code': d['icd10_code'],
                    'diagnosis_text': d['diagnosis_text'],
                    'primary_diagnosis': bool(d['primary_diagnosis']),
                    'severity': d['severity'],
                    'status': d['status'],
                    'treatment_plan': d['treatment_plan']
                }
                for d in diagnoses
            ],
            'test_results': [
                {
                    'id': t['id'],
                    'test_code': t['test_code'],
                    'test_name': t['test_name'],
                    'result_value': t['result_value'],
                    'unit': t['unit'],
                    'reference_range': t['reference_range'],
                    'abnormal_flag': t['abnormal_flag'],
                    'test_date': t['test_date'].isoformat() if t['test_date'] else None
                }
                for t in tests
            ],
            'prescriptions': [
                {
                    'id': p['id'],
                    'medication_name': p['medication_name'],
                    'dosage': p['dosage'],
                    'frequency': p['frequency'],
                    'duration': p['duration'],
                    'instructions': p['instructions'],
                    'strength': p['strength'],
                    'dosage_form': p['dosage_form'],
                    'start_date': p['start_date'].isoformat() if p['start_date'] else None,
                    'end_date': p['end_date'].isoformat() if p['end_date'] else None
                }
                for p in prescriptions
            ],
            'workflow_stages': [
                {
                    'stage_name': s['stage_name'],
                    'status': s['status'],
                    'completed_at': s['completed_at'].isoformat() if s['completed_at'] else None
                }
                for s in stages
            ],
            'created_at': visit['created_at'].isoformat() if visit['created_at'] else None,
            'updated_at': visit['updated_at'].isoformat() if visit['updated_at'] else None
        }
        
        return jsonify({
            'success': True,
            'data': visit_data
        }), 200
        
    except Exception as e:
        logger.error(f"Get visit details error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/patient-portal/appointments/<int:appointment_id>/book', methods=['POST'])
@patient_portal_token_required
def book_appointment_via_portal(appointment_id: int):
    """Book an available appointment for the patient"""
    try:
        data = request.get_json() or {}
        patient_id = request.patient_id
        
        # Validate appointment exists and is available (using patient_appointments table)
        apt_query = """
        SELECT 
            pa.id,
            pa.route_location_id,
            pa.appointment_date,
            pa.appointment_time,
            pa.status,
            rl.visit_date,
            rl.start_time,
            rl.end_time,
            rl.max_appointments,
            rl.appointment_duration,
            l.location_name,
            l.address,
            l.city
        FROM patient_appointments pa
        LEFT JOIN route_locations rl ON pa.route_location_id = rl.id
        LEFT JOIN locations l ON rl.location_id = l.id
    WHERE pa.id = %s AND (pa.status IS NULL OR LOWER(pa.status) = 'available')
        """
        
        appointments = DatabaseManager.execute_query(apt_query, (appointment_id,), fetch=True)
        if not appointments or len(appointments) == 0:
            return jsonify({'success': False, 'error': 'Appointment not available'}), 404
        
        apt = appointments[0]
        
        # Generate booking reference
        booking_reference = str(uuid.uuid4())
        
        # Update appointment status to Booked
        update_query = """
        UPDATE patient_appointments 
        SET status = 'Booked', 
            booking_reference = %s,
            patient_id = %s,
            updated_at = NOW()
        WHERE id = %s
        """
        
        DatabaseManager.execute_query(update_query, (booking_reference, patient_id, appointment_id))
        
        # Create notification for appointment confirmation
        try:
            apt_date_str = apt['appointment_date'].strftime('%B %d, %Y') if apt['appointment_date'] else 'N/A'
            apt_time_str = apt['appointment_time'].strftime('%H:%M') if apt['appointment_time'] else 'N/A'
            location_str = apt['location_name'] or 'N/A'
            
            notification_title = "Appointment Confirmed"
            notification_message = f"Your appointment on {apt_date_str} at {apt_time_str} has been confirmed. Location: {location_str}. Booking reference: {booking_reference}"
            
            create_patient_notification(
                patient_id=patient_id,
                notification_type='appointment',
                title=notification_title,
                message=notification_message,
                priority='high',
                action_url=f'/patient-portal/appointments/{appointment_id}'
            )
        except Exception as e:
            logger.error(f"Failed to create appointment notification: {e}")
        
        return jsonify({
            'success': True,
            'data': {
                'booking_reference': booking_reference,
                'appointment_id': appointment_id,
                'appointment_date': apt['appointment_date'].isoformat() if apt['appointment_date'] else None,
                'appointment_time': apt['appointment_time'].strftime('%H:%M') if apt['appointment_time'] else None,
                'location': apt['location_name'] or 'N/A',
                'address': apt['address'] or 'N/A',
                'city': apt['city'] or 'N/A',
                'status': 'Booked',
                'message': 'Appointment booked successfully'
            }
        }), 201
        
    except Exception as e:
        logger.error(f"Book appointment error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/patient-portal/appointments/<int:booking_id>/cancel', methods=['POST'])
@patient_portal_token_required
def cancel_appointment_via_portal(booking_id: int):
    """Cancel a booked appointment (booking_id is the appointment_id)"""
    try:
        data = request.get_json() or {}
        patient_id = request.patient_id
        
        # Verify appointment exists and belongs to patient
        apt_query = """
        SELECT id, status, patient_id, booking_reference
        FROM patient_appointments
    WHERE id = %s AND patient_id = %s AND LOWER(status) = 'booked'
        """
        
        appointments = DatabaseManager.execute_query(apt_query, (booking_id, patient_id), fetch=True)
        if not appointments or len(appointments) == 0:
            return jsonify({'success': False, 'error': 'Appointment not found or not booked by you'}), 404
        
        apt = appointments[0]
        
        # Update appointment status back to Available
        update_query = """
        UPDATE patient_appointments 
        SET status = 'Available', 
            patient_id = NULL,
            booking_reference = NULL,
            updated_at = NOW()
        WHERE id = %s
        """
        
        DatabaseManager.execute_query(update_query, (booking_id,))
        
        return jsonify({
            'success': True,
            'data': {
                'appointment_id': booking_id,
                'status': 'Available',
                'message': 'Appointment cancelled successfully'
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Cancel appointment error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/patient-portal/profile/<int:patient_id>', methods=['PUT'])
@patient_portal_token_required
def update_patient_profile(patient_id: int):
    """Update patient profile information"""
    try:
        # Verify token matches requested patient ID
        if request.patient_id != patient_id:
            return jsonify({'success': False, 'error': 'Access denied'}), 403
        
        data = request.get_json() or {}
        
        # Build update query dynamically based on provided fields
        # Note: emergency_contact_relationship is not a field in the patients table - store in emergency_contact_name if needed
        allowed_fields = ['phone_number', 'email', 'physical_address', 'emergency_contact_name', 'emergency_contact_phone', 'date_of_birth']
        update_fields = []
        params = []
        
        for field in allowed_fields:
            if field in data and data[field] is not None:
                update_fields.append(f"{field} = %s")
                params.append(data[field])
        
        if not update_fields:
            return jsonify({'success': False, 'error': 'No fields to update'}), 400
        
        params.append(patient_id)
        
        query = f"""
        UPDATE patients 
        SET {', '.join(update_fields)}, updated_at = NOW()
        WHERE id = %s
        """
        
        logger.info(f"Updating patient {patient_id} profile with fields: {update_fields}")
        DatabaseManager.execute_query(query, params)
        
        # Fetch updated patient data to return
        fetch_query = """
        SELECT id, phone_number, email, physical_address, emergency_contact_name, 
               emergency_contact_phone, date_of_birth, updated_at
        FROM patients
        WHERE id = %s
        """
        updated_patient = DatabaseManager.execute_query(fetch_query, (patient_id,), fetch=True)
        
        return jsonify({
            'success': True,
            'message': 'Profile updated successfully',
            'data': {
                'updated': True,
                'patient': updated_patient[0] if updated_patient else None
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Update profile error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': f'Failed to update profile: {str(e)}'}), 500


@app.route('/api/patient-portal/password/change', methods=['POST'])
@patient_portal_token_required
def change_patient_password():
    """Change patient password"""
    try:
        data = request.get_json() or {}
        patient_id = request.patient_id
        
        # Validate required fields
        if not data.get('current_password') or not data.get('new_password'):
            return jsonify({'success': False, 'error': 'Current and new password are required'}), 400
        
        # Get patient user record
        query = """
        SELECT pu.id, pu.password_hash
        FROM patient_users pu
        WHERE pu.patient_id = %s
        """
        
        users = DatabaseManager.execute_query(query, (patient_id,), fetch=True)
        if not users or len(users) == 0:
            return jsonify({'success': False, 'error': 'Patient account not found'}), 404
        
        user = users[0]
        
        # Verify current password
        from werkzeug.security import check_password_hash, generate_password_hash
        if not check_password_hash(user['password_hash'], data.get('current_password', '')):
            return jsonify({'success': False, 'error': 'Current password is incorrect'}), 401
        
        # Validate new password strength
        if len(data.get('new_password', '')) < 8:
            return jsonify({'success': False, 'error': 'New password must be at least 8 characters'}), 400
        
        # Update password
        new_hash = generate_password_hash(data['new_password'])
        update_query = """
        UPDATE patient_users 
        SET password_hash = %s, updated_at = NOW()
        WHERE patient_id = %s
        """
        
        DatabaseManager.execute_query(update_query, (new_hash, patient_id))
        
        return jsonify({
            'success': True,
            'data': {'changed': True}
        }), 200
        
    except Exception as e:
        logger.error(f"Change password error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/patient-portal/password/forgot', methods=['POST'])
def forgot_patient_password():
    """Request password reset for patient"""
    try:
        data = request.get_json() or {}
        email = data.get('email', '').strip().lower()
        
        if not email:
            return jsonify({'success': False, 'error': 'Email is required'}), 400
        
        # Find patient user with this email
        query = """
        SELECT pu.id, pu.patient_id, p.email
        FROM patient_users pu
        JOIN patients p ON pu.patient_id = p.id
        WHERE p.email = %s
        """
        
        users = DatabaseManager.execute_query(query, (email,), fetch=True)
        if not users or len(users) == 0:
            # Don't reveal if email exists (security best practice)
            return jsonify({
                'success': True,
                'data': {'reset_sent': True, 'message': 'If email exists, reset link will be sent'}
            }), 200
        
        user = users[0]
        
        # Generate reset token (valid for 24 hours)
        import secrets
        reset_token = secrets.token_urlsafe(32)
        token_expiry = datetime.now() + timedelta(hours=24)
        
        # Store token in database
        insert_query = """
        INSERT INTO password_reset_tokens (patient_user_id, token, expires_at, created_at)
        VALUES (%s, %s, %s, NOW())
        """
        
        DatabaseManager.execute_query(insert_query, (user['id'], reset_token, token_expiry))
        
        # In production, send email with reset link
        # email_service.send_password_reset_email(email, reset_token)
        
        logger.info(f"Password reset requested for patient user {user['id']}")
        
        return jsonify({
            'success': True,
            'data': {'reset_sent': True}
        }), 200
        
    except Exception as e:
        logger.error(f"Forgot password error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/patient-portal/password/reset', methods=['POST'])
def reset_patient_password():
    """Reset patient password using reset token"""
    try:
        data = request.get_json() or {}
        reset_token = data.get('reset_token', '').strip()
        new_password = data.get('new_password', '')
        
        if not reset_token or not new_password:
            return jsonify({'success': False, 'error': 'Reset token and new password are required'}), 400
        
        if len(new_password) < 8:
            return jsonify({'success': False, 'error': 'Password must be at least 8 characters'}), 400
        
        # Find valid reset token
        query = """
        SELECT id, patient_user_id, expires_at
        FROM password_reset_tokens
        WHERE token = %s AND expires_at > NOW() AND used_at IS NULL
        """
        
        tokens = DatabaseManager.execute_query(query, (reset_token,), fetch=True)
        if not tokens or len(tokens) == 0:
            return jsonify({'success': False, 'error': 'Invalid or expired reset token'}), 401
        
        token_record = tokens[0]
        
        # Update password
        from werkzeug.security import generate_password_hash
        new_hash = generate_password_hash(new_password)
        
        update_query = """
        UPDATE patient_users 
        SET password_hash = %s, updated_at = NOW()
        WHERE id = %s
        """
        
        DatabaseManager.execute_query(update_query, (new_hash, token_record['patient_user_id']))
        
        # Mark token as used
        mark_used_query = """
        UPDATE password_reset_tokens 
        SET used_at = NOW()
        WHERE id = %s
        """
        
        DatabaseManager.execute_query(mark_used_query, (token_record['id'],))
        
        return jsonify({
            'success': True,
            'data': {'reset': True}
        }), 200
        
    except Exception as e:
        logger.error(f"Reset password error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/patient-portal/verify-email', methods=['POST'])
def verify_patient_email():
    """Verify patient email address"""
    try:
        data = request.get_json() or {}
        verification_token = data.get('verification_token', '').strip()
        
        if not verification_token:
            return jsonify({'success': False, 'error': 'Verification token is required'}), 400
        
        # Find patient user with this verification token
        query = """
        SELECT pu.id, pu.patient_id
        FROM patient_users pu
        WHERE pu.verification_token = %s AND pu.is_verified = 0
        """
        
        users = DatabaseManager.execute_query(query, (verification_token,), fetch=True)
        if not users or len(users) == 0:
            return jsonify({'success': False, 'error': 'Invalid or already verified token'}), 401
        
        user = users[0]
        
        # Mark as verified
        update_query = """
        UPDATE patient_users 
        SET is_verified = 1, verified_at = NOW(), updated_at = NOW()
        WHERE id = %s
        """
        
        DatabaseManager.execute_query(update_query, (user['id'],))
        
        return jsonify({
            'success': True,
            'data': {'verified': True}
        }), 200
        
    except Exception as e:
        logger.error(f"Verify email error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/patient-portal/validate-membership', methods=['POST'])
def validate_polmed_membership():
    """Validate POLMED membership"""
    try:
        data = request.get_json() or {}
        polmed_number = data.get('polmed_number', '').strip() if data.get('polmed_number') else None
        medical_aid_number = data.get('medical_aid_number', '').strip() if data.get('medical_aid_number') else None
        
        if not polmed_number and not medical_aid_number:
            return jsonify({'success': False, 'error': 'POLMED number or medical aid number is required'}), 400
        
        # Check against POLMED members (in production, this would call external POLMED API)
        query = """
        SELECT id, first_name, last_name, date_of_birth, email, member_type
        FROM polmed_members
        WHERE (polmed_member_number = %s OR medical_aid_number = %s)
        LIMIT 1
        """
        
        search_value = polmed_number or medical_aid_number
        members = DatabaseManager.execute_query(query, (polmed_number, medical_aid_number), fetch=True)
        
        if members and len(members) > 0:
            member = members[0]
            return jsonify({
                'success': True,
                'data': {
                    'is_valid': True,
                    'member_type': member.get('member_type', 'active'),
                    'first_name': member.get('first_name'),
                    'last_name': member.get('last_name'),
                    'validation_message': 'Member found in POLMED database'
                }
            }), 200
        
        return jsonify({
            'success': True,
            'data': {
                'is_valid': False,
                'validation_message': 'Member not found - may be private patient'
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Validate membership error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@app.route('/api/patient/auth/register', methods=['POST'])
def register_patient_via_portal():
    """Register new patient via patient portal"""
    try:
        data = request.get_json() or {}
        
        # Validate required fields
        required_fields = ['email', 'password', 'first_name', 'last_name', 'mobile_number', 'date_of_birth']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'error': f'{field} is required'}), 400
        
        email = data.get('email', '').strip().lower()
        
        # Check if email already exists
        check_query = """
        SELECT id FROM patient_users WHERE email = %s
        """
        
        existing = DatabaseManager.execute_query(check_query, (email,), fetch=True)
        if existing and len(existing) > 0:
            return jsonify({'success': False, 'error': 'Email already registered'}), 409
        
        # Create patient record
        from werkzeug.security import generate_password_hash
        import secrets
        
        password_hash = generate_password_hash(data['password'])
        verification_token = secrets.token_urlsafe(32)
        
        # First, create patient in patients table
        patient_query = """
        INSERT INTO patients (
            first_name, last_name, date_of_birth, gender, phone_number, email,
            is_palmed_member, medical_aid_number, member_type, status, created_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'active', NOW())
        """
        
        patient_params = (
            data['first_name'],
            data['last_name'],
            data.get('date_of_birth'),
            data.get('gender', 'Not specified'),
            data['mobile_number'],
            email,
            bool(data.get('polmed_number')),
            data.get('polmed_number') or data.get('medical_aid_number'),
            data.get('member_type', 'individual')
        )
        
        result = DatabaseManager.execute_query(patient_query, patient_params)
        
        # Get the inserted patient ID
        get_id_query = "SELECT id FROM patients WHERE email = %s ORDER BY id DESC LIMIT 1"
        patients = DatabaseManager.execute_query(get_id_query, (email,), fetch=True)
        
        if not patients or len(patients) == 0:
            return jsonify({'success': False, 'error': 'Failed to create patient record'}), 500
        
        patient_id = patients[0]['id']
        
        # Create patient user record
        user_query = """
        INSERT INTO patient_users (
            patient_id, email, password_hash, verification_token,
            is_verified, last_login, created_at
        ) VALUES (%s, %s, %s, %s, 0, NULL, NOW())
        """
        
        user_params = (patient_id, email, password_hash, verification_token)
        DatabaseManager.execute_query(user_query, user_params)
        
        # In production, send verification email with token
        # email_service.send_verification_email(email, verification_token)
        
        logger.info(f"New patient registered: {patient_id} ({email})")
        
        return jsonify({
            'success': True,
            'data': {
                'patient_id': patient_id,
                'requires_verification': True,
                'message': 'Registration successful. Please verify your email.'
            }
        }), 201
        
    except Exception as e:
        logger.error(f"Patient registration error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


if __name__ == '__main__':
    # Disable the reloader to avoid SystemExit in debuggers (parent process exit).
    app.run(debug=True, host='0.0.0.0', port=5000, use_reloader=False)# Force deployment 10/15/2025 16:58:42
