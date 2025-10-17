#!/usr/bin/env python3
"""
Deploy stored procedures to Azure MySQL database:
1. sp_generate_appointment_slots - Creates appointment slots
2. sp_get_available_appointments - Retrieves available appointment slots
"""

import mysql.connector
import sys
import os

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
}

def deploy_stored_procedures():
    """Deploy all stored procedures"""
    try:
        # Connect to database
        print(f"Connecting to {DB_CONFIG['host']}...")
        connection = mysql.connector.connect(**DB_CONFIG)
        
        cursor = connection.cursor()
        print("✓ Connected to database")
        
        # ============================================================================
        # PROCEDURE 1: sp_generate_appointment_slots
        # ============================================================================
        print("\n" + "="*70)
        print("PROCEDURE 1: sp_generate_appointment_slots")
        print("="*70)
        
        try:
            print("Dropping existing procedure if it exists...")
            cursor.execute("DROP PROCEDURE IF EXISTS sp_generate_appointment_slots")
            connection.commit()
            print("  ✓ Dropped existing procedure")
        except Exception as e:
            print(f"  ℹ Procedure didn't exist: {e}")
        
        sp1_sql = """
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
        
        print("Creating sp_generate_appointment_slots...")
        cursor.execute(sp1_sql)
        connection.commit()
        print("  ✓ Created sp_generate_appointment_slots successfully")
        
        # ============================================================================
        # PROCEDURE 2: sp_get_available_appointments
        # ============================================================================
        print("\n" + "="*70)
        print("PROCEDURE 2: sp_get_available_appointments")
        print("="*70)
        
        try:
            print("Dropping existing procedure if it exists...")
            cursor.execute("DROP PROCEDURE IF EXISTS sp_get_available_appointments")
            connection.commit()
            print("  ✓ Dropped existing procedure")
        except Exception as e:
            print(f"  ℹ Procedure didn't exist: {e}")
        
        sp2_sql = """
CREATE PROCEDURE sp_get_available_appointments(
    IN p_date_from DATE,
    IN p_date_to DATE,
    IN p_province VARCHAR(100)
)
READS SQL DATA
NOT DETERMINISTIC
SQL SECURITY DEFINER
BEGIN
    SELECT 
        pa.id AS appointment_id,
        pa.route_location_id,
        pa.appointment_date,
        pa.appointment_time,
        pa.status,
        pa.created_at,
        rl.id AS route_location_id_ref,
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
        COUNT(CASE WHEN pa2.status IN ('Booked', 'Confirmed') THEN 1 END) OVER (PARTITION BY pa.route_location_id) AS booked_count,
        (rl.max_appointments - COUNT(CASE WHEN pa2.status IN ('Booked', 'Confirmed') THEN 1 END) OVER (PARTITION BY pa.route_location_id)) AS available_slots
    FROM patient_appointments pa
    INNER JOIN route_locations rl ON pa.route_location_id = rl.id
    INNER JOIN locations l ON rl.location_id = l.id
    INNER JOIN routes r ON rl.route_id = r.id
    LEFT JOIN patient_appointments pa2 ON rl.id = pa2.route_location_id 
        AND pa2.status IN ('Booked', 'Confirmed')
    WHERE 
        pa.status = 'Available'
        AND pa.appointment_date >= p_date_from
        AND pa.appointment_date <= p_date_to
        AND (p_province IS NULL OR p_province = '' OR l.province = p_province)
        AND r.is_active = TRUE
    GROUP BY 
        pa.id, pa.route_location_id, pa.appointment_date, pa.appointment_time,
        rl.id, l.id, r.id
    ORDER BY 
        pa.appointment_date ASC, 
        pa.appointment_time ASC;
    
END
"""
        
        print("Creating sp_get_available_appointments...")
        cursor.execute(sp2_sql)
        connection.commit()
        print("  ✓ Created sp_get_available_appointments successfully")
        
        # ============================================================================
        # Verify procedures
        # ============================================================================
        print("\n" + "="*70)
        print("VERIFICATION")
        print("="*70)
        
        cursor.execute("""
            SELECT ROUTINE_NAME 
            FROM INFORMATION_SCHEMA.ROUTINES 
            WHERE ROUTINE_SCHEMA = %s
            AND ROUTINE_NAME IN ('sp_generate_appointment_slots', 'sp_get_available_appointments')
            ORDER BY ROUTINE_NAME
        """, (DB_CONFIG['database'],))
        
        results = cursor.fetchall()
        if results:
            print(f"\n✓ Verified {len(results)} procedures exist in database:")
            for row in results:
                print(f"  - {row[0]}")
        else:
            print("✗ Warning: No procedures found in database")
        
        cursor.close()
        connection.close()
        print("\n" + "="*70)
        print("✓ All stored procedures deployed successfully!")
        print("="*70)
        return True
        
    except Exception as e:
        print(f"\n✗ Failed to deploy stored procedures: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = deploy_stored_procedures()
    sys.exit(0 if success else 1)
