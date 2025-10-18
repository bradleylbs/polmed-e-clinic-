#!/usr/bin/env python3
"""
Test the booking endpoint with the fixed code
"""
import requests
import json
from datetime import datetime

# The token from the error message
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwYXRpZW50X2lkIjoyMSwiZW1haWwiOiJicmFkbGV5c3dlYXJsbEBnbWFpbGwuY29tIiwidHlwZSI6InBhdGllbnRfcG9ydGFsIiwiZXhwIjoxNzYwODA0MTA2LCJpYXQiOjE3NjA3NjA5MDZ9.GgM9obctKBO2pPEfLvYflhx3xfn392BkDKlmSELHBqg"

# API endpoints
BASE_URL = "http://localhost:5000"
PATIENT_PORTAL_URL = "http://localhost:5000"

print("="*70)
print("TESTING APPOINTMENT BOOKING ENDPOINT")
print("="*70)

# First, get available appointments
print("\n1️⃣  FETCHING AVAILABLE APPOINTMENTS...")
try:
    response = requests.get(
        f"{BASE_URL}/api/patient-portal/appointments",
        params={
            "date_from": "2025-10-17",
            "date_to": "2025-10-19"
        },
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json"
        }
    )
    print(f"Status: {response.status_code}")
    result = response.json()
    
    if result.get('success'):
        appointments = result.get('data', [])
        print(f"✓ Found {len(appointments)} available appointments")
        
        if appointments:
            print("\nFirst 3 appointments:")
            for apt in appointments[:3]:
                print(f"  ID: {apt.get('id')}, Date: {apt.get('appointment_date')}, Time: {apt.get('appointment_time')}, Status: {apt.get('status')}")
                
            # Try to book the first appointment
            test_apt_id = appointments[0]['id']
            print(f"\n2️⃣  ATTEMPTING TO BOOK APPOINTMENT ID {test_apt_id}...")
            
            book_response = requests.post(
                f"{PATIENT_PORTAL_URL}/api/patient-portal/appointments/{test_apt_id}/book",
                headers={
                    "Authorization": f"Bearer {TOKEN}",
                    "Content-Type": "application/json"
                },
                json={}
            )
            
            print(f"Status: {book_response.status_code}")
            book_result = book_response.json()
            print(f"Response: {json.dumps(book_result, indent=2)}")
            
            if book_result.get('success'):
                print("\n✅ BOOKING SUCCESSFUL!")
                booking_ref = book_result.get('data', {}).get('booking_reference')
                print(f"Booking Reference: {booking_ref}")
                print(f"Message: {book_result.get('data', {}).get('message')}")
            else:
                print(f"\n❌ BOOKING FAILED: {book_result.get('error')}")
        else:
            print("❌ No appointments available")
    else:
        print(f"❌ Error: {result.get('error')}")
        print(f"Full response: {json.dumps(result, indent=2)}")
        
except requests.exceptions.ConnectionError:
    print("❌ Cannot connect to Flask server. Is it running?")
except Exception as e:
    print(f"❌ Error: {e}")

print("\n" + "="*70)
