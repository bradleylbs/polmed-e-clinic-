#!/usr/bin/env python3
import sys
sys.path.append('./scripts')
from app import DatabaseManager

try:
    # Check all users
    result = DatabaseManager.execute_query(
        'SELECT email, role_name FROM users u JOIN user_roles ur ON u.role_id = ur.id LIMIT 10', 
        fetch=True
    )
    if result:
        print("Existing users:")
        for user in result:
            print(f"  - {user['email']} ({user['role_name']})")
    else:
        print("No users found or database error")
    
    print("\nAdministrator users:")
    admin_result = DatabaseManager.execute_query(
        "SELECT email, role_name FROM users u JOIN user_roles ur ON u.role_id = ur.id WHERE ur.role_name = 'Administrator'", 
        fetch=True
    )
    if admin_result:
        for user in admin_result:
            print(f"  - {user['email']}")
    else:
        print("  No Administrator users found")
except Exception as e:
    print(f"Error: {e}")