#!/usr/bin/env python3#!/usr/bin/env python3

"""Check users in database"""import sys

sys.path.append('./scripts')

import mysql.connectorfrom app import DatabaseManager



config = {try:

    'host': 'db-polmed.mysql.database.azure.com',    # Check all users

    'user': 'dbadmin',    result = DatabaseManager.execute_query(

    'password': 'Polm3d!DB@2025',        'SELECT email, role_name FROM users u JOIN user_roles ur ON u.role_id = ur.id LIMIT 10', 

    'database': 'palmed_clinic_erp',        fetch=True

    'port': 3306,    )

}    if result:

        print("Existing users:")

conn = mysql.connector.connect(**config)        for user in result:

cursor = conn.cursor(dictionary=True)            print(f"  - {user['email']} ({user['role_name']})")

    else:

print("=== USERS IN DATABASE ===\n")        print("No users found or database error")

cursor.execute('SELECT u.id, u.email, ur.role_name, u.is_active FROM users u LEFT JOIN user_roles ur ON u.role_id = ur.id LIMIT 20')    

    print("\nAdministrator users:")

for row in cursor.fetchall():    admin_result = DatabaseManager.execute_query(

    print(f"ID: {row['id']}, Email: {row['email']}, Role: {row['role_name']}, Active: {row['is_active']}")        "SELECT email, role_name FROM users u JOIN user_roles ur ON u.role_id = ur.id WHERE ur.role_name = 'Administrator'", 

        fetch=True

cursor.close()    )

conn.close()    if admin_result:

        for user in admin_result:
            print(f"  - {user['email']}")
    else:
        print("  No Administrator users found")
except Exception as e:
    print(f"Error: {e}")