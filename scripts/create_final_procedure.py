#!/usr/bin/env python3
"""
Final working stored procedure - no province filter (calls from app can filter)
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

def create_working_procedure():
    """Create working procedure"""
    try:
        print("Connecting to database...")
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor(dictionary=True)
        print("✓ Connected\n")
        
        print("="*70)
        print("CREATING FINAL WORKING PROCEDURE")
        print("="*70)
        
        # Drop old procedure
        print("\nDropping old procedure...")
        cursor.execute("DROP PROCEDURE IF EXISTS sp_get_available_appointments")
        connection.commit()
        print("✓ Dropped")
        
        # Create new procedure - simpler version that avoids collation issues
        sp_sql = """
CREATE PROCEDURE sp_get_available_appointments(
    IN p_date_from DATE,
    IN p_date_to DATE,
    IN p_province VARCHAR(100)
)
READS SQL DATA
NOT DETERMINISTIC
SQL SECURITY DEFINER
BEGIN
    -- If province is provided and not empty/null, filter by it
    IF p_province IS NULL OR p_province = '' THEN
        SELECT 
            pa.id,
            pa.route_location_id,
            pa.appointment_date,
            pa.appointment_time,
            pa.status,
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
            (rl.max_appointments - COALESCE((
                SELECT COUNT(*) 
                FROM patient_appointments pa2 
                WHERE pa2.route_location_id = rl.id 
                AND pa2.status IN ('Booked', 'Confirmed')
            ), 0)) AS available_slots
        FROM patient_appointments pa
        INNER JOIN route_locations rl ON pa.route_location_id = rl.id
        INNER JOIN locations l ON rl.location_id = l.id
        INNER JOIN routes r ON rl.route_id = r.id
        WHERE 
            pa.status = 'Available'
            AND pa.appointment_date >= p_date_from
            AND pa.appointment_date <= p_date_to
            AND r.is_active = TRUE
        ORDER BY 
            pa.appointment_date ASC, 
            pa.appointment_time ASC;
    ELSE
        SELECT 
            pa.id,
            pa.route_location_id,
            pa.appointment_date,
            pa.appointment_time,
            pa.status,
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
            (rl.max_appointments - COALESCE((
                SELECT COUNT(*) 
                FROM patient_appointments pa2 
                WHERE pa2.route_location_id = rl.id 
                AND pa2.status IN ('Booked', 'Confirmed')
            ), 0)) AS available_slots
        FROM patient_appointments pa
        INNER JOIN route_locations rl ON pa.route_location_id = rl.id
        INNER JOIN locations l ON rl.location_id = l.id
        INNER JOIN routes r ON rl.route_id = r.id
        WHERE 
            pa.status = 'Available'
            AND pa.appointment_date >= p_date_from
            AND pa.appointment_date <= p_date_to
            AND r.is_active = TRUE
            AND l.province = p_province
        ORDER BY 
            pa.appointment_date ASC, 
            pa.appointment_time ASC;
    END IF;
END
"""
        
        print("Creating sp_get_available_appointments...")
        cursor.execute(sp_sql)
        connection.commit()
        print("✓ Created successfully\n")
        
        # Test with no province filter
        print("="*70)
        print("TEST 1: No province filter")
        print("="*70)
        
        cursor.callproc('sp_get_available_appointments', [
            '2025-10-17',
            '2025-11-16',
            None
        ])
        
        results = cursor.fetchall()
        print(f"✓ Returned {len(results)} slots (first 5):\n")
        
        for idx, row in enumerate(results[:5], 1):
            print(f"  [{idx}] {row['location_name']} - {row['appointment_date']} @ {row['appointment_time']}")
        
        # Test with province filter
        print("\n" + "="*70)
        print("TEST 2: With province filter (KwaZulu-Natal)")
        print("="*70)
        
        cursor.callproc('sp_get_available_appointments', [
            '2025-10-17',
            '2025-11-16',
            'KwaZulu-Natal'
        ])
        
        results = cursor.fetchall()
        print(f"✓ Returned {len(results)} slots (first 5):\n")
        
        for idx, row in enumerate(results[:5], 1):
            print(f"  [{idx}] {row['location_name']} ({row['province']}) - {row['appointment_date']} @ {row['appointment_time']}")
        
        cursor.close()
        connection.close()
        
        print("\n" + "="*70)
        print("✅ PROCEDURE WORKING!")
        print("="*70)
        print("\nNow run: python scripts/test_procedures.py")
        return True
        
    except Exception as e:
        print(f"\n✗ Failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    import sys
    success = create_working_procedure()
    sys.exit(0 if success else 1)
