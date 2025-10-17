#!/usr/bin/env python3
"""
Debug duplicate appointments and date formatting issues
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

def debug_duplicates():
    """Debug duplicate appointments"""
    try:
        print("="*70)
        print("DEBUGGING DUPLICATE APPOINTMENTS")
        print("="*70 + "\n")
        
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor(dictionary=True)
        print("✓ Connected to database\n")
        
        # Check 1: Look for exact duplicates
        print("Check 1: Identical appointment rows")
        print("-" * 70)
        
        cursor.execute("""
            SELECT 
                route_location_id,
                appointment_date,
                appointment_time,
                COUNT(*) as count
            FROM patient_appointments
            WHERE status = 'Available'
            GROUP BY route_location_id, appointment_date, appointment_time
            HAVING count > 1
            ORDER BY count DESC
        """)
        
        duplicates = cursor.fetchall()
        if duplicates:
            print(f"Found {len(duplicates)} duplicate groups:\n")
            for dup in duplicates:
                print(f"  Location {dup['route_location_id']}: {dup['appointment_date']} @ {dup['appointment_time']}")
                print(f"    Count: {dup['count']} (should be 1)")
        else:
            print("✓ No exact duplicates found")
        
        # Check 2: Look at all available appointments
        print("\n\nCheck 2: All Available Appointments")
        print("-" * 70)
        
        cursor.execute("""
            SELECT 
                pa.id,
                pa.route_location_id,
                pa.appointment_date,
                pa.appointment_time,
                pa.status,
                l.location_name,
                l.province
            FROM patient_appointments pa
            INNER JOIN route_locations rl ON pa.route_location_id = rl.id
            INNER JOIN locations l ON rl.location_id = l.id
            INNER JOIN routes r ON rl.route_id = r.id
            WHERE pa.status = 'Available'
            AND pa.appointment_date >= '2025-10-17'
            AND pa.appointment_date <= '2025-11-16'
            AND l.province = 'KwaZulu-Natal'
            AND r.is_active = TRUE
            ORDER BY pa.appointment_date, pa.appointment_time, pa.id
        """)
        
        results = cursor.fetchall()
        print(f"\nTotal available appointments: {len(results)}\n")
        
        # Group by date/time to show duplicates
        from collections import defaultdict
        grouped = defaultdict(list)
        
        for row in results:
            key = f"{row['appointment_date']}@{row['appointment_time']}"
            grouped[key].append(row)
        
        print("Grouped by Date/Time:")
        for key in sorted(grouped.keys()):
            appointments = grouped[key]
            if len(appointments) > 1:
                print(f"\n⚠️ DUPLICATE: {key} ({len(appointments)} appointments)")
                for apt in appointments:
                    print(f"   ID: {apt['id']}, Location: {apt['location_name']}")
            else:
                apt = appointments[0]
                print(f"\n✓ {key}")
                print(f"   ID: {apt['id']}, Location: {apt['location_name']}")
        
        # Check 3: Check route_locations for duplicates
        print("\n\nCheck 3: Route Locations")
        print("-" * 70)
        
        cursor.execute("""
            SELECT 
                rl.id,
                rl.route_id,
                rl.location_id,
                rl.visit_date,
                rl.start_time,
                rl.end_time,
                l.location_name,
                COUNT(pa.id) as appointment_count
            FROM route_locations rl
            LEFT JOIN locations l ON rl.location_id = l.id
            LEFT JOIN patient_appointments pa ON rl.id = pa.route_location_id
            WHERE rl.visit_date >= '2025-10-17'
            AND rl.visit_date <= '2025-11-16'
            GROUP BY rl.id
            ORDER BY rl.visit_date, rl.start_time
        """)
        
        locations = cursor.fetchall()
        print(f"\nTotal route locations: {len(locations)}\n")
        
        for loc in locations:
            print(f"Route Location ID {loc['id']}: {loc['location_name']}")
            print(f"  Visit Date: {loc['visit_date']}")
            print(f"  Time: {loc['start_time']} - {loc['end_time']}")
            print(f"  Appointments: {loc['appointment_count']}")
        
        # Check 4: Check for data quality issues
        print("\n\nCheck 4: Data Quality Issues")
        print("-" * 70)
        
        # NULL values
        cursor.execute("""
            SELECT 
                SUM(CASE WHEN appointment_date IS NULL THEN 1 ELSE 0 END) as null_dates,
                SUM(CASE WHEN appointment_time IS NULL THEN 1 ELSE 0 END) as null_times,
                SUM(CASE WHEN status IS NULL THEN 1 ELSE 0 END) as null_status
            FROM patient_appointments
        """)
        
        quality = cursor.fetchone()
        print(f"\nNULL values:")
        print(f"  NULL dates: {quality['null_dates']}")
        print(f"  NULL times: {quality['null_times']}")
        print(f"  NULL status: {quality['null_status']}")
        
        # Invalid date formats
        cursor.execute("""
            SELECT 
                COUNT(*) as invalid_dates
            FROM patient_appointments
            WHERE appointment_date < '2025-01-01' 
            OR appointment_date > '2026-12-31'
        """)
        
        invalid = cursor.fetchone()
        print(f"  Invalid date range: {invalid['invalid_dates']}")
        
        cursor.close()
        connection.close()
        
        print("\n" + "="*70)
        print("DEBUG COMPLETE")
        print("="*70)
        
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_duplicates()
