#!/usr/bin/env python3
"""Create sample appointments for testing"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'scripts'))

import mysql.connector
from mysql.connector import Error
from config import Config
from datetime import datetime, timedelta
import json

# Build DB_CONFIG from Config class
DB_CONFIG = {
    'host': Config.DB_HOST,
    'database': Config.DB_NAME,
    'user': Config.DB_USER,
    'password': Config.DB_PASSWORD,
    'port': Config.DB_PORT
}

def create_sample_appointments():
    """Create sample appointments"""
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor(dictionary=True)
        
        print("=" * 60)
        print("CREATING SAMPLE APPOINTMENTS")
        print("=" * 60)
        
        # 1. Check if patients exist
        print("\n1. Checking for existing patients...")
        cursor.execute("SELECT id FROM patients LIMIT 5")
        patients = cursor.fetchall()
        
        if not patients:
            print("   ✗ No patients found in database!")
            print("   Creating test patient first...")
            
            insert_patient = """
            INSERT INTO patients (first_name, last_name, email, phone_number, date_of_birth, id_number, gender)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            cursor.execute(insert_patient, (
                'John', 'Doe', 'john@example.com', '0761234567', 
                '1985-01-15', '8501151234089', 'M'
            ))
            connection.commit()
            
            cursor.execute("SELECT id FROM patients ORDER BY id DESC LIMIT 1")
            patients = [cursor.fetchone()]
            print(f"   ✓ Created test patient ID: {patients[0]['id']}")
        
        patient_ids = [p['id'] for p in patients]
        print(f"   ✓ Found {len(patient_ids)} patients: {patient_ids[:3]}...")
        
        # 2. Create sample appointments
        print("\n2. Creating sample appointments...")
        now = datetime.now()
        
        appointments_created = 0
        for i, patient_id in enumerate(patient_ids[:3]):
            for j in range(2):  # 2 appointments per patient
                appointment_time = (now + timedelta(days=j+1, hours=9+j)).time()
                booked_at = now - timedelta(days=3)
                duration_minutes = 30
                
                insert_appointment = """
                INSERT INTO appointments 
                (patient_id, route_location_id, appointment_time, duration_minutes, status, booking_reference, booked_by_name, booked_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """
                
                try:
                    cursor.execute(insert_appointment, (
                        patient_id,
                        None,  # route_location_id - optional
                        appointment_time,
                        duration_minutes,
                        'confirmed' if j == 0 else 'pending',
                        f'APPT-{patient_id}-{j+1:03d}',
                        'Reception',
                        booked_at
                    ))
                    appointments_created += 1
                except Error as e:
                    print(f"   Error creating appointment: {e}")
        
        connection.commit()
        print(f"   ✓ Created {appointments_created} sample appointments")
        
        # 3. Verify appointments were created
        print("\n3. Verifying appointments...")
        cursor.execute("SELECT COUNT(*) as cnt FROM appointments")
        total = cursor.fetchone()['cnt']
        print(f"   Total appointments in database: {total}")
        
        # 4. Test the query
        print("\n4. Testing appointments query for first patient...")
        patient_id = patient_ids[0]
        
        query = """
        SELECT a.id, a.booking_reference, 
               DATE(a.booked_at) as appointment_date,
               a.appointment_time, 
               COALESCE(l.location_name, rl.location_id) as location_name,
               COALESCE(l.city, '') as city,
               COALESCE(l.province, '') as province,
               a.status, a.duration_minutes
        FROM appointments a
        LEFT JOIN route_locations rl ON a.route_location_id = rl.id
        LEFT JOIN locations l ON rl.location_id = l.id
        WHERE a.patient_id = %s AND a.status IN ('confirmed', 'pending')
        ORDER BY a.booked_at DESC
        LIMIT 5
        """
        
        cursor.execute(query, (patient_id,))
        appointments = cursor.fetchall()
        
        print(f"   Patient {patient_id} has {len(appointments)} upcoming appointments:")
        for appt in appointments:
            print(f"     • {appt['booking_reference']}: {appt['appointment_date']} @ {appt['appointment_time']} ({appt['status']})")
        
        if appointments:
            print("\n   ✓ Query works! Appointments are now retrievable!")
        
        print("\n" + "=" * 60)
        print("SETUP COMPLETE")
        print("=" * 60)
        
        cursor.close()
        connection.close()
        
        return True
        
    except Error as e:
        print(f"Database Error: {e}")
        return False
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    create_sample_appointments()
