# 🧪 STORED PROCEDURE TEST GUIDE

## 📋 Overview

This guide helps you test the PALMED CLINIC ERP stored procedures using MySQL Workbench.

---

## 🚀 QUICK START

1. **Open MySQL Workbench**
2. **Connect to Azure MySQL:** `db-polmed.mysql.database.azure.com`
3. **Open file:** `scripts/TEST_STORED_PROCEDURES.sql`
4. **Run all queries** (Ctrl+Shift+Enter)

---

## 📊 Test Sections

### Section 1: Setup Test Data
Verifies tables exist and shows sample data

**Expected Results:**
- ✅ All tables exist (routes, route_locations, locations, etc.)
- ✅ Data is present in tables
- ✅ Sample routes and locations displayed

---

### Section 2: Test `sp_generate_appointment_slots`

**What it does:**
- Creates appointment slots for a route location
- Populates `patient_appointments` table with Available slots

**How to run:**
```sql
SET @test_route_location_id = (SELECT id FROM route_locations LIMIT 1);
SET @slot_count = 0;
CALL sp_generate_appointment_slots(@test_route_location_id, @slot_count);
SELECT @slot_count as 'Slots Created';
```

**Expected Results:**
- ✅ `@slot_count` shows number created (e.g., 40)
- ✅ New rows in `patient_appointments` table
- ✅ Status = 'Available' for all new slots
- ✅ patient_id = NULL (slots not yet booked)

**Example Output:**
```
Slots Created: 40
```

---

### Section 3: Test `sp_get_available_appointments`

**What it does:**
- Returns available appointment slots for given date range and province

**How to run:**
```sql
SET @date_from = CURDATE();
SET @date_to = DATE_ADD(CURDATE(), INTERVAL 30 DAY);
SET @province = 'KwaZulu-Natal';

CALL sp_get_available_appointments(@date_from, @date_to, @province);
```

**Expected Results:**
- ✅ Query returns available appointments
- ✅ Only 'Available' status appointments shown
- ✅ Within date range specified
- ✅ In province specified

**Example Output:**
```
id | appointment_date | appointment_time | location_name | status
1  | 2025-10-31       | 08:00:00         | Police Stat.  | Available
2  | 2025-10-31       | 08:30:00         | Police Stat.  | Available
```

---

## ✅ Verification Queries

These queries help verify everything is working correctly.

### Count by Status
```sql
SELECT status, COUNT(*) as count 
FROM patient_appointments 
GROUP BY status;
```

**Expected:**
- Available slots exist
- Some may be Booked/Confirmed (from previous tests)

### Appointments with Location Info
```sql
SELECT pa.appointment_date, pa.appointment_time, l.location_name, l.province, pa.status
FROM patient_appointments pa
JOIN route_locations rl ON pa.route_location_id = rl.id
JOIN locations l ON rl.location_id = l.id
WHERE pa.status = 'Available'
LIMIT 10;
```

**Expected:**
- Shows appointment details with location info
- All are Available status

---

## 🔍 Common Issues & Solutions

### Issue: "Stored procedure not found"
**Solution:** Ensure stored procedures were created
```sql
SHOW PROCEDURE STATUS WHERE DB = 'palmed_clinic_erp';
```

Should show:
- `sp_generate_appointment_slots`
- `sp_get_available_appointments`

---

### Issue: "Unknown column in patient_appointments"
**Solution:** Check table structure
```sql
DESCRIBE patient_appointments;
```

Should have columns:
- route_location_id
- appointment_date
- appointment_time
- appointment_duration
- booking_reference
- status
- patient_id

---

### Issue: "No rows returned"
**Solution 1:** Check if route_locations exist
```sql
SELECT COUNT(*) FROM route_locations;
```

**Solution 2:** Check if appointments were created
```sql
SELECT COUNT(*) FROM patient_appointments;
```

**Solution 3:** Check date range
```sql
SELECT MIN(visit_date), MAX(visit_date) FROM route_locations;
```

---

## 📈 Data Integrity Checks

Run these to ensure data is clean:

### Check 1: Orphaned Records
```sql
-- Find appointments with invalid route_location_id
SELECT COUNT(*) FROM patient_appointments 
WHERE route_location_id NOT IN (SELECT id FROM route_locations);
```
Should return: **0**

### Check 2: Invalid Status Values
```sql
SELECT DISTINCT status FROM patient_appointments
WHERE status NOT IN ('Available', 'Booked', 'Confirmed', 'Completed', 'Cancelled', 'NoShow');
```
Should return: **0 rows**

### Check 3: Duplicate Booking References
```sql
SELECT booking_reference, COUNT(*) 
FROM patient_appointments 
WHERE booking_reference IS NOT NULL
GROUP BY booking_reference 
HAVING COUNT(*) > 1;
```
Should return: **0 rows**

---

## 🎯 Full Test Workflow

### Step 1: Setup
```sql
-- Run Section 1: SETUP TEST DATA
-- Verify routes, locations, and route_locations exist
```

### Step 2: Generate Slots
```sql
-- Run Section 2: TEST sp_generate_appointment_slots
-- Should create 40 slots (or max_appointments for that location)
```

### Step 3: Verify Slots
```sql
-- Run manual query to see created slots
SELECT COUNT(*) FROM patient_appointments WHERE status = 'Available';
```

### Step 4: Get Available Slots
```sql
-- Run Section 3: TEST sp_get_available_appointments
-- Should return list of available slots
```

### Step 5: Data Integrity
```sql
-- Run Section 5: DATA INTEGRITY CHECKS
-- All checks should pass (0 issues)
```

### Step 6: Analysis
```sql
-- Run Section 6: PERFORMANCE ANALYSIS
-- Verify indexes and foreign keys exist
```

---

## 📊 Sample Test Results

### Expected Output Summary
```
active_routes:           2
route_locations:         3
locations:               5
total_appointments:      120
available_appointments:  80
booked_appointments:     30
confirmed_appointments:  10
patients_with_bookings:  15
unique_route_locations:  3
```

---

## 🔧 Testing Individual Procedures

### Test 1: Generate Slots Only
```sql
-- Find a route location
SELECT id, location_id, visit_date, max_appointments 
FROM route_locations 
WHERE visit_date >= CURDATE() 
LIMIT 1;

-- Use that ID
SET @rl_id = 123;  -- Replace with actual ID
SET @count = 0;

CALL sp_generate_appointment_slots(@rl_id, @count);
SELECT @count;
```

### Test 2: Get Available Appointments Only
```sql
-- Set your test parameters
SET @from = '2025-10-31';
SET @to = '2025-11-30';
SET @prov = 'KwaZulu-Natal';

-- Call procedure
CALL sp_get_available_appointments(@from, @to, @prov);
```

---

## 📋 Troubleshooting Checklist

- [ ] Connected to correct database (palmed_clinic_erp)
- [ ] Stored procedures exist (check with SHOW PROCEDURE STATUS)
- [ ] patient_appointments table has correct columns
- [ ] route_locations table has data
- [ ] locations table has data
- [ ] No date range errors (verify CURDATE() works)
- [ ] Status enum values match (Available, Booked, etc.)

---

## 🚀 Next Steps

After successful testing:

1. **Test from Flask app:**
   ```bash
   python scripts/app.py
   ```

2. **Test patient portal:**
   - Navigate to `/patient-portal`
   - Check "Available Appointments"

3. **Test staff portal:**
   - Navigate to `/staff/appointments`
   - Create route → generate slots → verify

4. **Monitor logs:**
   - Watch for SQL errors
   - Check appointment counts

---

## 💾 Save Test Results

To save results to file:

```sql
-- Run all tests and export results
-- In MySQL Workbench: Query → Export Result Set
-- Save as: TEST_RESULTS_YYYY_MM_DD.csv
```

---

## ✨ You're Ready!

Your stored procedures are now fully tested and ready for production use. 🎉

