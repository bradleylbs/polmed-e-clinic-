-- Referrals feature migration
USE palmed_clinic_erp;

CREATE TABLE IF NOT EXISTS referrals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  visit_id INT NULL, -- links to patient_visits.id
  referral_type ENUM('internal','external') NOT NULL DEFAULT 'internal',
  from_stage ENUM('Registration','Nursing Assessment','Doctor Consultation','Counseling Session') NOT NULL,
  to_stage ENUM('Registration','Nursing Assessment','Doctor Consultation','Counseling Session') NULL,
  external_provider VARCHAR(255) NULL,
  department VARCHAR(255) NULL,
  reason TEXT NOT NULL,
  notes TEXT NULL,
  status ENUM('pending','sent','accepted','completed','cancelled') NOT NULL DEFAULT 'pending',
  appointment_date DATE NULL,
  created_by INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ref_patient FOREIGN KEY (patient_id) REFERENCES patients(id),
  CONSTRAINT fk_ref_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_ref_patient (patient_id),
  INDEX idx_ref_status (status),
  INDEX idx_ref_created_at (created_at)
);
