#!/usr/bin/env python3
import requests
import json

# Test the patient registration directly on localhost
test_data = {
    'first_name': 'TestLocal',
    'last_name': 'Patient',
    'date_of_birth': '1990-01-01',
    'gender': 'Male',
    'mobile_number': '+27123456999',
    'email': 'test.local.debug@example.com',
    'password': 'TestPass123',
    'is_private_patient': True
}

print("Testing patient registration on localhost...")
response = requests.post('http://localhost:5000/api/patient/auth/register', json=test_data, timeout=10)

print(f"Status: {response.status_code}")
print(f"Response: {response.text}")

if response.status_code != 201:
    print("❌ Registration failed")
else:
    print("✅ Registration successful!")