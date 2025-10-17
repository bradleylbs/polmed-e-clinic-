#!/usr/bin/env python3
"""Generate a valid JWT token for testing"""

import jwt
import json
from datetime import datetime, timedelta

# Use the same SECRET_KEY as the Flask app
SECRET_KEY = 'palmed-clinic-secret-key-2025'

# Create a token with user_id=41 (admin user)
payload = {
    'user_id': 41,
    'exp': datetime.utcnow() + timedelta(hours=24),
    'iat': datetime.utcnow()
}

token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')
print(f"Generated Token: {token}\n")

# Now test the route creation with this token
import requests

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

print("Testing POST /api/routes with valid token...\n")

try:
    response = requests.post(
        "http://localhost:5000/api/routes",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    print(f"Status Code: {response.status_code}")
    print(f"Response Text: {response.text}\n")
    
    if response.status_code != 200:
        print(f"Error creating route (status {response.status_code})")
        if response.text:
            try:
                print(f"Error Details: {json.dumps(response.json(), indent=2)}")
            except:
                print(f"Raw Response: {response.text}")
    else:
        print(f"Success!")
        print(f"Data: {json.dumps(response.json(), indent=2)}")
        
except Exception as e:
    print(f"Exception: {type(e).__name__}: {str(e)}")
