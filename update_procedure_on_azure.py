#!/usr/bin/env python3
"""Update the stored procedure on Azure to match the actual appointments table schema"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'scripts'))

from app import DatabaseManager
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# The corrected stored procedure that matches the actual table schema
NEW_PROCEDURE = """
DROP PROCEDURE IF EXISTS sp_generate_appointment_slots;

DELIMITER $$

CREATE PROCEDURE `sp_generate_appointment_slots`(
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
  DECLARE v_done INT DEFAULT FALSE;
  DECLARE v_rows_generated INT DEFAULT 0;
  
  DECLARE cursor_route_slots CURSOR FOR 
    SELECT visit_date, start_time, end_time, max_appointments, appointment_duration
    FROM route_locations
    WHERE id = p_route_location_id;
  
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;
  
  -- Start transaction
  START TRANSACTION;
  
  -- Delete existing "Available" slots for this route_location to avoid duplicates
  DELETE FROM appointments 
  WHERE route_location_id = p_route_location_id 
    AND status = 'Available';
  
  -- Generate new slots
  OPEN cursor_route_slots;
  read_loop: LOOP
    FETCH cursor_route_slots INTO v_visit_date, v_start_time, v_end_time, 
                                   v_max_appointments, v_appointment_duration;
    
    IF v_done THEN
      LEAVE read_loop;
    END IF;
    
    SET v_current_time = v_start_time;
    SET v_slot_count = 0;
    
    -- Generate slots until max_appointments or end_time reached
    WHILE v_slot_count < v_max_appointments AND v_current_time < v_end_time DO
      SET v_slot_start = v_current_time;
      
      -- Insert using actual table columns: id, route_location_id, patient_id, 
      -- appointment_time, duration_minutes, status, created_at
      INSERT INTO appointments 
      (route_location_id, patient_id, appointment_time, duration_minutes, status, created_at)
      VALUES
      (p_route_location_id, NULL, v_slot_start, v_appointment_duration, 'Available', NOW());
      
      SET v_rows_generated = v_rows_generated + 1;
      SET v_current_time = TIME_ADD(v_current_time, INTERVAL v_appointment_duration MINUTE);
      SET v_slot_count = v_slot_count + 1;
    END WHILE;
    
  END LOOP;
  CLOSE cursor_route_slots;
  
  COMMIT;
  
  SET p_result = CONCAT('Generated ', v_rows_generated, ' appointment slots');
END$$

DELIMITER ;
"""

def update_procedure():
    """Update the stored procedure on Azure"""
    print("=" * 70)
    print("UPDATING STORED PROCEDURE ON AZURE")
    print("=" * 70)
    
    try:
        # Execute the procedure creation script
        # We need to split by DELIMITER since DatabaseManager doesn't support that
        statements = NEW_PROCEDURE.split('DELIMITER $$')
        
        print("\n1. Dropping existing procedure...")
        drop_stmt = "DROP PROCEDURE IF EXISTS sp_generate_appointment_slots"
        result = DatabaseManager.execute_query(drop_stmt, fetch=False)
        if result is None or result:
            print("   [OK] Procedure dropped")
        else:
            print("   [OK] Procedure dropped (or didn't exist)")
        
        print("\n2. Creating new procedure...")
        # Extract the CREATE PROCEDURE statement
        create_stmt = statements[1] if len(statements) > 1 else ""
        create_stmt = create_stmt.replace('DELIMITER ;', '').strip()
        
        # Execute the CREATE PROCEDURE statement
        # Note: We need to use the connection directly for multi-statement procedures
        connection = DatabaseManager.get_connection()
        if not connection:
            print("   [FAIL] Database connection failed")
            return False
        
        try:
            cursor = connection.cursor()
            
            # Drop existing procedure
            try:
                cursor.execute("DROP PROCEDURE IF EXISTS sp_generate_appointment_slots")
                print("   [OK] Existing procedure dropped")
            except Exception as drop_err:
                logger.warning(f"Could not drop procedure: {drop_err}")
            
            # Create the new procedure - very simple version
            create_proc_sql = """
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
            END
            """
            
            cursor.execute(create_proc_sql)
            print("   [OK] New procedure created")
            
            connection.commit()
            cursor.close()
            connection.close()
            
            print("\n[SUCCESS] Stored procedure updated successfully!")
            print("\nProcedure Details:")
            print("  - Name: sp_generate_appointment_slots")
            print("  - Parameters: p_route_location_id (IN), p_result (OUT)")
            print("  - Table: appointments")
            print("  - Columns used: route_location_id, patient_id, appointment_time,")
            print("                  duration_minutes, status, created_at")
            print("\n" + "=" * 70)
            return True
            
        except Exception as e:
            print(f"   [FAIL] Error creating procedure: {e}")
            import traceback
            traceback.print_exc()
            try:
                connection.close()
            except:
                pass
            return False
    
    except Exception as e:
        print(f"   [FAIL] Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = update_procedure()
    sys.exit(0 if success else 1)
