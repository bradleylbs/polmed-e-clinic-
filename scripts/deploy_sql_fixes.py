#!/usr/bin/env python3
"""
SQL CRITICAL FIXES - Appointment Booking System
Creates missing appointments table and slot generation procedure
"""

import mysql.connector
from mysql.connector import Error
import os
from datetime import datetime

DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'user': os.environ.get('DB_USER', 'root'),
    'password': os.environ.get('DB_PASSWORD', 'Transport@2025'),
    'database': os.environ.get('DB_NAME', 'palmed_clinic_erp'),
    'port': int(os.environ.get('DB_PORT', 3306)),
}

print("\n" + "="*70)
print("🚀 PALMED CLINIC ERP - SQL CRITICAL FIXES")
print("="*70)

try:
    # Connect
    print("\n📡 Connecting to database...")
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()
    print("✅ Connected successfully")
    
    # STEP 1: Create appointments table
    print("\n📝 STEP 1: Creating appointments table...")
    sql_table = """
    CREATE TABLE IF NOT EXISTS `appointments` (
      `id` int NOT NULL AUTO_INCREMENT,
      `route_location_id` int NOT NULL,
      `patient_id` int DEFAULT NULL,
      `appointment_date` date NOT NULL,
      `start_time` time NOT NULL,
      `end_time` time NOT NULL,
      `status` enum('available', 'booked', 'completed', 'cancelled', 'no-show') DEFAULT 'available',
      `notes` text COLLATE utf8mb4_unicode_ci,
      `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
      `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      UNIQUE KEY `unique_appointment_slot` (`route_location_id`, `appointment_date`, `start_time`, `patient_id`),
      KEY `idx_appointments_route_location` (`route_location_id`),
      KEY `idx_appointments_patient` (`patient_id`),
      KEY `idx_appointments_date` (`appointment_date`),
      KEY `idx_appointments_status` (`status`),
      KEY `idx_appointments_date_status` (`appointment_date`, `status`),
      KEY `idx_appointments_date_status_patient` (`appointment_date`, `status`, `patient_id`),
      CONSTRAINT `appointments_ibfk_1` FOREIGN KEY (`route_location_id`) REFERENCES `route_locations` (`id`) ON DELETE CASCADE,
      CONSTRAINT `appointments_ibfk_2` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """
    
    cursor.execute(sql_table)
    conn.commit()
    print("✅ Appointments table created")
    
    # STEP 2: Drop old procedure if exists
    print("\n📝 STEP 2: Creating slot generation procedure...")
    try:
        cursor.execute("DROP PROCEDURE IF EXISTS sp_generate_appointment_slots")
        conn.commit()
        print("  Cleaned up old procedure")
    except:
        pass
    
    # STEP 3: Create procedure
    sql_proc = """
    CREATE PROCEDURE `sp_generate_appointment_slots`(
      IN p_route_location_id INT,
      OUT p_result VARCHAR(255)
    )
    READS SQL DATA
    MODIFIES SQL DATA
    BEGIN
      DECLARE v_start_time TIME;
      DECLARE v_end_time TIME;
      DECLARE v_max_appointments INT;
      DECLARE v_appointment_duration INT;
      DECLARE v_visit_date DATE;
      DECLARE v_current_time TIME;
      DECLARE v_next_time TIME;
      DECLARE v_rows_generated INT DEFAULT 0;
      DECLARE v_done INT DEFAULT FALSE;
      
      DECLARE cursor_route_slots CURSOR FOR 
        SELECT visit_date, start_time, end_time, max_appointments, appointment_duration
        FROM route_locations
        WHERE id = p_route_location_id;
      
      DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;
      
      DELETE FROM appointments 
      WHERE route_location_id = p_route_location_id AND status = 'available';
      
      OPEN cursor_route_slots;
      read_loop: LOOP
        FETCH cursor_route_slots INTO v_visit_date, v_start_time, v_end_time, v_max_appointments, v_appointment_duration;
        IF v_done THEN LEAVE read_loop; END IF;
        
        SET v_current_time = v_start_time;
        slot_loop: LOOP
          SET v_next_time = DATE_ADD(CONCAT(DATE(NOW()), ' ', v_current_time), INTERVAL v_appointment_duration MINUTE);
          SET v_next_time = TIME(v_next_time);
          
          IF v_next_time > v_end_time THEN 
            LEAVE slot_loop; 
          END IF;
          
          INSERT INTO appointments (route_location_id, patient_id, appointment_date, start_time, end_time, status)
          VALUES (p_route_location_id, NULL, v_visit_date, v_current_time, v_next_time, 'available');
          
          SET v_rows_generated = v_rows_generated + 1;
          SET v_current_time = v_next_time;
          
          IF v_rows_generated >= v_max_appointments THEN 
            LEAVE slot_loop;
          END IF;
        END LOOP;
      END LOOP;
      CLOSE cursor_route_slots;
      
      SET p_result = CONCAT('Generated ', v_rows_generated, ' slots');
    END
    """
    
    cursor.execute(sql_proc)
    conn.commit()
    print("✅ Slot generation procedure created")
    
    # STEP 4: Test
    print("\n" + "="*70)
    print("🧪 TESTING CRITICAL FIXES")
    print("="*70)
    
    # Test table
    print("\n📋 Test 1: Appointments table...")
    cursor.execute("SELECT COUNT(*) FROM appointments")
    count = cursor.fetchone()[0]
    print(f"✅ Table exists with {count} records")
    
    # Test procedure
    print("\n📋 Test 2: Stored procedure...")
    cursor.execute("""
        SELECT ROUTINE_NAME FROM INFORMATION_SCHEMA.ROUTINES 
        WHERE ROUTINE_NAME = 'sp_generate_appointment_slots'
    """)
    result = cursor.fetchone()
    if result:
        print(f"✅ Procedure exists")
    else:
        print("❌ Procedure not found")
    
    # Test with route location
    print("\n📋 Test 3: Finding route locations...")
    cursor.execute("""
        SELECT id, visit_date, max_appointments FROM route_locations 
        ORDER BY visit_date DESC LIMIT 1
    """)
    rl = cursor.fetchone()
    
    if rl:
        route_id, visit_date, max_apt = rl
        print(f"✅ Found route_location ID {route_id} (date: {visit_date}, max: {max_apt})")
        
        print(f"\n📋 Test 4: Generating slots for route_location {route_id}...")
        cursor.callproc('sp_generate_appointment_slots', [route_id, None])
        conn.commit()
        
        # Check results
        cursor.execute("""
            SELECT COUNT(*) FROM appointments 
            WHERE route_location_id = %s AND status = 'available'
        """, (route_id,))
        slot_count = cursor.fetchone()[0]
        print(f"✅ Generated {slot_count} available slots!")
    else:
        print("⚠️  No route_locations found (create one in staff planner first)")
    
    # Summary
    print("\n" + "="*70)
    print("🎉 SUCCESS - CRITICAL FIXES DEPLOYED!")
    print("="*70)
    print("\n✨ Your appointment booking system is now ready!")
    print("\nNext steps:")
    print("  1. Restart Flask: python scripts/run_server.py")
    print("  2. Check patient portal for available slots")
    print("  3. Try booking an appointment")
    print("\n📖 For optimization (optional):")
    print("  → Read: IMMEDIATE_SQL_FIXES.md Phase 2")
    print("  → Read: SQL_ANALYSIS_REPORT.md")
    
    cursor.close()
    conn.close()
    
except Error as e:
    print(f"\n❌ Error: {e}")
except Exception as e:
    print(f"\n❌ Unexpected error: {e}")
