#!/usr/bin/env python3
"""
Quick test script to verify stored procedures work with real data
"""

import mysql.connector
import os
from datetime import date, timedelta

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

def test_procedures():
    """Test stored procedures"""
    try:
        print("Connecting to database...")
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor(dictionary=True)
        print("✓ Connected\n")
        
        # ============================================================================
        # TEST 1: Check if procedures exist
        # ============================================================================
        print("="*70)
        print("TEST 1: Verify Procedures Exist")
        print("="*70)
        
        cursor.execute("""
            SELECT ROUTINE_NAME 
            FROM INFORMATION_SCHEMA.ROUTINES 
            WHERE ROUTINE_SCHEMA = %s
            AND ROUTINE_NAME IN ('sp_generate_appointment_slots', 'sp_get_available_appointments')
            ORDER BY ROUTINE_NAME
        """, (DB_CONFIG['database'],))
        
        procedures = cursor.fetchall()
        if procedures:
            print(f"✓ Found {len(procedures)} procedures:")
            for proc in procedures:
                print(f"  - {proc['ROUTINE_NAME']}")
        else:
            print("✗ No procedures found!")
            return False
        
        # ============================================================================
        # TEST 2: Get current data
        # ============================================================================
        print("\n" + "="*70)
        print("TEST 2: Current Data Status")
        print("="*70)
        
        cursor.execute("SELECT COUNT(*) as count FROM routes WHERE is_active = TRUE")
        routes_count = cursor.fetchone()
        print(f"Active routes: {routes_count['count']}")
        
        cursor.execute("SELECT COUNT(*) as count FROM route_locations")
        rl_count = cursor.fetchone()
        print(f"Route locations: {rl_count['count']}")
        
        cursor.execute("SELECT COUNT(*) as count FROM patient_appointments WHERE status = 'Available'")
        available_count = cursor.fetchone()
        print(f"Available appointments: {available_count['count']}")
        
        cursor.execute("""
            SELECT 
                route_location_id,
                COUNT(*) as count,
                MIN(appointment_date) as min_date,
                MAX(appointment_date) as max_date
            FROM patient_appointments
            WHERE status = 'Available'
            GROUP BY route_location_id
        """)
        
        slots_by_location = cursor.fetchall()
        if slots_by_location:
            print(f"\nSlots by location:")
            for row in slots_by_location:
                print(f"  Route Location {row['route_location_id']}: {row['count']} slots ({row['min_date']} to {row['max_date']})")
        
        # ============================================================================
        # TEST 3: Call sp_get_available_appointments
        # ============================================================================
        print("\n" + "="*70)
        print("TEST 3: Call sp_get_available_appointments")
        print("="*70)
        
        date_from = str(date.today())
        date_to = str(date.today() + timedelta(days=30))
        province = "KwaZulu-Natal"
        
        print(f"Parameters:")
        print(f"  date_from: {date_from}")
        print(f"  date_to: {date_to}")
        print(f"  province: {province}")
        
        cursor.callproc('sp_get_available_appointments', [date_from, date_to, province])
        
        results = cursor.fetchall()
        print(f"\n✓ Procedure returned {len(results)} available slot groups")
        
        if results:
            print("\nAvailable Appointments:")
            for idx, row in enumerate(results, 1):
                print(f"\n  [{idx}] {row.get('location_name', 'Unknown')}")
                print(f"      Date: {row.get('appointment_date', row.get('visit_date', 'N/A'))}")
                print(f"      Time: {row.get('appointment_time', row.get('start_time', 'N/A'))}")
                print(f"      Available Slots: {row.get('available_slots', 'N/A')}")
                print(f"      City: {row.get('city', 'N/A')}, Province: {row.get('province', 'N/A')}")
                print(f"      Route: {row.get('route_name', 'N/A')}")
        else:
            print("⚠ No results returned")
        
        # ============================================================================
        # TEST 4: Verify data integrity
        # ============================================================================
        print("\n" + "="*70)
        print("TEST 4: Data Integrity Checks")
        print("="*70)
        
        # Check for orphaned appointments
        cursor.execute("""
            SELECT COUNT(*) as count
            FROM patient_appointments pa
            WHERE pa.route_location_id NOT IN (SELECT id FROM route_locations)
        """)
        orphaned = cursor.fetchone()
        print(f"Orphaned appointments: {orphaned['count']} {'✓' if orphaned['count'] == 0 else '✗'}")
        
        # Check valid status values
        cursor.execute("""
            SELECT DISTINCT status FROM patient_appointments
            WHERE status NOT IN ('Available', 'Booked', 'Confirmed', 'Completed', 'Cancelled', 'NoShow')
        """)
        invalid_status = cursor.fetchall()
        if invalid_status:
            print(f"Invalid status values: {[row['status'] for row in invalid_status]} ✗")
        else:
            print(f"Valid status values only ✓")
        
        # Check for duplicate booking references
        cursor.execute("""
            SELECT COUNT(*) as count
            FROM (
                SELECT booking_reference, COUNT(*) as cnt
                FROM patient_appointments
                WHERE booking_reference IS NOT NULL
                GROUP BY booking_reference
                HAVING cnt > 1
            ) as duplicates
        """)
        duplicate_refs = cursor.fetchone()
        print(f"Duplicate booking references: {duplicate_refs['count']} {'✓' if duplicate_refs['count'] == 0 else '✗'}")
        
        # ============================================================================
        # TEST 5: Summary
        # ============================================================================
        print("\n" + "="*70)
        print("TEST 5: Summary Report")
        print("="*70)
        
        cursor.execute("""
            SELECT 
                (SELECT COUNT(*) FROM routes WHERE is_active = TRUE) as active_routes,
                (SELECT COUNT(*) FROM route_locations) as total_locations,
                (SELECT COUNT(*) FROM patient_appointments) as total_appointments,
                (SELECT COUNT(*) FROM patient_appointments WHERE status = 'Available') as available,
                (SELECT COUNT(*) FROM patient_appointments WHERE status = 'Booked') as booked,
                (SELECT COUNT(*) FROM patient_appointments WHERE status = 'Confirmed') as confirmed
        """)
        
        summary = cursor.fetchone()
        print(f"Active Routes: {summary['active_routes']}")
        print(f"Total Locations: {summary['total_locations']}")
        print(f"Total Appointments: {summary['total_appointments']}")
        print(f"  - Available: {summary['available']}")
        print(f"  - Booked: {summary['booked']}")
        print(f"  - Confirmed: {summary['confirmed']}")
        
        cursor.close()
        connection.close()
        
        print("\n" + "="*70)
        print("✓ All tests completed successfully!")
        print("="*70)
        return True
        
    except Exception as e:
        print(f"\n✗ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    import sys
    success = test_procedures()
    sys.exit(0 if success else 1)
