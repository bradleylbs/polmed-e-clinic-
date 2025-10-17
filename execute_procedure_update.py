#!/usr/bin/env python
import mysql.connector
import os
from pathlib import Path

# Get connection details from environment or use defaults
DB_HOST = os.getenv('DB_HOST', 'db-polmed.mysql.database.azure.com')
DB_USER = os.getenv('DB_USER', 'dbadmin')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'Polm3d!DB@2025')
DB_NAME = 'palmed_clinic_erp'

if not DB_PASSWORD:
    print("[ERROR] DB_PASSWORD environment variable not set")
    exit(1)

try:
    # Read SQL file
    sql_file = Path(__file__).parent / 'UPDATED_PROCEDURE.sql'
    with open(sql_file, 'r') as f:
        sql_content = f.read()
    
    print(f"[INFO] Connecting to {DB_HOST}...")
    conn = mysql.connector.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        ssl_disabled=False
    )
    cursor = conn.cursor()
    
    print("[INFO] Executing SQL file...")
    # Execute each statement separately
    statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip()]
    
    for statement in statements:
        print(f"[EXEC] {statement[:80]}...")
        cursor.execute(statement)
        print(f"[OK] Statement executed successfully")
    
    conn.commit()
    print("[SUCCESS] Procedure updated on Azure!")
    cursor.close()
    conn.close()
    
except mysql.connector.Error as err:
    if err.errno == 1064:
        print(f"[FAIL] MySQL Syntax Error: {err.msg}")
    else:
        print(f"[FAIL] MySQL Error {err.errno}: {err.msg}")
    exit(1)
except Exception as e:
    print(f"[ERROR] {str(e)}")
    exit(1)
