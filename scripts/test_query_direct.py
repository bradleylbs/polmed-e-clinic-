#!/usr/bin/env python3
"""
Direct database test - verify available appointments retrieval works
"""

import mysql.connector
import os
from datetime import date, timedelta

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

def test_direct_query():
    """Test the exact query used in app.py"""
    try:
        print("="*70)
        print("TESTING APPOINTMENT RETRIEVAL QUERY")
        print("="*70 + "\n")
        
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor(dictionary=True)
        print("✓ Connected to database\n")
        
        # Parameters
        date_from = "2025-10-17"
        date_to = "2025-11-16"
        province = "KwaZulu-Natal"
        
        print("Query Parameters:")
        print(f"  date_from: {date_from}")
        print(f"  date_to: {date_to}")
        print(f"  province: {province}\n")
        
        # Build the exact query from app.py
        query = """
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
                AND pa.appointment_date >= %s
                AND pa.appointment_date <= %s
                AND r.is_active = TRUE
                AND l.province = %s
            ORDER BY pa.appointment_date ASC, pa.appointment_time ASC
        """
        
        print("Executing query...\n")
        cursor.execute(query, [date_from, date_to, province])
        results = cursor.fetchall()
        
        print(f"✅ QUERY SUCCESSFUL!")
        print(f"   Total results: {len(results)} appointment slots\n")
        
        if results:
            print("Sample Results (first 10):")
            print("-" * 70)
            
            for idx, row in enumerate(results[:10], 1):
                print(f"\n[{idx}] Appointment Slot")
                print(f"    ID: {row['id']}")
                print(f"    Location: {row['location_name']}")
                print(f"    Date: {row['appointment_date']}")
                print(f"    Time: {row['appointment_time']}")
                print(f"    Status: {row['status']}")
                print(f"    Available Slots: {row['available_slots']}")
                print(f"    Duration: {row['appointment_duration']} min")
                print(f"    City: {row['city']}, Province: {row['province']}")
            
            if len(results) > 10:
                print(f"\n... and {len(results) - 10} more slots available")
        else:
            print("⚠ No results returned!")
        
        # Summary stats
        print("\n" + "="*70)
        print("SUMMARY")
        print("="*70)
        
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'Available' THEN 1 END) as available,
                COUNT(CASE WHEN status = 'Booked' THEN 1 END) as booked,
                COUNT(DISTINCT appointment_date) as unique_dates,
                COUNT(DISTINCT route_location_id) as unique_locations
            FROM patient_appointments
        """)
        
        stats = cursor.fetchone()
        print(f"\nDatabase Statistics:")
        print(f"  Total appointments: {stats['total']}")
        print(f"  Available: {stats['available']}")
        print(f"  Booked: {stats['booked']}")
        print(f"  Unique dates: {stats['unique_dates']}")
        print(f"  Unique locations: {stats['unique_locations']}")
        
        cursor.close()
        connection.close()
        
        print("\n" + "="*70)
        print("✅ READY FOR PATIENT PORTAL!")
        print("="*70)
        print("\nThe patient portal can now retrieve appointment slots.")
        print("Test by navigating to: http://localhost:3000/patient-portal")
        
        return True
        
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    import sys
    success = test_direct_query()
    sys.exit(0 if success else 1)
