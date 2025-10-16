# SQL Database Schema Analysis & Optimization Report
**Date:** October 16, 2025  
**Project:** Palmed Clinic ERP  
**Status:** ⚠️ Analysis Complete - Issues & Recommendations Identified

---

## Executive Summary

Your SQL schema is **well-structured** with proper use of foreign keys, constraints, and indexing. However, there are **critical gaps and potential performance issues** that need attention:

### 🔴 Critical Issues
1. **Missing appointments table definition** - Table referenced in code but SQL schema file missing
2. **No stored procedure definition for `sp_generate_appointment_slots`** - Critical for slot management
3. **Missing unique constraints** on frequently queried fields
4. **Inefficient queries** using COUNT(*) on large result sets without proper indexes
5. **No composite indexes** for multi-column WHERE/JOIN patterns

### 🟡 Medium Issues
1. Duplicate indexes in `clinical_notes` table
2. Missing `updated_at` timestamp in several audit tables
3. No soft-delete strategy for audit compliance
4. Excessive use of JSON columns without validation

### 🟢 Positive Observations
✅ Proper use of UTF8MB4 collation for international support  
✅ CASCADE delete rules for referential integrity  
✅ Auto-increment with appropriate primary keys  
✅ Timestamp automation with `CURRENT_TIMESTAMP`  
✅ Foreign key constraints in place  

---

## Detailed Schema Analysis

### 1. **Routes Table** ✅ Good
```sql
CREATE TABLE `routes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `route_name` varchar(255),
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `province` varchar(50),
  `route_type` enum('Police Stations','Schools','Community Centers','Mixed'),
  `max_appointments_per_day` int DEFAULT '100',
  `created_by` int NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_routes_dates` (`start_date`,`end_date`),
  KEY `idx_routes_province` (`province`),
  KEY `idx_routes_type` (`route_type`),
  KEY `idx_routes_created_by` (`created_by`),
  CONSTRAINT `routes_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
);
```

**Assessment:** ✅ **Excellent**
- Proper date range indexing for date range queries
- ENUM for consistent route types
- Audit columns present (`created_at`, `updated_at`, `created_by`)

**Recommendations:**
- Add `UNIQUE INDEX idx_routes_active_dates (route_name, start_date, end_date, is_active)` to prevent duplicate routes

---

### 2. **Route Locations Table** ⚠️ Needs Review
```sql
CREATE TABLE `route_locations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `route_id` int NOT NULL,
  `location_id` int NOT NULL,
  `visit_date` date NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `max_appointments` int DEFAULT '50',
  `appointment_duration` int DEFAULT '30',
  `notes` text,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_route_location_date` (`route_id`,`location_id`,`visit_date`),
  KEY `idx_route_locations_route` (`route_id`),
  KEY `idx_route_locations_location` (`location_id`),
  KEY `idx_route_locations_date` (`visit_date`),
  CONSTRAINT `route_locations_ibfk_1` FOREIGN KEY (`route_id`) REFERENCES `routes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `route_locations_ibfk_2` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`)
);
```

**Issues Identified:**
1. ⚠️ **Missing `updated_at` timestamp** - Audit trail incomplete
2. ⚠️ **Missing composite index on (visit_date, route_id)** - Frequent query pattern
3. ⚠️ **No validation constraint** - `appointment_duration` should be > 0
4. ⚠️ **No constraint on max_appointments** - Should be > 0

**Recommendations:**
```sql
-- Add missing audit column
ALTER TABLE route_locations ADD COLUMN `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Add composite index for date-based slot queries
ALTER TABLE route_locations ADD KEY `idx_route_locations_date_route` (`visit_date`, `route_id`);

-- Add CHECK constraints for data integrity
ALTER TABLE route_locations 
ADD CONSTRAINT `ck_max_appointments` CHECK (max_appointments > 0),
ADD CONSTRAINT `ck_appointment_duration` CHECK (appointment_duration > 0);
```

---

### 3. **Appointments Table** 🔴 **CRITICAL - Missing Definition**

**Status:** ⚠️ **NOT FOUND IN SQL SCHEMA FILES**

The code references the `appointments` table extensively:
```python
# From app.py line 906:
WHERE a.patient_id = %s AND rl.visit_date >= CURDATE()

# From app.py line 2843, 3202:
proc_cursor.callproc('sp_generate_appointment_slots', [route_location_id, None])
```

**Action Required:**
Create and execute the SQL schema:
```sql
CREATE TABLE IF NOT EXISTS `appointments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `route_location_id` int NOT NULL,
  `patient_id` int,
  `appointment_date` date NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `status` enum('available', 'booked', 'completed', 'cancelled', 'no-show') DEFAULT 'available',
  `notes` text,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_appointment_slot` (`route_location_id`, `appointment_date`, `start_time`, `patient_id`),
  KEY `idx_appointments_route_location` (`route_location_id`),
  KEY `idx_appointments_patient` (`patient_id`),
  KEY `idx_appointments_date` (`appointment_date`),
  KEY `idx_appointments_status` (`status`),
  KEY `idx_appointments_date_status` (`appointment_date`, `status`),
  CONSTRAINT `appointments_ibfk_1` FOREIGN KEY (`route_location_id`) REFERENCES `route_locations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `appointments_ibfk_2` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

### 4. **Stored Procedure: sp_generate_appointment_slots** 🔴 **CRITICAL - Missing Definition**

**Status:** ⚠️ **NOT FOUND - Code references it but definition missing**

Based on your code usage, this procedure should:
- Take `route_location_id` as parameter
- Generate "Available" placeholder appointments
- Respect `max_appointments` and `appointment_duration`

**Recommended Implementation:**
```sql
DELIMITER //

CREATE PROCEDURE IF NOT EXISTS `sp_generate_appointment_slots`(
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
  DECLARE v_route_location_id INT;
  DECLARE v_done INT DEFAULT FALSE;
  DECLARE cursor_route_slots CURSOR FOR 
    SELECT id, visit_date, start_time, end_time, max_appointments, appointment_duration
    FROM route_locations
    WHERE id = p_route_location_id;
  
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;
  
  -- Delete existing "available" slots for this route_location
  DELETE FROM appointments 
  WHERE route_location_id = p_route_location_id 
    AND status = 'available';
  
  -- Generate new slots
  OPEN cursor_route_slots;
  read_loop: LOOP
    FETCH cursor_route_slots INTO v_route_location_id, v_visit_date, v_start_time, v_end_time, 
                                   v_max_appointments, v_appointment_duration;
    
    IF v_done THEN
      LEAVE read_loop;
    END IF;
    
    SET v_current_time = v_start_time;
    SET v_slot_count = 0;
    
    -- Generate slots until max_appointments or end_time reached
    WHILE v_slot_count < v_max_appointments AND v_current_time < v_end_time DO
      SET v_slot_start = v_current_time;
      
      INSERT INTO appointments 
      (route_location_id, appointment_date, start_time, end_time, status, created_at)
      VALUES
      (p_route_location_id, v_visit_date, v_slot_start, 
       TIME_ADD(v_slot_start, INTERVAL v_appointment_duration MINUTE), 
       'available', NOW());
      
      SET v_current_time = TIME_ADD(v_current_time, INTERVAL v_appointment_duration MINUTE);
      SET v_slot_count = v_slot_count + 1;
    END WHILE;
    
  END LOOP;
  CLOSE cursor_route_slots;
  
  SET p_result = CONCAT('Generated slots for route_location_id: ', p_route_location_id);
END //

DELIMITER ;
```

---

### 5. **Users Table** ✅ Good
```sql
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(100) UNIQUE NOT NULL,
  `email` varchar(255) UNIQUE NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role_id` int NOT NULL,
  `first_name` varchar(100),
  `last_name` varchar(100),
  `phone_number` varchar(20),
  `mp_number` varchar(50),
  `geographic_restrictions` json,
  `is_active` tinyint(1) DEFAULT '1',
  `requires_approval` tinyint(1) DEFAULT '0',
  `approved_by` int,
  `approved_at` timestamp,
  `last_login` timestamp,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_users_role` (`role_id`),
  KEY `idx_users_active` (`is_active`),
  KEY `idx_users_email` (`email`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `user_roles` (`id`),
  CONSTRAINT `users_ibfk_2` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`)
);
```

**Assessment:** ✅ **Excellent**
- Proper authentication fields
- Role-based access control setup
- Self-referencing for approval workflows
- Geographic restrictions support via JSON

---

### 6. **Locations Table** ✅ Good with Minor Issues
```sql
CREATE TABLE `locations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `location_name` varchar(255) NOT NULL,
  `location_type_id` int NOT NULL,
  `province` varchar(50) NOT NULL,
  `city` varchar(100) NOT NULL,
  `address` text,
  `gps_coordinates` point NOT NULL,
  `contact_person` varchar(200),
  `contact_phone` varchar(20),
  `facilities_available` json,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_locations_province` (`province`),
  KEY `idx_locations_city` (`city`),
  KEY `idx_locations_type` (`location_type_id`),
  SPATIAL KEY `idx_locations_gps` (`gps_coordinates`),
  CONSTRAINT `locations_ibfk_1` FOREIGN KEY (`location_type_id`) REFERENCES `location_types` (`id`)
);
```

**Issues:**
1. ⚠️ **Missing `updated_at` timestamp**
2. ⚠️ **SPATIAL index on GPS coordinates is good BUT:**
   - Requires `ST_GeomFromText()` for queries
   - Consider storing as separate lat/lon for compatibility
3. ⚠️ **No UNIQUE constraint on location names per province** - May allow duplicates

**Recommendations:**
```sql
-- Add audit timestamp
ALTER TABLE locations ADD COLUMN `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Add unique constraint on name per province
ALTER TABLE locations ADD UNIQUE KEY `idx_unique_location_name` (`location_name`, `province`);

-- Add composite index for location filtering
ALTER TABLE locations ADD KEY `idx_locations_province_active` (`province`, `is_active`);
```

---

### 7. **Patients Table** ✅ Excellent
```sql
CREATE TABLE `patients` (
  `id` int NOT NULL AUTO_INCREMENT,
  `medical_aid_number` varchar(50) UNIQUE,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `date_of_birth` date,
  `gender` enum('Male','Female','Other') NOT NULL,
  `id_number` varchar(20) UNIQUE,
  `phone_number` varchar(20),
  `email` varchar(255),
  `physical_address` text,
  `emergency_contact_name` varchar(200),
  `emergency_contact_phone` varchar(20),
  `is_palmed_member` tinyint(1) DEFAULT '0',
  `member_type` enum('Principal','Dependent','Non-member') DEFAULT 'Non-member',
  `chronic_conditions` json,
  `allergies` json,
  `current_medications` json,
  `created_by` int,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `medical_aid_number` (`medical_aid_number`),
  UNIQUE KEY `id_number` (`id_number`),
  KEY `idx_patients_medical_aid` (`medical_aid_number`),
  KEY `idx_patients_id_number` (`id_number`),
  KEY `idx_patients_name` (`last_name`,`first_name`),
  KEY `idx_patients_member_type` (`member_type`),
  KEY `idx_patients_member_status` (`is_palmed_member`,`member_type`,`created_at`),
  KEY `idx_patients_search` (`last_name`,`first_name`,`medical_aid_number`),
  KEY `idx_patients_created_by_date` (`created_by`,`created_at`),
  CONSTRAINT `patients_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
);
```

**Assessment:** ✅ **Excellent**
- Multiple search indexes for patient lookup
- Composite indexes for common queries
- Proper handling of duplicates via UNIQUE constraints
- JSON columns for flexible medical data

---

### 8. **Consumables Table** ✅ Good
```sql
CREATE TABLE `consumables` (
  `id` int NOT NULL AUTO_INCREMENT,
  `item_code` varchar(50) UNIQUE NOT NULL,
  `item_name` varchar(255) NOT NULL,
  `category_id` int NOT NULL,
  `generic_name` varchar(255),
  `strength` varchar(50),
  `dosage_form` varchar(100),
  `unit_of_measure` varchar(20) NOT NULL,
  `reorder_level` int DEFAULT '10',
  `max_stock_level` int DEFAULT '1000',
  `storage_temperature_min` decimal(4,1),
  `storage_temperature_max` decimal(4,1),
  `is_controlled_substance` tinyint(1) DEFAULT '0',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `item_code` (`item_code`),
  KEY `idx_consumables_code` (`item_code`),
  KEY `idx_consumables_name` (`item_name`),
  KEY `idx_consumables_category` (`category_id`),
  CONSTRAINT `consumables_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `consumable_categories` (`id`)
);
```

**Issues:**
1. ⚠️ **Missing `updated_at` timestamp**
2. ⚠️ **Duplicate index** - `idx_consumables_code` duplicates UNIQUE KEY `item_code`
3. ⚠️ **No composite index** on category + name for filtering

**Recommendations:**
```sql
-- Add audit timestamp
ALTER TABLE consumables ADD COLUMN `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Remove duplicate index
DROP INDEX `idx_consumables_code` ON consumables;

-- Add composite indexes
ALTER TABLE consumables ADD KEY `idx_consumables_category_name` (`category_id`, `item_name`);
```

---

### 9. **Inventory Stock Table** ⚠️ Needs Improvement
```sql
CREATE TABLE `inventory_stock` (
  `id` int NOT NULL AUTO_INCREMENT,
  `consumable_id` int NOT NULL,
  `batch_number` varchar(100) NOT NULL,
  `supplier_id` int NOT NULL,
  `quantity_received` int NOT NULL,
  `quantity_current` int NOT NULL,
  `unit_cost` decimal(8,2),
  `manufacture_date` date,
  `expiry_date` date NOT NULL,
  `received_date` date NOT NULL,
  `received_by` int NOT NULL,
  `location` varchar(255) DEFAULT 'Mobile Clinic',
  `status` enum('Active','Expired','Recalled','Disposed') DEFAULT 'Active',
  `disposal_date` date,
  `disposal_reason` text,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_batch_consumable` (`consumable_id`,`batch_number`),
  KEY `supplier_id` (`supplier_id`),
  KEY `received_by` (`received_by`),
  KEY `idx_stock_consumable` (`consumable_id`),
  KEY `idx_stock_batch` (`batch_number`),
  KEY `idx_stock_expiry` (`expiry_date`),
  KEY `idx_stock_status` (`status`),
  CONSTRAINT `inventory_stock_ibfk_1` FOREIGN KEY (`consumable_id`) REFERENCES `consumables` (`id`),
  CONSTRAINT `inventory_stock_ibfk_2` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`),
  CONSTRAINT `inventory_stock_ibfk_3` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`)
);
```

**Issues:**
1. ⚠️ **No validation on quantities** - Should have CHECK constraints
2. ⚠️ **No composite index for expiry tracking** - Critical for rotation queries
3. ⚠️ **Missing index on status + expiry_date** - Common query pattern for alerts

**Recommendations:**
```sql
-- Add CHECK constraints
ALTER TABLE inventory_stock
ADD CONSTRAINT `ck_quantities` CHECK (quantity_received > 0 AND quantity_current >= 0),
ADD CONSTRAINT `ck_dates` CHECK (manufacture_date <= expiry_date);

-- Add composite indexes for common queries
ALTER TABLE inventory_stock ADD KEY `idx_stock_expiry_status` (`expiry_date`, `status`);
ALTER TABLE inventory_stock ADD KEY `idx_stock_location_status` (`location`, `status`);
```

---

### 10. **Clinical Notes Table** ⚠️ Duplicate Indexes
```sql
CREATE TABLE `clinical_notes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `visit_id` int NOT NULL,
  `note_type` varchar(32),
  `content` text NOT NULL,
  `icd10_codes` text,
  `medications_prescribed` json,
  `prescription_ids` json,
  `investigation_order_ids` json,
  `template_used` int,
  `confidence_score` decimal(3,2),
  `reviewed_by` int,
  `reviewed_at` timestamp,
  `follow_up_required` tinyint(1) DEFAULT '0',
  `follow_up_date` date,
  `created_by` int NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notes_visit` (`visit_id`),
  KEY `idx_notes_type` (`note_type`),
  KEY `idx_notes_created_by` (`created_by`),
  KEY `idx_clinical_notes_created_by_date` (`created_by`,`created_at`,`note_type`),
  KEY `idx_clinical_notes_visit_id` (`visit_id`),
  KEY `idx_clinical_notes_created_by` (`created_by`),  -- DUPLICATE!
  KEY `reviewed_by` (`reviewed_by`),
  KEY `idx_clinical_notes_template` (`template_used`),
  KEY `idx_clinical_notes_reviewed` (`reviewed_at`),
  CONSTRAINT `clinical_notes_ibfk_1` FOREIGN KEY (`visit_id`) REFERENCES `patient_visits` (`id`) ON DELETE CASCADE,
  CONSTRAINT `clinical_notes_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `clinical_notes_ibfk_3` FOREIGN KEY (`template_used`) REFERENCES `clinical_templates` (`id`),
  CONSTRAINT `clinical_notes_ibfk_4` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`)
);
```

**Issues:**
1. 🔴 **DUPLICATE INDEX**: Both `idx_notes_created_by` and `idx_clinical_notes_created_by` cover the same column
2. 🔴 **DUPLICATE INDEX**: Both `idx_notes_visit` and `idx_clinical_notes_visit_id` cover the same column
3. ⚠️ **Missing index on follow_up_date** - For follow-up queries

**Recommendations:**
```sql
-- Clean up duplicate indexes
DROP INDEX `idx_notes_visit` ON clinical_notes;
DROP INDEX `idx_notes_created_by` ON clinical_notes;
DROP INDEX `idx_notes_type` ON clinical_notes;

-- Add missing indexes
ALTER TABLE clinical_notes ADD KEY `idx_clinical_notes_followup` (`follow_up_required`, `follow_up_date`);
```

---

### 11. **Asset Categories Table** ✅ Good
```sql
CREATE TABLE `asset_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category_name` varchar(100) UNIQUE NOT NULL,
  `description` text,
  `requires_calibration` tinyint(1) DEFAULT '0',
  `calibration_frequency_months` int,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `category_name` (`category_name`)
);
```

**Assessment:** ✅ **Good**
- Simple, clean structure
- Proper UNIQUE constraint

**Recommendations:**
```sql
-- Add audit timestamp
ALTER TABLE asset_categories ADD COLUMN `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Add CHECK constraint for calibration frequency
ALTER TABLE asset_categories 
ADD CONSTRAINT `ck_calibration_freq` CHECK (calibration_frequency_months IS NULL OR calibration_frequency_months > 0);
```

---

### 12. **Prescriptions Table** ✅ Good
```sql
CREATE TABLE `prescriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `visit_id` int NOT NULL,
  `patient_id` int NOT NULL,
  `drug_id` int,
  `custom_drug_name` varchar(255),
  `dosage` varchar(50) NOT NULL,
  `route` varchar(50) DEFAULT 'oral',
  `frequency` varchar(50) NOT NULL,
  `duration` varchar(50) NOT NULL,
  `quantity_prescribed` decimal(8,2),
  `quantity_dispensed` decimal(8,2),
  `instructions` text,
  `start_date` date,
  `end_date` date,
  `prescribed_by` int NOT NULL,
  `dispensed_by` int,
  `dispensed_at` timestamp,
  `status` enum('prescribed','dispensed','completed','discontinued') DEFAULT 'prescribed',
  `discontinuation_reason` text,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `prescribed_by` (`prescribed_by`),
  KEY `dispensed_by` (`dispensed_by`),
  KEY `idx_prescriptions_visit` (`visit_id`),
  KEY `idx_prescriptions_patient` (`patient_id`),
  KEY `idx_prescriptions_drug` (`drug_id`),
  KEY `idx_prescriptions_status` (`status`),
  KEY `idx_prescriptions_dates` (`start_date`,`end_date`),
  CONSTRAINT `prescriptions_ibfk_1` FOREIGN KEY (`visit_id`) REFERENCES `patient_visits` (`id`) ON DELETE CASCADE,
  CONSTRAINT `prescriptions_ibfk_2` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `prescriptions_ibfk_3` FOREIGN KEY (`drug_id`) REFERENCES `drug_database` (`id`),
  CONSTRAINT `prescriptions_ibfk_4` FOREIGN KEY (`prescribed_by`) REFERENCES `users` (`id`),
  CONSTRAINT `prescriptions_ibfk_5` FOREIGN KEY (`dispensed_by`) REFERENCES `users` (`id`)
);
```

**Assessment:** ✅ **Excellent**
- Proper tracking of prescription lifecycle
- Date range indexing
- Status tracking for compliance

---

## Performance Optimization Recommendations

### 1. **Add Missing Composite Indexes** (HIGH PRIORITY)
```sql
-- For appointment availability queries
CREATE INDEX idx_route_locations_visit_date_route_id 
ON route_locations(visit_date, route_id);

-- For patient history queries
CREATE INDEX idx_patient_visits_patient_date 
ON patient_visits(patient_id, visit_date DESC);

-- For inventory expiry tracking
CREATE INDEX idx_inventory_expiry_status 
ON inventory_stock(expiry_date, status);

-- For audit log searches
CREATE INDEX idx_audit_log_created_date 
ON audit_log(created_at DESC);
```

### 2. **Add Missing Audit Timestamps** (MEDIUM PRIORITY)
```sql
-- Add to tables missing updated_at
ALTER TABLE locations ADD COLUMN `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
ALTER TABLE route_locations ADD COLUMN `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
ALTER TABLE consumables ADD COLUMN `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
ALTER TABLE asset_categories ADD COLUMN `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
```

### 3. **Add CHECK Constraints for Data Integrity** (MEDIUM PRIORITY)
```sql
-- Route locations validation
ALTER TABLE route_locations 
ADD CONSTRAINT `ck_max_appointments` CHECK (max_appointments > 0),
ADD CONSTRAINT `ck_appointment_duration` CHECK (appointment_duration > 0),
ADD CONSTRAINT `ck_times` CHECK (start_time < end_time);

-- Consumables validation
ALTER TABLE consumables 
ADD CONSTRAINT `ck_reorder_level` CHECK (reorder_level >= 0),
ADD CONSTRAINT `ck_max_stock` CHECK (max_stock_level > reorder_level);

-- Inventory stock validation
ALTER TABLE inventory_stock
ADD CONSTRAINT `ck_quantities` CHECK (quantity_received > 0 AND quantity_current >= 0),
ADD CONSTRAINT `ck_dates` CHECK (manufacture_date IS NULL OR manufacture_date <= expiry_date);
```

### 4. **Remove Duplicate Indexes** (LOW PRIORITY - Maintenance)
```sql
-- Clinical notes duplicates
DROP INDEX `idx_notes_visit` ON clinical_notes;
DROP INDEX `idx_notes_created_by` ON clinical_notes;
DROP INDEX `idx_notes_type` ON clinical_notes;
DROP INDEX `idx_consumables_code` ON consumables;
```

---

## Query Analysis & Recommendations

### Common Query Patterns Identified

#### Pattern 1: Get Available Appointments for Patient
```sql
-- CURRENT (Inefficient)
SELECT * FROM appointments a
LEFT JOIN route_locations rl ON a.route_location_id = rl.id
WHERE a.patient_id = %s AND rl.visit_date >= CURDATE();

-- OPTIMIZED
SELECT 
    a.id, a.route_location_id, a.appointment_date, a.start_time, a.end_time, a.status,
    rl.max_appointments, COUNT(DISTINCT ab.id) as booked_count,
    GREATEST(rl.max_appointments - COUNT(DISTINCT ab.id), 0) as available_slots
FROM appointments a
INNER JOIN route_locations rl ON a.route_location_id = rl.id
LEFT JOIN appointments ab ON rl.id = ab.route_location_id 
    AND ab.appointment_date = a.appointment_date 
    AND ab.status NOT IN ('available', 'cancelled')
WHERE a.patient_id = %s 
    AND a.appointment_date >= CURDATE()
    AND a.status = 'available'
GROUP BY a.route_location_id, a.appointment_date, a.start_time
ORDER BY a.appointment_date, a.start_time;
```

**Index Needed:**
```sql
CREATE INDEX idx_appointments_date_status_patient 
ON appointments(appointment_date, status, patient_id);
```

---

## SQL Injection & Security Review

### Current Status: ✅ Good
Your code uses parameterized queries throughout:
```python
cursor.execute(query, params or ())  # Parameters passed separately
```

### Recommendation: Maintain This Practice
- ✅ Continue using `%s` placeholders with parameter tuples
- ✅ Never concatenate user input into SQL strings
- ✅ Validate all input at application layer before queries

---

## Data Integrity Checklist

| Item | Status | Priority |
|------|--------|----------|
| Foreign Key Constraints | ✅ Present | - |
| Unique Constraints | ✅ Mostly Present | 🟡 Add on route_name per province |
| Check Constraints | ❌ Missing | 🟡 MEDIUM |
| Cascade Delete Rules | ✅ Appropriate | - |
| Audit Columns | ⚠️ Partial | 🟡 MEDIUM |
| Composite Indexes | ⚠️ Partial | 🔴 HIGH |
| Duplicate Indexes | ❌ Found | 🟢 LOW |

---

## Deployment Checklist

### Before Going to Production:

- [ ] Create missing `appointments` table
- [ ] Create `sp_generate_appointment_slots` stored procedure
- [ ] Add missing audit timestamps (`updated_at`)
- [ ] Add composite indexes for performance
- [ ] Add CHECK constraints for data validation
- [ ] Remove duplicate indexes
- [ ] Test appointment slot generation end-to-end
- [ ] Verify no N+1 queries in routes
- [ ] Load test with expected patient volume
- [ ] Backup database before schema changes
- [ ] Update migration/DDL scripts in version control

---

## SQL Implementation Plan

### Phase 1: Critical (Do First)
1. Create appointments table
2. Create sp_generate_appointment_slots procedure
3. Test slot generation

### Phase 2: Optimization (Next Sprint)
1. Add composite indexes
2. Remove duplicate indexes
3. Add audit timestamps

### Phase 3: Integrity (Maintenance)
1. Add CHECK constraints
2. Add missing UNIQUE constraints
3. Document schema in README

---

## Summary

Your SQL schema is **production-ready** with solid fundamentals, but has **critical gaps** (missing appointments table & stored procedure) and **optimization opportunities** (composite indexes, audit columns). 

**Recommended Time to Remediate:**
- Critical issues: 2-3 hours
- Optimization: 1-2 hours  
- Total: 4-5 hours including testing

**Risk Assessment:** 🟡 **MEDIUM** - Slot generation is broken without the procedure definition.

