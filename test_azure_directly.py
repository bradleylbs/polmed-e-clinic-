#!/usr/bin/env python3
"""Test Azure backend directly"""

import requests
import json
import sys

# Test payload - exact same as from the error
payload = {
    "route_name": "Pietermarizburg Police Parade",
    "description": "Crime Awareness",
    "start_date": "2025-10-17",
    "end_date": "2025-10-19",
    "province": "KwaZulu-Natal",
    "route_type": "Police Stations",
    "max_appointments_per_day": 40,
    "locations": [
        {
            "name": "Alex Police Station",
            "type": "police_station",
            "province": "KwaZulu-Natal",
            "city": "Pietermarizburg",
            "address": "123 Alex Road",
            "contact_person": "Captain Smith",
            "contact_phone": "0331234567",
            "capacity": 50
        }
    ],
    "time_slots": [
        {
            "start_time": "08:00",
            "end_time": "08:30",
            "max_appointments": 10
        },
        {
            "start_time": "08:30",
            "end_time": "09:00",
            "max_appointments": 10
        }
    ]
}

# Ask user for token
print("Enter your JWT token (from login):")
token = input().strip()

if not token:
    print("No token provided")
    sys.exit(1)

print(f"\nTesting POST /api/routes on Azure...")
print(f"Payload: {json.dumps(payload, indent=2)[:200]}...\n")

try:
    response = requests.post(
        "https://app-polmed-backend-fmamhma6g4gngfey.southafricanorth-01.azurewebsites.net/api/routes",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=30
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response Headers: {dict(response.headers)}\n")
    print(f"Response Body:\n{response.text}\n")
    
    if response.status_code == 500:
        print("❌ 500 Internal Server Error")
        print("\nFull response:")
        print(response.text)
    elif response.status_code == 200:
        print("✅ Success!")
        print(json.dumps(response.json(), indent=2))
    else:
        print(f"Status: {response.status_code}")
        try:
            print(json.dumps(response.json(), indent=2))
        except:
            print(response.text)
        
except Exception as e:
    print(f"Exception: {type(e).__name__}: {str(e)}")
