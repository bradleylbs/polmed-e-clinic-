# URGENT: Schema Migration - Execute Before Deploying Stored Procedures ⚠️

## Summary

Your SQL database structure had a **CRITICAL MISMATCH** with the stored procedures:

### The Problem ❌
- Your `appointments` table exists but is **missing 2 critical columns**:
  1. `route_location_id` - Links appointments to specific route/location/date
  2. `booking_reference` - Confirmation number for patients

- Stored procedures expect a table named `patient_appointments` (with these columns)
- The procedures will **FAIL to execute** without this schema fix

### The Solution ✅
Run the migration script to:
1. Add the missing columns
2. Rename table to `patient_appointments`
3. Update status defaults and indexes
4. Configure proper foreign keys

---

## 🚀 How to Execute the Migration

### Option A: Run the Automated Script (RECOMMENDED)

**Prerequisites:**
- Python 3.8+ installed
- `.env` file with database credentials

**Execute:**
```powershell
# Navigate to project folder
cd "c:\Users\Swelihle.Lucas\Downloads\palmed-clinic-erp"

# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Run migration script
python scripts/migrate_appointments_schema.py
```

**Expected Output:**
```
======================================================================
POLMED CLINIC ERP - PATIENT APPOINTMENTS TABLE MIGRATION
======================================================================
Started: 2025-10-17 17:45:30

Connecting to db-polmed.mysql.database.azure.com...
✓ Connected to database

======================================================================
STEP 1: Verify existing 'appointments' table
======================================================================
✓ Found 'appointments' table

[... more steps ...]

======================================================================
STEP 13: Verify final 'patient_appointments' table structure
======================================================================

Final columns:
  - id                         int(11)                    NOT NULL     ✓ 
  - route_location_id          int(11)                    NOT NULL     ✓ CRITICAL
  - appointment_date           date                       NOT NULL     ✓ 
  - appointment_time           time                       NOT NULL     ✓ 
  - appointment_duration       int(11)                    NULL         ✓ 
  - booking_reference          varchar(50)                NULL         ✓ CRITICAL
  - status                     varchar(50)                NULL         ✓ 
  - patient_id                 int(11)                    NULL         ✓ 
  - notes                      longtext                   NULL         ✓ 
  - created_by                 int(11)                    NULL         ✓ 
  - created_at                 timestamp                  NULL         ✓ 
  - updated_at                 timestamp                  NULL         ✓ 

======================================================================
✓ SCHEMA MIGRATION COMPLETED SUCCESSFULLY!
======================================================================
Completed: 2025-10-17 17:45:32
```

### Option B: Manual SQL Execution

If you prefer to execute directly in MySQL:

1. **Open MySQL Workbench** or Azure Data Studio
2. **Connect** to: `db-polmed.mysql.database.azure.com`
3. **Copy and paste** the SQL from `DATABASE_SCHEMA_ALIGNMENT_VERIFICATION.md` → Section 4 → Option 1
4. **Execute** the script

---

## ✅ Verification After Migration

### Check 1: Table Exists
```powershell
mysql -h db-polmed.mysql.database.azure.com -u dbadmin -p palmed_clinic_erp -e "SHOW TABLES LIKE 'patient_appointments'"
```

Expected: `patient_appointments` table should appear

### Check 2: Column Structure
```powershell
mysql -h db-polmed.mysql.database.azure.com -u dbadmin -p palmed_clinic_erp -e "DESCRIBE patient_appointments"
```

Expected output should include:
- ✅ `id` (int, PRIMARY KEY)
- ✅ `route_location_id` (int, FOREIGN KEY to route_locations)
- ✅ `appointment_date` (date)
- ✅ `appointment_time` (time)
- ✅ `booking_reference` (varchar, UNIQUE)
- ✅ `status` (varchar, DEFAULT 'Available')
- ✅ `patient_id` (int, nullable)

### Check 3: Foreign Keys
```powershell
mysql -h db-polmed.mysql.database.azure.com -u dbadmin -p palmed_clinic_erp -e "SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_NAME='patient_appointments' AND CONSTRAINT_SCHEMA='palmed_clinic_erp'"
```

Expected foreign keys:
- `fk_appointments_route_location` → `route_locations.id`
- `fk_appointments_patient` → `patients.id` (if exists)

### Check 4: Test Stored Procedure
```sql
-- Test sp_generate_appointment_slots with a test route_location_id
CALL sp_generate_appointment_slots(1, @slot_count);
SELECT @slot_count AS slots_created;

-- Should show: slots_created = (number of slots created, e.g., 40)
```

If this succeeds: ✅ Schema is now compatible with stored procedures

---

## 📊 Before & After Comparison

### BEFORE (❌ Broken)
```
appointments table:
- id
- patient_id (NOT NULL - wrong!)
- location_id
- appointment_date
- appointment_time
- status (default 'Booked' - wrong!)
- Missing: route_location_id (REQUIRED by procedures)
- Missing: booking_reference (REQUIRED by booking flow)

Stored procedures would FAIL because:
✗ INSERT INTO patient_appointments fails (table doesn't exist)
✗ JOIN on route_location_id fails (column doesn't exist)
```

### AFTER (✅ Fixed)
```
patient_appointments table:
- id
- route_location_id ✅ (foreign key to route_locations)
- appointment_date
- appointment_time
- appointment_duration
- booking_reference ✅ (unique confirmation number)
- status (default 'Available' ✅)
- patient_id (nullable ✅)
- created_at
- updated_at

Stored procedures will now WORK because:
✅ INSERT INTO patient_appointments succeeds (table exists)
✅ JOIN on route_location_id succeeds (column exists)
✅ booking_reference starts NULL, updated on booking
✅ Status starts 'Available', changes on booking
```

---

## 🔄 Complete Data Flow (After Migration)

```
STAFF CREATES ROUTE
├─ POST /api/routes
├─ Backend: create_route()
├─ CALL sp_generate_appointment_slots(route_location_id, @count)
├─ Procedure: INSERT INTO patient_appointments
│  ├─ route_location_id ✅ (exists now)
│  ├─ appointment_date
│  ├─ appointment_time
│  ├─ appointment_duration
│  ├─ status = 'Available' ✅ (correct default)
│  ├─ booking_reference = NULL ✅
│  └─ patient_id = NULL ✅
└─ ✅ 40+ slots created

PATIENT SEARCHES APPOINTMENTS
├─ GET /api/patient-portal/appointments/available/{id}
├─ Backend: get_available_appointments_v2()
├─ CALL sp_get_available_appointments(date_from, date_to, province)
├─ Procedure: SELECT FROM patient_appointments
│  ├─ JOIN route_locations ON route_location_id ✅ (works now)
│  ├─ WHERE status = 'Available' ✅
│  ├─ COUNT available_slots
│  └─ Return array
└─ ✅ Frontend displays available slots

PATIENT BOOKS APPOINTMENT
├─ POST /api/patient-portal/appointments/{id}/book
├─ Backend: book_appointment()
├─ UPDATE patient_appointments
│  ├─ status = 'Confirmed'
│  ├─ patient_id = 123
│  ├─ booking_reference = 'PLM-20251017-0001'
│  └─ updated_at = NOW()
└─ ✅ Slot marked as booked

NEXT PATIENT SEARCHES
├─ GET /api/patient-portal/appointments/available/{id}
├─ CALL sp_get_available_appointments()
├─ Procedure counts:
│  ├─ Total: 40
│  ├─ Booked: 1
│  └─ Available: 39
└─ ✅ Shows 39 available slots (1 booked)
```

---

## ⚠️ Important Notes

1. **RUN THIS FIRST** - Before deploying any code changes
2. **BACKUP DATA** - Script creates automatic backup table if records exist
3. **NO DATA LOSS** - Migration preserves existing appointment records
4. **SAFE TO RERUN** - Script is idempotent (can run multiple times)
5. **FOREIGN KEY CHECKS** - Temporarily disabled during migration, re-enabled after

---

## 🛑 Troubleshooting

### Error: "Access denied for user 'dbadmin'"
- Check `.env` file for correct DB_PASSWORD
- Verify credentials: `dbadmin` / `Polm3d!DB@2025`

### Error: "Table 'patient_appointments' already exists"
- Script already ran successfully
- Check with: `SHOW TABLES LIKE 'patient_appointments'`

### Error: "Foreign key constraint fails"
- Drop the table and retry
- Or backup old data first with Option B

### Error: "Cannot rename table"
- Check if stored procedures are using it
- Try running again (may have been locked)

---

## ✅ Next Steps After Migration

1. ✅ Run this migration script
2. ✅ Verify schema with checks above
3. ✅ Restart app service (new code with stored procedure calls)
4. ✅ Run VERIFICATION_CHECKLIST.md tests
5. ✅ Deploy to production

---

## 📞 Support

**Issues with migration?**
- Check `DATABASE_SCHEMA_ALIGNMENT_VERIFICATION.md` for detailed analysis
- Review `STORED_PROCEDURES_COMPLETE_FLOW.md` for procedure details
- Run migration script in verbose mode for step-by-step output

**Connection issues?**
- Verify firewall allows connection to `db-polmed.mysql.database.azure.com`
- Check Azure Database credentials
- Ensure VPN/network access enabled

---

**Status:** ⚠️ ACTION REQUIRED - Run migration before deploying code
**Impact:** CRITICAL - Stored procedures cannot run without this schema
**Time to Execute:** ~2-3 minutes
**Data Loss Risk:** NONE - All data preserved

