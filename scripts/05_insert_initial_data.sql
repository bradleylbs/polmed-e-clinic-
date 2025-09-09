-- PALMED Mobile Clinic ERP - Initial Data Setup
-- Master data and configuration required for system operation

USE palmed_clinic_erp;

-- =============================================
-- USER ROLES AND PERMISSIONS
-- =============================================

INSERT INTO user_roles (role_name, role_description, permissions) VALUES
('Administrator', 'Full system access and user management', JSON_OBJECT(
    'users', JSON_ARRAY('create', 'read', 'update', 'delete'),
    'patients', JSON_ARRAY('create', 'read', 'update', 'delete'),
    'visits', JSON_ARRAY('create', 'read', 'update', 'delete'),
    'routes', JSON_ARRAY('create', 'read', 'update', 'delete'),
    'inventory', JSON_ARRAY('create', 'read', 'update', 'delete'),
    'reports', JSON_ARRAY('read', 'export'),
    'system', JSON_ARRAY('configure', 'backup', 'audit')
)),
('Doctor', 'Full patient care within assigned geographic area', JSON_OBJECT(
    'patients', JSON_ARRAY('create', 'read', 'update'),
    'visits', JSON_ARRAY('create', 'read', 'update'),
    'clinical_notes', JSON_ARRAY('create', 'read', 'update'),
    'vital_signs', JSON_ARRAY('read'),
    'inventory', JSON_ARRAY('read', 'use'),
    'routes', JSON_ARRAY('read'),
    'reports', JSON_ARRAY('read')
)),
('Nurse', 'Patient vitals and medical screening', JSON_OBJECT(
    'patients', JSON_ARRAY('read', 'update'),
    'visits', JSON_ARRAY('read', 'update'),
    'vital_signs', JSON_ARRAY('create', 'read', 'update'),
    'inventory', JSON_ARRAY('read', 'use'),
    'routes', JSON_ARRAY('read')
)),
('Clerk', 'Patient registration and appointment scheduling', JSON_OBJECT(
    'patients', JSON_ARRAY('create', 'read', 'update'),
    'visits', JSON_ARRAY('create', 'read'),
    'appointments', JSON_ARRAY('create', 'read', 'update'),
    'routes', JSON_ARRAY('read')
)),
('Social Worker', 'Mental health and counseling services', JSON_OBJECT(
    'patients', JSON_ARRAY('read'),
    'visits', JSON_ARRAY('read', 'update'),
    'clinical_notes', JSON_ARRAY('create', 'read', 'update'),
    'counseling', JSON_ARRAY('create', 'read', 'update'),
    'routes', JSON_ARRAY('read')
));

-- =============================================
-- WORKFLOW STAGES
-- =============================================

INSERT INTO workflow_stages (stage_name, stage_order, required_role_id, is_mandatory) VALUES
('Registration', 1, (SELECT id FROM user_roles WHERE role_name = 'Clerk'), TRUE),
('Nursing Assessment', 2, (SELECT id FROM user_roles WHERE role_name = 'Nurse'), TRUE),
('Doctor Consultation', 3, (SELECT id FROM user_roles WHERE role_name = 'Doctor'), TRUE),
('Counseling Session', 4, (SELECT id FROM user_roles WHERE role_name = 'Social Worker'), TRUE),
('File Closure', 5, (SELECT id FROM user_roles WHERE role_name = 'Doctor'), TRUE);

-- =============================================
-- LOCATION TYPES AND LOCATIONS
-- =============================================

INSERT INTO location_types (type_name, description, default_capacity) VALUES
('Police Station', 'Primary deployment locations for police personnel', 75),
('School', 'Educational institutions for CSI initiatives', 100),
('Community Center', 'Community outreach locations', 50),
('Hospital', 'Healthcare facility partnerships', 30),
('Corporate Office', 'PALMED office locations', 25);

-- Sample locations across South Africa provinces
INSERT INTO locations (location_name, location_type_id, province, city, address, contact_person, contact_phone, facilities_available) VALUES
-- Gauteng Province
('Johannesburg Central Police Station', 1, 'Gauteng', 'Johannesburg', '1 Commissioner Street, Johannesburg Central', 'Capt. J. Mthembu', '011-375-5911', JSON_OBJECT('parking', true, 'electricity', true, 'water', true, 'security', true)),
('Pretoria Central Police Station', 1, 'Gauteng', 'Pretoria', '231 Pretorius Street, Pretoria Central', 'Col. A. van der Merwe', '012-393-1000', JSON_OBJECT('parking', true, 'electricity', true, 'water', true, 'security', true)),
('Sandton Police Station', 1, 'Gauteng', 'Sandton', 'Corner Rivonia & 5th Street, Sandton', 'Maj. P. Nkomo', '011-881-3500', JSON_OBJECT('parking', true, 'electricity', true, 'water', true, 'security', true)),

-- Western Cape Province
('Cape Town Central Police Station', 1, 'Western Cape', 'Cape Town', '5 Caledon Street, Cape Town', 'Col. M. Adams', '021-467-9000', JSON_OBJECT('parking', true, 'electricity', true, 'water', true, 'security', true)),
('Bellville Police Station', 1, 'Western Cape', 'Bellville', '1 Durban Road, Bellville', 'Capt. S. Botha', '021-918-2400', JSON_OBJECT('parking', true, 'electricity', true, 'water', true, 'security', true)),
('Mitchells Plain Police Station', 1, 'Western Cape', 'Mitchells Plain', 'Corner AZ Berman & Spine Road', 'Maj. L. Jacobs', '021-370-5000', JSON_OBJECT('parking', true, 'electricity', true, 'water', true, 'security', true)),

-- KwaZulu-Natal Province
('Durban Central Police Station', 1, 'KwaZulu-Natal', 'Durban', '333 Anton Lembede Street, Durban', 'Col. R. Maharaj', '031-325-6000', JSON_OBJECT('parking', true, 'electricity', true, 'water', true, 'security', true)),
('Pietermaritzburg Police Station', 1, 'KwaZulu-Natal', 'Pietermaritzburg', '242 Langalibalele Street, PMB', 'Capt. N. Dlamini', '033-845-4000', JSON_OBJECT('parking', true, 'electricity', true, 'water', true, 'security', true)),
('Newcastle Police Station', 1, 'KwaZulu-Natal', 'Newcastle', '37 Murchison Street, Newcastle', 'Maj. T. Mthethwa', '034-328-7400', JSON_OBJECT('parking', true, 'electricity', true, 'water', true, 'security', true)),

-- Schools for CSI initiatives
('Johannesburg High School', 2, 'Gauteng', 'Johannesburg', '123 Education Avenue, Johannesburg', 'Principal M. Sithole', '011-123-4567', JSON_OBJECT('parking', true, 'electricity', true, 'water', true, 'hall', true)),
('Cape Town Primary School', 2, 'Western Cape', 'Cape Town', '456 Learning Street, Cape Town', 'Principal A. Williams', '021-234-5678', JSON_OBJECT('parking', true, 'electricity', true, 'water', true, 'hall', true)),
('Durban Secondary School', 2, 'KwaZulu-Natal', 'Durban', '789 Knowledge Road, Durban', 'Principal S. Patel', '031-345-6789', JSON_OBJECT('parking', true, 'electricity', true, 'water', true, 'hall', true));

-- =============================================
-- ASSET CATEGORIES AND SAMPLE ASSETS
-- =============================================

INSERT INTO asset_categories (category_name, description, requires_calibration, calibration_frequency_months) VALUES
('Diagnostic Equipment', 'Medical diagnostic devices and instruments', TRUE, 12),
('Monitoring Equipment', 'Patient monitoring and vital signs equipment', TRUE, 6),
('Treatment Equipment', 'Medical treatment and therapeutic devices', TRUE, 12),
('IT Equipment', 'Computers, tablets, and networking equipment', FALSE, NULL),
('Furniture', 'Medical furniture and fixtures', FALSE, NULL),
('Safety Equipment', 'Safety and emergency equipment', TRUE, 6);

-- Sample assets for mobile clinic
INSERT INTO assets (asset_tag, serial_number, asset_name, category_id, manufacturer, model, purchase_date, warranty_expiry, status, location, purchase_cost, current_value) VALUES
('PAL-BP-001', 'BP2023001', 'Digital Blood Pressure Monitor', 2, 'Omron', 'HEM-7156T', '2024-01-15', '2027-01-15', 'Operational', 'Mobile Clinic Unit 1', 1250.00, 1000.00),
('PAL-ECG-001', 'ECG2023001', 'Portable ECG Machine', 1, 'Philips', 'PageWriter TC20', '2024-02-01', '2027-02-01', 'Operational', 'Mobile Clinic Unit 1', 15000.00, 12000.00),
('PAL-GLU-001', 'GLU2023001', 'Blood Glucose Meter', 1, 'Accu-Chek', 'Guide Me', '2024-01-20', '2026-01-20', 'Operational', 'Mobile Clinic Unit 1', 450.00, 350.00),
('PAL-TAB-001', 'TAB2023001', 'Medical Tablet', 4, 'Samsung', 'Galaxy Tab A8', '2024-01-10', '2026-01-10', 'Operational', 'Mobile Clinic Unit 1', 3500.00, 2800.00),
('PAL-SCALE-001', 'SCALE2023001', 'Digital Scale', 2, 'Seca', '876', '2024-01-25', '2029-01-25', 'Operational', 'Mobile Clinic Unit 1', 2200.00, 1900.00),
('PAL-THERM-001', 'THERM2023001', 'Infrared Thermometer', 2, 'Braun', 'ThermoScan 7', '2024-01-30', '2026-01-30', 'Operational', 'Mobile Clinic Unit 1', 850.00, 700.00);

-- =============================================
-- SUPPLIERS AND CONSUMABLE CATEGORIES
-- =============================================

INSERT INTO suppliers (supplier_name, contact_person, phone, email, address, tax_number, is_active) VALUES
('MediSupply SA', 'John Pharmaceutical', '011-234-5678', 'orders@medisupply.co.za', '123 Medical Street, Johannesburg', '9876543210', TRUE),
('HealthCare Distributors', 'Sarah Medical', '021-345-6789', 'supply@healthcare.co.za', '456 Health Avenue, Cape Town', '8765432109', TRUE),
('Pharma Plus', 'David Medicine', '031-456-7890', 'info@pharmaplus.co.za', '789 Pharmacy Road, Durban', '7654321098', TRUE),
('Medical Equipment Co', 'Lisa Equipment', '012-567-8901', 'sales@medequip.co.za', '321 Equipment Street, Pretoria', '6543210987', TRUE);

INSERT INTO consumable_categories (category_name, description, requires_prescription, storage_requirements) VALUES
('Medications - Chronic', 'Chronic disease medications', TRUE, 'Store in cool, dry place below 25°C'),
('Medications - Acute', 'Acute treatment medications', TRUE, 'Store in cool, dry place below 25°C'),
('Medical Supplies', 'General medical supplies and consumables', FALSE, 'Store in clean, dry environment'),
('Diagnostic Supplies', 'Supplies for diagnostic procedures', FALSE, 'Store according to manufacturer specifications'),
('First Aid Supplies', 'Basic first aid and emergency supplies', FALSE, 'Store in accessible location'),
('Personal Protective Equipment', 'PPE for healthcare workers', FALSE, 'Store in clean, dry environment');

-- Sample consumables inventory
INSERT INTO consumables (item_code, item_name, category_id, generic_name, strength, dosage_form, unit_of_measure, reorder_level, max_stock_level) VALUES
-- Chronic medications
('MED-HYP-001', 'Amlodipine Tablets', 1, 'Amlodipine', '5mg', 'Tablet', 'Tablets', 100, 1000),
('MED-HYP-002', 'Enalapril Tablets', 1, 'Enalapril', '10mg', 'Tablet', 'Tablets', 100, 1000),
('MED-DIA-001', 'Metformin Tablets', 1, 'Metformin', '500mg', 'Tablet', 'Tablets', 200, 2000),
('MED-DIA-002', 'Glibenclamide Tablets', 1, 'Glibenclamide', '5mg', 'Tablet', 'Tablets', 100, 1000),

-- Acute medications
('MED-PAIN-001', 'Paracetamol Tablets', 2, 'Paracetamol', '500mg', 'Tablet', 'Tablets', 500, 5000),
('MED-PAIN-002', 'Ibuprofen Tablets', 2, 'Ibuprofen', '400mg', 'Tablet', 'Tablets', 200, 2000),
('MED-ANTI-001', 'Amoxicillin Capsules', 2, 'Amoxicillin', '500mg', 'Capsule', 'Capsules', 100, 1000),

-- Medical supplies
('SUP-BAND-001', 'Adhesive Bandages', 3, NULL, NULL, 'Bandage', 'Pieces', 100, 2000),
('SUP-GAUZ-001', 'Sterile Gauze Pads', 3, NULL, '10cm x 10cm', 'Pad', 'Pieces', 200, 3000),
('SUP-SYRI-001', 'Disposable Syringes', 3, NULL, '5ml', 'Syringe', 'Pieces', 100, 1500),
('SUP-GLOV-001', 'Examination Gloves', 6, NULL, 'Medium', 'Glove', 'Pairs', 500, 5000),

-- Diagnostic supplies
('DIA-STRIP-001', 'Blood Glucose Test Strips', 4, NULL, NULL, 'Strip', 'Strips', 200, 2000),
('DIA-LANC-001', 'Lancets', 4, NULL, NULL, 'Lancet', 'Pieces', 300, 3000),
('DIA-URIN-001', 'Urine Test Strips', 4, NULL, '10 Parameter', 'Strip', 'Strips', 100, 1000);

-- =============================================
-- SAMPLE INVENTORY STOCK
-- =============================================

INSERT INTO inventory_stock (consumable_id, batch_number, supplier_id, quantity_received, quantity_current, unit_cost, manufacture_date, expiry_date, received_date, received_by) VALUES
-- Amlodipine stock
((SELECT id FROM consumables WHERE item_code = 'MED-HYP-001'), 'AML240101', 1, 500, 450, 0.85, '2024-01-01', '2026-12-31', '2024-02-01', 1),
((SELECT id FROM consumables WHERE item_code = 'MED-HYP-001'), 'AML240201', 1, 500, 500, 0.87, '2024-02-01', '2027-01-31', '2024-03-01', 1),

-- Metformin stock
((SELECT id FROM consumables WHERE item_code = 'MED-DIA-001'), 'MET240101', 2, 1000, 850, 0.45, '2024-01-15', '2026-12-31', '2024-02-15', 1),
((SELECT id FROM consumables WHERE item_code = 'MED-DIA-001'), 'MET240201', 2, 1000, 1000, 0.47, '2024-02-15', '2027-01-31', '2024-03-15', 1),

-- Paracetamol stock
((SELECT id FROM consumables WHERE item_code = 'MED-PAIN-001'), 'PAR240101', 3, 2000, 1750, 0.12, '2024-01-10', '2026-06-30', '2024-02-10', 1),
((SELECT id FROM consumables WHERE item_code = 'MED-PAIN-001'), 'PAR240201', 3, 2000, 2000, 0.13, '2024-02-10', '2026-12-31', '2024-03-10', 1),

-- Medical supplies
((SELECT id FROM consumables WHERE item_code = 'SUP-GLOV-001'), 'GLV240101', 4, 2000, 1500, 0.25, '2024-01-05', '2027-01-05', '2024-02-05', 1),
((SELECT id FROM consumables WHERE item_code = 'SUP-SYRI-001'), 'SYR240101', 4, 1000, 800, 1.50, '2024-01-20', '2027-01-20', '2024-02-20', 1),
((SELECT id FROM consumables WHERE item_code = 'DIA-STRIP-001'), 'BGS240101', 1, 1000, 750, 2.50, '2024-01-25', '2025-12-31', '2024-02-25', 1);

-- =============================================
-- SYSTEM CONFIGURATION
-- =============================================

INSERT INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
('system_name', 'PALMED Mobile Clinic ERP', 'string', 'System name displayed in UI'),
('max_concurrent_users', '50', 'number', 'Maximum concurrent users allowed'),
('session_timeout_minutes', '120', 'number', 'User session timeout in minutes'),
('backup_frequency_hours', '6', 'number', 'Automatic backup frequency in hours'),
('audit_retention_days', '2555', 'number', 'Audit log retention period (7 years for POPI compliance)'),
('appointment_slot_duration', '30', 'number', 'Default appointment slot duration in minutes'),
('inventory_low_stock_threshold', '10', 'number', 'Default low stock threshold percentage'),
('expiry_warning_days', '90', 'number', 'Days before expiry to show warnings'),
('geographic_validation_enabled', 'true', 'boolean', 'Enable geographic access validation'),
('offline_sync_enabled', 'true', 'boolean', 'Enable offline synchronization'),
('popi_compliance_mode', 'true', 'boolean', 'Enable POPI Act compliance features'),
('default_province', 'Gauteng', 'string', 'Default province for new locations'),
('clinic_operating_hours', '{"start": "08:00", "end": "17:00"}', 'json', 'Default clinic operating hours'),
('supported_languages', '["en", "af", "zu", "xh"]', 'json', 'Supported system languages'),
('emergency_contacts', '{"medical": "10177", "police": "10111", "fire": "10177"}', 'json', 'Emergency contact numbers');

-- Create default admin user (password should be changed on first login)
INSERT INTO users (username, email, password_hash, role_id, first_name, last_name, phone_number, geographic_restrictions, is_active, requires_approval) VALUES
('admin', 'admin@palmed.co.za', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6hsxq5S/kS', 
 (SELECT id FROM user_roles WHERE role_name = 'Administrator'), 
 'System', 'Administrator', '011-000-0000', 
 JSON_ARRAY('Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Free State', 'Limpopo', 'Mpumalanga', 'Northern Cape', 'North West'), 
 TRUE, FALSE);

-- Update the admin user ID in the inventory stock records
UPDATE inventory_stock SET received_by = (SELECT id FROM users WHERE username = 'admin') WHERE received_by = 1;
