# Why 4 Location Tables? (Not Duplication—Normalization)

**Short Answer:** Each table has a different purpose and level of granularity. They're NOT duplicates; they form a **normalized hierarchy**.

---

## The 4 Tables Explained

### Table 1: `location_types` (Lookup Reference)

**Purpose:** Define valid location categories
**Rows:** ~3-5 (police_station, school, community_center, clinic, etc.)
**Unique Data:**
```sql
id  | type_name           | description
----|---------------------|-------------------------
1   | Police Station      | Government police stations
2   | School              | Educational institutions
3   | Community Center    | Community/public spaces
4   | Clinic              | Health facilities
5   | NGO Center          | Non-profit organizations
```

**Used For:** 
- UI dropdowns when creating routes
- Filtering by location type
- Categorizing locations
- Reports: "How many appointments at schools vs police stations?"

**Why separate table?**
- Reusable: All locations reference one of these types
- Maintainable: Update type name in one place, applies to all locations
- Queryable: Find all locations of a certain type

---

### Table 2: `locations` (Master Data)

**Purpose:** Store unique physical locations (Places)
**Rows:** ~10-100 (one per physical place)
**Unique Data:**
```sql
id  | location_name              | location_type_id | province    | city     | address
----|----------------------------|------------------|-------------|----------|------------------
1   | Umtata Police Station      | 1                | Eastern Cape| Umtata   | 123 Main St
2   | Butterworth Police Station | 1                | Eastern Cape| Butter.. | 456 Elm Ave
3   | Umtata High School         | 2                | Eastern Cape| Umtata   | 789 King Rd
4   | Lusikisiki Community Cntr   | 3                | Eastern Cape| Lusiki..| 321 Oak Ln
```

**Used For:**
- Reusing locations across multiple routes
- Storing location contact info
- Geographic/spatial queries
- Building routes without entering location details repeatedly

**Why separate table?**
- Deduplication: "Umtata Police Station" stored once, referenced many times
- Reusability: Same location can be part of multiple routes
- Maintenance: Update address in one place
- Referential integrity: Ensure locations exist before using them

---

### Table 3: `routes` (Campaign/Schedule Master)

**Purpose:** Define when and what type of route
**Rows:** ~11 (one per route plan)
**Unique Data:**
```sql
id  | route_name                    | start_date   | end_date     | province    | max_appointments_per_day | is_active | status
----|-------------------------------|--------------|--------------|-------------|--------------------------|-----------|----------
1   | Eastern Cape Rural Route      | 2025-10-20   | 2025-12-31   | Eastern Cape| 100                      | 1         | active
2   | Western Cape Urban Route      | 2025-10-15   | 2025-11-30   | Western Cape| 80                       | 1         | published
3   | Gauteng Emergency Route       | 2025-10-17   | 2025-10-31   | Gauteng     | 120                      | 1         | active
```

**Used For:**
- High-level route planning
- Setting capacity constraints
- Tracking route status (draft → published → active → completed)
- Reports: "How many routes per province?"
- Publish/unpublish routes

**Why separate table?**
- Aggregation: One route can have multiple days and locations
- Status tracking: Different routes in different lifecycle states
- Capacity planning: Define max appointments per day for the entire route
- Reusability: Route definition separate from execution (locations/dates)

---

### Table 4: `route_locations` (Journey Record - THE LINK)

**Purpose:** Specify which location the route visits on which date
**Rows:** ~5+ per route (one per location per day)
**Unique Data:**
```sql
id  | route_id | location_id | visit_date   | start_time | end_time | max_appointments | appointment_duration
----|----------|-------------|--------------|------------|----------|------------------|---------------------
10  | 1        | 1           | 2025-10-20   | 08:00:00   | 17:00:00 | 50               | 30 (minutes)
11  | 1        | 1           | 2025-10-21   | 08:00:00   | 17:00:00 | 50               | 30
12  | 1        | 1           | 2025-10-22   | 08:00:00   | 17:00:00 | 50               | 30
13  | 1        | 2           | 2025-10-23   | 09:00:00   | 16:00:00 | 40               | 30 (different location same day!)
14  | 1        | 2           | 2025-10-24   | 09:00:00   | 16:00:00 | 40               | 30
```

**Used For:**
- **THE CRITICAL TABLE** for patient portal: shows available slots
- Linking routes to locations for specific dates
- Overriding times/capacity per day (e.g., shorter hours on Friday)
- Capacity per visit: "50 appointments at location 1 on Oct 20"
- Generating appointment slots

**Why separate table?**
- M:N mapping: Many routes can have many locations on many dates
- Temporal specificity: Same route can visit same location on different dates
- Flexibility: Can adjust times/capacity for specific visits
- Queryable granularity: Find all visits on a specific date

---

### Table 5: `appointments` (Booking Slots)

**Purpose:** Individual appointment time slots available for booking
**Rows:** ~90+ (one per time slot per route_location)
**Unique Data:**
```sql
id  | route_location_id | appointment_date | appointment_time | status    | patient_id
----|-------------------|------------------|------------------|-----------|----------
100 | 10                | 2025-10-20       | 08:00:00         | available | NULL
101 | 10                | 2025-10-20       | 08:30:00         | available | NULL
102 | 10                | 2025-10-20       | 09:00:00         | booked    | 5
103 | 10                | 2025-10-20       | 09:30:00         | available | NULL
... | ...               | ...              | ...              | ...       | ...
200 | 11                | 2025-10-21       | 08:00:00         | available | NULL
```

**Used For:**
- Patient portal: "What slots can I book?"
- Capacity tracking: "How many slots are available vs booked?"
- Booking: Patient selects a slot → status changes to 'booked' + patient_id added
- Reporting: "Utilization percentage per location"

**Why separate table?**
- Granularity: Each individual slot is a booking unit, not the day
- State tracking: Each slot can be available/booked/completed/no-show/cancelled
- Performance: Query only the slots matching patient's location/date preferences
- Flexibility: Can have different capacity per slot (e.g., 10 appointments at 08:00, only 5 at 16:30)

---

## Relational Hierarchy Diagram

```
location_types (Lookup)
    ↑
    | 1:N (many locations per type)
    |
locations (Master)
    ↑
    | N:M (many routes can visit many locations on many dates)
    |
    +←→ routes (Campaign)
    |
route_locations (Journey Record - THE PIVOT TABLE)
    ↑
    | 1:N (many appointments per route_location)
    |
appointments (Booking Slots)
```

**Example path:**
```
Police Station (type_id=1)
    ↑
    |
Umtata Police Station (location_id=1)
    ↑
    | Visited by...
    |
Eastern Cape Route (route_id=1) ←→ Umtata Police Station on Oct 20 (route_location_id=10)
                                        ↓
                                        08:00 slot (appointment_id=100)
                                        08:30 slot (appointment_id=101)
                                        09:00 slot (appointment_id=102)
                                        ... 15 more slots
```

---

## Why NOT Collapse Into One Table?

### ❌ Anti-Pattern: Everything in appointments

```sql
CREATE TABLE bad_appointments (
    id, route_id, location_id, location_name, location_type,
    location_address, location_type_id, location_type_name,
    route_name, start_date, end_date, province,
    appointment_date, appointment_time,
    status, patient_id, patient_name
);
```

**Problems:**
1. **Data duplication:** Location name stored 90 times (5 days × 18 slots)
2. **Update anomaly:** Update location name → must update 90 rows
3. **Storage waste:** 90 identical copies of "Umtata Police Station"
4. **Referential issues:** Delete a route? Delete 90 appointment rows?
5. **Query complexity:** Hard to find "which routes use which locations?"
6. **Inflexibility:** Can't define route dates without location details

---

## Example Queries Show Why Normalization Matters

### Query 1: "What locations does Route 1 visit?"

**Normalized (✅ Clean):**
```sql
SELECT DISTINCT l.location_name, l.city, l.province
FROM route_locations rl
JOIN locations l ON rl.location_id = l.id
WHERE rl.route_id = 1;

Result: 1-3 rows (each unique location once)
```

**Denormalized (❌ Messy):**
```sql
SELECT DISTINCT location_name, city, province
FROM bad_appointments
WHERE route_id = 1;

Result: 1-3 rows, but query had to scan 90 rows
```

---

### Query 2: "Show me availability per location per date"

**Normalized (✅ Clean):**
```sql
SELECT 
    l.location_name,
    rl.visit_date,
    rl.max_appointments,
    COUNT(CASE WHEN a.status='booked' THEN 1 END) as booked,
    rl.max_appointments - COUNT(CASE WHEN a.status='booked' THEN 1 END) as available
FROM route_locations rl
JOIN locations l ON rl.location_id = l.id
LEFT JOIN appointments a ON rl.id = a.route_location_id
GROUP BY rl.id, l.location_name, rl.visit_date;

Result: Clean, fast, aggregates at the right level
```

**Denormalized (❌ Verbose):**
```sql
SELECT 
    location_name,
    appointment_date,
    COUNT(*) as total_slots,
    SUM(CASE WHEN status='booked' THEN 1 END) as booked,
    COUNT(*) - SUM(CASE WHEN status='booked' THEN 1 END) as available
FROM bad_appointments
GROUP BY location_name, appointment_date;

Result: Works, but limited flexibility for per-location-per-date overrides
```

---

### Query 3: "Reuse Umtata Police Station in 5 different routes"

**Normalized (✅ Easy):**
```sql
-- Umtata Police Station stored once with id=1
-- Create routes 1-5, each linking to location_id=1 via route_locations
INSERT INTO route_locations (route_id, location_id, visit_date, ...)
VALUES 
  (1, 1, '2025-10-20', ...),  -- Route 1 uses location 1
  (2, 1, '2025-10-21', ...),  -- Route 2 uses location 1
  (3, 1, '2025-10-22', ...),  -- Route 3 uses location 1
  (4, 1, '2025-10-23', ...),  -- Route 4 uses location 1
  (5, 1, '2025-10-24', ...);  -- Route 5 uses location 1
-- Only 1 location record
```

**Denormalized (❌ Repetitive):**
```sql
-- Umtata Police Station details stored 5 times across 450 appointment rows
INSERT INTO bad_appointments 
VALUES 
  (100, 1, 1, 'Umtata Police Station', 'Police Station', ...),
  (101, 1, 1, 'Umtata Police Station', 'Police Station', ...),
  ... (90 rows for Route 1)
  (200, 2, 1, 'Umtata Police Station', 'Police Station', ...),  -- Duplicate!
  ... (90 rows for Route 2)
  ... (360+ more duplicate rows)
```

---

## The Bottom Line

| Aspect | Why Separate Tables | Why NOT Combine |
|--------|-------------------|-----------------|
| **Reusability** | Location used in many routes | Data duplicated across routes |
| **Maintenance** | Update location once | Update location in 100+ rows |
| **Referential Integrity** | Foreign keys enforce consistency | No way to ensure location exists |
| **Scalability** | 10 locations × 100 routes = 1000 links | 100,000+ appointment rows with duplicate location data |
| **Flexibility** | Override capacity/times per day | No per-visit customization |
| **Query Performance** | Targeted queries on specific tables | Full scan of huge denormalized table |
| **Data Integrity** | No anomalies (ACID compliant) | Update/delete anomalies possible |

---

## Summary

✅ **Current design is correct normalization.** Not duplication.

❌ **The problem on Azure:** `route_locations` is empty because staff created routes without specifying locations, so the backend loop never executed.

**Fix:** Either manually populate `route_locations` for existing routes, or add frontend/backend validation to require locations when creating routes going forward.

