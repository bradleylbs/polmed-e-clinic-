# Patient Portal - Missing Endpoints Implementation Checklist

## Quick Reference: What's Missing

### 🔴 Critical (Blocks Core Features)

#### 1. Appointment Booking Endpoints
```
❌ POST /api/patient-portal/appointments/{appointmentId}/book
   Service Method: bookAppointmentViaPortal()
   Used by: appointment-scheduler.tsx, patient-appointment-booking.tsx
   Required DB Tables: appointments, bookings, booking_references
   
❌ POST /api/patient-portal/appointments/{appointmentId}/cancel
   Service Method: cancelAppointmentViaPortal()
   Used by: appointment-scheduler.tsx
   Required DB Tables: appointments, bookings, cancellation_reasons
```

#### 2. Medication/Prescription Endpoints
```
❌ GET /api/patient-portal/prescriptions/{patientId}
   Service Method: getPrescriptions()
   Used by: medication-tracker.tsx
   Required DB Tables: prescriptions, medications, medication_dosages
```

#### 3. Health Records Endpoints
```
❌ GET /api/patient-portal/test-results/{patientId}
   Service Method: getTestResults()
   Used by: enhanced-health-records.tsx
   Required DB Tables: test_results, lab_tests, test_codes
   
❌ GET /api/patient-portal/medical-records/{patientId}
   Service Method: getMedicalRecords()
   Used by: enhanced-health-records.tsx
   Required DB Tables: medical_records, diagnoses, clinical_notes
```

---

### 🟡 Important (Blocks Important Features)

#### 4. Visit Details & Documents
```
❌ GET /api/patient-portal/visits/details/{visitId}
   Service Method: getVisitDetails()
   Used by: patient-health-records.tsx
   Required DB Tables: visits, vital_signs, diagnoses, clinical_notes, prescriptions
   
❌ GET /api/patient-portal/documents/{patientId}
   Service Method: getPatientDocuments()
   Used by: patient-health-records.tsx
   Required DB Tables: documents, document_types
   
❌ GET /api/patient-portal/documents/download/{documentId}
   Service Method: downloadPatientDocument()
   Used by: patient-health-records.tsx
   Required DB Tables: documents, file_storage
```

#### 5. Authentication Related
```
❌ POST /api/patient-portal/verify-email
   Service Method: verifyPatientEmail()
   Used by: patient-portal-registration.tsx
   Required DB Tables: patient_authentication, verification_tokens
   
❌ POST /api/patient-portal/reset-password
   Service Method: resetPatientPassword()
   Used by: patient-portal-login.tsx (forgot password)
   Required DB Tables: patient_authentication, password_reset_tokens
   
❌ POST /api/patient-portal/validate-membership
   Service Method: validatePolmedMembership()
   Used by: patient-portal-registration.tsx
   Required DB Tables: polmed_members (or external API call)
```

---

### 🟢 Enhancement (Nice to Have)

#### 6. Profile Management
```
❌ PUT /api/patient-portal/profile/{patientId}
   Service Method: updatePatientProfile()
   Used by: patient-profile.tsx
   Required DB Tables: patients, patient_contact_info
```

#### 7. User Preferences
```
❌ GET /api/patient-portal/preferences/{patientId}
   Service Method: getPatientPreferences()
   Required DB Tables: patient_preferences
   
❌ PUT /api/patient-portal/preferences/{patientId}
   Service Method: updatePatientPreferences()
   Required DB Tables: patient_preferences
```

#### 8. Password Management
```
❌ POST /api/patient-portal/password/change
   Service Method: changePassword()
   
❌ POST /api/patient-portal/password/forgot
   Service Method: forgotPassword()
   
❌ POST /api/patient-portal/password/reset
   Service Method: resetPasswordWithToken()
```

---

## Implementation Order (Recommended)

### Phase 1: Core Functionality (High Priority)
1. Appointments - Book & Cancel (2 endpoints)
2. Prescriptions - List (1 endpoint)
3. Test Results - List (1 endpoint)
4. Medical Records - List (1 endpoint)
**Total: 5 endpoints** - Unblocks 4 components

### Phase 2: Enhanced Features (Medium Priority)
5. Visit Details (1 endpoint)
6. Documents - List & Download (2 endpoints)
7. Email Verification (1 endpoint)
8. Password Reset (1 endpoint)
9. POLMED Validation (1 endpoint)
**Total: 6 endpoints** - Completes registration & health records

### Phase 3: Polish (Low Priority)
10. Profile Management (1 endpoint)
11. Preferences (2 endpoints)
12. Password Change (3 endpoints)
**Total: 6 endpoints** - Completes profile & settings

---

## Testing Checklist

After implementing each endpoint:

- [ ] Endpoint exists and responds with 200/201
- [ ] Authentication token validation works
- [ ] Data matches service expectations (types, fields)
- [ ] Error handling returns proper status codes
- [ ] Component fetches data successfully
- [ ] Component displays data without errors
- [ ] Pagination works (if applicable)
- [ ] Filters work (if applicable)
- [ ] Loading/error states display correctly

---

## Database Dependencies

Before implementing endpoints, verify these tables exist:
- `patients` ✅
- `patient_authentication` ✅
- `patient_visits` ✅
- `route_locations` ✅
- `routes` ✅
- `locations` ✅
- `prescriptions` - CHECK
- `medications` - CHECK
- `appointments` - CHECK
- `bookings` - CHECK
- `test_results` - CHECK
- `lab_tests` - CHECK
- `medical_records` - CHECK
- `documents` - CHECK
- `vital_signs` - CHECK
- `diagnoses` - CHECK

---

## Component Dependencies

### Blocked Until Endpoints Implemented:

| Component | Blocked By | Priority |
|-----------|-----------|----------|
| medication-tracker.tsx | prescriptions endpoint | 🔴 HIGH |
| enhanced-health-records.tsx | test-results, medical-records endpoints | 🔴 HIGH |
| appointment-scheduler.tsx | book, cancel endpoints | 🔴 HIGH |
| patient-appointment-booking.tsx | book endpoint | 🔴 HIGH |
| patient-health-records.tsx | visit-details, documents endpoints | 🟡 MEDIUM |
| patient-portal-registration.tsx | verify-email, validate-membership | 🟡 MEDIUM |
| patient-profile.tsx | profile, preferences endpoints | 🟢 LOW |

---

## Next Steps

1. **Review** this checklist with team
2. **Prioritize** which phase to implement first
3. **Assign** endpoints to developers
4. **Create** database migrations if needed
5. **Implement** endpoints in app.py
6. **Test** each endpoint before moving to next phase
7. **Deploy** to Azure and verify with live components
8. **Monitor** for errors in Azure App Insights
