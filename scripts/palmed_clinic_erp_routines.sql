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
-- Temporary view structure for view `v_user_activity_summary`
--

DROP TABLE IF EXISTS `v_user_activity_summary`;
/*!50001 DROP VIEW IF EXISTS `v_user_activity_summary`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_user_activity_summary` AS SELECT 
 1 AS `user_id`,
 1 AS `username`,
 1 AS `full_name`,
 1 AS `role_name`,
 1 AS `activity_count`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_pending_approvals`
--

DROP TABLE IF EXISTS `v_pending_approvals`;
/*!50001 DROP VIEW IF EXISTS `v_pending_approvals`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_pending_approvals` AS SELECT 
 1 AS `id`,
 1 AS `username`,
 1 AS `email`,
 1 AS `first_name`,
 1 AS `last_name`,
 1 AS `mp_number`,
 1 AS `requires_approval`,
 1 AS `is_active`,
 1 AS `approved_by`,
 1 AS `approved_at`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_patient_summary`
--

DROP TABLE IF EXISTS `v_patient_summary`;
/*!50001 DROP VIEW IF EXISTS `v_patient_summary`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_patient_summary` AS SELECT 
 1 AS `id`,
 1 AS `medical_aid_number`,
 1 AS `first_name`,
 1 AS `last_name`,
 1 AS `date_of_birth`,
 1 AS `gender`,
 1 AS `total_visits`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_route_schedule`
--

DROP TABLE IF EXISTS `v_route_schedule`;
/*!50001 DROP VIEW IF EXISTS `v_route_schedule`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_route_schedule` AS SELECT 
 1 AS `route_id`,
 1 AS `route_name`,
 1 AS `province`,
 1 AS `route_type`,
 1 AS `visit_date`,
 1 AS `location_name`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_inventory_stats`
--

DROP TABLE IF EXISTS `v_inventory_stats`;
/*!50001 DROP VIEW IF EXISTS `v_inventory_stats`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_inventory_stats` AS SELECT 
 1 AS `period`,
 1 AS `expiring_items_30d`,
 1 AS `usage_events`,
 1 AS `qty_used`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_expiring_inventory`
--

DROP TABLE IF EXISTS `v_expiring_inventory`;
/*!50001 DROP VIEW IF EXISTS `v_expiring_inventory`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_expiring_inventory` AS SELECT 
 1 AS `stock_id`,
 1 AS `item_code`,
 1 AS `item_name`,
 1 AS `category_name`,
 1 AS `batch_number`,
 1 AS `expiry_date`,
 1 AS `quantity`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_user_recent_activity`
--

DROP TABLE IF EXISTS `v_user_recent_activity`;
/*!50001 DROP VIEW IF EXISTS `v_user_recent_activity`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_user_recent_activity` AS SELECT 
 1 AS `id`,
 1 AS `user_id`,
 1 AS `action`,
 1 AS `table_name`,
 1 AS `created_at`,
 1 AS `activity_status`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_daily_operations_summary`
--

DROP TABLE IF EXISTS `v_daily_operations_summary`;
/*!50001 DROP VIEW IF EXISTS `v_daily_operations_summary`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_daily_operations_summary` AS SELECT 
 1 AS `report_date`,
 1 AS `total_visits`,
 1 AS `unique_patients`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_role_dashboard_metrics`
--

DROP TABLE IF EXISTS `v_role_dashboard_metrics`;
/*!50001 DROP VIEW IF EXISTS `v_role_dashboard_metrics`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_role_dashboard_metrics` AS SELECT 
 1 AS `user_role`,
 1 AS `user_id`,
 1 AS `metric_type`,
 1 AS `today_count`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_workflow_progress`
--

DROP TABLE IF EXISTS `v_workflow_progress`;
/*!50001 DROP VIEW IF EXISTS `v_workflow_progress`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_workflow_progress` AS SELECT 
 1 AS `visit_id`,
 1 AS `first_name`,
 1 AS `last_name`,
 1 AS `visit_date`,
 1 AS `stage_name`,
 1 AS `workflow_status`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_inventory_usage_analytics`
--

DROP TABLE IF EXISTS `v_inventory_usage_analytics`;
/*!50001 DROP VIEW IF EXISTS `v_inventory_usage_analytics`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_inventory_usage_analytics` AS SELECT 
 1 AS `item_code`,
 1 AS `item_name`,
 1 AS `category_name`,
 1 AS `usage_month`,
 1 AS `total_used`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_patient_vitals_trends`
--

DROP TABLE IF EXISTS `v_patient_vitals_trends`;
/*!50001 DROP VIEW IF EXISTS `v_patient_vitals_trends`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_patient_vitals_trends` AS SELECT 
 1 AS `patient_id`,
 1 AS `first_name`,
 1 AS `last_name`,
 1 AS `visit_id`,
 1 AS `visit_date`,
 1 AS `vital_type`,
 1 AS `vital_value`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_performance_metrics`
--

DROP TABLE IF EXISTS `v_performance_metrics`;
/*!50001 DROP VIEW IF EXISTS `v_performance_metrics`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_performance_metrics` AS SELECT 
 1 AS `metric`,
 1 AS `value_mb`,
 1 AS `unit`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_inventory_levels`
--

DROP TABLE IF EXISTS `v_inventory_levels`;
/*!50001 DROP VIEW IF EXISTS `v_inventory_levels`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_inventory_levels` AS SELECT 
 1 AS `consumable_id`,
 1 AS `item_code`,
 1 AS `item_name`,
 1 AS `category_name`,
 1 AS `unit_of_measure`,
 1 AS `current_stock`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_asset_maintenance_schedule`
--

DROP TABLE IF EXISTS `v_asset_maintenance_schedule`;
/*!50001 DROP VIEW IF EXISTS `v_asset_maintenance_schedule`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_asset_maintenance_schedule` AS SELECT 
 1 AS `asset_id`,
 1 AS `asset_tag`,
 1 AS `asset_name`,
 1 AS `category_name`,
 1 AS `manufacturer`,
 1 AS `purchase_date`,
 1 AS `last_maintenance_date`,
 1 AS `next_maintenance_date`,
 1 AS `status`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_monthly_performance`
--

DROP TABLE IF EXISTS `v_monthly_performance`;
/*!50001 DROP VIEW IF EXISTS `v_monthly_performance`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_monthly_performance` AS SELECT 
 1 AS `month_year`,
 1 AS `total_visits`,
 1 AS `unique_patients`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_active_users`
--

DROP TABLE IF EXISTS `v_active_users`;
/*!50001 DROP VIEW IF EXISTS `v_active_users`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_active_users` AS SELECT 
 1 AS `id`,
 1 AS `username`,
 1 AS `email`,
 1 AS `password_hash`,
 1 AS `role_id`,
 1 AS `first_name`,
 1 AS `last_name`,
 1 AS `phone_number`,
 1 AS `mp_number`,
 1 AS `geographic_restrictions`,
 1 AS `is_active`,
 1 AS `requires_approval`,
 1 AS `approved_by`,
 1 AS `approved_at`,
 1 AS `last_login`,
 1 AS `created_at`,
 1 AS `updated_at`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_daily_clinic_capacity`
--

DROP TABLE IF EXISTS `v_daily_clinic_capacity`;
/*!50001 DROP VIEW IF EXISTS `v_daily_clinic_capacity`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_daily_clinic_capacity` AS SELECT 
 1 AS `visit_date`,
 1 AS `location`,
 1 AS `total_visits`,
 1 AS `completed_visits`,
 1 AS `pending_visits`,
 1 AS `completion_rate`,
 1 AS `unique_patients`,
 1 AS `staff_count`*/;
SET character_set_client = @saved_cs_client;

--
-- Final view structure for view `v_user_activity_summary`
--

/*!50001 DROP VIEW IF EXISTS `v_user_activity_summary`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`dbadmin`@`%` SQL SECURITY INVOKER */
/*!50001 VIEW `v_user_activity_summary` AS select `u`.`id` AS `user_id`,`u`.`username` AS `username`,concat(`u`.`first_name`,' ',`u`.`last_name`) AS `full_name`,`ur`.`role_name` AS `role_name`,count(distinct `al`.`id`) AS `activity_count` from ((`users` `u` join `user_roles` `ur` on((`u`.`role_id` = `ur`.`id`))) left join `audit_log` `al` on((`u`.`id` = `al`.`user_id`))) group by `u`.`id`,`u`.`username`,`ur`.`role_name` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_pending_approvals`
--

/*!50001 DROP VIEW IF EXISTS `v_pending_approvals`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`dbadmin`@`%` SQL SECURITY INVOKER */
/*!50001 VIEW `v_pending_approvals` AS select `u`.`id` AS `id`,`u`.`username` AS `username`,`u`.`email` AS `email`,`u`.`first_name` AS `first_name`,`u`.`last_name` AS `last_name`,`u`.`mp_number` AS `mp_number`,`u`.`requires_approval` AS `requires_approval`,`u`.`is_active` AS `is_active`,`u`.`approved_by` AS `approved_by`,`u`.`approved_at` AS `approved_at` from `users` `u` where ((`u`.`requires_approval` = 1) and (`u`.`approved_by` is null)) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_patient_summary`
--

/*!50001 DROP VIEW IF EXISTS `v_patient_summary`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`dbadmin`@`%` SQL SECURITY INVOKER */
/*!50001 VIEW `v_patient_summary` AS select `p`.`id` AS `id`,`p`.`medical_aid_number` AS `medical_aid_number`,`p`.`first_name` AS `first_name`,`p`.`last_name` AS `last_name`,`p`.`date_of_birth` AS `date_of_birth`,`p`.`gender` AS `gender`,count(`pv`.`id`) AS `total_visits` from (`patients` `p` left join `patient_visits` `pv` on((`p`.`id` = `pv`.`patient_id`))) group by `p`.`id`,`p`.`medical_aid_number`,`p`.`first_name`,`p`.`last_name`,`p`.`date_of_birth`,`p`.`gender` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_route_schedule`
--

/*!50001 DROP VIEW IF EXISTS `v_route_schedule`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`dbadmin`@`%` SQL SECURITY INVOKER */
/*!50001 VIEW `v_route_schedule` AS select `r`.`id` AS `route_id`,`r`.`route_name` AS `route_name`,`r`.`province` AS `province`,`r`.`route_type` AS `route_type`,`rl`.`visit_date` AS `visit_date`,`l`.`location_name` AS `location_name` from ((`routes` `r` join `route_locations` `rl` on((`r`.`id` = `rl`.`route_id`))) join `locations` `l` on((`rl`.`location_id` = `l`.`id`))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_inventory_stats`
--

/*!50001 DROP VIEW IF EXISTS `v_inventory_stats`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`dbadmin`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `v_inventory_stats` AS select 'today' AS `period`,(select count(0) from `inventory_stock` where ((`inventory_stock`.`status` = 'Active') and (`inventory_stock`.`expiry_date` <= (curdate() + interval 30 day)))) AS `expiring_items_30d`,(select count(0) from `inventory_usage` where (`inventory_usage`.`usage_date` = curdate())) AS `usage_events`,(select coalesce(sum(`inventory_usage`.`quantity_used`),0) from `inventory_usage` where (`inventory_usage`.`usage_date` = curdate())) AS `qty_used` union all select 'week' AS `week`,(select count(0) from `inventory_stock` where ((`inventory_stock`.`status` = 'Active') and (`inventory_stock`.`expiry_date` <= (curdate() + interval 30 day)))) AS `Name_exp_6`,(select count(0) from `inventory_usage` where (`inventory_usage`.`usage_date` >= (curdate() - interval 7 day))) AS `Name_exp_7`,(select coalesce(sum(`inventory_usage`.`quantity_used`),0) from `inventory_usage` where (`inventory_usage`.`usage_date` >= (curdate() - interval 7 day))) AS `Name_exp_8` union all select 'month' AS `month`,(select count(0) from `inventory_stock` where ((`inventory_stock`.`status` = 'Active') and (`inventory_stock`.`expiry_date` <= (curdate() + interval 30 day)))) AS `Name_exp_10`,(select count(0) from `inventory_usage` where (`inventory_usage`.`usage_date` >= (curdate() - interval 30 day))) AS `Name_exp_11`,(select coalesce(sum(`inventory_usage`.`quantity_used`),0) from `inventory_usage` where (`inventory_usage`.`usage_date` >= (curdate() - interval 30 day))) AS `Name_exp_12` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_expiring_inventory`
--

/*!50001 DROP VIEW IF EXISTS `v_expiring_inventory`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`dbadmin`@`%` SQL SECURITY INVOKER */
/*!50001 VIEW `v_expiring_inventory` AS select `ist`.`id` AS `stock_id`,`c`.`item_code` AS `item_code`,`c`.`item_name` AS `item_name`,`cc`.`category_name` AS `category_name`,`ist`.`batch_number` AS `batch_number`,`ist`.`expiry_date` AS `expiry_date`,`ist`.`quantity_current` AS `quantity` from ((`inventory_stock` `ist` join `consumables` `c` on((`ist`.`consumable_id` = `c`.`id`))) join `consumable_categories` `cc` on((`c`.`category_id` = `cc`.`id`))) where (`ist`.`expiry_date` <= (curdate() + interval 30 day)) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_user_recent_activity`
--

/*!50001 DROP VIEW IF EXISTS `v_user_recent_activity`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`dbadmin`@`%` SQL SECURITY INVOKER */
/*!50001 VIEW `v_user_recent_activity` AS select `al`.`id` AS `id`,`al`.`user_id` AS `user_id`,`al`.`action` AS `action`,`al`.`table_name` AS `table_name`,`al`.`created_at` AS `created_at`,(case when (`al`.`created_at` >= (now() - interval 7 day)) then 'Recent' else 'Older' end) AS `activity_status` from `audit_log` `al` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_daily_operations_summary`
--

/*!50001 DROP VIEW IF EXISTS `v_daily_operations_summary`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`dbadmin`@`%` SQL SECURITY INVOKER */
/*!50001 VIEW `v_daily_operations_summary` AS select curdate() AS `report_date`,count(distinct `pv`.`id`) AS `total_visits`,count(distinct `pv`.`patient_id`) AS `unique_patients` from `patient_visits` `pv` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_role_dashboard_metrics`
--

/*!50001 DROP VIEW IF EXISTS `v_role_dashboard_metrics`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`dbadmin`@`%` SQL SECURITY INVOKER */
/*!50001 VIEW `v_role_dashboard_metrics` AS select 'clerk' AS `user_role`,`u`.`id` AS `user_id`,'registrations' AS `metric_type`,count((case when (cast(`p`.`created_at` as date) = curdate()) then 1 end)) AS `today_count` from (`users` `u` join `patients` `p` on((`u`.`id` = `p`.`created_by`))) group by `u`.`id` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_workflow_progress`
--

/*!50001 DROP VIEW IF EXISTS `v_workflow_progress`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`dbadmin`@`%` SQL SECURITY INVOKER */
/*!50001 VIEW `v_workflow_progress` AS select `pv`.`id` AS `visit_id`,`p`.`first_name` AS `first_name`,`p`.`last_name` AS `last_name`,`pv`.`visit_date` AS `visit_date`,`ws`.`stage_name` AS `stage_name`,`vwp`.`is_completed` AS `workflow_status` from (((`patient_visits` `pv` join `patients` `p` on((`pv`.`patient_id` = `p`.`id`))) join `visit_workflow_progress` `vwp` on((`pv`.`id` = `vwp`.`visit_id`))) join `workflow_stages` `ws` on((`vwp`.`stage_id` = `ws`.`id`))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_inventory_usage_analytics`
--

/*!50001 DROP VIEW IF EXISTS `v_inventory_usage_analytics`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`dbadmin`@`%` SQL SECURITY INVOKER */
/*!50001 VIEW `v_inventory_usage_analytics` AS select `c`.`item_code` AS `item_code`,`c`.`item_name` AS `item_name`,`cc`.`category_name` AS `category_name`,date_format(`iu`.`usage_date`,'%Y-%m') AS `usage_month`,sum(`iu`.`quantity_used`) AS `total_used` from (((`inventory_usage` `iu` join `inventory_stock` `ist` on((`iu`.`stock_id` = `ist`.`id`))) join `consumables` `c` on((`ist`.`consumable_id` = `c`.`id`))) join `consumable_categories` `cc` on((`c`.`category_id` = `cc`.`id`))) group by `c`.`item_code`,`c`.`item_name`,`cc`.`category_name`,date_format(`iu`.`usage_date`,'%Y-%m') */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_patient_vitals_trends`
--

/*!50001 DROP VIEW IF EXISTS `v_patient_vitals_trends`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`dbadmin`@`%` SQL SECURITY INVOKER */
/*!50001 VIEW `v_patient_vitals_trends` AS select `p`.`id` AS `patient_id`,`p`.`first_name` AS `first_name`,`p`.`last_name` AS `last_name`,`pv`.`id` AS `visit_id`,`pv`.`visit_date` AS `visit_date`,'systolic_bp' AS `vital_type`,`vs`.`systolic_bp` AS `vital_value` from ((`patients` `p` join `patient_visits` `pv` on((`p`.`id` = `pv`.`patient_id`))) join `vital_signs` `vs` on((`pv`.`id` = `vs`.`visit_id`))) where (`vs`.`systolic_bp` is not null) union all select `p`.`id` AS `id`,`p`.`first_name` AS `first_name`,`p`.`last_name` AS `last_name`,`pv`.`id` AS `id`,`pv`.`visit_date` AS `visit_date`,'diastolic_bp' AS `diastolic_bp`,`vs`.`diastolic_bp` AS `diastolic_bp` from ((`patients` `p` join `patient_visits` `pv` on((`p`.`id` = `pv`.`patient_id`))) join `vital_signs` `vs` on((`pv`.`id` = `vs`.`visit_id`))) where (`vs`.`diastolic_bp` is not null) union all select `p`.`id` AS `id`,`p`.`first_name` AS `first_name`,`p`.`last_name` AS `last_name`,`pv`.`id` AS `id`,`pv`.`visit_date` AS `visit_date`,'heart_rate' AS `heart_rate`,`vs`.`heart_rate` AS `heart_rate` from ((`patients` `p` join `patient_visits` `pv` on((`p`.`id` = `pv`.`patient_id`))) join `vital_signs` `vs` on((`pv`.`id` = `vs`.`visit_id`))) where (`vs`.`heart_rate` is not null) union all select `p`.`id` AS `id`,`p`.`first_name` AS `first_name`,`p`.`last_name` AS `last_name`,`pv`.`id` AS `id`,`pv`.`visit_date` AS `visit_date`,'temperature' AS `temperature`,`vs`.`temperature` AS `temperature` from ((`patients` `p` join `patient_visits` `pv` on((`p`.`id` = `pv`.`patient_id`))) join `vital_signs` `vs` on((`pv`.`id` = `vs`.`visit_id`))) where (`vs`.`temperature` is not null) union all select `p`.`id` AS `id`,`p`.`first_name` AS `first_name`,`p`.`last_name` AS `last_name`,`pv`.`id` AS `id`,`pv`.`visit_date` AS `visit_date`,'weight' AS `weight`,`vs`.`weight` AS `weight` from ((`patients` `p` join `patient_visits` `pv` on((`p`.`id` = `pv`.`patient_id`))) join `vital_signs` `vs` on((`pv`.`id` = `vs`.`visit_id`))) where (`vs`.`weight` is not null) union all select `p`.`id` AS `id`,`p`.`first_name` AS `first_name`,`p`.`last_name` AS `last_name`,`pv`.`id` AS `id`,`pv`.`visit_date` AS `visit_date`,'height' AS `height`,`vs`.`height` AS `height` from ((`patients` `p` join `patient_visits` `pv` on((`p`.`id` = `pv`.`patient_id`))) join `vital_signs` `vs` on((`pv`.`id` = `vs`.`visit_id`))) where (`vs`.`height` is not null) union all select `p`.`id` AS `id`,`p`.`first_name` AS `first_name`,`p`.`last_name` AS `last_name`,`pv`.`id` AS `id`,`pv`.`visit_date` AS `visit_date`,'oxygen_saturation' AS `oxygen_saturation`,`vs`.`oxygen_saturation` AS `oxygen_saturation` from ((`patients` `p` join `patient_visits` `pv` on((`p`.`id` = `pv`.`patient_id`))) join `vital_signs` `vs` on((`pv`.`id` = `vs`.`visit_id`))) where (`vs`.`oxygen_saturation` is not null) union all select `p`.`id` AS `id`,`p`.`first_name` AS `first_name`,`p`.`last_name` AS `last_name`,`pv`.`id` AS `id`,`pv`.`visit_date` AS `visit_date`,'blood_glucose' AS `blood_glucose`,`vs`.`blood_glucose` AS `blood_glucose` from ((`patients` `p` join `patient_visits` `pv` on((`p`.`id` = `pv`.`patient_id`))) join `vital_signs` `vs` on((`pv`.`id` = `vs`.`visit_id`))) where (`vs`.`blood_glucose` is not null) union all select `p`.`id` AS `id`,`p`.`first_name` AS `first_name`,`p`.`last_name` AS `last_name`,`pv`.`id` AS `id`,`pv`.`visit_date` AS `visit_date`,'bmi' AS `bmi`,`vs`.`bmi` AS `bmi` from ((`patients` `p` join `patient_visits` `pv` on((`p`.`id` = `pv`.`patient_id`))) join `vital_signs` `vs` on((`pv`.`id` = `vs`.`visit_id`))) where (`vs`.`bmi` is not null) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_performance_metrics`
--

/*!50001 DROP VIEW IF EXISTS `v_performance_metrics`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`dbadmin`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `v_performance_metrics` AS select 'Database Size' AS `metric`,round(((sum((`information_schema`.`tables`.`DATA_LENGTH` + `information_schema`.`tables`.`INDEX_LENGTH`)) / 1024) / 1024),2) AS `value_mb`,'MB' AS `unit` from `information_schema`.`TABLES` where (`information_schema`.`tables`.`TABLE_SCHEMA` = database()) union all select 'Total Records' AS `Total Records`,sum(`information_schema`.`tables`.`TABLE_ROWS`) AS `SUM(table_rows)`,'rows' AS `rows` from `information_schema`.`TABLES` where (`information_schema`.`tables`.`TABLE_SCHEMA` = database()) union all select 'Active Patients' AS `Active Patients`,count(0) AS `COUNT(*)`,'patients' AS `patients` from `patients` where (`patients`.`created_at` >= (curdate() - interval 1 year)) union all select 'Monthly Visits' AS `Monthly Visits`,count(0) AS `COUNT(*)`,'visits' AS `visits` from `patient_visits` where (`patient_visits`.`visit_date` >= (curdate() - interval 30 day)) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_inventory_levels`
--

/*!50001 DROP VIEW IF EXISTS `v_inventory_levels`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`dbadmin`@`%` SQL SECURITY INVOKER */
/*!50001 VIEW `v_inventory_levels` AS select `c`.`id` AS `consumable_id`,`c`.`item_code` AS `item_code`,`c`.`item_name` AS `item_name`,`cc`.`category_name` AS `category_name`,`c`.`unit_of_measure` AS `unit_of_measure`,coalesce(sum(`ist`.`quantity_current`),0) AS `current_stock` from ((`consumables` `c` join `consumable_categories` `cc` on((`c`.`category_id` = `cc`.`id`))) left join `inventory_stock` `ist` on((`ist`.`consumable_id` = `c`.`id`))) group by `c`.`id`,`c`.`item_code`,`c`.`item_name`,`cc`.`category_name`,`c`.`unit_of_measure` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_asset_maintenance_schedule`
--

/*!50001 DROP VIEW IF EXISTS `v_asset_maintenance_schedule`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`dbadmin`@`%` SQL SECURITY INVOKER */
/*!50001 VIEW `v_asset_maintenance_schedule` AS select `a`.`id` AS `asset_id`,`a`.`asset_tag` AS `asset_tag`,`a`.`asset_name` AS `asset_name`,`ac`.`category_name` AS `category_name`,`a`.`manufacturer` AS `manufacturer`,`a`.`purchase_date` AS `purchase_date`,`a`.`last_maintenance_date` AS `last_maintenance_date`,`a`.`next_maintenance_date` AS `next_maintenance_date`,`a`.`status` AS `status` from (`assets` `a` join `asset_categories` `ac` on((`a`.`category_id` = `ac`.`id`))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_monthly_performance`
--

/*!50001 DROP VIEW IF EXISTS `v_monthly_performance`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`dbadmin`@`%` SQL SECURITY INVOKER */
/*!50001 VIEW `v_monthly_performance` AS select date_format(`pv`.`visit_date`,'%Y-%m') AS `month_year`,count(distinct `pv`.`id`) AS `total_visits`,count(distinct `pv`.`patient_id`) AS `unique_patients` from `patient_visits` `pv` where (`pv`.`visit_date` is not null) group by date_format(`pv`.`visit_date`,'%Y-%m') */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_active_users`
--

/*!50001 DROP VIEW IF EXISTS `v_active_users`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`dbadmin`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `v_active_users` AS select `users`.`id` AS `id`,`users`.`username` AS `username`,`users`.`email` AS `email`,`users`.`password_hash` AS `password_hash`,`users`.`role_id` AS `role_id`,`users`.`first_name` AS `first_name`,`users`.`last_name` AS `last_name`,`users`.`phone_number` AS `phone_number`,`users`.`mp_number` AS `mp_number`,`users`.`geographic_restrictions` AS `geographic_restrictions`,`users`.`is_active` AS `is_active`,`users`.`requires_approval` AS `requires_approval`,`users`.`approved_by` AS `approved_by`,`users`.`approved_at` AS `approved_at`,`users`.`last_login` AS `last_login`,`users`.`created_at` AS `created_at`,`users`.`updated_at` AS `updated_at` from `users` where (`users`.`is_active` = 1) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_daily_clinic_capacity`
--

/*!50001 DROP VIEW IF EXISTS `v_daily_clinic_capacity`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`dbadmin`@`%` SQL SECURITY INVOKER */
/*!50001 VIEW `v_daily_clinic_capacity` AS select `pv`.`visit_date` AS `visit_date`,`pv`.`location` AS `location`,count(distinct `pv`.`id`) AS `total_visits`,count((case when (`pv`.`is_completed` = 1) then 1 end)) AS `completed_visits`,count((case when (`pv`.`is_completed` = 0) then 1 end)) AS `pending_visits`,round(((count((case when (`pv`.`is_completed` = 1) then 1 end)) / count(0)) * 100),1) AS `completion_rate`,count(distinct `pv`.`patient_id`) AS `unique_patients`,count(distinct `pv`.`created_by`) AS `staff_count` from `patient_visits` `pv` group by `pv`.`visit_date`,`pv`.`location` order by `pv`.`visit_date` desc */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-17 17:17:58
