#!/usr/bin/env python
"""Test route creation to diagnose issues"""
import json
import sys
import os

# For Azure testing, use the deployed URL
# For local testing, use localhost

USE_AZURE = False  # Set to True to test against Azure
if USE_AZURE:
    BASE_URL = "https://app-polmed-backend-fmamhma6g4gngfey.southafricanorth-01.azurewebsites.net"
else:
    BASE_URL = "http://localhost:5000"

try:
    import requests
except ImportError:
    print("Installing requests...")
    os.system("pip install requests -q")
    import requests

# Test data matching the request from the user
test_payload = {
    "route_name": "Pietermaritzburg Police Parade Test",
    "description": "Police Parade - Test",
    "start_date": "2025-10-24",
    "end_date": "2025-10-26",
    "province": "KwaZulu-Natal",
    "route_type": "Police Stations",
    "max_appointments_per_day": 40,
    "locations": [
        {
            "name": "Alex Police Station Test",
            "type": "police_station",
            "province": "KwaZulu-Natal",
            "city": "123 Alex Road",
            "capacity": 40
        }
    ],
    "time_slots": [
        {"start_time": "08:00", "end_time": "08:30", "max_appointments": 10},
        {"start_time": "08:30", "end_time": "09:00", "max_appointments": 10},
        {"start_time": "09:00", "end_time": "09:30", "max_appointments": 10},
        {"start_time": "09:30", "end_time": "10:00", "max_appointments": 10}
    ]
}

# JWT token from the user's request
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo0MSwiZW1haWwiOiJhZG1pbi50ZXN0QHBvbG1lZC5jby56YSIsInJvbGUiOiJBZG1pbmlzdHJhdG9yIiwiZXhwIjoxNzYwNzg0MDYxLCJpYXQiOjE3NjA2OTc2NjF9.rjD6FKeE7tR4KbaaytMXIkq960UIzha5-PMg_U5UnYA"
}

try:
    print(f"Testing route creation on {BASE_URL}...")
    response = requests.post(
        f"{BASE_URL}/api/routes",
        json=test_payload,
        headers=headers,
        timeout=30
    )
    print(f"\nStatus: {response.status_code}")
    try:
        result = response.json()
        print(f"Response: {json.dumps(result, indent=2)}")
        if response.status_code == 201 and result.get('success'):
            print("\n✅ SUCCESS! Route created")
            sys.exit(0)
        else:
            print(f"\n❌ FAILED: {result.get('error', 'Unknown error')}")
            sys.exit(1)
    except:
        print(f"Response (text): {response.text}")
        sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
