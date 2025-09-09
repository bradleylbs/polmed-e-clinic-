-- PALMED Mobile Clinic ERP - Database Triggers
-- Automated data validation, audit trails, and business logic enforcement
-- AUDIT TRAIL TRIGGERS
-- =============================================

AFTER INSERT ON users
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (
        user_id, table_name, record_id, action, new_values, created_at
    ) VALUES (
        NEW.id, 'users', NEW.id, 'INSERT', 
        JSON_OBJECT(
            'username', NEW.username,
            'email', NEW.email,
            'role_id', NEW.role_id,
            'first_name', NEW.first_name,
            'last_name', NEW.last_name,
            'is_active', NEW.is_active
        ),
        NOW()
    );
END//
DELIMITER ;

DROP TRIGGER IF EXISTS tr_users_audit_update;
CREATE TRIGGER tr_users_audit_update
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (
        user_id, table_name, record_id, action, old_values, new_values, created_at
    ) VALUES (
        NEW.id, 'users', NEW.id, 'UPDATE',
        JSON_OBJECT(
            'username', OLD.username,
            'email', OLD.email,
            'role_id', OLD.role_id,
            'first_name', OLD.first_name,
            'last_name', OLD.last_name,
            'is_active', OLD.is_active,
            'last_login', OLD.last_login
        ),
        JSON_OBJECT(
            'username', NEW.username,
            'email', NEW.email,
            'role_id', NEW.role_id,
            'first_name', NEW.first_name,
            'last_name', NEW.last_name,
            'is_active', NEW.is_active,
            'last_login', NEW.last_login
        ),
        NOW()
    );

-- Audit trigger for patients table (POPI Act compliance)
DROP TRIGGER IF EXISTS tr_patients_audit_insert;
CREATE TRIGGER tr_patients_audit_insert
AFTER INSERT ON patients
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (
        user_id, table_name, record_id, action, new_values, created_at
    ) VALUES (
        NEW.created_by, 'patients', NEW.id, 'INSERT',
        JSON_OBJECT(
            'medical_aid_number', NEW.medical_aid_number,
            'first_name', NEW.first_name,
            'last_name', NEW.last_name,
            'is_palmed_member', NEW.is_palmed_member,
            'member_type', NEW.member_type
        ),
        NOW()
    );
END//

DROP TRIGGER IF EXISTS tr_patients_audit_update;
CREATE TRIGGER tr_patients_audit_update
AFTER UPDATE ON patients
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (
        user_id, table_name, record_id, action, old_values, new_values, created_at
    ) VALUES (
        @current_user_id, 'patients', NEW.id, 'UPDATE',
        JSON_OBJECT(
            'medical_aid_number', OLD.medical_aid_number,
            'first_name', OLD.first_name,
            'last_name', OLD.last_name,
            'phone_number', OLD.phone_number,
            'email', OLD.email,
            'chronic_conditions', OLD.chronic_conditions,
            'allergies', OLD.allergies
        ),
        JSON_OBJECT(
            'medical_aid_number', NEW.medical_aid_number,
            'first_name', NEW.first_name,
            'last_name', NEW.last_name,
            'phone_number', NEW.phone_number,
            'email', NEW.email,
            'chronic_conditions', NEW.chronic_conditions,
            'allergies', NEW.allergies
        ),
        NOW()
    );
END//

-- Audit trigger for clinical notes (sensitive medical data)
DROP TRIGGER IF EXISTS tr_clinical_notes_audit_insert;
AFTER INSERT ON clinical_notes
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (
        user_id, table_name, record_id, action, new_values, created_at
    ) VALUES (
        NEW.created_by, 'clinical_notes', NEW.id, 'INSERT',
        JSON_OBJECT(
            'visit_id', NEW.visit_id,
            'note_type', NEW.note_type,
            'content_length', CHAR_LENGTH(NEW.content),
            'icd10_codes', NEW.icd10_codes,
            'medications_prescribed', NEW.medications_prescribed
        ),
        NOW()
    );
END//

-- =============================================
-- BUSINESS LOGIC TRIGGERS
-- =============================================

DROP TRIGGER IF EXISTS tr_validate_user_geographic_access;
CREATE TRIGGER tr_validate_user_geographic_access
BEFORE INSERT ON patient_visits
FOR EACH ROW
BEGIN
    DECLARE user_provinces JSON;
    DECLARE visit_province VARCHAR(50);
    DECLARE access_allowed BOOLEAN DEFAULT FALSE;
    
    -- Get user's geographic restrictions
    SELECT geographic_restrictions INTO user_provinces
    FROM users 
    WHERE id = NEW.created_by;
    
    -- Extract province from location (assuming format includes province)
    -- This is a simplified check - in practice, you'd have a more robust location validation
    SET visit_province = SUBSTRING_INDEX(NEW.location, ',', -1);
    SET visit_province = TRIM(visit_province);
    
    -- Check if user has access to this province
    IF user_provinces IS NULL OR JSON_CONTAINS(user_provinces, JSON_QUOTE(visit_province)) THEN
        SET access_allowed = TRUE;
    END IF;
    
    IF NOT access_allowed THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'User does not have geographic access to this location';
    END IF;
END//

-- Trigger to auto-generate appointment slots when route location is created
DROP TRIGGER IF EXISTS tr_auto_generate_appointment_slots;
CREATE TRIGGER tr_auto_generate_appointment_slots
AFTER INSERT ON route_locations
FOR EACH ROW
BEGIN
    DECLARE slot_result VARCHAR(100);
    CALL sp_generate_appointment_slots(NEW.id, slot_result);
END//

-- Trigger to validate appointment booking conflicts
DROP TRIGGER IF EXISTS tr_validate_appointment_booking;
CREATE TRIGGER tr_validate_appointment_booking
BEFORE UPDATE ON appointments
FOR EACH ROW
BEGIN
    DECLARE existing_booking INT DEFAULT 0;
    
    -- Only validate when status changes to 'Booked'
    IF NEW.status = 'Booked' AND OLD.status != 'Booked' THEN
        -- Check if patient already has a booking for the same date
        SELECT COUNT(*) INTO existing_booking
        FROM appointments a
        JOIN route_locations rl ON a.route_location_id = rl.id
        JOIN route_locations new_rl ON NEW.route_location_id = new_rl.id
        WHERE a.patient_id = NEW.patient_id
        AND a.status = 'Booked'
        AND rl.visit_date = new_rl.visit_date
        AND a.id != NEW.id;
        
        IF existing_booking > 0 THEN
            SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'Patient already has an appointment booked for this date';
        END IF;
    END IF;
END//

-- =============================================
-- INVENTORY MANAGEMENT TRIGGERS
-- =============================================

-- Trigger to validate inventory stock levels
DROP TRIGGER IF EXISTS tr_validate_inventory_usage;
CREATE TRIGGER tr_validate_inventory_usage
BEFORE INSERT ON inventory_usage
FOR EACH ROW
BEGIN
    DECLARE available_stock INT DEFAULT 0;
    
    -- Check available stock
    SELECT quantity_current INTO available_stock
    FROM inventory_stock
    WHERE id = NEW.stock_id AND status = 'Active';
    
    IF available_stock < NEW.quantity_used THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Insufficient stock available for this usage';
    END IF;
END//

-- Trigger to auto-expire inventory based on expiry date
DROP TRIGGER IF EXISTS tr_auto_expire_inventory;
CREATE TRIGGER tr_auto_expire_inventory
BEFORE UPDATE ON inventory_stock
FOR EACH ROW
BEGIN
    -- Auto-expire stock that has passed expiry date
    IF NEW.expiry_date <= CURDATE() AND OLD.status = 'Active' THEN
        SET NEW.status = 'Expired';
    END IF;
END//

-- Trigger to validate asset maintenance scheduling
DROP TRIGGER IF EXISTS tr_validate_asset_maintenance;
CREATE TRIGGER tr_validate_asset_maintenance
BEFORE UPDATE ON assets
FOR EACH ROW
BEGIN
    -- Ensure next maintenance date is after last maintenance date
    IF NEW.next_maintenance_date IS NOT NULL 
       AND NEW.last_maintenance_date IS NOT NULL 
       AND NEW.next_maintenance_date <= NEW.last_maintenance_date THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Next maintenance date must be after last maintenance date';
    END IF;

    -- Auto-calculate next maintenance date if not provided
    IF NEW.last_maintenance_date != OLD.last_maintenance_date 
       AND NEW.next_maintenance_date IS NULL THEN
        DECLARE next_maint_date DATE;
        SELECT DATE_ADD(NEW.last_maintenance_date, INTERVAL ac.calibration_frequency_months MONTH)
        INTO next_maint_date
        FROM asset_categories ac
        WHERE ac.id = NEW.category_id AND ac.requires_calibration = TRUE;
        SET NEW.next_maintenance_date = next_maint_date;
    END IF;
END//

-- =============================================
-- WORKFLOW MANAGEMENT TRIGGERS
-- =============================================

-- Trigger to validate workflow stage progression
DROP TRIGGER IF EXISTS tr_validate_workflow_progression;
CREATE TRIGGER tr_validate_workflow_progression
BEFORE UPDATE ON visit_workflow_progress
FOR EACH ROW
BEGIN
    DECLARE prev_stage_completed BOOLEAN DEFAULT FALSE;
    DECLARE current_stage_order INT;
    DECLARE prev_stage_order INT;
    
    -- Only validate when completing a stage
    IF NEW.is_completed = TRUE AND OLD.is_completed = FALSE THEN
        -- Get current stage order
        SELECT stage_order INTO current_stage_order
        FROM workflow_stages
        WHERE id = NEW.stage_id;
        
        -- Check if previous stage is completed (if not the first stage)
        IF current_stage_order > 1 THEN
            SELECT COUNT(*) > 0 INTO prev_stage_completed
            FROM visit_workflow_progress vwp
            JOIN workflow_stages ws ON vwp.stage_id = ws.id
            WHERE vwp.visit_id = NEW.visit_id
            AND ws.stage_order = current_stage_order - 1
            AND vwp.is_completed = TRUE;
            
            IF NOT prev_stage_completed THEN
                SIGNAL SQLSTATE '45000' 
                SET MESSAGE_TEXT = 'Previous workflow stage must be completed first';
            END IF;
        END IF;
    END IF;
END//

-- Trigger to auto-assign workflow stages based on user role
DROP TRIGGER IF EXISTS tr_auto_assign_workflow_stage;
CREATE TRIGGER tr_auto_assign_workflow_stage
AFTER UPDATE ON patient_visits
FOR EACH ROW
BEGIN
    DECLARE required_role_id INT;
    
    -- When current stage changes, auto-assign to appropriate user if not already assigned
    IF NEW.current_stage_id != OLD.current_stage_id AND NEW.current_stage_id IS NOT NULL THEN
        -- Get required role for the new stage
        SELECT required_role_id INTO required_role_id
        FROM workflow_stages
        WHERE id = NEW.current_stage_id;
        
        -- Update workflow progress to mark stage as started
        UPDATE visit_workflow_progress
        SET started_at = NOW()
        WHERE visit_id = NEW.id 
        AND stage_id = NEW.current_stage_id
        AND started_at IS NULL;
    END IF;
END//

-- =============================================
-- DATA VALIDATION TRIGGERS
-- =============================================

-- Trigger to validate patient data integrity
DROP TRIGGER IF EXISTS tr_validate_patient_data;
CREATE TRIGGER tr_validate_patient_data
BEFORE INSERT ON patients
FOR EACH ROW
BEGIN
    -- Validate ID number format (South African ID)
    IF NEW.id_number IS NOT NULL AND LENGTH(NEW.id_number) != 13 THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Invalid ID number format - must be 13 digits';
    END IF;
    
    -- Validate email format
    IF NEW.email IS NOT NULL AND NEW.email NOT REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Invalid email format';
    END IF;
    
    -- Validate phone number format
    IF NEW.phone_number IS NOT NULL AND NEW.phone_number NOT REGEXP '^[0-9+\-\s()]{10,15}$' THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Invalid phone number format';
    END IF;
END//

-- Trigger to validate vital signs ranges
DROP TRIGGER IF EXISTS tr_validate_vital_signs;
CREATE TRIGGER tr_validate_vital_signs
BEFORE INSERT ON vital_signs
FOR EACH ROW
BEGIN
    -- Validate blood pressure ranges
    IF NEW.systolic_bp IS NOT NULL AND (NEW.systolic_bp < 70 OR NEW.systolic_bp > 250) THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Systolic blood pressure out of valid range (70-250 mmHg)';
    END IF;
    
    IF NEW.diastolic_bp IS NOT NULL AND (NEW.diastolic_bp < 40 OR NEW.diastolic_bp > 150) THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Diastolic blood pressure out of valid range (40-150 mmHg)';
    END IF;
    
    -- Validate heart rate
    IF NEW.heart_rate IS NOT NULL AND (NEW.heart_rate < 30 OR NEW.heart_rate > 220) THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Heart rate out of valid range (30-220 bpm)';
    END IF;
    
    -- Validate temperature
    IF NEW.temperature IS NOT NULL AND (NEW.temperature < 30.0 OR NEW.temperature > 45.0) THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Temperature out of valid range (30.0-45.0°C)';
    END IF;
    
    -- Validate oxygen saturation
    IF NEW.oxygen_saturation IS NOT NULL AND (NEW.oxygen_saturation < 70 OR NEW.oxygen_saturation > 100) THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Oxygen saturation out of valid range (70-100%)';
    END IF;
END//

DELIMITER ;
