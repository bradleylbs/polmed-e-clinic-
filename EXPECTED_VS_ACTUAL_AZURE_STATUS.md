# Expected vs Actual: Route Creation on Azure

## Scenario: Create Route Spanning Oct 20-24 with 1 Location

### Expected Outcome ✅ (If locations provided)

| Layer | Table | Expected Records | Actual on Azure | Status |
|-------|-------|------------------|-----------------|--------|
| **Routes** | `routes` | 1 row per route | 11 rows | ✅ Routes created |
| **Locations** | `locations` | 1 row per unique location | 10 rows | ✅ Locations exist |
| **Route Schedule** | `route_locations` | 5 rows (1 per day × 1 location) | **0 rows** | ❌ EMPTY |
| **Appointment Slots** | `appointments` | 90 rows (18 slots × 5 days) | **0 rows** | ❌ EMPTY |

---

## Data Flow Comparison

### ✅ CORRECT FLOW (What SHOULD Happen)

```
User Creates Route: 
  name="EC Route", start=Oct20, end=Oct24, locations=[Umtata Police Station]

Step 1: routes INSERT
  routes.id = 1
  1 row created

Step 2: locations INSERT (if new)
  locations.id = 5
  1 row created

Step 3: route_locations INSERT (5 times, one per day)
  route_locations.id = 10, 11, 12, 13, 14
  5 rows created
  Row 10: route_id=1, location_id=5, visit_date=2025-10-20
  Row 11: route_id=1, location_id=5, visit_date=2025-10-21
  Row 12: route_id=1, location_id=5, visit_date=2025-10-22
  Row 13: route_id=1, location_id=5, visit_date=2025-10-23
  Row 14: route_id=1, location_id=5, visit_date=2025-10-24

Step 4: appointments INSERT (90 times via stored proc)
  For each route_location (10-14):
    For each time slot (08:00, 08:30, ..., 16:30):
      INSERT appointment with status='available'
  
  Result:
  appointments.id = 100-117 (for date 2025-10-20, route_location_id=10)
  appointments.id = 118-135 (for date 2025-10-21, route_location_id=11)
  ... etc
  
  90 rows created total

Final: Patient Portal Query
  SELECT available_slots FROM route_locations WHERE visit_date >= TODAY
  Result: Shows 18 available slots per day
  ✅ Patient sees 90+ available slots to book
```

---

### ❌ ACTUAL FLOW ON AZURE (What IS Happening)

```
User Creates Route (on Azure Portal):
  name="EC Route", start=Oct20, end=Oct24, locations=[] (EMPTY)

Step 1: routes INSERT ✅
  routes.id = 1 (or 2, 3, ..., 11 based on existing count)
  1 row created
  
  11 rows now in routes table ✅

Step 2: locations INSERT ✅
  No new locations created (user didn't specify any)
  10 rows remain in locations table ✅
  
Step 3: route_locations INSERT ❌
  for loc_payload in []:  # Empty loop, never executes
    INSERT into route_locations ...
  
  0 rows created
  route_locations still empty ❌

Step 4: appointments INSERT ❌
  No stored proc calls (no route_locations to call on)
  0 rows created
  appointments still empty ❌

Final: Patient Portal Query
  SELECT available_slots FROM route_locations WHERE visit_date >= TODAY
  Result: 0 rows found
  
  Query returns: {
    success: true,
    data: []  # Empty array
  }
  
  ❌ Patient sees 0 available slots
```

---

## Root Cause Analysis

### Why route_locations is Empty

| Question | Answer | Evidence |
|----------|--------|----------|
| Were routes created? | ✅ YES | 11 rows in routes table |
| Were locations specified? | ❌ NO | 0 new locations created |
| Did backend code fail? | ❌ NO | No error logs from `/api/routes` |
| Was locations array empty? | ✅ YES | Loop never executed (line 2790 in app.py) |
| Did frontend validate? | ❌ NO | Frontend allows empty locations |

**Conclusion:** Staff created routes through some interface (likely Azure portal or mobile) WITHOUT providing locations in the payload. The backend code worked correctly by NOT creating route_locations when none were specified. Result: working as designed, but no appointments available to book.

---

## The Table Purpose Hierarchy

```
Why we have 4 location-related tables (not 1):

┌─ location_types (ref data)
│   └─ "Police Station", "School", "Community Center"
│      Used for: UI dropdowns, filtering, categorizing locations
│
├─ locations (master data)
│   └─ Physical location: "Umtata Police Station"
│      Used for: Can be reused in multiple routes
│      Cardinality: Many locations, one per physical place
│
├─ routes (campaign)
│   └─ Schedule: "EC Route Oct 20-24"
│      Used for: High-level planning, date ranges, capacity planning
│      Cardinality: Many routes, one per schedule
│
├─ route_locations (journey record)
│   └─ "EC Route visits Umtata on Oct 20"
│      Used for: Links route to specific location on specific date
│      Cardinality: M:N relationship (many routes, many locations, many dates)
│
└─ appointments (booking slots)
    └─ "EC Route / Umtata / Oct 20 / 08:00 slot"
    Used for: Patient booking, capacity tracking
    Cardinality: Many appointments per route_location (one per time slot)
```

**Why not collapse?**

If everything was in one table:
```
❌ Would look like:
  appointments(
    id, route_id, location_id, date, time, 
    route_name, location_name, contact_phone,
    status, patient_id, ...
  )

Problems:
1. Route name duplicated 90 times (5 days × 18 slots)
2. Location details duplicated 90 times
3. Can't reuse location in different routes without duplication
4. Can't plan routes before knowing location details
5. Updates to location name would require updating 90 rows
```

**Normalized solution** (current design):
```
✅ Each table has single responsibility:
  - location_types: what types of locations exist
  - locations: where are they
  - routes: when and what route
  - route_locations: which location in which route on which date
  - appointments: specific time slots and who booked them

Clean separation, reusable data, efficient updates.
```

---

## What Needs to Happen Now

### Option A: Manual Population (One-Time Fix)

Run on Azure MySQL:
```sql
-- Step 1: Verify existing data
SELECT COUNT(*) as route_count FROM routes;       -- Should show 11
SELECT COUNT(*) as location_count FROM locations; -- Should show 10
SELECT COUNT(*) as rl_count FROM route_locations; -- Should show 0 (PROBLEM)

-- Step 2: Pick an active route and a location
SELECT id, route_name, start_date, end_date, status FROM routes 
WHERE is_active = 1 AND status IN ('active', 'published') LIMIT 1;
-- Result: route_id = 1

SELECT id, location_name, province FROM locations LIMIT 1;
-- Result: location_id = 5

-- Step 3: Populate route_locations for the next 5 days
INSERT INTO route_locations (route_id, location_id, visit_date, start_time, end_time, max_appointments, appointment_duration, created_at)
SELECT 
  1,                                  -- route_id
  5,                                  -- location_id
  DATE_ADD(CURDATE(), INTERVAL seq-1 DAY),  -- visit_date starting today
  '08:00:00',
  '17:00:00',
  10,  -- max appointments per slot
  30,  -- duration in minutes
  NOW()
FROM (
  SELECT 1 as seq UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
) nums
WHERE DATE_ADD(CURDATE(), INTERVAL seq-1 DAY) <= (SELECT end_date FROM routes WHERE id = 1);

-- Step 4: Generate appointment slots
SET @result = '';
CALL sp_generate_appointment_slots(LAST_INSERT_ID(), @result);
SELECT @result;

-- Step 5: Verify
SELECT COUNT(*) as new_rl_count FROM route_locations;  -- Should show 5+
SELECT COUNT(*) as new_appt_count FROM appointments;   -- Should show 90+ (18 slots × 5 days)
```

### Option B: Code Fix (Prevent Future Occurrences)

**Frontend Validation** (components/routes/route-planner.tsx):
```typescript
const createRoute = async () => {
  // NEW: Require at least one location
  if (!routeName || !startDate || !endDate || locations.length === 0 || !selectedProvince) {
    toast({
      title: "Missing information",
      description: locations.length === 0 
        ? "Please add at least one location to your route."
        : "Please fill in all required fields.",
      variant: "destructive",
    })
    return
  }
  // ... proceed
}
```

**Backend Validation** (scripts/app.py ~line 2660):
```python
locations_payload = data.get('locations') or []

# NEW: Require at least one location
if not locations_payload:
    logger.warning("Create route attempt with no locations")
    return jsonify({
        'success': False,
        'error': 'At least one location must be provided for the route'
    }), 400

# Continue with existing logic...
```

---

## Success Criteria

After fix is applied, verify:

```bash
# 1. Populate route_locations (if using manual fix)
mysql> SELECT COUNT(*) FROM route_locations;
Expected: 5+

# 2. Verify appointments were generated
mysql> SELECT COUNT(*) FROM appointments;
Expected: 90+

# 3. Test patient portal
python test_patient_portal_route_availability.py --email test@example.com
Expected: 
  ✅ Login succeeded
  ✅ API returned 200 OK
  ✅ Returned N slots (not 0!)

# 4. Verify diagnostics
mysql> SELECT COUNT(*) FROM route_locations rl 
       WHERE rl.visit_date >= CURDATE();
Expected: 5+

mysql> SELECT COUNT(*) FROM appointments a
       JOIN route_locations rl ON a.route_location_id = rl.id
       WHERE rl.visit_date >= CURDATE();
Expected: 90+
```

