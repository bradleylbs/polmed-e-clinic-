#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'scripts'))

import mysql.connector
from config import Config

DB_CONFIG = {
    'host': Config.DB_HOST,
    'database': Config.DB_NAME,
    'user': Config.DB_USER,
    'password': Config.DB_PASSWORD,
    'port': Config.DB_PORT
}

conn = mysql.connector.connect(**DB_CONFIG)
cursor = conn.cursor(dictionary=True)

# Check route_locations
cursor.execute('SELECT COUNT(*) as cnt FROM route_locations')
count = cursor.fetchone()['cnt']
print(f"Route locations count: {count}")

if count > 0:
    cursor.execute('SELECT id, location_id, visit_date FROM route_locations LIMIT 3')
    for row in cursor.fetchall():
        print(f"  ID: {row['id']}, Location: {row['location_id']}, Visit: {row['visit_date']}")
else:
    print("No route locations found - need to create one")

cursor.close()
conn.close()
