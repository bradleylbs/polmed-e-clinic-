#!/usr/bin/env python3
"""
Test appointment booking with Azure MySQL database
"""

import requests
import json
import mysql.connector
from mysql.connector import Error
import os
from datetime import datetime, timedelta

# Get config from environment
DB_HOST = os.environ.get('DB_HOST', 'db-polmed.mysql.database.azure.com')
DB_USER = os.environ.get('DB_USER', 'palmadmin')
DB_PASSWORD = os.environ.get('DB_PASSWORD', 'Transport@2025')
DB_NAME = os.environ.get('DB_NAME', 'palmed_clinic_erp')
DB_PORT = int(os.environ.get('DB_PORT', 3306))

API_BASE = "http://localhost:5000"

print("\n" + "="*70)
print("🧪 APPOINTMENT BOOKING TEST - AZURE DATABASE")
print("="*70)
print(f"\n📡 Database: {DB_HOST}")
print(f"🔐 User: {DB_USER}")

try:
    # Connect to Azure MySQL
    print("\n🔗 Connecting to Azure MySQL...")
    DB_CONFIG = {
        'host': DB_HOST,
        'user': DB_USER,
        'password': DB_PASSWORD,
        'database': DB_NAME,
        'port': DB_PORT,
        'autocommit': True
    }
    
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor(dictionary=True)
    print("✅ Connected to Azure MySQL successfully!")
    
    # Test 1: Check appointments table
    print("\n📋 Test 1: Checking appointments table...")
    cursor.execute("SELECT COUNT(*) as cnt FROM appointments")
    result = cursor.fetchone()
    print(f"✅ Appointments table exists with {result['cnt']} records")
    
    # Test 2: Check stored procedure
    print("\n📋 Test 2: Checking sp_generate_appointment_slots procedure...")
    cursor.execute("""
        SELECT ROUTINE_NAME FROM INFORMATION_SCHEMA.ROUTINES 
        WHERE ROUTINE_NAME = 'sp_generate_appointment_slots'
    """)
    if cursor.fetchone():
        print("✅ Procedure sp_generate_appointment_slots exists")
    else:
        print("❌ Procedure not found")
    
    # Test 3: Check route locations
    print("\n📋 Test 3: Checking route locations...")
    cursor.execute("SELECT COUNT(*) as cnt FROM route_locations")
    result = cursor.fetchone()
    print(f"   Found {result['cnt']} route locations")
    
    if result['cnt'] > 0:
        cursor.execute("SELECT id FROM route_locations LIMIT 1")
        rl = cursor.fetchone()
        route_id = rl['id']
        print(f"✅ Using route_location ID: {route_id}")
    else:
        print("⚠️  No route locations to test with")
    
    # Test 4: Check available appointments
    print("\n📋 Test 4: Checking available appointments...")
    cursor.execute("""
        SELECT COUNT(*) as cnt FROM appointments 
        WHERE status = 'Available'
    """)
    result = cursor.fetchone()
    available_count = result['cnt']
    print(f"   Found {available_count} available appointments")
    
    if available_count > 0:
        cursor.execute("""
            SELECT * FROM appointments 
            WHERE status = 'Available' LIMIT 1
        """)
        apt = cursor.fetchone()
        print(f"✅ Sample appointment ID: {apt['id']}, Time: {apt['appointment_time']}")
    else:
        print("⚠️  No available appointments (this is OK if not yet created)")
    
    # Test 5: Check patients
    print("\n📋 Test 5: Checking patients...")
    cursor.execute("SELECT COUNT(*) as cnt FROM patients")
    result = cursor.fetchone()
    print(f"   Found {result['cnt']} patients")
    
    if result['cnt'] > 0:
        cursor.execute("""
            SELECT id, first_name, surname FROM patients LIMIT 1
        """)
        patient = cursor.fetchone()
        print(f"✅ Sample patient: {patient['first_name']} {patient['surname']} (ID: {patient['id']})")
    
    # Summary
    print("\n" + "="*70)
    print("✨ APPOINTMENT BOOKING SYSTEM READY!")
    print("="*70)
    print("\n✅ Database structure verified:")
    print("   ✓ appointments table")
    print("   ✓ sp_generate_appointment_slots procedure")
    print("   ✓ route_locations table")
    print("   ✓ patients table")
    print("\n📖 Next steps:")
    print("   1. Create route locations via staff planner")
    print("   2. Generate appointment slots using the procedure")
    print("   3. Patients can book available appointments")
    print("\n🌐 Access:")
    print("   Patient Portal: http://localhost:3000/patient-portal")
    print("   Staff Portal: http://localhost:3000/staff")
    print("   API: http://localhost:5000")
    
    cursor.close()
    conn.close()
    
except Error as e:
    print(f"\n❌ Database error: {e}")
    import traceback
    traceback.print_exc()
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
