-- PALMED Mobile Clinic ERP Database Schema
-- Created for Police Medical Aid Scheme Mobile Clinic System
-- Supports 500,000 beneficiaries with offline capabilities

CREATE DATABASE IF NOT EXISTS palmed_clinic_erp 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE palmed_clinic_erp;

-- Enable event scheduler for automated tasks
SET GLOBAL event_scheduler = ON;

-- =============================================
-- USER MANAGEMENT TABLES
-- =============================================

-- User roles lookup table
CREATE TABLE user_roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    role_name VARCHAR(50) NOT NULL UNIQUE,
    role_description TEXT,
    permissions JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table with geographic restrictions
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role_id INT NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20),
    mp_number VARCHAR(50), -- Medical Practice number for doctors
    geographic_restrictions JSON, -- Provinces/areas user can access
    is_active BOOLEAN DEFAULT TRUE,
    requires_approval BOOLEAN DEFAULT FALSE,
    approved_by INT NULL,
    approved_at TIMESTAMP NULL,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES user_roles(id),
    FOREIGN KEY (approved_by) REFERENCES users(id),
    INDEX idx_users_role (role_id),
    INDEX idx_users_active (is_active),
    INDEX idx_users_email (email)
);

-- User sessions for tracking active sessions
CREATE TABLE user_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    device_info JSON,
    ip_address VARCHAR(45),
    location_data JSON,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_sessions_token (session_token),
    INDEX idx_sessions_user (user_id),
    INDEX idx_sessions_expires (expires_at)
);

-- =============================================
-- PATIENT MANAGEMENT TABLES
-- =============================================

-- Patients table with PALMED integration
CREATE TABLE patients (
    id INT PRIMARY KEY AUTO_INCREMENT,
    medical_aid_number VARCHAR(50) UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    gender ENUM('Male', 'Female', 'Other') NOT NULL,
    id_number VARCHAR(20) UNIQUE,
    phone_number VARCHAR(20),
    email VARCHAR(255),
    physical_address TEXT,
    emergency_contact_name VARCHAR(200),
    emergency_contact_phone VARCHAR(20),
    is_palmed_member BOOLEAN DEFAULT FALSE,
    member_type ENUM('Principal', 'Dependent', 'Non-member') DEFAULT 'Non-member',
    chronic_conditions JSON,
    allergies JSON,
    current_medications JSON,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_patients_medical_aid (medical_aid_number),
    INDEX idx_patients_id_number (id_number),
    INDEX idx_patients_name (last_name, first_name),
    INDEX idx_patients_member_type (member_type)
);

-- Clinical workflow stages
CREATE TABLE workflow_stages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    stage_name VARCHAR(50) NOT NULL UNIQUE,
    stage_order INT NOT NULL,
    required_role_id INT NOT NULL,
    is_mandatory BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (required_role_id) REFERENCES user_roles(id)
);

-- Patient visits and clinical workflow tracking
CREATE TABLE patient_visits (
    id INT PRIMARY KEY AUTO_INCREMENT,
    patient_id INT NOT NULL,
    visit_date DATE NOT NULL,
    visit_time TIME NOT NULL,
    route_id INT,
    location VARCHAR(255),
    chief_complaint TEXT,
    current_stage_id INT,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (current_stage_id) REFERENCES workflow_stages(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_visits_patient (patient_id),
    INDEX idx_visits_date (visit_date),
    INDEX idx_visits_route (route_id),
    INDEX idx_visits_stage (current_stage_id)
);

-- Clinical workflow progress tracking
CREATE TABLE visit_workflow_progress (
    id INT PRIMARY KEY AUTO_INCREMENT,
    visit_id INT NOT NULL,
    stage_id INT NOT NULL,
    assigned_user_id INT,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    notes TEXT,
    data_collected JSON,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (visit_id) REFERENCES patient_visits(id) ON DELETE CASCADE,
    FOREIGN KEY (stage_id) REFERENCES workflow_stages(id),
    FOREIGN KEY (assigned_user_id) REFERENCES users(id),
    UNIQUE KEY unique_visit_stage (visit_id, stage_id),
    INDEX idx_workflow_visit (visit_id),
    INDEX idx_workflow_stage (stage_id),
    INDEX idx_workflow_user (assigned_user_id)
);

-- Vital signs and medical measurements
CREATE TABLE vital_signs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    visit_id INT NOT NULL,
    recorded_by INT NOT NULL,
    systolic_bp INT,
    diastolic_bp INT,
    heart_rate INT,
    temperature DECIMAL(4,1),
    weight DECIMAL(5,2),
    height DECIMAL(5,2),
    bmi DECIMAL(4,1) GENERATED ALWAYS AS (
        CASE 
            WHEN height > 0 THEN ROUND(weight / POWER(height/100, 2), 1)
            ELSE NULL 
        END
    ) STORED,
    oxygen_saturation INT,
    blood_glucose DECIMAL(5,1),
    additional_measurements JSON,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (visit_id) REFERENCES patient_visits(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id),
    INDEX idx_vitals_visit (visit_id),
    INDEX idx_vitals_recorded_by (recorded_by)
);

-- Clinical notes and diagnoses
CREATE TABLE clinical_notes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    visit_id INT NOT NULL,
    note_type ENUM('Assessment', 'Diagnosis', 'Treatment', 'Referral', 'Counseling') NOT NULL,
    content TEXT NOT NULL,
    icd10_codes JSON,
    medications_prescribed JSON,
    follow_up_required BOOLEAN DEFAULT FALSE,
    follow_up_date DATE NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (visit_id) REFERENCES patient_visits(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_notes_visit (visit_id),
    INDEX idx_notes_type (note_type),
    INDEX idx_notes_created_by (created_by)
);

-- =============================================
-- ROUTE PLANNING AND SCHEDULING TABLES
-- =============================================

-- Location types for mobile clinic deployment
CREATE TABLE location_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    type_name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    default_capacity INT DEFAULT 50,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Locations where mobile clinic can be deployed
CREATE TABLE locations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    location_name VARCHAR(255) NOT NULL,
    location_type_id INT NOT NULL,
    province VARCHAR(50) NOT NULL,
    city VARCHAR(100) NOT NULL,
    address TEXT,
    gps_coordinates POINT NOT NULL,
    contact_person VARCHAR(200),
    contact_phone VARCHAR(20),
    facilities_available JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (location_type_id) REFERENCES location_types(id),
    INDEX idx_locations_province (province),
    INDEX idx_locations_city (city),
    INDEX idx_locations_type (location_type_id),
    SPATIAL INDEX idx_locations_gps (gps_coordinates)
);

-- Mobile clinic routes
CREATE TABLE routes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    route_name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    province VARCHAR(50) NOT NULL,
    route_type ENUM('Police Stations', 'Schools', 'Community Centers', 'Mixed') NOT NULL,
    max_appointments_per_day INT DEFAULT 100,
    created_by INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_routes_dates (start_date, end_date),
    INDEX idx_routes_province (province),
    INDEX idx_routes_type (route_type),
    INDEX idx_routes_created_by (created_by)
);

-- Route locations (many-to-many relationship)
CREATE TABLE route_locations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    route_id INT NOT NULL,
    location_id INT NOT NULL,
    visit_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_appointments INT DEFAULT 50,
    appointment_duration INT DEFAULT 30, -- minutes
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES locations(id),
    UNIQUE KEY unique_route_location_date (route_id, location_id, visit_date),
    INDEX idx_route_locations_route (route_id),
    INDEX idx_route_locations_location (location_id),
    INDEX idx_route_locations_date (visit_date)
);

-- Appointment slots and bookings
CREATE TABLE appointments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    route_location_id INT NOT NULL,
    patient_id INT,
    appointment_time TIME NOT NULL,
    duration_minutes INT DEFAULT 30,
    status ENUM('Available', 'Booked', 'Completed', 'Cancelled', 'No-Show') DEFAULT 'Available',
    booking_reference VARCHAR(50) UNIQUE,
    booked_by_name VARCHAR(200),
    booked_by_phone VARCHAR(20),
    booked_by_email VARCHAR(255),
    special_requirements TEXT,
    visit_id INT NULL,
    booked_at TIMESTAMP NULL,
    cancelled_at TIMESTAMP NULL,
    cancellation_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (route_location_id) REFERENCES route_locations(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (visit_id) REFERENCES patient_visits(id),
    INDEX idx_appointments_route_location (route_location_id),
    INDEX idx_appointments_patient (patient_id),
    INDEX idx_appointments_time (appointment_time),
    INDEX idx_appointments_status (status),
    INDEX idx_appointments_reference (booking_reference)
);

-- =============================================
-- INVENTORY MANAGEMENT TABLES
-- =============================================

-- Asset categories
CREATE TABLE asset_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    category_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    requires_calibration BOOLEAN DEFAULT FALSE,
    calibration_frequency_months INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Medical equipment and assets
CREATE TABLE assets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    asset_tag VARCHAR(50) NOT NULL UNIQUE,
    serial_number VARCHAR(100),
    asset_name VARCHAR(255) NOT NULL,
    category_id INT NOT NULL,
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    purchase_date DATE,
    warranty_expiry DATE,
    status ENUM('Operational', 'Maintenance Required', 'Out of Service', 'Retired') DEFAULT 'Operational',
    location VARCHAR(255),
    assigned_to INT,
    last_maintenance_date DATE,
    next_maintenance_date DATE,
    maintenance_notes TEXT,
    purchase_cost DECIMAL(10,2),
    current_value DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES asset_categories(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    INDEX idx_assets_tag (asset_tag),
    INDEX idx_assets_serial (serial_number),
    INDEX idx_assets_category (category_id),
    INDEX idx_assets_status (status),
    INDEX idx_assets_maintenance (next_maintenance_date)
);

-- Suppliers for consumables and equipment
CREATE TABLE suppliers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    supplier_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(200),
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    tax_number VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Consumable categories (medications, supplies, etc.)
CREATE TABLE consumable_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    category_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    requires_prescription BOOLEAN DEFAULT FALSE,
    storage_requirements TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Consumable items (medications, medical supplies)
CREATE TABLE consumables (
    id INT PRIMARY KEY AUTO_INCREMENT,
    item_code VARCHAR(50) NOT NULL UNIQUE,
    item_name VARCHAR(255) NOT NULL,
    category_id INT NOT NULL,
    generic_name VARCHAR(255),
    strength VARCHAR(50),
    dosage_form VARCHAR(100),
    unit_of_measure VARCHAR(20) NOT NULL,
    reorder_level INT DEFAULT 10,
    max_stock_level INT DEFAULT 1000,
    storage_temperature_min DECIMAL(4,1),
    storage_temperature_max DECIMAL(4,1),
    is_controlled_substance BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES consumable_categories(id),
    INDEX idx_consumables_code (item_code),
    INDEX idx_consumables_name (item_name),
    INDEX idx_consumables_category (category_id)
);

-- Inventory stock tracking
CREATE TABLE inventory_stock (
    id INT PRIMARY KEY AUTO_INCREMENT,
    consumable_id INT NOT NULL,
    batch_number VARCHAR(100) NOT NULL,
    supplier_id INT NOT NULL,
    quantity_received INT NOT NULL,
    quantity_current INT NOT NULL,
    unit_cost DECIMAL(8,2),
    manufacture_date DATE,
    expiry_date DATE NOT NULL,
    received_date DATE NOT NULL,
    received_by INT NOT NULL,
    location VARCHAR(255) DEFAULT 'Mobile Clinic',
    status ENUM('Active', 'Expired', 'Recalled', 'Disposed') DEFAULT 'Active',
    disposal_date DATE NULL,
    disposal_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (consumable_id) REFERENCES consumables(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (received_by) REFERENCES users(id),
    UNIQUE KEY unique_batch_consumable (consumable_id, batch_number),
    INDEX idx_stock_consumable (consumable_id),
    INDEX idx_stock_batch (batch_number),
    INDEX idx_stock_expiry (expiry_date),
    INDEX idx_stock_status (status)
);

-- Inventory usage tracking
CREATE TABLE inventory_usage (
    id INT PRIMARY KEY AUTO_INCREMENT,
    stock_id INT NOT NULL,
    visit_id INT,
    quantity_used INT NOT NULL,
    used_by INT NOT NULL,
    usage_date DATE NOT NULL,
    usage_time TIME NOT NULL,
    location VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stock_id) REFERENCES inventory_stock(id),
    FOREIGN KEY (visit_id) REFERENCES patient_visits(id),
    FOREIGN KEY (used_by) REFERENCES users(id),
    INDEX idx_usage_stock (stock_id),
    INDEX idx_usage_visit (visit_id),
    INDEX idx_usage_date (usage_date),
    INDEX idx_usage_user (used_by)
);

-- =============================================
-- OFFLINE SYNCHRONIZATION TABLES
-- =============================================

-- Sync status tracking for offline operations
CREATE TABLE sync_status (
    id INT PRIMARY KEY AUTO_INCREMENT,
    table_name VARCHAR(100) NOT NULL,
    record_id INT NOT NULL,
    operation_type ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
    sync_status ENUM('Pending', 'Synced', 'Failed', 'Conflict') DEFAULT 'Pending',
    device_id VARCHAR(100),
    user_id INT,
    local_timestamp TIMESTAMP NOT NULL,
    server_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    conflict_data JSON,
    error_message TEXT,
    retry_count INT DEFAULT 0,
    last_retry_at TIMESTAMP NULL,
    synced_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_sync_table_record (table_name, record_id),
    INDEX idx_sync_status (sync_status),
    INDEX idx_sync_device (device_id),
    INDEX idx_sync_user (user_id)
);

-- =============================================
-- AUDIT AND COMPLIANCE TABLES
-- =============================================

-- Comprehensive audit trail for POPI Act compliance
CREATE TABLE audit_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    table_name VARCHAR(100) NOT NULL,
    record_id INT,
    action ENUM('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT') NOT NULL,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    session_id VARCHAR(255),
    location_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_table (table_name),
    INDEX idx_audit_action (action),
    INDEX idx_audit_created (created_at)
);

-- System configuration and settings
CREATE TABLE system_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT,
    setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    description TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE,
    updated_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES users(id),
    INDEX idx_settings_key (setting_key)
);
