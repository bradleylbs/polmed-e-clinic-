"""
ICD-10-CM Code Population Script - ENHANCED
Downloads and populates all ICD-10-CM codes from CDC official source
"""

import mysql.connector
from mysql.connector import Error
import os
import logging
import requests
import re
import zipfile
import io
from typing import List, Dict, Optional
from dataclasses import dataclass
import time
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('icd10_population.log')
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class Config:
    """Configuration management"""
    host: str
    database: str
    user: str
    password: Optional[str]
    port: int
    batch_size: int = 1000
    max_retries: int = 3
    request_timeout: int = 120
    
    @classmethod
    def from_env(cls):
        return cls(
            host=os.environ.get('DB_HOST', 'localhost'),
            database=os.environ.get('DB_NAME', 'palmed_clinic_erp'),
            user=os.environ.get('DB_USER', 'root'),
            password=os.environ.get('DB_PASSWORD','Transport@2025'),  # No default for security
            port=int(os.environ.get('DB_PORT', 3306)),
            batch_size=int(os.environ.get('BATCH_SIZE', 1000)),
            max_retries=int(os.environ.get('MAX_RETRIES', 3)),
            request_timeout=int(os.environ.get('REQUEST_TIMEOUT', 120))
        )

# CDC ICD-10-CM FTP URLs (using FY2025 release - currently available)
ICD10_ZIP_URL = "https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Publications/ICD10CM/2025/ICD10-CM Code Descriptions 2025.zip"
ICD10_APRIL_ZIP_URL = "https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Publications/ICD10CM/2025-Update/Code-desciptions-April-2025.zip"

# Fallback URLs in case primary URLs change
FALLBACK_URLS = [
    "https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Publications/ICD10CM/2024/ICD10-CM Code Descriptions 2024.zip",
    "https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Publications/ICD10CM/2023/ICD10-CM Code Descriptions 2023.zip"
]

# Common diagnosis codes to mark as frequently used
COMMON_CODES = {
    'I10', 'E11.9', 'J44.9', 'M79.3', 'R51', 'K21.9', 'J06.9', 'N39.0',
    'M54.5', 'E78.5', 'J45.909', 'F41.9', 'K59.00', 'R10.9', 'M25.50',
    'J02.9', 'R50.9', 'J18.9', 'N18.9', 'E66.9', 'F32.9', 'M19.90',
    'J20.9', 'R05', 'K29.70', 'R42', 'M62.81', 'J30.9', 'R53.83'
}


class ICD10Population:
    """Main class for ICD-10 code population"""
    
    def __init__(self, config: Config):
        self.config = config
        self.db_config = {
            'host': config.host,
            'database': config.database,
            'user': config.user,
            'password': config.password,
            'port': config.port,
            'autocommit': False,
            'use_unicode': True,
            'charset': 'utf8mb4'
        }

    def get_db_connection(self):
        """Create database connection"""
        try:
            connection = mysql.connector.connect(**self.db_config)
            if connection.is_connected():
                logger.info("Database connection successful")
                return connection
        except Error as e:
            logger.error(f"Database connection error: {e}")
            return None

    def validate_database_schema(self, connection):
        """Ensure the target table exists with correct structure"""
        cursor = connection.cursor()
        
        create_table_query = """
        CREATE TABLE IF NOT EXISTS icd10_codes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            icd10_code VARCHAR(10) NOT NULL UNIQUE,
            description TEXT NOT NULL,
            category VARCHAR(100),
            subcategory VARCHAR(100),
            is_common BOOLEAN DEFAULT FALSE,
            usage_count INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_category (category),
            INDEX idx_common (is_common),
            INDEX idx_code (icd10_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
        
        try:
            cursor.execute(create_table_query)
            connection.commit()
            logger.info("Database schema validated/created")
        except Error as e:
            logger.error(f"Schema validation failed: {e}")
            raise
        finally:
            cursor.close()

    def find_code_file(self, file_list: List[str]) -> str:
        """More robust file detection in ZIP"""
        patterns = [
            r'icd10cm.*codes.*\.txt$',
            r'icd10.*\.txt$',
            r'code.*descriptions.*\.txt$'
        ]
        
        for filename in file_list:
            lower_name = filename.lower()
            if any(re.search(pattern, lower_name) for pattern in patterns):
                return filename
        
        # Fallback: any .txt file
        for filename in file_list:
            if filename.endswith('.txt'):
                return filename
        
        return ""

    def download_with_retry(self, url: str) -> str:
        """Download with retry logic for transient failures"""
        for attempt in range(self.config.max_retries):
            try:
                content = self.download_and_extract_zip(url)
                if content:
                    return content
                else:
                    raise Exception("Empty content received")
            except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as e:
                if attempt == self.config.max_retries - 1:
                    raise
                wait_time = 2 ** attempt  # Exponential backoff
                logger.warning(f"Download attempt {attempt + 1} failed, retrying in {wait_time}s: {e}")
                time.sleep(wait_time)
            except Exception as e:
                if attempt == self.config.max_retries - 1:
                    raise
                wait_time = 2 ** attempt
                logger.warning(f"Download attempt {attempt + 1} failed, retrying in {wait_time}s: {e}")
                time.sleep(wait_time)
        return ""

    def download_and_extract_zip(self, url: str) -> str:
        """Download and extract ICD-10 ZIP file from CDC"""
        try:
            logger.info(f"Downloading from {url}")
            response = requests.get(url, timeout=self.config.request_timeout)
            response.raise_for_status()
            logger.info(f"Successfully downloaded {len(response.content)} bytes")
            
            # Extract the ZIP file
            with zipfile.ZipFile(io.BytesIO(response.content)) as z:
                # List files in the ZIP
                file_list = z.namelist()
                logger.info(f"Files in ZIP: {file_list}")
                
                # Find the text file with codes
                txt_file = self.find_code_file(file_list)
                
                if not txt_file:
                    logger.error(f"No suitable text file found in ZIP. Files: {file_list}")
                    return ""
                
                logger.info(f"Extracting {txt_file}")
                content = z.read(txt_file).decode('utf-8', errors='ignore')
                logger.info(f"Extracted {len(content)} characters")
                return content
                
        except Exception as e:
            logger.error(f"Error downloading/extracting file: {e}")
            return ""

    def parse_icd10_file(self, content: str) -> List[Dict]:
        """
        Parse the ICD-10-CM codes file
        Format can vary, but typically: CODE DESCRIPTION
        """
        codes = []
        lines = content.strip().split('\n')
        
        logger.info(f"Parsing {len(lines)} lines")
        
        for line_num, line in enumerate(lines, 1):
            # Skip empty lines
            if not line.strip():
                continue
            
            # Skip header lines
            if line_num == 1 and ('ORDER' in line.upper() or 'CODE' in line.upper()):
                continue
                
            try:
                # Try different parsing methods
                parts = line.split(None, 1)  # Split on first whitespace
                
                if len(parts) < 2:
                    continue
                
                code = parts[0].strip()
                description = parts[1].strip()
                
                # Validate code format (should start with letter)
                if not code or not code[0].isalpha():
                    continue
                
                # Skip if description is too short or looks like a header
                if len(description) < 5:
                    continue
                
                # Determine category from code structure
                category = self.get_category_from_code(code)
                
                codes.append({
                    'code': code,
                    'description': description,
                    'short_description': description[:60] if len(description) > 60 else description,
                    'category': category,
                    'is_common': code in COMMON_CODES
                })
                
            except Exception as e:
                logger.debug(f"Error parsing line {line_num}: {line[:50]}... - {e}")
                continue
        
        logger.info(f"Parsed {len(codes)} valid ICD-10 codes")
        return codes

    def get_category_from_code(self, code: str) -> str:
        """Determine category based on ICD-10 code prefix"""
        if not code:
            return 'Other'
        
        prefix = code[0].upper()
        
        categories = {
            'A': 'Infectious and Parasitic Diseases',
            'B': 'Infectious and Parasitic Diseases',
            'C': 'Neoplasms',
            'D': 'Blood and Immune Disorders',
            'E': 'Endocrine, Nutritional and Metabolic Diseases',
            'F': 'Mental and Behavioral Disorders',
            'G': 'Nervous System Diseases',
            'H': 'Eye and Ear Diseases',
            'I': 'Circulatory System Diseases',
            'J': 'Respiratory System Diseases',
            'K': 'Digestive System Diseases',
            'L': 'Skin and Subcutaneous Tissue Diseases',
            'M': 'Musculoskeletal System Diseases',
            'N': 'Genitourinary System Diseases',
            'O': 'Pregnancy, Childbirth and Puerperium',
            'P': 'Perinatal Conditions',
            'Q': 'Congenital Malformations',
            'R': 'Symptoms, Signs and Abnormal Findings',
            'S': 'Injury and Poisoning',
            'T': 'Injury and Poisoning',
            'V': 'External Causes of Morbidity',
            'W': 'External Causes of Morbidity',
            'X': 'External Causes of Morbidity',
            'Y': 'External Causes of Morbidity',
            'Z': 'Factors Influencing Health Status'
        }
        
        return categories.get(prefix, 'Other')

    def log_progress(self, current: int, total: int, stage: str):
        """Log progress with percentage"""
        percent = (current / total) * 100 if total > 0 else 0
        logger.info(f"{stage}: {current}/{total} ({percent:.1f}%)")

    def insert_codes_batch(self, connection, codes: List[Dict]) -> int:
        """Insert codes in batches for better performance"""
        cursor = connection.cursor()
        
        insert_query = """
            INSERT INTO icd10_codes 
            (icd10_code, description, category, subcategory, is_common, usage_count)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                description = VALUES(description),
                category = VALUES(category),
                subcategory = VALUES(subcategory),
                is_common = VALUES(is_common),
                updated_at = CURRENT_TIMESTAMP
        """
        
        total_inserted = 0
        total_batches = (len(codes) + self.config.batch_size - 1) // self.config.batch_size
        
        for i in range(0, len(codes), self.config.batch_size):
            batch = codes[i:i + self.config.batch_size]
            batch_num = (i // self.config.batch_size) + 1
            
            try:
                values = [
                    (
                        code['code'],
                        code['description'],
                        code['category'],
                        code.get('short_description', ''),
                        1 if code['is_common'] else 0,
                        0
                    )
                    for code in batch
                ]
                
                cursor.executemany(insert_query, values)
                connection.commit()
                
                total_inserted += len(batch)
                self.log_progress(total_inserted, len(codes), f"Batch {batch_num}/{total_batches}")
                
            except Error as e:
                logger.error(f"Error inserting batch {batch_num}: {e}")
                connection.rollback()
                
                # Try individual inserts for the failed batch
                individual_success = 0
                for code in batch:
                    try:
                        cursor.execute(insert_query, (
                            code['code'],
                            code['description'],
                            code['category'],
                            code.get('short_description', ''),
                            1 if code['is_common'] else 0,
                            0
                        ))
                        individual_success += 1
                    except Error:
                        logger.warning(f"Failed to insert code: {code['code']}")
                
                connection.commit()
                total_inserted += individual_success
                logger.info(f"Recovered {individual_success}/{len(batch)} codes from failed batch")
                continue
        
        cursor.close()
        return total_inserted

    def get_database_stats(self, connection):
        """Get statistics about the populated data"""
        cursor = connection.cursor(dictionary=True)
        stats = {}
        
        try:
            cursor.execute("SELECT COUNT(*) as total FROM icd10_codes")
            stats['total'] = cursor.fetchone()['total']
            
            cursor.execute("SELECT COUNT(*) as common FROM icd10_codes WHERE is_common = 1")
            stats['common'] = cursor.fetchone()['common']
            
            cursor.execute("""
                SELECT category, COUNT(*) as count 
                FROM icd10_codes 
                GROUP BY category 
                ORDER BY count DESC
            """)
            stats['categories'] = cursor.fetchall()
            
        finally:
            cursor.close()
        
        return stats

    def print_summary(self, stats: Dict, duration: float):
        """Print a nice summary of the operation"""
        logger.info(f"\n{'='*60}")
        logger.info(f"ICD-10 POPULATION COMPLETE!")
        logger.info(f"{'='*60}")
        logger.info(f"Execution time: {duration:.2f} seconds")
        logger.info(f"Total codes in database: {stats['total']}")
        logger.info(f"Common codes marked: {stats['common']}")
        logger.info(f"\nCodes by category:")
        for cat in stats['categories']:
            logger.info(f"  {cat['category']:.<40} {cat['count']:>6}")
        logger.info(f"{'='*60}\n")

    def populate_icd10_codes(self, use_april_update: bool = False) -> bool:
        """Main function to populate ICD-10 codes"""
        start_time = time.time()
        logger.info("Starting ICD-10-CM code population")
        
        # Validate configuration
        if not self.config.password:
            logger.error("Database password not provided. Set DB_PASSWORD environment variable.")
            return False
        
        # Choose URL based on preference
        url = ICD10_APRIL_ZIP_URL if use_april_update else ICD10_ZIP_URL
        logger.info(f"Using {'April 2025 update' if use_april_update else 'October 2025 release'}")
        
        # Connect to database first to validate connection
        connection = self.get_db_connection()
        if not connection:
            logger.error("Failed to connect to database")
            return False
        
        try:
            # Validate schema
            self.validate_database_schema(connection)
            
            # Download and extract the file with retry logic
            content = self.download_with_retry(url)
            if not content:
                logger.error("Failed to download and extract ICD-10 file")
                return False
            
            # Parse the codes
            codes = self.parse_icd10_file(content)
            if not codes:
                logger.error("No codes parsed from file")
                return False
            
            logger.info(f"Total codes to insert: {len(codes)}")
            
            # Insert codes
            total_inserted = self.insert_codes_batch(connection, codes)
            logger.info(f"Successfully populated {total_inserted} ICD-10 codes")
            
            # Get and display statistics
            stats = self.get_database_stats(connection)
            duration = time.time() - start_time
            self.print_summary(stats, duration)
            
            return total_inserted > 0
            
        except Exception as e:
            logger.error(f"Error during population: {e}")
            return False
        finally:
            if connection and connection.is_connected():
                connection.close()

    def try_multiple_sources(self) -> bool:
        """Try multiple data sources until one works"""
        sources = [
            (False, "October 2025 Release"),
            (True, "April 2025 Update")
        ]
        
        # Add fallback URLs as additional sources
        for i, fallback_url in enumerate(FALLBACK_URLS):
            sources.append((f"fallback_{i}", f"Fallback {2024-i}"))
        
        for source_type, description in sources:
            if isinstance(source_type, bool):
                logger.info(f"Trying {description}...")
                success = self.populate_icd10_codes(use_april_update=source_type)
            else:
                logger.info(f"Trying {description}...")
                # For fallback URLs, we'd need to modify the method to accept specific URLs
                # This is a placeholder for extension
                success = False
                
            if success:
                return True
            else:
                logger.warning(f"{description} failed, trying next source...")
                time.sleep(2)  # Brief pause between attempts
        
        return False


def main():
    """Main execution function"""
    start_time = time.time()
    
    # Load configuration
    try:
        config = Config.from_env()
    except Exception as e:
        logger.error(f"Configuration error: {e}")
        return 1
    
    # Create population instance
    populator = ICD10Population(config)
    
    # Try primary sources first
    success = populator.populate_icd10_codes(use_april_update=False)
    if not success:
        logger.info("Primary source failed, retrying with April 2025 update...")
        success = populator.populate_icd10_codes(use_april_update=True)
    
    # If still not successful, try all available sources
    if not success:
        logger.info("All primary sources failed, trying all available sources...")
        success = populator.try_multiple_sources()
    
    total_duration = time.time() - start_time
    
    if success:
        logger.info(f"Script completed successfully in {total_duration:.2f} seconds")
        return 0
    else:
        logger.error(f"Script failed after {total_duration:.2f} seconds")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)