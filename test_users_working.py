#!/usr/bin/env python3
import requests
import json

BASE_URL = "https://app-polmed-backend-fmamhma6g4gngfey.southafricanorth-01.azurewebsites.net"

def test_user_management():
    print("🧪 Testing User Management API...")
    
    # Get auth token
    auth_response = requests.post(f'{BASE_URL}/api/auth/login', 
        json={'email': 'admin.test@polmed.co.za', 'password': 'admin123'}, 
        timeout=10)

    if auth_response.status_code == 200:
        token = auth_response.json().get('data', {}).get('token')
        headers = {'Authorization': f'Bearer {token}'}
        
        # Test user management endpoint
        users_response = requests.get(f'{BASE_URL}/api/users', 
            headers=headers, timeout=10)
        
        if users_response.status_code == 200:
            users_data = users_response.json()
            print('✅ User Management endpoint working!')
            
            # Debug the data structure
            print(f'Response keys: {list(users_data.keys())}')
            
            data_obj = users_data.get("data", {})
            pagination = data_obj.get("pagination", {})
            users_list = data_obj.get("users", [])
            
            total_users = pagination.get("total", len(users_list))
            print(f'✅ Total users in database: {total_users}')
            
            if users_list:
                print('\n📋 Users in system:')
                for i, user in enumerate(users_list[:5], 1):
                    name = f"{user.get('first_name', '')} {user.get('last_name', '')}"
                    email = user.get('email', '')
                    role = user.get('role', 'No role')
                    status = '🟢 Active' if user.get('is_active') else '🔴 Inactive'
                    print(f'  {i}. {name} - {email} ({role}) {status}')
                    
                if len(users_list) > 5:
                    print(f'  ... and {len(users_list) - 5} more users')
            else:
                print('⚠️ No users found in database')
                
        else:
            print(f'❌ Users endpoint failed: {users_response.status_code}')
            print(users_response.text)
    else:
        print(f'❌ Auth failed: {auth_response.status_code}')
        print(auth_response.text)

if __name__ == "__main__":
    test_user_management()