-- PALMED Mobile Clinic ERP - Database Views
-- Comprehensive views for reporting and data access

USE palmed_clinic_erp;

-- =============================================
-- USER MANAGEMENT VIEWS
-- =============================================

-- Active users with role information
CREATE VIEW v_active_users AS
SELECT 
    u.id,
    u.username,
    u.email,
    u.first_name,
    u.last_name,
    u.phone_number,
    u.mp_number,
    ur.role_name,
    ur.role_description,
    u.geographic_restrictions,
    u.last_login,
    u.created_at,
    CASE 
        WHEN u.last_login >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 'Active'
        WHEN u.last_login >= DATE_SUB(NOW(), INTERVAL 90 DAY) THEN 'Inactive'
        ELSE 'Dormant'
    END as activity_status
FROM users u
JOIN user_roles ur ON u.role_id = ur.id
WHERE u.is_active = TRUE;

-- User approval queue
CREATE VIEW v_pending_approvals AS
SELECT 
    u.id,
    u.username,
    u.email,
    u.first_name,
    u.last_name,
    u.mp_number,
    ur.role_name,
    u.created_at,
    DATEDIFF(NOW(), u.created_at) as days_pending
FROM users u
JOIN user_roles ur ON u.role_id = ur.id
WHERE u.requires_approval = TRUE 
AND u.approved_at IS NULL
AND u.is_active = TRUE;

-- =============================================
-- PATIENT MANAGEMENT VIEWS
-- =============================================

-- Patient summary with latest visit information
CREATE VIEW v_patient_summary AS
SELECT 
    p.id,
    p.medical_aid_number,
    p.first_name,
    p.last_name,
    p.date_of_birth,
    p.gender,
    p.phone_number,
    p.email,
    p.is_palmed_member,
    p.member_type,
    p.chronic_conditions,
    p.allergies,
    COUNT(pv.id) as total_visits,
    MAX(pv.visit_date) as last_visit_date,
    CASE 
        WHEN MAX(pv.visit_date) >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) THEN 'Recent'
        WHEN MAX(pv.visit_date) >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR) THEN 'Moderate'
        ELSE 'Inactive'
    END as patient_status,
    p.created_at
FROM patients p
LEFT JOIN patient_visits pv ON p.id = pv.patient_id
GROUP BY p.id;

-- Current active visits with workflow status
CREATE VIEW v_active_visits AS
SELECT 
    pv.id as visit_id,
    p.first_name,
    p.last_name,
    p.medical_aid_number,
    pv.visit_date,
    pv.visit_time,
    pv.location,
    pv.chief_complaint,
    ws.stage_name as current_stage,
    ws.stage_order,
    ur.role_name as required_role,
    pv.created_at,
    TIMESTAMPDIFF(HOUR, pv.created_at, NOW()) as hours_since_checkin
FROM patient_visits pv
JOIN patients p ON pv.patient_id = p.id
LEFT JOIN workflow_stages ws ON pv.current_stage_id = ws.id
LEFT JOIN user_roles ur ON ws.required_role_id = ur.id
WHERE pv.is_completed = FALSE
ORDER BY pv.created_at;

-- Workflow progress tracking
CREATE VIEW v_workflow_progress AS
SELECT 
    pv.id as visit_id,
    p.first_name,
    p.last_name,
    pv.visit_date,
    ws.stage_name,
    ws.stage_order,
    vwp.started_at,
    vwp.completed_at,
    vwp.is_completed,
    u.first_name as assigned_user_first_name,
    u.last_name as assigned_user_last_name,
    ur.role_name as assigned_user_role,
    CASE 
        WHEN vwp.completed_at IS NOT NULL THEN 'Completed'
        WHEN vwp.started_at IS NOT NULL THEN 'In Progress'
        ELSE 'Pending'
    END as stage_status,
    CASE 
        WHEN vwp.started_at IS NOT NULL AND vwp.completed_at IS NULL 
        THEN TIMESTAMPDIFF(MINUTE, vwp.started_at, NOW())
        ELSE NULL
    END as minutes_in_stage
FROM patient_visits pv
JOIN patients p ON pv.patient_id = p.id
JOIN visit_workflow_progress vwp ON pv.id = vwp.visit_id
JOIN workflow_stages ws ON vwp.stage_id = ws.id
LEFT JOIN users u ON vwp.assigned_user_id = u.id
LEFT JOIN user_roles ur ON u.role_id = ur.id
WHERE pv.is_completed = FALSE
ORDER BY pv.id, ws.stage_order;

-- Patient vital signs trends
CREATE VIEW v_patient_vitals_trends AS
SELECT 
    p.id as patient_id,
    p.first_name,
    p.last_name,
    vs.visit_id,
    pv.visit_date,
    vs.systolic_bp,
    vs.diastolic_bp,
    vs.heart_rate,
    vs.temperature,
    vs.weight,
    vs.height,
    vs.bmi,
    vs.oxygen_saturation,
    vs.blood_glucose,
    LAG(vs.systolic_bp) OVER (PARTITION BY p.id ORDER BY pv.visit_date) as prev_systolic_bp,
    LAG(vs.weight) OVER (PARTITION BY p.id ORDER BY pv.visit_date) as prev_weight,
    LAG(vs.bmi) OVER (PARTITION BY p.id ORDER BY pv.visit_date) as prev_bmi
FROM patients p
JOIN patient_visits pv ON p.id = pv.patient_id
JOIN vital_signs vs ON pv.id = vs.visit_id
ORDER BY p.id, pv.visit_date;

-- =============================================
-- ROUTE AND SCHEDULING VIEWS
-- =============================================

-- Route schedule overview
CREATE VIEW v_route_schedule AS
SELECT 
    r.id as route_id,
    r.route_name,
    r.province,
    r.route_type,
    rl.visit_date,
    l.location_name,
    l.city,
    lt.type_name as location_type,
    rl.start_time,
    rl.end_time,
    rl.max_appointments,
    COUNT(a.id) as total_slots,
    COUNT(CASE WHEN a.status = 'Booked' THEN 1 END) as booked_slots,
    COUNT(CASE WHEN a.status = 'Available' THEN 1 END) as available_slots,
    ROUND((COUNT(CASE WHEN a.status = 'Booked' THEN 1 END) / COUNT(a.id)) * 100, 1) as booking_percentage
FROM routes r
JOIN route_locations rl ON r.id = rl.route_id
JOIN locations l ON rl.location_id = l.id
JOIN location_types lt ON l.location_type_id = lt.id
LEFT JOIN appointments a ON rl.id = a.route_location_id
WHERE r.is_active = TRUE
GROUP BY r.id, rl.id
ORDER BY rl.visit_date, rl.start_time;

-- Appointment booking summary
CREATE VIEW v_appointment_summary AS
SELECT 
    a.id as appointment_id,
    a.booking_reference,
    r.route_name,
    l.location_name,
    l.city,
    l.province,
    rl.visit_date,
    a.appointment_time,
    a.status,
    COALESCE(p.first_name, a.booked_by_name) as patient_first_name,
    COALESCE(p.last_name, '') as patient_last_name,
    COALESCE(p.phone_number, a.booked_by_phone) as contact_phone,
    a.special_requirements,
    a.booked_at,
    CASE 
        WHEN a.status = 'Booked' AND rl.visit_date = CURDATE() THEN 'Today'
        WHEN a.status = 'Booked' AND rl.visit_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY) THEN 'Tomorrow'
        WHEN a.status = 'Booked' AND rl.visit_date > CURDATE() THEN 'Upcoming'
        WHEN a.status = 'Booked' AND rl.visit_date < CURDATE() THEN 'Past'
        ELSE a.status
    END as appointment_category
FROM appointments a
JOIN route_locations rl ON a.route_location_id = rl.id
JOIN routes r ON rl.route_id = r.id
JOIN locations l ON rl.location_id = l.id
LEFT JOIN patients p ON a.patient_id = p.id
ORDER BY rl.visit_date, a.appointment_time;

-- Daily clinic capacity and utilization
CREATE VIEW v_daily_clinic_capacity AS
SELECT 
    rl.visit_date,
    l.province,
    l.city,
    COUNT(DISTINCT rl.id) as locations_count,
    SUM(rl.max_appointments) as total_capacity,
    COUNT(CASE WHEN a.status = 'Booked' THEN 1 END) as total_booked,
    COUNT(CASE WHEN a.status = 'Completed' THEN 1 END) as total_completed,
    COUNT(CASE WHEN a.status = 'No-Show' THEN 1 END) as total_no_shows,
    ROUND((COUNT(CASE WHEN a.status = 'Booked' THEN 1 END) / SUM(rl.max_appointments)) * 100, 1) as utilization_percentage,
    ROUND((COUNT(CASE WHEN a.status = 'Completed' THEN 1 END) / COUNT(CASE WHEN a.status IN ('Booked', 'Completed', 'No-Show') THEN 1 END)) * 100, 1) as completion_rate
FROM route_locations rl
JOIN locations l ON rl.location_id = l.id
LEFT JOIN appointments a ON rl.id = a.route_location_id
GROUP BY rl.visit_date, l.province, l.city
ORDER BY rl.visit_date DESC;

-- =============================================
-- INVENTORY MANAGEMENT VIEWS
-- =============================================

-- Current inventory levels with alerts
CREATE VIEW v_inventory_levels AS
SELECT 
    c.id as consumable_id,
    c.item_code,
    c.item_name,
    cc.category_name,
    c.unit_of_measure,
    c.reorder_level,
    c.max_stock_level,
    SUM(CASE WHEN ist.status = 'Active' THEN ist.quantity_current ELSE 0 END) as current_stock,
    COUNT(DISTINCT ist.batch_number) as active_batches,
    MIN(CASE WHEN ist.status = 'Active' THEN ist.expiry_date END) as earliest_expiry,
    CASE 
        WHEN SUM(CASE WHEN ist.status = 'Active' THEN ist.quantity_current ELSE 0 END) <= c.reorder_level THEN 'Low Stock'
        WHEN MIN(CASE WHEN ist.status = 'Active' THEN ist.expiry_date END) <= DATE_ADD(CURDATE(), INTERVAL 3 MONTH) THEN 'Expiring Soon'
        WHEN SUM(CASE WHEN ist.status = 'Active' THEN ist.quantity_current ELSE 0 END) >= c.max_stock_level THEN 'Overstock'
        ELSE 'Normal'
    END as alert_status,
    DATEDIFF(MIN(CASE WHEN ist.status = 'Active' THEN ist.expiry_date END), CURDATE()) as days_to_expiry
FROM consumables c
JOIN consumable_categories cc ON c.category_id = cc.id
LEFT JOIN inventory_stock ist ON c.id = ist.consumable_id
GROUP BY c.id
ORDER BY 
    CASE 
        WHEN SUM(CASE WHEN ist.status = 'Active' THEN ist.quantity_current ELSE 0 END) <= c.reorder_level THEN 1
        WHEN MIN(CASE WHEN ist.status = 'Active' THEN ist.expiry_date END) <= DATE_ADD(CURDATE(), INTERVAL 3 MONTH) THEN 2
        ELSE 3
    END,
    c.item_name;

-- Expiring inventory report
CREATE VIEW v_expiring_inventory AS
SELECT 
    ist.id as stock_id,
    c.item_code,
    c.item_name,
    cc.category_name,
    ist.batch_number,
    s.supplier_name,
    ist.quantity_current,
    c.unit_of_measure,
    ist.expiry_date,
    DATEDIFF(ist.expiry_date, CURDATE()) as days_to_expiry,
    ist.unit_cost,
    (ist.quantity_current * ist.unit_cost) as total_value,
    CASE 
        WHEN ist.expiry_date <= CURDATE() THEN 'Expired'
        WHEN ist.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'Critical'
        WHEN ist.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY) THEN 'Warning'
        ELSE 'Normal'
    END as expiry_status
FROM inventory_stock ist
JOIN consumables c ON ist.consumable_id = c.id
JOIN consumable_categories cc ON c.category_id = cc.id
JOIN suppliers s ON ist.supplier_id = s.id
WHERE ist.status = 'Active'
AND ist.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 6 MONTH)
ORDER BY ist.expiry_date, c.item_name;

-- Inventory usage analytics
CREATE VIEW v_inventory_usage_analytics AS
SELECT 
    c.item_code,
    c.item_name,
    cc.category_name,
    DATE_FORMAT(iu.usage_date, '%Y-%m') as usage_month,
    SUM(iu.quantity_used) as total_used,
    COUNT(DISTINCT iu.visit_id) as visits_used,
    COUNT(DISTINCT iu.used_by) as users_count,
    AVG(iu.quantity_used) as avg_per_usage,
    SUM(iu.quantity_used * ist.unit_cost) as total_cost
FROM inventory_usage iu
JOIN inventory_stock ist ON iu.stock_id = ist.id
JOIN consumables c ON ist.consumable_id = c.id
JOIN consumable_categories cc ON c.category_id = cc.id
WHERE iu.usage_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
GROUP BY c.id, DATE_FORMAT(iu.usage_date, '%Y-%m')
ORDER BY usage_month DESC, total_used DESC;

-- Asset maintenance schedule
CREATE VIEW v_asset_maintenance_schedule AS
SELECT 
    a.id as asset_id,
    a.asset_tag,
    a.asset_name,
    ac.category_name,
    a.manufacturer,
    a.model,
    a.status,
    a.location,
    CONCAT(u.first_name, ' ', u.last_name) as assigned_to,
    a.last_maintenance_date,
    a.next_maintenance_date,
    DATEDIFF(a.next_maintenance_date, CURDATE()) as days_to_maintenance,
    CASE 
        WHEN a.next_maintenance_date <= CURDATE() THEN 'Overdue'
        WHEN a.next_maintenance_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 'Due This Week'
        WHEN a.next_maintenance_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'Due This Month'
        ELSE 'Scheduled'
    END as maintenance_status
FROM assets a
JOIN asset_categories ac ON a.category_id = ac.id
LEFT JOIN users u ON a.assigned_to = u.id
WHERE a.status != 'Retired'
ORDER BY a.next_maintenance_date;

-- =============================================
-- REPORTING AND ANALYTICS VIEWS
-- =============================================

-- Daily operational summary
CREATE VIEW v_daily_operations_summary AS
SELECT 
    CURDATE() as report_date,
    COUNT(DISTINCT pv.id) as total_visits,
    COUNT(DISTINCT pv.patient_id) as unique_patients,
    COUNT(DISTINCT CASE WHEN p.is_palmed_member = TRUE THEN pv.patient_id END) as palmed_members,
    COUNT(DISTINCT CASE WHEN pv.is_completed = TRUE THEN pv.id END) as completed_visits,
    COUNT(DISTINCT CASE WHEN pv.is_completed = FALSE THEN pv.id END) as active_visits,
    COUNT(DISTINCT a.id) as total_appointments,
    COUNT(DISTINCT CASE WHEN a.status = 'Completed' THEN a.id END) as completed_appointments,
    COUNT(DISTINCT CASE WHEN a.status = 'No-Show' THEN a.id END) as no_shows,
    ROUND(AVG(TIMESTAMPDIFF(MINUTE, pv.created_at, pv.completed_at)), 0) as avg_visit_duration_minutes
FROM patient_visits pv
JOIN patients p ON pv.patient_id = p.id
LEFT JOIN appointments a ON pv.id = a.visit_id
WHERE pv.visit_date = CURDATE();

-- Monthly performance metrics
CREATE VIEW v_monthly_performance AS
SELECT 
    DATE_FORMAT(pv.visit_date, '%Y-%m') as month_year,
    COUNT(DISTINCT pv.id) as total_visits,
    COUNT(DISTINCT pv.patient_id) as unique_patients,
    COUNT(DISTINCT CASE WHEN p.is_palmed_member = TRUE THEN pv.patient_id END) as palmed_members,
    ROUND((COUNT(DISTINCT CASE WHEN p.is_palmed_member = TRUE THEN pv.patient_id END) / COUNT(DISTINCT pv.patient_id)) * 100, 1) as palmed_member_percentage,
    COUNT(DISTINCT pv.location) as locations_served,
    COUNT(DISTINCT DATE(pv.visit_date)) as active_days,
    ROUND(COUNT(DISTINCT pv.id) / COUNT(DISTINCT DATE(pv.visit_date)), 1) as avg_visits_per_day,
    SUM(CASE WHEN cn.note_type = 'Referral' THEN 1 ELSE 0 END) as total_referrals
FROM patient_visits pv
JOIN patients p ON pv.patient_id = p.id
LEFT JOIN clinical_notes cn ON pv.id = cn.visit_id
WHERE pv.visit_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
GROUP BY DATE_FORMAT(pv.visit_date, '%Y-%m')
ORDER BY month_year DESC;

-- User activity summary
CREATE VIEW v_user_activity_summary AS
SELECT 
    u.id as user_id,
    u.username,
    CONCAT(u.first_name, ' ', u.last_name) as full_name,
    ur.role_name,
    COUNT(DISTINCT DATE(al.created_at)) as active_days_last_30,
    COUNT(DISTINCT CASE WHEN al.action IN ('INSERT', 'UPDATE') THEN DATE(al.created_at) END) as productive_days_last_30,
    COUNT(DISTINCT CASE WHEN pv.created_by = u.id THEN pv.id END) as visits_created_last_30,
    COUNT(DISTINCT CASE WHEN vwp.assigned_user_id = u.id AND vwp.completed_at IS NOT NULL THEN vwp.id END) as workflow_stages_completed_last_30,
    MAX(al.created_at) as last_activity,
    DATEDIFF(CURDATE(), DATE(MAX(al.created_at))) as days_since_last_activity
FROM users u
JOIN user_roles ur ON u.role_id = ur.id
LEFT JOIN audit_log al ON u.id = al.user_id AND al.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
LEFT JOIN patient_visits pv ON u.id = pv.created_by AND pv.visit_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
LEFT JOIN visit_workflow_progress vwp ON u.id = vwp.assigned_user_id AND vwp.completed_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
WHERE u.is_active = TRUE
GROUP BY u.id
ORDER BY active_days_last_30 DESC;
