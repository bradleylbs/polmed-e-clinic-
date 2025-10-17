#!/usr/bin/env python
"""Test route creation after fixes"""
import json
import requests
import sys

BASE_URL = 'https://app-polmed-backend-fmamhma6g4gngfey.southafricanorth-01.azurewebsites.net'

test_payload = {
    'route_name': 'Pietermaritzburg Test Fix v3',
    'description': 'Testing after GEOMETRY fix',
    'start_date': '2025-10-24',
    'end_date': '2025-10-26',
    'province': 'KwaZulu-Natal',
    'route_type': 'Police Stations',
    'max_appointments_per_day': 40,
    'locations': [
        {
            'name': 'Alex Police Station Test v3',
            'type': 'police_station',
            'province': 'KwaZulu-Natal',
            'city': 'Pietermaritzburg',
            'capacity': 40
        }
    ],
    'time_slots': [
        {'start_time': '08:00', 'end_time': '08:30', 'max_appointments': 10},
        {'start_time': '08:30', 'end_time': '09:00', 'max_appointments': 10},
        {'start_time': '09:00', 'end_time': '09:30', 'max_appointments': 10},
        {'start_time': '09:30', 'end_time': '10:00', 'max_appointments': 10}
    ]
}

headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo0MSwiZW1haWwiOiJhZG1pbi50ZXN0QHBvbG1lZC5jby56YSIsInJvbGUiOiJBZG1pbmlzdHJhdG9yIiwiZXhwIjoxNzYwNzg0MDYxLCJpYXQiOjE3NjA2OTc2NjF9.rjD6FKeE7tR4KbaaytMXIkq960UIzha5-PMg_U5UnYA'
}

try:
    print('Testing route creation after GEOMETRY fix...')
    response = requests.post(
        f'{BASE_URL}/api/routes',
        json=test_payload,
        headers=headers,
        timeout=30
    )
    print(f'Status Code: {response.status_code}')
    
    result = response.json()
    
    if response.status_code == 201 and result.get('success'):
        print('\n✅ SUCCESS! Route created successfully')
        route_data = result.get('data', {})
        print(f'Route ID: {route_data.get("id")}')
        print(f'Route Name: {route_data.get("route_name")}')
        locations = route_data.get('locations', [])
        print(f'Locations: {len(locations)}')
        if locations:
            print(f'  First Location: {locations[0].get("name")}')
        sys.exit(0)
    else:
        print(f'\n❌ Failed to create route')
        print(f'Error: {result.get("error")}')
        print(f'Full Response: {json.dumps(result, indent=2)[:500]}')
        sys.exit(1)
        
except Exception as e:
    print(f'❌ Exception: {str(e)}')
    import traceback
    traceback.print_exc()
    sys.exit(1)
