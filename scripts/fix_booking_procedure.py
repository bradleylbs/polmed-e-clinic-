"""
Fix sp_book_appointment stored procedure to work with patient_appointments table
"""

import mysql.connector

DB_CONFIG = {
    'host': 'db-polmed.mysql.database.azure.com',
    'database': 'palmed_clinic_erp',
    'user': 'dbadmin',
    'password': 'Polm3d!DB@2025',
    'ssl_disabled': False
}

def fix_stored_procedure():
    """Drop and recreate the sp_book_appointment stored procedure"""
    connection = mysql.connector.connect(**DB_CONFIG)
    cursor = connection.cursor()
    
    print("\n" + "="*80)
    print("FIXING sp_book_appointment STORED PROCEDURE")
    print("="*80)
    
    try:
        # Drop existing stored procedure
        print("\n1️⃣  Dropping old stored procedure...")
        cursor.execute("DROP PROCEDURE IF EXISTS sp_book_appointment")
        print("  ✅ Old procedure dropped")
        
        # Create new stored procedure that works with patient_appointments table
        print("\n2️⃣  Creating new stored procedure...")
        
        new_procedure = """
CREATE PROCEDURE sp_book_appointment(
    IN p_appointment_id INT,
    IN p_patient_id INT,
    IN p_booked_by_name VARCHAR(200),
    IN p_booked_by_phone VARCHAR(20),
    IN p_booked_by_email VARCHAR(255),
    IN p_special_requirements TEXT,
    OUT p_booking_reference VARCHAR(50),
    OUT p_result VARCHAR(100)
)
BEGIN
    DECLARE appointment_status VARCHAR(20);
    DECLARE existing_patient_id INT;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_result = 'ERROR: Failed to book appointment';
        SET p_booking_reference = NULL;
    END;
    
    START TRANSACTION;
    
    -- Check if appointment exists and get current status
    SELECT status, patient_id 
    INTO appointment_status, existing_patient_id
    FROM patient_appointments
    WHERE id = p_appointment_id;
    
    -- Check if appointment is available
    IF appointment_status IS NULL THEN
        SET p_result = 'ERROR: Appointment not found';
        SET p_booking_reference = NULL;
        ROLLBACK;
    ELSEIF appointment_status != 'Available' THEN
        SET p_result = 'ERROR: Appointment not available';
        SET p_booking_reference = NULL;
        ROLLBACK;
    ELSE
        -- Generate booking reference
        SET p_booking_reference = CONCAT(
            'APT',
            DATE_FORMAT(NOW(), '%Y%m%d'),
            LPAD(p_appointment_id, 6, '0')
        );
        
        -- Update appointment with booking details
        UPDATE patient_appointments
        SET
            patient_id = p_patient_id,
            status = 'Booked',
            booking_reference = p_booking_reference,
            notes = CONCAT(
                COALESCE(notes, ''),
                IF(notes IS NOT NULL AND notes != '', '\n', ''),
                'Booked by: ', p_booked_by_name,
                IF(p_booked_by_phone IS NOT NULL, CONCAT(' (', p_booked_by_phone, ')'), ''),
                IF(p_special_requirements IS NOT NULL AND p_special_requirements != '', 
                   CONCAT('\nSpecial requirements: ', p_special_requirements), '')
            ),
            booked_via_portal = TRUE,
            confirmation_sent = FALSE,
            updated_at = NOW()
        WHERE id = p_appointment_id;
        
        COMMIT;
        SET p_result = 'SUCCESS: Appointment booked';
    END IF;
END
"""
        
        cursor.execute(new_procedure)
        print("  ✅ New procedure created")
        
        connection.commit()
        
        # Verify the new procedure
        print("\n3️⃣  Verifying new procedure...")
        cursor.execute("SHOW CREATE PROCEDURE sp_book_appointment")
        result = cursor.fetchone()
        
        if result:
            print("  ✅ Procedure verified successfully")
            proc_def = result[2]
            
            # Check key elements
            if 'patient_appointments' in proc_def:
                print("  ✅ Uses patient_appointments table")
            if 'booking_reference' in proc_def:
                print("  ✅ Generates booking_reference")
            if 'booked_via_portal' in proc_def:
                print("  ✅ Sets booked_via_portal flag")
        
        print("\n" + "="*80)
        print("✅ SUCCESS - Stored procedure fixed!")
        print("="*80)
        print("\nThe procedure now:")
        print("  • Works with patient_appointments table")
        print("  • Generates booking references (APT + date + ID)")
        print("  • Stores booking info in notes field")
        print("  • Sets booked_via_portal flag")
        print("  • Updates status to 'Booked'")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        connection.rollback()
    finally:
        cursor.close()
        connection.close()

if __name__ == "__main__":
    fix_stored_procedure()
