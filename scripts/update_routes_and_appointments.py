"""
Update routes and appointments to have current future dates
Updates both routes table and regenerates appointment slots
"""

import mysql.connector
from datetime import datetime, timedelta

# Database configuration
DB_CONFIG = {
    'host': 'db-polmed.mysql.database.azure.com',
    'database': 'palmed_clinic_erp',
    'user': 'dbadmin',
    'password': 'Polm3d!DB@2025',
    'ssl_disabled': False
}

def get_connection():
    """Get database connection"""
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        return connection
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return None

def update_routes_dates():
    """Update all active routes to have dates starting from today"""
    connection = get_connection()
    if not connection:
        return False
    
    try:
        cursor = connection.cursor(dictionary=True)
        
        print("\n" + "="*80)
        print("UPDATING ROUTE DATES")
        print("="*80)
        
        # Get current routes
        cursor.execute("""
            SELECT id, route_name, start_date, end_date, status
            FROM routes
            WHERE status IN ('ACTIVE', 'DRAFT', 'COMPLETED')
            ORDER BY id
        """)
        
        routes = cursor.fetchall()
        print(f"\n📍 Found {len(routes)} routes to update")
        
        today = datetime.now().date()
        new_start = today
        new_end = today + timedelta(days=60)  # 60 days from today
        
        print(f"\n📅 New date range:")
        print(f"  Start: {new_start}")
        print(f"  End: {new_end}")
        
        # Update each route
        updated_count = 0
        for route in routes:
            print(f"\n  Updating Route #{route['id']} ({route['route_name']})")
            print(f"    Old: {route['start_date']} to {route['end_date']} [{route['status']}]")
            
            # Update route dates and set to ACTIVE
            update_query = """
            UPDATE routes
            SET start_date = %s,
                end_date = %s,
                status = 'ACTIVE'
            WHERE id = %s
            """
            
            cursor.execute(update_query, (new_start, new_end, route['id']))
            connection.commit()
            
            print(f"    New: {new_start} to {new_end} [ACTIVE]")
            updated_count += 1
        
        print(f"\n✅ Updated {updated_count} routes")
        
        # Now update route_locations visit dates
        print(f"\n🗺️  Updating route_locations visit dates...")
        
        cursor.execute("""
            SELECT id, route_id, visit_date
            FROM route_locations
            ORDER BY route_id, id
        """)
        
        locations = cursor.fetchall()
        print(f"  Found {len(locations)} route locations")
        
        if locations:
            # Group locations by route_id to assign unique dates per route
            route_day_counter = {}
            
            for location in locations:
                route_id = location['route_id']
                
                # Track which day offset this route is on
                if route_id not in route_day_counter:
                    route_day_counter[route_id] = 0
                
                # Calculate visit date (each location for the same route gets different date)
                days_offset = route_day_counter[route_id]
                new_visit_date = new_start + timedelta(days=days_offset)
                
                update_loc_query = """
                UPDATE route_locations
                SET visit_date = %s
                WHERE id = %s
                """
                
                cursor.execute(update_loc_query, (new_visit_date, location['id']))
                print(f"    Location #{location['id']} (Route #{route_id}): {new_visit_date}")
                
                # Increment day counter for this route
                route_day_counter[route_id] += 1
            
            connection.commit()
            print(f"  ✅ Updated {len(locations)} location visit dates")
        
        # Clear old appointments and regenerate
        print(f"\n🗑️  Clearing old appointment slots...")
        cursor.execute("DELETE FROM patient_appointments")
        connection.commit()
        deleted = cursor.rowcount
        print(f"  Deleted {deleted} old appointments")
        
        # Regenerate appointments for each route_location
        print(f"\n🔄 Regenerating appointment slots...")
        
        cursor.execute("""
            SELECT id, route_id, visit_date
            FROM route_locations
            ORDER BY route_id, visit_date
        """)
        
        locations = cursor.fetchall()
        total_slots = 0
        
        for location in locations:
            try:
                # Call stored procedure with OUT parameter
                # The OUT parameter will be set by the procedure
                args = [location['id'], 0]  # IN: location_id, OUT: slot_count
                result = cursor.callproc('sp_generate_appointment_slots', args)
                
                # result[1] contains the OUT parameter (slot_count)
                slot_count = result[1]
                total_slots += slot_count
                
                print(f"    Location #{location['id']}: {slot_count} slots on {location['visit_date']}")
                
            except Exception as e:
                print(f"    ⚠️  Location #{location['id']}: Error - {e}")
        
        connection.commit()
        print(f"\n✅ Generated {total_slots} total appointment slots")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        connection.rollback()
        return False
    finally:
        cursor.close()
        connection.close()

def verify_updates():
    """Verify the updates were successful"""
    connection = get_connection()
    if not connection:
        return
    
    try:
        cursor = connection.cursor(dictionary=True)
        
        print("\n" + "="*80)
        print("VERIFICATION")
        print("="*80)
        
        # Check routes
        cursor.execute("""
            SELECT COUNT(*) as count, status,
                   MIN(start_date) as earliest_start,
                   MAX(end_date) as latest_end
            FROM routes
            GROUP BY status
        """)
        
        print("\n📍 Routes by Status:")
        for row in cursor.fetchall():
            print(f"  {row['status']}: {row['count']} routes ({row['earliest_start']} to {row['latest_end']})")
        
        # Check appointments
        cursor.execute("""
            SELECT 
                MIN(appointment_date) as earliest,
                MAX(appointment_date) as latest,
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'Available' THEN 1 END) as available
            FROM patient_appointments
        """)
        
        appt = cursor.fetchone()
        print(f"\n📅 Appointments:")
        print(f"  Total: {appt['total']}")
        print(f"  Available: {appt['available']}")
        print(f"  Date Range: {appt['earliest']} to {appt['latest']}")
        
        # Check appointments by date
        cursor.execute("""
            SELECT 
                appointment_date,
                COUNT(*) as count
            FROM patient_appointments
            GROUP BY appointment_date
            ORDER BY appointment_date
            LIMIT 10
        """)
        
        print(f"\n📊 Appointments by Date (first 10 days):")
        for row in cursor.fetchall():
            print(f"  {row['appointment_date']}: {row['count']} slots")
        
    except Exception as e:
        print(f"❌ Verification error: {e}")
    finally:
        cursor.close()
        connection.close()

def main():
    """Main execution"""
    print("\n" + "="*80)
    print("ROUTE AND APPOINTMENT DATE UPDATE")
    print("Current Date: " + str(datetime.now().date()))
    print("="*80)
    
    if update_routes_dates():
        verify_updates()
        print("\n" + "="*80)
        print("✅ SUCCESS - All dates updated!")
        print("="*80)
        print("\n💡 Routes and appointments are now bookable for the next 60 days")
        print("   Patients can book appointments starting from today")
    else:
        print("\n❌ FAILED - Could not update dates")

if __name__ == "__main__":
    main()
