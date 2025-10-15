#!/usr/bin/env python3
"""
Test script to diagnose dashboard stats API endpoint
Tests authentication and dashboard data retrieval
"""

import requests
import json
import sys
from datetime import datetime
import os

# Azure backend configuration
BACKEND_URL = "https://app-polmed-backend-fmamhma6g4gngfey.southafricanorth-01.azurewebsites.net"

# Test credentials
TEST_USERS = [
    {"email": "admin.test@polmed.co.za", "password": "admin123", "role": "administrator"},
    {"email": "doctor.test@polmed.co.za", "password": "doctor123", "role": "doctor"},
    {"email": "nurse.test@polmed.co.za", "password": "nurse123", "role": "nurse"},
    {"email": "clerk.test@polmed.co.za", "password": "clerk123", "role": "clerk"},
    {"email": "social.test@polmed.co.za", "password": "social123", "role": "social_worker"},
]

def test_login(email, password):
    """Test login and return JWT token"""
    url = f"{BACKEND_URL}/api/auth/login"
    payload = {
        "email": email,
        "password": password
    }
    
    try:
        print(f"\n🔐 Testing login for {email}...")
        response = requests.post(url, json=payload, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('data', {}).get('token'):
                print(f"✅ Login successful - Role: {data['data']['user']['role']}")
                return data['data']['token'], data['data']['user']
            else:
                print(f"❌ Login failed - No token in response: {data}")
                return None, None
        else:
            print(f"❌ Login failed - Status: {response.status_code}")
            print(f"Response: {response.text}")
            return None, None
            
    except Exception as e:
        print(f"❌ Login error: {str(e)}")
        return None, None

def test_dashboard_stats(token, user_info):
    """Test dashboard stats endpoint with authentication"""
    url = f"{BACKEND_URL}/api/dashboard/stats"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        print(f"\n📊 Testing dashboard stats for {user_info['email']} ({user_info['role']})...")
        response = requests.get(url, headers=headers, timeout=30)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Dashboard stats retrieved successfully!")
            
            # Pretty print the response
            print("\n📈 Dashboard Data:")
            print(json.dumps(data, indent=2, default=str))
            
            # Check for specific metrics
            if 'data' in data:
                stats = data['data']
                print(f"\n📋 Key Metrics Summary:")
                print(f"  • Today Patients: {stats.get('todayPatients', 0)}")
                print(f"  • Weekly Patients: {stats.get('weeklyPatients', 0)}")
                print(f"  • Monthly Patients: {stats.get('monthlyPatients', 0)}")
                print(f"  • Pending Appointments: {stats.get('pendingAppointments', 0)}")
                print(f"  • Active Routes: {stats.get('activeRoutes', 0)}")
                print(f"  • Low Stock Alerts: {stats.get('lowStockAlerts', 0)}")
                
                # Check role-specific metrics
                if 'roleSpecificMetrics' in stats:
                    print(f"\n🎯 Role-Specific Metrics:")
                    for key, value in stats['roleSpecificMetrics'].items():
                        print(f"  • {key}: {value}")
                
                # Check activity and tasks
                recent_activity = stats.get('recentActivity', [])
                upcoming_tasks = stats.get('upcomingTasks', [])
                print(f"\n📝 Recent Activity Items: {len(recent_activity)}")
                print(f"📅 Upcoming Tasks: {len(upcoming_tasks)}")
                
                return True
            else:
                print("⚠️ No 'data' field in response")
                return False
                
        elif response.status_code == 401:
            print("❌ Authentication failed - Invalid token")
            print(f"Response: {response.text}")
            return False
        elif response.status_code == 404:
            print("❌ Dashboard stats endpoint not found")
            return False
        else:
            print(f"❌ Dashboard stats failed - Status: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Dashboard stats error: {str(e)}")
        return False

def test_backend_health():
    """Test if backend is accessible"""
    url = f"{BACKEND_URL}/api/health"
    
    try:
        print(f"🏥 Testing backend health at {BACKEND_URL}...")
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            print("✅ Backend is healthy and accessible")
            return True
        else:
            print(f"⚠️ Backend responded with status: {response.status_code}")
            return True  # Still accessible
            
    except Exception as e:
        print(f"❌ Backend health check failed: {str(e)}")
        return False

def main():
    """Main test function"""
    print("=" * 80)
    print("🔍 POLMED Dashboard Stats Diagnostic Test")
    print(f"Backend: {BACKEND_URL}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    # Test backend accessibility
    if not test_backend_health():
        print("\n❌ Cannot continue - Backend is not accessible!")
        return False
    
    success_count = 0
    total_tests = len(TEST_USERS)
    
    # Test each user role
    for user in TEST_USERS:
        print(f"\n{'='*60}")
        print(f"Testing {user['role'].upper()} Role")
        print(f"{'='*60}")
        
        # Login
        token, user_info = test_login(user['email'], user['password'])
        
        if token and user_info:
            # Test dashboard stats
            if test_dashboard_stats(token, user_info):
                success_count += 1
                print(f"✅ {user['role']} dashboard test PASSED")
            else:
                print(f"❌ {user['role']} dashboard test FAILED")
        else:
            print(f"❌ {user['role']} login test FAILED - Cannot test dashboard")
    
    # Summary
    print(f"\n{'='*80}")
    print("📊 TEST SUMMARY")
    print(f"{'='*80}")
    print(f"Successful tests: {success_count}/{total_tests}")
    print(f"Success rate: {(success_count/total_tests)*100:.1f}%")
    
    if success_count == 0:
        print("\n❌ ALL TESTS FAILED - Possible Issues:")
        print("  1. Backend authentication not working")
        print("  2. Dashboard stats endpoint has errors")
        print("  3. Database connection issues")
        print("  4. Missing required database tables/data")
    elif success_count < total_tests:
        print("\n⚠️ PARTIAL SUCCESS - Some roles failed")
        print("  • Check role-specific database queries")
        print("  • Verify user permissions for each role")
    else:
        print("\n✅ ALL TESTS PASSED - Dashboard should work correctly")
    
    return success_count == total_tests

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)