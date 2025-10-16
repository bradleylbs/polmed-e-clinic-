#!/usr/bin/env python3
"""Test that appointments are being returned correctly"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'scripts'))

import mysql.connector
from mysql.connector import Error
from config import Config
import json
from datetime import datetime

# Build DB_CONFIG from Config class
DB_CONFIG = {
    'host': Config.DB_HOST,
    'database': Config.DB_NAME,
    'user': Config.DB_USER,
    'password': Config.DB_PASSWORD,
    'port': Config.DB_PORT
}

def test_appointments():
    """Test appointments retrieval"""
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor(dictionary=True)
        
        print("=" * 60)
        print("TESTING APPOINTMENTS FIX")
        print("=" * 60)
        
        # 1. Check if appointments table exists
        print("\n1. Checking if appointments table exists...")
        cursor.execute("SHOW TABLES LIKE 'appointments'")
        result = cursor.fetchone()
        if result:
            print("   ✓ Appointments table exists")
        else:
            print("   ✗ Appointments table NOT found")
            return
        
        # 2. Check appointments table structure
        print("\n2. Checking appointments table structure...")
        cursor.execute("DESCRIBE appointments")
        columns = cursor.fetchall()
        column_names = [col['Field'] for col in columns]
        print(f"   Found {len(column_names)} columns: {', '.join(column_names[:5])}...")
        
        required_columns = ['id', 'patient_id', 'appointment_time', 'duration_minutes', 'status', 'booked_at']
        missing = [col for col in required_columns if col not in column_names]
        if missing:
            print(f"   ✗ Missing columns: {missing}")
        else:
            print(f"   ✓ All required columns present")
        
        # 3. Count total appointments
        print("\n3. Counting total appointments in database...")
        cursor.execute("SELECT COUNT(*) as cnt FROM appointments")
        count = cursor.fetchone()['cnt']
        print(f"   Total appointments: {count}")
        
        if count == 0:
            print("   ⚠ WARNING: No appointments found in database!")
            return
        
        # 4. Check for confirmed/pending appointments
        print("\n4. Checking for confirmed/pending appointments...")
        cursor.execute("SELECT COUNT(*) as cnt FROM appointments WHERE status IN ('confirmed', 'pending')")
        active_count = cursor.fetchone()['cnt']
        print(f"   Active appointments (confirmed/pending): {active_count}")
        
        # 5. Get all patients
        print("\n5. Getting patient IDs with appointments...")
        cursor.execute("SELECT DISTINCT patient_id FROM appointments LIMIT 5")
        patients = cursor.fetchall()
        
        if not patients:
            print("   ✗ No patients found with appointments")
            return
        
        # 6. Test the fixed query for each patient
        print("\n6. Testing fixed appointments query for each patient...")
        for patient_rec in patients:
            patient_id = patient_rec['patient_id']
            
            # Test the new query
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
            
            print(f"\n   Patient {patient_id}:")
            print(f"   - Query returned {len(appointments)} appointments")
            
            if appointments:
                for appt in appointments[:2]:  # Show first 2
                    print(f"     • {appt.get('booking_reference', 'N/A')}: {appt.get('appointment_date', 'N/A')} @ {appt.get('appointment_time', 'N/A')} ({appt.get('status', 'N/A')})")
                print("   ✓ Appointments successfully retrieved!")
            else:
                print("   ✗ No appointments returned for this patient")
        
        # 7. Test fallback query
        print("\n7. Testing fallback query...")
        fallback_query = """
        SELECT id, booking_reference, 
               DATE(booked_at) as appointment_date,
               appointment_time, 
               'Mobile Clinic' as location_name,
               '' as city, '' as province,
               status, duration_minutes
        FROM appointments
        WHERE patient_id = %s AND status IN ('confirmed', 'pending')
        ORDER BY booked_at DESC
        LIMIT 5
        """
        
        patient_id = patients[0]['patient_id']
        cursor.execute(fallback_query, (patient_id,))
        fallback_appointments = cursor.fetchall()
        print(f"   Fallback query returned {len(fallback_appointments)} appointments")
        if fallback_appointments:
            print("   ✓ Fallback query works!")
        
        print("\n" + "=" * 60)
        print("TEST COMPLETE")
        print("=" * 60)
        
        cursor.close()
        connection.close()
        
    except Error as e:
        print(f"Database Error: {e}")
        return False
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    test_appointments()
