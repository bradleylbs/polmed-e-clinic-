# Immediate Action Plan - SQL Critical Fixes

**Last Updated:** 2025-10-16  
**Status:** 🔴 CRITICAL - Blocks appointment booking feature  

---

## Problem Statement

Your appointment booking system **doesn't work** because:

1. ❌ `appointments` table is missing (referenced everywhere in code)
2. ❌ `sp_generate_appointment_slots` procedure is missing (called but not defined)

**Result:** When users try to book appointments, there are zero slots shown even though routes are created.

---

## Quick Fix (30 minutes)

### Step 1: Create the Appointments Table

Connect to your Azure MySQL database and run:

```sql
CREATE TABLE IF NOT EXISTS `appointments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `route_location_id` int NOT NULL,
  `patient_id` int DEFAULT NULL,
  `appointment_date` date NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `status` enum('available', 'booked', 'completed', 'cancelled', 'no-show') DEFAULT 'available',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_appointment_slot` (`route_location_id`, `appointment_date`, `start_time`, `patient_id`),
  KEY `idx_appointments_route_location` (`route_location_id`),
  KEY `idx_appointments_patient` (`patient_id`),
  KEY `idx_appointments_date` (`appointment_date`),
  KEY `idx_appointments_status` (`status`),
  KEY `idx_appointments_date_status` (`appointment_date`, `status`),
  CONSTRAINT `appointments_ibfk_1` FOREIGN KEY (`route_location_id`) REFERENCES `route_locations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `appointments_ibfk_2` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Why:** Creates the missing table with:
- Proper foreign keys
- Status tracking (available → booked → completed/cancelled)
- Performance indexes
- Audit timestamps

**Expected Output:**
```
Query OK, 0 rows affected (0.XX sec)
```

---

### Step 2: Create the Slot Generation Procedure

```sql
DELIMITER //

DROP PROCEDURE IF EXISTS sp_generate_appointment_slots //

CREATE PROCEDURE `sp_generate_appointment_slots`(
  IN p_route_location_id INT,
  OUT p_result VARCHAR(255)
)
BEGIN
  DECLARE v_start_time TIME;
  DECLARE v_end_time TIME;
  DECLARE v_max_appointments INT;
  DECLARE v_appointment_duration INT;
  DECLARE v_visit_date DATE;
  DECLARE v_current_time TIME;
  DECLARE v_slot_start TIME;
  DECLARE v_slot_count INT DEFAULT 0;
  DECLARE v_done INT DEFAULT FALSE;
  DECLARE v_rows_generated INT DEFAULT 0;
  
  DECLARE cursor_route_slots CURSOR FOR 
    SELECT visit_date, start_time, end_time, max_appointments, appointment_duration
    FROM route_locations
    WHERE id = p_route_location_id;
  
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;
  
  START TRANSACTION;
  
  DELETE FROM appointments 
  WHERE route_location_id = p_route_location_id 
    AND status = 'available';
  
  OPEN cursor_route_slots;
  read_loop: LOOP
    FETCH cursor_route_slots INTO v_visit_date, v_start_time, v_end_time, 
                                   v_max_appointments, v_appointment_duration;
    
    IF v_done THEN
      LEAVE read_loop;
    END IF;
    
    SET v_current_time = v_start_time;
    SET v_slot_count = 0;
    
    WHILE v_slot_count < v_max_appointments AND v_current_time < v_end_time DO
      SET v_slot_start = v_current_time;
      
      INSERT INTO appointments 
      (route_location_id, patient_id, appointment_date, start_time, end_time, status, created_at)
      VALUES
      (p_route_location_id, NULL, v_visit_date, v_slot_start, 
       DATE_ADD(CAST(CONCAT(v_visit_date, ' ', v_slot_start) AS DATETIME), INTERVAL v_appointment_duration MINUTE),
       'available', NOW());
      
      SET v_rows_generated = v_rows_generated + 1;
      SET v_current_time = TIME_ADD(v_current_time, INTERVAL v_appointment_duration MINUTE);
      SET v_slot_count = v_slot_count + 1;
    END WHILE;
    
  END LOOP;
  CLOSE cursor_route_slots;
  
  COMMIT;
  
  SET p_result = CONCAT('Generated ', v_rows_generated, ' appointment slots for route_location_id: ', p_route_location_id);
END //

DELIMITER ;
```

**What it does:**
1. Takes a `route_location_id` as input
2. Reads the time window and max appointments from route_locations
3. Generates "available" slots based on appointment_duration
4. Returns how many slots were created
5. Previous slots are deleted first (prevents duplicates)

**Expected Output:**
```
Query OK, 0 rows affected (0.XX sec)
```

---

### Step 3: Test the Fix

#### 3a. Verify tables exist:
```sql
SHOW TABLES LIKE 'appointments';
```

**Expected:**
```
| Tables_in_palmed_clinic_erp (appointments) |
| appointments                                |
```

#### 3b. Verify procedure exists:
```sql
SHOW PROCEDURES LIKE 'sp_generate%';
```

**Expected:**
```
| Db                 | Name                          | Type      |
| palmed_clinic_erp  | sp_generate_appointment_slots | PROCEDURE |
```

#### 3c. Test slot generation:

First, find a route_location_id:
```sql
SELECT id, visit_date, start_time, end_time, max_appointments FROM route_locations LIMIT 5;
```

Example output:
```
| id | visit_date | start_time | end_time | max_appointments |
| 1  | 2025-10-31 | 09:00:00   | 17:00:00 | 50               |
```

Then call the procedure (replace `1` with actual route_location_id):
```sql
CALL sp_generate_appointment_slots(1, @result);
SELECT @result;
```

**Expected:**
```
| @result                                          |
| Generated 50 appointment slots for route_location_id: 1 |
```

Verify slots were created:
```sql
SELECT COUNT(*) as total_slots, 
       COUNT(CASE WHEN status='available' THEN 1 END) as available_slots,
       MIN(appointment_date) as first_date,
       MAX(appointment_date) as last_date
FROM appointments 
WHERE route_location_id = 1;
```

**Expected:**
```
| total_slots | available_slots | first_date | last_date  |
| 50          | 50              | 2025-10-31 | 2025-10-31 |
```

---

## Verify Patient Portal Works

### Step 1: Generate slots for a route
```sql
-- Find any route_location
SELECT id FROM route_locations LIMIT 1;
-- Result: id = 1 (example)

-- Generate slots for it
CALL sp_generate_appointment_slots(1, @result);
```

### Step 2: Test the endpoint
```bash
# Get patient ID (from your test data)
PATIENT_ID=21

# Call the backend endpoint
curl -X GET \
  "http://localhost:5000/api/patient-portal/appointments/available/$PATIENT_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "route_location_id": 1,
      "date": "2025-10-31",
      "start_time": "09:00",
      "end_time": "09:30",
      "available_slots": 1,
      "location": {
        "id": 5,
        "name": "Limpopo Primary School",
        "city": "Polokwane",
        "province": "Limpopo"
      },
      "route": {
        "id": 3,
        "name": "LIMPOPO"
      }
    }
    // ... more slots
  ]
}
```

---

## Troubleshooting

### Problem: "Unknown table 'appointments'"
**Solution:** Run Step 1 again - make sure CREATE TABLE executed successfully

### Problem: "Call to undefined procedure sp_generate_appointment_slots"
**Solution:** Run Step 2 again - make sure CREATE PROCEDURE executed successfully

### Problem: "Procedure executed but 0 slots generated"
**Check:**
1. Route locations exist for the date: `SELECT * FROM route_locations WHERE id = 1;`
2. Visit date is in the future: `SELECT NOW();`
3. Time range is valid: `SELECT * FROM route_locations WHERE id = 1 AND start_time < end_time;`

### Problem: "Slots still showing as 0 in patient portal"
**Check:**
1. Appointments exist: `SELECT COUNT(*) FROM appointments;`
2. Backend restarted: `ps aux | grep python`
3. Check backend logs: `tail -f logs/app.log`

---

## Performance Validation

After running fixes, you should see:

```sql
-- Check total slots in system
SELECT COUNT(*) as total_appointment_slots FROM appointments;
-- Expected: > 0

-- Check slots by status
SELECT status, COUNT(*) as count FROM appointments GROUP BY status;
-- Expected: ('available', N), ('booked', 0), etc.

-- Check available slots for patient 21 on specific date
SELECT COUNT(*) as available 
FROM appointments 
WHERE patient_id = 21 
  AND status = 'available' 
  AND appointment_date >= CURDATE();
-- Expected: > 0

-- Check speed of availability query
SELECT SQL_NO_CACHE COUNT(*) FROM appointments 
WHERE appointment_date = '2025-10-31' AND status = 'available';
-- Expected: < 100ms
```

---

## Deployment Verification Checklist

- [ ] Appointments table created successfully
- [ ] Stored procedure created successfully
- [ ] Procedure generates slots without errors
- [ ] Frontend patient portal shows available slots
- [ ] Backend endpoint returns slot data
- [ ] Patient can book an appointment
- [ ] Booked appointment status changes to "booked"
- [ ] Appointment appears in patient's visit history

---

## Rollback Plan (If Something Goes Wrong)

```sql
-- Option 1: Delete table and recreate
DROP TABLE IF EXISTS appointments;
-- Then re-run Step 1

-- Option 2: Delete procedure and recreate
DROP PROCEDURE IF EXISTS sp_generate_appointment_slots;
-- Then re-run Step 2

-- Option 3: Full database restore from backup
-- Restore from your backup file (created before changes)
```

---

## Next Steps After Critical Fixes

Once appointments work:

1. **Performance Optimization** (Part 2)
   - Add composite indexes
   - Remove duplicate indexes
   - ~30 minutes

2. **Data Validation** (Part 3)
   - Add CHECK constraints
   - Add audit timestamps
   - ~20 minutes

3. **Load Testing**
   - Test with expected patient volume
   - Monitor query performance
   - ~1 hour

---

## Summary

**You're here:** ❌ Appointments system broken  
**After Step 1-2:** ✅ Appointments table and procedure created  
**After testing:** ✅ Patient portal shows slots  
**After optimization:** ✅ System runs fast and safe  

**Time to fix:** 30 minutes + 5 minutes testing = 35 minutes  
**Time to full optimization:** +60 minutes (optional)  
**Downtime:** 0 minutes (online additions)  

---

Need help? Check:
- `SQL_ANALYSIS_REPORT.md` - Full technical analysis
- `SQL_OPTIMIZATION_SUMMARY.md` - Executive overview
- Backend logs: `scripts/app.py` error messages

Good luck! 🚀
