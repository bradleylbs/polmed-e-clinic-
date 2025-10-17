# Route Creation & Appointment Slot Generation - End-to-End Analysis

**Document Purpose:** Understand the complete flow: frontend → backend → database for creating routes and generating appointment slots.

**Current Status:** ✅ Code exists and works correctly in design | ❌ `route_locations` table is empty on Azure (data issue, not code issue)

---

## 1. FRONTEND FLOW (React/TypeScript)

### File: `components/routes/route-planner.tsx`

#### 1.1 User Input Form

```typescript
// State managed by RoutePlanner component (lines 65-85)
const [routeName, setRouteName] = useState("")
const [description, setDescription] = useState("")
const [startDate, setStartDate] = useState<Date>()
const [endDate, setEndDate] = useState<Date>()
const [selectedProvince, setSelectedProvince] = useState("")
const [locations, setLocations] = useState<RouteLocation[]>([])  // Array of locations user adds
const [timeSlots, setTimeSlots] = useState<Omit<TimeSlot, "id" | "locationId">[]>([
  { startTime: "08:00", endTime: "08:30", maxAppointments: 10, bookedAppointments: 0 },
  // ... more default slots
])
```

**Key interfaces:**
```typescript
interface RouteLocation {
  id: string
  name: string
  type: "police_station" | "school" | "community_center"
  address: string
  province: string
  coordinates?: { lat: number; lng: number }
  capacity: number
  contactPerson?: string
  contactPhone?: string
}

interface TimeSlot {
  id: string
  startTime: string
  endTime: string
  maxAppointments: number
  bookedAppointments: number
  locationId: string
}
```

#### 1.2 Adding Locations to Route (lines 133-150)

```typescript
const addLocation = () => {
  if (currentLocation.name && currentLocation.address && currentLocation.province) {
    const newLocation: RouteLocation = {
      id: `loc-${Date.now()}`,
      name: currentLocation.name,
      type: currentLocation.type as RouteLocation["type"],
      address: currentLocation.address,
      province: currentLocation.province,
      capacity: currentLocation.capacity || 50,
      // ... contact info
    }
    setLocations([...locations, newLocation])
  }
}
```

**What happens:** User clicks "+ Add Location" button, fills in name/address/type/capacity, clicks "Add". Location is added to the frontend array. If user doesn't add locations, the array stays empty.

#### 1.3 Creating Route (lines 181-233)

```typescript
const createRoute = async () => {
  // Validation
  const isEditing = !!routeToEdit?.id
  const missingLocations = locations.length === 0
  if (!routeName || !startDate || !endDate || (!isEditing && missingLocations) || !selectedProvince) {
    // Show error if route name, dates, or locations missing
    return
  }

  // Build payload
  const routeType = determineRouteType(locations)  // 'Police Stations' | 'Schools' | 'Community Centers' | 'Mixed'
  const perLocationCapacity = timeSlots.reduce((sum, s) => sum + (s.maxAppointments || 0), 0)
  const maxPerDay = Math.max(1, perLocationCapacity * locations.length)

  const sanitizedLocations = locations.map((loc) => ({
    name: loc.name,
    type: loc.type,
    address: loc.address,
    province: loc.province,
    city: loc.address?.split(',')[0]?.trim() || loc.province,
    capacity: loc.capacity,
    contact_person: loc.contactPerson,
    contact_phone: loc.contactPhone,
    coordinates: loc.coordinates,
  }))

  const sanitizedSlots = timeSlots.map((slot) => ({
    start_time: slot.startTime,
    end_time: slot.endTime,
    max_appointments: Number(slot.maxAppointments || 0),
  }))

  const payload = {
    route_name: routeName,
    description: description || undefined,
    start_date: format(startDate, 'yyyy-MM-dd'),
    end_date: format(endDate, 'yyyy-MM-dd'),
    province: selectedProvince,
    route_type: routeType,
    max_appointments_per_day: maxPerDay,
    locations: sanitizedLocations,  // ← LOCATIONS ARRAY SENT HERE
    time_slots: sanitizedSlots,     // ← TIME SLOTS SENT HERE
  }

  // Call API
  const resp = await apiService.createRoute(payload)
}
```

#### 1.4 API Call (lib/api-service.ts)

```typescript
async createRoute(payload: {
  route_name: string
  description?: string
  start_date: string
  end_date: string
  province: string
  route_type: string
  max_appointments_per_day: number
  locations: RouteLocation[]
  time_slots: TimeSlot[]
}): Promise<ApiResponse<Route>> {
  return this.post('/routes', payload)  // POST /api/routes
}
```

**Payload sent to backend:**
```json
{
  "route_name": "Eastern Cape Rural Clinic Route",
  "description": "Weekly visits to rural areas",
  "start_date": "2025-10-20",
  "end_date": "2025-12-31",
  "province": "Eastern Cape",
  "route_type": "Mixed",
  "max_appointments_per_day": 100,
  "locations": [
    {
      "name": "Umtata Police Station",
      "type": "police_station",
      "address": "Main Street, Umtata",
      "province": "Eastern Cape",
      "city": "Umtata",
      "capacity": 50,
      "contact_person": "John Doe",
      "contact_phone": "0123456789"
    }
  ],
  "time_slots": [
    {
      "start_time": "08:00",
      "end_time": "08:30",
      "max_appointments": 10
    }
  ]
}
```

---

## 2. BACKEND FLOW (Flask/Python)

### File: `scripts/app.py` (Lines 2634–2980)

#### 2.1 Route Creation Endpoint

```python
@app.route('/api/routes', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor'])
def create_route():
    """Create a new route with locations and time slots"""
```

#### 2.2 Request Parsing (Lines 2645–2745)

```python
data = request.get_json() or {}
route_name = str(data.get('route_name') or '').strip()
description = str(data.get('description') or '').strip()
start_date_obj = datetime.strptime(data.get('start_date'), '%Y-%m-%d').date()
end_date_obj = datetime.strptime(data.get('end_date'), '%Y-%m-%d').date()
province = str(data.get('province') or '').strip()
locations_payload = data.get('locations') or []  # ← Array of location objects from frontend
time_slots = data.get('time_slots') or []  # ← Array of time slots from frontend
```

**Critical check at line 2713:**
```python
if not locations_payload:
    logger.warning("No locations provided in route creation request")
    # Creates fallback locations if empty
    fallback_slots = [
        ('08:00', '08:30', 10),
        ('08:30', '09:00', 10),
    ]
    # If no locations provided, can still create route with default slots
```

#### 2.3 Insert Route into Database (Lines 2766–2783)

```python
insert_route_sql = """
    INSERT INTO routes (
        route_name, description, start_date, end_date, province,
        route_type, max_appointments_per_day, created_by, is_active
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, TRUE)
"""

cursor.execute(
    insert_route_sql,
    (
        route_name,
        description,
        start_date_obj,
        end_date_obj,
        province,
        route_type,
        max_appointments_per_day,
        user_id,  # Current logged-in user
    ),
)

route_id = cursor.lastrowid  # Get the newly created route_id
logger.info(f"Route inserted with id {route_id}")
```

**Database state after this step:**
```
✅ routes table: 1 new row with route_id, route_name, dates, province, etc.
❌ route_locations table: Still empty (will be populated in next loop)
❌ appointments table: Still empty (will be populated by stored proc)
```

#### 2.4 THE CRITICAL SECTION: Loop Through Locations (Lines 2785–2925)

```python
insert_route_location_sql = """
    INSERT INTO route_locations (
        route_id, location_id, visit_date, start_time, end_time,
        max_appointments, appointment_duration, notes
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
"""

for loc_payload in locations_payload:  # ← FOR EACH LOCATION FROM FRONTEND
    location_name = str(loc_payload.get('name') or '').strip()
    if not location_name:
        logger.warning(f"Skipping location without a name: {loc_payload}")
        continue

    # ... extract location details from payload ...

    # Step A: Check if location exists in locations table
    cursor.execute(
        "SELECT id FROM locations WHERE location_name = %s AND province = %s LIMIT 1",
        (location_name, loc_province),
    )
    existing_location = cursor.fetchone()

    if existing_location:
        location_id = existing_location['id']
        logger.info(f"Using existing location {location_id}: {location_name}")
    else:
        # Step B: Create new location in locations table
        location_type_id, canonical_type_name = resolve_location_type_id(cursor, loc_type_key)
        
        insert_location_sql = """
            INSERT INTO locations (
                location_name, location_type_id, province, city, address,
                gps_coordinates, contact_person, contact_phone, is_active
            ) VALUES (%s, %s, %s, %s, %s, ST_GeomFromText(%s), %s, %s, TRUE)
        """
        
        cursor.execute(
            insert_location_sql,
            (
                location_name,
                location_type_id,
                loc_province,
                loc_city,
                loc_address,
                wkt_point,
                contact_person,
                contact_phone,
            ),
        )
        
        location_id = cursor.lastrowid
        logger.info(f"Created new location {location_id} for {location_name}")

    # Step C: CREATE ROUTE_LOCATIONS FOR EACH DAY IN ROUTE DATE RANGE
    current_date = start_date_obj
    while current_date <= end_date_obj:
        cursor.execute(
            insert_route_location_sql,
            (
                route_id,                              # Which route
                location_id,                           # Which location
                current_date,                          # Which date (increments daily)
                aggregated_start_time.strftime('%H:%M:%S'),
                aggregated_end_time.strftime('%H:%M:%S'),
                max(loc_capacity, per_location_capacity),
                default_duration,
                description,
            ),
        )

        route_location_id = cursor.lastrowid
        logger.info(
            f"Route location {route_location_id} created for route {route_id} on {current_date}"
        )

        # Step D: CALL STORED PROCEDURE TO GENERATE APPOINTMENT SLOTS
        try:
            proc_cursor = connection.cursor()
            proc_cursor.callproc('sp_generate_appointment_slots', [route_location_id, None])
            proc_cursor.close()
            logger.info(f"Appointment slots generated for route_location {route_location_id}")
        except Exception as proc_err:
            logger.warning(
                f"Failed to auto-generate appointment slots for route_location {route_location_id}: {proc_err}"
            )

        route_locations_response.append({
            'route_location_id': route_location_id,
            'location_id': location_id,
            'name': location_name,
            'visit_date': current_date.isoformat(),
            'start_time': aggregated_start_time.strftime('%H:%M'),
            'end_time': aggregated_end_time.strftime('%H:%M'),
            'max_appointments': max(loc_capacity, per_location_capacity),
        })

        current_date += timedelta(days=1)  # ← LOOP TO NEXT DAY

    connection.commit()
```

**Database state after this loop:**
```
✅ routes table: 1 route
✅ locations table: 1+ locations (one per unique location in payload)
✅ route_locations table: N rows (one per location per day in date range)
✅ appointments table: M rows (generated by stored proc for each route_location)

Example:
- Route spans Oct 20 - Oct 24 (5 days)
- Route has 1 location
- Result: 5 route_locations created (one per day)
- Each route_location calls stored proc → creates appointments for each time slot
```

#### 2.5 Stored Procedure: sp_generate_appointment_slots

**File:** `scripts/SQL_FIXES_AND_OPTIMIZATIONS.sql` (Lines 39–75)

```sql
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
  
  -- Get route_location details
  SELECT visit_date, start_time, end_time, max_appointments, appointment_duration
  FROM route_locations
  WHERE id = p_route_location_id;
  
  -- Delete existing "available" slots to avoid duplicates
  DELETE FROM appointments 
  WHERE route_location_id = p_route_location_id 
    AND status = 'available';
  
  -- Generate new slots by dividing time window into chunks
  -- If appointment_duration = 30 mins, start_time = 08:00, end_time = 17:00
  -- Creates: 08:00-08:30, 08:30-09:00, 09:00-09:30, ..., 16:30-17:00
  
  LOOP
    IF v_slot_start >= v_end_time THEN
      LEAVE loop_label;
    END IF;
    
    INSERT INTO appointments (
      route_location_id,
      appointment_date,
      appointment_time,
      status,
      created_at
    ) VALUES (
      p_route_location_id,
      v_visit_date,
      v_slot_start,
      'available',  -- ← Each slot starts as 'available'
      NOW()
    );
    
    SET v_slot_start = ADDTIME(v_slot_start, v_appointment_duration_interval);
    SET v_rows_generated = v_rows_generated + 1;
  END LOOP;
  
  SET p_result = CONCAT('Generated ', v_rows_generated, ' appointment slots');
END;
```

**What this does:**
- Takes a `route_location_id`
- Reads start_time, end_time, appointment_duration from `route_locations`
- Divides the day into time slots (e.g., 30-min slots from 08:00–17:00 = 18 slots)
- Creates one row in `appointments` for each slot with status='available'
- When a patient books, status changes to 'booked'

**Example output:**
```
route_location_id=1, visit_date=2025-10-20
start_time=08:00, end_time=17:00, appointment_duration=30

Creates appointments:
1. appointment_id=1, time=08:00, status=available
2. appointment_id=2, time=08:30, status=available
3. appointment_id=3, time=09:00, status=available
...
18. appointment_id=18, time=16:30, status=available
```

#### 2.6 Final Response (Lines 2945–2975)

```python
connection.commit()

# Query the created route for response
cursor.execute(
    """
    SELECT 
        id, route_name AS name, route_name, description, province,
        start_date, end_date, route_type, max_appointments_per_day,
        CASE 
            WHEN is_active = TRUE AND CURDATE() BETWEEN start_date AND end_date THEN 'active'
            WHEN is_active = TRUE AND CURDATE() < start_date THEN 'published'
            WHEN CURDATE() > end_date THEN 'completed'
            WHEN is_active = FALSE THEN 'draft'
            ELSE 'draft'
        END AS status
    FROM routes WHERE id = %s
    """,
    (route_id,),
)
route_row = cursor.fetchone() or {}

return jsonify({
    'success': True,
    'data': {
        **route_row,
        'locations': route_locations_response,  # ← All created route_locations
        'time_slots': response_time_slots,      # ← All time slot definitions
    },
    'message': 'Route created successfully',
}), 201
```

**Response to frontend:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "route_name": "Eastern Cape Rural Route",
    "description": "Weekly visits",
    "province": "Eastern Cape",
    "start_date": "2025-10-20",
    "end_date": "2025-10-24",
    "route_type": "Mixed",
    "max_appointments_per_day": 100,
    "status": "published",
    "locations": [
      {
        "route_location_id": 10,
        "location_id": 5,
        "name": "Umtata Police Station",
        "visit_date": "2025-10-20",
        "start_time": "08:00",
        "end_time": "17:00",
        "max_appointments": 50
      },
      {
        "route_location_id": 11,
        "location_id": 5,
        "name": "Umtata Police Station",
        "visit_date": "2025-10-21",
        "start_time": "08:00",
        "end_time": "17:00",
        "max_appointments": 50
      }
    ],
    "time_slots": [
      { "start_time": "08:00", "end_time": "08:30", "max_appointments": 10 }
    ]
  }
}
```

---

## 3. DATABASE SCHEMA RELATIONSHIPS

### Table Structure After Route Creation:

```
┌─────────────────────────────────────────────────────────────┐
│                        ROUTES                                │
├─────────────────────────────────────────────────────────────┤
│ id (PK)      │ route_name              │ status     │ ...   │
│ 1            │ "Eastern Cape Route"    │ published  │       │
└─────────────────────────────────────────────────────────────┘
        ↓ (1:N relationship via route_id)
        │
┌─────────────────────────────────────────────────────────────┐
│                    ROUTE_LOCATIONS                           │
├─────────────────────────────────────────────────────────────┤
│ id(PK)│route_id│location_id│visit_date │start_time│end_time│
│ 10    │ 1      │ 5         │ 2025-10-20│ 08:00    │ 17:00  │
│ 11    │ 1      │ 5         │ 2025-10-21│ 08:00    │ 17:00  │
│ 12    │ 1      │ 5         │ 2025-10-22│ 08:00    │ 17:00  │
└─────────────────────────────────────────────────────────────┘
        ↓ (1:N relationship via route_location_id)
        │
┌─────────────────────────────────────────────────────────────┐
│                    APPOINTMENTS                              │
├─────────────────────────────────────────────────────────────┤
│ id(PK)│route_location_id│appointment_time│status   │patient_id│
│ 100   │ 10              │ 08:00           │available│ NULL     │
│ 101   │ 10              │ 08:30           │available│ NULL     │
│ 102   │ 10              │ 09:00           │available│ NULL     │
│ ...                                                          │
│ 200   │ 11              │ 08:00           │available│ NULL     │
└─────────────────────────────────────────────────────────────┘
        ↓ (1:N relationship via location_id)
        │
┌─────────────────────────────────────────────────────────────┐
│                     LOCATIONS                                │
├─────────────────────────────────────────────────────────────┤
│ id(PK)│location_name           │city    │province      │type│
│ 5     │"Umtata Police Station" │Umtata  │Eastern Cape  │... │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. ANSWER TO "WHY DUPLICATE TABLES?"

### Why we have routes + route_locations + locations + location_types

| Table | Purpose | Grain | Example |
|-------|---------|-------|---------|
| **location_types** | Lookup/reference | 1 per type | "Police Station", "School", "Community Center" |
| **locations** | Master data | 1 per unique physical location | "Umtata Police Station" (id=5) |
| **routes** | Campaign/schedule | 1 per route plan | "Eastern Cape Rural Route" (Oct 20-24) |
| **route_locations** | Journey record | 1 per location per day | "Umtata Police Station on Oct 20" (links route 1 to location 5 for that day) |
| **appointments** | Booking slots | 1 per time slot | "Oct 20 08:00-08:30 at Umtata" (available/booked) |

**Why NOT collapse them?**
- If routes had dates and locations directly, you can't reuse the same location in multiple routes
- If appointments directly linked to routes, you lose granularity (which date? which location?)
- `location_types` is reference data needed for filtering and UI display
- Each layer has different cardinality and lifecycle

---

## 5. THE ACTUAL PROBLEM: WHY route_locations IS EMPTY

### Azure Database Findings (from diagnostic queries):

| Item | Expected | Actual | Status |
|------|----------|--------|--------|
| Routes table | 1+ rows | **11 rows** ✅ | Created OK |
| Locations table | 1+ rows | **10 rows** ✅ | Created OK |
| route_locations | 5+ rows (5 days × 1+ locations) | **0 rows** ❌ | EMPTY |
| appointments | 20+ rows (per route_location) | **0 rows** ❌ | EMPTY |

### Likely Cause: Routes Created WITHOUT Locations

**Hypothesis:** Staff members are creating routes on the Azure portal **but not providing any locations** in the payload. This triggers these code paths:

1. **Frontend doesn't validate:** If staff skips "Add Location" step and clicks "Create Route", the `locations` array is empty.
2. **Backend fallback at line 2713:** Code tries to handle this:
   ```python
   if not sanitized_slots:
       fallback_slots = [...]
       # Creates defaults if UI omitted slots
   ```
   But this is for time slots, not locations.
3. **Loop at line 2790:** 
   ```python
   for loc_payload in locations_payload:  # ← Empty array, loop never executes
       # route_locations never inserted
   ```
4. **Result:** Route is created, but no route_locations, and no appointments.

---

## 6. SOLUTIONS

### Solution A: Require Locations (Better UX)

**Frontend validation** (in `route-planner.tsx`):
```typescript
const createRoute = async () => {
  const missingLocations = locations.length === 0
  if (!isEditing && missingLocations) {
    toast({
      title: "Missing locations",
      description: "You must add at least one location to the route.",
      variant: "destructive",
    })
    return  // Prevent submission
  }
  // ... proceed to API call
}
```

**Backend validation** (in `app.py`):
```python
if not locations_payload:
    return jsonify({
        'success': False,
        'error': 'At least one location must be provided'
    }), 400
```

### Solution B: Auto-Create Default Location

If staff forgets locations, auto-create one:
```python
if not locations_payload:
    logger.warning("No locations provided; creating default location for route")
    locations_payload = [{
        'name': f"{province} Main Clinic",
        'type': 'community_center',
        'address': f"{province} Central Location",
        'province': province,
        'capacity': max_appointments_per_day,
    }]
```

### Solution C: Populate route_locations Now

**For existing empty routes on Azure:**

```sql
-- Find an active route
SELECT id, route_name, start_date, end_date FROM routes 
WHERE is_active = 1 AND status IN ('active', 'published') 
LIMIT 1;

-- Example result: id=1, start_date=2025-10-17, end_date=2025-12-31

-- Pick any location
SELECT id FROM locations LIMIT 1;
-- Example: id=5 (Umtata Police Station)

-- Insert route_locations for this route + location for today onwards
INSERT INTO route_locations (route_id, location_id, visit_date, start_time, end_time, max_appointments, appointment_duration, notes)
SELECT 
    1 as route_id,
    5 as location_id,
    CURDATE() + INTERVAL seq-1 DAY as visit_date,
    '08:00:00' as start_time,
    '17:00:00' as end_time,
    10 as max_appointments,
    30 as appointment_duration,
    'Auto-populated' as notes
FROM (
    SELECT 1 as seq UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
) days
WHERE CURDATE() + INTERVAL seq-1 DAY <= '2025-12-31';

-- Call stored proc for each created route_location
CALL sp_generate_appointment_slots(LAST_INSERT_ID(), @result);
```

---

## 7. FLOW DIAGRAM

```
┌────────────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 1. User fills form: route name, dates, province                 │  │
│  │ 2. User clicks "+ Add Location" (optional step)                 │  │
│  │    - If skipped: locations array remains []                     │  │
│  │    - If done: locations array populated                         │  │
│  │ 3. User clicks "Create Route"                                   │  │
│  │ 4. Frontend validates (MISSING: locations validation)           │  │
│  │ 5. Call POST /api/routes with payload including locations       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ POST /api/routes
                                    ↓
┌────────────────────────────────────────────────────────────────────────┐
│                    BACKEND (Flask)                                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 1. Parse request: extract route_name, start_date, locations    │  │
│  │ 2. INSERT routes table → get route_id                          │  │
│  │ 3. FOR EACH location in locations_payload:                     │  │
│  │    a. Check if location exists in locations table              │  │
│  │    b. If not, INSERT into locations table → get location_id    │  │
│  │    c. FOR EACH day from start_date to end_date:               │  │
│  │       - INSERT into route_locations (route_id, location_id)   │  │
│  │       - Get route_location_id                                  │  │
│  │       - CALL sp_generate_appointment_slots(route_location_id)  │  │
│  │         → Generates appointments for all time slots            │  │
│  │ 4. COMMIT transaction                                           │  │
│  │ 5. Return 201 with route, locations, and slots created         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 201 OK
                                    ↓
┌────────────────────────────────────────────────────────────────────────┐
│                    DATABASE (Azure MySQL)                              │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ ✅ routes: 1 new row                                             │  │
│  │ ✅ locations: 1 new row (if location didn't exist)              │  │
│  │ ✅ route_locations: N rows (1 per day in date range)            │  │
│  │    route_locations.id = 100, 101, 102, ...                      │  │
│  │ ✅ appointments: M rows (sp_generate_appointment_slots output)   │  │
│  │    One row per time slot per route_location                     │  │
│  │    All start as status='available'                               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Patient books appointment
                                    ↓
┌────────────────────────────────────────────────────────────────────────┐
│                    PATIENT PORTAL                                      │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ GET /api/patient-portal/appointments/available/<patient_id>    │  │
│  │ - Queries: route_locations JOIN routes JOIN appointments       │  │
│  │ - Filters: status='active', visit_date >= TODAY                │  │
│  │ - Returns: available_slots per route_location                  │  │
│  │                                                                  │  │
│  │ ❌ IF route_locations is empty → Returns 0 slots               │  │
│  │ ✅ IF route_locations populated → Returns available slots      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 8. SUMMARY

| Component | Status | Issue | Fix |
|-----------|--------|-------|-----|
| **Frontend** | ✅ Works | Doesn't force user to add locations | Add validation requiring min 1 location |
| **Backend** | ✅ Works | Doesn't validate locations payload | Add check: return 400 if empty |
| **Stored Proc** | ✅ Works | N/A | N/A |
| **Azure DB** | ❌ Empty route_locations | Routes created without locations | Populate route_locations manually or recreate routes with locations |

**Why patient portal shows 0 slots:** `route_locations` table has 0 rows. The query needs route_locations to exist in order to return any appointments. Staff must add locations when creating routes.

