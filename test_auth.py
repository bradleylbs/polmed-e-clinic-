#!/usr/bin/env python3
import requests
import json

# Test authentication directly
BASE_URL = "https://app-polmed-backend-fmamhma6g4gngfey.southafricanorth-01.azurewebsites.net"

def test_auth():
    test_creds = {
        "email": "admin.test@polmed.co.za",
        "password": "admin123"
    }
    
    print("Testing authentication...")
    print(f"URL: {BASE_URL}/api/auth/login")
    print(f"Credentials: {test_creds}")
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/login", json=test_creds, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            token = data.get('data', {}).get('token')
            print(f"Token: {token[:50]}..." if token else "No token")
            return token
        else:
            print("Authentication failed")
            return None
    except Exception as e:
        print(f"Exception: {e}")
        return None

if __name__ == "__main__":
    test_auth()