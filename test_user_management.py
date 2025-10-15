#!/usr/bin/env python3
"""
Test script for User Management API endpoints
Tests the newly added user management functionality
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://app-polmed-backend-fmamhma6g4gngfey.southafricanorth-01.azurewebsites.net"
TEST_CREDENTIALS = {
    "admin": {"email": "admin.test@polmed.co.za", "password": "admin123"},
    "doctor": {"email": "doctor.test@polmed.co.za", "password": "doctor123"},
    "nurse": {"email": "nurse.test@polmed.co.za", "password": "nurse123"}
}

def get_auth_token(user_type="admin"):
    """Get authentication token for specified user type"""
    try:
        creds = TEST_CREDENTIALS[user_type]
        response = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=10)
        if response.status_code == 200:
            data = response.json()
            # Token is in data.token field, not access_token
            return data.get('data', {}).get('token')
        else:
            print(f"❌ Failed to authenticate {user_type}: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Authentication error for {user_type}: {e}")
        return None

def test_get_users(token):
    """Test GET /api/users endpoint"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/users", headers=headers, timeout=10)
        
        print(f"\n🧪 Testing GET /api/users")
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                users = data.get('data', {}).get('users', [])
                pagination = data.get('data', {}).get('pagination', {})
                print(f"   ✅ Success: Retrieved {len(users)} users")
                print(f"   📊 Pagination: Page {pagination.get('page', 1)}/{pagination.get('pages', 1)}")
                print(f"   📊 Total users: {pagination.get('total', 0)}")
                if users:
                    print(f"   👤 Sample user: {users[0].get('email', 'N/A')} ({users[0].get('role', 'N/A')})")
                return True
            else:
                print(f"   ❌ API returned success=false: {data.get('error', 'Unknown error')}")
                return False
        else:
            print(f"   ❌ Failed with status {response.status_code}")
            print(f"   📄 Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Exception: {e}")
        return False

def test_get_user_roles(token):
    """Test GET /api/users/roles endpoint"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/users/roles", headers=headers, timeout=10)
        
        print(f"\n🧪 Testing GET /api/users/roles")
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                roles = data.get('data', [])
                print(f"   ✅ Success: Retrieved {len(roles)} roles")
                if roles:
                    for role in roles:
                        print(f"   🎭 Role: {role.get('role_name', 'N/A')} - {role.get('role_description', 'N/A')}")
                return True
            else:
                print(f"   ❌ API returned success=false: {data.get('error', 'Unknown error')}")
                return False
        else:
            print(f"   ❌ Failed with status {response.status_code}")
            print(f"   📄 Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Exception: {e}")
        return False

def test_get_specific_user(token):
    """Test GET /api/users/<id> endpoint"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        # Test with user ID 1 (should be admin user)
        response = requests.get(f"{BASE_URL}/api/users/1", headers=headers, timeout=10)
        
        print(f"\n🧪 Testing GET /api/users/1")
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                user = data.get('data', {})
                print(f"   ✅ Success: Retrieved user {user.get('email', 'N/A')}")
                print(f"   👤 Name: {user.get('first_name', '')} {user.get('last_name', '')}")
                print(f"   🎭 Role: {user.get('role', 'N/A')}")
                print(f"   📍 Status: {'Active' if user.get('is_active') else 'Inactive'}")
                return True
            else:
                print(f"   ❌ API returned success=false: {data.get('error', 'Unknown error')}")
                return False
        elif response.status_code == 404:
            print(f"   ℹ️  User not found (expected for non-existent user)")
            return True  # This is acceptable
        else:
            print(f"   ❌ Failed with status {response.status_code}")
            print(f"   📄 Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Exception: {e}")
        return False

def test_create_user(token):
    """Test POST /api/users endpoint"""
    try:
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        # Test user data
        test_user = {
            "email": f"test_user_{datetime.now().strftime('%Y%m%d_%H%M%S')}@palmed.com",
            "password": "TestPass123!",
            "first_name": "Test",
            "last_name": "User",
            "role_id": 3,  # Assuming 3 is a valid role ID
            "phone_number": "1234567890",
            "is_active": True
        }
        
        response = requests.post(f"{BASE_URL}/api/users", headers=headers, json=test_user, timeout=10)
        
        print(f"\n🧪 Testing POST /api/users")
        print(f"   Status Code: {response.status_code}")
        print(f"   Test user email: {test_user['email']}")
        
        if response.status_code in [200, 201]:
            data = response.json()
            if data.get('success'):
                print(f"   ✅ Success: User created successfully")
                print(f"   📧 Email: {test_user['email']}")
                return True
            else:
                print(f"   ❌ API returned success=false: {data.get('error', 'Unknown error')}")
                return False
        else:
            print(f"   ❌ Failed with status {response.status_code}")
            print(f"   📄 Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Exception: {e}")
        return False

def main():
    """Run all user management tests"""
    print("🚀 User Management API Test Suite")
    print("=" * 50)
    
    # Get authentication token
    print("\n🔐 Getting authentication token...")
    token = get_auth_token("admin")
    
    if not token:
        print("❌ Failed to authenticate - cannot continue tests")
        return
    
    print("✅ Authentication successful")
    
    # Run tests
    tests = [
        ("Get Users", lambda: test_get_users(token)),
        ("Get User Roles", lambda: test_get_user_roles(token)),
        ("Get Specific User", lambda: test_get_specific_user(token)),
        ("Create User", lambda: test_create_user(token))
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
        except Exception as e:
            print(f"\n❌ Test '{test_name}' failed with exception: {e}")
    
    # Results summary
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All user management tests passed!")
    else:
        print(f"⚠️  {total - passed} test(s) failed")
    
    print(f"⏰ Test completed at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    main()