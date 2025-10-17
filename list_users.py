#!/usr/bin/env python3
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

print("Users in database:\n")
cursor.execute('SELECT u.id, u.email, ur.role_name, u.is_active FROM users u LEFT JOIN user_roles ur ON u.role_id = ur.id LIMIT 20')

for row in cursor.fetchall():
    print(f"ID: {row['id']}, Email: {row['email']}, Role: {row['role_name']}, Active: {row['is_active']}")

cursor.close()
conn.close()
