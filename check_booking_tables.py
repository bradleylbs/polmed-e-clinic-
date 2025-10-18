import mysql.connector
from mysql.connector import Error

config = {
    'host': 'db-polmed.mysql.database.azure.com',
    'user': 'palmed_admin',
    'password': 'Transport@2025',
    'database': 'palmed_clinic_erp',
    'port': 3306
}

try:
    conn = mysql.connector.connect(**config)
    cursor = conn.cursor(dictionary=True)
    
    # Check what tables exist
    cursor.execute('SHOW TABLES')
    tables = cursor.fetchall()
    print('=== AVAILABLE TABLES ===')
    for table in tables:
        table_name = list(table.values())[0]
        print(f'  - {table_name}')
    
    # Check patient_appointments
    print('\n=== patient_appointments ===')
    cursor.execute('SELECT COUNT(*) as cnt FROM patient_appointments')
    count = cursor.fetchone()
    cnt = count['cnt']
    print(f'Total records: {cnt}')
    
    # Check if route_appointments exists
    cursor.execute('SHOW TABLES LIKE "route_appointments"')
    if cursor.fetchone():
        print('\n=== route_appointments ===')
        cursor.execute('SELECT COUNT(*) as cnt FROM route_appointments')
        count = cursor.fetchone()
        cnt = count['cnt']
        print(f'Total records: {cnt}')
        
        # Show structure
        cursor.execute('SHOW COLUMNS FROM route_appointments')
        cols = cursor.fetchall()
        print('Columns:')
        for col in cols:
            print(f"  - {col['Field']} ({col['Type']})")
    else:
        print('\n=== route_appointments ===')
        print('TABLE DOES NOT EXIST')
    
    # Show patient_appointments structure
    print('\n=== patient_appointments columns ===')
    cursor.execute('SHOW COLUMNS FROM patient_appointments')
    cols = cursor.fetchall()
    for col in cols:
        print(f"  - {col['Field']} ({col['Type']})")
    
    # Check for appointment ID 9
    print('\n=== CHECKING APPOINTMENT ID 9 ===')
    cursor.execute('SELECT * FROM patient_appointments WHERE id = 9')
    apt = cursor.fetchone()
    if apt:
        print('Found in patient_appointments:')
        for key, val in apt.items():
            print(f'  {key}: {val}')
    else:
        print('ID 9 NOT FOUND in patient_appointments')
    
    cursor.close()
    conn.close()
except Error as e:
    print(f'Error: {e}')
