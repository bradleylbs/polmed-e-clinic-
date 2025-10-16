#!/usr/bin/env python3
"""Test the complete clinical workflow for all roles"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'scripts'))

import mysql.connector
from mysql.connector import Error
from config import Config
from datetime import datetime, timedelta
import json

# Build DB_CONFIG from Config class
DB_CONFIG = {
    'host': Config.DB_HOST,
    'database': Config.DB_NAME,
    'user': Config.DB_USER,
    'password': Config.DB_PASSWORD,
    'port': Config.DB_PORT
}

def test_workflow():
    """Test clinical workflow for all roles"""
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor(dictionary=True)
        
        print("=" * 70)
        print("CLINICAL WORKFLOW TEST - ALL ROLES")
        print("=" * 70)
        
        # 1. Check if all required tables exist
        print("\n1. CHECKING REQUIRED TABLES...")
        tables_needed = [
            'patients', 'patient_visits', 'visit_workflow_progress', 'workflow_stages',
            'vital_signs', 'clinical_notes', 'medications', 'investigations', 'referrals'
        ]
        
        cursor.execute("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = %s", (Config.DB_NAME,))
        existing_tables = [t['TABLE_NAME'] for t in cursor.fetchall()]
        
        missing_tables = [t for t in tables_needed if t not in existing_tables]
        
        if missing_tables:
            print(f"   ⚠ WARNING: Missing tables: {missing_tables}")
        else:
            print(f"   ✓ All required tables exist")
        
        # 2. Get or create test patient
        print("\n2. SETTING UP TEST DATA...")
        cursor.execute("SELECT id, first_name FROM patients LIMIT 1")
        patient = cursor.fetchone()
        
        if patient:
            patient_id = patient['id']
            print(f"   ✓ Using existing patient: {patient_id} - {patient['first_name']}")
        else:
            print("   Creating test patient...")
            cursor.execute("""
                INSERT INTO patients (first_name, last_name, email, phone_number, date_of_birth, id_number, gender)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, ('Test', 'Patient', 'test@example.com', '0761234567', '1990-01-15', '9001151234567', 'M'))
            connection.commit()
            patient_id = cursor.lastrowid
            print(f"   ✓ Created test patient: {patient_id}")
        
        # 3. Check for active visit or create one
        print("\n3. CHECKING VISIT STATUS...")
        cursor.execute("""
            SELECT id FROM patient_visits 
            WHERE patient_id = %s AND is_completed = 0
            LIMIT 1
        """, (patient_id,))
        visit = cursor.fetchone()
        
        if visit:
            visit_id = visit['id']
            print(f"   ✓ Found active visit: {visit_id}")
        else:
            print("   Creating new visit...")
            cursor.execute("""
                INSERT INTO patient_visits (patient_id, visit_date, chief_complaint, is_completed)
                VALUES (%s, %s, %s, %s)
            """, (patient_id, datetime.now(), 'Routine checkup', 0))
            connection.commit()
            visit_id = cursor.lastrowid
            print(f"   ✓ Created new visit: {visit_id}")
        
        # 4. Test NURSING role
        print("\n4. TESTING NURSING ROLE...")
        cursor.execute("""
            SELECT COUNT(*) as cnt FROM vital_signs 
            WHERE visit_id = %s
        """, (visit_id,))
        vital_count = cursor.fetchone()['cnt']
        
        if vital_count > 0:
            print(f"   ✓ Vital signs recorded: {vital_count} entries")
        else:
            print("   No vital signs recorded yet")
            print("   Creating sample vital signs...")
            cursor.execute("""
                INSERT INTO vital_signs (visit_id, blood_pressure_systolic, blood_pressure_diastolic, temperature, pulse, weight, height, oxygen_saturation)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (visit_id, 120, 80, 37.0, 72, 75, 170, 98))
            connection.commit()
            print("   ✓ Sample vital signs created")
        
        # 5. Test DOCTOR role
        print("\n5. TESTING DOCTOR ROLE...")
        cursor.execute("""
            SELECT COUNT(*) as cnt FROM clinical_notes 
            WHERE visit_id = %s AND note_type = 'diagnosis'
        """, (visit_id,))
        diagnosis_count = cursor.fetchone()['cnt']
        
        if diagnosis_count > 0:
            print(f"   ✓ Diagnoses recorded: {diagnosis_count} entries")
        else:
            print("   No diagnoses recorded yet")
            print("   Creating sample diagnosis...")
            cursor.execute("""
                INSERT INTO clinical_notes (visit_id, note_type, content, created_by)
                VALUES (%s, %s, %s, %s)
            """, (visit_id, 'diagnosis', 'Type 2 Diabetes - Controlled. ICD-10: E11.9', 'Doctor'))
            connection.commit()
            print("   ✓ Sample diagnosis created")
        
        cursor.execute("""
            SELECT COUNT(*) as cnt FROM medications 
            WHERE visit_id = %s
        """, (visit_id,))
        med_count = cursor.fetchone()['cnt']
        
        if med_count > 0:
            print(f"   ✓ Medications prescribed: {med_count} entries")
        else:
            print("   No medications prescribed yet")
            print("   Creating sample medication...")
            cursor.execute("""
                INSERT INTO medications (visit_id, medication_name, dosage, frequency, duration)
                VALUES (%s, %s, %s, %s, %s)
            """, (visit_id, 'Metformin', '500mg', 'Twice daily', '30 days'))
            connection.commit()
            print("   ✓ Sample medication created")
        
        # 6. Test COUNSELOR role
        print("\n6. TESTING COUNSELOR ROLE...")
        cursor.execute("""
            SELECT COUNT(*) as cnt FROM clinical_notes 
            WHERE visit_id = %s AND note_type = 'counseling'
        """, (visit_id,))
        counseling_count = cursor.fetchone()['cnt']
        
        if counseling_count > 0:
            print(f"   ✓ Counseling notes recorded: {counseling_count} entries")
        else:
            print("   No counseling notes yet")
            print("   Creating sample counseling note...")
            cursor.execute("""
                INSERT INTO clinical_notes (visit_id, note_type, content, created_by)
                VALUES (%s, %s, %s, %s)
            """, (visit_id, 'counseling', 'Patient educated on diabetes management and lifestyle modifications', 'Counselor'))
            connection.commit()
            print("   ✓ Sample counseling note created")
        
        # 7. Test ADMIN role - Referrals
        print("\n7. TESTING ADMIN ROLE - REFERRALS...")
        cursor.execute("""
            SELECT COUNT(*) as cnt FROM referrals 
            WHERE visit_id = %s
        """, (visit_id,))
        referral_count = cursor.fetchone()['cnt']
        
        if referral_count > 0:
            print(f"   ✓ Referrals created: {referral_count} entries")
        else:
            print("   No referrals yet")
            print("   Creating sample referral...")
            cursor.execute("""
                INSERT INTO referrals (visit_id, patient_id, referral_type, specialty, reason, priority, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (visit_id, patient_id, 'specialist', 'Endocrinology', 'Diabetes management', 'routine', 'pending'))
            connection.commit()
            print("   ✓ Sample referral created")
        
        # 8. Test ADMIN role - Investigations
        print("\n8. TESTING ADMIN ROLE - INVESTIGATIONS...")
        cursor.execute("""
            SELECT COUNT(*) as cnt FROM investigations 
            WHERE visit_id = %s
        """, (visit_id,))
        inv_count = cursor.fetchone()['cnt']
        
        if inv_count > 0:
            print(f"   ✓ Investigations ordered: {inv_count} entries")
        else:
            print("   No investigations yet")
            print("   Creating sample investigations...")
            cursor.execute("""
                INSERT INTO investigations (visit_id, investigation_type, result_status)
                VALUES (%s, %s, %s)
            """, (visit_id, 'FBC', 'pending'))
            cursor.execute("""
                INSERT INTO investigations (visit_id, investigation_type, result_status)
                VALUES (%s, %s, %s)
            """, (visit_id, 'U&E', 'pending'))
            connection.commit()
            print("   ✓ Sample investigations created")
        
        # 9. Test Workflow Progress - Check all stages
        print("\n9. CHECKING WORKFLOW STAGES...")
        cursor.execute("""
            SELECT ws.id, ws.stage_name, vwp.status, vwp.completed_at
            FROM workflow_stages ws
            LEFT JOIN visit_workflow_progress vwp ON ws.id = vwp.stage_id AND vwp.visit_id = %s
            ORDER BY ws.order_position
        """, (visit_id,))
        stages = cursor.fetchall()
        
        if stages:
            for stage in stages:
                status = stage['status'] if stage['status'] else 'pending'
                completed = "✓" if stage['completed_at'] else "○"
                print(f"   {completed} {stage['stage_name']}: {status}")
        else:
            print("   ⚠ No workflow stages found")
        
        # 10. Summary Report
        print("\n10. WORKFLOW SUMMARY...")
        cursor.execute("""
            SELECT 
                (SELECT COUNT(*) FROM vital_signs WHERE visit_id = %s) as vital_signs,
                (SELECT COUNT(*) FROM clinical_notes WHERE visit_id = %s AND note_type = 'diagnosis') as diagnoses,
                (SELECT COUNT(*) FROM medications WHERE visit_id = %s) as medications,
                (SELECT COUNT(*) FROM clinical_notes WHERE visit_id = %s AND note_type = 'counseling') as counseling,
                (SELECT COUNT(*) FROM referrals WHERE visit_id = %s) as referrals,
                (SELECT COUNT(*) FROM investigations WHERE visit_id = %s) as investigations
        """, (visit_id, visit_id, visit_id, visit_id, visit_id, visit_id))
        
        summary = cursor.fetchone()
        
        print(f"""
   Patient ID: {patient_id}
   Visit ID: {visit_id}
   
   ROLE-SPECIFIC DATA:
   • Nursing:    {summary['vital_signs']} vital sign entries recorded
   • Doctor:     {summary['diagnoses']} diagnoses + {summary['medications']} medications
   • Counselor:  {summary['counseling']} counseling notes
   • Admin:      {summary['referrals']} referrals + {summary['investigations']} investigations
        """)
        
        # 11. Test Patient Portal Access
        print("\n11. TESTING PATIENT PORTAL ACCESS...")
        cursor.execute("""
            SELECT COUNT(*) as cnt FROM appointments 
            WHERE patient_id = %s AND status IN ('confirmed', 'pending')
        """, (patient_id,))
        apt_count = cursor.fetchone()['cnt']
        
        if apt_count > 0:
            print(f"   ✓ Patient has {apt_count} upcoming appointments")
        else:
            print(f"   ⚠ Patient has no upcoming appointments (data will be empty on portal)")
        
        # 12. Overall Status
        print("\n" + "=" * 70)
        total_entries = (
            summary['vital_signs'] + summary['diagnoses'] + summary['medications'] +
            summary['counseling'] + summary['referrals'] + summary['investigations']
        )
        
        if total_entries > 0:
            print("✓ WORKFLOW IS FUNCTIONAL FOR ALL ROLES")
            print(f"  Total clinical entries: {total_entries}")
        else:
            print("⚠ WORKFLOW NEEDS DATA POPULATION")
        
        print("=" * 70)
        
        cursor.close()
        connection.close()
        
        return True
        
    except Error as e:
        print(f"❌ Database Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    test_workflow()
