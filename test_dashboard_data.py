#!/usr/bin/env python3
"""
Test to check what data is actually in the database tables for dashboard metrics
"""

import requests
import json

BASE_URL = "https://app-polmed-backend-fmamhma6g4gngfey.southafricanorth-01.azurewebsites.net"

def test_dashboard_data():
    print("🔍 Testing Dashboard Data Sources...")
    
    # Get auth token
    auth_response = requests.post(f'{BASE_URL}/api/auth/login', 
        json={'email': 'admin.test@polmed.co.za', 'password': 'admin123'}, 
        timeout=10)

    if auth_response.status_code == 200:
        token = auth_response.json().get('data', {}).get('token')
        headers = {'Authorization': f'Bearer {token}'}
        
        # Test dashboard endpoint
        dashboard_response = requests.get(f'{BASE_URL}/api/dashboard/stats', 
            headers=headers, timeout=10)
        
        if dashboard_response.status_code == 200:
            dashboard_data = dashboard_response.json()
            print('✅ Dashboard endpoint working!')
            print(json.dumps(dashboard_data.get('data', {}), indent=2))
        else:
            print(f'❌ Dashboard endpoint failed: {dashboard_response.status_code}')
            print(dashboard_response.text)
    else:
        print(f'❌ Auth failed: {auth_response.status_code}')
        print(auth_response.text)

if __name__ == "__main__":
    test_dashboard_data()