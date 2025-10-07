"""
ICD-10-CM Code Population Script - ENHANCED (April 2025)
---------------------------------------------------------
Populates ICD-10-CM Codes and Order data into MySQL 
using official April 2025 release files.

Author: Ngwane
Date: 2025-10-07
"""

import mysql.connector
from mysql.connector import Error
import os
import logging
import re
from typing import List, Dict, Optional
from dataclasses import dataclass
import time
import sys

# ---------------------------------------------------------------------
# LOGGING CONFIGURATION
# ---------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('icd10_population.log')
    ]
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------
# CONFIGURATION CLASS
# ---------------------------------------------------------------------
@dataclass
class Config:
    """Configuration for MySQL and batch process"""
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
            password=os.environ.get('DB_PASSWORD', 'Transport@2025'),
            port=int(os.environ.get('DB_PORT', 3306)),
            batch_size=int(os.environ.get('BATCH_SIZE', 1000)),
            max_retries=int(os.environ.get('MAX_RETRIES', 3)),
            request_timeout=int(os.environ.get('REQUEST_TIMEOUT', 120))
        )


# ---------------------------------------------------------------------
# COMMON ICD-10-CM CODES TO FLAG AS FREQUENTLY USED
# ---------------------------------------------------------------------
COMMON_CODES = {
    'I10', 'E11.9', 'J44.9', 'M79.3', 'R51', 'K21.9', 'J06.9', 'N39.0',
    'M54.5', 'E78.5', 'J45.909', 'F41.9', 'K59.00', 'R10.9', 'M25.50',
    'J02.9', 'R50.9', 'J18.9', 'N18.9', 'E66.9', 'F32.9', 'M19.90',
    'J20.9', 'R05', 'K29.70', 'R42', 'M62.81', 'J30.9', 'R53.83'
}


# ---------------------------------------------------------------------
# MAIN CLASS FOR POPULATION
# ---------------------------------------------------------------------
class ICD10Population:
    """Main class for ICD-10-CM data population"""

    def __init__(self, config: Config):
        self.config = config
        self.conn = None

    # -----------------------------------------------------------------
    def connect(self):
        """Establish MySQL connection"""
        try:
            self.conn = mysql.connector.connect(
                host=self.config.host,
                user=self.config.user,
                password=self.config.password,
                database=self.config.database,
                port=self.config.port
            )
            if self.conn.is_connected():
                logger.info("✅ Connected to MySQL database.")
        except Error as e:
            logger.error(f"MySQL connection error: {e}")
            sys.exit(1)

    # -----------------------------------------------------------------
    def create_tables(self):
        """Create required ICD-10 tables if not exist"""
        cursor = self.conn.cursor()

        # Codes table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS icd10_codes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            code VARCHAR(10) NOT NULL UNIQUE,
            description TEXT NOT NULL,
            is_common TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX(code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)

        # Order table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS icd10_order (
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_number INT NOT NULL,
            code VARCHAR(10) NOT NULL,
            valid_flag TINYINT(1) NOT NULL,
            short_description VARCHAR(255),
            long_description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX(code),
            INDEX(order_number)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)

        self.conn.commit()
        logger.info("Tables `icd10_codes` and `icd10_order` verified or created.")

    # -----------------------------------------------------------------
    def parse_icd10_codes_file(self, file_path: str) -> List[Dict[str, str]]:
        """Parse ICD-10-CM Codes file (April 2025 format)"""
        codes = []
        logger.info(f"Parsing ICD-10-CM Codes file: {file_path}")

        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or not re.match(r"^[A-Za-z0-9]", line):
                    continue

                code = line[:7].strip()
                description = line[8:].strip()

                if len(code) >= 3:
                    codes.append({
                        "code": code,
                        "description": description,
                        "is_common": 1 if code in COMMON_CODES else 0
                    })

        logger.info(f"Parsed {len(codes):,} code records.")
        return codes

    # -----------------------------------------------------------------
    def parse_icd10_order_file(self, file_path: str) -> List[Dict[str, str]]:
        """Parse ICD-10-CM Order file (April 2025 format)"""
        records = []
        logger.info(f"Parsing ICD-10-CM Order file: {file_path}")

        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.rstrip()
                if not line or not re.match(r"^\d", line):
                    continue

                try:
                    order_number = int(line[0:5].strip())
                    code = line[6:13].strip()
                    valid_flag = int(line[14:15].strip()) if line[14:15].strip().isdigit() else 0
                    short_desc = line[17:77].strip()
                    long_desc = line[78:].strip()

                    if code:
                        records.append({
                            "order_number": order_number,
                            "code": code,
                            "valid_flag": valid_flag,
                            "short_description": short_desc,
                            "long_description": long_desc
                        })
                except Exception as e:
                    logger.warning(f"Skipped line due to parse error: {e}")

        logger.info(f"Parsed {len(records):,} order records.")
        return records

    # -----------------------------------------------------------------
    def insert_codes(self, codes: List[Dict[str, str]]):
        """Batch insert ICD-10-CM codes"""
        cursor = self.conn.cursor()
        query = """
        INSERT INTO icd10_codes (code, description, is_common)
        VALUES (%s, %s, %s)
        ON DUPLICATE KEY UPDATE description=VALUES(description),
        is_common=VALUES(is_common);
        """

        total = len(codes)
        batch_size = self.config.batch_size
        inserted = 0

        for i in range(0, total, batch_size):
            batch = codes[i:i + batch_size]
            params = [(c["code"], c["description"], c["is_common"]) for c in batch]
            try:
                cursor.executemany(query, params)
                self.conn.commit()
                inserted += len(batch)
                logger.info(f"Inserted {inserted}/{total} ICD-10 codes.")
            except Error as e:
                logger.error(f"Insert error: {e}")
                self.conn.rollback()
                time.sleep(2)

        logger.info("✅ All ICD-10-CM codes inserted successfully.")

    # -----------------------------------------------------------------
    def insert_order(self, records: List[Dict[str, str]]):
        """Batch insert ICD-10-CM order records"""
        cursor = self.conn.cursor()
        query = """
        INSERT INTO icd10_order (
            order_number, code, valid_flag, short_description, long_description
        ) VALUES (%s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE 
            valid_flag=VALUES(valid_flag),
            short_description=VALUES(short_description),
            long_description=VALUES(long_description);
        """

        total = len(records)
        batch_size = self.config.batch_size
        inserted = 0

        for i in range(0, total, batch_size):
            batch = records[i:i + batch_size]
            params = [
                (
                    r["order_number"],
                    r["code"],
                    r["valid_flag"],
                    r["short_description"],
                    r["long_description"]
                )
                for r in batch
            ]
            try:
                cursor.executemany(query, params)
                self.conn.commit()
                inserted += len(batch)
                logger.info(f"Inserted {inserted}/{total} order records.")
            except Error as e:
                logger.error(f"Order insert error: {e}")
                self.conn.rollback()
                time.sleep(2)

        logger.info("✅ All ICD-10-CM order records inserted successfully.")

    # -----------------------------------------------------------------
    def run(self, codes_file: str, order_file: str):
        """Main execution pipeline"""
        self.connect()
        self.create_tables()

        codes = self.parse_icd10_codes_file(codes_file)
        self.insert_codes(codes)

        orders = self.parse_icd10_order_file(order_file)
        self.insert_order(orders)

        if self.conn and self.conn.is_connected():
            self.conn.close()
            logger.info("MySQL connection closed.")


# ---------------------------------------------------------------------
# MAIN EXECUTION
# ---------------------------------------------------------------------
if __name__ == "__main__":
    config = Config.from_env()

    # Point to your local ICD-10 files (uploaded in this project directory)
    CODES_FILE = "icd10cm-codes-April-2025.txt"
    ORDER_FILE = "icd10cm-order-April-2025.txt"

    population = ICD10Population(config)
    population.run(CODES_FILE, ORDER_FILE)
