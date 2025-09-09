#!/usr/bin/env python3
"""
Script to create test user accounts for PALMED Mobile Clinic ERP
Uses existing roles and data structure from the database
"""

import mysql.connector
from mysql.connector import Error
from werkzeug.security import generate_password_hash
from datetime import datetime
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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

# Test users data - using exact role names from your data
TEST_USERS = [
    {
        'username': 'admin_test',
        'email': 'admin.test@palmed.co.za',
        'password': 'admin123',
        'first_name': 'Test',
        'last_name': 'Administrator',
        'role_name': 'Administrator',
        'phone_number': '+27123456789',
        'geographic_restrictions': '["National"]',
        'mp_number': None,
        'is_active': True,
        'requires_approval': False
    },
    {
        'username': 'doctor_test',
        'email': 'doctor.test@palmed.co.za',
        'password': 'doctor123',
        'first_name': 'Dr. John',
        'last_name': 'Smith',
        'role_name': 'Doctor',
        'phone_number': '+27123456790',
        'geographic_restrictions': '["KwaZulu-Natal"]',
        'mp_number': 'MP123456',
        'is_active': True,
        'requires_approval': False
    },
    {
        'username': 'nurse_test',
        'email': 'nurse.test@palmed.co.za',
        'password': 'nurse123',
        'first_name': 'Mary',
        'last_name': 'Johnson',
        'role_name': 'Nurse',
        'phone_number': '+27123456791',
        'geographic_restrictions': '["KwaZulu-Natal"]',
        'mp_number': None,
        'is_active': True,
        'requires_approval': False
    },
    {
        'username': 'clerk_test',
        'email': 'clerk.test@palmed.co.za',
        'password': 'clerk123',
        'first_name': 'Sarah',
        'last_name': 'Williams',
        'role_name': 'Clerk',
        'phone_number': '+27123456792',
        'geographic_restrictions': '["KwaZulu-Natal"]',
        'mp_number': None,
        'is_active': True,
        'requires_approval': False
    },
    {
        'username': 'social_test',
        'email': 'social.test@palmed.co.za',
        'password': 'social123',
        'first_name': 'David',
        'last_name': 'Brown',
        'role_name': 'Social Worker',
        'phone_number': '+27123456793',
        'geographic_restrictions': '["KwaZulu-Natal"]',
        'mp_number': None,
        'is_active': True,
        'requires_approval': False
    },
    {
        'username': 'doctor_pending',
        'email': 'doctor.pending@palmed.co.za',
        'password': 'testdoc123',
        'first_name': 'Dr. Jane',
        'last_name': 'Doe',
        'role_name': 'Doctor',
        'phone_number': '+27123456794',
        'geographic_restrictions': '["Gauteng"]',
        'mp_number': 'MP789012',
        'is_active': False,
        'requires_approval': True
    }
]

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

def get_role_id(role_name: str) -> int:
    """Get role ID by role name from existing data"""
    query = "SELECT id FROM user_roles WHERE role_name = %s"
    result = DatabaseManager.execute_query(query, (role_name,), fetch=True)
    
    if result and len(result) > 0:
        return result[0]['id']
    else:
        logger.error(f"Role '{role_name}' not found")
        return None

def list_existing_roles():
    """List all existing roles in the database"""
    query = "SELECT id, role_name, role_description FROM user_roles ORDER BY role_name"
    roles = DatabaseManager.execute_query(query, fetch=True)
    
    if roles:
        print("\nExisting roles in database:")
        print("-" * 50)
        for role in roles:
            print(f"ID: {role['id']:<3} | Name: {role['role_name']:<15} | Description: {role['role_description']}")
        return True
    else:
        print("No roles found in database!")
        return False

def user_exists(email: str) -> bool:
    """Check if user with given email already exists"""
    query = "SELECT id FROM users WHERE email = %s"
    result = DatabaseManager.execute_query(query, (email,), fetch=True)
    return result is not None and len(result) > 0

def create_user(user_data: dict) -> bool:
    """Create a single user with hashed password"""
    try:
        # Check if user already exists
        if user_exists(user_data['email']):
            logger.warning(f"User {user_data['email']} already exists, skipping...")
            return True
        
        # Get role ID from existing data
        role_id = get_role_id(user_data['role_name'])
        if not role_id:
            logger.error(f"Cannot create user {user_data['email']}: role '{user_data['role_name']}' not found")
            return False
        
        # Generate hashed password using the same method as Flask
        password_hash = generate_password_hash(user_data['password'])
        
        # Insert user into database
        insert_query = """
        INSERT INTO users (username, email, password_hash, role_id, first_name, last_name, 
                          phone_number, mp_number, geographic_restrictions, is_active, 
                          requires_approval, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        result = DatabaseManager.execute_query(insert_query, (
            user_data['username'],
            user_data['email'],
            password_hash,
            role_id,
            user_data['first_name'],
            user_data['last_name'],
            user_data['phone_number'],
            user_data['mp_number'],
            user_data['geographic_restrictions'],
            user_data['is_active'],
            user_data['requires_approval'],
            datetime.now()
        ))
        
        if result:
            logger.info(f"Successfully created user: {user_data['email']} ({user_data['role_name']})")
            status = "Active" if user_data['is_active'] else "Pending Approval"
            print(f"✓ Created: {user_data['email']} | Password: {user_data['password']} | Role: {user_data['role_name']} | Status: {status}")
            return True
        else:
            logger.error(f"Failed to create user: {user_data['email']}")
            return False
            
    except Exception as e:
        logger.error(f"Error creating user {user_data['email']}: {e}")
        return False

def verify_password_hashing():
    """Test password hashing to ensure it matches Flask app method"""
    test_password = "test123"
    hash1 = generate_password_hash(test_password)
    hash2 = generate_password_hash(test_password)
    
    # Test verification
    from werkzeug.security import check_password_hash
    verify1 = check_password_hash(hash1, test_password)
    verify2 = check_password_hash(hash1, "wrong_password")
    
    logger.info(f"Password hashing verification - correct: {verify1}, wrong: {verify2}")
    return verify1 and not verify2

def display_existing_users():
    """Display existing users for reference"""
    query = """
    SELECT u.username, u.email, ur.role_name, u.is_active, u.requires_approval
    FROM users u
    JOIN user_roles ur ON u.role_id = ur.id
    ORDER BY u.created_at DESC
    LIMIT 10
    """
    users = DatabaseManager.execute_query(query, fetch=True)
    
    if users:
        print("\nExisting users (last 10):")
        print("-" * 80)
        for user in users:
            status = "Active" if user['is_active'] else "Pending" if user['requires_approval'] else "Inactive"
            print(f"{user['email']:<30} | {user['role_name']:<15} | {status}")

def main():
    """Main function to create test users"""
    print("=" * 60)
    print("PALMED Mobile Clinic - Test User Creation Script")
    print("Using existing database roles and structure")
    print("=" * 60)
    
    # Test database connection
    connection = DatabaseManager.get_connection()
    if not connection:
        print("❌ Database connection failed!")
        print("Please check your database configuration and ensure MySQL is running.")
        return
    connection.close()
    print("✓ Database connection successful")
    
    # List existing roles
    if not list_existing_roles():
        print("❌ No roles found in database! Please run your data setup script first.")
        return
    
    # Show existing users
    display_existing_users()
    
    # Verify password hashing
    if not verify_password_hashing():
        print("❌ Password hashing verification failed!")
        return
    print("✓ Password hashing verification successful")
    
    print("\n" + "=" * 60)
    print("Creating test users...")
    print("=" * 60)
    
    # Create all test users
    success_count = 0
    for user_data in TEST_USERS:
        if create_user(user_data):
            success_count += 1
    
    print("\n" + "=" * 60)
    print(f"User creation completed: {success_count}/{len(TEST_USERS)} successful")
    print("=" * 60)
    
    if success_count > 0:
        print("\nTest Login Credentials:")
        print("-" * 50)
        for user in TEST_USERS:
            status_icon = "✓" if user['is_active'] else "⏳"
            print(f"{status_icon} {user['email']:<30} | {user['password']:<10} | {user['role_name']}")
        
        print("\nNote:")
        print("- ✓ = Active user (can login immediately)")
        print("- ⏳ = Pending approval (admin needs to approve)")
        print("- All passwords use Werkzeug hashing (same as Flask app)")
        print("- Users are created with proper role references")
        print("- Geographic restrictions are set as JSON arrays")
        
        print("\nTo approve pending users, update the database:")
        print("UPDATE users SET is_active = TRUE, requires_approval = FALSE")
        print("WHERE email = 'doctor.pending@palmed.co.za';")

if __name__ == "__main__":
    main()