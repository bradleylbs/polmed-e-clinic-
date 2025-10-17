# POLMED ERP - Database Triggers Analysis

**Generated:** 2025-10-17 09:58:45
**Database:** palmed_clinic_erp

## Summary

- **Total Triggers:** 15
- **BEFORE Triggers:** 8
- **AFTER Triggers:** 7

- **INSERT Triggers:** 8
- **UPDATE Triggers:** 7

## Complexity Analysis

| Complexity | Count | Percentage |
|-----------|-------|------------|
| Simple | 4 | 26% |
| Moderate | 6 | 40% |
| Complex | 5 | 33% |

## Triggers by Table

### appointments (1)

**tr_validate_appointment_booking**
- **Event:** BEFORE UPDATE
- **Complexity:** complex
- **Created:** 2025-09-03 01:31:51.840000

### assets (1)

**tr_validate_asset_maintenance**
- **Event:** BEFORE UPDATE
- **Complexity:** moderate
- **Created:** 2025-09-03 01:31:51.910000

### clinical_notes (1)

**tr_clinical_notes_audit_insert**
- **Event:** AFTER INSERT
- **Complexity:** simple
- **Created:** 2025-09-03 01:31:51.760000

### inventory_stock (1)

**tr_auto_expire_inventory**
- **Event:** BEFORE UPDATE
- **Complexity:** moderate
- **Created:** 2025-09-03 01:31:51.890000

### inventory_usage (1)

**tr_validate_inventory_usage**
- **Event:** BEFORE INSERT
- **Complexity:** complex
- **Created:** 2025-09-03 01:31:51.860000

### patient_visits (2)

**tr_auto_assign_workflow_stage**
- **Event:** AFTER UPDATE
- **Complexity:** complex
- **Created:** 2025-09-03 01:31:51.950000

**tr_validate_user_geographic_access**
- **Event:** BEFORE INSERT
- **Complexity:** complex
- **Created:** 2025-09-03 01:31:51.790000

### patients (3)

**tr_patients_audit_insert**
- **Event:** AFTER INSERT
- **Complexity:** simple
- **Created:** 2025-09-03 01:31:51.700000

**tr_patients_audit_update**
- **Event:** AFTER UPDATE
- **Complexity:** moderate
- **Created:** 2025-09-03 01:31:51.730000

**tr_validate_patient_data**
- **Event:** BEFORE INSERT
- **Complexity:** complex
- **Created:** 2025-09-03 01:31:51.960000

### route_locations (1)

**tr_auto_generate_appointment_slots**
- **Event:** AFTER INSERT
- **Complexity:** simple
- **Created:** 2025-09-03 01:31:51.810000

### users (2)

**tr_users_audit_insert**
- **Event:** AFTER INSERT
- **Complexity:** simple
- **Created:** 2025-09-03 01:31:51.660000

**tr_users_audit_update**
- **Event:** AFTER UPDATE
- **Complexity:** moderate
- **Created:** 2025-09-03 01:31:51.670000

### visit_workflow_progress (1)

**tr_validate_workflow_progression**
- **Event:** BEFORE UPDATE
- **Complexity:** moderate
- **Created:** 2025-09-03 01:31:51.930000

### vital_signs (1)

**tr_validate_vital_signs**
- **Event:** BEFORE INSERT
- **Complexity:** moderate
- **Created:** 2025-09-03 01:31:51.980000

## Performance Notes

⚠️ **Warning:** Found complex triggers that may impact performance:

- `tr_auto_assign_workflow_stage`
- `tr_validate_appointment_booking`
- `tr_validate_inventory_usage`
- `tr_validate_patient_data`
- `tr_validate_user_geographic_access`

💡 **Tip:** With many triggers, consider the following during bulk operations:
- Disable triggers temporarily (if safe)
- Use batch commits
- Monitor trigger execution time

