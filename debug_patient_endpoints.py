#!/usr/bin/env python3
import requests
import json

def test_endpoint_differences():
    """Compare the working admin endpoint vs failing self-registration endpoint"""
    
    # First, test admin patient creation (we know this works)
    print("🔍 Step 1: Testing WORKING admin patient creation...")
    
    # Get admin auth
    auth_url = 'https://app-polmed-backend-fmamhma6g4gngfey.southafricanorth-01.azurewebsites.net/api/auth/login'
    auth_response = requests.post(auth_url, json={'email': 'admin.test@polmed.co.za', 'password': 'admin123'}, timeout=30)
    
    if auth_response.status_code == 200:
        token = auth_response.json().get('data', {}).get('token')
        headers = {'Authorization': f'Bearer {token}'}
        
        # Create patient via admin endpoint
        admin_data = {
            'first_name': 'TestAdmin',
            'last_name': 'Patient',
            'date_of_birth': '1990-01-01',
            'gender': 'Male',
            'phone_number': '+27123456999',
            'email': 'test.admin.debug@example.com',
            'is_palmed_member': False
        }
        
        admin_url = 'https://app-polmed-backend-fmamhma6g4gngfey.southafricanorth-01.azurewebsites.net/api/patients'
        admin_response = requests.post(admin_url, json=admin_data, headers=headers, timeout=30)
        
        print(f"   Admin Status: {admin_response.status_code}")
        if admin_response.status_code == 201:
            print("   ✅ Admin patient creation SUCCESS")
            print(f"   Response: {admin_response.json()}")
        else:
            print(f"   ❌ Admin failed: {admin_response.text[:200]}")
    
    print("\n" + "="*50)
    print("🔍 Step 2: Testing FAILING self-registration...")
    
    # Test self-registration with similar data
    self_data = {
        'first_name': 'TestSelf',
        'last_name': 'Patient',
        'date_of_birth': '1990-01-01',
        'gender': 'Male',
        'mobile_number': '+27123456888',
        'email': 'test.self.debug@example.com',
        'password': 'TestPass123',
        'is_private_patient': True
    }
    
    self_url = 'https://app-polmed-backend-fmamhma6g4gngfey.southafricanorth-01.azurewebsites.net/api/patient/auth/register'
    self_response = requests.post(self_url, json=self_data, timeout=30)
    
    print(f"   Self-reg Status: {self_response.status_code}")
    if self_response.status_code != 201:
        print(f"   ❌ Self-registration FAILED")
        print(f"   Response: {self_response.text[:200]}")
        
        # Let's try with minimal data to see what specific field causes issues
        print("\n🔍 Step 3: Testing with MINIMAL data...")
        minimal_data = {
            'first_name': 'Test',
            'last_name': 'Min',
            'email': 'minimal@test.com',
            'password': 'pass',
            'mobile_number': '+27111111111',
            'date_of_birth': '1990-01-01',
            'gender': 'Male'
        }
        
        minimal_response = requests.post(self_url, json=minimal_data, timeout=15)
        print(f"   Minimal Status: {minimal_response.status_code}")
        print(f"   Minimal Response: {minimal_response.text[:300]}")
    else:
        print("   ✅ Self-registration SUCCESS")
        print(f"   Response: {self_response.json()}")

if __name__ == "__main__":
    test_endpoint_differences()