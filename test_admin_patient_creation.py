#!/usr/bin/env python3
import requests
import json
import uuid

def test_patient_creation_with_admin():
    # First get admin token
    auth_url = 'https://app-polmed-backend-fmamhma6g4gngfey.southafricanorth-01.azurewebsites.net/api/auth/login'
    auth_data = {'email': 'admin.test@polmed.co.za', 'password': 'admin123'}
    
    print('🔐 Getting admin authentication...')
    auth_response = requests.post(auth_url, json=auth_data, timeout=10)
    if auth_response.status_code != 200:
        print(f"❌ Auth failed: {auth_response.status_code}")
        return
    
    token = auth_response.json().get('data', {}).get('token')
    headers = {'Authorization': f'Bearer {token}'}
    print('✅ Admin authenticated')
    
    # Try to create patient using admin endpoint
    unique_id = str(uuid.uuid4())[:8]
    email = f'admin.test.patient.{unique_id}@example.com'
    
    patient_data = {
        'first_name': 'Admin',
        'last_name': 'TestPatient',
        'date_of_birth': '1990-01-01',
        'gender': 'Male',
        'phone_number': '+27123456789',
        'id_number': f'9001015555{unique_id[:3]}',  # Unique ID number
        'email': email,
        'is_palmed_member': False
    }
    
    patients_url = 'https://app-polmed-backend-fmamhma6g4gngfey.southafricanorth-01.azurewebsites.net/api/patients'
    
    print(f'🧪 Testing patient creation via admin endpoint')
    print(f'📧 Email: {email}')
    
    try:
        response = requests.post(patients_url, json=patient_data, headers=headers, timeout=15)
        print(f'📊 Status: {response.status_code}')
        
        if response.headers.get('content-type', '').startswith('application/json'):
            result = response.json()
            print(f'📄 Response:')
            print(json.dumps(result, indent=2))
        else:
            print(f'📄 Response (non-JSON): {response.text[:500]}')
            
    except Exception as e:
        print(f'❌ Request failed: {e}')

if __name__ == "__main__":
    test_patient_creation_with_admin()