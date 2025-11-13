-- Exported from: db-polmed.mysql.database.azure.com
-- Database: palmed_clinic_erp
-- Exported on: 2025-10-17 15:10:28
-- Last modified: 2025-10-17 15:10:28

DROP PROCEDURE IF EXISTS sp_generate_appointment_slots;

DELIMITER $$

CREATE DEFINER=`dbadmin`@`%` PROCEDURE `sp_generate_appointment_slots`(
    IN p_route_location_id INT,
    OUT p_slot_count INT
)
    MODIFIES SQL DATA
proc_label: BEGIN
    DECLARE v_start_time TIME;
    DECLARE v_end_time TIME;
    DECLARE v_max_appointments INT;
    DECLARE v_appointment_duration INT;
    DECLARE v_slot_time TIME;
    DECLARE v_visit_date DATE;
    DECLARE v_slots_created INT DEFAULT 0;
    
    SET p_slot_count = 0;
    
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
    
    IF v_start_time IS NULL THEN
        SET p_slot_count = 0;
        LEAVE proc_label;
    END IF;
    
    SET v_slot_time = v_start_time;
    SET v_slots_created = 0;
    
    WHILE v_slot_time < v_end_time AND v_slots_created < v_max_appointments DO
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
        
        SET v_slots_created = v_slots_created + 1;
        
        SET v_slot_time = ADDTIME(v_slot_time, CONCAT('00:', LPAD(v_appointment_duration, 2, '0'), ':00'));
    END WHILE;
    
    SET p_slot_count = v_slots_created;
    
END
$$

DELIMITER ;
