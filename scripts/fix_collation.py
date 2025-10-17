#!/usr/bin/env python3
"""
Fix collation mismatch in stored procedures
"""

import mysql.connector
import os

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

def fix_collation():
    """Fix collation issues"""
    try:
        print("Connecting to database...")
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor()
        print("✓ Connected\n")
        
        print("="*70)
        print("FIXING COLLATION MISMATCH")
        print("="*70)
        
        # Drop and recreate procedure with proper collation
        print("\nDropping sp_get_available_appointments...")
        cursor.execute("DROP PROCEDURE IF EXISTS sp_get_available_appointments")
        connection.commit()
        
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
    DECLARE v_province VARCHAR(100);
    SET v_province = p_province COLLATE utf8mb4_0900_ai_ci;
    
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
        l.location_name COLLATE utf8mb4_0900_ai_ci AS location_name,
        l.address,
        l.city,
        l.province COLLATE utf8mb4_0900_ai_ci AS province,
        r.id AS route_id,
        r.route_name,
        r.route_type,
        (SELECT COUNT(*) FROM patient_appointments pa2 
         WHERE pa2.route_location_id = rl.id 
         AND pa2.status IN ('Booked', 'Confirmed')) AS booked_count,
        (rl.max_appointments - (SELECT COUNT(*) FROM patient_appointments pa2 
         WHERE pa2.route_location_id = rl.id 
         AND pa2.status IN ('Booked', 'Confirmed'))) AS available_slots
    FROM patient_appointments pa
    INNER JOIN route_locations rl ON pa.route_location_id = rl.id
    INNER JOIN locations l ON rl.location_id = l.id
    INNER JOIN routes r ON rl.route_id = r.id
    WHERE 
        pa.status = 'Available'
        AND pa.appointment_date >= p_date_from
        AND pa.appointment_date <= p_date_to
        AND (v_province IS NULL OR v_province = '' OR l.province COLLATE utf8mb4_0900_ai_ci = v_province)
        AND r.is_active = TRUE
    ORDER BY 
        pa.appointment_date ASC, 
        pa.appointment_time ASC;
    
END
"""
        
        print("Creating fixed sp_get_available_appointments...")
        cursor.execute(sp2_sql)
        connection.commit()
        print("✓ Created with proper collation\n")
        
        cursor.close()
        connection.close()
        
        print("="*70)
        print("✓ Collation fix completed!")
        print("="*70)
        return True
        
    except Exception as e:
        print(f"\n✗ Failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    import sys
    success = fix_collation()
    sys.exit(0 if success else 1)
