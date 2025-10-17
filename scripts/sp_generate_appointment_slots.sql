-- ============================================================================
-- Stored Procedure: sp_generate_appointment_slots
-- ============================================================================
-- Purpose: Generate appointment slots for a given route_location
-- Parameters:
--   - p_route_location_id: The route_location ID to generate slots for
--   - p_slot_count: OUTPUT parameter returning number of slots created
-- ============================================================================

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_generate_appointment_slots$$

CREATE PROCEDURE sp_generate_appointment_slots(
    IN p_route_location_id INT,
    OUT p_slot_count INT
)
READS SQL DATA
MODIFIES SQL DATA
NOT DETERMINISTIC
SQL SECURITY DEFINER
BEGIN
    DECLARE v_start_time TIME;
    DECLARE v_end_time TIME;
    DECLARE v_max_appointments INT;
    DECLARE v_appointment_duration INT;
    DECLARE v_slot_time TIME;
    DECLARE v_visit_date DATE;
    DECLARE v_slots_created INT DEFAULT 0;
    
    -- Initialize output
    SET p_slot_count = 0;
    
    -- Fetch route_location details
    SELECT 
        start_time,
        end_time,
        max_appointments,
        appointment_duration,
        visit_date
    INTO 
        v_start_time,
        v_end_time,
        v_max_appointments,
        v_appointment_duration,
        v_visit_date
    FROM route_locations
    WHERE id = p_route_location_id
    LIMIT 1;
    
    -- If route_location not found, exit
    IF v_start_time IS NULL THEN
        SET p_slot_count = 0;
        LEAVE sp_generate_appointment_slots;
    END IF;
    
    -- Initialize slot time to start time
    SET v_slot_time = v_start_time;
    SET v_slots_created = 0;
    
    -- Generate slots until end time is reached or max appointments reached
    WHILE v_slot_time < v_end_time AND v_slots_created < v_max_appointments DO
        -- Insert appointment slot into patient_appointments table
        INSERT INTO patient_appointments 
        (route_location_id, appointment_date, appointment_time, booking_reference, status, created_at)
        VALUES (
            p_route_location_id,
            v_visit_date,
            v_slot_time,
            NULL,
            'Available',
            NOW()
        );
        
        -- Increment counter
        SET v_slots_created = v_slots_created + 1;
        
        -- Move to next slot time (add duration in minutes)
        SET v_slot_time = ADDTIME(v_slot_time, CONCAT('00:', LPAD(v_appointment_duration, 2, '0'), ':00'));
    END WHILE;
    
    -- Return the count of slots created
    SET p_slot_count = v_slots_created;
    
END$$

DELIMITER ;
