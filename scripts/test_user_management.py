#!/usr/bin/env python3
"""
Test script to diagnose User Management API endpoints
Tests user retrieval, creation, and management functionality
"""

import requests
import json
import sys
from datetime import datetime

# Azure backend configuration
BACKEND_URL = "https://app-polmed-backend-fmamhma6g4gngfey.southafricanorth-01.azurewebsites.net"

# Test credentials - use admin for user management access
TEST_ADMIN = {"email": "admin.test@polmed.co.za", "password": "admin123"}

def get_auth_token():
    """Login and get JWT token"""
    url = f"{BACKEND_URL}/api/auth/login"
    
    try:
        response = requests.post(url, json=TEST_ADMIN, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            token = data.get('data', {}).get('token')
            user = data.get('data', {}).get('user')
            
            if token:
                print(f"✅ Login successful - Role: {user.get('role', 'Unknown')}")
                return token, user
            else:
                print(f"❌ No token in response: {data}")
                return None, None
        else:
            print(f"❌ Login failed - Status: {response.status_code}")
            print(f"Response: {response.text}")
            return None, None
            
    except Exception as e:
        print(f"❌ Login error: {str(e)}")
        return None, None

def test_get_users(token):
    """Test the GET /api/users endpoint"""
    url = f"{BACKEND_URL}/api/users"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        print(f"\n👥 Testing GET /api/users endpoint...")
        response = requests.get(url, headers=headers, timeout=30)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Users endpoint accessible!")
            
            if 'data' in data and isinstance(data['data'], list):
                users = data['data']
                print(f"📊 Found {len(users)} users")
                
                if users:
                    print("\n👤 Sample Users:")
                    for i, user in enumerate(users[:5]):  # Show first 5 users
                        print(f"  {i+1}. {user.get('email', 'No email')} - {user.get('role', 'No role')} - {'Active' if user.get('is_active') else 'Inactive'}")
                else:
                    print("⚠️ No users found in response")
                
                return True, len(users)
            else:
                print("❌ Invalid response format - no 'data' array found")
                print(f"Response: {json.dumps(data, indent=2)}")
                return False, 0
                
        elif response.status_code == 401:
            print("❌ Authentication failed - Invalid or expired token")
            return False, 0
        elif response.status_code == 403:
            print("❌ Access denied - Insufficient permissions")
            return False, 0
        elif response.status_code == 404:
            print("❌ Users endpoint not found")
            return False, 0
        else:
            print(f"❌ Users endpoint failed - Status: {response.status_code}")
            print(f"Response: {response.text}")
            return False, 0
            
    except Exception as e:
        print(f"❌ Users endpoint error: {str(e)}")
        return False, 0

def test_get_user_roles(token):
    """Test getting user roles"""
    url = f"{BACKEND_URL}/api/users/roles"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        print(f"\n🎭 Testing GET /api/users/roles endpoint...")
        response = requests.get(url, headers=headers, timeout=30)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ User roles endpoint accessible!")
            
            if 'data' in data:
                roles = data['data']
                print(f"📊 Found {len(roles)} roles")
                
                if roles:
                    print("\n🎯 Available Roles:")
                    for role in roles:
                        print(f"  • {role.get('role_name', 'Unknown')} - {role.get('role_description', 'No description')}")
                
                return True, len(roles)
            else:
                print("❌ Invalid response format")
                return False, 0
                
        elif response.status_code == 404:
            print("⚠️ User roles endpoint not found - checking alternative endpoint")
            return test_get_roles_alternative(token)
        else:
            print(f"❌ User roles failed - Status: {response.status_code}")
            return False, 0
            
    except Exception as e:
        print(f"❌ User roles error: {str(e)}")
        return False, 0

def test_get_roles_alternative(token):
    """Test alternative roles endpoint"""
    url = f"{BACKEND_URL}/api/roles"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        print(f"🔄 Testing alternative GET /api/roles endpoint...")
        response = requests.get(url, headers=headers, timeout=30)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Roles endpoint accessible!")
            
            if 'data' in data:
                roles = data['data']
                print(f"📊 Found {len(roles)} roles")
                return True, len(roles)
            else:
                print("❌ Invalid response format")
                return False, 0
        else:
            print(f"❌ Alternative roles endpoint also failed")
            return False, 0
            
    except Exception as e:
        print(f"❌ Alternative roles error: {str(e)}")
        return False, 0

def test_user_pagination(token):
    """Test user pagination parameters"""
    url = f"{BACKEND_URL}/api/users?page=1&limit=5"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        print(f"\n📄 Testing user pagination...")
        response = requests.get(url, headers=headers, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            if 'data' in data:
                users = data['data']
                print(f"✅ Pagination working - returned {len(users)} users")
                
                # Check for pagination metadata
                if 'total' in data or 'pagination' in data:
                    print(f"✅ Pagination metadata available")
                else:
                    print(f"⚠️ No pagination metadata in response")
                
                return True
            else:
                print(f"❌ Pagination failed - no data in response")
                return False
        else:
            print(f"❌ Pagination failed - Status: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Pagination error: {str(e)}")
        return False

def check_backend_user_endpoints(token):
    """Check what user-related endpoints are available"""
    endpoints_to_test = [
        "/api/users",
        "/api/users/roles", 
        "/api/roles",
        "/api/user-roles",
        "/api/admin/users"
    ]
    
    print(f"\n🔍 Checking available user management endpoints...")
    
    available_endpoints = []
    
    for endpoint in endpoints_to_test:
        url = f"{BACKEND_URL}{endpoint}"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        try:
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                print(f"  ✅ {endpoint} - Available")
                available_endpoints.append(endpoint)
            elif response.status_code == 404:
                print(f"  ❌ {endpoint} - Not Found")
            elif response.status_code == 401:
                print(f"  🔒 {endpoint} - Authentication Required")
            elif response.status_code == 403:
                print(f"  🚫 {endpoint} - Access Denied")
            else:
                print(f"  ⚠️ {endpoint} - Status {response.status_code}")
                
        except Exception as e:
            print(f"  ❌ {endpoint} - Error: {str(e)}")
    
    return available_endpoints

def main():
    """Main diagnostic function"""
    print("=" * 80)
    print("🔍 POLMED User Management Diagnostic Test")
    print(f"Backend: {BACKEND_URL}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    # Get authentication token
    print("\n🔐 Authenticating...")
    token, user = get_auth_token()
    
    if not token:
        print("\n❌ Cannot continue without authentication token!")
        return False
    
    # Check user permissions
    user_role = user.get('role', '').lower()
    print(f"👤 Logged in as: {user.get('email')} ({user.get('role')})")
    
    if 'admin' not in user_role:
        print("⚠️ Note: User management typically requires admin privileges")
    
    # Test user management endpoints
    success_count = 0
    total_tests = 4
    
    print(f"\n{'='*60}")
    print("🧪 Testing User Management APIs")
    print(f"{'='*60}")
    
    # Test 1: Get users
    users_success, user_count = test_get_users(token)
    if users_success:
        success_count += 1
    
    # Test 2: Get user roles
    roles_success, role_count = test_get_user_roles(token)
    if roles_success:
        success_count += 1
    
    # Test 3: Test pagination
    pagination_success = test_user_pagination(token)
    if pagination_success:
        success_count += 1
    
    # Test 4: Check available endpoints
    available_endpoints = check_backend_user_endpoints(token)
    if available_endpoints:
        success_count += 1
    
    # Summary
    print(f"\n{'='*80}")
    print("📊 USER MANAGEMENT DIAGNOSTIC SUMMARY")
    print(f"{'='*80}")
    print(f"Successful tests: {success_count}/{total_tests}")
    print(f"Success rate: {(success_count/total_tests)*100:.1f}%")
    
    if users_success:
        print(f"✅ User retrieval working - {user_count} users found")
    else:
        print(f"❌ User retrieval failed")
    
    if roles_success:
        print(f"✅ Role retrieval working - {role_count} roles found")
    else:
        print(f"❌ Role retrieval failed")
    
    if available_endpoints:
        print(f"✅ Available endpoints: {', '.join(available_endpoints)}")
    
    # Recommendations
    print(f"\n💡 Recommendations:")
    
    if success_count == total_tests:
        print("  • User Management API is working correctly")
        print("  • Check frontend user management component for issues")
        print("  • Verify frontend API calls and error handling")
    elif success_count > 0:
        print("  • Some APIs working, others may need fixing")
        print("  • Check backend endpoint implementations")
        print("  • Verify user permissions and authentication")
    else:
        print("  • User Management APIs not working")
        print("  • Check backend implementation")
        print("  • Verify database table structure")
        print("  • Check authentication and authorization")
    
    return success_count == total_tests

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)