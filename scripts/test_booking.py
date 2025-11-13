"""
Test the fixed booking procedure
"""

import mysql.connector

DB_CONFIG = {
    'host': 'db-polmed.mysql.database.azure.com',
    'database': 'palmed_clinic_erp',
    'user': 'dbadmin',
    'password': 'Polm3d!DB@2025',
    'ssl_disabled': False
}

def test_booking():
    """Test booking an appointment"""
    connection = mysql.connector.connect(**DB_CONFIG)
    cursor = connection.cursor(dictionary=True)
    
    print("\n" + "="*80)
    print("TESTING BOOKING PROCEDURE")
    print("="*80)
    
    try:
        # Find an available appointment
        print("\n1️⃣  Finding available appointment...")
        cursor.execute("""
            SELECT id, appointment_date, appointment_time, status
            FROM patient_appointments
            WHERE status = 'Available'
            AND appointment_date >= CURDATE()
            LIMIT 1
        """)
        
        available = cursor.fetchone()
        
        if not available:
            print("  ❌ No available appointments found")
            return
        
        print(f"  ✅ Found appointment #{available['id']}")
        print(f"     Date: {available['appointment_date']}")
        print(f"     Time: {available['appointment_time']}")
        print(f"     Status: {available['status']}")
        
        # Get a test patient
        print("\n2️⃣  Getting test patient...")
        cursor.execute("""
            SELECT id, first_name, last_name, phone_number, email
            FROM patients
            LIMIT 1
        """)
        
        patient = cursor.fetchone()
        
        if not patient:
            print("  ❌ No patients found")
            return
        
        print(f"  ✅ Using patient #{patient['id']}: {patient['first_name']} {patient['last_name']}")
        
        # Test the booking procedure
        print("\n3️⃣  Testing booking procedure...")
        
        args = [
            available['id'],  # p_appointment_id
            patient['id'],    # p_patient_id
            f"{patient['first_name']} {patient['last_name']}",  # p_booked_by_name
            patient['phone_number'] or '',  # p_booked_by_phone
            patient['email'] or '',  # p_booked_by_email
            'Test booking via patient portal',  # p_special_requirements
            0,  # OUT p_booking_reference (use placeholder)
            0   # OUT p_result (use placeholder)
        ]
        
        result_args = cursor.callproc('sp_book_appointment', args)
        
        # Fetch the OUT parameters properly
        cursor.execute("SELECT @_sp_book_appointment_6 AS booking_ref, @_sp_book_appointment_7 AS result_msg")
        out_params = cursor.fetchone()
        
        booking_reference = out_params['booking_ref']
        result_message = out_params['result_msg']
        
        print(f"  Result: {result_message}")
        print(f"  Booking Reference: {booking_reference}")
        
        if result_message and 'SUCCESS' in result_message:
            print("\n  ✅ Booking successful!")
            
            # Verify the booking
            print("\n4️⃣  Verifying booking...")
            cursor.execute("""
                SELECT id, patient_id, status, booking_reference, 
                       booked_via_portal, notes
                FROM patient_appointments
                WHERE id = %s
            """, (available['id'],))
            
            booked = cursor.fetchone()
            
            print(f"     Status: {booked['status']}")
            print(f"     Patient ID: {booked['patient_id']}")
            print(f"     Booking Reference: {booked['booking_reference']}")
            print(f"     Booked via Portal: {booked['booked_via_portal']}")
            print(f"     Notes: {booked['notes'][:100]}..." if booked['notes'] and len(booked['notes']) > 100 else f"     Notes: {booked['notes']}")
            
            # Rollback to keep test data clean
            print("\n5️⃣  Rolling back test booking...")
            connection.rollback()
            print("  ✅ Test booking rolled back (database unchanged)")
            
        else:
            print(f"\n  ❌ Booking failed: {result_message}")
            connection.rollback()
        
        print("\n" + "="*80)
        print("✅ TEST COMPLETE")
        print("="*80)
        
    except Exception as e:
        print(f"\n❌ Test error: {e}")
        connection.rollback()
    finally:
        cursor.close()
        connection.close()

if __name__ == "__main__":
    test_booking()
