#!/usr/bin/env python3
import mysql.connector
import os
from datetime import datetime
import json

# Database configuration  
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'database': os.environ.get('DB_NAME', 'palmed_clinic_erp'),
    'user': os.environ.get('DB_USER', 'root'), 
    'password': os.environ.get('DB_PASSWORD', 'Transport@2025'),
    'port': int(os.environ.get('DB_PORT', 3306)),
}

try:
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor(dictionary=True)
    
    # Check the patients table structure
    cursor.execute('DESCRIBE patients')
    columns = cursor.fetchall()
    print('PATIENTS TABLE COLUMNS:')
    for col in columns:
        print(f'  {col["Field"]} - {col["Type"]} - NULL: {col["Null"]} - Default: {col["Default"]}')
    
    # Test the exact insert that's failing
    print('\nTesting patient insert...')
    insert_query = """
    INSERT INTO patients (medical_aid_number, first_name, last_name, date_of_birth,
                         gender, id_number, phone_number, email, physical_address,
                         emergency_contact_name, emergency_contact_phone, is_palmed_member,
                         member_type, chronic_conditions, allergies, current_medications,
                         created_by, created_at)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    
    test_data = (
        None,  # medical_aid_number
        'TestSelf',
        'Patient', 
        '1990-01-01',
        'Male',
        None,  # id_number
        '+27123456888',  # phone_number
        'test.self.debug.unique@example.com',
        None,  # physical_address
        None,  # emergency_contact_name
        None,  # emergency_contact_phone
        True,  # is_palmed_member
        'Principal',
        json.dumps([]),
        json.dumps([]),
        json.dumps([]),
        41,  # created_by
        datetime.utcnow()
    )
    
    cursor.execute(insert_query, test_data)
    conn.commit()
    print('✅ Insert successful!')
    
except Exception as e:
    print(f'❌ Error: {e}')
    print(f'Error type: {type(e)}')
finally:
    if 'conn' in locals():
        conn.close()