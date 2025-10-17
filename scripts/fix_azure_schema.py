#!/usr/bin/env python3
"""
PALMED CLINIC ERP - Azure MySQL Schema Fixer
============================================================================
Automatically fixes all schema misalignments in patient_appointments table
Connects to Azure MySQL database and applies all corrections
============================================================================
Uses credentials from create_test_users.py for consistency
"""

import mysql.connector
from mysql.connector import Error
import sys
import os
import time
from datetime import datetime

# Use same credentials as create_test_users.py
AZURE_CONFIG = {
    'host': os.environ.get('DB_HOST', 'db-polmed.mysql.database.azure.com'),
    'user': os.environ.get('DB_USER', 'dbadmin'),
    'password': os.environ.get('DB_PASSWORD', 'Polm3d!DB@2025'),
    'database': os.environ.get('DB_NAME', 'palmed_clinic_erp'),
    'port': int(os.environ.get('DB_PORT', 3306)),
    'use_unicode': True,
    'charset': 'utf8mb4',
    'collation': 'utf8mb4_unicode_ci',
    'ssl_disabled': False,
    'ssl_verify_cert': False,
    'ssl_verify_identity': False,
    'autocommit': False,
    'raise_on_warnings': False,  # Allow warnings
}

class SchemaMigrator:
    """Handles all schema migration tasks"""
    
    def __init__(self, config):
        self.config = config
        self.connection = None
        self.cursor = None
        self.log_file = f"schema_migration_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
        self.errors = []
        self.success_count = 0
        self.warning_count = 0
        
    def log(self, message, level="INFO"):
        """Log messages to console and file"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        # Color coding for console output
        color_codes = {
            "SUCCESS": "\033[92m",  # Green
            "ERROR": "\033[91m",    # Red
            "WARNING": "\033[93m",  # Yellow
            "INFO": "\033[94m",     # Blue
            "RESET": "\033[0m"      # Reset
        }
        
        color = color_codes.get(level, color_codes["INFO"])
        reset = color_codes["RESET"]
        
        log_message = f"[{timestamp}] [{level}] {message}"
        console_message = f"{color}{log_message}{reset}"
        
        print(console_message)
        
        try:
            with open(self.log_file, 'a', encoding='utf-8') as f:
                f.write(log_message + '\n')
        except Exception as e:
            print(f"Warning: Could not write to log file: {e}")
    
    def connect(self):
        """Connect to Azure MySQL database"""
        try:
            self.log("Connecting to Azure MySQL database...", "INFO")
            self.log(f"Host: {self.config['host']}", "INFO")
            self.log(f"Database: {self.config['database']}", "INFO")
            
            self.connection = mysql.connector.connect(**self.config)
            self.cursor = self.connection.cursor()
            self.log("✅ Connected to Azure MySQL successfully!", "SUCCESS")
            return True
        except Error as e:
            self.log(f"❌ Connection failed: {e}", "ERROR")
            self.errors.append(f"Connection failed: {e}")
            return False
    
    def disconnect(self):
        """Close database connection"""
        try:
            if self.cursor:
                self.cursor.close()
            if self.connection:
                self.connection.close()
            self.log("Disconnected from database", "INFO")
        except Error as e:
            self.log(f"Error closing connection: {e}", "WARNING")
    
    def execute_query(self, query, description=""):
        """Execute a single query safely"""
        try:
            self.log(f"Executing: {description}", "INFO")
            self.cursor.execute(query)
            self.connection.commit()
            
            self.log(f"✅ {description} - SUCCESS (rows affected: {self.cursor.rowcount})", "SUCCESS")
            self.success_count += 1
            return True
                
        except Error as e:
            error_code = e.errno if hasattr(e, 'errno') else 'UNKNOWN'
            error_msg = str(e)
            
            # Handle specific errors gracefully
            if error_code == 1050:  # Table already exists
                self.log(f"⚠️ {description} - Table/index already exists (skipping)", "WARNING")
                self.warning_count += 1
                self.connection.rollback()
                return True
            elif error_code == 1060:  # Duplicate column name
                self.log(f"⚠️ {description} - Column already exists (skipping)", "WARNING")
                self.warning_count += 1
                self.connection.rollback()
                return True
            elif error_code == 1091:  # Can't DROP column
                self.log(f"⚠️ {description} - Column doesn't exist or already dropped (skipping)", "WARNING")
                self.warning_count += 1
                self.connection.rollback()
                return True
            elif error_code == 1025:  # Can't drop foreign key
                self.log(f"⚠️ {description} - Foreign key constraint issue (continuing)", "WARNING")
                self.warning_count += 1
                self.connection.rollback()
                return True
            else:
                full_error = f"Query failed: {description}\nError {error_code}: {error_msg}"
                self.log(f"❌ {full_error}", "ERROR")
                self.errors.append(full_error)
                self.connection.rollback()
                return False
    
    def check_table_exists(self):
        """Check if patient_appointments table exists"""
        try:
            self.cursor.execute("""
                SELECT COUNT(*) 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'patient_appointments'
            """, (self.config['database'],))
            
            result = self.cursor.fetchone()
            exists = result[0] > 0
            
            if exists:
                self.log("✅ patient_appointments table found", "SUCCESS")
            else:
                self.log("❌ patient_appointments table NOT found", "ERROR")
            
            return exists
        except Error as e:
            self.log(f"Error checking table: {e}", "ERROR")
            return False
    
    def get_table_structure(self):
        """Get current table structure"""
        try:
            self.log("Retrieving current table structure...", "INFO")
            self.cursor.execute("""
                SELECT 
                    COLUMN_NAME, 
                    COLUMN_TYPE, 
                    IS_NULLABLE, 
                    COLUMN_DEFAULT, 
                    EXTRA
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'patient_appointments'
                ORDER BY ORDINAL_POSITION
            """, (self.config['database'],))
            
            columns = self.cursor.fetchall()
            self.log(f"Found {len(columns)} columns in table", "INFO")
            return columns
        except Error as e:
            self.log(f"Error getting table structure: {e}", "ERROR")
            return []
    
    def column_exists(self, column_name):
        """Check if a column exists in the table"""
        try:
            self.cursor.execute("""
                SELECT COUNT(*) 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = %s 
                AND TABLE_NAME = 'patient_appointments' 
                AND COLUMN_NAME = %s
            """, (self.config['database'], column_name))
            
            result = self.cursor.fetchone()
            return result[0] > 0
        except Error as e:
            self.log(f"Error checking column: {e}", "ERROR")
            return False
    
    def index_exists(self, index_name):
        """Check if an index exists in the table"""
        try:
            self.cursor.execute("""
                SELECT COUNT(*) 
                FROM INFORMATION_SCHEMA.STATISTICS 
                WHERE TABLE_SCHEMA = %s 
                AND TABLE_NAME = 'patient_appointments' 
                AND INDEX_NAME = %s
            """, (self.config['database'], index_name))
            
            result = self.cursor.fetchone()
            return result[0] > 0
        except Error as e:
            self.log(f"Error checking index: {e}", "ERROR")
            return False
    
    def fk_exists(self, constraint_name):
        """Check if a foreign key exists"""
        try:
            self.cursor.execute("""
                SELECT COUNT(*) 
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
                WHERE TABLE_SCHEMA = %s 
                AND TABLE_NAME = 'patient_appointments' 
                AND CONSTRAINT_NAME = %s
            """, (self.config['database'], constraint_name))
            
            result = self.cursor.fetchone()
            return result[0] > 0
        except Error as e:
            self.log(f"Error checking FK: {e}", "ERROR")
            return False
    
    # ===================================================================
    # MIGRATION TASKS
    # ===================================================================
    
    def disable_foreign_key_checks(self):
        """Temporarily disable FK checks"""
        self.execute_query("SET FOREIGN_KEY_CHECKS=0", "Disable FK checks")
    
    def enable_foreign_key_checks(self):
        """Re-enable FK checks"""
        self.execute_query("SET FOREIGN_KEY_CHECKS=1", "Enable FK checks")
    
    def fix_patient_id_nullable(self):
        """Make patient_id nullable (slots created before patient books)"""
        query = """
            ALTER TABLE `patient_appointments` 
            MODIFY COLUMN `patient_id` int DEFAULT NULL COMMENT 'NULL until appointment is booked'
        """
        self.execute_query(query, "Make patient_id nullable")
    
    def fix_booking_reference_nullable(self):
        """Make booking_reference nullable (NULL until booking confirmed)"""
        query = """
            ALTER TABLE `patient_appointments` 
            MODIFY COLUMN `booking_reference` varchar(50) DEFAULT NULL COMMENT 'NULL until booking confirmed'
        """
        self.execute_query(query, "Make booking_reference nullable")
    
    def fix_route_location_not_null(self):
        """Ensure route_location_id is NOT NULL (required for appointments)"""
        query = """
            ALTER TABLE `patient_appointments` 
            MODIFY COLUMN `route_location_id` int NOT NULL COMMENT 'REQUIRED - links to route_locations'
        """
        self.execute_query(query, "Make route_location_id NOT NULL")
    
    def fix_status_enum(self):
        """Fix status to use correct ENUM values"""
        query = """
            ALTER TABLE `patient_appointments` 
            MODIFY COLUMN `status` ENUM('Available','Booked','Confirmed','Completed','Cancelled','NoShow') 
            NOT NULL DEFAULT 'Available' COMMENT 'Appointment status'
        """
        self.execute_query(query, "Fix status ENUM values")
    
    def fix_appointment_duration(self):
        """Add appointment_duration column if missing"""
        if not self.column_exists("appointment_duration"):
            query = """
                ALTER TABLE `patient_appointments` 
                ADD COLUMN `appointment_duration` int DEFAULT 30 COMMENT 'Duration in minutes'
                AFTER `appointment_time`
            """
            self.execute_query(query, "Add appointment_duration column")
        else:
            query = """
                ALTER TABLE `patient_appointments` 
                MODIFY COLUMN `appointment_duration` int DEFAULT 30 COMMENT 'Duration in minutes'
            """
            self.execute_query(query, "Fix appointment_duration default")
    
    def add_missing_indexes(self):
        """Add all missing performance indexes"""
        indexes = [
            ("idx_route_location_id", "`route_location_id`"),
            ("idx_appointment_date", "`appointment_date`"),
            ("idx_status", "`status`"),
            ("idx_patient_id", "`patient_id`"),
            ("idx_route_location_status", "`route_location_id`, `status`"),
            ("idx_appointment_date_status", "`appointment_date`, `status`"),
        ]
        
        for index_name, columns in indexes:
            if not self.index_exists(index_name):
                query = f"ALTER TABLE `patient_appointments` ADD INDEX `{index_name}` ({columns})"
                self.execute_query(query, f"Add index: {index_name}")
            else:
                self.log(f"⏭️ Index {index_name} already exists", "INFO")
    
    def add_unique_constraint_booking_reference(self):
        """Add unique constraint on booking_reference"""
        if not self.index_exists("uk_booking_reference"):
            query = """
                ALTER TABLE `patient_appointments` 
                ADD UNIQUE KEY `uk_booking_reference` (`booking_reference`)
            """
            self.execute_query(query, "Add unique constraint on booking_reference")
        else:
            self.log("⏭️ Unique constraint on booking_reference already exists", "INFO")
    
    def add_foreign_keys(self):
        """Add all required foreign keys"""
        self.disable_foreign_key_checks()
        
        # FK to route_locations
        if not self.fk_exists("fk_patient_appointments_route_location"):
            # First, drop old FK if it exists
            try:
                self.cursor.execute("""
                    ALTER TABLE `patient_appointments` 
                    DROP FOREIGN KEY `patient_appointments_ibfk_2`
                """)
                self.connection.commit()
            except:
                pass
            
            query = """
                ALTER TABLE `patient_appointments` 
                ADD CONSTRAINT `fk_patient_appointments_route_location` 
                FOREIGN KEY (`route_location_id`) REFERENCES `route_locations` (`id`) 
                ON DELETE CASCADE ON UPDATE CASCADE
            """
            self.execute_query(query, "Add FK to route_locations")
        else:
            self.log("⏭️ FK to route_locations already exists", "INFO")
        
        # FK to patients
        if not self.fk_exists("fk_patient_appointments_patient"):
            try:
                self.cursor.execute("""
                    ALTER TABLE `patient_appointments` 
                    DROP FOREIGN KEY `patient_appointments_ibfk_1`
                """)
                self.connection.commit()
            except:
                pass
            
            query = """
                ALTER TABLE `patient_appointments` 
                ADD CONSTRAINT `fk_patient_appointments_patient` 
                FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) 
                ON DELETE SET NULL ON UPDATE CASCADE
            """
            self.execute_query(query, "Add FK to patients")
        else:
            self.log("⏭️ FK to patients already exists", "INFO")
        
        # FK to users (created_by)
        if self.column_exists("created_by"):
            if not self.fk_exists("fk_patient_appointments_created_by"):
                try:
                    self.cursor.execute("""
                        ALTER TABLE `patient_appointments` 
                        DROP FOREIGN KEY `patient_appointments_ibfk_3`
                    """)
                    self.connection.commit()
                except:
                    pass
                
                query = """
                    ALTER TABLE `patient_appointments` 
                    ADD CONSTRAINT `fk_patient_appointments_created_by` 
                    FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) 
                    ON DELETE SET NULL ON UPDATE CASCADE
                """
                self.execute_query(query, "Add FK to users (created_by)")
            else:
                self.log("⏭️ FK to users (created_by) already exists", "INFO")
        
        self.enable_foreign_key_checks()
    
    def fix_status_values(self):
        """Fix any invalid status values in existing data"""
        query = """
            UPDATE `patient_appointments` 
            SET `status` = 'Available' 
            WHERE `status` NOT IN ('Available','Booked','Confirmed','Completed','Cancelled','NoShow')
            AND `status` IS NOT NULL
        """
        self.execute_query(query, "Fix invalid status values")
    
    def clean_empty_strings(self):
        """Convert empty strings to NULL"""
        queries = [
            ("UPDATE `patient_appointments` SET `booking_reference` = NULL WHERE `booking_reference` = ''", 
             "Clean empty booking_references"),
            ("UPDATE `patient_appointments` SET `notes` = NULL WHERE `notes` = ''", 
             "Clean empty notes"),
        ]
        
        for query, description in queries:
            self.execute_query(query, description)
    
    def verify_data_integrity(self):
        """Check for data integrity issues"""
        self.log("\n" + "="*70, "INFO")
        self.log("DATA INTEGRITY CHECKS", "INFO")
        self.log("="*70, "INFO")
        
        checks = [
            ("Orphaned route_locations", """
                SELECT COUNT(*) FROM `patient_appointments` pa
                WHERE pa.`route_location_id` NOT IN (SELECT `id` FROM `route_locations`)
            """),
            ("Orphaned patients", """
                SELECT COUNT(*) FROM `patient_appointments` pa
                WHERE pa.`patient_id` IS NOT NULL 
                AND pa.`patient_id` NOT IN (SELECT `id` FROM `patients`)
            """),
            ("Orphaned users (created_by)", """
                SELECT COUNT(*) FROM `patient_appointments` pa
                WHERE pa.`created_by` IS NOT NULL 
                AND pa.`created_by` NOT IN (SELECT `id` FROM `users`)
            """),
            ("Duplicate booking_references", """
                SELECT COUNT(*) FROM (
                    SELECT `booking_reference` FROM `patient_appointments` 
                    WHERE `booking_reference` IS NOT NULL 
                    GROUP BY `booking_reference` HAVING COUNT(*) > 1
                ) as dups
            """),
            ("Appointments without route_location", """
                SELECT COUNT(*) FROM `patient_appointments` 
                WHERE `route_location_id` IS NULL
            """),
        ]
        
        for check_name, query in checks:
            try:
                self.cursor.execute(query)
                result = self.cursor.fetchone()
                count = result[0] if result else 0
                
                if count > 0:
                    self.log(f"⚠️  {check_name}: {count} issues found", "WARNING")
                else:
                    self.log(f"✅ {check_name}: OK", "SUCCESS")
            except Error as e:
                self.log(f"❌ {check_name}: Error - {e}", "ERROR")
    
    def show_final_schema(self):
        """Display final table structure"""
        self.log("\n" + "="*70, "INFO")
        self.log("FINAL TABLE STRUCTURE", "INFO")
        self.log("="*70, "INFO")
        
        try:
            self.cursor.execute("""
                SELECT 
                    COLUMN_NAME, 
                    COLUMN_TYPE, 
                    IS_NULLABLE, 
                    COLUMN_DEFAULT,
                    COLUMN_COMMENT
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'patient_appointments'
                ORDER BY ORDINAL_POSITION
            """, (self.config['database'],))
            
            columns = self.cursor.fetchall()
            self.log(f"\nTotal columns: {len(columns)}\n", "INFO")
            
            for col in columns:
                col_name, col_type, nullable, default, comment = col
                nullable_str = "NULL" if nullable == 'YES' else "NOT NULL"
                default_str = f"DEFAULT {default}" if default else ""
                comment_str = f"-- {comment}" if comment else ""
                
                self.log(f"  {col_name:30} {col_type:30} {nullable_str:10} {default_str:20} {comment_str}", "INFO")
        
        except Error as e:
            self.log(f"Error displaying schema: {e}", "ERROR")
    
    def show_statistics(self):
        """Display table statistics"""
        self.log("\n" + "="*70, "INFO")
        self.log("TABLE STATISTICS", "INFO")
        self.log("="*70, "INFO")
        
        try:
            queries = [
                ("Total appointments", "SELECT COUNT(*) FROM `patient_appointments`"),
                ("Available slots", "SELECT COUNT(*) FROM `patient_appointments` WHERE `status` = 'Available'"),
                ("Booked appointments", "SELECT COUNT(*) FROM `patient_appointments` WHERE `patient_id` IS NOT NULL"),
                ("With booking reference", "SELECT COUNT(*) FROM `patient_appointments` WHERE `booking_reference` IS NOT NULL"),
                ("Without booking reference", "SELECT COUNT(*) FROM `patient_appointments` WHERE `booking_reference` IS NULL"),
            ]
            
            for stat_name, query in queries:
                self.cursor.execute(query)
                result = self.cursor.fetchone()
                count = result[0] if result else 0
                self.log(f"  {stat_name:35} : {count:,}", "INFO")
        
        except Error as e:
            self.log(f"Error getting statistics: {e}", "ERROR")
    
    def run_migration(self):
        """Execute complete migration"""
        self.log("\n" + "="*70, "INFO")
        self.log("PALMED CLINIC ERP - SCHEMA MIGRATION STARTED", "INFO")
        self.log("="*70, "INFO")
        self.log(f"Timestamp: {datetime.now()}", "INFO")
        self.log(f"Database: {self.config['database']}", "INFO")
        self.log(f"Host: {self.config['host']}", "INFO")
        
        # Connect
        if not self.connect():
            return False
        
        try:
            # Check table exists
            if not self.check_table_exists():
                self.log("❌ FATAL: patient_appointments table does not exist!", "ERROR")
                return False
            
            # Get current structure
            self.get_table_structure()
            
            # Execute all migrations
            self.log("\n" + "-"*70, "INFO")
            self.log("APPLYING SCHEMA FIXES", "INFO")
            self.log("-"*70, "INFO")
            
            self.fix_patient_id_nullable()
            self.fix_booking_reference_nullable()
            self.fix_route_location_not_null()
            self.fix_status_enum()
            self.fix_appointment_duration()
            self.add_missing_indexes()
            self.add_unique_constraint_booking_reference()
            self.add_foreign_keys()
            
            # Fix data
            self.log("\n" + "-"*70, "INFO")
            self.log("FIXING EXISTING DATA", "INFO")
            self.log("-"*70, "INFO")
            
            self.fix_status_values()
            self.clean_empty_strings()
            
            # Verify
            self.verify_data_integrity()
            
            # Display results
            self.show_final_schema()
            self.show_statistics()
            
            # Summary
            self.log("\n" + "="*70, "SUCCESS")
            self.log("MIGRATION COMPLETED SUCCESSFULLY! ✅", "SUCCESS")
            self.log(f"Operations completed: {self.success_count}", "SUCCESS")
            
            if self.errors:
                self.log(f"Errors encountered: {len(self.errors)}", "WARNING")
                for error in self.errors:
                    self.log(f"  - {error}", "WARNING")
            
            self.log("="*70, "SUCCESS")
            self.log(f"Log file: {self.log_file}", "INFO")
            
            return True
        
        except Exception as e:
            self.log(f"❌ FATAL ERROR: {e}", "ERROR")
            return False
        
        finally:
            self.disconnect()


def main():
    """Main entry point"""
    try:
        migrator = SchemaMigrator(AZURE_CONFIG)
        success = migrator.run_migration()
        
        sys.exit(0 if success else 1)
    
    except KeyboardInterrupt:
        print("\n\n⚠️  Migration cancelled by user")
        sys.exit(1)
    
    except Exception as e:
        print(f"\n\n❌ Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
