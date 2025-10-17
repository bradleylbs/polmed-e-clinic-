#!/usr/bin/env python3
"""
Remove duplicate appointments - keep only one per time slot
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

def remove_duplicates():
    """Remove duplicate appointments"""
    try:
        print("="*70)
        print("REMOVING DUPLICATE APPOINTMENTS")
        print("="*70 + "\n")
        
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor(dictionary=True)
        print("✓ Connected to database\n")
        
        # Check current count
        cursor.execute("SELECT COUNT(*) as count FROM patient_appointments WHERE status = 'Available'")
        before = cursor.fetchone()['count']
        print(f"Before: {before} available appointments\n")
        
        # Find duplicates - keep the one with the lowest ID
        print("Identifying duplicates to remove...\n")
        
        # Use a temp table workaround for the self-join issue
        cursor.execute("""
            CREATE TEMPORARY TABLE temp_keep_ids AS
            SELECT MIN(id) as id
            FROM patient_appointments
            WHERE status = 'Available'
            GROUP BY route_location_id, appointment_date, appointment_time
        """)
        
        cursor.execute("""
            DELETE FROM patient_appointments
            WHERE status = 'Available'
            AND id NOT IN (SELECT id FROM temp_keep_ids)
        """)
        
        deleted = cursor.rowcount
        connection.commit()
        
        print(f"Deleted: {deleted} duplicate appointments\n")
        
        # Check after
        cursor.execute("SELECT COUNT(*) as count FROM patient_appointments WHERE status = 'Available'")
        after = cursor.fetchone()['count']
        print(f"After: {after} available appointments\n")
        
        # Verify the cleanup
        print("Verifying cleanup...")
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
        """)
        
        remaining_dups = cursor.fetchall()
        if remaining_dups:
            print(f"⚠️ Still found {len(remaining_dups)} duplicate groups!")
        else:
            print("✓ No duplicates remaining!")
        
        # Show final state
        print("\n" + "="*70)
        print("FINAL STATE")
        print("="*70 + "\n")
        
        cursor.execute("""
            SELECT 
                rl.id as location_id,
                l.location_name,
                rl.visit_date,
                COUNT(pa.id) as appointment_count
            FROM route_locations rl
            LEFT JOIN locations l ON rl.location_id = l.id
            LEFT JOIN patient_appointments pa ON rl.id = pa.route_location_id AND pa.status = 'Available'
            WHERE rl.visit_date >= '2025-10-17'
            GROUP BY rl.id
            ORDER BY rl.visit_date
        """)
        
        locations = cursor.fetchall()
        for loc in locations:
            print(f"Location {loc['location_id']}: {loc['location_name']}")
            print(f"  Date: {loc['visit_date']}")
            print(f"  Available Slots: {loc['appointment_count']}")
        
        cursor.close()
        connection.close()
        
        print("\n" + "="*70)
        print("✅ CLEANUP COMPLETE")
        print("="*70)
        return True
        
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    import sys
    success = remove_duplicates()
    sys.exit(0 if success else 1)
