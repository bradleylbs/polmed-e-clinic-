#!/usr/bin/env python3
"""
Deploy stored procedure to Azure MySQL database
"""

import mysql.connector
import sys
import os

# Import database config from app
sys.path.insert(0, os.path.dirname(__file__))

# Database connection details
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

def deploy_stored_procedure():
    """Deploy the sp_generate_appointment_slots stored procedure"""
    try:
        # Connect to database
        print(f"Connecting to {DB_CONFIG['host']}...")
        connection = mysql.connector.connect(**DB_CONFIG)
        
        cursor = connection.cursor()
        print("✓ Connected to database")
        
        # Drop existing procedure if it exists
        try:
            print("Dropping existing procedure if it exists...")
            cursor.execute("DROP PROCEDURE IF EXISTS sp_generate_appointment_slots")
            connection.commit()
            print("  ✓ Dropped existing procedure")
        except Exception as e:
            print(f"  ℹ Procedure didn't exist: {e}")
        
        # Create the stored procedure directly with SQL
        sp_sql = """
CREATE PROCEDURE sp_generate_appointment_slots(
    IN p_route_location_id INT,
    OUT p_slot_count INT
)
READS SQL DATA
MODIFIES SQL DATA
NOT DETERMINISTIC
SQL SECURITY DEFINER
proc_label: BEGIN
    DECLARE v_start_time TIME;
    DECLARE v_end_time TIME;
    DECLARE v_max_appointments INT;
    DECLARE v_appointment_duration INT;
    DECLARE v_slot_time TIME;
    DECLARE v_visit_date DATE;
    DECLARE v_slots_created INT DEFAULT 0;
    
    SET p_slot_count = 0;
    
    SELECT 
        start_time,
        end_time,
        max_appointments,
        appointment_duration,
        visit_date
    INTO 
        v_start_time,
        v_end_time,
        v_max_appointments,
        v_appointment_duration,
        v_visit_date
    FROM route_locations
    WHERE id = p_route_location_id
    LIMIT 1;
    
    IF v_start_time IS NULL THEN
        SET p_slot_count = 0;
        LEAVE proc_label;
    END IF;
    
    SET v_slot_time = v_start_time;
    SET v_slots_created = 0;
    
    WHILE v_slot_time < v_end_time AND v_slots_created < v_max_appointments DO
        INSERT INTO patient_appointments 
        (route_location_id, appointment_date, appointment_time, booking_reference, status, created_at)
        VALUES (
            p_route_location_id,
            v_visit_date,
            v_slot_time,
            NULL,
            'Available',
            NOW()
        );
        
        SET v_slots_created = v_slots_created + 1;
        
        SET v_slot_time = ADDTIME(v_slot_time, CONCAT('00:', LPAD(v_appointment_duration, 2, '0'), ':00'));
    END WHILE;
    
    SET p_slot_count = v_slots_created;
    
END
"""
        
        print("Creating stored procedure...")
        cursor.execute(sp_sql)
        connection.commit()
        print("✓ Created stored procedure successfully")
        
        # Verify procedure exists
        cursor.execute("""
            SELECT ROUTINE_NAME 
            FROM INFORMATION_SCHEMA.ROUTINES 
            WHERE ROUTINE_NAME = 'sp_generate_appointment_slots' 
            AND ROUTINE_SCHEMA = %s
        """, (DB_CONFIG['database'],))
        
        result = cursor.fetchone()
        if result:
            print(f"✓ Verified: Procedure {result[0]} exists in database")
        else:
            print("✗ Warning: Procedure not found in database")
        
        cursor.close()
        connection.close()
        print("\n✓ Stored procedure deployment completed successfully!")
        return True
        
    except Exception as e:
        print(f"\n✗ Failed to deploy stored procedure: {e}")
        return False

if __name__ == "__main__":
    success = deploy_stored_procedure()
    sys.exit(0 if success else 1)
