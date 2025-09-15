-- Migration: add 'Closure' to clinical_notes.note_type ENUM
-- Run this against an existing MySQL palmed_clinic_erp database

USE palmed_clinic_erp;

ALTER TABLE clinical_notes
  MODIFY note_type ENUM('Assessment','Diagnosis','Treatment','Referral','Counseling','Closure') NOT NULL;
