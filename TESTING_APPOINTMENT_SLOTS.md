# Testing Appointment Slot Generation Fix

## Quick Validation Steps

### Step 1: Verify Deployment
Check that the fix has been deployed to Azure:
```bash
# Should show your recent commit
git log --oneline -1
# Output: "f689820 Fix: Generate appointment slots directly in Python..."
```

### Step 2: Create a Test Route
Use this request to create a route with slots:

**Endpoint:** `POST https://app-polmed-backend-fmamhma6g4gngfey.southafricanorth-01.azurewebsites.net/api/routes`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo0MSwiZW1haWwiOiJhZG1pbi50ZXN0QHBvbG1lZC5jby56YSIsInJvbGUiOiJBZG1pbmlzdHJhdG9yIiwiZXhwIjoxNzYwNzg0MDYxLCJpYXQiOjE3NjA2OTc2NjF9.rjD6FKeE7tR4KbaaytMXIkq960UIzha5-PMg_U5UnYA
```

**Body:**
```json
{
  "route_name": "Slot Generation Test - October 17",
  "description": "Testing appointment slot generation",
  "start_date": "2025-10-20",
  "end_date": "2025-10-22",
  "province": "KwaZulu-Natal",
  "route_type": "Police Stations",
  "max_appointments_per_day": 40,
  "locations": [
    {
      "name": "Test Clinic Location",
      "type": "community_center",
      "province": "KwaZulu-Natal",
      "city": "Pietermaritzburg",
      "address": "123 Test Street",
      "capacity": 40,
      "contact_person": "John Doe",
      "contact_phone": "+27123456789"
    }
  ],
  "time_slots": [
    {
      "start_time": "08:00",
      "end_time": "08:30",
      "max_appointments": 10
    },
    {
      "start_time": "08:30",
      "end_time": "09:00",
      "max_appointments": 10
    },
    {
      "start_time": "09:00",
      "end_time": "09:30",
      "max_appointments": 10
    },
    {
      "start_time": "09:30",
      "end_time": "10:00",
      "max_appointments": 10
    }
  ]
}
```

**Expected Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "route_name": "Slot Generation Test - October 17",
    "locations": [
      {
        "route_location_id": 456,
        "location_id": 789,
        "name": "Test Clinic Location",
        "visit_date": "2025-10-20",
        "max_appointments": 40,
        "appointment_duration": 30,
        ...
      }
    ],
    ...
  },
  "message": "Route created successfully"
}
```

**Save the response** - we'll need the route_id to verify slots were created.

### Step 3: Verify Slots in Database

Check the Azure database directly using MySQL client:

```sql
-- Get the route_id from previous response
SET @route_id = 123;  -- Replace with actual route_id

-- Count appointments created
SELECT COUNT(*) as total_slots
FROM appointments a
JOIN route_locations rl ON a.route_location_id = rl.id
WHERE rl.route_id = @route_id;

-- Expected: 12 slots (4 time slots × 3 days)

-- View the actual slots
SELECT 
  a.id,
  a.appointment_id,
  a.route_location_id,
  a.appointment_time,
  a.duration_minutes,
  a.status,
  rl.visit_date
FROM appointments a
JOIN route_locations rl ON a.route_location_id = rl.id
WHERE rl.route_id = @route_id
ORDER BY rl.visit_date, a.appointment_time;

-- Expected output:
-- id  | appointment_id | route_location_id | appointment_time | duration | status    | visit_date
-- 1   | NULL           | 456               | 08:00:00         | 30       | Available | 2025-10-20
-- 2   | NULL           | 456               | 08:30:00         | 30       | Available | 2025-10-20
-- 3   | NULL           | 456               | 09:00:00         | 30       | Available | 2025-10-20
-- 4   | NULL           | 456               | 09:30:00         | 30       | Available | 2025-10-20
-- ... (8 more for days 2 and 3)
```

### Step 4: Test Patient Portal API

Call the patient availability endpoint:

**Endpoint:** `GET https://app-polmed-backend.../api/patient-portal/appointments/available/123?date_from=2025-10-20&date_to=2025-10-22`

**Headers:**
```
Authorization: Bearer <patient_portal_token>
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "appointment_id": 1,
      "route_location_id": 456,
      "appointment_date": "2025-10-20",
      "appointment_time": "08:00",
      "location_name": "Test Clinic Location",
      "city": "Pietermaritzburg",
      "province": "KwaZulu-Natal",
      "available_slots": 1,
      "distance_km": 0,
      ...
    },
    ... (11 more slots)
  ],
  "total": 12
}
```

**✅ If you see 12 slots, the fix is working!**

### Step 5: Test Booking

Try to book one of the slots:

**Endpoint:** `POST https://app-polmed-backend.../api/patient-portal/appointments/book`

**Body:**
```json
{
  "patient_id": 123,
  "appointment_id": 1,
  "patient_notes": "Test booking"
}
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "booking_reference": "POLM-20251017-001",
    "confirmation_sent": true
  }
}
```

---

## Troubleshooting

### Issue: Still seeing 0 slots
**Possible causes:**
1. ❌ Deployment not complete yet - wait 5-10 minutes
2. ❌ Cached data in browser - clear localStorage and refresh
3. ❌ Date filter too restrictive - try wider date range
4. ❌ Route status not 'active' - check route.is_active = 1 in DB

**Check logs:**
```bash
# View Azure App Service logs
az webapp log tail --resource-group <rg> --name app-polmed-backend-fmamhma6g4gngfey
```

### Issue: Slots appear but booking fails
**Check:**
- Patient ID matches route_location location
- Appointment status is 'Available' (not 'Booked')
- No database constraints preventing booking

### Issue: Wrong number of slots
**Verify calculation:**
- Number of days: end_date - start_date + 1
- Slots per day: (end_time - start_time) / duration_minutes
- Total: days × slots_per_day

Example:
- 3 days (Oct 20-22) × 4 slots per day = 12 total ✅

---

## Success Criteria ✅

After deploying the fix, you should see:

| Metric | Expected | Status |
|--------|----------|--------|
| Routes create without errors | ✅ 201 response | |
| Appointment slots inserted | ✅ 12 for 3-day route | |
| Patient portal shows slots | ✅ Non-empty list | |
| Slots are bookable | ✅ Can reserve | |
| Booking creates reference | ✅ POLM-YYYYMMDD-NNN | |
| Booked slots not shown again | ✅ Updated counts | |

---

## Rollback Instructions (if needed)

If issues occur, rollback to previous commit:
```bash
git revert f689820
git push azure
```

This will revert back to the stored procedure approach (which also doesn't work, but at least won't create new broken routes).
