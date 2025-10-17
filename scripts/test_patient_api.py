#!/usr/bin/env python3
"""
Test the patient portal API endpoint
"""

import requests
import json
import time

# First, get a test patient token
BASE_URL = "http://localhost:5000/api"

def test_patient_portal():
    """Test patient portal endpoints"""
    
    print("="*70)
    print("TESTING PATIENT PORTAL API")
    print("="*70)
    
    # Test 1: Login as patient
    print("\nTest 1: Patient Login")
    print("-" * 70)
    
    login_data = {
        "email": "bradleyswearll@gmaill.com",
        "password": "BRadLEy@94"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/patient-portal/login", json=login_data)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if 'data' in data:
                patient_data = data['data']
                patient_id = patient_data.get('patient_id') or patient_data.get('id')
                token = data.get('token')
                
                print(f"✓ Login successful")
                print(f"  Patient ID: {patient_id}")
                print(f"  Token: {token[:20]}...")
                
                # Test 2: Get available appointments
                print("\nTest 2: Get Available Appointments")
                print("-" * 70)
                
                headers = {"Authorization": f"Bearer {token}"}
                
                # Build URL with query parameters
                url = f"{BASE_URL}/patient-portal/appointments/available/{patient_id}"
                params = {
                    "date_from": "2025-10-17",
                    "date_to": "2025-11-16",
                    "province": "KwaZulu-Natal"
                }
                
                response = requests.get(url, headers=headers, params=params)
                print(f"Status: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    print(f"✓ Response received")
                    print(f"  Success: {data.get('success')}")
                    print(f"  Total slots: {data.get('total')}")
                    
                    if data.get('data'):
                        print(f"\n  Available Appointments:")
                        for idx, slot in enumerate(data.get('data')[:5], 1):
                            print(f"    [{idx}] {slot.get('location_name')} - {slot.get('appointment_date')} @ {slot.get('appointment_time')}")
                            print(f"        Available: {slot.get('available_slots')} | Duration: {slot.get('duration')} min")
                        
                        if len(data.get('data', [])) > 5:
                            print(f"    ... and {len(data.get('data', [])) - 5} more")
                    else:
                        print(f"  Message: {data.get('message', 'No data returned')}")
                else:
                    print(f"✗ Error: {response.status_code}")
                    print(f"  Response: {response.text}")
            else:
                print(f"✗ Unexpected response format")
                print(f"  Response: {response.json()}")
        else:
            print(f"✗ Login failed: {response.status_code}")
            print(f"  Response: {response.text}")
            
    except Exception as e:
        print(f"✗ Connection error: {e}")
        print("  Make sure Flask server is running: python scripts/app.py")

    print("\n" + "="*70)
    print("TEST COMPLETE")
    print("="*70)

if __name__ == "__main__":
    print("Waiting 2 seconds for server to start...")
    time.sleep(2)
    test_patient_portal()
