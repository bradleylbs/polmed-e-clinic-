#!/usr/bin/env python3
import mysql.connector
import os

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
    
    # Check if created_by can be null
    cursor.execute('DESCRIBE patients')
    columns = cursor.fetchall()
    for col in columns:
        if col['Field'] == 'created_by':
            print(f'created_by field: NULL allowed = {col["Null"]}')
    
    # Check what users exist
    cursor.execute('SELECT id, email FROM users LIMIT 5')
    users = cursor.fetchall()
    print('Available users:')
    for user in users:
        print(f'  ID: {user["id"]} - {user["email"]}')
    
    # Try to create a system user for self-registrations if none exists
    cursor.execute("SELECT id FROM users WHERE email = 'system@polmed.co.za'")
    system_user = cursor.fetchone()
    if not system_user:
        print('No system user found, creating one...')
        # This would need proper password hashing in real implementation
        cursor.execute("""
            INSERT INTO users (first_name, last_name, email, password_hash, role) 
            VALUES ('System', 'User', 'system@polmed.co.za', 'system_hash', 'system')
        """)
        conn.commit()
        print('System user created')
    else:
        print(f'System user exists with ID: {system_user["id"]}')
    
except Exception as e:
    print(f'Error: {e}')
finally:
    if 'conn' in locals():
        conn.close()