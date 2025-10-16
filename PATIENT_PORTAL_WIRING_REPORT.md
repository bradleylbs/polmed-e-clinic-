# Patient Portal Wiring Report
**Generated:** October 16, 2025

## Executive Summary
✅ **Status:** MOSTLY WIRED with some missing backend endpoints

**Components:** 11 patient portal components
**Service Methods:** 27 methods in `patient-portal-service.ts`
**Backend Endpoints:** 8 implemented endpoints
**Missing Endpoints:** 19 endpoints referenced by service but not in backend

---

## 📋 Component-to-Service Mapping

### 1. **patient-portal-login.tsx** ✅ WIRED
| Component | Service Method | Endpoint | Backend | Status |
|-----------|----------------|----------|---------|--------|
| Login Form | `loginPatient()` | POST `/patient-portal/login` | ✅ Line 688 | ✅ WORKING |
| Forgot Password | `resetPatientPassword()` | POST `/patient-portal/reset-password` | ❌ MISSING | ❌ NOT IMPLEMENTED |

---

### 2. **patient-portal-registration.tsx** ✅ WIRED
| Component | Service Method | Endpoint | Backend | Status |
|-----------|----------------|----------|---------|--------|
| Register | `registerPatient()` | POST `/patient/auth/register` | ✅ Line 455 | ✅ WORKING |
| Verify Email | `verifyPatientEmail()` | POST `/patient-portal/verify-email` | ❌ MISSING | ❌ NOT IMPLEMENTED |
| Validate POLMED | `validatePolmedMembership()` | POST `/patient-portal/validate-membership` | ❌ MISSING | ❌ NOT IMPLEMENTED |

---

### 3. **patient-portal-dashboard.tsx** ✅ WIRED
| Component | Service Method | Endpoint | Backend | Status |
|-----------|----------------|----------|---------|--------|
| Dashboard Data | `getPatientDashboard()` | GET `/patient-portal/dashboard/<patient_id>` | ✅ Line 874 | ✅ WORKING |

---

### 4. **appointment-scheduler.tsx** ⚠️ PARTIALLY WIRED
| Component | Service Method | Endpoint | Backend | Status |
|-----------|----------------|----------|---------|--------|
| Get Appointments | `getPatientDashboard()` | GET `/patient-portal/dashboard/<patient_id>` | ✅ Line 874 | ✅ WORKING |
| Available Slots | `getAvailableAppointmentsForPatient()` | GET `/patient-portal/appointments/available/<patient_id>` | ✅ Line 6056 | ✅ WORKING |
| Book Appointment | `bookAppointmentViaPortal()` | POST `/patient-portal/appointments/<appointment_id>/book` | ❌ MISSING | ❌ NOT IMPLEMENTED |
| Cancel Appointment | `cancelAppointmentViaPortal()` | POST `/patient-portal/appointments/<appointment_id>/cancel` | ❌ MISSING | ❌ NOT IMPLEMENTED |

---

### 5. **patient-appointment-booking.tsx** ⚠️ PARTIALLY WIRED
| Component | Service Method | Endpoint | Backend | Status |
|-----------|----------------|----------|---------|--------|
| Get Available Appointments | `getAvailableAppointmentsForPatient()` | GET `/patient-portal/appointments/available/<patient_id>` | ✅ Line 6056 | ✅ WORKING |
| Book Appointment | `bookAppointmentViaPortal()` | POST `/patient-portal/appointments/<appointment_id>/book` | ❌ MISSING | ❌ NOT IMPLEMENTED |

---

### 6. **medication-tracker.tsx** ⚠️ PARTIALLY WIRED
| Component | Service Method | Endpoint | Backend | Status |
|-----------|----------------|----------|---------|--------|
| Get Prescriptions | `getPrescriptions()` | GET `/patient-portal/prescriptions/<patient_id>` | ❌ MISSING | ❌ NOT IMPLEMENTED |

---

### 7. **enhanced-health-records.tsx** ⚠️ PARTIALLY WIRED
| Component | Service Method | Endpoint | Backend | Status |
|-----------|----------------|----------|---------|--------|
| Get Lab Results | `getTestResults()` | GET `/patient-portal/test-results/<patient_id>` | ❌ MISSING | ❌ NOT IMPLEMENTED |
| Get Medical Records | `getMedicalRecords()` | GET `/patient-portal/medical-records/<patient_id>` | ❌ MISSING | ❌ NOT IMPLEMENTED |

---

### 8. **patient-health-records.tsx** ⚠️ PARTIALLY WIRED
| Component | Service Method | Endpoint | Backend | Status |
|-----------|----------------|----------|---------|--------|
| Get Visit History | `getPatientVisitHistory()` | GET `/patient-portal/visits/<patient_id>` | ✅ Line 6140 | ✅ WORKING |
| Get Visit Details | `getVisitDetails()` | GET `/patient-portal/visits/details/<visit_id>` | ❌ MISSING | ❌ NOT IMPLEMENTED |
| Get Documents | `getPatientDocuments()` | GET `/patient-portal/documents/<patient_id>` | ❌ MISSING | ❌ NOT IMPLEMENTED |
| Download Document | `downloadPatientDocument()` | GET `/patient-portal/documents/download/<document_id>` | ❌ MISSING | ❌ NOT IMPLEMENTED |

---

### 9. **patient-notifications.tsx** ✅ WIRED
| Component | Service Method | Endpoint | Backend | Status |
|-----------|----------------|----------|---------|--------|
| Get Notifications | `getPatientNotifications()` | GET `/patient-portal/notifications/<patient_id>` | ✅ Line 5913 | ✅ WORKING |
| Mark as Read | `markNotificationAsRead()` | POST `/patient-portal/notifications/<notification_id>/read` | ✅ Line 5964 | ✅ WORKING |

---

### 10. **patient-feedback.tsx** ✅ WIRED
| Component | Service Method | Endpoint | Backend | Status |
|-----------|----------------|----------|---------|--------|
| Get Feedback History | `getPatientFeedbackHistory()` | GET `/patient-portal/feedback/<patient_id>` | ✅ Line 6016 | ✅ WORKING |
| Submit Feedback | `submitPatientFeedback()` | POST `/patient-portal/feedback/<patient_id>` | ✅ Line 5982 | ✅ WORKING |

---

### 11. **patient-profile.tsx** ❌ NOT WIRED
| Component | Service Method | Endpoint | Backend | Status |
|-----------|----------------|----------|---------|--------|
| Get Profile | N/A | N/A | N/A | ❌ NEEDS IMPLEMENTATION |
| Update Profile | `updatePatientProfile()` | PUT `/patient-portal/profile/<patient_id>` | ❌ MISSING | ❌ NOT IMPLEMENTED |

---

## 📊 Summary Statistics

### Working Endpoints (✅)
- `/api/patient/auth/register` - POST - Line 455
- `/api/patient-portal/login` - POST - Line 688
- `/api/patient-portal/dashboard/<patient_id>` - GET - Line 874
- `/api/patient-portal/visits/<patient_id>` - GET - Line 6140
- `/api/patient-portal/notifications/<patient_id>` - GET - Line 5913
- `/api/patient-portal/notifications/<notification_id>/read` - POST - Line 5964
- `/api/patient-portal/feedback/<patient_id>` - POST - Line 5982
- `/api/patient-portal/feedback/<patient_id>` - GET - Line 6016
- `/api/patient-portal/appointments/available/<patient_id>` - GET - Line 6056

**Total: 9 endpoints implemented**

---

## 🚨 Missing Backend Endpoints (❌)

### High Priority (Used by Components)
1. ❌ POST `/patient-portal/appointments/<appointment_id>/book` - **Used by:** appointment-scheduler.tsx, patient-appointment-booking.tsx
2. ❌ POST `/patient-portal/appointments/<appointment_id>/cancel` - **Used by:** appointment-scheduler.tsx
3. ❌ GET `/patient-portal/prescriptions/<patient_id>` - **Used by:** medication-tracker.tsx
4. ❌ GET `/patient-portal/test-results/<patient_id>` - **Used by:** enhanced-health-records.tsx
5. ❌ GET `/patient-portal/medical-records/<patient_id>` - **Used by:** enhanced-health-records.tsx
6. ❌ GET `/patient-portal/visits/details/<visit_id>` - **Used by:** patient-health-records.tsx
7. ❌ GET `/patient-portal/documents/<patient_id>` - **Used by:** patient-health-records.tsx
8. ❌ GET `/patient-portal/documents/download/<document_id>` - **Used by:** patient-health-records.tsx

### Medium Priority (Used by Service but Not Currently in Components)
9. ❌ POST `/patient-portal/reset-password` - Called by login form forgot password
10. ❌ POST `/patient-portal/verify-email` - Called by registration
11. ❌ POST `/patient-portal/validate-membership` - Called by registration POLMED validation
12. ❌ GET `/patient-portal/preferences/<patient_id>` - Not currently used
13. ❌ PUT `/patient-portal/preferences/<patient_id>` - Not currently used
14. ❌ PUT `/patient-portal/profile/<patient_id>` - Not currently used
15. ❌ POST `/patient-portal/data-deletion/<patient_id>` - Not currently used
16. ❌ POST `/patient-portal/password/change` - Not currently used
17. ❌ POST `/patient-portal/password/forgot` - Not currently used
18. ❌ POST `/patient-portal/password/reset` - Not currently used

### Low Priority (Utility Endpoints)
19. ❌ GET `/patient-portal/invoices/<patient_id>` - Not used yet
20. ❌ GET `/patient-portal/payments/<patient_id>` - Not used yet
21. ❌ POST `/patient-portal/messages/<patient_id>` - Not used yet
22. ❌ GET `/patient-portal/messages/<patient_id>` - Not used yet
23. ❌ GET `/patient-portal/slots/available` - Not used yet
24. ❌ GET `/patient-portal/locations` - Not used yet

**Total: 24 missing endpoints**

---

## 🔧 Component Wiring Status

| Component | Status | Priority | Notes |
|-----------|--------|----------|-------|
| patient-portal-login.tsx | ⚠️ PARTIAL | HIGH | Forgot password endpoint missing |
| patient-portal-registration.tsx | ⚠️ PARTIAL | HIGH | Email verification & POLMED validation endpoints missing |
| patient-portal-dashboard.tsx | ✅ COMPLETE | - | All needed endpoints implemented |
| appointment-scheduler.tsx | ⚠️ PARTIAL | HIGH | Missing book/cancel appointment endpoints |
| patient-appointment-booking.tsx | ⚠️ PARTIAL | HIGH | Missing book appointment endpoint |
| medication-tracker.tsx | ❌ NOT WIRED | HIGH | Prescriptions endpoint missing |
| enhanced-health-records.tsx | ❌ NOT WIRED | HIGH | Test results & medical records endpoints missing |
| patient-health-records.tsx | ⚠️ PARTIAL | HIGH | Visit history works, but missing details & documents endpoints |
| patient-notifications.tsx | ✅ COMPLETE | - | All needed endpoints implemented |
| patient-feedback.tsx | ✅ COMPLETE | - | All needed endpoints implemented |
| patient-profile.tsx | ❌ NOT WIRED | MEDIUM | Profile endpoints missing |

---

## 📝 Detailed Component Analysis

### Working Components (Can go to production)
✅ **patient-portal-dashboard.tsx** - Uses `getPatientDashboard()` → `/patient-portal/dashboard/<patient_id>` (Line 874 in app.py)
✅ **patient-notifications.tsx** - Uses `getPatientNotifications()` → `/patient-portal/notifications/<patient_id>` (Line 5913 in app.py)
✅ **patient-feedback.tsx** - Uses feedback methods → Both POST/GET `/patient-portal/feedback/<patient_id>` (Lines 5982, 6016 in app.py)

### Partially Working Components (Needs some endpoints)
⚠️ **patient-health-records.tsx** - Visit history works (Line 6140), but missing: `getVisitDetails()`, `getPatientDocuments()`, `downloadPatientDocument()`
⚠️ **appointment-scheduler.tsx** - Available slots works (Line 6056), but missing: `bookAppointmentViaPortal()`, `cancelAppointmentViaPortal()`
⚠️ **patient-appointment-booking.tsx** - Available slots works (Line 6056), but missing: `bookAppointmentViaPortal()`
⚠️ **patient-portal-login.tsx** - Login works (Line 688), but missing: `resetPatientPassword()`
⚠️ **patient-portal-registration.tsx** - Register works (Line 455), but missing: `verifyPatientEmail()`, `validatePolmedMembership()`

### Not Working (Need all endpoints)
❌ **medication-tracker.tsx** - Missing: `getPrescriptions()` endpoint
❌ **enhanced-health-records.tsx** - Missing: `getTestResults()`, `getMedicalRecords()` endpoints
❌ **patient-profile.tsx** - No endpoints implemented

---

## 🎯 Recommended Action Plan

### Phase 1: Critical (Needed for MVP)
1. Implement `/api/patient-portal/appointments/<appointment_id>/book` - POST
2. Implement `/api/patient-portal/appointments/<appointment_id>/cancel` - POST
3. Implement `/api/patient-portal/prescriptions/<patient_id>` - GET
4. Implement `/api/patient-portal/test-results/<patient_id>` - GET
5. Implement `/api/patient-portal/medical-records/<patient_id>` - GET

### Phase 2: Important (Needed for full functionality)
6. Implement `/api/patient-portal/visits/details/<visit_id>` - GET
7. Implement `/api/patient-portal/documents/<patient_id>` - GET
8. Implement `/api/patient-portal/documents/download/<document_id>` - GET
9. Implement `/api/patient-portal/reset-password` - POST
10. Implement `/api/patient-portal/verify-email` - POST

### Phase 3: Enhancement (Nice to have)
11. Implement `/api/patient-portal/validate-membership` - POST
12. Implement `/api/patient-portal/preferences/<patient_id>` - GET/PUT
13. Implement `/api/patient-portal/profile/<patient_id>` - PUT
14. Implement `/api/patient-portal/messages/<patient_id>` - POST/GET

---

## 🔗 All Service-to-Backend Mapping

| # | Service Method | Endpoint | HTTP | Backend Line | Status |
|---|---|---|---|---|---|
| 1 | `registerPatient()` | `/patient/auth/register` | POST | 455 | ✅ |
| 2 | `loginPatient()` | `/patient-portal/login` | POST | 688 | ✅ |
| 3 | `verifyPatientEmail()` | `/patient-portal/verify-email` | POST | - | ❌ |
| 4 | `resetPatientPassword()` | `/patient-portal/reset-password` | POST | - | ❌ |
| 5 | `getPatientDashboard()` | `/patient-portal/dashboard/<patient_id>` | GET | 874 | ✅ |
| 6 | `getAvailableAppointmentsForPatient()` | `/patient-portal/appointments/available/<patient_id>` | GET | 6056 | ✅ |
| 7 | `bookAppointmentViaPortal()` | `/patient-portal/appointments/<appointment_id>/book` | POST | - | ❌ |
| 8 | `cancelAppointmentViaPortal()` | `/patient-portal/appointments/<appointment_id>/cancel` | POST | - | ❌ |
| 9 | `getPatientPreferences()` | `/patient-portal/preferences/<patient_id>` | GET | - | ❌ |
| 10 | `updatePatientPreferences()` | `/patient-portal/preferences/<patient_id>` | PUT | - | ❌ |
| 11 | `getPatientVisitHistory()` | `/patient-portal/visits/<patient_id>` | GET | 6140 | ✅ |
| 12 | `getVisitDetails()` | `/patient-portal/visits/details/<visit_id>` | GET | - | ❌ |
| 13 | `submitPatientFeedback()` | `/patient-portal/feedback/<patient_id>` | POST | 5982 | ✅ |
| 14 | `getPatientFeedbackHistory()` | `/patient-portal/feedback/<patient_id>` | GET | 6016 | ✅ |
| 15 | `getPatientNotifications()` | `/patient-portal/notifications/<patient_id>` | GET | 5913 | ✅ |
| 16 | `markNotificationAsRead()` | `/patient-portal/notifications/<notification_id>/read` | POST | 5964 | ✅ |
| 17 | `getPatientDocuments()` | `/patient-portal/documents/<patient_id>` | GET | - | ❌ |
| 18 | `downloadPatientDocument()` | `/patient-portal/documents/download/<document_id>` | GET | - | ❌ |
| 19 | `validatePolmedMembership()` | `/patient-portal/validate-membership` | POST | - | ❌ |
| 20 | `updatePatientProfile()` | `/patient-portal/profile/<patient_id>` | PUT | - | ❌ |
| 21 | `requestDataDeletion()` | `/patient-portal/data-deletion/<patient_id>` | POST | - | ❌ |
| 22 | `changePassword()` | `/patient-portal/password/change` | POST | - | ❌ |
| 23 | `forgotPassword()` | `/patient-portal/password/forgot` | POST | - | ❌ |
| 24 | `resetPasswordWithToken()` | `/patient-portal/password/reset` | POST | - | ❌ |
| 25 | `getMedicalRecords()` | `/patient-portal/medical-records/<patient_id>` | GET | - | ❌ |
| 26 | `getPrescriptions()` | `/patient-portal/prescriptions/<patient_id>` | GET | - | ❌ |
| 27 | `getTestResults()` | `/patient-portal/test-results/<patient_id>` | GET | - | ❌ |

---

## 📌 Conclusion

**Overall Status:** 🟡 **PARTIAL** (9 of 27 endpoints implemented, 33% complete)

### Immediate Actions Required:
1. Implement Phase 1 critical endpoints (5 endpoints minimum)
2. Test all component-to-service-to-backend flows
3. Enable full patient portal functionality

The infrastructure is in place, but critical endpoints are missing that prevent appointment booking, medication tracking, and health records viewing from functioning properly.
