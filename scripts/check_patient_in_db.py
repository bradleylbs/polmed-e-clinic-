#!/usr/bin/env python3
"""
Script to verify patient data exists in the database
"""
import mysql.connector
from mysql.connector import Error
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database configuration
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'db-polmed.mysql.database.azure.com'),
    'database': os.environ.get('DB_NAME', 'palmed_clinic_erp'),
    'user': os.environ.get('DB_USER', 'dbadmin'),
    'password': os.environ.get('DB_PASSWORD', 'Polm3d!DB@2025'),
    'port': int(os.environ.get('DB_PORT', 3306)),
    'autocommit': False,
    'use_unicode': True,
    'charset': 'utf8mb4',
    'ssl_disabled': False,
    'ssl_verify_cert': False,
    'ssl_verify_identity': False
}

class DatabaseManager:
    """Database connection and query management"""
    
    @staticmethod
    def get_connection():
        try:
            connection = mysql.connector.connect(**DB_CONFIG)
            if connection.is_connected():
                logger.info("Database connection successful")
                return connection
        except Error as e:
            logger.error(f"Database connection error: {e}")
            return None
    
    @staticmethod
    def execute_query(query: str, params: tuple = None, fetch: bool = False):
        connection = DatabaseManager.get_connection()
        if not connection:
            logger.error("No database connection available")
            return None
        
        try:
            cursor = connection.cursor(dictionary=True)
            cursor.execute(query, params or ())
            
            if fetch:
                result = cursor.fetchall()
            else:
                connection.commit()
                result = cursor.rowcount
            
            return result
        except Error as e:
            logger.error(f"Query execution error: {e}")
            if connection:
                connection.rollback()
            return None
        finally:
            if connection and connection.is_connected():
                cursor.close()
                connection.close()

def check_patient_by_id(patient_id: int):
    """Check if patient exists and display details"""
    query = """
    SELECT p.id,
           p.medical_aid_number,
           p.first_name,
           p.last_name,
           p.date_of_birth,
           p.gender,
           p.id_number,
           p.phone_number,
           p.email,
           p.physical_address,
           p.emergency_contact_name,
           p.emergency_contact_phone,
           p.is_palmed_member,
           p.member_type,
           p.chronic_conditions,
           p.allergies,
           p.current_medications,
           p.created_at,
           p.updated_at,
           COUNT(DISTINCT pv.id) as total_visits,
           MAX(pv.visit_date) as last_visit
    FROM patients p
    LEFT JOIN patient_visits pv ON p.id = pv.patient_id
    WHERE p.id = %s
    GROUP BY p.id, p.medical_aid_number, p.first_name, p.last_name, 
             p.date_of_birth, p.gender, p.id_number, p.phone_number, 
             p.email, p.physical_address, p.emergency_contact_name, 
             p.emergency_contact_phone, p.is_palmed_member, p.member_type,
             p.chronic_conditions, p.allergies, p.current_medications,
             p.created_at, p.updated_at
    """
    
    result = DatabaseManager.execute_query(query, (patient_id,), fetch=True)
    
    if result and len(result) > 0:
        patient = result[0]
        print(f"\n{'='*60}")
        print(f"✅ PATIENT FOUND (ID: {patient_id})")
        print(f"{'='*60}")
        print(f"\nBasic Information:")
        print(f"  ID: {patient.get('id')}")
        print(f"  First Name: {patient.get('first_name')}")
        print(f"  Last Name: {patient.get('last_name')}")
        print(f"  ID Number: {patient.get('id_number')}")
        print(f"  Date of Birth: {patient.get('date_of_birth')}")
        print(f"  Gender: {patient.get('gender')}")
        
        print(f"\nContact Information:")
        print(f"  Phone: {patient.get('phone_number')}")
        print(f"  Email: {patient.get('email')}")
        print(f"  Physical Address: {patient.get('physical_address')}")
        print(f"  Emergency Contact: {patient.get('emergency_contact_name')} - {patient.get('emergency_contact_phone')}")
        
        print(f"\nMedical Aid:")
        print(f"  Medical Aid Number: {patient.get('medical_aid_number')}")
        print(f"  Is PALMED Member: {patient.get('is_palmed_member')}")
        print(f"  Member Type: {patient.get('member_type')}")
        
        print(f"\nVisit Statistics:")
        print(f"  Total Visits: {patient.get('total_visits')}")
        print(f"  Last Visit: {patient.get('last_visit')}")
        
        print(f"\nMedical Information:")
        print(f"  Chronic Conditions: {patient.get('chronic_conditions')}")
        print(f"  Allergies: {patient.get('allergies')}")
        print(f"  Current Medications: {patient.get('current_medications')}")
        
        print(f"\nSystem Information:")
        print(f"  Created At: {patient.get('created_at')}")
        print(f"  Updated At: {patient.get('updated_at')}")
        
        return True
    else:
        print(f"\n{'='*60}")
        print(f"❌ PATIENT NOT FOUND (ID: {patient_id})")
        print(f"{'='*60}")
        return False

def list_recent_patients():
    """List recent patients for reference"""
    query = """
    SELECT id, first_name, last_name, id_number, phone_number, 
           is_palmed_member, member_type, created_at
    FROM patients
    ORDER BY created_at DESC
    LIMIT 10
    """
    
    results = DatabaseManager.execute_query(query, fetch=True)
    
    if results:
        print(f"\n{'='*60}")
        print("RECENT PATIENTS (Last 10)")
        print(f"{'='*60}")
        print(f"{'ID':<5} | {'Name':<30} | {'ID Number':<15} | {'Phone':<15} | {'Member'}")
        print("-" * 95)
        for patient in results:
            name = f"{patient.get('first_name', '')} {patient.get('last_name', '')}"
            member = "POLMED" if patient.get('is_palmed_member') else (patient.get('member_type') or 'Non-member')
            id_num = patient.get('id_number') or ''
            phone = patient.get('phone_number') or ''
            print(f"{patient.get('id'):<5} | {name:<30} | {id_num:<15} | {phone:<15} | {member}")
        return True
    else:
        print("\n❌ No patients found in database")
        return False

def count_total_patients():
    """Get total patient count"""
    query = "SELECT COUNT(*) as total FROM patients"
    result = DatabaseManager.execute_query(query, fetch=True)
    
    if result:
        total = result[0]['total']
        print(f"\n{'='*60}")
        print(f"Total Patients in Database: {total}")
        print(f"{'='*60}")
        return total
    return 0

def main():
    """Main function"""
    print("="*60)
    print("POLMED CLINIC - Patient Database Check")
    print("="*60)
    
    # Test database connection
    connection = DatabaseManager.get_connection()
    if not connection:
        print("\n❌ Database connection failed!")
        print("Please check your database configuration.")
        return
    connection.close()
    print("\n✓ Database connection successful")
    
    # Count total patients
    total = count_total_patients()
    
    if total == 0:
        print("\n⚠️  No patients in database")
        return
    
    # List recent patients
    list_recent_patients()
    
    # Check specific patient
    print("\n")
    patient_id = input("Enter patient ID to check (default: 38): ").strip()
    if not patient_id:
        patient_id = 38
    else:
        try:
            patient_id = int(patient_id)
        except ValueError:
            print("❌ Invalid patient ID")
            return
    
    check_patient_by_id(patient_id)

if __name__ == "__main__":
    main()
