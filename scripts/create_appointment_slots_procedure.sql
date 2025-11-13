-- Create stored procedure to generate appointment slots for route locations
-- This procedure creates patient_appointments records for each time slot in a route_location

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_generate_appointment_slots$$

CREATE PROCEDURE sp_generate_appointment_slots(
    IN p_route_location_id INT,
    OUT p_result_message VARCHAR(255)
)
BEGIN
    DECLARE v_visit_date DATE;
    DECLARE v_start_time TIME;
    DECLARE v_end_time TIME;
    DECLARE v_max_appointments INT;
    DECLARE v_appointment_duration INT;
    DECLARE v_route_id INT;
    DECLARE v_location_id INT;
    DECLARE v_current_time TIME;
    DECLARE v_slot_end_time TIME;
    DECLARE v_slots_created INT DEFAULT 0;
    DECLARE v_existing_count INT;
    
    -- Get route_location details
    SELECT route_id, location_id, visit_date, start_time, end_time, 
           max_appointments, COALESCE(appointment_duration, 30)
    INTO v_route_id, v_location_id, v_visit_date, v_start_time, v_end_time, 
         v_max_appointments, v_appointment_duration
    FROM route_locations
    WHERE id = p_route_location_id;
    
    -- Check if route_location exists
    IF v_route_id IS NULL THEN
        SET p_result_message = CONCAT('ERROR: Route location ', p_route_location_id, ' not found');
        ROLLBACK;
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = p_result_message;
    END IF;
    
    -- Check if slots already exist (avoid duplicates)
    SELECT COUNT(*) INTO v_existing_count
    FROM patient_appointments
    WHERE route_location_id = p_route_location_id;
    
    IF v_existing_count > 0 THEN
        SET p_result_message = CONCAT('SUCCESS: ', v_existing_count, ' appointment slots already exist for route_location ', p_route_location_id);
        -- Don't regenerate, return success
    ELSE
        -- Generate time slots based on appointment duration
        SET v_current_time = v_start_time;
        
        WHILE v_current_time < v_end_time DO
            -- Calculate slot end time
            SET v_slot_end_time = ADDTIME(v_current_time, SEC_TO_TIME(v_appointment_duration * 60));
            
            -- Don't create slot if it would extend beyond end_time
            IF v_slot_end_time > v_end_time THEN
                LEAVE;
            END IF;
            
            -- Insert appointment slot with 'available' status
            INSERT INTO patient_appointments (
                route_location_id,
                appointment_date,
                appointment_time,
                appointment_duration,
                status,
                created_at
            ) VALUES (
                p_route_location_id,
                v_visit_date,
                v_current_time,
                v_appointment_duration,
                'available',  -- Critical: must be 'available' (lowercase) to match query filter
                NOW()
            );
            
            SET v_slots_created = v_slots_created + 1;
            
            -- Move to next slot
            SET v_current_time = v_slot_end_time;
        END WHILE;
        
        SET p_result_message = CONCAT('SUCCESS: Created ', v_slots_created, ' appointment slots for route_location ', p_route_location_id);
    END IF;
    
END$$

DELIMITER ;

-- Grant execute permissions
-- GRANT EXECUTE ON PROCEDURE palmed_clinic_erp.sp_generate_appointment_slots TO 'your_app_user'@'%';
