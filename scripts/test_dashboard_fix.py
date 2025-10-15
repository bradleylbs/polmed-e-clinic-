#!/usr/bin/env python3
"""
Quick test to check if Azure backend has deployed our dashboard fix
Tests both old and new response formats
"""

import requests
import json
from datetime import datetime

# Azure backend configuration
BACKEND_URL = "https://app-polmed-backend-fmamhma6g4gngfey.southafricanorth-01.azurewebsites.net"

def test_dashboard_response_format():
    """Test if the dashboard API response format has been fixed"""
    
    print("=" * 80)
    print("🔍 Testing Dashboard API Response Format")
    print(f"Backend: {BACKEND_URL}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    # First login to get a token
    login_url = f"{BACKEND_URL}/api/auth/login"
    login_payload = {
        "email": "admin.test@polmed.co.za",
        "password": "admin123"
    }
    
    try:
        print("\n🔐 Logging in to get token...")
        login_response = requests.post(login_url, json=login_payload, timeout=30)
        
        if login_response.status_code != 200:
            print(f"❌ Login failed with status {login_response.status_code}")
            return False
            
        login_data = login_response.json()
        token = login_data.get('data', {}).get('token')
        
        if not token:
            print("❌ No token received from login")
            return False
            
        print("✅ Login successful, token received")
        
        # Now test dashboard stats
        stats_url = f"{BACKEND_URL}/api/dashboard/stats"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        print("\n📊 Testing dashboard stats endpoint...")
        stats_response = requests.get(stats_url, headers=headers, timeout=30)
        
        if stats_response.status_code != 200:
            print(f"❌ Dashboard stats failed with status {stats_response.status_code}")
            return False
            
        response_data = stats_response.json()
        
        print(f"✅ Dashboard stats API returned status 200")
        print(f"Response structure: {list(response_data.keys())}")
        
        # Check response format
        has_data_field = 'data' in response_data
        has_stats_field = 'stats' in response_data
        has_success_field = 'success' in response_data
        
        print(f"\n🔍 Response Analysis:")
        print(f"  • 'success' field: {'✅ Present' if has_success_field else '❌ Missing'}")
        print(f"  • 'data' field: {'✅ Present' if has_data_field else '❌ Missing'}")
        print(f"  • 'stats' field: {'⚠️ Present (OLD FORMAT)' if has_stats_field else '✅ Not present'}")
        
        if has_data_field and not has_stats_field:
            print(f"\n✅ SUCCESS: Backend is using the NEW correct format!")
            print(f"Frontend should now display dashboard stats properly.")
            
            # Show some sample data
            data = response_data.get('data', {})
            print(f"\n📈 Sample Stats:")
            print(f"  • Today Patients: {data.get('todayPatients', 'N/A')}")
            print(f"  • Monthly Patients: {data.get('monthlyPatients', 'N/A')}")
            print(f"  • Recent Activity Items: {len(data.get('recentActivity', []))}")
            
            return True
            
        elif has_stats_field and not has_data_field:
            print(f"\n❌ ISSUE: Backend is still using the OLD format!")
            print(f"The deployment hasn't taken effect yet or there's a caching issue.")
            print(f"\n💡 Possible solutions:")
            print(f"  1. Wait 5-10 minutes for Azure deployment to complete")
            print(f"  2. Restart the Azure App Service")
            print(f"  3. Clear any CDN/proxy caches")
            
            return False
            
        else:
            print(f"\n⚠️ UNEXPECTED: Response has both or neither field")
            print(f"Response: {json.dumps(response_data, indent=2)}")
            
            return False
            
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")
        return False

def main():
    """Main test function"""
    success = test_dashboard_response_format()
    
    print(f"\n{'='*80}")
    if success:
        print("🎉 DASHBOARD FIX DEPLOYED SUCCESSFULLY!")
        print("Your dashboard should now display stats properly.")
    else:
        print("⏳ DASHBOARD FIX NOT YET ACTIVE")
        print("Please wait a few minutes for Azure deployment to complete.")
        
    print(f"{'='*80}")
    return success

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)