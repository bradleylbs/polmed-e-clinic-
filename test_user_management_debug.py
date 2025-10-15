#!/usr/bin/env python3
"""
Test script specifically for User Management API endpoints
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://app-polmed-backend-fmamhma6g4gngfey.southafricanorth-01.azurewebsites.net"
TEST_CREDENTIALS = {
    "admin": {"email": "admin.test@polmed.co.za", "password": "admin123"},
}

def get_auth_token(user_type="admin"):
    """Get authentication token for specified user type"""
    try:
        creds = TEST_CREDENTIALS[user_type]
        response = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=10)
        if response.status_code == 200:
            data = response.json()
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
        print(f"   Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Success: {json.dumps(data, indent=2)}")
            return True
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
            print(f"   ✅ Success: {json.dumps(data, indent=2)}")
            return True
        else:
            print(f"   ❌ Failed with status {response.status_code}")
            print(f"   📄 Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Exception: {e}")
        return False

def main():
    """Run user management tests with detailed debugging"""
    print("🔍 User Management API Debug Test")
    print("=" * 50)
    
    # Get authentication token
    print("\n🔐 Getting authentication token...")
    token = get_auth_token("admin")
    
    if not token:
        print("❌ Failed to authenticate - cannot continue tests")
        return
    
    print("✅ Authentication successful")
    print(f"🔑 Token (first 50 chars): {token[:50]}...")
    
    # Run tests
    tests = [
        ("Get Users", lambda: test_get_users(token)),
        ("Get User Roles", lambda: test_get_user_roles(token)),
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
        print(f"⚠️  {total - passed} test(s) failed - endpoints may not be deployed yet")
    
    print(f"⏰ Test completed at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    main()