# Quick Reference: Route Creation & Appointment Slots Flow

## The 5-Step Journey of a Route from UI to Database

### 🎨 STEP 1: Frontend (React) - User Interaction

**File:** `components/routes/route-planner.tsx`

```
User Form Input
    ↓
[Route Name] → "Eastern Cape Rural Route"
[Start Date] → "2025-10-20"
[End Date] → "2025-10-24" (5 days)
[Province] → "Eastern Cape"
[Time Slots] → [08:00-08:30, 08:30-09:00, ..., 16:30-17:00]
[Locations Array] ← CRITICAL: Must have at least 1 location!
    ↓
Add Location Button (User can skip this!)
    ↓
Location 1:
  name: "Umtata Police Station"
  type: "police_station"
  address: "123 Main St"
  capacity: 50
  province: "Eastern Cape"
```

**Problem Zone:** User can click "Create Route" without adding ANY locations. Frontend doesn't prevent this.

---

### 📤 STEP 2: Frontend → Backend (API Call)

**File:** `lib/api-service.ts`

```typescript
POST /api/routes
Headers: {
  Authorization: "Bearer <token>",
  Content-Type: "application/json"
}

Body: {
  route_name: "Eastern Cape Rural Route",
  start_date: "2025-10-20",
  end_date: "2025-10-24",
  province: "Eastern Cape",
  route_type: "Mixed",
  max_appointments_per_day: 100,
  locations: [
    {
      name: "Umtata Police Station",
      type: "police_station",
      address: "123 Main St",
      province: "Eastern Cape",
      capacity: 50
    }
    // ❌ If empty, this array has 0 items
  ],
  time_slots: [
    { start_time: "08:00", end_time: "08:30", max_appointments: 10 },
    { start_time: "08:30", end_time: "09:00", max_appointments: 10 },
    // ... more slots
  ]
}
```

---

### ⚙️ STEP 3: Backend (Flask) - Database Inserts

**File:** `scripts/app.py` Lines 2634-2980

#### Phase A: Create Route Record
```python
INSERT INTO routes (route_name, start_date, end_date, province, ...)
VALUES ('Eastern Cape Rural Route', '2025-10-20', '2025-10-24', 'Eastern Cape', ...)

Result: routes.id = 1
```

**Database State:**
```
routes: 1 row ✅
  id=1, route_name='Eastern Cape Rural Route', start_date=2025-10-20, ...
```

---

#### Phase B: Create Location (if new)
```python
# Check if "Umtata Police Station" already exists
SELECT id FROM locations 
WHERE location_name = 'Umtata Police Station' AND province = 'Eastern Cape'

# If not found:
INSERT INTO locations (location_name, type, address, province, ...)
VALUES ('Umtata Police Station', 1, '123 Main St', 'Eastern Cape', ...)

Result: locations.id = 5
```

**Database State:**
```
routes: 1 row ✅
locations: 1 row ✅
  id=5, location_name='Umtata Police Station', province='Eastern Cape', ...
```

---

#### Phase C: Create Route-Location Records (One Per Day)

```python
# Loop: current_date = start_date_obj (2025-10-20)
# While current_date <= end_date_obj (2025-10-24)

FOR EACH day in date range:
  FOR EACH location in locations_payload:  # ← IF LOCATIONS EMPTY, THIS LOOP NEVER RUNS
    INSERT INTO route_locations (
      route_id=1, 
      location_id=5, 
      visit_date=current_date,  # 2025-10-20, then 2025-10-21, etc.
      start_time='08:00:00',
      end_time='17:00:00',
      max_appointments=50
    )
    Result: route_locations.id = 10, 11, 12, 13, 14 (one per day)
    
    current_date += timedelta(days=1)
```

**Database State:**
```
routes: 1 row ✅
locations: 1 row ✅
route_locations: 5 rows ✅
  id=10, route_id=1, location_id=5, visit_date=2025-10-20, ...
  id=11, route_id=1, location_id=5, visit_date=2025-10-21, ...
  id=12, route_id=1, location_id=5, visit_date=2025-10-22, ...
  id=13, route_id=1, location_id=5, visit_date=2025-10-23, ...
  id=14, route_id=1, location_id=5, visit_date=2025-10-24, ...
```

---

#### Phase D: Generate Appointment Slots (Stored Procedure)

```python
# For each route_location created, call stored procedure
FOR EACH route_location_id IN (10, 11, 12, 13, 14):
  CALL sp_generate_appointment_slots(route_location_id, @result)
```

**Stored Procedure Logic:**
```sql
PROCEDURE sp_generate_appointment_slots(p_route_location_id=10)

SELECT visit_date, start_time, end_time, appointment_duration 
FROM route_locations WHERE id = 10
  → visit_date=2025-10-20, start_time=08:00, end_time=17:00, duration=30

DELETE existing appointments for this route_location

LOOP through time slots:
  FOR time = 08:00 TO 17:00 STEP appointment_duration(30 min):
    INSERT INTO appointments (
      route_location_id=10,
      appointment_date=2025-10-20,
      appointment_time='08:00',  ← incrementally: 08:30, 09:00, ...
      status='available'
    )
    
Result: 18 appointment rows (08:00, 08:30, 09:00, ..., 16:30)
```

**Database State After Full Creation:**
```
routes: 1 row ✅
locations: 1 row ✅
route_locations: 5 rows ✅
appointments: 90 rows (18 slots × 5 days) ✅
  id=100, route_location_id=10, appointment_time=08:00, status='available'
  id=101, route_location_id=10, appointment_time=08:30, status='available'
  ...
  id=117, route_location_id=10, appointment_time=16:30, status='available'
  id=118, route_location_id=11, appointment_time=08:00, status='available'
  ...
```

---

### 🔙 STEP 4: Backend Response to Frontend

**HTTP 201 Created**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "route_name": "Eastern Cape Rural Route",
    "start_date": "2025-10-20",
    "end_date": "2025-10-24",
    "province": "Eastern Cape",
    "status": "published",
    "locations": [
      {
        "route_location_id": 10,
        "name": "Umtata Police Station",
        "visit_date": "2025-10-20",
        "start_time": "08:00",
        "end_time": "17:00",
        "max_appointments": 50
      },
      {
        "route_location_id": 11,
        "name": "Umtata Police Station",
        "visit_date": "2025-10-21",
        "start_time": "08:00",
        "end_time": "17:00",
        "max_appointments": 50
      }
      // ... 3 more for remaining days
    ],
    "time_slots": [
      { "start_time": "08:00", "end_time": "08:30", "max_appointments": 10 },
      { "start_time": "08:30", "end_time": "09:00", "max_appointments": 10 }
      // ... more slots
    ]
  },
  "message": "Route created successfully"
}
```

---

### 🎯 STEP 5: Patient Portal Uses Data

**File:** `scripts/app.py` Lines 6315-6445

```python
GET /api/patient-portal/appointments/available/<patient_id>

Query:
  SELECT rl.id, rl.visit_date, rl.start_time, rl.end_time,
         l.location_name, l.province,
         COUNT(a.id) - COUNT(CASE WHEN a.status='available' THEN 1 END) as booked,
         MAX(rl.max_appointments) - booked as available_slots
  FROM route_locations rl
    JOIN locations l ON rl.location_id = l.id
    JOIN routes r ON rl.route_id = r.id
    LEFT JOIN appointments a ON rl.id = a.route_location_id
  WHERE rl.visit_date >= CURDATE()
    AND r.status IN ('active', 'published')
    AND r.is_active = 1
  GROUP BY rl.id

Response:
  [
    {
      "appointment_id": 10,
      "appointment_date": "2025-10-20",
      "appointment_time": "08:00",
      "available_slots": 10,
      "location": {
        "id": 5,
        "name": "Umtata Police Station",
        "province": "Eastern Cape"
      }
    },
    // ... more slots
  ]
```

**Patient sees:** ✅ 18 available slots per day

---

## ❌ What Happens When Locations Array is Empty

```
STEP 1: User clicks "Create Route" WITHOUT adding locations
  ↓
locations = [] (empty array)
  ↓
STEP 3, Phase B:
  for loc_payload in locations_payload:  # ← LOOP NEVER EXECUTES (empty array)
    # route_locations INSERT never happens
  ↓
STEP 3, Phase D:
  # Stored procedure never called (no route_locations to call on)
  ↓
Database State:
  routes: 1 row ✅
  locations: 0 new rows
  route_locations: 0 rows ❌ EMPTY!
  appointments: 0 rows ❌ EMPTY!
  ↓
STEP 5: Patient Portal Query
  SELECT * FROM route_locations WHERE ...
  Result: 0 rows
  ↓
Patient sees: ❌ 0 available slots
```

---

## 🔧 Why This Happened on Azure

**11 routes exist, but route_locations is empty** → Staff created routes without locations

**Solution #1 (Quick Fix):**
```sql
-- Populate route_locations for existing routes
INSERT INTO route_locations (route_id, location_id, visit_date, start_time, end_time, max_appointments, appointment_duration)
SELECT 
  r.id,                                    -- route_id
  l.id,                                    -- location_id (any existing location)
  CURDATE() + INTERVAL seq-1 DAY,         -- visit_date (starting today, 5 days)
  '08:00:00',                             -- start_time
  '17:00:00',                             -- end_time
  10,                                      -- max_appointments per slot
  30                                       -- appointment_duration_minutes
FROM routes r
CROSS JOIN locations l
CROSS JOIN (SELECT 1 as seq UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) days
WHERE r.is_active = 1 
  AND r.status IN ('active', 'published')
  AND CURDATE() + INTERVAL seq-1 DAY <= r.end_date
  AND NOT EXISTS (
    SELECT 1 FROM route_locations rl2 
    WHERE rl2.route_id = r.id 
      AND rl2.location_id = l.id
      AND rl2.visit_date = CURDATE() + INTERVAL seq-1 DAY
  )
LIMIT 50;  -- Limit to prevent huge insert

-- Then generate appointment slots
CALL sp_generate_appointment_slots(LAST_INSERT_ID(), @result);
```

**Solution #2 (Prevent Future Occurrences):**
- Add frontend validation: require min 1 location before submit
- Add backend validation: return 400 if locations array empty

