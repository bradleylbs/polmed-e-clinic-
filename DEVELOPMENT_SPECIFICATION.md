# Patient Portal Appointment System - Development Specification

**Document Version:** 1.0  
**Last Updated:** 2025  
**Status:** Complete Implementation

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Patient Appointment System](#patient-appointment-system)
4. [Staff & Clinical Workflows](#staff--clinical-workflows)
5. [Route Planning & Management](#route-planning--management)
6. [Inventory Management](#inventory-management)
7. [Admin Dashboard & User Management](#admin-dashboard--user-management)
8. [Offline Synchronization](#offline-synchronization)
9. [API Specifications](#api-specifications)
10. [Database Schema](#database-schema)
11. [Frontend Components](#frontend-components)
12. [Implementation Patterns](#implementation-patterns)
13. [Error Handling & Validation](#error-handling--validation)
14. [Security Considerations](#security-considerations)
15. [Future Enhancements](#future-enhancements)

---

## 1. System Overview

### Project Description
 POLMED Clinic ERP is a comprehensive healthcare management system designed for South African mobile clinics operated by the Palmed organization. The system manages patient appointments, clinical visits, inventory, and staff workflows across multiple clinic locations and routes.

### Key Features

- **Patient Portal**: Self-service appointment booking and management
- **Route Planning**: Multi-location clinic schedules with appointment slots
- **Clinical Workflows**: Visit management with staged clinical assessments
- **Inventory Management**: Consumables, assets, and stock tracking
- **Offline Capabilities**: Full sync support for offline operations
- **POLMED Integration**: Member lookup and sync with South African medical aid

### Target Users

- **Patients**: Self-service portal for appointment booking and management
- **Clinic Staff**: Clerks, nurses, doctors for visit management
- **Administrative**: Route planning, inventory, user management

### Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Frontend | Next.js + React + TypeScript | Latest |
| UI Framework | Shadcn UI | Latest |
| Backend API | Flask + Python | 3.9+ |
| Database | MySQL | 8.0+ |
| Hosting | Azure (Static Web App + App Service) | Current |
| Authentication | JWT Tokens | HS256 |

---

## 2. Architecture

### 2.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Patient Portal (Client)                      │
│  (Next.js/React/TypeScript + Shadcn UI Components)              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ├─ Authentication (JWT Token in localStorage)                  │
│  ├─ Appointment Booking UI                                      │
│  ├─ Your Appointments Display & Management                      │
│  └─ Offline Data Sync Manager                                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↕ (HTTP REST)
┌─────────────────────────────────────────────────────────────────┐
│                    Flask Python API Backend                       │
│              (db-polmed.mysql.database.azure.com)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ├─ Authentication Module (JWT validation)                      │
│  ├─ Patient Portal Routes                                       │
│  │  ├─ /patient-portal/dashboard/{patient_id}                  │
│  │  ├─ /patient-portal/appointments/available/{patient_id}     │
│  │  └─ /patient-portal/appointments/{appointment_id}/book      │
│  │  └─ /patient-portal/appointments/{appointment_id}/cancel    │
│  ├─ Route Management                                            │
│  ├─ Appointment Management                                      │
│  ├─ Patient Management                                          │
│  └─ Clinical Workflows                                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↕ (SQL)
┌─────────────────────────────────────────────────────────────────┐
│               Azure MySQL Database Backend                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Core Tables:                                                    │
│  ├─ patients                  (Patient demographics)             │
│  ├─ patient_appointments      (Appointment records)             │
│  ├─ patient_authentication    (Auth credentials)                │
│  ├─ routes                    (Clinic routes/schedules)         │
│  ├─ route_locations           (Specific clinic locations)       │
│  ├─ locations                 (Location master data)            │
│  ├─ patient_visits            (Clinical visit records)          │
│  ├─ vital_signs               (Patient vitals)                  │
│  ├─ clinical_notes            (Doctor/nurse notes)              │
│  ├─ consumables               (Inventory items)                 │
│  ├─ inventory_stock           (Stock batches)                   │
│  └─ [Additional 40+ tables for full ERP]                        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow - Appointment Booking

```
Patient Portal UI
    ↓
[1] Load Available Appointments
    ├→ GET /patient-portal/appointments/available/{patient_id}
    ├→ Backend queries patient_appointments with status='Available'
    └→ Client-side deduplication (Set with composite key)
    ↓
[2] Display Available Slots (Deduplicated)
    ├→ Filter by province, date range, location
    └→ Show location, date, time, availability
    ↓
[3] Select & Book Appointment
    ├→ POST /patient-portal/appointments/{appointment_id}/book
    ├→ Call sp_book_appointment stored procedure
    ├→ Update patient_appointments status='Booked'
    └→ Generate booking_reference
    ↓
[4] Display Confirmation
    ├→ Show booking_reference
    ├→ Load "Your Appointments" section
    └→ Call loadUpcomingAppointments()
    ↓
[5] Cancel Appointment (Optional)
    ├→ POST /patient-portal/appointments/{appointment_id}/cancel
    ├→ Update status='Cancelled'
    └→ Refresh display
```

### 2.3 Component Interaction

**Frontend Service Layer:**
- `patient-portal-service.ts` - Wraps all patient portal API calls
- `api-service.ts` - Base HTTP request handler with auth token injection
- `offline-manager.ts` - Manages offline sync queue

**Backend Service Layer:**
- Route handlers in `app.py` decorated with:
  - `@token_required` - JWT validation
  - `@role_required(['role1', 'role2'])` - RBAC enforcement
- Database abstraction via `DatabaseManager` class

---

## 3. Patient Appointment System

### 3.1 Business Rules

#### Appointment Status Lifecycle

```
Available → Booked → Confirmed → Completed
   ↓           ↓          ↓          ↓
   └─ Cancelled ←─────────┘          └─ No Show
```

**Status Definitions:**
- `Available` - Slot open for booking (patient_id = NULL)
- `Booked` / `Scheduled` - Patient has booked this slot (patient_id assigned)
- `Confirmed` - Clinic confirmed attendance (alternative status in some routes)
- `Completed` - Visit completed by clinic staff
- `Cancelled` - Cancelled by patient or clinic
- `No Show` - Patient did not attend

> **Note:** Database uses mixed naming (`Booked` / `Scheduled`). Frontend handles both.

#### Appointment Slot Generation

**Process:**
1. Route created with start_date → end_date and location schedule
2. For each location and date in range:
   - Create route_location record
   - Call `sp_generate_appointment_slots` stored procedure
   - Procedure generates Available slots based on time_slots configuration

**Slot Configuration Example:**
```json
{
  "time_slots": [
    {"start_time": "08:00", "end_time": "08:30", "max_appointments": 10},
    {"start_time": "08:30", "end_time": "09:00", "max_appointments": 10},
    {"start_time": "09:00", "end_time": "09:30", "max_appointments": 10}
  ]
}
```

#### Deduplication Strategy

**Root Cause:** Database may contain multiple Available slots for same (route_location_id, date, time) due to:
- Schema changes or data migration
- Concurrent slot generation
- Manual data entry errors

**Solution (Multi-Layer):**

1. **Database Level (Preventive):**
   - Unique index: `uniq_route_date_time` on (route_location_id, appointment_date, appointment_time)
   - Prevents new duplicates at database constraint level

2. **Client Level (UX):**
   - Set-based deduplication in `searchAppointments()` function
   - Removes duplicates before display to user
   - Keys: appointment_id (primary), or composite (route_location_id|date|time) fallback

3. **Script Level (Data Cleanup):**
   - `fix_patient_appointments.py` manually deduplicates existing data
   - Safe deletion: keeps booking rows, deletes Available surplus rows

### 3.2 Patient Appointment Booking Component

**File:** `components/patient-portal/patient-appointment-booking.tsx`

#### Component Structure

```typescript
interface UpcomingAppointment {
  id: number;
  booking_reference: string;
  appointment_date: string;
  appointment_time: string;
  location_name: string;
  city: string;
  province: string;
  status: string;
}

export default function PatientAppointmentBooking() {
  // State
  const [upcomingAppointments, setUpcomingAppointments] = useState<UpcomingAppointment[]>([]);
  const [availableAppointments, setAvailableAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  
  // Load Functions
  const loadUpcomingAppointments = async () => { ... };
  const searchAppointments = async (filters) => { ... };
  const handleCancelAppointment = async (appointmentId) => { ... };
  
  // Render
  return (
    <div>
      {/* Your Appointments Section */}
      {upcomingAppointments.length > 0 && (
        <Card>
          <CardHeader>Your Appointments</CardHeader>
          <CardContent>
            {upcomingAppointments.map(appt => (
              <div key={appt.id}>
                {/* Display appointment details */}
                {["scheduled", "booked", "confirmed"].includes(
                  (appt.status || "").toLowerCase()
                ) && (
                  <Button onClick={() => handleCancelAppointment(appt.id)}>
                    Cancel
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      
      {/* Find Available Appointments Section */}
      <Card>
        <CardHeader>Find Available Appointments</CardHeader>
        <CardContent>
          {/* Search filters */}
          {/* Deduplicated appointment list */}
        </CardContent>
      </Card>
    </div>
  );
}
```

#### Key Functions

**1. loadUpcomingAppointments()**
```typescript
async function loadUpcomingAppointments() {
  try {
    setLoadingAppointments(true);
    const dashboard = await patientPortalService.getPatientDashboard(patientId);
    const appointments = dashboard.upcoming_appointments || [];
    setUpcomingAppointments(appointments);
  } catch (error) {
    toast({ title: "Error", description: "Failed to load appointments" });
  } finally {
    setLoadingAppointments(false);
  }
}
```

**2. searchAppointments() - With Deduplication**
```typescript
async function searchAppointments(filters) {
  try {
    setLoading(true);
    const results = await patientPortalService
      .getAvailableAppointmentsForPatient(patientId, filters);
    
    // CLIENT-SIDE DEDUPLICATION
    const seenIds = new Set<number>();
    const seenCompositeKeys = new Set<string>();
    const deduplicated = [];
    
    for (const appt of results) {
      if (appt.appointment_id && !seenIds.has(appt.appointment_id)) {
        seenIds.add(appt.appointment_id);
        deduplicated.push(appt);
      } else {
        const compositeKey = 
          `${appt.route_location_id}|${appt.appointment_date}|${appt.appointment_time}`;
        if (!seenCompositeKeys.has(compositeKey)) {
          seenCompositeKeys.add(compositeKey);
          deduplicated.push(appt);
        }
      }
    }
    
    setAvailableAppointments(deduplicated);
  } catch (error) {
    toast({ title: "Error", description: "Search failed" });
  } finally {
    setLoading(false);
  }
}
```

**3. handleCancelAppointment()**
```typescript
async function handleCancelAppointment(appointmentId: number) {
  if (!confirm("Are you sure you want to cancel this appointment?")) return;
  
  try {
    setLoadingAppointments(true);
    const result = await patientPortalService
      .cancelAppointmentViaPortal(appointmentId, "Patient requested cancellation");
    
    if (result.cancelled) {
      toast({ title: "Success", description: "Appointment cancelled" });
      // Refresh both lists
      await Promise.allSettled([
        searchAppointments(currentFilters),
        loadUpcomingAppointments()
      ]);
    }
  } catch (error) {
    toast({ title: "Error", description: "Failed to cancel appointment" });
  } finally {
    setLoadingAppointments(false);
  }
}
```

### 3.3 Patient Portal Service Layer

**File:** `lib/patient-portal-service.ts`

#### API Methods

```typescript
export const patientPortalService = {
  // Get patient dashboard with upcoming appointments
  async getPatientDashboard(patientId: number) {
    return apiService.get(`/patient-portal/dashboard/${patientId}`);
  },

  // Search available appointments with filters
  async getAvailableAppointmentsForPatient(
    patientId: number,
    filters: {
      province?: string;
      city?: string;
      location_type?: string;
      date_from?: string;
      date_to?: string;
      max_distance_km?: number;
    }
  ) {
    const params = new URLSearchParams(
      Object.fromEntries(
        Object.entries(filters).filter(([_, v]) => v != null)
      )
    );
    return apiService.get(
      `/patient-portal/appointments/available/${patientId}?${params}`
    );
  },

  // Book an appointment
  async bookAppointmentViaPortal(
    appointmentId: number,
    patientId: number,
    notes?: string
  ) {
    return apiService.post(`/patient-portal/appointments/${appointmentId}/book`, {
      patient_id: patientId,
      notes: notes || ""
    });
  },

  // Cancel an appointment
  async cancelAppointmentViaPortal(appointmentId: number, reason: string) {
    return apiService.post(
      `/patient-portal/appointments/${appointmentId}/cancel`,
      { reason }
    );
  }
};
```

#### Authentication Flow

```typescript
// API Service automatically includes bearer token
const apiService = {
  async request(method: string, url: string, data?: any) {
    const token = localStorage.getItem("patient_portal_session");
    const headers = {
      "Content-Type": "application/json",
      ...(token && { "Authorization": `Bearer ${token}` })
    };
    
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined
    });
    
    if (response.status === 401) {
      // Token expired - redirect to login
      localStorage.removeItem("patient_portal_session");
      window.location.href = "/patient-portal/login";
    }
    
    return response.json();
  }
};
```

---

## 4. Staff & Clinical Workflows

### 4.1 Visit Management

**Visit Lifecycle:**
```
Registration → Nursing Assessment → Doctor Consultation → (Counseling) → File Closure
```

#### Visit Creation

**Endpoint:** `POST /api/patients/{patient_id}/visits`

**Request Body:**
```json
{
  "visit_date": "2025-02-15",
  "visit_time": "09:00:00",
  "route_id": 5,
  "location": "Johannesburg Clinic",
  "chief_complaint": "Hypertension follow-up"
}
```

**Database Entry:**
```sql
INSERT INTO patient_visits (
  patient_id, visit_date, visit_time, route_id, location, 
  chief_complaint, current_stage_id, created_by
) VALUES (123, '2025-02-15', '09:00:00', 5, 'Johannesburg Clinic', 
  'Hypertension follow-up', NULL, 1);
```

#### Workflow Stages

**Table:** `workflow_stages`

```sql
CREATE TABLE workflow_stages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  stage_name VARCHAR(100) NOT NULL,
  stage_order INT,
  required_role VARCHAR(50),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

-- Standard stages
INSERT INTO workflow_stages (stage_name, stage_order, required_role) VALUES
  ('Registration', 1, 'Clerk'),
  ('Nursing Assessment', 2, 'Nurse'),
  ('Doctor Consultation', 3, 'Doctor'),
  ('Counseling Session', 4, 'Social Worker'),
  ('File Closure', 5, 'Doctor');
```

**Progress Tracking:**
```sql
CREATE TABLE visit_workflow_progress (
  id INT PRIMARY KEY AUTO_INCREMENT,
  visit_id INT NOT NULL,
  stage_id INT NOT NULL,
  completed_by INT,
  completed_at DATETIME,
  notes TEXT,
  FOREIGN KEY (visit_id) REFERENCES patient_visits(id),
  FOREIGN KEY (stage_id) REFERENCES workflow_stages(id),
  FOREIGN KEY (completed_by) REFERENCES users(id)
);
```

### 4.2 Vital Signs Management

**Recording Vital Signs:**

```python
@app.route('/api/visits/<int:visit_id>/vital-signs', methods=['POST'])
@token_required
@role_required(['nurse', 'doctor'])
def add_vital_signs(visit_id: int):
    data = request.get_json()
    
    result = DatabaseManager.execute_query("""
        INSERT INTO vital_signs (
            visit_id, recorded_by, systolic_bp, diastolic_bp, heart_rate,
            temperature, weight, height, oxygen_saturation, blood_glucose,
            additional_measurements
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        visit_id, request.current_user['id'],
        data['systolic_bp'], data['diastolic_bp'], data['heart_rate'],
        data['temperature'], data['weight'], data['height'],
        data['oxygen_saturation'], data['blood_glucose'],
        json.dumps(data.get('additional_measurements', {}))
    ))
    
    return jsonify({'success': True, 'message': 'Vitals recorded'})
```

**Vital Signs Data:**
- Blood Pressure (Systolic/Diastolic)
- Heart Rate
- Temperature
- Weight & Height (BMI calculation)
- Oxygen Saturation
- Blood Glucose
- Additional: Respiratory Rate, etc.

**Validation Rules:**
- BP: Systolic 60-250, Diastolic 40-150
- HR: 40-200 bpm
- Temp: 35.0-42.0°C
- O2: 70-100%
- Weight: 20-300 kg
- Height: 100-250 cm

### 4.3 Clinical Notes & Assessments

**Clinical Note Types:**
```sql
CREATE TABLE clinical_notes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  visit_id INT NOT NULL,
  note_type ENUM(
    'Assessment',
    'Diagnosis',
    'Treatment',
    'Referral',
    'Counseling',
    'Closure'
  ),
  content TEXT NOT NULL,
  icd10_codes JSON,
  medications_prescribed JSON,
  follow_up_required BOOLEAN DEFAULT FALSE,
  follow_up_date DATE,
  reviewed_by INT,
  reviewed_at DATETIME,
  template_used VARCHAR(255),
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (visit_id) REFERENCES patient_visits(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
);
```

#### Creating Clinical Notes

**Endpoint:** `POST /api/visits/{visit_id}/clinical-notes`

**Request:**
```json
{
  "note_type": "Diagnosis",
  "content": "Patient presents with elevated BP and symptoms of hypertension",
  "icd10_codes": ["I10", "I11.9"],
  "medications_prescribed": ["Amlodipine 5mg OD", "Enalapril 10mg BD"],
  "follow_up_required": true,
  "follow_up_date": "2025-03-15"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "note_id": 789,
    "patient_id": 123
  }
}
```

#### Smart Suggestions

**AI-Powered Suggestions Engine:**

```python
@app.route('/api/smart-suggestions', methods=['POST'])
@token_required
@role_required(['doctor', 'nurse'])
def get_smart_suggestions():
    data = request.get_json()
    input_text = data.get('input_text', '').lower()
    patient_context = data.get('patient_context', {})
    
    suggestions = {
        'icd10_suggestions': [],
        'medication_suggestions': [],
        'investigation_suggestions': []
    }
    
    # Pattern matching for ICD-10 codes
    if 'hypertension' in input_text or 'high blood pressure' in input_text:
        suggestions['icd10_suggestions'].append({
            'code': 'I10',
            'description': 'Essential hypertension',
            'confidence': 0.95
        })
    
    if 'diabetes' in input_text or 'sugar' in input_text:
        suggestions['icd10_suggestions'].append({
            'code': 'E11.9',
            'description': 'Type 2 diabetes without complications',
            'confidence': 0.90
        })
    
    # Medication suggestions based on diagnoses
    if 'hypertension' in input_text:
        suggestions['medication_suggestions'].extend([
            {'drug': 'Amlodipine', 'strength': '5mg', 'frequency': 'OD'},
            {'drug': 'Enalapril', 'strength': '10mg', 'frequency': 'BD'}
        ])
    
    # Investigation suggestions
    if 'chest' in input_text or 'cardiac' in input_text:
        suggestions['investigation_suggestions'].extend([
            {'test': 'ECG (Electrocardiogram)', 'confidence': 0.85},
            {'test': 'Chest X-Ray', 'confidence': 0.80}
        ])
    
    return jsonify({'success': True, 'suggestions': suggestions})
```

### 4.4 Referrals Management

**Referral Types:**

```sql
CREATE TABLE referrals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  patient_id INT NOT NULL,
  visit_id INT,
  referral_type ENUM('internal', 'external'),
  from_stage VARCHAR(100),
  to_stage VARCHAR(100),  -- For internal referrals
  external_provider VARCHAR(255),  -- For external referrals
  department VARCHAR(100),
  reason TEXT NOT NULL,
  notes TEXT,
  status ENUM('pending', 'sent', 'accepted', 'completed', 'cancelled'),
  appointment_date DATE,
  created_by INT,
  updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (visit_id) REFERENCES patient_visits(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

**Creating a Referral:**

```python
@app.route('/api/patients/<int:patient_id>/referrals', methods=['POST'])
@token_required
@role_required(['doctor', 'social_worker'])
def create_referral(patient_id: int):
    data = request.get_json()
    
    # Internal referral: Social Worker → Counseling
    if data['referral_type'] == 'internal':
        result = DatabaseManager.execute_query("""
            INSERT INTO referrals (
                patient_id, visit_id, referral_type, from_stage, to_stage,
                reason, status, created_by
            ) VALUES (%s, %s, 'internal', %s, %s, %s, 'pending', %s)
        """, (
            patient_id, data.get('visit_id'), data['from_stage'],
            data['to_stage'], data['reason'], request.current_user['id']
        ))
    
    # External referral: To specialist or clinic
    else:
        result = DatabaseManager.execute_query("""
            INSERT INTO referrals (
                patient_id, visit_id, referral_type, external_provider,
                department, reason, appointment_date, status, created_by
            ) VALUES (%s, %s, 'external', %s, %s, %s, %s, 'pending', %s)
        """, (
            patient_id, data.get('visit_id'), data['external_provider'],
            data.get('department'), data['reason'],
            data.get('appointment_date'), request.current_user['id']
        ))
    
    return jsonify({'success': True, 'message': 'Referral created'})
```

---

## 5. Route Planning & Management

### 5.1 Route Lifecycle

**Route Workflow:**
```
Draft → Published (Schedule Posted) → Active (Clinic Running) → Completed (Archive)
```

### 5.2 Route Creation

**Endpoint:** `POST /api/routes`

**Complex Request with Multi-Location Scheduling:**

```json
{
  "route_name": "Gauteng February 2025",
  "description": "Mobile clinic across Gauteng province",
  "province": "Gauteng",
  "route_type": "Mixed",
  "start_date": "2025-02-01",
  "end_date": "2025-02-28",
  "max_appointments_per_day": 100,
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
    }
  ],
  "locations": [
    {
      "name": "Johannesburg Community Center",
      "province": "Gauteng",
      "city": "Johannesburg",
      "address": "123 Main Street",
      "type": "community_center",
      "capacity": 20,
      "contact_person": "John Manager",
      "contact_phone": "0712345678",
      "coordinates": {
        "lat": -26.2023,
        "lng": 28.0436
      }
    },
    {
      "name": "Pretoria Police Station",
      "province": "Gauteng",
      "city": "Pretoria",
      "address": "Police HQ",
      "type": "police_station",
      "capacity": 15,
      "contact_person": "Officer Smith",
      "contact_phone": "0123456789",
      "coordinates": {
        "lat": -25.7479,
        "lng": 28.2293
      }
    }
  ]
}
```

**Backend Processing:**

```python
@app.route('/api/routes', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor'])
def create_route():
    data = request.get_json()
    
    # Extract core route data
    route_name = data['route_name']
    start_date = datetime.fromisoformat(data['start_date']).date()
    end_date = datetime.fromisoformat(data['end_date']).date()
    province = data['province']
    time_slots = data.get('time_slots', [])
    locations_payload = data.get('locations', [])
    
    connection = DatabaseManager.get_connection()
    cursor = connection.cursor()
    
    try:
        # 1. Create route
        cursor.execute("""
            INSERT INTO routes (
                route_name, province, start_date, end_date,
                max_appointments_per_day, created_by, is_active
            ) VALUES (%s, %s, %s, %s, %s, %s, TRUE)
        """, (route_name, province, start_date, end_date, 
              data.get('max_appointments_per_day', 100), request.current_user['id']))
        
        route_id = cursor.lastrowid
        
        # 2. For each location
        for location_data in locations_payload:
            # Get or create location
            cursor.execute("""
                SELECT id FROM locations 
                WHERE location_name = %s AND province = %s
            """, (location_data['name'], province))
            existing = cursor.fetchone()
            
            if existing:
                location_id = existing['id']
            else:
                # Create new location
                cursor.execute("""
                    INSERT INTO locations (
                        location_name, location_type_id, province, city,
                        address, gps_coordinates, contact_person, contact_phone
                    ) VALUES (%s, %s, %s, %s, %s, ST_GeomFromText(%s), %s, %s)
                """, (
                    location_data['name'],
                    resolve_location_type_id(location_data['type']),
                    province,
                    location_data.get('city'),
                    location_data.get('address'),
                    f"POINT({location_data['coordinates']['lng']} {location_data['coordinates']['lat']})",
                    location_data.get('contact_person'),
                    location_data.get('contact_phone')
                ))
                location_id = cursor.lastrowid
            
            # 3. For each date in route
            current_date = start_date
            while current_date <= end_date:
                cursor.execute("""
                    INSERT INTO route_locations (
                        route_id, location_id, visit_date,
                        start_time, end_time, max_appointments,
                        appointment_duration
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (
                    route_id, location_id, current_date,
                    time_slots[0]['start_time'],
                    time_slots[-1]['end_time'],
                    location_data.get('capacity', 20),
                    30
                ))
                
                route_location_id = cursor.lastrowid
                
                # 4. Generate appointment slots
                cursor.callproc('sp_generate_appointment_slots', 
                               [route_location_id, 0])
                
                current_date += timedelta(days=1)
        
        connection.commit()
        return jsonify({'success': True, 'data': {'route_id': route_id}}), 201
        
    except Exception as e:
        connection.rollback()
        raise e
    finally:
        cursor.close()
        connection.close()
```

### 5.3 Stored Procedure: Appointment Slot Generation

```sql
DELIMITER $$

CREATE PROCEDURE sp_generate_appointment_slots(
    IN p_route_location_id INT,
    OUT p_result INT
)
BEGIN
    DECLARE v_visit_date DATE;
    DECLARE v_start_time TIME;
    DECLARE v_end_time TIME;
    DECLARE v_duration INT;
    DECLARE v_max_appointments INT;
    DECLARE v_current_time TIME;
    DECLARE v_appointment_counter INT;
    
    SELECT rl.visit_date, rl.start_time, rl.end_time, 
           rl.appointment_duration, rl.max_appointments
    INTO v_visit_date, v_start_time, v_end_time, 
         v_duration, v_max_appointments
    FROM route_locations rl
    WHERE rl.id = p_route_location_id;
    
    SET v_current_time = v_start_time;
    SET v_appointment_counter = 0;
    
    -- Generate slots in time blocks
    WHILE v_current_time < v_end_time AND v_appointment_counter < v_max_appointments DO
        INSERT INTO patient_appointments (
            route_location_id, appointment_date, appointment_time,
            appointment_duration, status
        ) VALUES (
            p_route_location_id, v_visit_date, v_current_time,
            v_duration, 'Available'
        );
        
        SET v_current_time = ADDTIME(v_current_time, CONCAT('0:', LPAD(v_duration, 2, '0'), ':00'));
        SET v_appointment_counter = v_appointment_counter + 1;
    END WHILE;
    
    SET p_result = v_appointment_counter;
END$$

DELIMITER ;
```

---

## 6. Inventory Management

### 6.1 Consumables vs Assets

**Consumables** - Used up during treatment:
- Medications
- Medical supplies (syringes, bandages)
- PPE
- Tests/diagnostics

**Assets** - Reusable equipment:
- Medical devices
- Vehicles
- Furniture
- IT equipment

### 6.2 Consumable Tracking

**Table:** `consumables`

```sql
CREATE TABLE consumables (
  id INT PRIMARY KEY AUTO_INCREMENT,
  item_code VARCHAR(50) UNIQUE NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  category_id INT,
  generic_name VARCHAR(255),
  strength VARCHAR(100),
  dosage_form VARCHAR(100),
  unit_of_measure VARCHAR(50),
  reorder_level INT DEFAULT 10,
  max_stock_level INT DEFAULT 1000,
  storage_temperature_min DECIMAL(5,2),
  storage_temperature_max DECIMAL(5,2),
  is_controlled_substance BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (category_id) REFERENCES consumable_categories(id)
);
```

**Inventory Stock Tracking:**

```sql
CREATE TABLE inventory_stock (
  id INT PRIMARY KEY AUTO_INCREMENT,
  consumable_id INT NOT NULL,
  batch_number VARCHAR(100) NOT NULL,
  supplier_id INT,
  quantity_received INT NOT NULL,
  quantity_current INT NOT NULL,
  unit_cost DECIMAL(10,2),
  manufacture_date DATE,
  expiry_date DATE NOT NULL,
  received_date DATE,
  received_by INT,
  location VARCHAR(255) DEFAULT 'Mobile Clinic',
  status ENUM('Active', 'Expired', 'Damaged', 'Returned'),
  UNIQUE KEY unique_batch (consumable_id, batch_number),
  INDEX idx_expiry (expiry_date),
  FOREIGN KEY (consumable_id) REFERENCES consumables(id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (received_by) REFERENCES users(id)
);
```

### 6.3 FIFO Stock Management

**Usage Recording with FIFO:**

```python
@app.route('/api/inventory/usage', methods=['POST'])
@token_required
@role_required(['nurse', 'doctor'])
def record_inventory_usage():
    """Record consumption with FIFO: use earliest-expiry first"""
    data = request.get_json()
    consumable_id = data['consumable_id']
    quantity_used = data['quantity_used']
    visit_id = data.get('visit_id')
    
    # Get available stock ordered by expiry (FIFO)
    available_stock = DatabaseManager.execute_query("""
        SELECT id, quantity_current, batch_number, expiry_date
        FROM inventory_stock
        WHERE consumable_id = %s AND status = 'Active' AND quantity_current > 0
        ORDER BY expiry_date ASC, received_date ASC
    """, (consumable_id,), fetch=True)
    
    if not available_stock:
        return jsonify({'success': False, 'error': 'No stock available'}), 400
    
    # Check total available
    total_available = sum(s['quantity_current'] for s in available_stock)
    if total_available < quantity_used:
        return jsonify({
            'success': False,
            'error': f'Insufficient stock. Available: {total_available}'
        }), 400
    
    # Use stock from earliest-expiry batches first
    remaining_to_use = quantity_used
    usage_records = []
    
    for stock in available_stock:
        if remaining_to_use <= 0:
            break
        
        # Use as much as possible from this batch
        quantity_from_batch = min(remaining_to_use, stock['quantity_current'])
        
        # Update stock
        new_quantity = stock['quantity_current'] - quantity_from_batch
        DatabaseManager.execute_query("""
            UPDATE inventory_stock 
            SET quantity_current = %s 
            WHERE id = %s
        """, (new_quantity, stock['id']))
        
        # Record usage
        DatabaseManager.execute_query("""
            INSERT INTO inventory_usage 
            (stock_id, visit_id, quantity_used, used_by, location, usage_date)
            VALUES (%s, %s, %s, %s, 'Mobile Clinic', NOW())
        """, (stock['id'], visit_id, quantity_from_batch, 
              request.current_user['id']))
        
        usage_records.append({
            'batch_number': stock['batch_number'],
            'quantity_used': quantity_from_batch,
            'remaining_in_batch': new_quantity
        })
        
        remaining_to_use -= quantity_from_batch
    
    return jsonify({
        'success': True,
        'data': {'batches_used': usage_records}
    }), 200
```

### 6.4 Inventory Alerts

**Stock Level Monitoring:**

```python
@app.route('/api/inventory/alerts/stock', methods=['GET'])
@token_required
@role_required(['nurse', 'doctor', 'clerk'])
def get_stock_alerts():
    """Alert on low/out-of-stock items"""
    
    query = """
    SELECT c.id, c.item_name, c.item_code,
           c.reorder_level, c.max_stock_level,
           COALESCE(SUM(CASE WHEN ist.status = 'Active' 
                       THEN ist.quantity_current ELSE 0 END), 0) as current_stock,
           CASE 
             WHEN SUM(ist.quantity_current) = 0 THEN 'out_of_stock'
             WHEN SUM(ist.quantity_current) <= c.reorder_level THEN 'low_stock'
             ELSE 'normal'
           END as stock_status
    FROM consumables c
    LEFT JOIN inventory_stock ist ON c.id = ist.consumable_id
    GROUP BY c.id
    HAVING stock_status IN ('out_of_stock', 'low_stock')
    ORDER BY stock_status, c.item_name
    """
    
    alerts = DatabaseManager.execute_query(query, fetch=True)
    return jsonify({
        'success': True,
        'alerts': alerts or [],
        'summary': {
            'out_of_stock': len([a for a in (alerts or []) if a['stock_status'] == 'out_of_stock']),
            'low_stock': len([a for a in (alerts or []) if a['stock_status'] == 'low_stock'])
        }
    }), 200
```

**Expiry Date Monitoring:**

```python
@app.route('/api/inventory/alerts/expiry', methods=['GET'])
def get_expiry_alerts():
    """Alert on expiring/expired stock"""
    
    query = """
    SELECT ist.*, c.item_name, s.supplier_name,
           DATEDIFF(ist.expiry_date, CURDATE()) as days_to_expiry,
           CASE 
             WHEN ist.expiry_date <= CURDATE() THEN 'expired'
             WHEN ist.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 'critical'
             WHEN ist.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'warning'
           END as alert_level
    FROM inventory_stock ist
    JOIN consumables c ON ist.consumable_id = c.id
    LEFT JOIN suppliers s ON ist.supplier_id = s.id
    WHERE ist.status = 'Active'
    AND ist.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
    ORDER BY ist.expiry_date ASC
    """
    
    alerts = DatabaseManager.execute_query(query, fetch=True)
    return jsonify({
        'success': True,
        'alerts': alerts or [],
        'summary': {
            'expired': len([a for a in (alerts or []) if a.get('alert_level') == 'expired']),
            'critical': len([a for a in (alerts or []) if a.get('alert_level') == 'critical']),
            'warning': len([a for a in (alerts or []) if a.get('alert_level') == 'warning'])
        }
    }), 200
```

### 6.5 Asset Maintenance Tracking

**Table:** `assets`

```sql
CREATE TABLE assets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  asset_tag VARCHAR(50) UNIQUE NOT NULL,
  serial_number VARCHAR(100),
  asset_name VARCHAR(255) NOT NULL,
  category_id INT NOT NULL,
  manufacturer VARCHAR(255),
  model VARCHAR(100),
  purchase_date DATE,
  warranty_expiry DATE,
  status ENUM('Operational', 'Maintenance Required', 'Out of Service', 'Disposed'),
  location VARCHAR(255),
  assigned_to INT,
  purchase_cost DECIMAL(10,2),
  current_value DECIMAL(10,2),
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  maintenance_notes TEXT,
  FOREIGN KEY (category_id) REFERENCES asset_categories(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id)
);
```

**Maintenance Scheduling:**

```python
@app.route('/api/inventory/assets/<int:asset_id>/maintenance', methods=['POST'])
@token_required
@role_required(['nurse', 'doctor'])
def record_asset_maintenance(asset_id: int):
    """Record maintenance and auto-calculate next maintenance date"""
    data = request.get_json()
    
    # Get category to determine maintenance frequency
    asset_info = DatabaseManager.execute_query("""
        SELECT ac.calibration_frequency_months
        FROM assets a
        JOIN asset_categories ac ON a.category_id = ac.id
        WHERE a.id = %s
    """, (asset_id,), fetch=True)
    
    if asset_info and asset_info[0]['calibration_frequency_months']:
        frequency_days = asset_info[0]['calibration_frequency_months'] * 30
        next_maintenance = (
            datetime.now() + timedelta(days=frequency_days)
        ).strftime('%Y-%m-%d')
    else:
        next_maintenance = None
    
    # Update asset
    DatabaseManager.execute_query("""
        UPDATE assets 
        SET last_maintenance_date = %s,
            next_maintenance_date = %s,
            status = 'Operational'
        WHERE id = %s
    """, (datetime.now().strftime('%Y-%m-%d'), next_maintenance, asset_id))
    
    return jsonify({'success': True, 'message': 'Maintenance recorded'})
```

---

## 7. Admin Dashboard & User Management

### 7.1 Role-Based Access Control

**User Roles:**
- `Administrator` - System management, user management
- `Doctor` - Clinical decisions, prescriptions, referrals
- `Nurse` - Vital signs, nursing assessments
- `Clerk` - Patient registration, appointment scheduling
- `Social Worker` - Counseling, referrals, follow-up

**Table:** `user_roles`

```sql
CREATE TABLE user_roles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  role_name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  permissions JSON,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE user_role_mapping (
  user_id INT,
  role_id INT,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (role_id) REFERENCES user_roles(id)
);
```

**Decorator Pattern:**

```python
def role_required(required_roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if not request.current_user:
                return jsonify({'error': 'Unauthorized'}), 401
            
            user_role = request.current_user.get('role_name')
            if user_role not in required_roles:
                return jsonify({
                    'error': f'Access denied. Required: {required_roles}'
                }), 403
            
            return f(*args, **kwargs)
        return decorated
    return decorator

@app.route('/api/patients/<int:patient_id>/visits', methods=['POST'])
@token_required
@role_required(['clerk', 'doctor', 'nurse'])
def create_visit(patient_id):
    # Only accessible to Clerk, Doctor, or Nurse
    pass
```

### 7.2 Geographic Restrictions

**Doctor Geographic Scope:**

```sql
CREATE TABLE users (
  -- ... other fields
  geographic_restrictions JSON,  -- List of provinces e.g., ["Gauteng", "North West"]
  -- ...
);
```

**Enforcing Geographic Access:**

```python
@app.route('/api/routes', methods=['GET'])
@token_required
@role_required(['doctor'])
def get_routes():
    user_role = request.current_user.get('role_name')
    geographic_restrictions = request.current_user.get('geographic_restrictions')
    
    query = "SELECT * FROM routes WHERE 1=1"
    params = []
    
    # Apply geographic filter for doctors
    if user_role == 'doctor' and geographic_restrictions:
        provinces = json.loads(geographic_restrictions)
        placeholders = ','.join(['%s'] * len(provinces))
        query += f" AND province IN ({placeholders})"
        params.extend(provinces)
    
    routes = DatabaseManager.execute_query(query, tuple(params), fetch=True)
    return jsonify({'success': True, 'routes': routes or []})
```

### 7.3 Audit Logging

**Table:** `audit_log`

```sql
CREATE TABLE audit_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  table_name VARCHAR(100),
  record_id INT,
  action ENUM('INSERT', 'UPDATE', 'DELETE'),
  old_values JSON,
  new_values JSON,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_table_action (table_name, action),
  INDEX idx_user (user_id),
  INDEX idx_timestamp (created_at)
);
```

**Automatic Audit Logging:**

```python
def log_action(user_id, table_name, action, record_id, new_values, old_values=None):
    DatabaseManager.execute_query("""
        INSERT INTO audit_log (
            user_id, table_name, record_id, action,
            old_values, new_values, ip_address
        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (
        user_id, table_name, record_id, action,
        json.dumps(old_values) if old_values else None,
        json.dumps(new_values),
        request.remote_addr
    ))

# Usage after creating clinical note
log_action(
    request.current_user['id'],
    'clinical_notes',
    'INSERT',
    new_note_id,
    {'visit_id': visit_id, 'note_type': 'Diagnosis'}
)
```

### 7.4 Dashboard Statistics

**Endpoint:** `GET /api/dashboard/stats`

**Response:**
```json
{
  "success": true,
  "data": {
    "clerk": {
      "todayRegistrations": 15,
      "weekRegistrations": 87,
      "monthRegistrations": 320,
      "pendingVisits": 12
    },
    "nurse": {
      "todayPatients": 18,
      "todayAssessments": 18,
      "weekAssessments": 95,
      "monthAssessments": 380
    },
    "doctor": {
      "todayVisits": 22,
      "consultationsPending": 8,
      "prescriptionIssued": 18,
      "referralsMade": 3
    },
    "admin": {
      "activeRoutes": 5,
      "totalPatients": 4250,
      "dailyVisits": 45,
      "systemHealth": "Healthy"
    }
  }
}
```

---

## 8. Offline Synchronization

### 8.1 Sync Strategy

**Offline Workflow:**
1. User works offline (app stores data locally)
2. Changes stored in local SQLite/IndexedDB
3. When online, sync queue processes changes
4. Conflict resolution applied if needed
5. Server confirms sync completion

### 8.2 Sync Status Tracking

**Table:** `sync_status`

```sql
CREATE TABLE sync_status (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  device_id VARCHAR(255),
  table_name VARCHAR(100),
  record_id INT,
  operation_type ENUM('INSERT', 'UPDATE', 'DELETE'),
  sync_status ENUM('Pending', 'Synced', 'Failed', 'Conflict'),
  conflict_resolution VARCHAR(255),
  local_timestamp DATETIME,
  server_timestamp DATETIME,
  retry_count INT DEFAULT 0,
  last_retry_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 8.3 Sync Endpoint

```python
@app.route('/api/sync/pending', methods=['POST'])
@token_required
def sync_pending_records():
    """Push offline changes to server"""
    data = request.get_json()
    device_id = data['device_id']
    records = data['records']  # Array of pending changes
    
    synced_count = 0
    failed_records = []
    
    for record in records:
        try:
            table = record['table_name']
            operation = record['operation_type']  # INSERT/UPDATE/DELETE
            
            if operation == 'INSERT':
                # Process insert
                pass
            elif operation == 'UPDATE':
                # Process update
                pass
            elif operation == 'DELETE':
                # Process delete
                pass
            
            # Mark as synced
            DatabaseManager.execute_query("""
                UPDATE sync_status 
                SET sync_status = 'Synced', server_timestamp = NOW()
                WHERE device_id = %s AND record_id = %s
            """, (device_id, record['record_id']))
            
            synced_count += 1
            
        except Exception as e:
            failed_records.append({
                'record_id': record['record_id'],
                'error': str(e)
            })
    
    return jsonify({
        'success': True,
        'synced_count': synced_count,
        'failed_records': failed_records
    })
```

---

## 9. API Specifications

### 9.1 Patient Portal Endpoints

#### 1. Get Patient Dashboard

**Endpoint:** `GET /api/patient-portal/dashboard/{patient_id}`

**Authentication:** Bearer Token (JWT)

**Parameters:**
- `patient_id` (path, integer, required) - Patient ID

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "patient_info": {
      "id": 123,
      "full_name": "John Doe",
      "medical_aid_number": "POL123456",
      "is_palmed_member": true,
      "member_type": "Principal",
      "phone_number": "0712345678",
      "email": "john@example.com"
    },
    "upcoming_appointments": [
      {
        "id": 456,
        "booking_reference": " POL-2025-001",
        "appointment_date": "2025-02-15",
        "appointment_time": "09:00",
        "location_name": "Johannesburg Clinic",
        "city": "Johannesburg",
        "province": "Gauteng",
        "status": "Booked",
        "duration_minutes": 30
      }
    ],
    "recent_visits": [
      {
        "visit_id": 789,
        "visit_date": "2025-01-15T10:30:00Z",
        "location_name": "Johannesburg Clinic",
        "chief_complaint": "Regular checkup",
        "is_completed": true,
        "completed_stages": 5,
        "total_stages": 5
      }
    ],
    "health_summary": {
      "total_visits": 15,
      "chronic_conditions": ["Hypertension", "Diabetes"],
      "allergies": ["Penicillin"],
      "current_medications": ["Amlodipine 5mg", "Metformin 500mg"],
      "last_visit_date": "2025-01-15",
      "recent_diagnoses": []
    },
    "notifications": []
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid/expired token
- `403 Forbidden` - Patient ID mismatch with token
- `404 Not Found` - Patient not found
- `500 Internal Server Error` - Database error

---

#### 2. Get Available Appointments

**Endpoint:** `GET /api/patient-portal/appointments/available/{patient_id}`

**Authentication:** Bearer Token (JWT)

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `province` | string | No | Filter by province (e.g., "Gauteng") |
| `city` | string | No | Filter by city (e.g., "Johannesburg") |
| `date_from` | date | No | Start date (YYYY-MM-DD) |
| `date_to` | date | No | End date (YYYY-MM-DD) |
| `location_type` | string | No | Location type filter |
| `max_distance_km` | number | No | Maximum distance from patient |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "appointments": [
      {
        "id": 100,
        "appointment_id": 100,
        "appointment_time": "09:00:00",
        "duration_minutes": 30,
        "visit_date": "2025-02-20",
        "location_name": "Johannesburg Clinic",
        "province": "Gauteng",
        "city": "Johannesburg",
        "location_type": "Community Center",
        "route_name": "Gauteng Feb 2025",
        "route_type": "Mixed",
        "route_location_id": 50,
        "appointment_date": "2025-02-20"
      },
      {
        "id": 101,
        "appointment_id": 101,
        "appointment_time": "09:30:00",
        "duration_minutes": 30,
        "visit_date": "2025-02-20",
        "location_name": "Johannesburg Clinic",
        "province": "Gauteng",
        "city": "Johannesburg",
        "location_type": "Community Center",
        "route_name": "Gauteng Feb 2025",
        "route_type": "Mixed",
        "route_location_id": 50,
        "appointment_date": "2025-02-20"
      }
    ]
  }
}
```

> **Note:** Duplicates removed by client-side Set deduplication before display

**Error Responses:**
- `401 Unauthorized` - Invalid token
- `404 Not Found` - Patient not found
- `500 Internal Server Error` - Database error

---

#### 3. Book Appointment

**Endpoint:** `POST /api/patient-portal/appointments/{appointment_id}/book`

**Authentication:** Bearer Token (JWT)

**URL Parameters:**
- `appointment_id` (integer, required) - Appointment slot ID

**Request Body:**
```json
{
  "patient_id": 123,
  "notes": "Optional special requirements"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "booking_reference": " POL-2025-001234"
  },
  "booking_reference": " POL-2025-001234",
  "message": "Appointment booked successfully"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid patient_id
- `401 Unauthorized` - Invalid token
- `404 Not Found` - Appointment not found
- `409 Conflict` - Appointment already booked
- `500 Internal Server Error` - Booking failed

---

#### 4. Cancel Appointment

**Endpoint:** `POST /api/patient-portal/appointments/{appointment_id}/cancel`

**Authentication:** Bearer Token (JWT)

**URL Parameters:**
- `appointment_id` (integer, required) - Appointment ID to cancel

**Request Body:**
```json
{
  "reason": "Patient requested cancellation"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "cancelled": true,
    "appointment_id": 456
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid appointment status
- `401 Unauthorized` - Invalid token
- `403 Forbidden` - Not appointment owner
- `404 Not Found` - Appointment not found
- `500 Internal Server Error` - Cancellation failed

---

### 9.2 Authentication Endpoints

#### Patient Portal Login

**Endpoint:** `POST /api/patient-portal/login`

**Request Body:**
```json
{
  "email": "patient@example.com",
  "password": "SecurePass123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "patient_data": {
      "id": 123,
      "full_name": "John Doe",
      "medical_aid_number": "POL123456",
      "is_palmed_member": true,
      "member_type": "Principal",
      "phone_number": "0712345678",
      "email": "john@example.com",
      "is_verified": true
    },
    "session": {
      "token": "session-uuid",
      "expires_at": "2025-02-15T10:30:00Z"
    }
  }
}
```

**JWT Token Payload:**
```json
{
  "patient_id": 123,
  "email": "patient@example.com",
  "type": "patient_portal",
  "exp": 1708000000,
  "iat": 1707996400
}
```

---

## 10. Database Schema

### 10.1 Core Tables

#### patient_appointments Table

```sql
CREATE TABLE patient_appointments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  route_location_id INT NOT NULL,
  patient_id INT,
  booking_reference VARCHAR(50) UNIQUE,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  appointment_duration INT DEFAULT 30,
  status ENUM(
    'Available',
    'Booked',
    'Confirmed',
    'Completed',
    'Cancelled',
    'No_Show'
  ) DEFAULT 'Available',
  
  -- Constraints
  FOREIGN KEY (route_location_id) REFERENCES route_locations(id),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  
  -- Indexes
  UNIQUE KEY uniq_route_date_time (route_location_id, appointment_date, appointment_time),
  INDEX idx_patient (patient_id),
  INDEX idx_status (status),
  INDEX idx_booking_ref (booking_reference),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Key Fields:**
- `route_location_id` - FK to specific location on a specific date
- `patient_id` - NULL for Available, populated when Booked
- `appointment_date` - Date of appointment
- `appointment_time` - Time of appointment (HH:MM:SS)
- `status` - Lifecycle status (Available → Booked → Completed)

**Unique Constraint Logic:**
- `uniq_route_date_time` prevents duplicate time slots for same location/date
- Enforced at DB level to prevent future duplicates

---

#### route_locations Table

```sql
CREATE TABLE route_locations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  route_id INT NOT NULL,
  location_id INT NOT NULL,
  visit_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  max_appointments INT DEFAULT 10,
  appointment_duration INT DEFAULT 30,
  notes TEXT,
  
  FOREIGN KEY (route_id) REFERENCES routes(id),
  FOREIGN KEY (location_id) REFERENCES locations(id),
  INDEX idx_route (route_id),
  INDEX idx_location (location_id),
  INDEX idx_date (visit_date),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Purpose:**
- Represents a specific location on a specific date as part of a route
- Links route → location with schedule information

---

#### routes Table

```sql
CREATE TABLE routes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  route_name VARCHAR(255) NOT NULL,
  description TEXT,
  province VARCHAR(100) NOT NULL,
  route_type VARCHAR(100),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  max_appointments_per_day INT,
  created_by INT,
  is_active BOOLEAN DEFAULT TRUE,
  
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_province (province),
  INDEX idx_active (is_active),
  INDEX idx_dates (start_date, end_date),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

#### patients Table

```sql
CREATE TABLE patients (
  id INT PRIMARY KEY AUTO_INCREMENT,
  medical_aid_number VARCHAR(50),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE,
  gender ENUM('Male', 'Female', 'Other'),
  id_number VARCHAR(50),
  phone_number VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  physical_address TEXT,
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(20),
  is_palmed_member BOOLEAN DEFAULT FALSE,
  member_type VARCHAR(50),
  chronic_conditions JSON,
  allergies JSON,
  current_medications JSON,
  created_by INT,
  
  UNIQUE KEY uniq_medical_aid (medical_aid_number),
  UNIQUE KEY uniq_id_number (id_number),
  INDEX idx_email (email),
  FOREIGN KEY (created_by) REFERENCES users(id),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

#### patient_authentication Table

```sql
CREATE TABLE patient_authentication (
  id INT PRIMARY KEY AUTO_INCREMENT,
  patient_id INT NOT NULL UNIQUE,
  polmed_number VARCHAR(50),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  mobile_number VARCHAR(20),
  is_verified BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR(255),
  verification_expires DATETIME,
  login_attempts INT DEFAULT 0,
  locked_until DATETIME,
  last_login DATETIME,
  
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

### 10.2 Schema Relationships

```
routes
  ├─ route_locations (1:many)
  │   ├─ locations (many:1)
  │   │   └─ location_types (many:1)
  │   └─ patient_appointments (1:many)
  │       └─ patients (many:1)
  │           ├─ patient_authentication (1:1)
  │           └─ patient_visits (1:many)
  │               ├─ vital_signs (1:many)
  │               └─ clinical_notes (1:many)
```

---

## 11. Frontend Components

### 11.1 Patient Appointment Booking Component

**Location:** `components/patient-portal/patient-appointment-booking.tsx`

**Component Props:**
```typescript
interface PatientAppointmentBookingProps {
  patientId?: number;
  onBookingSuccess?: (bookingReference: string) => void;
}
```

**State Management:**
```typescript
const [upcomingAppointments, setUpcomingAppointments] = 
  useState<UpcomingAppointment[]>([]);
const [availableAppointments, setAvailableAppointments] = useState([]);
const [filters, setFilters] = useState({
  province: '',
  city: '',
  dateFrom: '',
  dateTo: '',
  locationType: ''
});
const [loading, setLoading] = useState(false);
const [loadingAppointments, setLoadingAppointments] = useState(false);
```

**Key Sections:**

1. **Your Appointments Card** (Top)
   - Displays upcoming booked appointments
   - Shows appointment date, time, location
   - Cancel button for active statuses
   - Badge for status display

2. **Search Filters** (Middle)
   - Province dropdown
   - City input
   - Date range picker
   - Location type selector

3. **Available Appointments List** (Bottom)
   - Deduplicated slots
   - Sortable by date/time
   - Book button for each slot
   - Location and travel time info

### 11.2 Supporting Components

**UI Components Used:**
- `Button` - Action buttons
- `Card` - Section containers
- `Input` - Text filters
- `Select` - Dropdown filters
- `Badge` - Status indicators
- `Calendar` - Date picker
- `Loader2` - Loading spinner
- `Alert` - Error/success messages

**Icons:**
- `Calendar` - Date display
- `Clock` - Time display
- `MapPin` - Location display
- `Plus` - Add/book action
- `Search` - Search icon
- `X` / `Trash2` - Cancel action

---

## 12. Implementation Patterns

### 12.1 Error Handling

**Global Pattern:**
```typescript
try {
  setLoading(true);
  const result = await apiService.get(endpoint);
  
  if (!result.success) {
    toast({
      title: "Error",
      description: result.error || "An error occurred",
      variant: "destructive"
    });
    return;
  }
  
  // Process result.data
} catch (error) {
  console.error("Operation failed:", error);
  toast({
    title: "Error",
    description: error instanceof Error ? error.message : "Unknown error",
    variant: "destructive"
  });
} finally {
  setLoading(false);
}
```

**API Response Pattern:**
```json
{
  "success": true/false,
  "data": { /* response data */ },
  "error": "Error message if success=false"
}
```

### 12.2 Form Validation

**Frontend Validation:**
```typescript
const validateBooking = (data: BookingData): string[] => {
  const errors: string[] = [];
  
  if (!data.appointmentId) errors.push("Please select an appointment");
  if (!data.patientId) errors.push("Patient ID required");
  
  return errors;
};
```

**Backend Validation:**
```python
@token_required
def book_appointment(appointment_id: int):
    data = request.get_json() or {}
    
    # Validate required fields
    if not data.get('patient_id'):
        return jsonify({'success': False, 'error': 'patient_id required'}), 400
    
    # Type validation
    try:
        patient_id = int(data['patient_id'])
    except (ValueError, TypeError):
        return jsonify({'success': False, 'error': 'patient_id must be integer'}), 400
    
    # Business logic validation
    existing_booking = DatabaseManager.execute_query(
        "SELECT id FROM patient_appointments WHERE id = %s AND patient_id IS NOT NULL",
        (appointment_id,),
        fetch=True
    )
    if existing_booking:
        return jsonify({'success': False, 'error': 'Appointment already booked'}), 409
```

### 12.3 Token Management

**Login Storage:**
```typescript
// After successful login
const { token } = response.data;
localStorage.setItem("patient_portal_session", token);
```

**Token Usage:**
```typescript
// Automatically added to all requests
const apiService = {
  async request(method, url, data) {
    const token = localStorage.getItem("patient_portal_session");
    const headers = {
      ...(token && { "Authorization": `Bearer ${token}` })
    };
    // ...
  }
};
```

**Token Expiration Handling:**
```typescript
if (response.status === 401) {
  localStorage.removeItem("patient_portal_session");
  window.location.href = "/patient-portal/login";
}
```

### 12.4 Data Deduplication Pattern

```typescript
// Set-based deduplication for appointments
const seenIds = new Set<number>();
const seenCompositeKeys = new Set<string>();
const deduplicated: Appointment[] = [];

for (const appt of appointments) {
  // Primary key: appointment_id
  if (appt.appointment_id && !seenIds.has(appt.appointment_id)) {
    seenIds.add(appt.appointment_id);
    deduplicated.push(appt);
  }
  // Composite key: route_location_id|date|time (fallback)
  else if (!seenIds.has(appt.appointment_id)) {
    const compositeKey = 
      `${appt.route_location_id}|${appt.appointment_date}|${appt.appointment_time}`;
    if (!seenCompositeKeys.has(compositeKey)) {
      seenCompositeKeys.add(compositeKey);
      deduplicated.push(appt);
    }
  }
}
```

---

## 13. Error Handling & Validation

### 13.1 Common Error Scenarios

| Error | Status | Cause | Resolution |
|-------|--------|-------|-----------|
| Invalid Token | 401 | Expired/malformed JWT | Re-login |
| Access Denied | 403 | Role insufficient | Use correct user type |
| Not Found | 404 | Resource doesn't exist | Check ID validity |
| Conflict | 409 | Duplicate/already booked | Show user-friendly message |
| Bad Request | 400 | Invalid input format | Validate client-side |
| Server Error | 500 | Database/logic error | Log and retry |

### 13.2 Validation Rules

**Appointment Booking:**
- Patient must be authenticated
- Appointment must have status='Available'
- Patient can only book one appointment per visit date
- Appointment date must be in future

**Appointment Cancellation:**
- Only patient owner can cancel
- Status must be in ['Scheduled', 'Booked', 'Confirmed']
- Cancellation must be within 24 hours (optional business rule)
- Reason required for audit trail

**Patient Registration:**
- Email format valid and unique
- Password meets complexity rules (8+ chars, mixed case, digits)
- Phone number valid South African format
- Required fields: first_name, last_name, email, phone_number

---

## 14. Security Considerations

### 14.1 Authentication & Authorization

**Patient Portal:**
```python
def patient_portal_token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'success': False, 'error': 'Token missing'}), 401
        
        try:
            # Remove 'Bearer ' prefix
            if token.startswith('Bearer '):
                token = token[7:]
            
            # Decode JWT
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            
            # Validate token type
            if data.get('type') != 'patient_portal':
                return jsonify({'success': False, 'error': 'Invalid token type'}), 401
            
            # Verify patient still exists
            patient = DatabaseManager.execute_query(
                "SELECT id FROM patients WHERE id = %s",
                (data.get('patient_id'),),
                fetch=True
            )
            if not patient:
                return jsonify({'success': False, 'error': 'Invalid token'}), 401
            
            request.patient_id = data['patient_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'success': False, 'error': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'success': False, 'error': 'Invalid token'}), 401
        
        return f(*args, **kwargs)
    return decorated
```

### 14.2 Data Privacy

- Patient data only accessible to authenticated patient (self)
- Clinic staff see only patients on their routes
- Passwords hashed with werkzeug.security
- Audit log tracks all modifications

### 14.3 HTTPS & Transport Security

- All API endpoints require HTTPS (Azure enforces)
- JWT tokens in Authorization header (not URL params)
- CORS configured for trusted origins only
- Rate limiting on auth endpoints (5 failed attempts → 15 min lockout)

### 14.4 Input Sanitization

```python
# SQL Injection Prevention: Parameterized Queries
DatabaseManager.execute_query(
    "SELECT * FROM patients WHERE email = %s AND id_number = %s",
    (user_input_email, user_input_id),  # Never concatenated
    fetch=True
)

# XSS Prevention: HTML Escaping in JSON responses
from markupsafe import escape
json.dumps({
    'message': escape(user_provided_text)
})
```

---

## 15. Future Enhancements

### 15.1 Recommended Improvements

#### 1. Status Normalization
**Current Issue:** Database has mixed naming (`Booked` vs `Scheduled`)
**Solution:** 
- Migrate all `Booked` → `Scheduled` using data migration script
- Update ENUM constraint to: `('Available','Scheduled','Confirmed','Completed','Cancelled','No_Show')`
- Update UI to use consistent naming
**Effort:** 2 hours database + UI refactor

#### 2. Appointment Reminders
**Feature:** SMS/Email reminders 24 hours before appointment
**Implementation:**
```python
@app.route('/api/appointments/reminders/send', methods=['POST'])
@token_required
@role_required(['administrator', 'clerk'])
def send_appointment_reminders():
    # Query appointments for tomorrow
    reminders_due = DatabaseManager.execute_query("""
        SELECT pa.*, p.phone_number, p.email
        FROM patient_appointments pa
        JOIN patients p ON pa.patient_id = p.id
        WHERE DATE(pa.appointment_date) = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
        AND pa.status IN ('Scheduled', 'Confirmed')
        AND pa.reminder_sent = FALSE
    """)
    
    for appointment in reminders_due:
        # Send SMS via SMS gateway (Twilio, etc)
        # Send Email via SMTP
        # Update reminder_sent flag
```

**Required:**
- SMS gateway API integration
- Email service (SendGrid/AWS SES)
- `reminder_sent` flag on patient_appointments table

#### 3. Double-Booking Prevention
**Feature:** Real-time lock during booking to prevent race conditions
**Implementation:**
```sql
-- Add to booking transaction
START TRANSACTION;

-- Lock the appointment row
SELECT * FROM patient_appointments WHERE id = appointment_id FOR UPDATE;

-- Check if still Available
IF patient_id IS NOT NULL THEN
  ROLLBACK;
  RAISE ERROR 'Appointment already booked';
END IF;

-- Update to Booked
UPDATE patient_appointments SET patient_id = ?, booking_reference = ? WHERE id = ?;

COMMIT;
```

#### 4. Appointment Waiting List
**Feature:** Allow patients to join waiting list for fully-booked dates
**Implementation:**
```sql
CREATE TABLE appointment_waiting_list (
  id INT PRIMARY KEY AUTO_INCREMENT,
  route_location_id INT NOT NULL,
  appointment_date DATE NOT NULL,
  patient_id INT NOT NULL,
  position INT,
  status ENUM('Waiting', 'Offered', 'Accepted', 'Declined'),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (route_location_id) REFERENCES route_locations(id),
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);
```

#### 5. Analytics Dashboard
**Feature:** View booking trends, no-show rates, popular time slots
**Endpoints:**
```python
@app.route('/api/reports/appointment-analytics', methods=['GET'])
def appointment_analytics():
    # Period-based statistics
    # No-show analysis
    # Cancellation reasons
    # Peak time identification
```

#### 6. Appointment Rescheduling
**Feature:** Allow patients to reschedule before appointment date
**Implementation:**
```python
@app.route('/api/patient-portal/appointments/<int:appointment_id>/reschedule', methods=['POST'])
@patient_portal_token_required
def reschedule_appointment(appointment_id: int):
    data = request.get_json()
    new_appointment_id = data.get('new_appointment_id')
    
    # Validate new appointment is available
    # Cancel old appointment
    # Book new appointment
    # Update audit log
```

### 15.2 Performance Optimizations

1. **Caching:**
   - Cache available appointments for 5 minutes
   - Cache route/location data for session
   - Use Redis for session storage

2. **Database Indexing:**
   - Add index on `patient_appointments(patient_id, status)`
   - Add index on `routes(is_active, start_date, end_date)`

3. **API Response Pagination:**
   - Implement cursor-based pagination for large result sets
   - Return max 50 appointments per request

4. **Frontend Optimization:**
   - Lazy-load appointment list sections
   - Virtualize long lists (react-window)
   - Memoize expensive computations

### 15.3 Testing & QA

**Unit Tests Required:**
```typescript
describe('Patient Appointment Booking', () => {
  test('should deduplicate appointments by ID', () => {
    // Test Set-based dedup logic
  });
  
  test('should allow cancel for Booked status', () => {
    // Test status checking
  });
  
  test('should handle API errors gracefully', () => {
    // Test error handling
  });
});
```

**Integration Tests:**
```python
def test_book_appointment_end_to_end():
    # Create test patient
    # Create test route and appointments
    # Book appointment
    # Verify database updates
    # Verify response
    # Cancel appointment
    # Verify cancellation
```

**Manual Testing Checklist:**
- [ ] Patient can login with valid credentials
- [ ] Patient can view available appointments
- [ ] Duplicate appointments removed from display
- [ ] Patient can book appointment
- [ ] Booking confirmation shows reference
- [ ] Patient can view their booked appointments
- [ ] Patient can cancel booked appointments
- [ ] Cancel confirmation with message
- [ ] Token expiration redirects to login
- [ ] Invalid token rejected with 401

---

## Summary

This specification provides a complete technical guide for the Patient Portal Appointment System. The system implements a three-tier architecture with client-side deduplication, database-level constraints, and a comprehensive REST API.

**Key Implementation Status:**
- ✅ Frontend: Appointment UI with cancel button
- ✅ Frontend: Client-side deduplication
- ✅ Backend: All CRUD endpoints
- ✅ Database: Unique index constraint added
- ⚠️ Schema: Mixed status naming (future normalization)
- ⏱️ Features: Ready for reminders and analytics

**For Developers:**
- Start with `components/patient-portal/patient-appointment-booking.tsx`
- Follow API contract in Section 4
- Use error handling patterns in Section 8
- Reference database schema in Section 5

**Support & Questions:**
Contact the development team for:
- API integration issues
- Database schema questions
- Feature enhancement requests
- Performance optimization

---

**Document Generated:** 2025  
**Specification Version:** 1.0  
**Last Reviewed:** Current Session  
**Next Review Date:** Q2 2025
