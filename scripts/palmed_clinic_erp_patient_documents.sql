-- MySQL dump 10.13  Distrib 8.0.42, for Win64 (x86_64)
--
-- Host: db-polmed.mysql.database.azure.com    Database: palmed_clinic_erp
-- ------------------------------------------------------
-- Server version	8.0.42-azure

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `patient_documents`
--

DROP TABLE IF EXISTS `patient_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `patient_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int NOT NULL,
  `visit_id` int DEFAULT NULL,
  `document_name` varchar(255) NOT NULL,
  `document_type` enum('lab_report','prescription','medical_certificate','referral','invoice','other') DEFAULT 'other',
  `file_path` varchar(500) DEFAULT NULL,
  `file_size_bytes` int DEFAULT NULL,
  `mime_type` varchar(100) DEFAULT NULL,
  `is_patient_accessible` tinyint(1) DEFAULT '1',
  `uploaded_by` int DEFAULT NULL,
  `specialist_type` varchar(100) DEFAULT NULL COMMENT 'Clinical specialist context (dentist, optometrist, etc)',
  `workflow_step` varchar(100) DEFAULT NULL COMMENT 'Workflow stage identifier (e.g. dentist, audiology_assessment)',
  `tags` text COMMENT 'Optional JSON array of descriptive tags',
  `notes` text,
  `upload_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `visit_id` (`visit_id`),
  KEY `idx_patient_documents_patient` (`patient_id`),
  KEY `idx_patient_documents_type` (`document_type`),
  KEY `idx_patient_documents_specialist` (`specialist_type`),
  KEY `idx_patient_documents_workflow` (`workflow_step`),
  KEY `idx_patient_documents_accessible` (`is_patient_accessible`),
  CONSTRAINT `patient_documents_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `patient_documents_ibfk_2` FOREIGN KEY (`visit_id`) REFERENCES `patient_visits` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-17 17:16:48
