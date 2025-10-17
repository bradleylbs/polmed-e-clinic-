-- ============================================================================
-- POLMED ERP SYSTEM - COMPLETE DATABASE SCHEMA
-- ============================================================================
-- Generated: 2025-10-17 09:55:52
-- Database: palmed_clinic_erp
-- Host: localhost
-- Tables: 44
-- Views: 18
-- ============================================================================

-- ============================================================================
-- 1. DATABASE SETUP
-- ============================================================================

DROP DATABASE IF EXISTS `palmed_clinic_erp`;

CREATE DATABASE `palmed_clinic_erp` 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE `palmed_clinic_erp`;

-- Set charset for client/connection/results
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

-- ============================================================================
-- 2. TABLE OF CONTENTS
-- ============================================================================

-- TABLES:
--    1. appointments
--    2. asset_categories
--    3. assets
--    4. audit_log
--    5. audit_logs
--    6. clinical_alerts
--    7. clinical_decision_rules
--    8. clinical_notes
--    9. clinical_templates
--   10. consumable_categories
--   11. consumables
--   12. drug_database
--   13. icd10_codes
--   14. icd10_order
--   15. inventory_stock
--   16. inventory_usage
--   17. investigation_categories
--   18. investigation_orders
--   19. investigation_results
--   20. investigations
--   21. location_types
--   22. locations
--   23. medication_administration
--   24. patient_authentication
--   25. patient_sessions
--   26. patient_visits
--   27. patients
--   28. prescriptions
--   29. referrals
--   30. route_locations
--   31. routes
--   32. smart_suggestions
--   33. suppliers
--   34. sync_status
--   35. system_settings
--   36. user_clinical_preferences
--   37. user_roles
--   38. user_sessions
--   39. user_tasks
--   40. users
--   41. visit_workflow_progress
--   42. vital_signs
--   43. vital_signs_references
--   44. workflow_stages

-- VIEWS:
--    1. v_active_users
--    2. v_active_visits
--    3. v_appointment_summary
--    4. v_asset_maintenance_schedule
--    5. v_daily_clinic_capacity
--    6. v_daily_operations_summary
--    7. v_expiring_inventory
--    8. v_inventory_levels
--    9. v_inventory_usage_analytics
--   10. v_monthly_performance
--   11. v_patient_summary
--   12. v_patient_vitals_trends
--   13. v_pending_approvals
--   14. v_role_dashboard_metrics
--   15. v_route_schedule
--   16. v_user_activity_summary
--   17. v_user_recent_activity
--   18. v_workflow_progress


-- ============================================================================
-- 3. TABLE DEFINITIONS
-- ============================================================================

-- TABLE 1/44: appointments
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `appointments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `appointments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `route_location_id` int NOT NULL,
  `patient_id` int DEFAULT NULL,
  `appointment_time` time NOT NULL,
  `duration_minutes` int DEFAULT '30',
  `status` enum('Available','Booked','Completed','Cancelled','No-Show') COLLATE utf8mb4_unicode_ci DEFAULT 'Available',
  `booking_reference` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `booked_by_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `booked_by_phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `booked_by_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `special_requirements` text COLLATE utf8mb4_unicode_ci,
  `visit_id` int DEFAULT NULL,
  `booked_at` timestamp NULL DEFAULT NULL,
  `cancelled_at` timestamp NULL DEFAULT NULL,
  `cancellation_reason` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `booking_reference` (`booking_reference`),
  KEY `visit_id` (`visit_id`),
  KEY `idx_appointments_route_location` (`route_location_id`),
  KEY `idx_appointments_patient` (`patient_id`),
  KEY `idx_appointments_time` (`appointment_time`),
  KEY `idx_appointments_status` (`status`),
  KEY `idx_appointments_reference` (`booking_reference`),
  KEY `idx_appointments_booked_at` (`booked_at`,`status`),
  CONSTRAINT `appointments_ibfk_1` FOREIGN KEY (`route_location_id`) REFERENCES `route_locations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `appointments_ibfk_2` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`),
  CONSTRAINT `appointments_ibfk_3` FOREIGN KEY (`visit_id`) REFERENCES `patient_visits` (`id`),
  CONSTRAINT `chk_appointment_duration` CHECK ((`duration_minutes` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 2/44: asset_categories
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `asset_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `asset_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `requires_calibration` tinyint(1) DEFAULT '0',
  `calibration_frequency_months` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `category_name` (`category_name`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 3/44: assets
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `assets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `assets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `asset_tag` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `serial_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `asset_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category_id` int NOT NULL,
  `manufacturer` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `model` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `purchase_date` date DEFAULT NULL,
  `warranty_expiry` date DEFAULT NULL,
  `status` enum('Operational','Maintenance Required','Out of Service','Retired') COLLATE utf8mb4_unicode_ci DEFAULT 'Operational',
  `location` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assigned_to` int DEFAULT NULL,
  `last_maintenance_date` date DEFAULT NULL,
  `next_maintenance_date` date DEFAULT NULL,
  `maintenance_notes` text COLLATE utf8mb4_unicode_ci,
  `purchase_cost` decimal(10,2) DEFAULT NULL,
  `current_value` decimal(10,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `asset_tag` (`asset_tag`),
  KEY `assigned_to` (`assigned_to`),
  KEY `idx_assets_tag` (`asset_tag`),
  KEY `idx_assets_serial` (`serial_number`),
  KEY `idx_assets_category` (`category_id`),
  KEY `idx_assets_status` (`status`),
  KEY `idx_assets_maintenance` (`next_maintenance_date`),
  CONSTRAINT `assets_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `asset_categories` (`id`),
  CONSTRAINT `assets_ibfk_2` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 4/44: audit_log
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `table_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `record_id` int DEFAULT NULL,
  `action` enum('SELECT','INSERT','UPDATE','DELETE','LOGIN','LOGOUT') COLLATE utf8mb4_unicode_ci NOT NULL,
  `old_values` json DEFAULT NULL,
  `new_values` json DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `session_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `location_data` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_user` (`user_id`),
  KEY `idx_audit_table` (`table_name`),
  KEY `idx_audit_action` (`action`),
  KEY `idx_audit_created` (`created_at`),
  CONSTRAINT `audit_log_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=511 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 5/44: audit_logs
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `table_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `record_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` enum('create','update','delete','login','logout') COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `details` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`),
  KEY `idx_table_name` (`table_name`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 6/44: clinical_alerts
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `clinical_alerts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clinical_alerts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `rule_id` int NOT NULL,
  `patient_id` int NOT NULL,
  `visit_id` int DEFAULT NULL,
  `triggered_by` int NOT NULL,
  `alert_context` json DEFAULT NULL,
  `user_response` enum('acknowledged','overridden','acted_upon') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `response_notes` text COLLATE utf8mb4_unicode_ci,
  `responded_by` int DEFAULT NULL,
  `responded_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `triggered_by` (`triggered_by`),
  KEY `responded_by` (`responded_by`),
  KEY `idx_alerts_patient` (`patient_id`),
  KEY `idx_alerts_visit` (`visit_id`),
  KEY `idx_alerts_rule` (`rule_id`),
  KEY `idx_alerts_created` (`created_at` DESC),
  CONSTRAINT `clinical_alerts_ibfk_1` FOREIGN KEY (`rule_id`) REFERENCES `clinical_decision_rules` (`id`),
  CONSTRAINT `clinical_alerts_ibfk_2` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `clinical_alerts_ibfk_3` FOREIGN KEY (`visit_id`) REFERENCES `patient_visits` (`id`) ON DELETE CASCADE,
  CONSTRAINT `clinical_alerts_ibfk_4` FOREIGN KEY (`triggered_by`) REFERENCES `users` (`id`),
  CONSTRAINT `clinical_alerts_ibfk_5` FOREIGN KEY (`responded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 7/44: clinical_decision_rules
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `clinical_decision_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clinical_decision_rules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `rule_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rule_type` enum('drug_interaction','allergy_alert','vital_alert','investigation_alert') COLLATE utf8mb4_unicode_ci NOT NULL,
  `condition_logic` json NOT NULL,
  `alert_level` enum('info','warning','critical') COLLATE utf8mb4_unicode_ci DEFAULT 'warning',
  `alert_message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `recommendation` text COLLATE utf8mb4_unicode_ci,
  `evidence_grade` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  KEY `idx_cdr_type` (`rule_type`),
  KEY `idx_cdr_level` (`alert_level`),
  KEY `idx_cdr_active` (`is_active`),
  CONSTRAINT `clinical_decision_rules_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 8/44: clinical_notes
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `clinical_notes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clinical_notes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `visit_id` int NOT NULL,
  `note_type` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `icd10_codes` text COLLATE utf8mb4_unicode_ci,
  `medications_prescribed` json DEFAULT NULL,
  `prescription_ids` json DEFAULT NULL,
  `investigation_order_ids` json DEFAULT NULL,
  `template_used` int DEFAULT NULL,
  `confidence_score` decimal(3,2) DEFAULT NULL,
  `reviewed_by` int DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `follow_up_required` tinyint(1) DEFAULT '0',
  `follow_up_date` date DEFAULT NULL,
  `created_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notes_visit` (`visit_id`),
  KEY `idx_notes_type` (`note_type`),
  KEY `idx_notes_created_by` (`created_by`),
  KEY `idx_clinical_notes_created_by_date` (`created_by`,`created_at`,`note_type`),
  KEY `idx_clinical_notes_visit_id` (`visit_id`),
  KEY `idx_clinical_notes_created_by` (`created_by`),
  KEY `reviewed_by` (`reviewed_by`),
  KEY `idx_clinical_notes_template` (`template_used`),
  KEY `idx_clinical_notes_reviewed` (`reviewed_at`),
  KEY `idx_notes_visit_type` (`visit_id`,`note_type`),
  CONSTRAINT `clinical_notes_ibfk_1` FOREIGN KEY (`visit_id`) REFERENCES `patient_visits` (`id`) ON DELETE CASCADE,
  CONSTRAINT `clinical_notes_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `clinical_notes_ibfk_3` FOREIGN KEY (`template_used`) REFERENCES `clinical_templates` (`id`),
  CONSTRAINT `clinical_notes_ibfk_4` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 9/44: clinical_templates
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `clinical_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clinical_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `template_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `template_type` enum('assessment','diagnosis','treatment','procedure') COLLATE utf8mb4_unicode_ci NOT NULL,
  `specialty` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `system_category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `template_content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `keywords` json DEFAULT NULL,
  `usage_count` int DEFAULT '0',
  `created_by` int DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `is_system_template` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  KEY `idx_templates_type` (`template_type`),
  KEY `idx_templates_specialty` (`specialty`),
  KEY `idx_templates_usage` (`usage_count` DESC),
  FULLTEXT KEY `idx_templates_search` (`template_name`,`template_content`),
  CONSTRAINT `clinical_templates_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 10/44: consumable_categories
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `consumable_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `consumable_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `requires_prescription` tinyint(1) DEFAULT '0',
  `storage_requirements` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `category_name` (`category_name`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 11/44: consumables
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `consumables`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `consumables` (
  `id` int NOT NULL AUTO_INCREMENT,
  `item_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category_id` int NOT NULL,
  `generic_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `strength` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dosage_form` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unit_of_measure` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reorder_level` int DEFAULT '10',
  `max_stock_level` int DEFAULT '1000',
  `storage_temperature_min` decimal(4,1) DEFAULT NULL,
  `storage_temperature_max` decimal(4,1) DEFAULT NULL,
  `is_controlled_substance` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `item_code` (`item_code`),
  KEY `idx_consumables_code` (`item_code`),
  KEY `idx_consumables_name` (`item_name`),
  KEY `idx_consumables_category` (`category_id`),
  CONSTRAINT `consumables_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `consumable_categories` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 12/44: drug_database
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `drug_database`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `drug_database` (
  `id` int NOT NULL AUTO_INCREMENT,
  `drug_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `generic_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `brand_names` json DEFAULT NULL,
  `drug_class` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `available_strengths` json DEFAULT NULL,
  `available_forms` json DEFAULT NULL,
  `standard_dosages` json DEFAULT NULL,
  `contraindications` text COLLATE utf8mb4_unicode_ci,
  `side_effects` text COLLATE utf8mb4_unicode_ci,
  `drug_interactions` json DEFAULT NULL,
  `pregnancy_category` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `renal_adjustment` tinyint(1) DEFAULT '0',
  `hepatic_adjustment` tinyint(1) DEFAULT '0',
  `is_controlled_substance` tinyint(1) DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_drug_name` (`drug_name`),
  KEY `idx_generic_name` (`generic_name`),
  KEY `idx_drug_class` (`drug_class`),
  FULLTEXT KEY `idx_drug_search` (`drug_name`,`generic_name`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 13/44: icd10_codes
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `icd10_codes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `icd10_codes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(10) NOT NULL,
  `description` text NOT NULL,
  `is_common` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `code_2` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=74261 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 14/44: icd10_order
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `icd10_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `icd10_order` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_number` int NOT NULL,
  `code` varchar(10) NOT NULL,
  `valid_flag` tinyint(1) NOT NULL,
  `short_description` varchar(255) DEFAULT NULL,
  `long_description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `code` (`code`),
  KEY `order_number` (`order_number`)
) ENGINE=InnoDB AUTO_INCREMENT=97585 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 15/44: inventory_stock
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `inventory_stock`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_stock` (
  `id` int NOT NULL AUTO_INCREMENT,
  `consumable_id` int NOT NULL,
  `batch_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `supplier_id` int NOT NULL,
  `quantity_received` int NOT NULL,
  `quantity_current` int NOT NULL,
  `unit_cost` decimal(8,2) DEFAULT NULL,
  `manufacture_date` date DEFAULT NULL,
  `expiry_date` date NOT NULL,
  `received_date` date NOT NULL,
  `received_by` int NOT NULL,
  `location` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'Mobile Clinic',
  `status` enum('Active','Expired','Recalled','Disposed') COLLATE utf8mb4_unicode_ci DEFAULT 'Active',
  `disposal_date` date DEFAULT NULL,
  `disposal_reason` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_batch_consumable` (`consumable_id`,`batch_number`),
  KEY `supplier_id` (`supplier_id`),
  KEY `received_by` (`received_by`),
  KEY `idx_stock_consumable` (`consumable_id`),
  KEY `idx_stock_batch` (`batch_number`),
  KEY `idx_stock_expiry` (`expiry_date`),
  KEY `idx_stock_status` (`status`),
  CONSTRAINT `inventory_stock_ibfk_1` FOREIGN KEY (`consumable_id`) REFERENCES `consumables` (`id`),
  CONSTRAINT `inventory_stock_ibfk_2` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`),
  CONSTRAINT `inventory_stock_ibfk_3` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 16/44: inventory_usage
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `inventory_usage`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_usage` (
  `id` int NOT NULL AUTO_INCREMENT,
  `stock_id` int NOT NULL,
  `visit_id` int DEFAULT NULL,
  `quantity_used` int NOT NULL,
  `used_by` int NOT NULL,
  `usage_date` date NOT NULL,
  `usage_time` time NOT NULL,
  `location` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_usage_stock` (`stock_id`),
  KEY `idx_usage_visit` (`visit_id`),
  KEY `idx_usage_date` (`usage_date`),
  KEY `idx_usage_user` (`used_by`),
  CONSTRAINT `inventory_usage_ibfk_1` FOREIGN KEY (`stock_id`) REFERENCES `inventory_stock` (`id`),
  CONSTRAINT `inventory_usage_ibfk_2` FOREIGN KEY (`visit_id`) REFERENCES `patient_visits` (`id`),
  CONSTRAINT `inventory_usage_ibfk_3` FOREIGN KEY (`used_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 17/44: investigation_categories
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `investigation_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `investigation_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `department` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `turnaround_time_hours` int DEFAULT NULL,
  `sample_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fasting_required` tinyint(1) DEFAULT '0',
  `special_instructions` text COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `category_name` (`category_name`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 18/44: investigation_orders
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `investigation_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `investigation_orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `visit_id` int NOT NULL,
  `patient_id` int NOT NULL,
  `investigation_id` int NOT NULL,
  `ordered_by` int NOT NULL,
  `order_date` date NOT NULL,
  `order_time` time NOT NULL,
  `priority` enum('routine','urgent','stat') COLLATE utf8mb4_unicode_ci DEFAULT 'routine',
  `clinical_notes` text COLLATE utf8mb4_unicode_ci,
  `special_instructions` text COLLATE utf8mb4_unicode_ci,
  `expected_completion` datetime DEFAULT NULL,
  `status` enum('ordered','sample_collected','in_progress','completed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'ordered',
  `sample_collected_at` timestamp NULL DEFAULT NULL,
  `sample_collected_by` int DEFAULT NULL,
  `cancelled_reason` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ordered_by` (`ordered_by`),
  KEY `sample_collected_by` (`sample_collected_by`),
  KEY `idx_inv_orders_visit` (`visit_id`),
  KEY `idx_inv_orders_patient` (`patient_id`),
  KEY `idx_inv_orders_investigation` (`investigation_id`),
  KEY `idx_inv_orders_status` (`status`),
  KEY `idx_inv_orders_date` (`order_date`,`order_time`),
  CONSTRAINT `investigation_orders_ibfk_1` FOREIGN KEY (`visit_id`) REFERENCES `patient_visits` (`id`) ON DELETE CASCADE,
  CONSTRAINT `investigation_orders_ibfk_2` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `investigation_orders_ibfk_3` FOREIGN KEY (`investigation_id`) REFERENCES `investigations` (`id`),
  CONSTRAINT `investigation_orders_ibfk_4` FOREIGN KEY (`ordered_by`) REFERENCES `users` (`id`),
  CONSTRAINT `investigation_orders_ibfk_5` FOREIGN KEY (`sample_collected_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 19/44: investigation_results
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `investigation_results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `investigation_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `result_data` json NOT NULL,
  `interpretation` text COLLATE utf8mb4_unicode_ci,
  `reference_ranges` json DEFAULT NULL,
  `abnormal_flags` json DEFAULT NULL,
  `reported_by` int DEFAULT NULL,
  `verified_by` int DEFAULT NULL,
  `reported_at` timestamp NOT NULL,
  `verified_at` timestamp NULL DEFAULT NULL,
  `report_file_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `comments` text COLLATE utf8mb4_unicode_ci,
  `critical_alert` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `reported_by` (`reported_by`),
  KEY `verified_by` (`verified_by`),
  KEY `idx_results_order` (`order_id`),
  KEY `idx_results_reported` (`reported_at`),
  KEY `idx_results_critical` (`critical_alert`),
  CONSTRAINT `investigation_results_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `investigation_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `investigation_results_ibfk_2` FOREIGN KEY (`reported_by`) REFERENCES `users` (`id`),
  CONSTRAINT `investigation_results_ibfk_3` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 20/44: investigations
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `investigations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `investigations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category_id` int NOT NULL,
  `investigation_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `investigation_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `alternative_names` json DEFAULT NULL,
  `normal_ranges` json DEFAULT NULL,
  `units` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference_values` text COLLATE utf8mb4_unicode_ci,
  `clinical_significance` text COLLATE utf8mb4_unicode_ci,
  `cost` decimal(8,2) DEFAULT NULL,
  `is_stat_available` tinyint(1) DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `investigation_code` (`investigation_code`),
  KEY `idx_investigation_code` (`investigation_code`),
  KEY `idx_investigation_name` (`investigation_name`),
  KEY `idx_investigation_category` (`category_id`),
  FULLTEXT KEY `idx_investigation_search` (`investigation_name`,`investigation_code`),
  CONSTRAINT `investigations_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `investigation_categories` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 21/44: location_types
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `location_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `location_types` (
  `id` int NOT NULL AUTO_INCREMENT,
  `type_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `default_capacity` int DEFAULT '50',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `type_name` (`type_name`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 22/44: locations
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `locations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `location_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `location_type_id` int NOT NULL,
  `province` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `city` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `gps_coordinates` point NOT NULL,
  `contact_person` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `facilities_available` json DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_locations_province` (`province`),
  KEY `idx_locations_city` (`city`),
  KEY `idx_locations_type` (`location_type_id`),
  SPATIAL KEY `idx_locations_gps` (`gps_coordinates`),
  CONSTRAINT `locations_ibfk_1` FOREIGN KEY (`location_type_id`) REFERENCES `location_types` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 23/44: medication_administration
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `medication_administration`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `medication_administration` (
  `id` int NOT NULL AUTO_INCREMENT,
  `prescription_id` int NOT NULL,
  `visit_id` int NOT NULL,
  `administered_by` int NOT NULL,
  `administration_time` timestamp NOT NULL,
  `dose_given` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `route_given` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `administration_notes` text COLLATE utf8mb4_unicode_ci,
  `patient_response` text COLLATE utf8mb4_unicode_ci,
  `adverse_reactions` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `administered_by` (`administered_by`),
  KEY `idx_med_admin_prescription` (`prescription_id`),
  KEY `idx_med_admin_visit` (`visit_id`),
  KEY `idx_med_admin_time` (`administration_time`),
  CONSTRAINT `medication_administration_ibfk_1` FOREIGN KEY (`prescription_id`) REFERENCES `prescriptions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `medication_administration_ibfk_2` FOREIGN KEY (`visit_id`) REFERENCES `patient_visits` (`id`) ON DELETE CASCADE,
  CONSTRAINT `medication_administration_ibfk_3` FOREIGN KEY (`administered_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 24/44: patient_authentication
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `patient_authentication`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `patient_authentication` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `patient_id` int NOT NULL,
  `polmed_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mobile_number` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_verified` tinyint(1) DEFAULT '0',
  `verification_token` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `verification_expires` timestamp NULL DEFAULT NULL,
  `login_attempts` int DEFAULT '0',
  `locked_until` timestamp NULL DEFAULT NULL,
  `last_login` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id` (`id`),
  UNIQUE KEY `patient_id` (`patient_id`),
  UNIQUE KEY `polmed_number` (`polmed_number`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 25/44: patient_sessions
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `patient_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `patient_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int NOT NULL,
  `session_token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `device_info` json DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `location_data` json DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_token` (`session_token`),
  KEY `patient_id` (`patient_id`),
  CONSTRAINT `patient_sessions_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 26/44: patient_visits
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `patient_visits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `patient_visits` (
  `id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int NOT NULL,
  `visit_date` date NOT NULL,
  `visit_time` time NOT NULL,
  `route_id` int DEFAULT NULL,
  `location` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `chief_complaint` text COLLATE utf8mb4_unicode_ci,
  `current_stage_id` int DEFAULT NULL,
  `is_completed` tinyint(1) DEFAULT '0',
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  KEY `idx_visits_patient` (`patient_id`),
  KEY `idx_visits_date` (`visit_date`),
  KEY `idx_visits_route` (`route_id`),
  KEY `idx_visits_stage` (`current_stage_id`),
  KEY `idx_visits_patient_date` (`patient_id`,`visit_date`),
  CONSTRAINT `patient_visits_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`),
  CONSTRAINT `patient_visits_ibfk_2` FOREIGN KEY (`current_stage_id`) REFERENCES `workflow_stages` (`id`),
  CONSTRAINT `patient_visits_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 27/44: patients
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `patients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `patients` (
  `id` int NOT NULL AUTO_INCREMENT,
  `medical_aid_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `first_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `date_of_birth` date DEFAULT NULL,
  `gender` enum('Male','Female','Other') COLLATE utf8mb4_unicode_ci NOT NULL,
  `id_number` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone_number` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `physical_address` text COLLATE utf8mb4_unicode_ci,
  `emergency_contact_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `emergency_contact_phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_palmed_member` tinyint(1) DEFAULT '0',
  `member_type` enum('Principal','Dependent','Non-member') COLLATE utf8mb4_unicode_ci DEFAULT 'Non-member',
  `chronic_conditions` json DEFAULT NULL,
  `allergies` json DEFAULT NULL,
  `current_medications` json DEFAULT NULL,
  `created_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `medical_aid_number` (`medical_aid_number`),
  UNIQUE KEY `id_number` (`id_number`),
  KEY `idx_patients_medical_aid` (`medical_aid_number`),
  KEY `idx_patients_id_number` (`id_number`),
  KEY `idx_patients_name` (`last_name`,`first_name`),
  KEY `idx_patients_member_type` (`member_type`),
  KEY `idx_patients_member_status` (`is_palmed_member`,`member_type`,`created_at`),
  KEY `idx_patients_search` (`last_name`,`first_name`,`medical_aid_number`),
  KEY `idx_patients_created_by_date` (`created_by`,`created_at`),
  CONSTRAINT `patients_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 28/44: prescriptions
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `prescriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `prescriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `visit_id` int NOT NULL,
  `patient_id` int NOT NULL,
  `drug_id` int DEFAULT NULL,
  `custom_drug_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dosage` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `route` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'oral',
  `frequency` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `duration` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity_prescribed` decimal(8,2) DEFAULT NULL,
  `quantity_dispensed` decimal(8,2) DEFAULT NULL,
  `instructions` text COLLATE utf8mb4_unicode_ci,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `prescribed_by` int NOT NULL,
  `dispensed_by` int DEFAULT NULL,
  `dispensed_at` timestamp NULL DEFAULT NULL,
  `status` enum('prescribed','dispensed','completed','discontinued') COLLATE utf8mb4_unicode_ci DEFAULT 'prescribed',
  `discontinuation_reason` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `prescribed_by` (`prescribed_by`),
  KEY `dispensed_by` (`dispensed_by`),
  KEY `idx_prescriptions_visit` (`visit_id`),
  KEY `idx_prescriptions_patient` (`patient_id`),
  KEY `idx_prescriptions_drug` (`drug_id`),
  KEY `idx_prescriptions_status` (`status`),
  KEY `idx_prescriptions_dates` (`start_date`,`end_date`),
  CONSTRAINT `prescriptions_ibfk_1` FOREIGN KEY (`visit_id`) REFERENCES `patient_visits` (`id`) ON DELETE CASCADE,
  CONSTRAINT `prescriptions_ibfk_2` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `prescriptions_ibfk_3` FOREIGN KEY (`drug_id`) REFERENCES `drug_database` (`id`),
  CONSTRAINT `prescriptions_ibfk_4` FOREIGN KEY (`prescribed_by`) REFERENCES `users` (`id`),
  CONSTRAINT `prescriptions_ibfk_5` FOREIGN KEY (`dispensed_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 29/44: referrals
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `referrals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `referrals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int NOT NULL,
  `visit_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `referral_type` enum('internal','external') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'internal',
  `from_stage` enum('Registration','Nursing Assessment','Doctor Consultation','Counseling Session') COLLATE utf8mb4_unicode_ci NOT NULL,
  `to_stage` enum('Registration','Nursing Assessment','Doctor Consultation','Counseling Session') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `external_provider` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `department` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `status` enum('pending','sent','accepted','completed','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `appointment_date` date DEFAULT NULL,
  `created_by` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ref_patient` (`patient_id`),
  KEY `idx_ref_status` (`status`),
  KEY `idx_ref_created_at` (`created_at`),
  KEY `idx_referrals_created_by_date` (`created_by`,`created_at`),
  CONSTRAINT `fk_ref_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_ref_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 30/44: route_locations
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `route_locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `route_locations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `route_id` int NOT NULL,
  `location_id` int NOT NULL,
  `visit_date` date NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `max_appointments` int DEFAULT '50',
  `appointment_duration` int DEFAULT '30',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_route_location_date` (`route_id`,`location_id`,`visit_date`),
  KEY `idx_route_locations_route` (`route_id`),
  KEY `idx_route_locations_location` (`location_id`),
  KEY `idx_route_locations_date` (`visit_date`),
  CONSTRAINT `route_locations_ibfk_1` FOREIGN KEY (`route_id`) REFERENCES `routes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `route_locations_ibfk_2` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`),
  CONSTRAINT `chk_appointment_duration_positive` CHECK ((`appointment_duration` > 0)),
  CONSTRAINT `chk_max_appointments` CHECK ((`max_appointments` > 0)),
  CONSTRAINT `chk_route_times` CHECK ((`start_time` < `end_time`))
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 31/44: routes
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `routes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `routes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `route_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `province` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `route_type` enum('Police Stations','Schools','Community Centers','Mixed') COLLATE utf8mb4_unicode_ci NOT NULL,
  `max_appointments_per_day` int DEFAULT '100',
  `created_by` int NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_routes_dates` (`start_date`,`end_date`),
  KEY `idx_routes_province` (`province`),
  KEY `idx_routes_type` (`route_type`),
  KEY `idx_routes_created_by` (`created_by`),
  CONSTRAINT `routes_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 32/44: smart_suggestions
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `smart_suggestions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `smart_suggestions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `suggestion_type` enum('icd10','medication','investigation','template') COLLATE utf8mb4_unicode_ci NOT NULL,
  `input_context` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `suggestion_data` json NOT NULL,
  `confidence_score` decimal(3,2) NOT NULL,
  `model_version` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `patient_context` json DEFAULT NULL,
  `was_accepted` tinyint(1) DEFAULT '0',
  `accepted_at` timestamp NULL DEFAULT NULL,
  `feedback_score` int DEFAULT NULL,
  `feedback_notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `idx_suggestions_type` (`suggestion_type`),
  KEY `idx_suggestions_confidence` (`confidence_score` DESC),
  KEY `idx_suggestions_accepted` (`was_accepted`),
  KEY `idx_suggestions_created` (`created_at` DESC),
  CONSTRAINT `smart_suggestions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 33/44: suppliers
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `suppliers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `suppliers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `supplier_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_person` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `tax_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 34/44: sync_status
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `sync_status`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sync_status` (
  `id` int NOT NULL AUTO_INCREMENT,
  `table_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `record_id` int NOT NULL,
  `operation_type` enum('INSERT','UPDATE','DELETE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `sync_status` enum('Pending','Synced','Failed','Conflict') COLLATE utf8mb4_unicode_ci DEFAULT 'Pending',
  `device_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `local_timestamp` timestamp NOT NULL,
  `server_timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `conflict_data` json DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `retry_count` int DEFAULT '0',
  `last_retry_at` timestamp NULL DEFAULT NULL,
  `synced_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sync_table_record` (`table_name`,`record_id`),
  KEY `idx_sync_status` (`sync_status`),
  KEY `idx_sync_device` (`device_id`),
  KEY `idx_sync_user` (`user_id`),
  CONSTRAINT `sync_status_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 35/44: system_settings
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `system_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting_value` text COLLATE utf8mb4_unicode_ci,
  `setting_type` enum('string','number','boolean','json') COLLATE utf8mb4_unicode_ci DEFAULT 'string',
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_encrypted` tinyint(1) DEFAULT '0',
  `updated_by` int DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`),
  KEY `updated_by` (`updated_by`),
  KEY `idx_settings_key` (`setting_key`),
  CONSTRAINT `system_settings_ibfk_1` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 36/44: user_clinical_preferences
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `user_clinical_preferences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_clinical_preferences` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `preference_type` enum('alert_level','template_category','medication_default','workflow_step') COLLATE utf8mb4_unicode_ci NOT NULL,
  `preference_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `preference_value` json NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_preference` (`user_id`,`preference_type`,`preference_key`),
  KEY `idx_user_prefs_type` (`preference_type`),
  KEY `idx_user_prefs_user` (`user_id`),
  CONSTRAINT `user_clinical_preferences_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 37/44: user_roles
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `user_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role_description` text COLLATE utf8mb4_unicode_ci,
  `permissions` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `role_name` (`role_name`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 38/44: user_sessions
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `user_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `session_token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `device_info` json DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `location_data` json DEFAULT NULL,
  `expires_at` timestamp NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_token` (`session_token`),
  KEY `idx_sessions_token` (`session_token`),
  KEY `idx_sessions_user` (`user_id`),
  KEY `idx_sessions_expires` (`expires_at`),
  CONSTRAINT `user_sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 39/44: user_tasks
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `user_tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_tasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `task_type` enum('maintenance','appointment','inventory','review') COLLATE utf8mb4_unicode_ci NOT NULL,
  `priority` enum('high','medium','low') COLLATE utf8mb4_unicode_ci DEFAULT 'medium',
  `due_date` datetime NOT NULL,
  `is_completed` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_tasks_user_due` (`user_id`,`due_date`,`is_completed`),
  CONSTRAINT `user_tasks_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 40/44: users
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role_id` int NOT NULL,
  `first_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone_number` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mp_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `geographic_restrictions` json DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `requires_approval` tinyint(1) DEFAULT '0',
  `approved_by` int DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `last_login` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_users_role` (`role_id`),
  KEY `idx_users_active` (`is_active`),
  KEY `idx_users_email` (`email`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `user_roles` (`id`),
  CONSTRAINT `users_ibfk_2` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 41/44: visit_workflow_progress
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `visit_workflow_progress`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `visit_workflow_progress` (
  `id` int NOT NULL AUTO_INCREMENT,
  `visit_id` int NOT NULL,
  `stage_id` int NOT NULL,
  `assigned_user_id` int DEFAULT NULL,
  `started_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `data_collected` json DEFAULT NULL,
  `is_completed` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_visit_stage` (`visit_id`,`stage_id`),
  KEY `idx_workflow_visit` (`visit_id`),
  KEY `idx_workflow_stage` (`stage_id`),
  KEY `idx_workflow_user` (`assigned_user_id`),
  KEY `idx_workflow_progress_user_completed` (`assigned_user_id`,`is_completed`,`completed_at`),
  KEY `idx_workflow_visit_status` (`visit_id`,`completed_at`),
  CONSTRAINT `visit_workflow_progress_ibfk_1` FOREIGN KEY (`visit_id`) REFERENCES `patient_visits` (`id`) ON DELETE CASCADE,
  CONSTRAINT `visit_workflow_progress_ibfk_2` FOREIGN KEY (`stage_id`) REFERENCES `workflow_stages` (`id`),
  CONSTRAINT `visit_workflow_progress_ibfk_3` FOREIGN KEY (`assigned_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 42/44: vital_signs
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `vital_signs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vital_signs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `visit_id` int NOT NULL,
  `recorded_by` int NOT NULL,
  `systolic_bp` int DEFAULT NULL,
  `diastolic_bp` int DEFAULT NULL,
  `heart_rate` int DEFAULT NULL,
  `temperature` decimal(4,1) DEFAULT NULL,
  `weight` decimal(5,2) DEFAULT NULL,
  `height` decimal(5,2) DEFAULT NULL,
  `bmi` decimal(4,1) GENERATED ALWAYS AS ((case when (`height` > 0) then round((`weight` / pow((`height` / 100),2)),1) else NULL end)) STORED,
  `oxygen_saturation` int DEFAULT NULL,
  `blood_glucose` decimal(5,1) DEFAULT NULL,
  `additional_measurements` json DEFAULT NULL,
  `recorded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_vitals_visit` (`visit_id`),
  KEY `idx_vitals_recorded_by` (`recorded_by`),
  KEY `idx_vital_signs_recorded_by_date` (`recorded_by`,`recorded_at`),
  CONSTRAINT `vital_signs_ibfk_1` FOREIGN KEY (`visit_id`) REFERENCES `patient_visits` (`id`) ON DELETE CASCADE,
  CONSTRAINT `vital_signs_ibfk_2` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 43/44: vital_signs_references
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `vital_signs_references`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vital_signs_references` (
  `id` int NOT NULL AUTO_INCREMENT,
  `parameter_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `age_min` int DEFAULT NULL,
  `age_max` int DEFAULT NULL,
  `gender` enum('male','female','all') COLLATE utf8mb4_unicode_ci DEFAULT 'all',
  `normal_min` decimal(6,2) DEFAULT NULL,
  `normal_max` decimal(6,2) DEFAULT NULL,
  `caution_min` decimal(6,2) DEFAULT NULL,
  `caution_max` decimal(6,2) DEFAULT NULL,
  `critical_min` decimal(6,2) DEFAULT NULL,
  `critical_max` decimal(6,2) DEFAULT NULL,
  `unit` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `clinical_context` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_vitals_ref_param` (`parameter_name`),
  KEY `idx_vitals_ref_age` (`age_min`,`age_max`),
  KEY `idx_vitals_ref_gender` (`gender`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- TABLE 44/44: workflow_stages
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `workflow_stages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workflow_stages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `stage_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stage_order` int NOT NULL,
  `required_role_id` int NOT NULL,
  `is_mandatory` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stage_name` (`stage_name`),
  KEY `required_role_id` (`required_role_id`),
  CONSTRAINT `workflow_stages_ibfk_1` FOREIGN KEY (`required_role_id`) REFERENCES `user_roles` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


-- ============================================================================
-- 4. VIEW DEFINITIONS
-- ============================================================================

-- VIEW 1/18: v_active_users
-- ----------------------------------------------------------------------

DROP VIEW IF EXISTS `v_active_users`;
/*!50001 DROP VIEW IF EXISTS `v_active_users`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_active_users` AS select `u`.`id` AS `id`,`u`.`username` AS `username`,`u`.`email` AS `email`,`u`.`first_name` AS `first_name`,`u`.`last_name` AS `last_name`,`u`.`phone_number` AS `phone_number`,`u`.`mp_number` AS `mp_number`,`ur`.`role_name` AS `role_name`,`ur`.`role_description` AS `role_description`,`u`.`geographic_restrictions` AS `geographic_restrictions`,`u`.`last_login` AS `last_login`,`u`.`created_at` AS `created_at`,(case when (`u`.`last_login` >= (now() - interval 30 day)) then 'Active' when (`u`.`last_login` >= (now() - interval 90 day)) then 'Inactive' else 'Dormant' end) AS `activity_status` from (`users` `u` join `user_roles` `ur` on((`u`.`role_id` = `ur`.`id`))) where (`u`.`is_active` = true);
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;


-- VIEW 2/18: v_active_visits
-- ----------------------------------------------------------------------

DROP VIEW IF EXISTS `v_active_visits`;
/*!50001 DROP VIEW IF EXISTS `v_active_visits`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_active_visits` AS select `pv`.`id` AS `visit_id`,`p`.`first_name` AS `first_name`,`p`.`last_name` AS `last_name`,`p`.`medical_aid_number` AS `medical_aid_number`,`pv`.`visit_date` AS `visit_date`,`pv`.`visit_time` AS `visit_time`,`pv`.`location` AS `location`,`pv`.`chief_complaint` AS `chief_complaint`,`ws`.`stage_name` AS `current_stage`,`ws`.`stage_order` AS `stage_order`,`ur`.`role_name` AS `required_role`,`pv`.`created_at` AS `created_at`,timestampdiff(HOUR,`pv`.`created_at`,now()) AS `hours_since_checkin` from (((`patient_visits` `pv` join `patients` `p` on((`pv`.`patient_id` = `p`.`id`))) left join `workflow_stages` `ws` on((`pv`.`current_stage_id` = `ws`.`id`))) left join `user_roles` `ur` on((`ws`.`required_role_id` = `ur`.`id`))) where (`pv`.`is_completed` = false) order by `pv`.`created_at`;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;


-- VIEW 3/18: v_appointment_summary
-- ----------------------------------------------------------------------

DROP VIEW IF EXISTS `v_appointment_summary`;
/*!50001 DROP VIEW IF EXISTS `v_appointment_summary`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_appointment_summary` AS select `a`.`id` AS `appointment_id`,`a`.`booking_reference` AS `booking_reference`,`r`.`route_name` AS `route_name`,`l`.`location_name` AS `location_name`,`l`.`city` AS `city`,`l`.`province` AS `province`,`rl`.`visit_date` AS `visit_date`,`a`.`appointment_time` AS `appointment_time`,`a`.`status` AS `status`,coalesce(`p`.`first_name`,`a`.`booked_by_name`) AS `patient_first_name`,coalesce(`p`.`last_name`,'') AS `patient_last_name`,coalesce(`p`.`phone_number`,`a`.`booked_by_phone`) AS `contact_phone`,`a`.`special_requirements` AS `special_requirements`,`a`.`booked_at` AS `booked_at`,(case when ((`a`.`status` = 'Booked') and (`rl`.`visit_date` = curdate())) then 'Today' when ((`a`.`status` = 'Booked') and (`rl`.`visit_date` = (curdate() + interval 1 day))) then 'Tomorrow' when ((`a`.`status` = 'Booked') and (`rl`.`visit_date` > curdate())) then 'Upcoming' when ((`a`.`status` = 'Booked') and (`rl`.`visit_date` < curdate())) then 'Past' else `a`.`status` end) AS `appointment_category` from ((((`appointments` `a` join `route_locations` `rl` on((`a`.`route_location_id` = `rl`.`id`))) join `routes` `r` on((`rl`.`route_id` = `r`.`id`))) join `locations` `l` on((`rl`.`location_id` = `l`.`id`))) left join `patients` `p` on((`a`.`patient_id` = `p`.`id`))) order by `rl`.`visit_date`,`a`.`appointment_time`;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;


-- VIEW 4/18: v_asset_maintenance_schedule
-- ----------------------------------------------------------------------

DROP VIEW IF EXISTS `v_asset_maintenance_schedule`;
/*!50001 DROP VIEW IF EXISTS `v_asset_maintenance_schedule`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_asset_maintenance_schedule` AS select `a`.`id` AS `asset_id`,`a`.`asset_tag` AS `asset_tag`,`a`.`asset_name` AS `asset_name`,`ac`.`category_name` AS `category_name`,`a`.`manufacturer` AS `manufacturer`,`a`.`model` AS `model`,`a`.`status` AS `status`,`a`.`location` AS `location`,concat(`u`.`first_name`,' ',`u`.`last_name`) AS `assigned_to`,`a`.`last_maintenance_date` AS `last_maintenance_date`,`a`.`next_maintenance_date` AS `next_maintenance_date`,(to_days(`a`.`next_maintenance_date`) - to_days(curdate())) AS `days_to_maintenance`,(case when (`a`.`next_maintenance_date` <= curdate()) then 'Overdue' when (`a`.`next_maintenance_date` <= (curdate() + interval 7 day)) then 'Due This Week' when (`a`.`next_maintenance_date` <= (curdate() + interval 30 day)) then 'Due This Month' else 'Scheduled' end) AS `maintenance_status` from ((`assets` `a` join `asset_categories` `ac` on((`a`.`category_id` = `ac`.`id`))) left join `users` `u` on((`a`.`assigned_to` = `u`.`id`))) where (`a`.`status` <> 'Retired') order by `a`.`next_maintenance_date`;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;


-- VIEW 5/18: v_daily_clinic_capacity
-- ----------------------------------------------------------------------

DROP VIEW IF EXISTS `v_daily_clinic_capacity`;
/*!50001 DROP VIEW IF EXISTS `v_daily_clinic_capacity`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_daily_clinic_capacity` AS select `rl`.`visit_date` AS `visit_date`,`l`.`province` AS `province`,`l`.`city` AS `city`,count(distinct `rl`.`id`) AS `locations_count`,sum(`rl`.`max_appointments`) AS `total_capacity`,count((case when (`a`.`status` = 'Booked') then 1 end)) AS `total_booked`,count((case when (`a`.`status` = 'Completed') then 1 end)) AS `total_completed`,count((case when (`a`.`status` = 'No-Show') then 1 end)) AS `total_no_shows`,round(((count((case when (`a`.`status` = 'Booked') then 1 end)) / sum(`rl`.`max_appointments`)) * 100),1) AS `utilization_percentage`,round(((count((case when (`a`.`status` = 'Completed') then 1 end)) / count((case when (`a`.`status` in ('Booked','Completed','No-Show')) then 1 end))) * 100),1) AS `completion_rate` from ((`route_locations` `rl` join `locations` `l` on((`rl`.`location_id` = `l`.`id`))) left join `appointments` `a` on((`rl`.`id` = `a`.`route_location_id`))) group by `rl`.`visit_date`,`l`.`province`,`l`.`city` order by `rl`.`visit_date` desc;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;


-- VIEW 6/18: v_daily_operations_summary
-- ----------------------------------------------------------------------

DROP VIEW IF EXISTS `v_daily_operations_summary`;
/*!50001 DROP VIEW IF EXISTS `v_daily_operations_summary`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_daily_operations_summary` AS select curdate() AS `report_date`,count(distinct `pv`.`id`) AS `total_visits`,count(distinct `pv`.`patient_id`) AS `unique_patients`,count(distinct (case when (`p`.`is_palmed_member` = true) then `pv`.`patient_id` end)) AS `palmed_members`,count(distinct (case when (`pv`.`is_completed` = true) then `pv`.`id` end)) AS `completed_visits`,count(distinct (case when (`pv`.`is_completed` = false) then `pv`.`id` end)) AS `active_visits`,count(distinct `a`.`id`) AS `total_appointments`,count(distinct (case when (`a`.`status` = 'Completed') then `a`.`id` end)) AS `completed_appointments`,count(distinct (case when (`a`.`status` = 'No-Show') then `a`.`id` end)) AS `no_shows`,round(avg(timestampdiff(MINUTE,`pv`.`created_at`,`pv`.`completed_at`)),0) AS `avg_visit_duration_minutes` from ((`patient_visits` `pv` join `patients` `p` on((`pv`.`patient_id` = `p`.`id`))) left join `appointments` `a` on((`pv`.`id` = `a`.`visit_id`))) where (`pv`.`visit_date` = curdate());
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;


-- VIEW 7/18: v_expiring_inventory
-- ----------------------------------------------------------------------

DROP VIEW IF EXISTS `v_expiring_inventory`;
/*!50001 DROP VIEW IF EXISTS `v_expiring_inventory`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_expiring_inventory` AS select `ist`.`id` AS `stock_id`,`c`.`item_code` AS `item_code`,`c`.`item_name` AS `item_name`,`cc`.`category_name` AS `category_name`,`ist`.`batch_number` AS `batch_number`,`s`.`supplier_name` AS `supplier_name`,`ist`.`quantity_current` AS `quantity_current`,`c`.`unit_of_measure` AS `unit_of_measure`,`ist`.`expiry_date` AS `expiry_date`,(to_days(`ist`.`expiry_date`) - to_days(curdate())) AS `days_to_expiry`,`ist`.`unit_cost` AS `unit_cost`,(`ist`.`quantity_current` * `ist`.`unit_cost`) AS `total_value`,(case when (`ist`.`expiry_date` <= curdate()) then 'Expired' when (`ist`.`expiry_date` <= (curdate() + interval 30 day)) then 'Critical' when (`ist`.`expiry_date` <= (curdate() + interval 90 day)) then 'Warning' else 'Normal' end) AS `expiry_status` from (((`inventory_stock` `ist` join `consumables` `c` on((`ist`.`consumable_id` = `c`.`id`))) join `consumable_categories` `cc` on((`c`.`category_id` = `cc`.`id`))) join `suppliers` `s` on((`ist`.`supplier_id` = `s`.`id`))) where ((`ist`.`status` = 'Active') and (`ist`.`expiry_date` <= (curdate() + interval 6 month))) order by `ist`.`expiry_date`,`c`.`item_name`;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;


-- VIEW 8/18: v_inventory_levels
-- ----------------------------------------------------------------------

DROP VIEW IF EXISTS `v_inventory_levels`;
/*!50001 DROP VIEW IF EXISTS `v_inventory_levels`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_inventory_levels` AS select `c`.`id` AS `consumable_id`,`c`.`item_code` AS `item_code`,`c`.`item_name` AS `item_name`,`cc`.`category_name` AS `category_name`,`c`.`unit_of_measure` AS `unit_of_measure`,`c`.`reorder_level` AS `reorder_level`,`c`.`max_stock_level` AS `max_stock_level`,sum((case when (`ist`.`status` = 'Active') then `ist`.`quantity_current` else 0 end)) AS `current_stock`,count(distinct `ist`.`batch_number`) AS `active_batches`,min((case when (`ist`.`status` = 'Active') then `ist`.`expiry_date` end)) AS `earliest_expiry`,(case when (sum((case when (`ist`.`status` = 'Active') then `ist`.`quantity_current` else 0 end)) <= `c`.`reorder_level`) then 'Low Stock' when (min((case when (`ist`.`status` = 'Active') then `ist`.`expiry_date` end)) <= (curdate() + interval 3 month)) then 'Expiring Soon' when (sum((case when (`ist`.`status` = 'Active') then `ist`.`quantity_current` else 0 end)) >= `c`.`max_stock_level`) then 'Overstock' else 'Normal' end) AS `alert_status`,(to_days(min((case when (`ist`.`status` = 'Active') then `ist`.`expiry_date` end))) - to_days(curdate())) AS `days_to_expiry` from ((`consumables` `c` join `consumable_categories` `cc` on((`c`.`category_id` = `cc`.`id`))) left join `inventory_stock` `ist` on((`c`.`id` = `ist`.`consumable_id`))) group by `c`.`id` order by (case when (sum((case when (`ist`.`status` = 'Active') then `ist`.`quantity_current` else 0 end)) <= `c`.`reorder_level`) then 1 when (min((case when (`ist`.`status` = 'Active') then `ist`.`expiry_date` end)) <= (curdate() + interval 3 month)) then 2 else 3 end),`c`.`item_name`;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;


-- VIEW 9/18: v_inventory_usage_analytics
-- ----------------------------------------------------------------------

DROP VIEW IF EXISTS `v_inventory_usage_analytics`;
/*!50001 DROP VIEW IF EXISTS `v_inventory_usage_analytics`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_inventory_usage_analytics` AS select `c`.`item_code` AS `item_code`,`c`.`item_name` AS `item_name`,`cc`.`category_name` AS `category_name`,date_format(`iu`.`usage_date`,'%Y-%m') AS `usage_month`,sum(`iu`.`quantity_used`) AS `total_used`,count(distinct `iu`.`visit_id`) AS `visits_used`,count(distinct `iu`.`used_by`) AS `users_count`,avg(`iu`.`quantity_used`) AS `avg_per_usage`,sum((`iu`.`quantity_used` * `ist`.`unit_cost`)) AS `total_cost` from (((`inventory_usage` `iu` join `inventory_stock` `ist` on((`iu`.`stock_id` = `ist`.`id`))) join `consumables` `c` on((`ist`.`consumable_id` = `c`.`id`))) join `consumable_categories` `cc` on((`c`.`category_id` = `cc`.`id`))) where (`iu`.`usage_date` >= (curdate() - interval 12 month)) group by `c`.`id`,date_format(`iu`.`usage_date`,'%Y-%m') order by `usage_month` desc,`total_used` desc;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;


-- VIEW 10/18: v_monthly_performance
-- ----------------------------------------------------------------------

DROP VIEW IF EXISTS `v_monthly_performance`;
/*!50001 DROP VIEW IF EXISTS `v_monthly_performance`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_monthly_performance` AS select date_format(`pv`.`visit_date`,'%Y-%m') AS `month_year`,count(distinct `pv`.`id`) AS `total_visits`,count(distinct `pv`.`patient_id`) AS `unique_patients`,count(distinct (case when (`p`.`is_palmed_member` = true) then `pv`.`patient_id` end)) AS `palmed_members`,round(((count(distinct (case when (`p`.`is_palmed_member` = true) then `pv`.`patient_id` end)) / count(distinct `pv`.`patient_id`)) * 100),1) AS `palmed_member_percentage`,count(distinct `pv`.`location`) AS `locations_served`,count(distinct cast(`pv`.`visit_date` as date)) AS `active_days`,round((count(distinct `pv`.`id`) / count(distinct cast(`pv`.`visit_date` as date))),1) AS `avg_visits_per_day`,sum((case when (`cn`.`note_type` = 'Referral') then 1 else 0 end)) AS `total_referrals` from ((`patient_visits` `pv` join `patients` `p` on((`pv`.`patient_id` = `p`.`id`))) left join `clinical_notes` `cn` on((`pv`.`id` = `cn`.`visit_id`))) where (`pv`.`visit_date` >= (curdate() - interval 12 month)) group by date_format(`pv`.`visit_date`,'%Y-%m') order by `month_year` desc;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;


-- VIEW 11/18: v_patient_summary
-- ----------------------------------------------------------------------

DROP VIEW IF EXISTS `v_patient_summary`;
/*!50001 DROP VIEW IF EXISTS `v_patient_summary`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_patient_summary` AS select `p`.`id` AS `id`,`p`.`medical_aid_number` AS `medical_aid_number`,`p`.`first_name` AS `first_name`,`p`.`last_name` AS `last_name`,`p`.`date_of_birth` AS `date_of_birth`,`p`.`gender` AS `gender`,`p`.`phone_number` AS `phone_number`,`p`.`email` AS `email`,`p`.`is_palmed_member` AS `is_palmed_member`,`p`.`member_type` AS `member_type`,`p`.`chronic_conditions` AS `chronic_conditions`,`p`.`allergies` AS `allergies`,count(`pv`.`id`) AS `total_visits`,max(`pv`.`visit_date`) AS `last_visit_date`,(case when (max(`pv`.`visit_date`) >= (curdate() - interval 6 month)) then 'Recent' when (max(`pv`.`visit_date`) >= (curdate() - interval 1 year)) then 'Moderate' else 'Inactive' end) AS `patient_status`,`p`.`created_at` AS `created_at` from (`patients` `p` left join `patient_visits` `pv` on((`p`.`id` = `pv`.`patient_id`))) group by `p`.`id`;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;


-- VIEW 12/18: v_patient_vitals_trends
-- ----------------------------------------------------------------------

DROP VIEW IF EXISTS `v_patient_vitals_trends`;
/*!50001 DROP VIEW IF EXISTS `v_patient_vitals_trends`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_patient_vitals_trends` AS select `p`.`id` AS `patient_id`,`p`.`first_name` AS `first_name`,`p`.`last_name` AS `last_name`,`vs`.`visit_id` AS `visit_id`,`pv`.`visit_date` AS `visit_date`,`vs`.`systolic_bp` AS `systolic_bp`,`vs`.`diastolic_bp` AS `diastolic_bp`,`vs`.`heart_rate` AS `heart_rate`,`vs`.`temperature` AS `temperature`,`vs`.`weight` AS `weight`,`vs`.`height` AS `height`,`vs`.`bmi` AS `bmi`,`vs`.`oxygen_saturation` AS `oxygen_saturation`,`vs`.`blood_glucose` AS `blood_glucose`,lag(`vs`.`systolic_bp`) OVER (PARTITION BY `p`.`id` ORDER BY `pv`.`visit_date` )  AS `prev_systolic_bp`,lag(`vs`.`weight`) OVER (PARTITION BY `p`.`id` ORDER BY `pv`.`visit_date` )  AS `prev_weight`,lag(`vs`.`bmi`) OVER (PARTITION BY `p`.`id` ORDER BY `pv`.`visit_date` )  AS `prev_bmi` from ((`patients` `p` join `patient_visits` `pv` on((`p`.`id` = `pv`.`patient_id`))) join `vital_signs` `vs` on((`pv`.`id` = `vs`.`visit_id`))) order by `p`.`id`,`pv`.`visit_date`;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;


-- VIEW 13/18: v_pending_approvals
-- ----------------------------------------------------------------------

DROP VIEW IF EXISTS `v_pending_approvals`;
/*!50001 DROP VIEW IF EXISTS `v_pending_approvals`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_pending_approvals` AS select `u`.`id` AS `id`,`u`.`username` AS `username`,`u`.`email` AS `email`,`u`.`first_name` AS `first_name`,`u`.`last_name` AS `last_name`,`u`.`mp_number` AS `mp_number`,`ur`.`role_name` AS `role_name`,`u`.`created_at` AS `created_at`,(to_days(now()) - to_days(`u`.`created_at`)) AS `days_pending` from (`users` `u` join `user_roles` `ur` on((`u`.`role_id` = `ur`.`id`))) where ((`u`.`requires_approval` = true) and (`u`.`approved_at` is null) and (`u`.`is_active` = true));
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;


-- VIEW 14/18: v_role_dashboard_metrics
-- ----------------------------------------------------------------------

DROP VIEW IF EXISTS `v_role_dashboard_metrics`;
/*!50001 DROP VIEW IF EXISTS `v_role_dashboard_metrics`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_role_dashboard_metrics` AS select 'clerk' AS `user_role`,`u`.`id` AS `user_id`,'registrations' AS `metric_type`,count((case when (cast(`p`.`created_at` as date) = curdate()) then 1 end)) AS `today_count`,count((case when (cast(`p`.`created_at` as date) >= (curdate() - interval 7 day)) then 1 end)) AS `week_count`,count((case when (cast(`p`.`created_at` as date) >= (curdate() - interval 30 day)) then 1 end)) AS `month_count`,0 AS `secondary_today_count`,0 AS `secondary_week_count` from ((`users` `u` left join `patients` `p` on((`u`.`id` = `p`.`created_by`))) join `user_roles` `ur` on((`u`.`role_id` = `ur`.`id`))) where (lower(replace(`ur`.`role_name`,' ','_')) = 'clerk') group by `u`.`id` union all select 'nurse' AS `user_role`,`u`.`id` AS `user_id`,'vitals' AS `metric_type`,count((case when (cast(`vs`.`recorded_at` as date) = curdate()) then 1 end)) AS `today_count`,count((case when (cast(`vs`.`recorded_at` as date) >= (curdate() - interval 7 day)) then 1 end)) AS `week_count`,count((case when (cast(`vs`.`recorded_at` as date) >= (curdate() - interval 30 day)) then 1 end)) AS `month_count`,count(distinct (case when ((cast(`cn`.`created_at` as date) = curdate()) and (`cn`.`note_type` = 'Assessment')) then `cn`.`visit_id` end)) AS `secondary_today_count`,count(distinct (case when ((cast(`cn`.`created_at` as date) >= (curdate() - interval 7 day)) and (`cn`.`note_type` = 'Assessment')) then `cn`.`visit_id` end)) AS `secondary_week_count` from (((`users` `u` left join `vital_signs` `vs` on((`u`.`id` = `vs`.`recorded_by`))) left join `clinical_notes` `cn` on((`u`.`id` = `cn`.`created_by`))) join `user_roles` `ur` on((`u`.`role_id` = `ur`.`id`))) where (lower(replace(`ur`.`role_name`,' ','_')) = 'nurse') group by `u`.`id` union all select 'doctor' AS `user_role`,`u`.`id` AS `user_id`,'clinical' AS `metric_type`,count(distinct (case when ((cast(`cn`.`created_at` as date) = curdate()) and (`cn`.`note_type` in ('Diagnosis','Treatment'))) then `cn`.`visit_id` end)) AS `today_count`,count(distinct (case when ((cast(`cn`.`created_at` as date) >= (curdate() - interval 7 day)) and (`cn`.`note_type` in ('Diagnosis','Treatment'))) then `cn`.`visit_id` end)) AS `week_count`,count(distinct (case when ((cast(`cn`.`created_at` as date) >= (curdate() - interval 30 day)) and (`cn`.`note_type` in ('Diagnosis','Treatment'))) then `cn`.`visit_id` end)) AS `month_count`,count((case when ((cast(`cn`.`created_at` as date) = curdate()) and (`cn`.`note_type` = 'Diagnosis')) then 1 end)) AS `secondary_today_count`,count((case when ((cast(`cn`.`created_at` as date) = curdate()) and (`cn`.`note_type` = 'Treatment')) then 1 end)) AS `secondary_week_count` from ((`users` `u` left join `clinical_notes` `cn` on((`u`.`id` = `cn`.`created_by`))) join `user_roles` `ur` on((`u`.`role_id` = `ur`.`id`))) where (lower(replace(`ur`.`role_name`,' ','_')) = 'doctor') group by `u`.`id` union all select 'social_worker' AS `user_role`,`u`.`id` AS `user_id`,'counseling' AS `metric_type`,count(distinct (case when ((cast(`cn`.`created_at` as date) = curdate()) and (`cn`.`note_type` in ('Counseling','Referral'))) then `cn`.`visit_id` end)) AS `today_count`,count(distinct (case when ((cast(`cn`.`created_at` as date) >= (curdate() - interval 7 day)) and (`cn`.`note_type` in ('Counseling','Referral'))) then `cn`.`visit_id` end)) AS `week_count`,count(distinct (case when ((cast(`cn`.`created_at` as date) >= (curdate() - interval 30 day)) and (`cn`.`note_type` in ('Counseling','Referral'))) then `cn`.`visit_id` end)) AS `month_count`,count((case when (cast(`r`.`created_at` as date) = curdate()) then 1 end)) AS `secondary_today_count`,count((case when (cast(`r`.`created_at` as date) >= (curdate() - interval 7 day)) then 1 end)) AS `secondary_week_count` from (((`users` `u` left join `clinical_notes` `cn` on((`u`.`id` = `cn`.`created_by`))) left join `referrals` `r` on((`u`.`id` = `r`.`created_by`))) join `user_roles` `ur` on((`u`.`role_id` = `ur`.`id`))) where (lower(replace(`ur`.`role_name`,' ','_')) = 'social_worker') group by `u`.`id`;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;


-- VIEW 15/18: v_route_schedule
-- ----------------------------------------------------------------------

DROP VIEW IF EXISTS `v_route_schedule`;
/*!50001 DROP VIEW IF EXISTS `v_route_schedule`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_route_schedule` AS select `r`.`id` AS `route_id`,`r`.`route_name` AS `route_name`,`r`.`province` AS `province`,`r`.`route_type` AS `route_type`,`rl`.`visit_date` AS `visit_date`,`l`.`location_name` AS `location_name`,`l`.`city` AS `city`,`lt`.`type_name` AS `location_type`,`rl`.`start_time` AS `start_time`,`rl`.`end_time` AS `end_time`,`rl`.`max_appointments` AS `max_appointments`,count(`a`.`id`) AS `total_slots`,count((case when (`a`.`status` = 'Booked') then 1 end)) AS `booked_slots`,count((case when (`a`.`status` = 'Available') then 1 end)) AS `available_slots`,round(((count((case when (`a`.`status` = 'Booked') then 1 end)) / count(`a`.`id`)) * 100),1) AS `booking_percentage` from ((((`routes` `r` join `route_locations` `rl` on((`r`.`id` = `rl`.`route_id`))) join `locations` `l` on((`rl`.`location_id` = `l`.`id`))) join `location_types` `lt` on((`l`.`location_type_id` = `lt`.`id`))) left join `appointments` `a` on((`rl`.`id` = `a`.`route_location_id`))) where (`r`.`is_active` = true) group by `r`.`id`,`rl`.`id` order by `rl`.`visit_date`,`rl`.`start_time`;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;


-- VIEW 16/18: v_user_activity_summary
-- ----------------------------------------------------------------------

DROP VIEW IF EXISTS `v_user_activity_summary`;
/*!50001 DROP VIEW IF EXISTS `v_user_activity_summary`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_user_activity_summary` AS select `u`.`id` AS `user_id`,`u`.`username` AS `username`,concat(`u`.`first_name`,' ',`u`.`last_name`) AS `full_name`,`ur`.`role_name` AS `role_name`,count(distinct cast(`al`.`created_at` as date)) AS `active_days_last_30`,count(distinct (case when (`al`.`action` in ('INSERT','UPDATE')) then cast(`al`.`created_at` as date) end)) AS `productive_days_last_30`,count(distinct (case when (`pv`.`created_by` = `u`.`id`) then `pv`.`id` end)) AS `visits_created_last_30`,count(distinct (case when ((`vwp`.`assigned_user_id` = `u`.`id`) and (`vwp`.`completed_at` is not null)) then `vwp`.`id` end)) AS `workflow_stages_completed_last_30`,max(`al`.`created_at`) AS `last_activity`,(to_days(curdate()) - to_days(cast(max(`al`.`created_at`) as date))) AS `days_since_last_activity` from ((((`users` `u` join `user_roles` `ur` on((`u`.`role_id` = `ur`.`id`))) left join `audit_log` `al` on(((`u`.`id` = `al`.`user_id`) and (`al`.`created_at` >= (curdate() - interval 30 day))))) left join `patient_visits` `pv` on(((`u`.`id` = `pv`.`created_by`) and (`pv`.`visit_date` >= (curdate() - interval 30 day))))) left join `visit_workflow_progress` `vwp` on(((`u`.`id` = `vwp`.`assigned_user_id`) and (`vwp`.`completed_at` >= (curdate() - interval 30 day))))) where (`u`.`is_active` = true) group by `u`.`id` order by `active_days_last_30` desc;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;


-- VIEW 17/18: v_user_recent_activity
-- ----------------------------------------------------------------------

DROP VIEW IF EXISTS `v_user_recent_activity`;
/*!50001 DROP VIEW IF EXISTS `v_user_recent_activity`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_user_recent_activity` AS select `al`.`id` AS `id`,`al`.`user_id` AS `user_id`,`al`.`action` AS `action`,`al`.`table_name` AS `table_name`,`al`.`created_at` AS `created_at`,(case when (`al`.`table_name` = 'patients') then 'patient' when (`al`.`table_name` = 'appointments') then 'appointment' when (`al`.`table_name` in ('inventory_usage','inventory_stock')) then 'inventory' when (`al`.`table_name` = 'routes') then 'route' else 'system' end) AS `activity_type`,(case when (`al`.`action` = 'INSERT') then concat('Created new ',(case `al`.`table_name` when 'patients' then 'patient record' when 'appointments' then 'appointment' when 'routes' then 'clinic route' when 'clinical_notes' then 'clinical note' else replace(`al`.`table_name`,'_',' ') end)) when (`al`.`action` = 'UPDATE') then concat('Updated ',(case `al`.`table_name` when 'patients' then 'patient information' when 'appointments' then 'appointment details' when 'routes' then 'route information' when 'clinical_notes' then 'clinical notes' else replace(`al`.`table_name`,'_',' ') end)) else concat(`al`.`action`,' ',replace(`al`.`table_name`,'_',' ')) end) AS `description`,'completed' AS `status` from `audit_log` `al` where (`al`.`created_at` >= (curdate() - interval 7 day)) order by `al`.`created_at` desc;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;


-- VIEW 18/18: v_workflow_progress
-- ----------------------------------------------------------------------

DROP VIEW IF EXISTS `v_workflow_progress`;
/*!50001 DROP VIEW IF EXISTS `v_workflow_progress`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_workflow_progress` AS select `pv`.`id` AS `visit_id`,`p`.`first_name` AS `first_name`,`p`.`last_name` AS `last_name`,`pv`.`visit_date` AS `visit_date`,`ws`.`stage_name` AS `stage_name`,`ws`.`stage_order` AS `stage_order`,`vwp`.`started_at` AS `started_at`,`vwp`.`completed_at` AS `completed_at`,`vwp`.`is_completed` AS `is_completed`,`u`.`first_name` AS `assigned_user_first_name`,`u`.`last_name` AS `assigned_user_last_name`,`ur`.`role_name` AS `assigned_user_role`,(case when (`vwp`.`completed_at` is not null) then 'Completed' when (`vwp`.`started_at` is not null) then 'In Progress' else 'Pending' end) AS `stage_status`,(case when ((`vwp`.`started_at` is not null) and (`vwp`.`completed_at` is null)) then timestampdiff(MINUTE,`vwp`.`started_at`,now()) else NULL end) AS `minutes_in_stage` from (((((`patient_visits` `pv` join `patients` `p` on((`pv`.`patient_id` = `p`.`id`))) join `visit_workflow_progress` `vwp` on((`pv`.`id` = `vwp`.`visit_id`))) join `workflow_stages` `ws` on((`vwp`.`stage_id` = `ws`.`id`))) left join `users` `u` on((`vwp`.`assigned_user_id` = `u`.`id`))) left join `user_roles` `ur` on((`u`.`role_id` = `ur`.`id`))) where (`pv`.`is_completed` = false) order by `pv`.`id`,`ws`.`stage_order`;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;


-- ============================================================================
-- 5. RESTORE SETTINGS
-- ============================================================================

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- ============================================================================
-- DATABASE STATISTICS
-- ============================================================================
-- Total Tables: 44
-- Total Views: 18
-- Generated: 2025-10-17 09:55:52
-- ============================================================================
