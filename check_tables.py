#!/usr/bin/env python3
"""Check patient_appointments and route_locations tables"""

import mysql.connector

config = {
    'host': 'db-polmed.mysql.database.azure.com',
    'user': 'dbadmin',
    'password': 'Polm3d!DB@2025',
    'database': 'palmed_clinic_erp',
    'port': 3306,
}

conn = mysql.connector.connect(**config)
cursor = conn.cursor(dictionary=True)

print('=== PATIENT_APPOINTMENTS TABLE ===\n')
cursor.execute('DESCRIBE patient_appointments')
cols = cursor.fetchall()
for col in cols:
    print(f"{col['Field']:<30} {col['Type']:<20} {col.get('Null', 'NO'):<5}")

print('\n=== ROUTE_LOCATIONS TABLE ===\n')
cursor.execute('DESCRIBE route_locations')
cols = cursor.fetchall()
for col in cols:
    print(f"{col['Field']:<30} {col['Type']:<20} {col.get('Null', 'NO'):<5}")

cursor.close()
conn.close()
