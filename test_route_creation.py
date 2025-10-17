#!/usr/bin/env python
"""Test route creation locally to debug the 500 error"""
import json
import requests
import time

# Give server time to start
time.sleep(2)

# Test data matching the request from the user
test_payload = {
    "route_name": "Pietermaritzburg Police Parade",
    "description": "Police Parade ",
    "start_date": "2025-10-24",
    "end_date": "2025-10-26",
    "province": "KwaZulu-Natal",
    "route_type": "Police Stations",
    "max_appointments_per_day": 40,
    "locations": [
        {
            "name": "Alex Police Station",
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

# Mock JWT token (will need proper auth)
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo0MSwiZW1haWwiOiJhZG1pbi50ZXN0QHBvbG1lZC5jby56YSIsInJvbGUiOiJBZG1pbmlzdHJhdG9yIiwiZXhwIjoxNzYwNzg0MDYxLCJpYXQiOjE3NjA2OTc2NjF9.rjD6FKeE7tR4KbaaytMXIkq960UIzha5-PMg_U5UnYA"
}

try:
    response = requests.post(
        "http://localhost:5000/api/routes",
        json=test_payload,
        headers=headers,
        timeout=10
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
except Exception as e:
    print(f"Error: {e}")
