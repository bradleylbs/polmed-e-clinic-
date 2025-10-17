# 🐍 AZURE SCHEMA FIX SCRIPT - USAGE GUIDE

## Overview

The `fix_azure_schema.py` script automatically connects to your Azure MySQL database and applies all schema fixes in one go.

**Status:** Ready to use ✅

---

## 🚀 QUICK START

### 1. Install MySQL Connector (One Time)

```bash
pip install mysql-connector-python
```

### 2. Run the Script

```bash
python scripts/fix_azure_schema.py
```

### 3. Watch It Fix Everything! ✨

---

## 📋 WHAT THE SCRIPT DOES

✅ Connects to Azure MySQL database  
✅ Checks if `patient_appointments` table exists  
✅ Makes `patient_id` nullable  
✅ Makes `booking_reference` nullable  
✅ Makes `route_location_id` NOT NULL  
✅ Fixes `status` to correct ENUM values  
✅ Ensures `appointment_duration` has proper default  
✅ Adds 6 performance indexes  
✅ Adds unique constraint on `booking_reference`  
✅ Adds 3 foreign key constraints  
✅ Fixes invalid status values in existing data  
✅ Cleans empty strings to NULL  
✅ Verifies data integrity  
✅ Displays final schema and statistics  
✅ Logs everything to a file  

---

## 🔒 SECURITY NOTE

The script currently has the password hardcoded:

```python
'password': 'Palmed@2024Clinic!',
```

**⚠️ FOR PRODUCTION:**

Option 1: Use environment variables
```python
import os
'password': os.getenv('AZURE_MYSQL_PASSWORD'),
```

Then set in terminal:
```bash
$env:AZURE_MYSQL_PASSWORD = "Palmed@2024Clinic!"
```

Option 2: Use Azure Key Vault
```python
from azure.keyvault.secrets import SecretClient
# Fetch password from Key Vault
```

Option 3: Use config file (not in Git!)
```python
import json
with open('.secrets.json') as f:
    config = json.load(f)
```

---

## 📊 SCRIPT OUTPUT

When you run the script, you'll see:

```
[2025-10-17 17:50:15] [INFO] Connecting to Azure MySQL database...
[2025-10-17 17:50:16] [SUCCESS] ✅ Connected to Azure MySQL successfully!
[2025-10-17 17:50:16] [INFO] Retrieving current table structure...
[2025-10-17 17:50:16] [INFO] Found 16 columns in table
[2025-10-17 17:50:16] [INFO] ======================================================================
[2025-10-17 17:50:16] [INFO] APPLYING SCHEMA FIXES
[2025-10-17 17:50:16] [INFO] ======================================================================
[2025-10-17 17:50:16] [INFO] Executing: Make patient_id nullable
[2025-10-17 17:50:17] [SUCCESS] ✅ Make patient_id nullable - SUCCESS
[2025-10-17 17:50:17] [INFO] Executing: Make booking_reference nullable
[2025-10-17 17:50:17] [SUCCESS] ✅ Make booking_reference nullable - SUCCESS
[2025-10-17 17:50:17] [INFO] Executing: Make route_location_id NOT NULL
[2025-10-17 17:50:17] [SUCCESS] ✅ Make route_location_id NOT NULL - SUCCESS
[2025-10-17 17:50:17] [INFO] Executing: Fix status ENUM values
[2025-10-17 17:50:17] [SUCCESS] ✅ Fix status ENUM values - SUCCESS
[2025-10-17 17:50:17] [INFO] Executing: Fix appointment_duration default
[2025-10-17 17:50:17] [SUCCESS] ✅ Fix appointment_duration default - SUCCESS
[2025-10-17 17:50:17] [INFO] Executing: Add index: idx_route_location_id
[2025-10-17 17:50:17] [SUCCESS] ✅ Add index: idx_route_location_id - SUCCESS
...
[2025-10-17 17:50:20] [SUCCESS] ======================================================================
[2025-10-17 17:50:20] [SUCCESS] MIGRATION COMPLETED SUCCESSFULLY! ✅
[2025-10-17 17:50:20] [SUCCESS] Operations completed: 15
[2025-10-17 17:50:20] [SUCCESS] ======================================================================
[2025-10-17 17:50:20] [INFO] Log file: schema_migration_20251017_175015.log
```

---

## 📁 LOG FILES

The script creates a timestamped log file:

```
schema_migration_20251017_175015.log
schema_migration_20251017_180530.log
schema_migration_20251017_181045.log
```

These are saved in the **current working directory** (usually the project root).

### View the log:

```bash
# Windows PowerShell
Get-Content schema_migration_*.log | Select-Object -Last 50

# Or just open in VS Code
code schema_migration_20251017_175015.log
```

---

## ✅ VERIFICATION AFTER RUNNING

### Check the schema manually:

```sql
-- In MySQL Workbench
DESCRIBE `patient_appointments`;

-- Or see all details
SELECT 
    COLUMN_NAME, 
    COLUMN_TYPE, 
    IS_NULLABLE, 
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'palmed_clinic_erp' 
AND TABLE_NAME = 'patient_appointments'
ORDER BY ORDINAL_POSITION;
```

### Check indexes:

```sql
SELECT 
    INDEX_NAME, 
    COLUMN_NAME, 
    SEQ_IN_INDEX
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = 'palmed_clinic_erp' 
AND TABLE_NAME = 'patient_appointments'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;
```

### Check foreign keys:

```sql
SELECT 
    CONSTRAINT_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = 'palmed_clinic_erp' 
AND TABLE_NAME = 'patient_appointments'
AND REFERENCED_TABLE_NAME IS NOT NULL;
```

---

## 🆘 TROUBLESHOOTING

### Error: "Connection refused"

**Problem:** Can't connect to Azure MySQL

**Fix:**
1. Check your IP is whitelisted in Azure firewall
2. Verify credentials in the script
3. Test connection in MySQL Workbench first

### Error: "Unknown database 'palmed_clinic_erp'"

**Problem:** Wrong database name

**Fix:**
- Verify database name in Azure portal
- Update in the script:
  ```python
  'database': 'correct_db_name',
  ```

### Error: "Table 'patient_appointments' doesn't exist"

**Problem:** Table hasn't been created yet

**Fix:**
- Run the SQL creation script first
- Or restore from backup

### Error: "Access denied for user"

**Problem:** Wrong password or username

**Fix:**
- Update credentials in script
- Verify with Azure portal
- Format is usually: `username@servername`

### Script runs but nothing changes

**Problem:** Columns or indexes already exist (not an error!)

**Solution:** This is normal! The script checks before adding, so if things already exist, it skips them. Check the log file for "already exists" messages.

---

## 🚀 RUNNING THE SCRIPT STEP BY STEP

### Step 1: Activate Virtual Environment

```bash
# Windows PowerShell
& 'C:/Users/Swelihle.Lucas/Downloads/palmed-clinic-erp/.venv/Scripts/Activate.ps1'

# Or on Mac/Linux
source venv/bin/activate
```

### Step 2: Install dependencies

```bash
pip install mysql-connector-python
```

### Step 3: Run the script

```bash
python scripts/fix_azure_schema.py
```

### Step 4: Check output

Look for:
- ✅ GREEN = Success
- ❌ RED = Error
- ⚠️ YELLOW = Warning

### Step 5: Review log file

```bash
# List all log files
Get-ChildItem schema_migration_*.log

# View the latest one
Get-Content (Get-ChildItem schema_migration_*.log | Sort-Object LastWriteTime -Descending | Select-Object -First 1)
```

---

## 🔄 RUN MULTIPLE TIMES?

It's safe to run the script multiple times:
- ✅ Already-added columns: Skipped
- ✅ Already-added indexes: Skipped
- ✅ Already-added FKs: Skipped
- ✅ Data fixes: Applied each time (idempotent)

So if something fails partway through, just re-run the script!

---

## 📊 WHAT GETS FIXED

### Before Running Script

```sql
-- ❌ Problems:
patient_id: NOT NULL (can't create slots before booking)
booking_reference: NOT NULL (can't insert NULL)
route_location_id: DEFAULT NULL (dangerous for queries)
status: WRONG ENUM values
appointment_duration: No default
NO indexes on route_location_id (BAD for performance!)
NO foreign key to route_locations
```

### After Running Script

```sql
-- ✅ Fixed:
patient_id: DEFAULT NULL (correct!)
booking_reference: DEFAULT NULL (correct!)
route_location_id: NOT NULL (required!)
status: ('Available','Booked','Confirmed','Completed','Cancelled','NoShow')
appointment_duration: DEFAULT 30 minutes
6 new indexes for performance
3 foreign keys for data integrity
```

---

## 💡 NEXT STEPS AFTER RUNNING

1. **Verify schema:** Run checks above
2. **Update app.py:** Use the APP_PY_FIXES_COMPLETE.md guide
3. **Test locally:** Start Flask server, test booking flow
4. **Commit changes:** Push to Git
5. **Deploy:** Push to Azure Static Web Apps

---

## 🎯 SUMMARY

| Task | Status |
|------|--------|
| Script created | ✅ |
| Connects to Azure | ✅ |
| Fixes schema | ✅ |
| Adds indexes | ✅ |
| Adds foreign keys | ✅ |
| Fixes data | ✅ |
| Logs everything | ✅ |
| Handles errors | ✅ |
| Safe to re-run | ✅ |

**Ready to use! Just run:** `python scripts/fix_azure_schema.py`

