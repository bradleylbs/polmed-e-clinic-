#!/usr/bin/env python3
"""
Script to diagnose check-in issue for patient ID 38
Tests database connection, workflow_stages, and patient_visits table
"""

import mysql.connector
from mysql.connector import Error
from datetime import datetime
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database configuration (from create_test_users.py)
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'db-polmed.mysql.database.azure.com'),
    'database': os.environ.get('DB_NAME', 'palmed_clinic_erp'),
    'user': os.environ.get('DB_USER', 'dbadmin'),
    'password': os.environ.get('DB_PASSWORD', 'Polm3d!DB@2025'),
    'port': int(os.environ.get('DB_PORT', 3306)),
    'autocommit': False,
    'use_unicode': True,
    'charset': 'utf8mb4',
    'ssl_disabled': False,
    'ssl_verify_cert': False,
    'ssl_verify_identity': False
}

class DatabaseManager:
    """Database connection and query management"""
    
    @staticmethod
    def get_connection():
        try:
            connection = mysql.connector.connect(**DB_CONFIG)
            if connection.is_connected():
                logger.info("✓ Database connection successful")
                return connection
        except Error as e:
            logger.error(f"❌ Database connection error: {e}")
            return None
    
    @staticmethod
    def execute_query(query: str, params: tuple = None, fetch: bool = False):
        connection = DatabaseManager.get_connection()
        if not connection:
            logger.error("No database connection available")
            return None
        
        try:
            cursor = connection.cursor(dictionary=True)
            cursor.execute(query, params or ())
            
            if fetch:
                result = cursor.fetchall()
            else:
                connection.commit()
                result = cursor.rowcount
            
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


def test_database_connection():
    """Test basic database connection"""
    print("\n" + "="*60)
    print("TEST 1: Database Connection")
    print("="*60)
    
    connection = DatabaseManager.get_connection()
    if connection:
        print("✓ Successfully connected to database")
        db_info = connection.get_server_info()
        print(f"✓ MySQL Server version: {db_info}")
        connection.close()
        return True
    else:
        print("❌ Failed to connect to database")
        return False


def test_patient_exists():
    """Check if patient 38 exists"""
    print("\n" + "="*60)
    print("TEST 2: Patient Existence (ID: 38)")
    print("="*60)
    
    query = "SELECT id, first_name, last_name, medical_aid_number FROM patients WHERE id = %s"
    result = DatabaseManager.execute_query(query, (38,), fetch=True)
    
    if result and len(result) > 0:
        patient = result[0]
        print(f"✓ Patient found:")
        print(f"  - ID: {patient['id']}")
        print(f"  - Name: {patient['first_name']} {patient['last_name']}")
        print(f"  - Medical Aid: {patient['medical_aid_number']}")
        return True
    else:
        print("❌ Patient 38 not found in database")
        return False


def test_workflow_stages():
    """Check if workflow_stages table exists and has data"""
    print("\n" + "="*60)
    print("TEST 3: Workflow Stages Configuration")
    print("="*60)
    
    # Check if table exists
    query = """
    SELECT COUNT(*) as table_exists 
    FROM information_schema.tables 
    WHERE table_schema = %s AND table_name = 'workflow_stages'
    """
    result = DatabaseManager.execute_query(query, (DB_CONFIG['database'],), fetch=True)
    
    if not result or result[0]['table_exists'] == 0:
        print("❌ workflow_stages table does NOT exist")
        return False
    
    print("✓ workflow_stages table exists")
    
    # Check if table has data
    query = "SELECT id, stage_name, stage_order, required_role_id FROM workflow_stages ORDER BY stage_order"
    stages = DatabaseManager.execute_query(query, fetch=True)
    
    if stages and len(stages) > 0:
        print(f"✓ Found {len(stages)} workflow stages:")
        for stage in stages:
            print(f"  - ID: {stage['id']}, Order: {stage['stage_order']}, Name: {stage['stage_name']}, Role ID: {stage['required_role_id']}")
        return True
    else:
        print("❌ workflow_stages table is EMPTY - This is the problem!")
        print("   The check-in endpoint requires at least one workflow stage.")
        return False


def test_user_exists():
    """Check if there are any users (needed for created_by field)"""
    print("\n" + "="*60)
    print("TEST 4: User Accounts")
    print("="*60)
    
    query = "SELECT id, username, email FROM users LIMIT 5"
    users = DatabaseManager.execute_query(query, fetch=True)
    
    if users and len(users) > 0:
        print(f"✓ Found {len(users)} users (showing first 5):")
        for user in users:
            print(f"  - ID: {user['id']}, Username: {user['username']}, Email: {user['email']}")
        return True
    else:
        print("❌ No users found in database")
        return False


def test_existing_visits_today():
    """Check if patient 38 already has a visit today"""
    print("\n" + "="*60)
    print("TEST 5: Existing Visits Today for Patient 38")
    print("="*60)
    
    today = datetime.now().date()
    query = """
    SELECT id, visit_date, visit_time, location, is_completed 
    FROM patient_visits 
    WHERE patient_id = %s AND visit_date = %s
    """
    visits = DatabaseManager.execute_query(query, (38, today), fetch=True)
    
    if visits and len(visits) > 0:
        print(f"⚠️  Patient 38 already has {len(visits)} visit(s) today:")
        for visit in visits:
            status = "Completed" if visit['is_completed'] else "In Progress"
            print(f"  - Visit ID: {visit['id']}, Time: {visit['visit_time']}, Location: {visit['location']}, Status: {status}")
        return True
    else:
        print("✓ No existing visits today for patient 38")
        return False


def test_patient_visits_schema():
    """Check patient_visits table structure"""
    print("\n" + "="*60)
    print("TEST 6: patient_visits Table Schema")
    print("="*60)
    
    query = "SHOW COLUMNS FROM patient_visits"
    columns = DatabaseManager.execute_query(query, fetch=True)
    
    if columns:
        print("✓ patient_visits table structure:")
        required_fields = ['patient_id', 'visit_date', 'visit_time', 'created_by']
        optional_fields = ['current_stage_id', 'route_id', 'location']
        
        for col in columns:
            field_name = col['Field']
            field_type = col['Type']
            is_null = col['Null']
            
            if field_name in required_fields:
                print(f"  ✓ {field_name:<20} {field_type:<20} NULL: {is_null}")
            elif field_name in optional_fields:
                print(f"    {field_name:<20} {field_type:<20} NULL: {is_null}")
        
        return True
    else:
        print("❌ Could not retrieve patient_visits schema")
        return False


def create_sample_workflow_stages():
    """Create sample workflow stages if table is empty"""
    print("\n" + "="*60)
    print("OPTIONAL: Create Sample Workflow Stages")
    print("="*60)
    
    # First, get role IDs
    query = "SELECT id, role_name FROM user_roles ORDER BY id"
    roles = DatabaseManager.execute_query(query, fetch=True)
    
    if not roles:
        print("❌ Cannot create workflow stages - no roles found")
        return False
    
    print("Available roles:")
    role_map = {}
    for role in roles:
        print(f"  - ID: {role['id']}, Name: {role['role_name']}")
        role_map[role['role_name']] = role['id']
    
    # Define workflow stages
    stages = [
        ('Check-in', 1, 'clerk'),
        ('Nursing Assessment', 2, 'nurse'),
        ('Doctor Consultation', 3, 'doctor'),
        ('Counseling', 4, 'social worker'),
        ('File Closure', 5, 'nurse'),
    ]
    
    print("\nDo you want to create these workflow stages?")
    for stage_name, order, role_name in stages:
        role_id = role_map.get(role_name, role_map.get('clerk', 1))
        print(f"  {order}. {stage_name} (Role: {role_name}, ID: {role_id})")
    
    response = input("\nCreate stages? (yes/no): ").strip().lower()
    
    if response == 'yes':
        connection = DatabaseManager.get_connection()
        if not connection:
            return False
        
        try:
            cursor = connection.cursor()
            for stage_name, order, role_name in stages:
                role_id = role_map.get(role_name, role_map.get('clerk', 1))
                query = """
                INSERT INTO workflow_stages (stage_name, stage_order, required_role_id, is_mandatory)
                VALUES (%s, %s, %s, %s)
                """
                cursor.execute(query, (stage_name, order, role_id, True))
            
            connection.commit()
            print(f"✓ Successfully created {len(stages)} workflow stages")
            cursor.close()
            connection.close()
            return True
        except Error as e:
            print(f"❌ Error creating workflow stages: {e}")
            connection.rollback()
            return False
    else:
        print("Skipped workflow stage creation")
        return False


def main():
    """Run all diagnostic tests"""
    print("="*60)
    print("POLMED CLINIC - Check-in Issue Diagnostic Tool")
    print("Patient ID: 38")
    print("="*60)
    
    results = {
        'Database Connection': test_database_connection(),
        'Patient Exists': test_patient_exists(),
        'Workflow Stages': test_workflow_stages(),
        'User Accounts': test_user_exists(),
        'Existing Visits': test_existing_visits_today(),
        'Table Schema': test_patient_visits_schema(),
    }
    
    # Summary
    print("\n" + "="*60)
    print("DIAGNOSTIC SUMMARY")
    print("="*60)
    
    for test_name, passed in results.items():
        status = "✓ PASS" if passed else "❌ FAIL"
        print(f"{test_name:<30} {status}")
    
    # Recommendations
    print("\n" + "="*60)
    print("RECOMMENDATIONS")
    print("="*60)
    
    if not results['Workflow Stages']:
        print("❌ CRITICAL: workflow_stages table is empty!")
        print("   This is causing the 500 error when checking in patients.")
        print("   ")
        print("   Solutions:")
        print("   1. Run the optional workflow stage creation above")
        print("   2. OR modify the backend to allow NULL current_stage_id")
        print("   3. OR populate workflow_stages from your data migration")
        create_sample_workflow_stages()
    else:
        print("✓ All critical checks passed!")
        print("  The check-in should work now.")
    
    if results.get('Existing Visits'):
        print("\n⚠️  Patient 38 already has a visit today.")
        print("   Delete it first if you want to test check-in again:")
        print("   DELETE FROM patient_visits WHERE patient_id = 38 AND visit_date = CURDATE();")


if __name__ == "__main__":
    main()
