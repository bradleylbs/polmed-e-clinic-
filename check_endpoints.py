#!/usr/bin/env python3
"""
Check what endpoints are available on the Azure deployment
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
            return None
    except Exception as e:
        print(f"❌ Authentication error for {user_type}: {e}")
        return None

def test_endpoint(endpoint, token, method="GET", data=None):
    """Test a specific endpoint"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        if data:
            headers["Content-Type"] = "application/json"
        
        url = f"{BASE_URL}{endpoint}"
        
        if method.upper() == "GET":
            response = requests.get(url, headers=headers, timeout=10)
        elif method.upper() == "POST":
            response = requests.post(url, headers=headers, json=data, timeout=10)
        else:
            print(f"   ❓ Unsupported method: {method}")
            return False
        
        print(f"   {endpoint} ({method}): {response.status_code}")
        
        if response.status_code in [200, 201]:
            try:
                data = response.json()
                if isinstance(data, dict) and 'data' in data:
                    print(f"     ✅ Success - has 'data' field")
                    return True
                else:
                    print(f"     ✅ Success - response: {str(data)[:100]}...")
                    return True
            except:
                print(f"     ✅ Success - non-JSON response")
                return True
        elif response.status_code == 404:
            print(f"     ❌ Not Found")
            return False
        elif response.status_code == 401:
            print(f"     🔒 Unauthorized")
            return False
        elif response.status_code == 403:
            print(f"     🚫 Forbidden")
            return False
        else:
            print(f"     ⚠️  Status {response.status_code}: {response.text[:100]}")
            return False
            
    except Exception as e:
        print(f"     💥 Exception: {e}")
        return False

def main():
    """Check available endpoints"""
    print("🔍 Azure API Endpoint Availability Check")
    print("=" * 60)
    
    # Get authentication token
    print("\n🔐 Getting authentication token...")
    token = get_auth_token("admin")
    
    if not token:
        print("❌ Failed to authenticate - will test public endpoints only")
        token = None
    else:
        print("✅ Authentication successful")
    
    # List of endpoints to test
    endpoints_to_test = [
        # Health/Status
        ("/health", "GET"),
        ("/api/health", "GET"),
        
        # Authentication
        ("/api/auth/verify-token", "GET"),
        
        # Dashboard
        ("/api/dashboard/stats", "GET"),
        
        # User Management (our new endpoints)
        ("/api/users", "GET"),
        ("/api/users/roles", "GET"),
        
        # Existing endpoints
        ("/api/patients", "GET"),
        ("/api/routes", "GET"),
        ("/api/appointments", "GET"),
        ("/api/appointments/available", "GET"),
        
        # Inventory
        ("/api/inventory/consumables", "GET"),
        ("/api/inventory/assets", "GET"),
    ]
    
    print(f"\n🧪 Testing {len(endpoints_to_test)} endpoints...")
    print("-" * 60)
    
    available_count = 0
    unavailable_count = 0
    
    for endpoint, method in endpoints_to_test:
        if test_endpoint(endpoint, token, method):
            available_count += 1
        else:
            unavailable_count += 1
    
    # Results summary
    print("\n" + "=" * 60)
    print(f"📊 Endpoint Test Results:")
    print(f"   ✅ Available: {available_count}")
    print(f"   ❌ Unavailable: {unavailable_count}")
    print(f"   📈 Success Rate: {(available_count / len(endpoints_to_test) * 100):.1f}%")
    
    if unavailable_count > 0:
        print(f"\n⚠️  {unavailable_count} endpoints are not available")
        print("   This might indicate:")
        print("   - Deployment is still in progress")
        print("   - New endpoints haven't been deployed yet")
        print("   - There's an issue with the deployment")
    else:
        print("\n🎉 All endpoints are available!")
    
    print(f"\n⏰ Test completed at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    main()