-- ============================================================================
-- ADD MISSING appointment_duration COLUMN (OPTIONAL)
-- ============================================================================
-- Run this in MySQL Workbench to add the missing column
-- This column is used by stored procedures for appointment duration tracking
-- ============================================================================

ALTER TABLE `patient_appointments` 
ADD COLUMN `appointment_duration` int DEFAULT 30 COMMENT 'Duration in minutes'
AFTER `appointment_time`;

-- ============================================================================
-- VERIFY THE COLUMN WAS ADDED
-- ============================================================================

DESCRIBE `patient_appointments`;

-- ============================================================================
-- CHECK FINAL STRUCTURE
-- ============================================================================

SELECT 
    COLUMN_NAME, 
    COLUMN_TYPE, 
    IS_NULLABLE, 
    COLUMN_DEFAULT,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'patient_appointments'
ORDER BY ORDINAL_POSITION;
