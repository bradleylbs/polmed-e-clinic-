#!/usr/bin/env python3
"""
Test script for newly created patient portal endpoints
Tests all critical Phase 1 endpoints
"""

import requests
import json
from datetime import datetime, timedelta
import sys

# Azure backend API endpoint
BASE_URL = "https://app-polmed-backend-fmamhma6g4gngfey.southafricanorth-01.azurewebsites.net/api"

# Colors for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
RESET = '\033[0m'

def print_success(msg):
    print(f"{GREEN}✓ {msg}{RESET}")

def print_error(msg):
    print(f"{RED}✗ {msg}{RESET}")

def print_info(msg):
    print(f"{YELLOW}ℹ {msg}{RESET}")

class EndpointTester:
    def __init__(self):
        self.token = None
        self.patient_id = None
        self.tests_passed = 0
        self.tests_failed = 0
    
    def login_patient(self):
        """Login as a patient to get auth token"""
        print_info("\n=== STEP 1: Patient Login ===")
        
        login_data = {
            "email": "bradleyswearll@gmaill.com",
            "password": "BRadLEy@94"
        }
        
        try:
            response = requests.post(
                f"{BASE_URL}/patient-portal/login",
                json=login_data,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.token = data.get('token')
                    # Try both 'patient_id' and 'data.id' for patient_id
                    self.patient_id = data.get('patient_id') or (data.get('data', {}).get('id') if isinstance(data.get('data'), dict) else None)
                    print_success(f"Logged in as patient ID: {self.patient_id}")
                    print_success(f"Token received: {self.token[:20] if self.token else 'None'}...")
                    if not self.token or not self.patient_id:
                        print_info(f"Full response: {data}")
                    self.tests_passed += 1
                    return bool(self.token and self.patient_id)
                else:
                    print_error(f"Login failed: {data.get('error', 'Unknown error')}")
                    self.tests_failed += 1
                    return False
            else:
                print_error(f"Login returned status {response.status_code}")
                print_info(f"Response: {response.text[:200]}")
                self.tests_failed += 1
                return False
        
        except Exception as e:
            print_error(f"Login exception: {e}")
            self.tests_failed += 1
            return False
    
    def get_headers(self):
        """Get authorization headers"""
        return {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json'
        }
    
    def test_endpoint(self, method, endpoint, description, data=None):
        """Test a single endpoint"""
        url = f"{BASE_URL}{endpoint}"
        print_info(f"\nTesting: {method} {endpoint}")
        print_info(f"Description: {description}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=self.get_headers(), timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data or {}, headers=self.get_headers(), timeout=10)
            else:
                print_error(f"Unknown method: {method}")
                self.tests_failed += 1
                return False
            
            # Check for successful response (200, 201, etc)
            if response.status_code >= 200 and response.status_code < 300:
                data = response.json()
                if data.get('success'):
                    print_success(f"Endpoint working! Status: {response.status_code}")
                    if 'data' in data:
                        count = len(data['data']) if isinstance(data['data'], list) else 1
                        print_info(f"Returned {count} record(s)")
                    self.tests_passed += 1
                    return True
                else:
                    print_error(f"Endpoint returned success=false: {data.get('error', 'Unknown error')}")
                    self.tests_failed += 1
                    return False
            elif response.status_code == 404:
                print_error(f"Endpoint not found (404) - This endpoint doesn't exist yet!")
                self.tests_failed += 1
                return False
            elif response.status_code == 401 or response.status_code == 403:
                print_error(f"Authorization error ({response.status_code}) - Token or access issue")
                self.tests_failed += 1
                return False
            else:
                print_error(f"HTTP error {response.status_code}")
                print_info(f"Response: {response.text[:300]}")
                self.tests_failed += 1
                return False
        
        except requests.exceptions.ConnectionError:
            print_error(f"Connection error - Azure server not responding at {BASE_URL}")
            self.tests_failed += 1
            return False
        except Exception as e:
            print_error(f"Exception: {e}")
            self.tests_failed += 1
            return False
    
    def run_all_tests(self):
        """Run all endpoint tests"""
        print("=" * 70)
        print("PATIENT PORTAL ENDPOINT TESTS - Phase 1 Critical Endpoints")
        print("=" * 70)
        
        # Login first
        if not self.login_patient():
            print_error("\nCannot proceed without successful login!")
            return False
        
        # Test Phase 1 Critical Endpoints
        print("\n" + "=" * 70)
        print("PHASE 1: CRITICAL ENDPOINTS")
        print("=" * 70)
        
        # Prescriptions
        self.test_endpoint(
            'GET',
            f'/patient-portal/prescriptions/{self.patient_id}',
            'Get patient prescriptions with medication details'
        )
        
        # Test Results
        self.test_endpoint(
            'GET',
            f'/patient-portal/test-results/{self.patient_id}',
            'Get patient laboratory test results'
        )
        
        # Medical Records
        self.test_endpoint(
            'GET',
            f'/patient-portal/medical-records/{self.patient_id}',
            'Get patient medical records and history'
        )
        
        # Documents
        self.test_endpoint(
            'GET',
            f'/patient-portal/documents/{self.patient_id}',
            'Get patient documents and uploaded files'
        )
        
        # Diagnoses
        self.test_endpoint(
            'GET',
            f'/patient-portal/diagnoses/{self.patient_id}',
            'Get patient diagnoses'
        )
        
        # Get available appointments (existing endpoint, should work)
        self.test_endpoint(
            'GET',
            f'/patient-portal/appointments/available/{self.patient_id}',
            'Get available appointments (existing endpoint - baseline test)'
        )
        
        # Results summary
        print("\n" + "=" * 70)
        print("TEST SUMMARY")
        print("=" * 70)
        print(f"{GREEN}Passed: {self.tests_passed}{RESET}")
        print(f"{RED}Failed: {self.tests_failed}{RESET}")
        print(f"Total: {self.tests_passed + self.tests_failed}")
        
        if self.tests_failed == 0:
            print_success("\n🎉 All tests passed!")
            return True
        else:
            print_error(f"\n⚠️  {self.tests_failed} test(s) failed")
            return False

if __name__ == '__main__':
    tester = EndpointTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
