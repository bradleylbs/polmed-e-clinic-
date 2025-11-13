"""
Extend route dates to provide longer booking window
Updates routes to start from today and extend 60 days into the future
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

def extend_routes():
    """Extend route dates for longer booking window"""
    connection = get_connection()
    if not connection:
        return False
    
    try:
        cursor = connection.cursor(dictionary=True)
        
        print("\n" + "="*80)
        print("EXTENDING ROUTE DATES")
        print("="*80)
        
        # Calculate new dates
        today = datetime.now().date()
        end_date = today + timedelta(days=60)  # 60 days from today
        
        print(f"\n📅 New Date Range:")
        print(f"  • Start Date: {today}")
        print(f"  • End Date: {end_date}")
        print(f"  • Duration: 60 days")
        
        # Check current routes
        print(f"\n📊 Checking current routes...")
        cursor.execute("""
            SELECT 
                id,
                route_name,
                start_date,
                end_date,
                status
            FROM routes
            ORDER BY id
        """)
        
        routes = cursor.fetchall()
        print(f"\nFound {len(routes)} routes:")
        for route in routes:
            print(f"  • Route #{route['id']} ({route['route_name']}): {route['start_date']} to {route['end_date']} [{route['status']}]")
        
        # Update all routes
        print(f"\n🔧 Updating route dates...")
        
        update_query = """
        UPDATE routes
        SET start_date = %s,
            end_date = %s,
            status = 'ACTIVE'
        WHERE id IN (37, 38, 39)
        """
        
        cursor.execute(update_query, (today, end_date))
        connection.commit()
        
        updated_count = cursor.rowcount
        print(f"✅ Updated {updated_count} routes")
        
        # Update route_locations visit dates
        print(f"\n🗺️  Updating route_locations visit dates...")
        
        # Get all route_locations for the active routes
        cursor.execute("""
            SELECT id, route_id, visit_date
            FROM route_locations
            WHERE route_id IN (37, 38, 39)
            ORDER BY route_id, visit_date
        """)
        
        locations = cursor.fetchall()
        print(f"Found {len(locations)} route locations to update")
        
        # Update each location's visit_date to be within the new range
        for i, loc in enumerate(locations):
            # Spread locations across the 60-day period
            days_offset = (i % 7) + (i // 7)  # Distribute across weeks
            new_visit_date = today + timedelta(days=days_offset)
            
            cursor.execute("""
                UPDATE route_locations
                SET visit_date = %s
                WHERE id = %s
            """, (new_visit_date, loc['id']))
        
        connection.commit()
        print(f"✅ Updated {len(locations)} route location dates")
        
        # Regenerate appointment slots for the new dates
        print(f"\n🔄 Regenerating appointment slots...")
        
        # Clear old appointments
        cursor.execute("""
            DELETE FROM patient_appointments
            WHERE route_location_id IN (
                SELECT id FROM route_locations WHERE route_id IN (37, 38, 39)
            )
        """)
        deleted_count = cursor.rowcount
        print(f"  • Cleared {deleted_count} old appointment slots")
        
        # Generate new slots for each location
        cursor.execute("""
            SELECT id, route_id, visit_date
            FROM route_locations
            WHERE route_id IN (37, 38, 39)
            ORDER BY route_id, visit_date
        """)
        
        locations = cursor.fetchall()
        total_slots = 0
        
        for loc in locations:
            # Call stored procedure to generate slots
            try:
                cursor.callproc('sp_generate_appointment_slots', [loc['id']])
                # Fetch results to clear the buffer
                for result in cursor.stored_results():
                    result.fetchall()
                
                # Count slots created
                cursor.execute("""
                    SELECT COUNT(*) as slot_count
                    FROM patient_appointments
                    WHERE route_location_id = %s
                """, (loc['id'],))
                
                slot_info = cursor.fetchone()
                slot_count = slot_info['slot_count'] if slot_info else 0
                total_slots += slot_count
                
            except Exception as e:
                print(f"  ⚠️  Error generating slots for location {loc['id']}: {e}")
                continue
        
        connection.commit()
        print(f"✅ Generated {total_slots} new appointment slots")
        
        # Verify the updates
        print(f"\n📊 Verifying updates...")
        
        cursor.execute("""
            SELECT 
                r.id,
                r.route_name,
                r.start_date,
                r.end_date,
                r.status,
                COUNT(DISTINCT rl.id) as location_count,
                COUNT(pa.id) as appointment_count
            FROM routes r
            LEFT JOIN route_locations rl ON r.id = rl.route_id
            LEFT JOIN patient_appointments pa ON rl.id = pa.route_location_id
            WHERE r.id IN (37, 38, 39)
            GROUP BY r.id, r.route_name, r.start_date, r.end_date, r.status
        """)
        
        updated_routes = cursor.fetchall()
        
        print(f"\nUpdated Route Summary:")
        for route in updated_routes:
            print(f"\n  Route #{route['id']} - {route['route_name']}")
            print(f"    • Dates: {route['start_date']} to {route['end_date']}")
            print(f"    • Status: {route['status']}")
            print(f"    • Locations: {route['location_count']}")
            print(f"    • Appointments: {route['appointment_count']}")
        
        # Check appointment date distribution
        cursor.execute("""
            SELECT 
                DATE(appointment_date) as appt_date,
                COUNT(*) as slot_count
            FROM patient_appointments pa
            JOIN route_locations rl ON pa.route_location_id = rl.id
            WHERE rl.route_id IN (37, 38, 39)
            GROUP BY DATE(appointment_date)
            ORDER BY appt_date
            LIMIT 10
        """)
        
        date_dist = cursor.fetchall()
        print(f"\n📅 Appointment Date Distribution (first 10 days):")
        for row in date_dist:
            print(f"  {row['appt_date']}: {row['slot_count']} slots")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        connection.rollback()
        return False
    finally:
        cursor.close()
        connection.close()

def main():
    """Main execution"""
    if extend_routes():
        print("\n" + "="*80)
        print("✅ SUCCESS - Routes extended with 60-day booking window!")
        print("="*80)
        print("\n💡 Patients can now book appointments for the next 60 days")
        print("   starting from today through the patient portal")
    else:
        print("\n❌ FAILED - Could not extend route dates")

if __name__ == "__main__":
    main()
