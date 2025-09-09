-- PALMED Mobile Clinic ERP - Performance Optimization
-- Additional indexes and performance tuning for large-scale operations

USE palmed_clinic_erp;

-- =============================================
-- PERFORMANCE INDEXES
-- =============================================

-- Composite indexes for common query patterns
CREATE INDEX idx_patients_member_status ON patients (is_palmed_member, member_type, created_at);
CREATE INDEX idx_patients_search ON patients (last_name, first_name, medical_aid_number);
CREATE INDEX idx_patients_demographics ON patients (date_of_birth) USING BTREE;

-- Visit and workflow performance indexes
CREATE INDEX idx_visits_date_location ON patient_visits (visit_date, location, is_completed);
CREATE INDEX idx_visits_patient_date ON patient_visits (patient_id, visit_date DESC);
CREATE INDEX idx_workflow_progress_status ON visit_workflow_progress (visit_id, stage_id, is_completed, started_at);

-- Appointment and scheduling indexes
CREATE INDEX idx_appointments_booking_date ON appointments (route_location_id, status, appointment_time);
CREATE INDEX idx_route_locations_date_province ON route_locations (visit_date, route_id);
CREATE INDEX idx_routes_active_province ON routes (is_active, province, start_date, end_date);

-- Inventory management indexes
CREATE INDEX idx_inventory_expiry_status ON inventory_stock (expiry_date, status, consumable_id);
CREATE INDEX idx_inventory_usage_date ON inventory_usage (usage_date, consumable_id, used_by);
CREATE INDEX idx_assets_maintenance_status ON assets (next_maintenance_date, status, category_id);

-- Audit and compliance indexes
CREATE INDEX idx_audit_user_date ON audit_log (user_id, created_at DESC);
CREATE INDEX idx_audit_table_action ON audit_log (table_name, action, created_at);
CREATE INDEX idx_sync_status_device ON sync_status (device_id, sync_status, server_timestamp);

-- Full-text search indexes for clinical notes
ALTER TABLE clinical_notes ADD FULLTEXT(content);
ALTER TABLE patients ADD FULLTEXT(first_name, last_name);

-- =============================================
-- PERFORMANCE VIEWS FOR REPORTING
-- =============================================

-- Optimized view for dashboard statistics
CREATE VIEW v_dashboard_stats AS
SELECT 
    'today' as period,
    COUNT(DISTINCT pv.id) as total_visits,
    COUNT(DISTINCT pv.patient_id) as unique_patients,
    COUNT(DISTINCT CASE WHEN pv.is_completed = TRUE THEN pv.id END) as completed_visits,
    COUNT(DISTINCT a.id) as total_appointments,
    COUNT(DISTINCT CASE WHEN a.status = 'Booked' THEN a.id END) as booked_appointments,
    (SELECT COUNT(*) FROM inventory_stock WHERE status = 'Active' AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)) as expiring_items,
    (SELECT COUNT(*) FROM assets WHERE next_maintenance_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)) as maintenance_due
FROM patient_visits pv
LEFT JOIN appointments a ON pv.id = a.visit_id
WHERE pv.visit_date = CURDATE()

UNION ALL

SELECT 
    'week' as period,
    COUNT(DISTINCT pv.id) as total_visits,
    COUNT(DISTINCT pv.patient_id) as unique_patients,
    COUNT(DISTINCT CASE WHEN pv.is_completed = TRUE THEN pv.id END) as completed_visits,
    COUNT(DISTINCT a.id) as total_appointments,
    COUNT(DISTINCT CASE WHEN a.status = 'Booked' THEN a.id END) as booked_appointments,
    0 as expiring_items,
    0 as maintenance_due
FROM patient_visits pv
LEFT JOIN appointments a ON pv.id = a.visit_id
WHERE pv.visit_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)

UNION ALL

SELECT 
    'month' as period,
    COUNT(DISTINCT pv.id) as total_visits,
    COUNT(DISTINCT pv.patient_id) as unique_patients,
    COUNT(DISTINCT CASE WHEN pv.is_completed = TRUE THEN pv.id END) as completed_visits,
    COUNT(DISTINCT a.id) as total_appointments,
    COUNT(DISTINCT CASE WHEN a.status = 'Booked' THEN a.id END) as booked_appointments,
    0 as expiring_items,
    0 as maintenance_due
FROM patient_visits pv
LEFT JOIN appointments a ON pv.id = a.visit_id
WHERE pv.visit_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY);

-- =============================================
-- AUTOMATED MAINTENANCE PROCEDURES
-- =============================================

DELIMITER //

-- Procedure to clean up old audit logs (POPI compliance - 7 years retention)
CREATE PROCEDURE sp_cleanup_audit_logs()
BEGIN
    DECLARE rows_deleted INT DEFAULT 0;
    
    DELETE FROM audit_log 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 YEAR);
    
    SET rows_deleted = ROW_COUNT();
    
    INSERT INTO system_settings (setting_key, setting_value, setting_type, description, updated_at)
    VALUES (
        'last_audit_cleanup',
        JSON_OBJECT('date', NOW(), 'rows_deleted', rows_deleted),
        'json',
        'Last audit log cleanup execution',
        NOW()
    )
    ON DUPLICATE KEY UPDATE
        setting_value = VALUES(setting_value),
        updated_at = NOW();
END//

-- Procedure to update inventory status based on expiry dates
CREATE PROCEDURE sp_update_expired_inventory()
BEGIN
    DECLARE expired_count INT DEFAULT 0;
    
    UPDATE inventory_stock 
    SET status = 'Expired'
    WHERE status = 'Active' 
    AND expiry_date <= CURDATE();
    
    SET expired_count = ROW_COUNT();
    
    INSERT INTO system_settings (setting_key, setting_value, setting_type, description, updated_at)
    VALUES (
        'last_expiry_update',
        JSON_OBJECT('date', NOW(), 'items_expired', expired_count),
        'json',
        'Last inventory expiry update',
        NOW()
    )
    ON DUPLICATE KEY UPDATE
        setting_value = VALUES(setting_value),
        updated_at = NOW();
END//

-- Procedure to clean up old sync records
CREATE PROCEDURE sp_cleanup_sync_records()
BEGIN
    DECLARE rows_deleted INT DEFAULT 0;
    
    DELETE FROM sync_status 
    WHERE sync_status = 'Synced' 
    AND synced_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
    
    SET rows_deleted = ROW_COUNT();
    
    INSERT INTO system_settings (setting_key, setting_value, setting_type, description, updated_at)
    VALUES (
        'last_sync_cleanup',
        JSON_OBJECT('date', NOW(), 'rows_deleted', rows_deleted),
        'json',
        'Last sync records cleanup',
        NOW()
    )
    ON DUPLICATE KEY UPDATE
        setting_value = VALUES(setting_value),
        updated_at = NOW();
END//

DELIMITER ;

-- =============================================
-- SCHEDULED EVENTS FOR MAINTENANCE
-- =============================================

-- Daily maintenance event
CREATE EVENT ev_daily_maintenance
ON SCHEDULE EVERY 1 DAY
STARTS TIMESTAMP(CURDATE() + INTERVAL 1 DAY, '02:00:00')
DO
BEGIN
    CALL sp_update_expired_inventory();
    CALL sp_generate_daily_report(CURDATE() - INTERVAL 1 DAY, @result);
END;

-- Weekly maintenance event
CREATE EVENT ev_weekly_maintenance
ON SCHEDULE EVERY 1 WEEK
STARTS TIMESTAMP(CURDATE() + INTERVAL (7 - WEEKDAY(CURDATE())) DAY, '03:00:00')
DO
BEGIN
    CALL sp_cleanup_sync_records();
    OPTIMIZE TABLE audit_log, sync_status, inventory_usage;
END;

-- Monthly maintenance event
CREATE EVENT ev_monthly_maintenance
ON SCHEDULE EVERY 1 MONTH
STARTS TIMESTAMP(LAST_DAY(CURDATE()) + INTERVAL 1 DAY, '04:00:00')
DO
BEGIN
    CALL sp_cleanup_audit_logs();
    ANALYZE TABLE patients, patient_visits, appointments, inventory_stock;
END;

-- =============================================
-- PERFORMANCE MONITORING QUERIES
-- =============================================

-- Create view for monitoring database performance
CREATE VIEW v_performance_metrics AS
SELECT 
    'Database Size' as metric,
    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as value_mb,
    'MB' as unit
FROM information_schema.tables 
WHERE table_schema = 'palmed_clinic_erp'

UNION ALL

SELECT 
    'Total Records' as metric,
    SUM(table_rows) as value_mb,
    'rows' as unit
FROM information_schema.tables 
WHERE table_schema = 'palmed_clinic_erp'

UNION ALL

SELECT 
    'Active Patients' as metric,
    COUNT(*) as value_mb,
    'patients' as unit
FROM patients 
WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)

UNION ALL

SELECT 
    'Monthly Visits' as metric,
    COUNT(*) as value_mb,
    'visits' as unit
FROM patient_visits 
WHERE visit_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY);

-- =============================================
-- BACKUP AND RECOVERY PROCEDURES
-- =============================================

DELIMITER //

-- Procedure to create logical backup information
CREATE PROCEDURE sp_backup_info()
BEGIN
    SELECT 
        'PALMED Clinic ERP Backup Information' as backup_info,
        NOW() as backup_timestamp,
        COUNT(*) as total_patients
    FROM patients
    
    UNION ALL
    
    SELECT 
        'Total Visits' as backup_info,
        NULL as backup_timestamp,
        COUNT(*) as total_patients
    FROM patient_visits
    
    UNION ALL
    
    SELECT 
        'Total Inventory Items' as backup_info,
        NULL as backup_timestamp,
        COUNT(*) as total_patients
    FROM inventory_stock
    
    UNION ALL
    
    SELECT 
        'Database Size (MB)' as backup_info,
        NULL as backup_timestamp,
        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as total_patients
    FROM information_schema.tables 
    WHERE table_schema = 'palmed_clinic_erp';
END//

DELIMITER ;
