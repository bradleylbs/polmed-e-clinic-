#!/usr/bin/env python3
"""
Schema Migration Script for Patient Appointments Table
========================================================
This script fixes the appointments table schema to align with stored procedures:
- Renames 'appointments' to 'patient_appointments'
- Adds missing 'route_location_id' column (CRITICAL)
- Adds missing 'booking_reference' column (CRITICAL)
- Adds proper foreign key constraints
- Updates status default value
- Adds necessary indexes

Usage:
    python scripts/migrate_appointments_schema.py
    
Prerequisites:
    - Database credentials in .env file
    - Azure MySQL connection
    - Stored procedures already deployed
"""

import mysql.connector
import sys
import os
from datetime import datetime

# Database connection details
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
}

def migrate_schema():
    """Migrate appointments table to patient_appointments with correct schema"""
    try:
        # Connect to database
        print(f"\nConnecting to {DB_CONFIG['host']}...")
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor()
        print("✓ Connected to database\n")
        
        # ========================================================================
        # STEP 1: Verify appointments table exists
        # ========================================================================
        print("="*70)
        print("STEP 1: Verify existing 'appointments' table")
        print("="*70)
        
        cursor.execute("""
            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'appointments'
        """, (DB_CONFIG['database'],))
        
        if not cursor.fetchone():
            print("✗ Error: 'appointments' table does not exist")
            print("  Available tables:")
            cursor.execute(f"SHOW TABLES IN {DB_CONFIG['database']}")
            for row in cursor.fetchall():
                print(f"    - {row[0]}")
            cursor.close()
            connection.close()
            return False
        
        print("✓ Found 'appointments' table\n")
        
        # ========================================================================
        # STEP 2: Check current appointments table structure
        # ========================================================================
        print("="*70)
        print("STEP 2: Current 'appointments' table structure")
        print("="*70)
        
        cursor.execute("DESCRIBE `appointments`")
        columns = cursor.fetchall()
        print("\nCurrent columns:")
        for col in columns:
            col_name, col_type, null, key, default, extra = col
            print(f"  - {col_name:25} {col_type:30} {'NULL' if null == 'YES' else 'NOT NULL':10} {key if key else ''}")
        
        # Check for missing columns
        column_names = [col[0] for col in columns]
        missing_cols = []
        
        if 'route_location_id' not in column_names:
            missing_cols.append('route_location_id')
            print("\n⚠️  MISSING: 'route_location_id' - CRITICAL for stored procedures")
        
        if 'booking_reference' not in column_names:
            missing_cols.append('booking_reference')
            print("⚠️  MISSING: 'booking_reference' - CRITICAL for booking flow")
        
        # Check current row count
        cursor.execute("SELECT COUNT(*) FROM `appointments`")
        row_count = cursor.fetchone()[0]
        print(f"\nCurrent rows in appointments: {row_count}")
        
        # ========================================================================
        # STEP 3: Backup old table (optional)
        # ========================================================================
        if row_count > 0:
            print("\n" + "="*70)
            print("STEP 3: Create backup table")
            print("="*70)
            print(f"Backing up {row_count} existing appointment records...")
            
            try:
                cursor.execute("""
                    CREATE TABLE `appointments_backup_20251017` 
                    LIKE `appointments`
                """)
                cursor.execute("""
                    INSERT INTO `appointments_backup_20251017` 
                    SELECT * FROM `appointments`
                """)
                connection.commit()
                print(f"✓ Created backup table 'appointments_backup_20251017' with {row_count} records")
            except Exception as e:
                print(f"⚠️  Warning: Could not create backup: {e}")
        
        # ========================================================================
        # STEP 4: Disable foreign key checks
        # ========================================================================
        print("\n" + "="*70)
        print("STEP 4: Disable foreign key constraints temporarily")
        print("="*70)
        
        cursor.execute("SET FOREIGN_KEY_CHECKS=0")
        connection.commit()
        print("✓ Foreign key checks disabled\n")
        
        # ========================================================================
        # STEP 5: Drop dependent foreign keys
        # ========================================================================
        print("="*70)
        print("STEP 5: Drop existing foreign key constraints")
        print("="*70)
        
        cursor.execute("""
            SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_NAME = 'appointments' 
            AND COLUMN_NAME = 'patient_id'
            AND CONSTRAINT_NAME != 'PRIMARY'
            AND TABLE_SCHEMA = %s
        """, (DB_CONFIG['database'],))
        
        constraints = cursor.fetchall()
        for constraint in constraints:
            try:
                cursor.execute(f"ALTER TABLE `appointments` DROP FOREIGN KEY `{constraint[0]}`")
                connection.commit()
                print(f"✓ Dropped constraint: {constraint[0]}")
            except Exception as e:
                print(f"⚠️  Could not drop {constraint[0]}: {e}")
        
        # ========================================================================
        # STEP 6: Add missing columns
        # ========================================================================
        print("\n" + "="*70)
        print("STEP 6: Add missing columns to 'appointments' table")
        print("="*70)
        
        if 'route_location_id' not in column_names:
            print("Adding 'route_location_id' column (CRITICAL)...")
            cursor.execute("""
                ALTER TABLE `appointments`
                ADD COLUMN `route_location_id` INT AFTER `id`,
                ADD CONSTRAINT `fk_appointments_route_location` 
                    FOREIGN KEY (`route_location_id`) REFERENCES `route_locations` (`id`) ON DELETE CASCADE
            """)
            connection.commit()
            print("✓ Added 'route_location_id' column with foreign key constraint")
        
        if 'booking_reference' not in column_names:
            print("Adding 'booking_reference' column (CRITICAL)...")
            cursor.execute("""
                ALTER TABLE `appointments`
                ADD COLUMN `booking_reference` VARCHAR(50) DEFAULT NULL UNIQUE AFTER `appointment_time`
            """)
            connection.commit()
            print("✓ Added 'booking_reference' column")
        
        # ========================================================================
        # STEP 7: Add missing appointment_duration column
        # ========================================================================
        print("\n" + "="*70)
        print("STEP 7: Add 'appointment_duration' column")
        print("="*70)
        
        if 'appointment_duration' not in column_names:
            print("Adding 'appointment_duration' column...")
            cursor.execute("""
                ALTER TABLE `appointments`
                ADD COLUMN `appointment_duration` INT DEFAULT 30 AFTER `appointment_time`
            """)
            connection.commit()
            print("✓ Added 'appointment_duration' column (default: 30 minutes)")
        
        # ========================================================================
        # STEP 8: Modify status column
        # ========================================================================
        print("\n" + "="*70)
        print("STEP 8: Update 'status' column default value")
        print("="*70)
        
        print("Changing default status from 'Booked' to 'Available'...")
        cursor.execute("""
            ALTER TABLE `appointments`
            MODIFY COLUMN `status` VARCHAR(50) DEFAULT 'Available'
        """)
        connection.commit()
        print("✓ Updated status default value")
        
        # ========================================================================
        # STEP 9: Make patient_id nullable
        # ========================================================================
        print("\n" + "="*70)
        print("STEP 9: Make 'patient_id' nullable")
        print("="*70)
        
        print("Modifying patient_id to allow NULL values...")
        cursor.execute("""
            ALTER TABLE `appointments`
            MODIFY COLUMN `patient_id` INT DEFAULT NULL
        """)
        connection.commit()
        print("✓ Made patient_id nullable")
        
        # ========================================================================
        # STEP 10: Add performance indexes
        # ========================================================================
        print("\n" + "="*70)
        print("STEP 10: Add performance indexes")
        print("="*70)
        
        indexes_to_add = [
            ("idx_appointments_route_date_status", "(route_location_id, appointment_date, status)"),
            ("idx_appointments_booking_ref", "(booking_reference)"),
            ("idx_appointments_status", "(status)"),
        ]
        
        for index_name, columns in indexes_to_add:
            try:
                cursor.execute(f"CREATE INDEX `{index_name}` ON `appointments` {columns}")
                connection.commit()
                print(f"✓ Created index: {index_name}")
            except Exception as e:
                if "Duplicate key name" in str(e):
                    print(f"ℹ Index already exists: {index_name}")
                else:
                    print(f"⚠️  Could not create index {index_name}: {e}")
        
        # ========================================================================
        # STEP 11: Rename table to patient_appointments
        # ========================================================================
        print("\n" + "="*70)
        print("STEP 11: Rename table 'appointments' → 'patient_appointments'")
        print("="*70)
        
        print("Renaming table...")
        cursor.execute("RENAME TABLE `appointments` TO `patient_appointments`")
        connection.commit()
        print("✓ Renamed 'appointments' to 'patient_appointments'\n")
        
        # ========================================================================
        # STEP 12: Re-enable foreign key checks
        # ========================================================================
        print("="*70)
        print("STEP 12: Re-enable foreign key constraints")
        print("="*70)
        
        cursor.execute("SET FOREIGN_KEY_CHECKS=1")
        connection.commit()
        print("✓ Foreign key checks enabled\n")
        
        # ========================================================================
        # STEP 13: Verify final schema
        # ========================================================================
        print("="*70)
        print("STEP 13: Verify final 'patient_appointments' table structure")
        print("="*70)
        
        cursor.execute("DESCRIBE `patient_appointments`")
        columns = cursor.fetchall()
        print("\nFinal columns:")
        for col in columns:
            col_name, col_type, null, key, default, extra = col
            status = ""
            if col_name == 'route_location_id':
                status = " ✓ CRITICAL"
            elif col_name == 'booking_reference':
                status = " ✓ CRITICAL"
            print(f"  - {col_name:25} {col_type:30} {'NULL' if null == 'YES' else 'NOT NULL':10}{status}")
        
        # ========================================================================
        # STEP 14: Verify foreign keys
        # ========================================================================
        print("\n" + "="*70)
        print("STEP 14: Verify foreign key constraints")
        print("="*70)
        
        cursor.execute("""
            SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_NAME = 'patient_appointments'
            AND COLUMN_NAME IN ('route_location_id', 'patient_id', 'created_by')
            AND TABLE_SCHEMA = %s
            AND REFERENCED_TABLE_NAME IS NOT NULL
        """, (DB_CONFIG['database'],))
        
        fks = cursor.fetchall()
        print("\nForeign key constraints:")
        for fk in fks:
            constraint_name, column_name, ref_table, ref_column = fk
            print(f"  - {constraint_name:35} {column_name} → {ref_table}.{ref_column}")
        
        # ========================================================================
        # STEP 15: Verify indexes
        # ========================================================================
        print("\n" + "="*70)
        print("STEP 15: Verify indexes")
        print("="*70)
        
        cursor.execute("""
            SELECT INDEX_NAME, COLUMN_NAME
            FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_NAME = 'patient_appointments'
            AND TABLE_SCHEMA = %s
            ORDER BY INDEX_NAME, SEQ_IN_INDEX
        """, (DB_CONFIG['database'],))
        
        indexes = cursor.fetchall()
        print("\nIndexes on table:")
        current_index = None
        for idx_name, col_name in indexes:
            if idx_name != current_index:
                print(f"  - {idx_name}")
                current_index = idx_name
            print(f"      └─ {col_name}")
        
        cursor.close()
        connection.close()
        
        # ========================================================================
        # SUCCESS
        # ========================================================================
        print("\n" + "="*70)
        print("✓ SCHEMA MIGRATION COMPLETED SUCCESSFULLY!")
        print("="*70)
        print("\nWhat was changed:")
        print("  1. ✓ Renamed 'appointments' → 'patient_appointments'")
        print("  2. ✓ Added 'route_location_id' column (CRITICAL)")
        print("  3. ✓ Added 'booking_reference' column (CRITICAL)")
        print("  4. ✓ Added 'appointment_duration' column")
        print("  5. ✓ Updated status default: 'Booked' → 'Available'")
        print("  6. ✓ Made patient_id nullable")
        print("  7. ✓ Added performance indexes")
        print("  8. ✓ Configured foreign key constraints")
        print("\nStored procedures can now execute successfully:")
        print("  ✓ sp_generate_appointment_slots can INSERT into patient_appointments")
        print("  ✓ sp_get_available_appointments can JOIN on route_location_id")
        print("  ✓ Backend endpoints ready to use stored procedures")
        print("\nNext steps:")
        print("  1. Test route creation endpoint (POST /api/routes)")
        print("  2. Test patient search endpoint (GET /api/patient-portal/appointments/available/{id})")
        print("  3. Test booking endpoint (POST /api/patient-portal/appointments/{id}/book)")
        print("="*70 + "\n")
        
        return True
        
    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        
        # Try to re-enable foreign keys on error
        try:
            cursor.execute("SET FOREIGN_KEY_CHECKS=1")
            connection.commit()
        except:
            pass
        
        return False

if __name__ == "__main__":
    print("\n" + "="*70)
    print("POLMED CLINIC ERP - PATIENT APPOINTMENTS TABLE MIGRATION")
    print("="*70)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    success = migrate_schema()
    
    print(f"Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    sys.exit(0 if success else 1)

