# ICD-10-CM Data Population System - Documentation

## Overview

This document provides a detailed explanation of how ICD-10-CM (International Classification of Diseases, 10th Revision, Clinical Modification) data is populated into a MySQL database using the official April 2025 release files.

**Author:** Ngwane  
**Date:** October 7, 2025  
**Release:** ICD-10-CM April 2025

---

## File Structure

### Source Data Files

| File Name | Size | Description |
|-----------|------|-------------|
| `icd10cm-codes-April-2025.txt` | 74,261 lines | Main ICD-10-CM codes with descriptions |
| `icd10cm-order-April-2025.txt` | 97,585 lines | Hierarchical order file with billable flags |
| `icd10cm-codes-addenda-April-2025.txt` | 23 lines | Code changes summary (no changes for April 2025) |
| `icd10cm-order-addenda-April-2025.txt` | 23 lines | Order changes summary (no changes for April 2025) |
| `icd10-Order-Files-April-2025.pdf` | - | Official documentation for order files |
| `icd10cm-Codes-File-April-2025.pdf` | - | Official documentation for codes files |

### Processing Files

| File Name | Description |
|-----------|-------------|
| `populate.py` | Main Python script for database population |
| `icd10_population.log` | Processing log file with detailed execution history |

---

## Database Architecture

### Target Database Configuration

```yaml
Database Host: db-polmed.mysql.database.azure.com
Database Name: palmed_clinic_erp
Database Type: Azure MySQL
User: dbadmin
Port: 3306
```

### Database Tables

#### 1. `icd10_codes` Table

```sql
CREATE TABLE IF NOT EXISTS icd10_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(10) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    is_common TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Purpose:** Stores primary ICD-10-CM codes with descriptions and common code flags.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT | Auto-incrementing primary key |
| `code` | VARCHAR(10) | ICD-10-CM code (unique) |
| `description` | TEXT | Full description of the medical condition |
| `is_common` | TINYINT(1) | Flag for frequently used codes (1=common, 0=not common) |
| `created_at` | TIMESTAMP | Record creation timestamp |

#### 2. `icd10_order` Table

```sql
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
```

**Purpose:** Maintains hierarchical order and billing validity of ICD-10-CM codes.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT | Auto-incrementing primary key |
| `order_number` | INT | Sequential order number from official file |
| `code` | VARCHAR(10) | ICD-10-CM code |
| `valid_flag` | TINYINT(1) | Billing validity (1=billable, 0=header only) |
| `short_description` | VARCHAR(255) | Abbreviated description (up to 60 characters) |
| `long_description` | TEXT | Full description |
| `created_at` | TIMESTAMP | Record creation timestamp |

---

## Data File Formats

### Codes File Format (`icd10cm-codes-April-2025.txt`)

```
Position  Content
1-7       ICD-10-CM Code (left-justified)
8         Space
9+        Description text
```

**Example:**
```
A000    Cholera due to Vibrio cholerae 01, biovar cholerae
A001    Cholera due to Vibrio cholerae 01, biovar eltor
A009    Cholera, unspecified
```

### Order File Format (`icd10cm-order-April-2025.txt`)

```
Position  Content
1-5       Order number (5-digit, zero-padded)
6         Space
7-13      ICD-10-CM Code (left-justified)
14        Space
15        Valid flag (0=header, 1=billable)
16        Space
17-77     Short description (60 characters)
78+       Long description
```

**Example:**
```
00001 A00     0 Cholera                                                      Cholera
00002 A000    1 Cholera due to Vibrio cholerae 01, biovar cholerae           Cholera due to Vibrio cholerae 01, biovar cholerae
00003 A001    1 Cholera due to Vibrio cholerae 01, biovar eltor              Cholera due to Vibrio cholerae 01, biovar eltor
```

---

## Data Processing Pipeline

### 1. Configuration and Environment Setup

```python
@dataclass
class Config:
    host: str = 'db-polmed.mysql.database.azure.com'
    database: str = 'palmed_clinic_erp'
    user: str = 'dbadmin'
    password: str = 'Polm3d!DB@2025'
    port: int = 3306
    batch_size: int = 1000
    max_retries: int = 3
    request_timeout: int = 120
```

**Configuration Features:**
- Environment variable support for sensitive data
- Configurable batch processing size
- Retry mechanism for failed operations
- Connection timeout management

### 2. Common Medical Codes Identification

The system pre-identifies 29 frequently used medical codes for quick access:

```python
COMMON_CODES = {
    'I10',      # Essential hypertension
    'E11.9',    # Type 2 diabetes without complications  
    'J44.9',    # COPD, unspecified
    'M79.3',    # Panniculitis, unspecified
    'R51',      # Headache
    'K21.9',    # Gastro-esophageal reflux disease
    'J06.9',    # Acute upper respiratory infection
    'N39.0',    # Urinary tract infection
    'M54.5',    # Low back pain
    'E78.5',    # Hyperlipidemia, unspecified
    # ... and 19 more common codes
}
```

### 3. Data Parsing Process

#### Codes File Parsing
1. **Read** `icd10cm-codes-April-2025.txt` line by line
2. **Extract** code (positions 1-7) and description (position 8+)
3. **Validate** code format using regex `^[A-Za-z0-9]`
4. **Flag** common codes with `is_common = 1`
5. **Store** in memory for batch processing

#### Order File Parsing
1. **Read** `icd10cm-order-April-2025.txt` line by line
2. **Extract** structured data:
   - Order number (positions 1-5)
   - Code (positions 7-13)
   - Valid flag (position 15)
   - Short description (positions 17-77)
   - Long description (position 78+)
3. **Validate** numeric fields and handle parsing errors
4. **Store** in memory for batch processing

### 4. Batch Processing Strategy

**Advantages of Batch Processing:**
- **Performance:** Reduces database round trips
- **Memory Management:** Processes large datasets efficiently
- **Error Recovery:** Isolated failure handling per batch
- **Progress Tracking:** Real-time insertion monitoring

**Processing Flow:**
```
Total Records → Batches of 1,000 → Database Insertion → Progress Logging
    ↓               ↓                      ↓                ↓
  74,260        74 batches           MySQL INSERT    "Inserted X/Y records"
```

### 5. Database Operations

#### Insert Strategy for Codes
```sql
INSERT INTO icd10_codes (code, description, is_common)
VALUES (%s, %s, %s)
ON DUPLICATE KEY UPDATE 
    description=VALUES(description),
    is_common=VALUES(is_common);
```

**Features:**
- **Idempotent:** Safe to run multiple times
- **Update on Conflict:** Handles duplicate codes gracefully
- **Batch Execution:** Uses `executemany()` for efficiency

#### Insert Strategy for Order Records
```sql
INSERT INTO icd10_order (
    order_number, code, valid_flag, short_description, long_description
) VALUES (%s, %s, %s, %s, %s)
ON DUPLICATE KEY UPDATE 
    valid_flag=VALUES(valid_flag),
    short_description=VALUES(short_description),
    long_description=VALUES(long_description);
```

### 6. Error Handling and Recovery

**Multi-Level Error Handling:**

1. **Connection Level:**
   - Database connectivity validation
   - Automatic reconnection attempts
   - Graceful connection closure

2. **Batch Level:**
   - Transaction rollback on batch failure
   - Retry mechanism (up to 3 attempts)
   - 2-second delay between retries

3. **Record Level:**
   - Invalid record logging and skipping
   - Parsing error handling
   - Data validation checks

### 7. Logging and Monitoring

**Comprehensive Logging System:**

```python
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),      # Console output
        logging.FileHandler('icd10_population.log')  # File output
    ]
)
```

**Log Events:**
- Database connection status
- File parsing progress
- Batch insertion progress
- Error conditions and recovery
- Final completion statistics

---

## Data Statistics

### April 2025 Release Summary

| Metric | Count |
|--------|-------|
| **Total ICD-10-CM Codes** | 74,260 |
| **Total Order Records** | 97,585 |
| **Billable Codes** | ~74,260 |
| **Header Records** | ~23,325 |
| **Common Codes Flagged** | 29 |
| **Code Additions** | 0 |
| **Code Deletions** | 0 |
| **Code Revisions** | 0 |

### File Processing Performance

| Operation | Records | Batch Size | Estimated Time |
|-----------|---------|------------|----------------|
| **Code Parsing** | 74,260 | - | ~1-2 seconds |
| **Order Parsing** | 97,585 | - | ~2-3 seconds |
| **Code Insertion** | 74,260 | 1,000 | ~2-5 minutes |
| **Order Insertion** | 97,585 | 1,000 | ~3-7 minutes |

---

## Data Relationships and Usage

### Hierarchical Structure

The ICD-10-CM system maintains a hierarchical structure:

```
A00-A09    Intestinal infectious diseases
├── A00     Cholera (Header, valid_flag=0)
│   ├── A000  Cholera due to Vibrio cholerae 01, biovar cholerae (valid_flag=1)
│   ├── A001  Cholera due to Vibrio cholerae 01, biovar eltor (valid_flag=1)
│   └── A009  Cholera, unspecified (valid_flag=1)
└── A01     Typhoid and paratyphoid fevers (Header, valid_flag=0)
    └── A010  Typhoid fever (Header, valid_flag=0)
        ├── A0100  Typhoid fever, unspecified (valid_flag=1)
        ├── A0101  Typhoid meningitis (valid_flag=1)
        └── A0102  Typhoid fever with heart involvement (valid_flag=1)
```

### Clinical Application Integration

**Common Use Cases:**
1. **Medical Billing:** Use `valid_flag=1` codes for insurance claims
2. **Diagnosis Selection:** Priority display of `is_common=1` codes
3. **Code Lookup:** Fast search using indexed `code` field
4. **Hierarchical Browsing:** Navigate using `order_number` sequence
5. **Clinical Documentation:** Reference both short and long descriptions

### Query Examples

**Find Common Codes:**
```sql
SELECT code, description 
FROM icd10_codes 
WHERE is_common = 1 
ORDER BY code;
```

**Get Billable Codes Only:**
```sql
SELECT DISTINCT code, short_description 
FROM icd10_order 
WHERE valid_flag = 1 
ORDER BY order_number;
```

**Hierarchical Code Browse:**
```sql
SELECT order_number, code, valid_flag, short_description
FROM icd10_order 
WHERE code LIKE 'A0%'
ORDER BY order_number;
```

---

## Current System Status

### Execution History

Based on the log file (`icd10_population.log`), the system has encountered database schema issues:

**Error Pattern:**
```
ERROR - Insert error: 1054 (42S22): Unknown column 'code' in 'field list'
```

**Root Cause Analysis:**
1. **Schema Mismatch:** Target database tables have different column structure
2. **Permission Issues:** Limited database modification rights
3. **Database State:** Tables may exist with legacy column names

### Recommended Actions

1. **Database Schema Verification:**
   ```sql
   DESCRIBE icd10_codes;
   DESCRIBE icd10_order;
   ```

2. **Column Mapping Check:**
   - Verify actual column names in target tables
   - Update SQL queries to match existing schema
   - Consider table recreation if permitted

3. **Environment Validation:**
   - Confirm database connection parameters
   - Verify user permissions for DDL operations
   - Test connection with simple queries

---

## System Benefits

### Clinical Workflow Enhancement
- **Fast Code Lookup:** Indexed searches on 74K+ codes
- **Smart Prioritization:** Common codes flagged for quick access
- **Billing Accuracy:** Valid flag prevents non-billable code usage
- **Hierarchical Navigation:** Structured code browsing

### Data Management
- **Idempotent Operations:** Safe to re-run population scripts
- **Version Control:** April 2025 release tracking
- **Change Management:** Addenda files track code modifications
- **Audit Trail:** Comprehensive logging for compliance

### Technical Architecture
- **Scalable Design:** Batch processing handles large datasets
- **Error Resilience:** Multi-level error handling and recovery
- **Performance Optimized:** Strategic indexing and batch operations
- **Cloud Ready:** Azure MySQL integration

---

## Conclusion

This ICD-10-CM data population system provides a robust, scalable solution for managing medical coding data in clinical applications. The system processes official CMS releases, maintains data integrity, and supports efficient clinical workflows through intelligent code flagging and hierarchical organization.

The April 2025 release contains 74,260 codes with no changes from the previous version, ensuring stability for existing medical applications while providing a solid foundation for clinical documentation and billing processes.

---

**Last Updated:** October 7, 2025  
**Version:** April 2025 Release  
**Contact:** Ngwane (System Administrator)