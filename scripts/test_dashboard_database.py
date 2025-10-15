#!/usr/bin/env python3
"""
Database diagnostic script for dashboard stats
Checks if required tables and data exist for dashboard functionality
"""

import mysql.connector
from mysql.connector import Error
import os
from datetime import datetime, timedelta
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

class DatabaseDiagnostic:
    """Database diagnostic utilities"""
    
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
        connection = DatabaseDiagnostic.get_connection()
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

def check_table_exists(table_name):
    """Check if a table exists in the database"""
    query = """
    SELECT COUNT(*) as count 
    FROM information_schema.tables 
    WHERE table_schema = %s AND table_name = %s
    """
    result = DatabaseDiagnostic.execute_query(query, (DB_CONFIG['database'], table_name), fetch=True)
    exists = result and result[0]['count'] > 0
    print(f"  {'✅' if exists else '❌'} Table '{table_name}': {'EXISTS' if exists else 'MISSING'}")
    return exists

def check_table_data(table_name, description=""):
    """Check if a table has data"""
    query = f"SELECT COUNT(*) as count FROM {table_name}"
    result = DatabaseDiagnostic.execute_query(query, fetch=True)
    
    if result:
        count = result[0]['count']
        print(f"  📊 {table_name}: {count} records{' - ' + description if description else ''}")
        return count
    else:
        print(f"  ❌ {table_name}: Cannot query table")
        return 0

def check_recent_data(table_name, date_column, days=7, description=""):
    """Check for recent data in a table"""
    query = f"""
    SELECT COUNT(*) as count 
    FROM {table_name} 
    WHERE {date_column} >= DATE_SUB(NOW(), INTERVAL %s DAY)
    """
    result = DatabaseDiagnostic.execute_query(query, (days,), fetch=True)
    
    if result:
        count = result[0]['count']
        print(f"  📅 {table_name} (last {days} days): {count} records{' - ' + description if description else ''}")
        return count
    else:
        print(f"  ❌ {table_name}: Cannot query recent data")
        return 0

def check_user_roles():
    """Check user roles and their distribution"""
    query = """
    SELECT ur.role_name, COUNT(u.id) as user_count
    FROM user_roles ur
    LEFT JOIN users u ON ur.id = u.role_id
    GROUP BY ur.id, ur.role_name
    ORDER BY ur.role_name
    """
    result = DatabaseDiagnostic.execute_query(query, fetch=True)
    
    print(f"\n👥 User Roles Distribution:")
    if result:
        for row in result:
            print(f"  • {row['role_name']}: {row['user_count']} users")
        return True
    else:
        print(f"  ❌ Cannot query user roles")
        return False

def check_dashboard_dependencies():
    """Check all tables that dashboard stats depend on"""
    print(f"\n🔍 Checking Dashboard Dependencies")
    print("=" * 50)
    
    # Core tables for dashboard stats
    required_tables = [
        'users',
        'user_roles', 
        'patients',
        'patient_visits',
        'appointments',
        'routes',
        'locations',
        'inventory_stock',
        'assets',
        'consumables'
    ]
    
    missing_tables = []
    
    print(f"\n📋 Required Tables:")
    for table in required_tables:
        if not check_table_exists(table):
            missing_tables.append(table)
    
    if missing_tables:
        print(f"\n❌ Missing Tables: {', '.join(missing_tables)}")
        return False
    else:
        print(f"\n✅ All required tables exist!")
    
    # Check table data counts
    print(f"\n📊 Table Data Counts:")
    check_table_data('users', 'System users')
    check_table_data('user_roles', 'Available roles')
    check_table_data('patients', 'Registered patients')
    check_table_data('patient_visits', 'Patient visits')
    check_table_data('appointments', 'Appointments')
    check_table_data('routes', 'Mobile clinic routes')
    check_table_data('locations', 'Service locations')
    check_table_data('inventory_stock', 'Inventory items')
    check_table_data('assets', 'Assets/Equipment')
    check_table_data('consumables', 'Consumable supplies')
    
    # Check recent activity
    print(f"\n📅 Recent Activity (Last 7 Days):")
    check_recent_data('patients', 'created_at', 7, 'New registrations')
    check_recent_data('patient_visits', 'visit_date', 7, 'Patient visits')
    check_recent_data('appointments', 'booked_at', 7, 'New appointments')
    
    return True

def check_specific_role_data():
    """Check role-specific data that affects dashboard metrics"""
    print(f"\n👨‍⚕️ Role-Specific Data Checks")
    print("=" * 50)
    
    # Check clerk-created patients
    query = """
    SELECT COUNT(*) as count 
    FROM patients p
    JOIN users u ON p.created_by = u.id
    JOIN user_roles ur ON u.role_id = ur.id
    WHERE ur.role_name = 'Clerk'
    """
    result = DatabaseDiagnostic.execute_query(query, fetch=True)
    if result:
        print(f"  📝 Patients registered by clerks: {result[0]['count']}")
    
    # Check doctor visits
    query = """
    SELECT COUNT(*) as count 
    FROM patient_visits pv
    JOIN users u ON pv.doctor_id = u.id
    JOIN user_roles ur ON u.role_id = ur.id
    WHERE ur.role_name = 'Doctor'
    """
    result = DatabaseDiagnostic.execute_query(query, fetch=True)
    if result:
        print(f"  🩺 Visits by doctors: {result[0]['count']}")
    
    # Check nurse screenings
    query = """
    SELECT COUNT(*) as count 
    FROM patient_visits pv
    JOIN users u ON pv.nurse_id = u.id
    JOIN user_roles ur ON u.role_id = ur.id
    WHERE ur.role_name = 'Nurse'
    """
    result = DatabaseDiagnostic.execute_query(query, fetch=True)
    if result:
        print(f"  💉 Visits with nurse screening: {result[0]['count']}")

def check_dashboard_test_data():
    """Check if we have sufficient test data for dashboard"""
    print(f"\n🧪 Dashboard Test Data Assessment")
    print("=" * 50)
    
    issues = []
    
    # Check patients
    patient_count = DatabaseDiagnostic.execute_query("SELECT COUNT(*) as count FROM patients", fetch=True)
    if patient_count and patient_count[0]['count'] < 5:
        issues.append(f"Too few patients ({patient_count[0]['count']}) - need at least 5 for meaningful stats")
    
    # Check visits
    visit_count = DatabaseDiagnostic.execute_query("SELECT COUNT(*) as count FROM patient_visits", fetch=True)
    if visit_count and visit_count[0]['count'] < 3:
        issues.append(f"Too few patient visits ({visit_count[0]['count']}) - need some visit history")
    
    # Check appointments
    appt_count = DatabaseDiagnostic.execute_query("SELECT COUNT(*) as count FROM appointments", fetch=True)
    if appt_count and appt_count[0]['count'] < 2:
        issues.append(f"Too few appointments ({appt_count[0]['count']}) - dashboard may show zeros")
    
    if issues:
        print(f"\n⚠️ Potential Issues:")
        for issue in issues:
            print(f"  • {issue}")
        print(f"\n💡 Suggestion: Create some test data for better dashboard experience")
    else:
        print(f"\n✅ Sufficient test data available for dashboard functionality")
    
    return len(issues) == 0

def main():
    """Main diagnostic function"""
    print("=" * 80)
    print("🔍 POLMED Dashboard Database Diagnostic")
    print(f"Database: {DB_CONFIG['host']}/{DB_CONFIG['database']}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    # Test database connection
    connection = DatabaseDiagnostic.get_connection()
    if not connection:
        print("❌ Database connection failed!")
        print("Please check your database configuration and firewall settings.")
        return False
    else:
        print("✅ Database connection successful")
        connection.close()
    
    # Run diagnostic checks
    try:
        dependencies_ok = check_dashboard_dependencies()
        check_user_roles()
        check_specific_role_data()
        test_data_ok = check_dashboard_test_data()
        
        print(f"\n{'='*80}")
        print("📊 DIAGNOSTIC SUMMARY")
        print(f"{'='*80}")
        
        if dependencies_ok and test_data_ok:
            print("✅ Database is properly configured for dashboard functionality")
            print("✅ Sufficient test data available")
            print("\n💡 If dashboard still doesn't work, check:")
            print("  • Frontend-backend connectivity")
            print("  • Authentication token issues")
            print("  • Browser console for errors")
        elif dependencies_ok:
            print("✅ Database structure is correct")
            print("⚠️ Limited test data - dashboard may show mostly zeros")
            print("\n💡 Consider adding more test data for better dashboard experience")
        else:
            print("❌ Database structure issues found")
            print("\n💡 Run your database initialization scripts to create missing tables")
        
        return dependencies_ok
        
    except Exception as e:
        print(f"❌ Diagnostic failed: {str(e)}")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)