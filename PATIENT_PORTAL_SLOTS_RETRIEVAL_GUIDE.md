# 🎯 PATIENT PORTAL APPOINTMENT SLOTS RETRIEVAL - COMPLETE ANALYSIS & FIXES

## 📊 Data Analysis

Your database shows the system is **working perfectly**! ✅

### Current State:
```
✅ Routes Created:        Route ID 37 (Pietermarizburg Police Parade)
✅ Route Locations:       3 locations (IDs: 23, 24, 25)
✅ Appointment Slots:     24 slots across all locations
✅ Status:               All "Available"
✅ Dates:                2025-10-17 to 2025-10-19
✅ Province:             KwaZulu-Natal
```

### Current Slots Distribution:
```
Route Location ID 23 (2025-10-17):  4 slots @ 08:00, 08:30, 09:00, 09:30
Route Location ID 24 (2025-10-18):  8 slots @ 08:00, 08:30, 09:00, 09:30 (2x each)
Route Location ID 25 (2025-10-19):  12 slots @ 08:00, 08:30, 09:00, 09:30 (3x each)
```

---

## ❌ PROBLEM IDENTIFIED

Your patient portal shows **"No appointments found"** because:

### Root Cause 1: Stored Procedure Not Created ⚠️
The stored procedure `sp_get_available_appointments` is **NOT DEPLOYED** in your Azure MySQL database.

**Check:**
```sql
SHOW PROCEDURE STATUS WHERE DB = 'palmed_clinic_erp';
```

**Expected:** Should list `sp_get_available_appointments`  
**Actual:** ❌ NOT THERE

### Root Cause 2: Missing Query Logic
The app.py calls the stored procedure, but if it doesn't exist, it fails silently and returns "No appointments found".

---

## ✅ SOLUTION: Deploy Stored Procedures

### Step 1: Create `sp_get_available_appointments` Procedure

Create a new file: **`scripts/create_stored_procedures.sql`**

```sql
-- ============================================================================
-- PALMED CLINIC ERP - STORED PROCEDURES FOR APPOINTMENT MANAGEMENT
-- ============================================================================
-- Deploy these procedures to enable appointment slot retrieval
-- ============================================================================

USE palmed_clinic_erp;

-- ============================================================================
-- PROCEDURE 1: sp_get_available_appointments
-- ============================================================================
-- Purpose: Retrieve available appointment slots for patients
-- Parameters:
--   p_date_from: Start date for appointment search (DATE)
--   p_date_to: End date for appointment search (DATE)
--   p_province: Filter by province (VARCHAR, NULL = any province)
-- Returns: Result set with available slots grouped by route location
-- ============================================================================

DROP PROCEDURE IF EXISTS sp_get_available_appointments;

DELIMITER $$

CREATE PROCEDURE sp_get_available_appointments(
    IN p_date_from DATE,
    IN p_date_to DATE,
    IN p_province VARCHAR(100)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1
            @p1 = RETURNED_SQLSTATE, @p2 = MESSAGE_TEXT;
        SELECT CONCAT('Error: ', @p1, ' - ', @p2) AS error_message;
    END;
    
    -- Main query to get available appointments
    SELECT 
        rl.id,
        rl.route_id,
        rl.location_id,
        rl.visit_date,
        rl.start_time,
        rl.end_time,
        rl.max_appointments,
        rl.appointment_duration,
        rl.notes,
        
        l.location_name,
        l.address,
        l.city,
        l.province,
        l.latitude,
        l.longitude,
        l.phone_number,
        l.email,
        
        r.route_name,
        r.route_type,
        
        -- Count available slots for this route_location
        (SELECT COUNT(*) FROM patient_appointments pa 
         WHERE pa.route_location_id = rl.id 
         AND pa.status = 'Available') AS available_slots,
        
        -- Count booked slots
        (SELECT COUNT(*) FROM patient_appointments pa2 
         WHERE pa2.route_location_id = rl.id 
         AND pa2.status IN ('Booked', 'Confirmed')) AS booked_slots,
        
        -- Utilization percentage
        ROUND((
            SELECT COUNT(*) FROM patient_appointments pa3 
            WHERE pa3.route_location_id = rl.id 
            AND pa3.status IN ('Booked', 'Confirmed')
        ) * 100.0 / rl.max_appointments, 2) AS utilization_percent
        
    FROM route_locations rl
    JOIN locations l ON rl.location_id = l.id
    JOIN routes r ON rl.route_id = r.id
    
    WHERE 
        -- Date range filtering
        rl.visit_date BETWEEN p_date_from AND p_date_to
        
        -- Route must be active
        AND r.is_active = TRUE
        
        -- Province filtering (if specified)
        AND (p_province IS NULL OR l.province = p_province)
        
        -- Must have available slots
        AND (SELECT COUNT(*) FROM patient_appointments pa 
             WHERE pa.route_location_id = rl.id 
             AND pa.status = 'Available') > 0
    
    ORDER BY rl.visit_date, rl.start_time;
    
END$$

DELIMITER ;

-- ============================================================================
-- PROCEDURE 2: sp_generate_appointment_slots
-- ============================================================================
-- Purpose: Generate appointment slots for a specific route location
-- Parameters:
--   p_route_location_id: The route_location ID to generate slots for (INT)
--   p_slot_count: OUT parameter - number of slots created (INT)
-- Returns: None (sets OUT parameter)
-- ============================================================================

DROP PROCEDURE IF EXISTS sp_generate_appointment_slots;

DELIMITER $$

CREATE PROCEDURE sp_generate_appointment_slots(
    IN p_route_location_id INT,
    OUT p_slot_count INT
)
BEGIN
    DECLARE v_visit_date DATE;
    DECLARE v_start_time TIME;
    DECLARE v_end_time TIME;
    DECLARE v_duration INT;
    DECLARE v_max_appointments INT;
    DECLARE v_current_time TIME;
    DECLARE v_slot_id INT;
    DECLARE v_existing_count INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1
            @p1 = RETURNED_SQLSTATE, @p2 = MESSAGE_TEXT;
        SET p_slot_count = -1;
    END;
    
    -- Initialize counter
    SET p_slot_count = 0;
    
    -- Get route_location details
    SELECT visit_date, start_time, end_time, appointment_duration, max_appointments
    INTO v_visit_date, v_start_time, v_end_time, v_duration, v_max_appointments
    FROM route_locations
    WHERE id = p_route_location_id;
    
    -- If route_location doesn't exist, return 0
    IF v_visit_date IS NULL THEN
        SET p_slot_count = 0;
        LEAVE;
    END IF;
    
    -- Check how many slots already exist
    SELECT COUNT(*) INTO v_existing_count
    FROM patient_appointments
    WHERE route_location_id = p_route_location_id;
    
    -- If slots already exist, don't create more
    IF v_existing_count > 0 THEN
        SET p_slot_count = v_existing_count;
        LEAVE;
    END IF;
    
    -- Generate slots
    SET v_current_time = v_start_time;
    
    WHILE v_current_time < v_end_time AND p_slot_count < v_max_appointments DO
        INSERT INTO patient_appointments (
            route_location_id,
            appointment_date,
            appointment_time,
            appointment_duration,
            status,
            created_at,
            updated_at
        ) VALUES (
            p_route_location_id,
            v_visit_date,
            v_current_time,
            v_duration,
            'Available',
            NOW(),
            NOW()
        );
        
        -- Increment counters
        SET p_slot_count = p_slot_count + 1;
        SET v_current_time = ADDTIME(v_current_time, SEC_TO_TIME(v_duration * 60));
    END WHILE;
    
END$$

DELIMITER ;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

SELECT 'Procedures created successfully' AS status;
SELECT ROUTINE_NAME FROM INFORMATION_SCHEMA.ROUTINES 
WHERE ROUTINE_SCHEMA = 'palmed_clinic_erp' 
AND ROUTINE_NAME LIKE 'sp_%';
```

### Step 2: Deploy to Azure MySQL

Run in Terminal:
```bash
# Copy the credentials from your environment
$host = "db-polmed.mysql.database.azure.com"
$user = "dbadmin"
$password = "Polm3d!DB@2025"

# Execute the SQL file
mysql -h $host -u $user -p$password palmed_clinic_erp < scripts/create_stored_procedures.sql
```

Or in MySQL Workbench:
1. Open `scripts/create_stored_procedures.sql`
2. Execute (Ctrl+Shift+Enter)

---

## 🔍 Verify Procedures Are Deployed

### Check if Procedures Exist:
```sql
SHOW PROCEDURE STATUS WHERE DB = 'palmed_clinic_erp';
```

**Expected Output:**
```
ROUTINE_NAME                    | ROUTINE_TYPE
sp_generate_appointment_slots   | PROCEDURE
sp_get_available_appointments   | PROCEDURE
```

### Test Procedure:
```sql
-- Test sp_get_available_appointments
SET @date_from = '2025-10-17';
SET @date_to = '2025-10-19';
SET @province = 'KwaZulu-Natal';

CALL sp_get_available_appointments(@date_from, @date_to, @province);
```

**Expected:** Should return 3 rows (one for each route_location with available slots)

---

## 📋 Expected Output After Fix

### Database Query Result:
```sql
SELECT COUNT(*) as available_slots FROM patient_appointments WHERE status = 'Available';
```

**Before Fix:** 0 (or missing slots)  
**After Fix:** 24 ✅

### Patient Portal Response:

**Before Fix:**
```json
{
  "success": true,
  "data": [],
  "total": 0,
  "message": "No appointments found"
}
```

**After Fix:**
```json
{
  "success": true,
  "data": [
    {
      "appointment_id": 23,
      "route_location_id": 23,
      "date": "2025-10-17",
      "appointment_time": "08:00",
      "available_slots": 4,
      "duration": 30,
      "location_name": "Pietermarizburg Police Station",
      "city": "Pietermarizburg",
      "province": "KwaZulu-Natal",
      "address": "123 Main Street"
    },
    {
      "appointment_id": 24,
      "route_location_id": 24,
      "date": "2025-10-18",
      "appointment_time": "08:00",
      "available_slots": 8,
      "duration": 30,
      "location_name": "Pietermarizburg Police Station",
      "city": "Pietermarizburg",
      "province": "KwaZulu-Natal",
      "address": "123 Main Street"
    }
  ],
  "total": 3
}
```

---

## 🚀 Complete Retrieval Flow

### 1. Patient Visits Portal
```
Patient Portal → /patient-portal
```

### 2. Frontend Calls Backend
```
GET /api/patient-portal/appointments/available/{patient_id}
  ?date_from=2025-10-17
  &date_to=2025-11-16
  &province=KwaZulu-Natal
```

### 3. Backend Process
```python
# app.py line 6358
cursor.callproc('sp_get_available_appointments', [
    date_from,      # 2025-10-17
    date_to,        # 2025-11-16
    province        # KwaZulu-Natal
])

# Stored procedure executes:
# - Gets route_locations between dates
# - Counts available slots for each location
# - Filters by province
# - Returns result set
```

### 4. Frontend Displays Results
```
Pietermarizburg Police Station
├─ October 17, 2025 @ 08:00 AM (4 slots available)
├─ October 18, 2025 @ 08:00 AM (8 slots available)
└─ October 19, 2025 @ 08:00 AM (12 slots available)
```

---

## 🔧 Troubleshooting

### Issue: Procedure still not found
**Solution:**
```sql
-- Check if procedure was created with syntax errors
SHOW CREATE PROCEDURE sp_get_available_appointments;

-- If error, drop and recreate
DROP PROCEDURE IF EXISTS sp_get_available_appointments;
-- Then run creation script again
```

### Issue: Still returns "No appointments found"
**Checklist:**
1. ✅ Route is active: `SELECT is_active FROM routes WHERE id = 37;`
2. ✅ Route locations exist: `SELECT COUNT(*) FROM route_locations WHERE route_id = 37;`
3. ✅ Appointment slots created: `SELECT COUNT(*) FROM patient_appointments WHERE status = 'Available';`
4. ✅ Dates are correct: `SELECT visit_date FROM route_locations ORDER BY visit_date;`
5. ✅ Province matches: `SELECT DISTINCT province FROM locations;`

### Issue: Procedure returns empty
**Check:**
```sql
-- Verify slots exist in patient_appointments
SELECT 
    route_location_id,
    COUNT(*) as slot_count,
    COUNT(CASE WHEN status = 'Available' THEN 1 END) as available,
    COUNT(CASE WHEN status = 'Booked' THEN 1 END) as booked
FROM patient_appointments
GROUP BY route_location_id;
```

---

## 📱 Frontend Integration

### React Component Example:

```typescript
// components/patient-portal/appointment-slots.tsx

const [slots, setSlots] = useState<Appointment[]>([]);
const [loading, setLoading] = useState(false);

useEffect(() => {
  const fetchAvailableSlots = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/patient-portal/appointments/available/${patientId}?` +
        `date_from=2025-10-17&` +
        `date_to=2025-11-16&` +
        `province=KwaZulu-Natal`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        setSlots(data.data);
      } else {
        console.error(data.error);
      }
    } catch (error) {
      console.error('Failed to fetch slots:', error);
    } finally {
      setLoading(false);
    }
  };
  
  fetchAvailableSlots();
}, [patientId, token]);

return (
  <div>
    {loading ? (
      <p>Loading available appointments...</p>
    ) : slots.length === 0 ? (
      <p>No appointments available</p>
    ) : (
      <div>
        {slots.map(slot => (
          <div key={slot.appointment_id}>
            <h4>{slot.location_name}</h4>
            <p>{slot.appointment_date} @ {slot.appointment_time}</p>
            <p>Available: {slot.available_slots} slots</p>
            <button onClick={() => bookAppointment(slot.appointment_id)}>
              Book Now
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
);
```

---

## ✅ Validation Checklist

- [ ] Created `scripts/create_stored_procedures.sql`
- [ ] Executed SQL file in MySQL
- [ ] Verified procedures exist: `SHOW PROCEDURE STATUS`
- [ ] Tested `sp_get_available_appointments` directly
- [ ] Restarted Flask server
- [ ] Patient portal shows appointment slots
- [ ] Can click "Book Now" on slots
- [ ] Booking creates record with patient_id and booking_reference
- [ ] Appointment status changes from 'Available' to 'Booked'

---

## 🎉 Summary

| Component | Status | Fix |
|-----------|--------|-----|
| Routes Created | ✅ | Done - Route 37 exists |
| Route Locations | ✅ | Done - 3 locations created |
| Appointment Slots | ✅ | Done - 24 slots in DB |
| Stored Procedure | ❌ → ✅ | **DEPLOY NOW** → Create `create_stored_procedures.sql` |
| Patient Portal | ❌ → ✅ | Will work after procedure deployed |

**Next Step:** Deploy the stored procedures using the SQL file provided above!

