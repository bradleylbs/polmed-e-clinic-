"""
Test script to verify GET /api/patients/<patient_id> endpoint
"""
import requests
import json
import os

# Configuration
BASE_URL = os.getenv('API_URL', 'https://app-polmed-backend-fmamhma6g4gngfey.southafricanorth-01.azurewebsites.net')
PATIENT_ID = 38  # Test with patient ID 38

# You'll need to provide a valid token
# Get this from your browser's developer tools (Application > Local Storage)
TOKEN = input("Enter your auth token: ").strip()

def test_get_patient():
    """Test GET /api/patients/<patient_id>"""
    url = f"{BASE_URL}/api/patients/{PATIENT_ID}"
    
    headers = {
        'Authorization': f'Bearer {TOKEN}',
        'Content-Type': 'application/json'
    }
    
    print(f"\n{'='*60}")
    print(f"Testing: GET {url}")
    print(f"{'='*60}\n")
    
    try:
        response = requests.get(url, headers=headers)
        
        print(f"Status Code: {response.status_code}")
        print(f"\nResponse Headers:")
        for key, value in response.headers.items():
            print(f"  {key}: {value}")
        
        print(f"\nResponse Body:")
        try:
            data = response.json()
            print(json.dumps(data, indent=2))
            
            if response.status_code == 200 and data.get('success'):
                print(f"\n{'='*60}")
                print("✅ SUCCESS: Patient data retrieved")
                print(f"{'='*60}")
                
                patient = data.get('data', {})
                print(f"\nPatient Summary:")
                print(f"  ID: {patient.get('id')}")
                print(f"  Name: {patient.get('first_name')} {patient.get('last_name')}")
                print(f"  ID Number: {patient.get('id_number')}")
                print(f"  Date of Birth: {patient.get('date_of_birth')}")
                print(f"  Gender: {patient.get('gender')}")
                print(f"  Phone: {patient.get('phone_number')}")
                print(f"  Email: {patient.get('email')}")
                print(f"  Address: {patient.get('address')}")
                print(f"  Medical Aid: {patient.get('medical_aid_number')}")
                print(f"  Total Visits: {patient.get('total_visits')}")
                print(f"  Last Visit: {patient.get('last_visit')}")
                
                return True
            else:
                print(f"\n{'='*60}")
                print("❌ FAILED: Request unsuccessful")
                print(f"{'='*60}")
                return False
                
        except json.JSONDecodeError:
            print(response.text)
            print(f"\n{'='*60}")
            print("❌ FAILED: Invalid JSON response")
            print(f"{'='*60}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request Error: {e}")
        return False

def test_get_patient_not_found():
    """Test with non-existent patient ID"""
    url = f"{BASE_URL}/api/patients/99999"
    
    headers = {
        'Authorization': f'Bearer {TOKEN}',
        'Content-Type': 'application/json'
    }
    
    print(f"\n{'='*60}")
    print(f"Testing 404 scenario: GET {url}")
    print(f"{'='*60}\n")
    
    try:
        response = requests.get(url, headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 404:
            data = response.json()
            print(json.dumps(data, indent=2))
            print(f"\n✅ Correctly returns 404 for non-existent patient")
            return True
        else:
            print(f"❌ Expected 404, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == '__main__':
    print("\n" + "="*60)
    print("PATIENT GET ENDPOINT TEST")
    print("="*60)
    
    if not TOKEN:
        print("\n❌ No token provided. Exiting.")
        exit(1)
    
    # Test valid patient
    test1 = test_get_patient()
    
    # Test non-existent patient
    test2 = test_get_patient_not_found()
    
    print(f"\n{'='*60}")
    print("TEST SUMMARY")
    print(f"{'='*60}")
    print(f"Valid Patient Test: {'✅ PASS' if test1 else '❌ FAIL'}")
    print(f"404 Test: {'✅ PASS' if test2 else '❌ FAIL'}")
    print(f"{'='*60}\n")
