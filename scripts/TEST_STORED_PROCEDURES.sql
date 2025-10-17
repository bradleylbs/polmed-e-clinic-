-- ============================================================================
-- PALMED CLINIC ERP - STORED PROCEDURE TEST SCRIPT
-- ============================================================================
-- Run these tests in MySQL Workbench to verify stored procedures work correctly
-- ============================================================================

-- ============================================================================
-- SECTION 1: SETUP TEST DATA
-- ============================================================================

-- First, verify the tables exist
SELECT 'Checking tables...' as step;
SHOW TABLES LIKE 'route%';
SHOW TABLES LIKE 'patient%';
SHOW TABLES LIKE 'location%';

-- Get sample route and location data
SELECT 'Getting test data...' as step;

-- Find an active route
SELECT 'Active routes:' as section;
SELECT id, route_name, start_date, end_date, province, max_appointments_per_day 
FROM routes 
WHERE is_active = TRUE 
LIMIT 3;

-- Find route locations
SELECT 'Route locations:' as section;
SELECT id, route_id, location_id, visit_date, start_time, end_time, max_appointments, appointment_duration 
FROM route_locations 
LIMIT 3;

-- Find locations
SELECT 'Locations:' as section;
SELECT id, location_name, location_type_id, province, city 
FROM locations 
LIMIT 3;

-- ============================================================================
-- SECTION 2: TEST STORED PROCEDURE #1: sp_generate_appointment_slots
-- ============================================================================

SELECT '========================================' as separator;
SELECT 'TEST 1: sp_generate_appointment_slots' as test;
SELECT '========================================' as separator;

-- Get a route_location_id to test with
SET @test_route_location_id = (SELECT id FROM route_locations LIMIT 1);
SET @slot_count = 0;

SELECT CONCAT('Testing with route_location_id: ', @test_route_location_id) as info;

-- Call the stored procedure
SELECT 'Calling sp_generate_appointment_slots...' as action;
CALL sp_generate_appointment_slots(@test_route_location_id, @slot_count);

-- Get the result
SELECT @slot_count as 'Slots Created';

-- Verify slots were created in patient_appointments table
SELECT 'Verifying slots in patient_appointments:' as section;
SELECT 
    id,
    route_location_id,
    appointment_date,
    appointment_time,
    appointment_duration,
    booking_reference,
    status,
    patient_id,
    created_at
FROM patient_appointments 
WHERE route_location_id = @test_route_location_id
ORDER BY appointment_date, appointment_time
LIMIT 10;

-- Count total slots created
SELECT 
    route_location_id,
    appointment_date,
    COUNT(*) as slot_count,
    COUNT(CASE WHEN status = 'Available' THEN 1 END) as available_count,
    COUNT(CASE WHEN status = 'Booked' THEN 1 END) as booked_count,
    COUNT(CASE WHEN status = 'Confirmed' THEN 1 END) as confirmed_count
FROM patient_appointments 
WHERE route_location_id = @test_route_location_id
GROUP BY route_location_id, appointment_date;

-- ============================================================================
-- SECTION 3: TEST STORED PROCEDURE #2: sp_get_available_appointments
-- ============================================================================

SELECT '========================================' as separator;
SELECT 'TEST 2: sp_get_available_appointments' as test;
SELECT '========================================' as separator;

-- Set test parameters
SET @date_from = CURDATE();
SET @date_to = DATE_ADD(CURDATE(), INTERVAL 30 DAY);
SET @province = 'KwaZulu-Natal';

SELECT CONCAT('Testing with:') as params;
SELECT CONCAT('  Date from: ', @date_from) as param;
SELECT CONCAT('  Date to: ', @date_to) as param;
SELECT CONCAT('  Province: ', @province) as param;

-- Call the stored procedure
SELECT 'Calling sp_get_available_appointments...' as action;
CALL sp_get_available_appointments(@date_from, @date_to, @province);

-- ============================================================================
-- SECTION 4: MANUAL VERIFICATION QUERIES
-- ============================================================================

SELECT '========================================' as separator;
SELECT 'MANUAL VERIFICATION QUERIES' as test;
SELECT '========================================' as separator;

-- Query 1: Count appointments by status
SELECT 'Appointments by status:' as section;
SELECT 
    status,
    COUNT(*) as count,
    COUNT(DISTINCT route_location_id) as unique_routes,
    COUNT(DISTINCT patient_id) as unique_patients
FROM patient_appointments
GROUP BY status
ORDER BY status;

-- Query 2: Appointments by date
SELECT 'Appointments by date:' as section;
SELECT 
    appointment_date,
    COUNT(*) as total_appointments,
    COUNT(CASE WHEN status = 'Available' THEN 1 END) as available,
    COUNT(CASE WHEN status = 'Booked' THEN 1 END) as booked,
    COUNT(CASE WHEN status = 'Confirmed' THEN 1 END) as confirmed
FROM patient_appointments
WHERE appointment_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
GROUP BY appointment_date
ORDER BY appointment_date;

-- Query 3: Appointments with location info
SELECT 'Appointments with location details:' as section;
SELECT 
    pa.id,
    pa.appointment_date,
    pa.appointment_time,
    pa.status,
    rl.visit_date,
    l.location_name,
    l.city,
    l.province,
    r.route_name,
    pa.booking_reference,
    pa.patient_id
FROM patient_appointments pa
JOIN route_locations rl ON pa.route_location_id = rl.id
JOIN locations l ON rl.location_id = l.id
JOIN routes r ON rl.route_id = r.id
WHERE pa.appointment_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
AND pa.status = 'Available'
LIMIT 10;

-- Query 4: Route analysis
SELECT 'Route appointment analysis:' as section;
SELECT 
    r.id,
    r.route_name,
    r.province,
    COUNT(DISTINCT rl.id) as locations,
    COUNT(pa.id) as total_appointments,
    COUNT(CASE WHEN pa.status = 'Available' THEN 1 END) as available_slots,
    COUNT(CASE WHEN pa.status = 'Booked' THEN 1 END) as booked_slots,
    COUNT(CASE WHEN pa.status = 'Confirmed' THEN 1 END) as confirmed_slots
FROM routes r
LEFT JOIN route_locations rl ON r.id = rl.route_id
LEFT JOIN patient_appointments pa ON rl.id = pa.route_location_id
WHERE r.is_active = TRUE
GROUP BY r.id, r.route_name, r.province
ORDER BY r.route_name;

-- Query 5: Capacity utilization
SELECT 'Capacity utilization:' as section;
SELECT 
    rl.id as route_location_id,
    rl.visit_date,
    rl.max_appointments,
    COUNT(pa.id) as booked_count,
    (COUNT(pa.id) * 100.0 / rl.max_appointments) as utilization_percentage,
    (rl.max_appointments - COUNT(pa.id)) as available_slots
FROM route_locations rl
LEFT JOIN patient_appointments pa ON rl.id = pa.route_location_id
GROUP BY rl.id, rl.visit_date, rl.max_appointments
ORDER BY utilization_percentage DESC;

-- ============================================================================
-- SECTION 5: TEST DATA INTEGRITY
-- ============================================================================

SELECT '========================================' as separator;
SELECT 'DATA INTEGRITY CHECKS' as test;
SELECT '========================================' as separator;

-- Check 1: Orphaned route_locations
SELECT 'Orphaned route_locations:' as section;
SELECT COUNT(*) as orphaned_count
FROM patient_appointments pa
WHERE pa.route_location_id NOT IN (SELECT id FROM route_locations);

-- Check 2: Orphaned patients
SELECT 'Orphaned patients:' as section;
SELECT COUNT(*) as orphaned_count
FROM patient_appointments pa
WHERE pa.patient_id IS NOT NULL 
AND pa.patient_id NOT IN (SELECT id FROM patients);

-- Check 3: Invalid status values
SELECT 'Invalid status values:' as section;
SELECT DISTINCT status 
FROM patient_appointments
WHERE status NOT IN ('Available', 'Booked', 'Confirmed', 'Completed', 'Cancelled', 'NoShow')
ORDER BY status;

-- Check 4: Duplicate booking references
SELECT 'Duplicate booking references:' as section;
SELECT booking_reference, COUNT(*) as count
FROM patient_appointments
WHERE booking_reference IS NOT NULL
GROUP BY booking_reference
HAVING COUNT(*) > 1;

-- Check 5: NULL constraints
SELECT 'NULL constraint violations:' as section;
SELECT 
    SUM(CASE WHEN route_location_id IS NULL THEN 1 ELSE 0 END) as null_route_location_id,
    SUM(CASE WHEN appointment_date IS NULL THEN 1 ELSE 0 END) as null_appointment_date,
    SUM(CASE WHEN appointment_time IS NULL THEN 1 ELSE 0 END) as null_appointment_time,
    SUM(CASE WHEN status IS NULL THEN 1 ELSE 0 END) as null_status
FROM patient_appointments;

-- ============================================================================
-- SECTION 6: PERFORMANCE ANALYSIS
-- ============================================================================

SELECT '========================================' as separator;
SELECT 'PERFORMANCE ANALYSIS' as test;
SELECT '========================================' as separator;

-- Check indexes exist
SELECT 'Indexes on patient_appointments:' as section;
SELECT 
    INDEX_NAME,
    COLUMN_NAME,
    SEQ_IN_INDEX as position,
    CARDINALITY as estimated_unique_values
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'patient_appointments'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;

-- Check foreign keys exist
SELECT 'Foreign keys on patient_appointments:' as section;
SELECT 
    CONSTRAINT_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'patient_appointments'
AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY CONSTRAINT_NAME;

-- ============================================================================
-- SECTION 7: SUMMARY REPORT
-- ============================================================================

SELECT '========================================' as separator;
SELECT 'SUMMARY REPORT' as test;
SELECT '========================================' as separator;

SELECT 
    (SELECT COUNT(*) FROM routes WHERE is_active = TRUE) as active_routes,
    (SELECT COUNT(*) FROM route_locations) as route_locations,
    (SELECT COUNT(*) FROM locations) as locations,
    (SELECT COUNT(*) FROM patient_appointments) as total_appointments,
    (SELECT COUNT(*) FROM patient_appointments WHERE status = 'Available') as available_appointments,
    (SELECT COUNT(*) FROM patient_appointments WHERE status = 'Booked') as booked_appointments,
    (SELECT COUNT(*) FROM patient_appointments WHERE status = 'Confirmed') as confirmed_appointments,
    (SELECT COUNT(DISTINCT patient_id) FROM patient_appointments WHERE patient_id IS NOT NULL) as patients_with_bookings,
    (SELECT COUNT(DISTINCT route_location_id) FROM patient_appointments) as unique_route_locations
AS summary_stats;

-- ============================================================================
-- SECTION 8: TEST CLEANUP (OPTIONAL)
-- ============================================================================

-- Uncomment below to reset test data
-- DELETE FROM patient_appointments WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR);
-- SELECT 'Test data cleaned up' as action;

-- ============================================================================
-- END OF TEST SCRIPT
-- ============================================================================

SELECT '✅ TEST SCRIPT COMPLETED' as status;
SELECT 'All procedures and queries have been tested' as message;
