"""
Update appointment slot dates to be bookable from today
Updates patient_appointments table to have dates starting from today
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

def update_appointment_dates():
    """Update appointment dates to start from today"""
    connection = get_connection()
    if not connection:
        return False
    
    try:
        cursor = connection.cursor(dictionary=True)
        
        # First, check current appointment dates
        print("\n📊 Checking current appointment dates...")
        cursor.execute("""
            SELECT 
                MIN(appointment_date) as earliest_date,
                MAX(appointment_date) as latest_date,
                COUNT(*) as total_appointments,
                COUNT(CASE WHEN status = 'Available' THEN 1 END) as available_count
            FROM patient_appointments
        """)
        
        current_stats = cursor.fetchone()
        print(f"\nCurrent Appointment Stats:")
        print(f"  • Earliest: {current_stats['earliest_date']}")
        print(f"  • Latest: {current_stats['latest_date']}")
        print(f"  • Total: {current_stats['total_appointments']}")
        print(f"  • Available: {current_stats['available_count']}")
        
        # Calculate date shift
        if current_stats['earliest_date']:
            today = datetime.now().date()
            earliest = current_stats['earliest_date']
            
            if isinstance(earliest, str):
                earliest = datetime.strptime(earliest, '%Y-%m-%d').date()
            
            days_diff = (today - earliest).days
            
            print(f"\n📅 Date Adjustment:")
            print(f"  • Today: {today}")
            print(f"  • Current earliest: {earliest}")
            print(f"  • Days to shift forward: {days_diff}")
            
            if days_diff > 0:
                # Update appointment dates
                print(f"\n🔧 Updating appointment dates...")
                
                update_query = """
                UPDATE patient_appointments
                SET appointment_date = DATE_ADD(appointment_date, INTERVAL %s DAY)
                """
                
                cursor.execute(update_query, (days_diff,))
                connection.commit()
                
                print(f"✅ Updated {cursor.rowcount} appointment dates")
                
                # Also update route_locations visit_date
                print(f"\n🔧 Updating route_locations visit dates...")
                
                update_route_query = """
                UPDATE route_locations
                SET visit_date = DATE_ADD(visit_date, INTERVAL %s DAY)
                WHERE visit_date < CURDATE()
                """
                
                cursor.execute(update_route_query, (days_diff,))
                connection.commit()
                
                print(f"✅ Updated {cursor.rowcount} route location dates")
                
                # Verify the update
                print(f"\n📊 Verifying updated dates...")
                cursor.execute("""
                    SELECT 
                        MIN(appointment_date) as earliest_date,
                        MAX(appointment_date) as latest_date,
                        COUNT(*) as total_appointments,
                        COUNT(CASE WHEN status = 'Available' THEN 1 END) as available_count,
                        COUNT(CASE WHEN appointment_date >= CURDATE() THEN 1 END) as future_appointments
                    FROM patient_appointments
                """)
                
                new_stats = cursor.fetchone()
                print(f"\nUpdated Appointment Stats:")
                print(f"  • Earliest: {new_stats['earliest_date']}")
                print(f"  • Latest: {new_stats['latest_date']}")
                print(f"  • Total: {new_stats['total_appointments']}")
                print(f"  • Available: {new_stats['available_count']}")
                print(f"  • Future (bookable): {new_stats['future_appointments']}")
                
            else:
                print(f"\n✅ Appointments are already up to date or in the future!")
        
        return True
        
    except Exception as e:
        print(f"❌ Error updating appointments: {e}")
        connection.rollback()
        return False
    finally:
        cursor.close()
        connection.close()

def main():
    """Main execution"""
    print("\n" + "="*80)
    print("UPDATE APPOINTMENT DATES")
    print("="*80)
    
    if update_appointment_dates():
        print("\n" + "="*80)
        print("✅ SUCCESS - Appointment dates updated!")
        print("="*80)
        print("\n💡 Appointments are now bookable starting from today")
        print("   Patients can book appointments through the patient portal")
    else:
        print("\n❌ FAILED - Could not update appointment dates")

if __name__ == "__main__":
    main()
