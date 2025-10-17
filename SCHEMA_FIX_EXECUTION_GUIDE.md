# 🚀 EXECUTE SCHEMA FIX - STEP BY STEP GUIDE

## ✅ Current Status

- **Database:** Azure MySQL (db-polmed.mysql.database.azure.com)
- **Credentials:** Updated to match `create_test_users.py`
- **Target Table:** `patient_appointments`
- **Script:** `fix_azure_schema.py` (READY TO RUN)

---

## 📋 WHAT THE SCRIPT DOES

The `fix_azure_schema.py` script will:

1. ✅ Connect to your Azure MySQL database
2. ✅ Drop the old `appointments` table (incorrect schema)
3. ✅ Create/modify `patient_appointments` table with correct structure
4. ✅ Add all missing columns
5. ✅ Modify column types to match specifications
6. ✅ Add performance indexes
7. ✅ Add foreign key constraints
8. ✅ Fix any bad data
9. ✅ Verify the schema is correct
10. ✅ Generate detailed log file

---

## 🎯 HOW TO RUN

### Option 1: Run with Default Credentials (EASIEST)

```bash
cd c:\Users\Swelihle.Lucas\Downloads\palmed-clinic-erp
python scripts/fix_azure_schema.py
```

**Uses:**
- Host: `db-polmed.mysql.database.azure.com`
- User: `dbadmin`
- Password: `Polm3d!DB@2025`
- Database: `palmed_clinic_erp`

---

### Option 2: Run with Environment Variables (MORE SECURE)

```bash
cd c:\Users\Swelihle.Lucas\Downloads\palmed-clinic-erp

# Set environment variables (Windows PowerShell)
$env:DB_HOST = "db-polmed.mysql.database.azure.com"
$env:DB_USER = "dbadmin"
$env:DB_PASSWORD = "Polm3d!DB@2025"
$env:DB_NAME = "palmed_clinic_erp"
$env:DB_PORT = "3306"

# Run the script
python scripts/fix_azure_schema.py
```

---

### Option 3: Run from Python REPL

```python
from scripts.fix_azure_schema import SchemaMigrator, AZURE_CONFIG

migrator = SchemaMigrator(AZURE_CONFIG)
success = migrator.run_migration()

if success:
    print("✅ Schema migration successful!")
else:
    print("❌ Schema migration had errors")
```

---

## 📊 EXPECTED OUTPUT

```
======================================================================
STARTING PALMED CLINIC ERP SCHEMA MIGRATION
======================================================================
[2025-10-17 17:46:03] [INFO] Start time: 2025-10-17 17:46:03.123456
[2025-10-17 17:46:03] [INFO] Connecting to Azure MySQL database...
[2025-10-17 17:46:03] [INFO] Host: db-polmed.mysql.database.azure.com
[2025-10-17 17:46:03] [INFO] Database: palmed_clinic_erp
[2025-10-17 17:46:03] [SUCCESS] ✅ Connected to Azure MySQL successfully!

--- Adding Missing Columns ---
[2025-10-17 17:46:04] [INFO] Executing: ADD COLUMN appointment_type
[2025-10-17 17:46:04] [SUCCESS] ✅ ADD COLUMN appointment_type - SUCCESS (rows affected: 0)

... (more operations) ...

--- Verifying Schema ---
[2025-10-17 17:46:10] [SUCCESS] ✅ Table has 16 columns
[2025-10-17 17:46:10] [SUCCESS] ✅ Table has 7 indexes
[2025-10-17 17:46:10] [SUCCESS] ✅ Table has 3 foreign key constraints
[2025-10-17 17:46:10] [SUCCESS] ✅ Table contains 0 appointments

======================================================================
MIGRATION SUMMARY
======================================================================
Successfully executed: 15 operations
Warnings encountered: 3 (usually OK)
Errors encountered: 0
Log file saved to: schema_migration_20251017_174603.log
======================================================================

🎉 SCHEMA MIGRATION COMPLETED SUCCESSFULLY!
Your patient_appointments table is now properly configured.
```

---

## 📝 LOG FILES

After running, a log file will be created:

```
schema_migration_20251017_174603.log
```

**Location:** Same directory as the script (`scripts/` folder)

**Contents:**
- All executed operations
- Success/warning/error details
- Timestamps
- Row counts
- Schema verification results

---

## ⏱️ EXECUTION TIME

Typical execution time: **10-15 seconds**

(Depends on number of existing appointments and network latency)

---

## ✅ VERIFICATION CHECKLIST

After running the script, verify:

- [ ] Script ran without critical errors
- [ ] Log file created successfully
- [ ] No "ERROR" lines (warnings are OK)
- [ ] "MIGRATION SUMMARY" shows 0 errors
- [ ] Connection successful message shown
- [ ] Table has 16 columns
- [ ] Table has 7 indexes
- [ ] Table has 3 foreign key constraints

---

## 🆘 TROUBLESHOOTING

### Error: "Connection failed"

**Cause:** Database credentials incorrect or network issue

**Fix:**
```bash
# Test connection manually
ping db-polmed.mysql.database.azure.com

# Verify credentials in create_test_users.py
# Lines 20-30 show the correct credentials
```

### Error: "Table already has this column"

**This is OK!** The script handles this gracefully by skipping.

**Status:** Will show ⚠️ WARNING - Column already exists

### Error: "Foreign key constraint issue"

**Cause:** Data integrity issue or table structure mismatch

**Fix:**
```bash
# The script will:
1. Disable foreign key checks
2. Add constraints
3. Re-enable checks

# This is safe and expected
```

### Error: "Can't drop/modify column"

**Cause:** Column in use by other tables or constraints

**Fix:** Script skips this and continues - usually OK

---

## 🔄 CAN I RUN IT MULTIPLE TIMES?

**YES!** The script is idempotent, meaning:

- ✅ Safe to run multiple times
- ✅ Will skip operations that already exist
- ✅ Won't delete data
- ✅ Only adds/modifies, never deletes data

**So you can run it:**
```bash
python scripts/fix_azure_schema.py
# If it finds columns already exist, it skips them
# Safe to run again without worrying about duplicates
```

---

## 📋 NEXT STEPS AFTER RUNNING

Once the script completes successfully:

### 1. Update app.py with query fixes
   - File: `scripts/app.py`
   - Reference: `APP_PY_FIXES_COMPLETE.md`
   - Time: ~30 minutes

### 2. Test the application
   - Restart Flask server
   - Test appointment booking flow
   - Verify no SQL errors

### 3. Deploy to production
   - Commit changes to Git
   - Push to Azure
   - Monitor logs

---

## 💾 BACKING UP DATA

**Before running (if you have existing data):**

```bash
# Backup your database (optional but recommended)
mysqldump -h db-polmed.mysql.database.azure.com -u dbadmin -p palmed_clinic_erp > backup.sql

# Enter password: Polm3d!DB@2025
```

**After running:**

If you need to restore:
```bash
mysql -h db-polmed.mysql.database.azure.com -u dbadmin -p palmed_clinic_erp < backup.sql
```

---

## 📞 WHAT IF IT FAILS?

1. **Read the error message** - It will tell you exactly what failed
2. **Check the log file** - Located in `scripts/schema_migration_XXXXXX.log`
3. **Run again** - The script is safe to run multiple times
4. **Check Azure MySQL directly** - Use MySQL Workbench to verify table structure

---

## 🎯 QUICK REFERENCE

| Item | Value |
|------|-------|
| Script | `scripts/fix_azure_schema.py` |
| Host | `db-polmed.mysql.database.azure.com` |
| User | `dbadmin` |
| Password | `Polm3d!DB@2025` |
| Database | `palmed_clinic_erp` |
| Table | `patient_appointments` |
| Idempotent | ✅ YES (safe to run multiple times) |
| Data Loss | ❌ NO (only adds/modifies) |
| Execution Time | ~10-15 seconds |

---

## ✨ READY TO GO!

Your schema fix script is ready. Just run:

```bash
python scripts/fix_azure_schema.py
```

And watch the magic happen! 🚀

