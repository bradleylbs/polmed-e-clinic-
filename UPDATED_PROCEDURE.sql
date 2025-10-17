DROP PROCEDURE IF EXISTS sp_generate_appointment_slots;

CREATE PROCEDURE sp_generate_appointment_slots(
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
  DECLARE v_slot_count INT;
  DECLARE v_done INT;
  DECLARE v_rows_generated INT;
  
  DECLARE cursor_route_slots CURSOR FOR 
    SELECT visit_date, start_time, end_time, max_appointments, appointment_duration
    FROM route_locations
    WHERE id = p_route_location_id;
  
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;
  
  SET v_rows_generated = 0;
  SET v_done = 0;
  
  DELETE FROM appointments 
  WHERE route_location_id = p_route_location_id 
    AND status = 'Available';
  
  OPEN cursor_route_slots;
  
  FETCH cursor_route_slots 
  INTO v_visit_date, v_start_time, v_end_time, v_max_appointments, v_appointment_duration;
  
  IF v_done = 0 THEN
    SET v_current_time = v_start_time;
    SET v_slot_count = 0;
    
    label1: LOOP
      IF v_slot_count >= v_max_appointments THEN
        LEAVE label1;
      END IF;
      
      IF v_current_time >= v_end_time THEN
        LEAVE label1;
      END IF;
      
      INSERT INTO appointments 
      (route_location_id, patient_id, appointment_time, duration_minutes, status, created_at)
      VALUES
      (p_route_location_id, NULL, v_current_time, v_appointment_duration, 'Available', NOW());
      
      SET v_rows_generated = v_rows_generated + 1;
      SET v_current_time = TIME_ADD(v_current_time, INTERVAL v_appointment_duration MINUTE);
      SET v_slot_count = v_slot_count + 1;
      
    END LOOP label1;
  END IF;
  
  CLOSE cursor_route_slots;
  
  SET p_result = CONCAT('Generated ', v_rows_generated, ' appointment slots');
END;
