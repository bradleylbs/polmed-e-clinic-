#!/usr/bin/env python3
"""Debug Flask routes"""

import requests
import json

print("Testing Flask server endpoints...\n")

# Test simple endpoints
endpoints = [
    "/",
    "/api",
    "/api/health",
    "/api/routes",
]

for endpoint in endpoints:
    try:
        response = requests.get(
            f"http://localhost:5000{endpoint}",
            timeout=5
        )
        print(f"GET {endpoint}: {response.status_code}")
    except Exception as e:
        print(f"GET {endpoint}: ❌ {str(e)}")

print("\n\nNow testing POST /api/routes with auth...")

payload = {
    "route_name": "Test Route",
    "description": "Test",
    "start_date": "2025-10-17",
    "end_date": "2025-10-19",
    "province": "KwaZulu-Natal",
    "locations": [{"name": "Test", "type": "police_station", "province": "KwaZulu-Natal", "address": "Test", "capacity": 50}],
}

try:
    # Try without token first
    response = requests.post(
        "http://localhost:5000/api/routes",
        json=payload,
        timeout=10
    )
    print(f"POST /api/routes (no auth): {response.status_code}")
    print(f"Response: {response.text[:200]}\n")
except Exception as e:
    print(f"POST /api/routes (no auth): ❌ {str(e)}")
