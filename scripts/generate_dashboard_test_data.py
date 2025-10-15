#!/usr/bin/env python3
"""
Generate test data for dashboard functionality
Creates sample patients, visits, appointments, and other data for testing dashboard stats
"""

import mysql.connector
from mysql.connector import Error
import os
from datetime import datetime, timedelta
import random
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database configuration
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

class TestDataGenerator:
    """Generate test data for dashboard"""
    
    @staticmethod
    def get_connection():
        try:
            connection = mysql.connector.connect(**DB_CONFIG)
            if connection.is_connected():
                return connection
        except Error as e:
            logger.error(f"Database connection error: {e}")
            return None
    
    @staticmethod
    def execute_query(query: str, params: tuple = None, fetch: bool = False):
        connection = TestDataGenerator.get_connection()
        if not connection:
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
            return None
        finally:
            if connection and connection.is_connected():
                cursor.close()
                connection.close()

def get_test_users():
    """Get test users for creating test data"""
    query = """
    SELECT u.id, u.email, ur.role_name 
    FROM users u 
    JOIN user_roles ur ON u.role_id = ur.id 
    WHERE u.email LIKE '%test@polmed.co.za'
    """
    return TestDataGenerator.execute_query(query, fetch=True)

def get_locations():
    """Get available locations"""
    query = "SELECT id, name FROM locations LIMIT 10"
    return TestDataGenerator.execute_query(query, fetch=True)

def create_test_patients():
    """Create sample patients"""
    print("\n👥 Creating test patients...")
    
    # Get clerk user for created_by
    users = get_test_users()
    clerk_user = next((u for u in users if 'clerk' in u['role_name'].lower()), None)
    if not clerk_user:
        print("❌ No clerk user found - using admin user")
        admin_user = next((u for u in users if 'admin' in u['role_name'].lower()), None)
        clerk_user = admin_user if admin_user else {'id': 1}
    
    patients_data = [
        {
            'medical_aid_number': 'TEST001',
            'full_name': 'John Test Patient',
            'physical_address': '123 Test Street, Cape Town',
            'telephone_number': '+27123456001',
            'email': 'john.test@example.com',
            'date_of_birth': '1980-05-15',
            'gender': 'Male',
            'status': 'Active'
        },
        {
            'medical_aid_number': 'TEST002',
            'full_name': 'Mary Test Patient',
            'physical_address': '456 Demo Avenue, Johannesburg',
            'telephone_number': '+27123456002',
            'email': 'mary.test@example.com',
            'date_of_birth': '1975-08-22',
            'gender': 'Female',
            'status': 'Active'
        },
        {
            'medical_aid_number': 'TEST003',
            'full_name': 'David Test Patient',
            'physical_address': '789 Sample Road, Durban',
            'telephone_number': '+27123456003',
            'email': 'david.test@example.com',
            'date_of_birth': '1990-12-03',
            'gender': 'Male',
            'status': 'Active'
        },
        {
            'medical_aid_number': 'TEST004',
            'full_name': 'Sarah Test Patient',
            'physical_address': '321 Example Lane, Pretoria',
            'telephone_number': '+27123456004',
            'email': 'sarah.test@example.com',
            'date_of_birth': '1985-03-18',
            'gender': 'Female',
            'status': 'Active'
        },
        {
            'medical_aid_number': 'TEST005',
            'full_name': 'Mike Test Patient',
            'physical_address': '654 Trial Street, Port Elizabeth',
            'telephone_number': '+27123456005',
            'email': 'mike.test@example.com',
            'date_of_birth': '1978-07-12',
            'gender': 'Male',
            'status': 'Active'
        }
    ]
    
    created_count = 0
    for patient in patients_data:
        # Check if patient already exists
        existing = TestDataGenerator.execute_query(
            "SELECT id FROM patients WHERE medical_aid_number = %s",
            (patient['medical_aid_number'],),
            fetch=True
        )
        
        if existing:
            print(f"  ⏭️ Patient {patient['medical_aid_number']} already exists")
            continue
        
        query = """
        INSERT INTO patients (
            medical_aid_number, full_name, physical_address, telephone_number, 
            email, date_of_birth, gender, status, created_by, created_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        result = TestDataGenerator.execute_query(query, (
            patient['medical_aid_number'],
            patient['full_name'],
            patient['physical_address'],
            patient['telephone_number'],
            patient['email'],
            patient['date_of_birth'],
            patient['gender'],
            patient['status'],
            clerk_user['id'],
            datetime.now()
        ))
        
        if result:
            created_count += 1
            print(f"  ✅ Created patient: {patient['full_name']}")
        else:
            print(f"  ❌ Failed to create patient: {patient['full_name']}")
    
    print(f"Created {created_count} new patients")
    return created_count > 0

def create_test_visits():
    """Create sample patient visits"""
    print("\n🏥 Creating test patient visits...")
    
    # Get patients and users
    patients = TestDataGenerator.execute_query("SELECT id FROM patients LIMIT 10", fetch=True)
    users = get_test_users()
    locations = get_locations()
    
    if not patients:
        print("❌ No patients found - create patients first")
        return False
    
    if not locations:
        print("❌ No locations found - cannot create visits")
        return False
    
    doctor_user = next((u for u in users if 'doctor' in u['role_name'].lower()), None)
    nurse_user = next((u for u in users if 'nurse' in u['role_name'].lower()), None)
    
    created_count = 0
    
    # Create visits for the last 30 days
    for i in range(15):  # Create 15 visits
        visit_date = datetime.now() - timedelta(days=random.randint(0, 30))
        patient = random.choice(patients)
        location = random.choice(locations)
        
        query = """
        INSERT INTO patient_visits (
            patient_id, location_id, visit_date, visit_type, status,
            doctor_id, nurse_id, created_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        visit_types = ['Routine Checkup', 'Follow-up', 'Screening', 'Emergency', 'Consultation']
        statuses = ['Completed', 'In Progress', 'Scheduled']
        
        result = TestDataGenerator.execute_query(query, (
            patient['id'],
            location['id'],
            visit_date.date(),
            random.choice(visit_types),
            random.choice(statuses),
            doctor_user['id'] if doctor_user else None,
            nurse_user['id'] if nurse_user else None,
            visit_date
        ))
        
        if result:
            created_count += 1
    
    print(f"Created {created_count} patient visits")
    return created_count > 0

def create_test_appointments():
    """Create sample appointments"""
    print("\n📅 Creating test appointments...")
    
    patients = TestDataGenerator.execute_query("SELECT id FROM patients LIMIT 10", fetch=True)
    locations = get_locations()
    
    if not patients or not locations:
        print("❌ Need patients and locations to create appointments")
        return False
    
    created_count = 0
    
    # Create appointments for future dates
    for i in range(10):
        appt_date = datetime.now() + timedelta(days=random.randint(1, 30))
        patient = random.choice(patients)
        location = random.choice(locations)
        
        query = """
        INSERT INTO appointments (
            patient_id, location_id, appointment_date, appointment_time,
            status, appointment_type, booked_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        
        appt_types = ['Consultation', 'Screening', 'Follow-up', 'Vaccination']
        statuses = ['Booked', 'Confirmed', 'Pending']
        
        # Random time between 8 AM and 4 PM
        hour = random.randint(8, 16)
        minute = random.choice([0, 15, 30, 45])
        appt_time = f"{hour:02d}:{minute:02d}:00"
        
        result = TestDataGenerator.execute_query(query, (
            patient['id'],
            location['id'],
            appt_date.date(),
            appt_time,
            random.choice(statuses),
            random.choice(appt_types),
            datetime.now() - timedelta(days=random.randint(0, 7))
        ))
        
        if result:
            created_count += 1
    
    print(f"Created {created_count} appointments")
    return created_count > 0

def create_test_routes():
    """Create sample routes if table exists"""
    print("\n🚐 Creating test routes...")
    
    # Check if routes table exists
    table_check = TestDataGenerator.execute_query(
        "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = %s AND table_name = 'routes'",
        (DB_CONFIG['database'],),
        fetch=True
    )
    
    if not table_check or table_check[0]['count'] == 0:
        print("  ⏭️ Routes table doesn't exist - skipping")
        return True
    
    locations = get_locations()
    if not locations:
        print("❌ No locations available for routes")
        return False
    
    routes_data = [
        {
            'name': 'Northern Circuit',
            'description': 'Route covering northern townships',
            'status': 'Active'
        },
        {
            'name': 'Southern Circuit', 
            'description': 'Route covering southern areas',
            'status': 'Active'
        },
        {
            'name': 'Eastern Route',
            'description': 'Route covering eastern districts',
            'status': 'Active'
        }
    ]
    
    created_count = 0
    for route in routes_data:
        # Check if route exists
        existing = TestDataGenerator.execute_query(
            "SELECT id FROM routes WHERE name = %s",
            (route['name'],),
            fetch=True
        )
        
        if existing:
            print(f"  ⏭️ Route {route['name']} already exists")
            continue
        
        query = """
        INSERT INTO routes (name, description, status, created_at)
        VALUES (%s, %s, %s, %s)
        """
        
        result = TestDataGenerator.execute_query(query, (
            route['name'],
            route['description'],
            route['status'],
            datetime.now()
        ))
        
        if result:
            created_count += 1
            print(f"  ✅ Created route: {route['name']}")
    
    print(f"Created {created_count} routes")
    return True

def main():
    """Main function to generate all test data"""
    print("=" * 80)
    print("🧪 POLMED Dashboard Test Data Generator")
    print(f"Database: {DB_CONFIG['host']}/{DB_CONFIG['database']}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    # Test database connection
    connection = TestDataGenerator.get_connection()
    if not connection:
        print("❌ Database connection failed!")
        return False
    else:
        print("✅ Database connection successful")
        connection.close()
    
    # Check if test users exist
    users = get_test_users()
    if not users:
        print("❌ No test users found! Run create_test_users.py first")
        return False
    else:
        print(f"✅ Found {len(users)} test users")
        for user in users:
            print(f"  • {user['email']} ({user['role_name']})")
    
    print(f"\n{'='*60}")
    print("🏗️ Generating Test Data")
    print(f"{'='*60}")
    
    success_count = 0
    total_operations = 4
    
    # Create test data
    if create_test_patients():
        success_count += 1
    
    if create_test_visits():
        success_count += 1
    
    if create_test_appointments():
        success_count += 1
    
    if create_test_routes():
        success_count += 1
    
    print(f"\n{'='*80}")
    print("📊 TEST DATA GENERATION SUMMARY")
    print(f"{'='*80}")
    print(f"Successful operations: {success_count}/{total_operations}")
    print(f"Success rate: {(success_count/total_operations)*100:.1f}%")
    
    if success_count == total_operations:
        print("\n✅ All test data generated successfully!")
        print("✅ Dashboard should now display meaningful statistics")
        print("\n💡 Next steps:")
        print("  1. Run test_dashboard_stats.py to verify API responses")
        print("  2. Check your frontend dashboard for updated stats")
    elif success_count > 0:
        print("\n⚠️ Partial success - some test data was created")
        print("  • Dashboard may show some statistics")
        print("  • Consider running this script again to complete missing data")
    else:
        print("\n❌ Failed to generate test data")
        print("  • Check database permissions and table structure")
        print("  • Ensure all required tables exist")
    
    return success_count == total_operations

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)