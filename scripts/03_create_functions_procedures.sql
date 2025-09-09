-- PALMED Mobile Clinic ERP - Functions and Stored Procedures
-- Business logic and data processing functions

USE palmed_clinic_erp;

DELIMITER //

-- =============================================
-- PATIENT MANAGEMENT FUNCTIONS
-- =============================================

-- Function to calculate patient age
CREATE FUNCTION fn_calculate_age(birth_date DATE)
RETURNS INT
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE age INT;
    SET age = TIMESTAMPDIFF(YEAR, birth_date, CURDATE());
    RETURN age;
END//

-- Function to get patient risk category based on age and conditions
CREATE FUNCTION fn_get_patient_risk_category(patient_id INT)
RETURNS VARCHAR(20)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE risk_category VARCHAR(20) DEFAULT 'Low';
    DECLARE patient_age INT;
    DECLARE chronic_count INT;
    
    SELECT 
        fn_calculate_age(date_of_birth),
        JSON_LENGTH(COALESCE(chronic_conditions, '[]'))
    INTO patient_age, chronic_count
    FROM patients 
    WHERE id = patient_id;
    
    IF patient_age >= 65 OR chronic_count >= 3 THEN
        SET risk_category = 'High';
    ELSEIF patient_age >= 50 OR chronic_count >= 1 THEN
        SET risk_category = 'Medium';
    END IF;
    
    RETURN risk_category;
END//

-- Function to generate unique booking reference
CREATE FUNCTION fn_generate_booking_reference()
RETURNS VARCHAR(50)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE ref_code VARCHAR(50);
    DECLARE ref_exists INT DEFAULT 1;
    
    WHILE ref_exists > 0 DO
        SET ref_code = CONCAT('PAL', DATE_FORMAT(NOW(), '%Y%m%d'), LPAD(FLOOR(RAND() * 10000), 4, '0'));
        SELECT COUNT(*) INTO ref_exists FROM appointments WHERE booking_reference = ref_code;
    END WHILE;
    
    RETURN ref_code;
END//

-- =============================================
-- WORKFLOW MANAGEMENT PROCEDURES
-- =============================================

-- Procedure to initialize patient visit workflow
CREATE PROCEDURE sp_initialize_visit_workflow(
    IN p_visit_id INT,
    OUT p_result VARCHAR(100)
)
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE stage_id INT;
    DECLARE stage_cursor CURSOR FOR 
        SELECT id FROM workflow_stages ORDER BY stage_order;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_result = 'ERROR: Failed to initialize workflow';
    END;
    
    START TRANSACTION;
    
    -- Delete existing workflow progress for this visit
    DELETE FROM visit_workflow_progress WHERE visit_id = p_visit_id;
    
    -- Initialize all workflow stages
    OPEN stage_cursor;
    read_loop: LOOP
        FETCH stage_cursor INTO stage_id;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        INSERT INTO visit_workflow_progress (visit_id, stage_id, is_completed)
        VALUES (p_visit_id, stage_id, FALSE);
    END LOOP;
    CLOSE stage_cursor;
    
    -- Set first stage as current
    UPDATE patient_visits 
    SET current_stage_id = (SELECT id FROM workflow_stages ORDER BY stage_order LIMIT 1)
    WHERE id = p_visit_id;
    
    COMMIT;
    SET p_result = 'SUCCESS: Workflow initialized';
END//

-- Procedure to advance workflow to next stage
CREATE PROCEDURE sp_advance_workflow_stage(
    IN p_visit_id INT,
    IN p_current_stage_id INT,
    IN p_user_id INT,
    IN p_notes TEXT,
    IN p_data_collected JSON,
    OUT p_result VARCHAR(100)
)
BEGIN
    DECLARE next_stage_id INT DEFAULT NULL;
    DECLARE current_stage_order INT;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_result = 'ERROR: Failed to advance workflow stage';
    END;
    
    START TRANSACTION;
    
    -- Complete current stage
    UPDATE visit_workflow_progress 
    SET 
        completed_at = NOW(),
        is_completed = TRUE,
        notes = p_notes,
        data_collected = p_data_collected
    WHERE visit_id = p_visit_id AND stage_id = p_current_stage_id;
    
    -- Get current stage order
    SELECT stage_order INTO current_stage_order
    FROM workflow_stages 
    WHERE id = p_current_stage_id;
    
    -- Find next stage
    SELECT id INTO next_stage_id
    FROM workflow_stages 
    WHERE stage_order > current_stage_order
    ORDER BY stage_order 
    LIMIT 1;
    
    IF next_stage_id IS NOT NULL THEN
        -- Update visit to next stage
        UPDATE patient_visits 
        SET current_stage_id = next_stage_id
        WHERE id = p_visit_id;
        
        -- Start next stage
        UPDATE visit_workflow_progress 
        SET 
            started_at = NOW(),
            assigned_user_id = p_user_id
        WHERE visit_id = p_visit_id AND stage_id = next_stage_id;
        
        SET p_result = CONCAT('SUCCESS: Advanced to stage ', next_stage_id);
    ELSE
        -- Complete the visit
        UPDATE patient_visits 
        SET 
            is_completed = TRUE,
            completed_at = NOW(),
            current_stage_id = NULL
        WHERE id = p_visit_id;
        
        SET p_result = 'SUCCESS: Visit completed';
    END IF;
    
    COMMIT;
END//

-- =============================================
-- APPOINTMENT MANAGEMENT PROCEDURES
-- =============================================

-- Procedure to generate appointment slots for a route location
CREATE PROCEDURE sp_generate_appointment_slots(
    IN p_route_location_id INT,
    OUT p_result VARCHAR(100)
)
BEGIN
    DECLARE slot_time TIME;
    DECLARE end_time TIME;
    DECLARE duration_minutes INT;
    DECLARE max_appointments INT;
    DECLARE slots_created INT DEFAULT 0;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_result = 'ERROR: Failed to generate appointment slots';
    END;
    
    START TRANSACTION;
    
    -- Get route location details
    SELECT start_time, end_time, max_appointments, appointment_duration
    INTO slot_time, end_time, max_appointments, duration_minutes
    FROM route_locations
    WHERE id = p_route_location_id;
    
    -- Delete existing slots
    DELETE FROM appointments WHERE route_location_id = p_route_location_id;
    
    -- Generate appointment slots
    WHILE slot_time < end_time AND slots_created < max_appointments DO
        INSERT INTO appointments (
            route_location_id,
            appointment_time,
            duration_minutes,
            status,
            created_at
        ) VALUES (
            p_route_location_id,
            slot_time,
            duration_minutes,
            'Available',
            NOW()
        );
        
        SET slot_time = ADDTIME(slot_time, SEC_TO_TIME(duration_minutes * 60));
        SET slots_created = slots_created + 1;
    END WHILE;
    
    COMMIT;
    SET p_result = CONCAT('SUCCESS: Generated ', slots_created, ' appointment slots');
END//

-- Procedure to book an appointment
CREATE PROCEDURE sp_book_appointment(
    IN p_appointment_id INT,
    IN p_patient_id INT,
    IN p_booked_by_name VARCHAR(200),
    IN p_booked_by_phone VARCHAR(20),
    IN p_booked_by_email VARCHAR(255),
    IN p_special_requirements TEXT,
    OUT p_booking_reference VARCHAR(50),
    OUT p_result VARCHAR(100)
)
BEGIN
    DECLARE appointment_status VARCHAR(20);
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_result = 'ERROR: Failed to book appointment';
        SET p_booking_reference = NULL;
    END;
    
    START TRANSACTION;
    
    -- Check if appointment is available
    SELECT status INTO appointment_status
    FROM appointments
    WHERE id = p_appointment_id;
    
    IF appointment_status != 'Available' THEN
        SET p_result = 'ERROR: Appointment not available';
        SET p_booking_reference = NULL;
        ROLLBACK;
    ELSE
        -- Generate booking reference
        SET p_booking_reference = fn_generate_booking_reference();
        
        -- Book the appointment
        UPDATE appointments
        SET 
            patient_id = p_patient_id,
            status = 'Booked',
            booking_reference = p_booking_reference,
            booked_by_name = p_booked_by_name,
            booked_by_phone = p_booked_by_phone,
            booked_by_email = p_booked_by_email,
            special_requirements = p_special_requirements,
            booked_at = NOW()
        WHERE id = p_appointment_id;
        
        COMMIT;
        SET p_result = 'SUCCESS: Appointment booked';
    END IF;
END//

-- =============================================
-- INVENTORY MANAGEMENT PROCEDURES
-- =============================================

-- Procedure to update inventory stock after usage
CREATE PROCEDURE sp_record_inventory_usage(
    IN p_consumable_id INT,
    IN p_quantity_used INT,
    IN p_visit_id INT,
    IN p_used_by INT,
    IN p_location VARCHAR(255),
    IN p_notes TEXT,
    OUT p_result VARCHAR(100)
)
BEGIN
    DECLARE stock_id INT;
    DECLARE available_quantity INT;
    DECLARE remaining_quantity INT;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_result = 'ERROR: Failed to record inventory usage';
    END;
    
    START TRANSACTION;
    
    -- Find the oldest active stock with sufficient quantity (FIFO)
    SELECT id, quantity_current
    INTO stock_id, available_quantity
    FROM inventory_stock
    WHERE consumable_id = p_consumable_id 
    AND status = 'Active'
    AND quantity_current >= p_quantity_used
    ORDER BY expiry_date, received_date
    LIMIT 1;
    
    IF stock_id IS NULL THEN
        SET p_result = 'ERROR: Insufficient stock available';
        ROLLBACK;
    ELSE
        -- Record the usage
        INSERT INTO inventory_usage (
            stock_id,
            visit_id,
            quantity_used,
            used_by,
            usage_date,
            usage_time,
            location,
            notes
        ) VALUES (
            stock_id,
            p_visit_id,
            p_quantity_used,
            p_used_by,
            CURDATE(),
            CURTIME(),
            p_location,
            p_notes
        );
        
        -- Update stock quantity
        SET remaining_quantity = available_quantity - p_quantity_used;
        UPDATE inventory_stock
        SET quantity_current = remaining_quantity
        WHERE id = stock_id;
        
        COMMIT;
        SET p_result = 'SUCCESS: Inventory usage recorded';
    END IF;
END//

-- Procedure to check and alert for expiring inventory
CREATE PROCEDURE sp_check_expiring_inventory(
    IN p_days_ahead INT,
    OUT p_alert_count INT
)
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE item_name VARCHAR(255);
    DECLARE batch_number VARCHAR(100);
    DECLARE expiry_date DATE;
    DECLARE quantity INT;
    DECLARE days_to_expiry INT;
    
    DECLARE expiry_cursor CURSOR FOR
        SELECT c.item_name, ist.batch_number, ist.expiry_date, ist.quantity_current,
               DATEDIFF(ist.expiry_date, CURDATE()) as days_to_expiry
        FROM inventory_stock ist
        JOIN consumables c ON ist.consumable_id = c.id
        WHERE ist.status = 'Active'
        AND ist.expiry_date <= DATE_ADD(CURDATE(), INTERVAL p_days_ahead DAY)
        ORDER BY ist.expiry_date;
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    SET p_alert_count = 0;
    
    -- Create temporary table for alerts if it doesn't exist
    CREATE TEMPORARY TABLE IF NOT EXISTS temp_expiry_alerts (
        item_name VARCHAR(255),
        batch_number VARCHAR(100),
        expiry_date DATE,
        quantity_current INT,
        days_to_expiry INT,
        alert_level VARCHAR(20)
    );
    
    -- Clear previous alerts
    DELETE FROM temp_expiry_alerts;
    
    OPEN expiry_cursor;
    read_loop: LOOP
        FETCH expiry_cursor INTO item_name, batch_number, expiry_date, quantity, days_to_expiry;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        INSERT INTO temp_expiry_alerts VALUES (
            item_name,
            batch_number,
            expiry_date,
            quantity,
            days_to_expiry,
            CASE 
                WHEN days_to_expiry <= 0 THEN 'EXPIRED'
                WHEN days_to_expiry <= 7 THEN 'CRITICAL'
                WHEN days_to_expiry <= 30 THEN 'WARNING'
                ELSE 'NOTICE'
            END
        );
        
        SET p_alert_count = p_alert_count + 1;
    END LOOP;
    CLOSE expiry_cursor;
END//

-- =============================================
-- REPORTING PROCEDURES
-- =============================================

-- Procedure to generate daily operations report
CREATE PROCEDURE sp_generate_daily_report(
    IN p_report_date DATE,
    OUT p_result VARCHAR(100)
)
BEGIN
    DECLARE total_visits INT DEFAULT 0;
    DECLARE completed_visits INT DEFAULT 0;
    DECLARE total_patients INT DEFAULT 0;
    DECLARE palmed_members INT DEFAULT 0;
    
    -- Get daily statistics
    SELECT 
        COUNT(*),
        COUNT(CASE WHEN is_completed = TRUE THEN 1 END),
        COUNT(DISTINCT patient_id),
        COUNT(DISTINCT CASE WHEN p.is_palmed_member = TRUE THEN pv.patient_id END)
    INTO total_visits, completed_visits, total_patients, palmed_members
    FROM patient_visits pv
    JOIN patients p ON pv.patient_id = p.id
    WHERE pv.visit_date = p_report_date;
    
    -- Create or update daily report record
    INSERT INTO system_settings (setting_key, setting_value, setting_type, description, updated_at)
    VALUES (
        CONCAT('daily_report_', DATE_FORMAT(p_report_date, '%Y%m%d')),
        JSON_OBJECT(
            'report_date', p_report_date,
            'total_visits', total_visits,
            'completed_visits', completed_visits,
            'total_patients', total_patients,
            'palmed_members', palmed_members,
            'completion_rate', ROUND((completed_visits / NULLIF(total_visits, 0)) * 100, 1),
            'generated_at', NOW()
        ),
        'json',
        'Daily operations report',
        NOW()
    )
    ON DUPLICATE KEY UPDATE
        setting_value = VALUES(setting_value),
        updated_at = NOW();
    
    SET p_result = CONCAT('SUCCESS: Daily report generated for ', p_report_date);
END//

DELIMITER ;
