#!/usr/bin/env python3
import requests
import json
import uuid

def test_patient_registration():
    url = 'https://app-polmed-backend-fmamhma6g4gngfey.southafricanorth-01.azurewebsites.net/api/patient/auth/register'
    
    # Generate unique email to avoid conflicts
    unique_id = str(uuid.uuid4())[:8]
    email = f'test.patient.{unique_id}@example.com'
    
    data = {
        'first_name': 'John',
        'last_name': 'Doe', 
        'email': email,
        'password': 'TestPass123',
        'mobile_number': '+27123456789',
        'date_of_birth': '1990-01-01',
        'gender': 'Male',
        'is_private_patient': True
    }
    
    print(f'🧪 Testing Patient Self-Registration')
    print(f'📧 Email: {email}')
    print(f'🌐 URL: {url}')
    
    try:
        response = requests.post(url, json=data, timeout=20)
        print(f'📊 Status: {response.status_code}')
        
        if response.headers.get('content-type', '').startswith('application/json'):
            result = response.json()
            print(f'📄 Response:')
            print(json.dumps(result, indent=2))
            
            if response.status_code == 201:
                print('\n✅ Patient self-registration successful!')
                patient_id = result.get('data', {}).get('patient_id')
                if patient_id:
                    print(f'👤 Patient ID: {patient_id}')
                    print(f'📝 Note: {result.get("data", {}).get("note", "")}')
            elif response.status_code == 400:
                error = result.get('error', 'Unknown validation error')
                print(f'\n⚠️  Validation error: {error}')
            elif response.status_code == 500:
                error = result.get('error', 'Unknown server error')
                print(f'\n❌ Server error: {error}')
            else:
                print(f'\n⚠️  Unexpected status: {response.status_code}')
        else:
            print(f'📄 Response (non-JSON): {response.text[:500]}')
            
    except Exception as e:
        print(f'❌ Request failed: {e}')

if __name__ == "__main__":
    test_patient_registration()