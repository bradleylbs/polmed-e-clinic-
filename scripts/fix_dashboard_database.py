#!/usr/bin/env python3
"""
Create missing appointments table for dashboard functionality
"""

import mysql.connector
from mysql.connector import Error
import os
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

class DatabaseFixer:
    """Fix database structure for dashboard"""
    
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
    def execute_query(query: str, params: tuple = None):
        connection = DatabaseFixer.get_connection()
        if not connection:
            return False
        
        try:
            cursor = connection.cursor()
            cursor.execute(query, params or ())
            connection.commit()
            return True
        except Error as e:
            logger.error(f"Query execution error: {e}")
            return False
        finally:
            if connection and connection.is_connected():
                cursor.close()
                connection.close()

def create_appointments_table():
    """Create the appointments table"""
    print("📅 Creating appointments table...")
    
    query = """
    CREATE TABLE IF NOT EXISTS appointments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        patient_id INT NOT NULL,
        location_id INT,
        appointment_date DATE NOT NULL,
        appointment_time TIME NOT NULL,
        status VARCHAR(50) DEFAULT 'Booked',
        appointment_type VARCHAR(100),
        notes TEXT,
        created_by INT,
        booked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_patient_id (patient_id),
        INDEX idx_location_id (location_id),
        INDEX idx_appointment_date (appointment_date),
        INDEX idx_status (status),
        INDEX idx_booked_at (booked_at),
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
        FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """
    
    if DatabaseFixer.execute_query(query):
        print("✅ Appointments table created successfully")
        return True
    else:
        print("❌ Failed to create appointments table")
        return False

def add_missing_columns():
    """Add missing columns to patient_visits table"""
    print("🏥 Adding missing columns to patient_visits table...")
    
    # Check if columns exist first
    columns_to_add = [
        ("doctor_id", "INT", "FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE SET NULL"),
        ("nurse_id", "INT", "FOREIGN KEY (nurse_id) REFERENCES users(id) ON DELETE SET NULL")
    ]
    
    success_count = 0
    
    for column_name, column_type, constraint in columns_to_add:
        # Check if column exists
        check_query = """
        SELECT COUNT(*) as count 
        FROM information_schema.columns 
        WHERE table_schema = %s AND table_name = 'patient_visits' AND column_name = %s
        """
        
        connection = DatabaseFixer.get_connection()
        if connection:
            try:
                cursor = connection.cursor(dictionary=True)
                cursor.execute(check_query, (DB_CONFIG['database'], column_name))
                result = cursor.fetchone()
                
                if result and result['count'] == 0:
                    # Column doesn't exist, add it
                    add_query = f"ALTER TABLE patient_visits ADD COLUMN {column_name} {column_type}"
                    cursor.execute(add_query)
                    connection.commit()
                    print(f"  ✅ Added column: {column_name}")
                    success_count += 1
                else:
                    print(f"  ⏭️ Column {column_name} already exists")
                    success_count += 1
                    
            except Error as e:
                print(f"  ❌ Error with column {column_name}: {e}")
            finally:
                cursor.close()
                connection.close()
    
    return success_count == len(columns_to_add)

def main():
    """Main function to fix database structure"""
    print("=" * 80)
    print("🔧 POLMED Database Structure Fixer")
    print(f"Database: {DB_CONFIG['host']}/{DB_CONFIG['database']}")
    print("=" * 80)
    
    # Test database connection
    connection = DatabaseFixer.get_connection()
    if not connection:
        print("❌ Database connection failed!")
        return False
    else:
        print("✅ Database connection successful")
        connection.close()
    
    success_count = 0
    total_operations = 2
    
    print(f"\n🏗️ Fixing Database Structure")
    print("=" * 50)
    
    # Create appointments table
    if create_appointments_table():
        success_count += 1
    
    # Add missing columns
    if add_missing_columns():
        success_count += 1
    
    print(f"\n{'='*80}")
    print("📊 DATABASE FIX SUMMARY")
    print(f"{'='*80}")
    print(f"Successful operations: {success_count}/{total_operations}")
    print(f"Success rate: {(success_count/total_operations)*100:.1f}%")
    
    if success_count == total_operations:
        print("\n✅ Database structure fixed successfully!")
        print("✅ Dashboard should now work properly with appointments")
        print("\n💡 Next steps:")
        print("  1. Run generate_dashboard_test_data.py to add sample data")
        print("  2. Test your dashboard again")
    elif success_count > 0:
        print("\n⚠️ Partial success - some fixes applied")
        print("  • Some functionality may still be limited")
    else:
        print("\n❌ Failed to fix database structure")
        print("  • Check database permissions")
        print("  • Verify table relationships")
    
    return success_count == total_operations

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)