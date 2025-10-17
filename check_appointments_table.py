#!/usr/bin/env python3
"""Check appointments table structure in Azure"""

import mysql.connector
from mysql.connector import Error

# Azure MySQL connection details
config = {
    'host': 'db-polmed.mysql.database.azure.com',
    'user': 'dbadmin',
    'password': 'Polm3d!DB@2025',
    'database': 'palmed_clinic_erp',
    'port': 3306,
    'ssl_ca': None,  # Add path if needed
}

try:
    print("Connecting to Azure MySQL...")
    conn = mysql.connector.connect(**config)
    cursor = conn.cursor(dictionary=True)
    
    print("\n=== APPOINTMENTS TABLE STRUCTURE ===\n")
    cursor.execute("DESCRIBE appointments")
    columns = cursor.fetchall()
    
    for col in columns:
        print(f"{col['Field']:<30} {col['Type']:<20} {col['Null']:<5} {col['Key']:<5} {col['Default']}")
    
    print("\n=== APPOINTMENTS TABLE SAMPLE ===\n")
    cursor.execute("SELECT * FROM appointments LIMIT 5")
    rows = cursor.fetchall()
    print(f"Found {len(rows)} sample rows")
    if rows:
        print(f"First row: {rows[0]}")
    
    cursor.close()
    conn.close()
    print("\n✅ Connection successful")
    
except Error as e:
    print(f"❌ Error: {e}")
except Exception as e:
    print(f"❌ Exception: {type(e).__name__}: {e}")
