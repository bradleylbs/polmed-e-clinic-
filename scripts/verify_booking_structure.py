"""
Check database structure for patient appointments and booking
"""

import mysql.connector

DB_CONFIG = {
    'host': 'db-polmed.mysql.database.azure.com',
    'database': 'palmed_clinic_erp',
    'user': 'dbadmin',
    'password': 'Polm3d!DB@2025',
    'ssl_disabled': False
}

def check_database_structure():
    """Check relevant database structures"""
    connection = mysql.connector.connect(**DB_CONFIG)
    cursor = connection.cursor(dictionary=True)
    
    print("\n" + "="*80)
    print("DATABASE STRUCTURE VERIFICATION")
    print("="*80)
    
    # 1. Check patient_appointments table structure
    print("\n1️⃣  PATIENT_APPOINTMENTS TABLE STRUCTURE:")
    print("-" * 80)
    cursor.execute("SHOW COLUMNS FROM patient_appointments")
    columns = cursor.fetchall()
    for col in columns:
        print(f"  • {col['Field']:<30} {col['Type']:<20} {col['Null']:<5} {col['Key']:<5} {col['Default']}")
    
    # 2. Check if sp_book_appointment stored procedure exists
    print("\n2️⃣  STORED PROCEDURE: sp_book_appointment")
    print("-" * 80)
    try:
        cursor.execute("SHOW CREATE PROCEDURE sp_book_appointment")
        result = cursor.fetchone()
        if result:
            print("  ✅ Stored procedure EXISTS")
            proc_def = result['Create Procedure']
            
            # Extract parameters
            if 'IN p_appointment_id' in proc_def:
                print("  ✅ Parameter: p_appointment_id (IN)")
            if 'IN p_patient_id' in proc_def:
                print("  ✅ Parameter: p_patient_id (IN)")
            if 'IN p_booked_by_name' in proc_def:
                print("  ✅ Parameter: p_booked_by_name (IN)")
            if 'IN p_booked_by_phone' in proc_def:
                print("  ✅ Parameter: p_booked_by_phone (IN)")
            if 'IN p_booked_by_email' in proc_def:
                print("  ✅ Parameter: p_booked_by_email (IN)")
            if 'IN p_special_requirements' in proc_def:
                print("  ✅ Parameter: p_special_requirements (IN)")
            if 'OUT p_booking_reference' in proc_def:
                print("  ✅ Parameter: p_booking_reference (OUT)")
            if 'OUT p_result' in proc_def:
                print("  ✅ Parameter: p_result (OUT)")
    except Exception as e:
        print(f"  ❌ Stored procedure NOT FOUND or ERROR: {e}")
    
    # 3. Check patients table for required fields
    print("\n3️⃣  PATIENTS TABLE - Required Fields:")
    print("-" * 80)
    cursor.execute("SHOW COLUMNS FROM patients")
    patient_columns = cursor.fetchall()
    
    required_fields = ['first_name', 'last_name', 'phone_number', 'email']
    for field in required_fields:
        found = any(col['Field'] == field for col in patient_columns)
        status = "✅" if found else "❌"
        print(f"  {status} {field}")
    
    # 4. Check patient_portal_users table
    print("\n4️⃣  PATIENT_PORTAL_USERS TABLE:")
    print("-" * 80)
    try:
        cursor.execute("SHOW COLUMNS FROM patient_portal_users")
        portal_columns = cursor.fetchall()
        for col in portal_columns:
            print(f"  • {col['Field']:<30} {col['Type']:<20} {col['Null']:<5} {col['Key']}")
    except Exception as e:
        print(f"  ❌ Table not found or error: {e}")
    
    # 5. Check current appointment data
    print("\n5️⃣  CURRENT APPOINTMENT DATA:")
    print("-" * 80)
    cursor.execute("""
        SELECT 
            id, 
            patient_id,
            route_location_id,
            appointment_date,
            appointment_time,
            status,
            booking_reference
        FROM patient_appointments
        LIMIT 5
    """)
    appointments = cursor.fetchall()
    
    if appointments:
        print(f"  Found {len(appointments)} sample appointments:")
        for appt in appointments:
            print(f"    • ID: {appt['id']}, Status: {appt['status']}, Date: {appt['appointment_date']}, Patient: {appt['patient_id']}")
    else:
        print("  ⚠️  No appointments found in database")
    
    # 6. Check if there are any available appointments
    print("\n6️⃣  AVAILABLE APPOINTMENTS FOR BOOKING:")
    print("-" * 80)
    cursor.execute("""
        SELECT COUNT(*) as count
        FROM patient_appointments
        WHERE status = 'Available'
        AND appointment_date >= CURDATE()
    """)
    result = cursor.fetchone()
    print(f"  Available slots: {result['count']}")
    
    # 7. Test patient data exists
    print("\n7️⃣  SAMPLE PATIENT DATA:")
    print("-" * 80)
    cursor.execute("""
        SELECT id, first_name, last_name, phone_number, email
        FROM patients
        LIMIT 3
    """)
    patients = cursor.fetchall()
    
    if patients:
        print(f"  Found {len(patients)} sample patients:")
        for patient in patients:
            print(f"    • ID: {patient['id']}, Name: {patient['first_name']} {patient['last_name']}, Phone: {patient.get('phone_number', 'N/A')}")
    else:
        print("  ⚠️  No patients found in database")
    
    cursor.close()
    connection.close()
    
    print("\n" + "="*80)
    print("VERIFICATION COMPLETE")
    print("="*80)

if __name__ == "__main__":
    try:
        check_database_structure()
    except Exception as e:
        print(f"\n❌ Error: {e}")
