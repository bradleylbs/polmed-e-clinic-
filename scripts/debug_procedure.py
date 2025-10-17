#!/usr/bin/env python3
"""
Debug and fix the stored procedure to return actual data
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

def debug_and_fix():
    """Debug and fix the procedure"""
    try:
        print("Connecting to database...")
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor(dictionary=True)
        print("✓ Connected\n")
        
        print("="*70)
        print("DEBUGGING PROCEDURE ISSUE")
        print("="*70)
        
        # Check what the direct query returns
        print("\nTest 1: Direct query (no procedure)")
        cursor.execute("""
            SELECT 
                pa.id,
                pa.appointment_date,
                pa.appointment_time,
                pa.status,
                rl.visit_date,
                rl.start_time,
                rl.end_time,
                rl.max_appointments,
                l.location_name,
                l.city,
                l.province,
                r.route_name,
                r.is_active
            FROM patient_appointments pa
            INNER JOIN route_locations rl ON pa.route_location_id = rl.id
            INNER JOIN locations l ON rl.location_id = l.id
            INNER JOIN routes r ON rl.route_id = r.id
            WHERE pa.status = 'Available'
            AND pa.appointment_date >= '2025-10-17'
            AND pa.appointment_date <= '2025-11-16'
            AND r.is_active = TRUE
            LIMIT 5
        """)
        
        results = cursor.fetchall()
        print(f"Direct query returned {len(results)} rows")
        if results:
            for row in results:
                print(f"  - {row['location_name']} on {row['appointment_date']}")
        
        # Check location province
        print("\nTest 2: Check province values")
        cursor.execute("""
            SELECT DISTINCT province FROM locations LIMIT 5
        """)
        provinces = cursor.fetchall()
        print(f"Provinces in DB: {[p['province'] for p in provinces]}")
        
        # Check with NULL province
        print("\nTest 3: Direct query with NULL province filter")
        cursor.execute("""
            SELECT 
                pa.id,
                pa.appointment_date,
                l.location_name,
                l.province
            FROM patient_appointments pa
            INNER JOIN route_locations rl ON pa.route_location_id = rl.id
            INNER JOIN locations l ON rl.location_id = l.id
            INNER JOIN routes r ON rl.route_id = r.id
            WHERE pa.status = 'Available'
            AND pa.appointment_date >= '2025-10-17'
            AND pa.appointment_date <= '2025-11-16'
            AND r.is_active = TRUE
            AND (NULL IS NULL OR NULL = '' OR l.province = NULL)
            LIMIT 5
        """)
        
        results = cursor.fetchall()
        print(f"Query with NULL filter returned {len(results)} rows")
        if results:
            for row in results:
                print(f"  - {row['location_name']} ({row['province']})")
        
        # Now recreate the procedure with simpler logic
        print("\n" + "="*70)
        print("CREATING FIXED PROCEDURE (SIMPLIFIED)")
        print("="*70)
        
        print("\nDropping old procedure...")
        cursor.execute("DROP PROCEDURE IF EXISTS sp_get_available_appointments")
        connection.commit()
        
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
        AND (
            p_province IS NULL 
            OR p_province = '' 
            OR l.province = CAST(p_province AS CHAR(100))
        )
    ORDER BY 
        pa.appointment_date ASC, 
        pa.appointment_time ASC;
END
"""
        
        print("Creating sp_get_available_appointments (simplified)...")
        cursor.execute(sp_sql)
        connection.commit()
        print("✓ Created successfully\n")
        
        # Test the new procedure
        print("="*70)
        print("TESTING FIXED PROCEDURE")
        print("="*70)
        
        print("\nCalling procedure with:")
        print("  date_from: 2025-10-17")
        print("  date_to: 2025-11-16")
        print("  province: KwaZulu-Natal")
        
        cursor.callproc('sp_get_available_appointments', [
            '2025-10-17',
            '2025-11-16',
            'KwaZulu-Natal'
        ])
        
        results = cursor.fetchall()
        print(f"\n✓ Procedure returned {len(results)} available slots")
        
        if results:
            print("\nResults:")
            for idx, row in enumerate(results[:10], 1):
                print(f"  [{idx}] {row['location_name']} - {row['appointment_date']} @ {row['appointment_time']} (Available: {row['available_slots']})")
        
        cursor.close()
        connection.close()
        
        print("\n" + "="*70)
        print("✓ Procedure fixed and tested successfully!")
        print("="*70)
        return True
        
    except Exception as e:
        print(f"\n✗ Failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    import sys
    success = debug_and_fix()
    sys.exit(0 if success else 1)
