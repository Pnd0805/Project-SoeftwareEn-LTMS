
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
DROP TABLE IF EXISTS `admin_scopes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_scopes` (
  `admin_scope_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `scope_type` enum('faculty','university_wide','root') NOT NULL,
  `faculty_id` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` int DEFAULT NULL,
  `root_singleton` tinyint GENERATED ALWAYS AS (if((`scope_type` = _utf8mb4'root'),1,NULL)) STORED,
  PRIMARY KEY (`admin_scope_id`),
  UNIQUE KEY `uq_admin_scopes_single_root` (`root_singleton`),
  KEY `user_id` (`user_id`),
  KEY `faculty_id` (`faculty_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `admin_scopes_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `admin_scopes_ibfk_2` FOREIGN KEY (`faculty_id`) REFERENCES `faculties` (`faculty_id`),
  CONSTRAINT `admin_scopes_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `admin_scopes` WRITE;
/*!40000 ALTER TABLE `admin_scopes` DISABLE KEYS */;
INSERT INTO `admin_scopes` (`admin_scope_id`, `user_id`, `scope_type`, `faculty_id`, `created_at`, `created_by`) VALUES (1,1,'root',NULL,'2026-08-29 15:44:56',NULL),(2,2,'university_wide',NULL,'2026-08-29 15:44:56',1),(3,3,'faculty',1,'2026-09-08 15:44:56',2),(4,4,'faculty',2,'2026-09-08 15:44:56',2);
/*!40000 ALTER TABLE `admin_scopes` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `announcements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `announcements` (
  `announcement_id` int NOT NULL AUTO_INCREMENT,
  `tournament_id` int NOT NULL,
  `match_id` int DEFAULT NULL,
  `created_by` int NOT NULL,
  `announcement_type` enum('general','schedule_change','venue_change','result','livestream') NOT NULL,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int DEFAULT NULL,
  PRIMARY KEY (`announcement_id`),
  KEY `tournament_id` (`tournament_id`),
  KEY `match_id` (`match_id`),
  KEY `created_by` (`created_by`),
  KEY `updated_by` (`updated_by`),
  KEY `deleted_by` (`deleted_by`),
  CONSTRAINT `announcements_ibfk_1` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`tournament_id`),
  CONSTRAINT `announcements_ibfk_2` FOREIGN KEY (`match_id`) REFERENCES `matches` (`match_id`),
  CONSTRAINT `announcements_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `announcements_ibfk_4` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `announcements_ibfk_5` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `announcements` WRITE;
/*!40000 ALTER TABLE `announcements` DISABLE KEYS */;
INSERT INTO `announcements` VALUES (1,8,NULL,12,'result','ผลรอบรองชนะเลิศคู่แรก','Econ Rackets ชนะ มนุษย์ลูกขนไก่ 2–1 เข้ารอบชิงชนะเลิศ','2026-10-08 15:45:19',NULL,NULL,NULL,NULL),(2,8,NULL,12,'venue_change','ย้ายสนามรอบชิง','รอบชิงชนะเลิศย้ายไปแข่งที่โรงยิม 1 คอร์ตกลาง','2026-10-08 15:45:19',NULL,NULL,NULL,NULL),(3,7,NULL,11,'schedule_change','ตารางแข่งวันชิงแชมป์','รอบรองชนะเลิศเริ่ม 13:20 น. ที่โรงยิม 1 คอร์ตกลาง กรุณามาเช็คอินก่อนเวลา 30 นาที','2026-10-08 15:45:24',NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `announcements` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `application_players`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `application_players` (
  `application_player_id` int NOT NULL AUTO_INCREMENT,
  `tournament_application_id` int NOT NULL,
  `tournament_id` int NOT NULL,
  `user_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`application_player_id`),
  UNIQUE KEY `uq_tournament_player` (`tournament_id`,`user_id`),
  UNIQUE KEY `uq_application_player` (`tournament_application_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `application_players_ibfk_1` FOREIGN KEY (`tournament_application_id`) REFERENCES `tournament_applications` (`tournament_application_id`) ON DELETE CASCADE,
  CONSTRAINT `application_players_ibfk_2` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`tournament_id`),
  CONSTRAINT `application_players_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=56 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `application_players` WRITE;
/*!40000 ALTER TABLE `application_players` DISABLE KEYS */;
INSERT INTO `application_players` VALUES (1,1,5,130,'2026-10-08 15:45:03'),(2,1,5,131,'2026-10-08 15:45:03'),(3,1,5,132,'2026-10-08 15:45:03'),(4,1,5,133,'2026-10-08 15:45:03'),(5,1,5,134,'2026-10-08 15:45:03'),(6,2,6,105,'2026-10-08 15:45:03'),(7,2,6,106,'2026-10-08 15:45:03'),(8,3,6,107,'2026-10-08 15:45:03'),(9,3,6,108,'2026-10-08 15:45:03'),(10,4,6,109,'2026-10-08 15:45:03'),(11,4,6,110,'2026-10-08 15:45:03'),(12,5,6,111,'2026-10-08 15:45:03'),(13,5,6,112,'2026-10-08 15:45:03'),(14,6,7,101,'2026-10-08 15:45:03'),(15,6,7,102,'2026-10-08 15:45:03'),(16,7,7,103,'2026-10-08 15:45:03'),(17,7,7,104,'2026-10-08 15:45:03'),(18,8,7,105,'2026-10-08 15:45:03'),(19,8,7,106,'2026-10-08 15:45:03'),(20,9,7,107,'2026-10-08 15:45:04'),(21,9,7,108,'2026-10-08 15:45:04'),(22,10,8,101,'2026-10-08 15:45:04'),(23,10,8,102,'2026-10-08 15:45:04'),(24,11,8,103,'2026-10-08 15:45:04'),(25,11,8,104,'2026-10-08 15:45:04'),(26,12,8,109,'2026-10-08 15:45:04'),(27,12,8,110,'2026-10-08 15:45:04'),(28,13,8,111,'2026-10-08 15:45:04'),(29,13,8,112,'2026-10-08 15:45:04'),(30,14,9,105,'2026-10-08 15:45:04'),(31,14,9,106,'2026-10-08 15:45:04'),(32,15,9,107,'2026-10-08 15:45:04'),(33,15,9,108,'2026-10-08 15:45:04'),(34,16,9,109,'2026-10-08 15:45:04'),(35,16,9,110,'2026-10-08 15:45:04'),(36,17,9,111,'2026-10-08 15:45:04'),(37,17,9,112,'2026-10-08 15:45:04'),(38,18,10,135,'2026-10-08 15:45:04'),(39,18,10,136,'2026-10-08 15:45:04'),(40,18,10,137,'2026-10-08 15:45:04'),(41,18,10,138,'2026-10-08 15:45:04'),(42,18,10,139,'2026-10-08 15:45:04'),(43,19,10,140,'2026-10-08 15:45:04'),(44,19,10,141,'2026-10-08 15:45:04'),(45,19,10,142,'2026-10-08 15:45:04'),(46,19,10,143,'2026-10-08 15:45:04'),(47,19,10,144,'2026-10-08 15:45:04'),(48,20,11,101,'2026-10-08 15:45:04'),(49,20,11,102,'2026-10-08 15:45:04'),(50,21,11,103,'2026-10-08 15:45:04'),(51,21,11,104,'2026-10-08 15:45:04'),(52,22,11,105,'2026-10-08 15:45:04'),(53,22,11,106,'2026-10-08 15:45:04'),(54,23,11,107,'2026-10-08 15:45:04'),(55,23,11,108,'2026-10-08 15:45:04');
/*!40000 ALTER TABLE `application_players` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `audit_log_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `action_type` varchar(100) NOT NULL,
  `entity_type` varchar(50) NOT NULL,
  `entity_id` int NOT NULL,
  `details` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`audit_log_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (1,2,'tournament_approved','tournament',3,'{\"selfApproved\": false}','2026-10-08 15:45:01'),(2,2,'tournament_approved','tournament',4,'{\"selfApproved\": false}','2026-10-08 15:45:01'),(3,2,'tournament_approved','tournament',5,'{\"selfApproved\": false}','2026-10-08 15:45:01'),(4,2,'tournament_approved','tournament',6,'{\"selfApproved\": false}','2026-10-08 15:45:01'),(5,2,'tournament_approved','tournament',7,'{\"selfApproved\": false}','2026-10-08 15:45:01'),(6,2,'tournament_approved','tournament',8,'{\"selfApproved\": false}','2026-10-08 15:45:01'),(7,2,'tournament_approved','tournament',9,'{\"selfApproved\": false}','2026-10-08 15:45:01'),(8,2,'tournament_approved','tournament',10,'{\"selfApproved\": false}','2026-10-08 15:45:01'),(9,2,'tournament_approved','tournament',11,'{\"selfApproved\": false}','2026-10-08 15:45:01'),(10,105,'match_result_verified','match',7,'{\"winnerId\": 3, \"verifiedBy\": 105}','2026-10-08 15:45:11'),(11,109,'match_result_verified','match',8,'{\"winnerId\": 5, \"verifiedBy\": 109}','2026-10-08 15:45:13'),(12,109,'match_result_verified','match',9,'{\"winnerId\": 5, \"verifiedBy\": 109}','2026-10-08 15:45:14'),(13,13,'tournament_completed','tournament',9,'{\"championTeamId\": 5}','2026-10-08 15:45:15'),(14,111,'match_result_verified','match',4,'{\"winnerId\": 6, \"verifiedBy\": 111}','2026-10-08 15:45:17'),(15,107,'match_result_verified','match',11,'{\"winnerId\": 4, \"verifiedBy\": 107}','2026-10-08 15:45:20'),(16,101,'match_result_verified','match',12,'{\"winnerId\": 1, \"verifiedBy\": 101}','2026-10-08 15:45:21'),(17,107,'match_result_verified','match',13,'{\"winnerId\": 4, \"verifiedBy\": 107}','2026-10-08 15:45:23'),(18,2,'user_suspended','user',34,'{\"days\": 30, \"until\": \"2026-11-07T15:45:25.985Z\", \"reason\": \"ส่งข้อความรบกวนซ้ำในช่องความเห็นหลายรายการ\", \"category\": \"spam\"}','2026-10-08 15:45:25');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `bracket_nodes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bracket_nodes` (
  `bracket_node_id` int NOT NULL AUTO_INCREMENT,
  `tournament_id` int NOT NULL,
  `node_code` varchar(30) NOT NULL,
  `bracket_type` enum('winners','losers','grand_final') NOT NULL,
  `round` int DEFAULT NULL,
  `match_number` int NOT NULL,
  `team_a_id` int DEFAULT NULL,
  `team_b_id` int DEFAULT NULL,
  `match_id` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`bracket_node_id`),
  KEY `tournament_id` (`tournament_id`),
  KEY `team_a_id` (`team_a_id`),
  KEY `team_b_id` (`team_b_id`),
  KEY `match_id` (`match_id`),
  CONSTRAINT `bracket_nodes_ibfk_1` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`tournament_id`),
  CONSTRAINT `bracket_nodes_ibfk_2` FOREIGN KEY (`team_a_id`) REFERENCES `teams` (`team_id`),
  CONSTRAINT `bracket_nodes_ibfk_3` FOREIGN KEY (`team_b_id`) REFERENCES `teams` (`team_id`),
  CONSTRAINT `bracket_nodes_ibfk_4` FOREIGN KEY (`match_id`) REFERENCES `matches` (`match_id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `bracket_nodes` WRITE;
/*!40000 ALTER TABLE `bracket_nodes` DISABLE KEYS */;
INSERT INTO `bracket_nodes` VALUES (1,7,'W-R1-M1','winners',1,1,1,2,1,'2026-10-08 15:45:05',NULL),(2,7,'W-R1-M2','winners',1,2,3,4,2,'2026-10-08 15:45:05',NULL),(3,7,'W-R2-M1','winners',2,1,NULL,NULL,3,'2026-10-08 15:45:05',NULL),(4,8,'W-R1-M1','winners',1,1,5,6,4,'2026-10-08 15:45:06',NULL),(5,8,'W-R1-M2','winners',1,2,1,2,5,'2026-10-08 15:45:06',NULL),(6,8,'W-R2-M1','winners',2,1,6,NULL,6,'2026-10-08 15:45:06',NULL),(7,9,'W-R1-M1','winners',1,1,3,4,7,'2026-10-08 15:45:06',NULL),(8,9,'W-R1-M2','winners',1,2,5,6,8,'2026-10-08 15:45:06',NULL),(9,9,'W-R2-M1','winners',2,1,3,5,9,'2026-10-08 15:45:06',NULL),(10,10,'W-R1-M1','winners',1,1,12,11,10,'2026-10-08 15:45:07',NULL);
/*!40000 ALTER TABLE `bracket_nodes` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `departments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `departments` (
  `department_id` int NOT NULL AUTO_INCREMENT,
  `faculty_id` int NOT NULL,
  `name` varchar(150) NOT NULL,
  PRIMARY KEY (`department_id`),
  KEY `faculty_id` (`faculty_id`),
  CONSTRAINT `departments_ibfk_1` FOREIGN KEY (`faculty_id`) REFERENCES `faculties` (`faculty_id`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `departments` WRITE;
/*!40000 ALTER TABLE `departments` DISABLE KEYS */;
INSERT INTO `departments` VALUES (1,1,'วิศวกรรมคอมพิวเตอร์'),(2,1,'วิศวกรรมไฟฟ้า'),(3,1,'วิศวกรรมเครื่องกล'),(4,1,'วิศวกรรมโยธา'),(5,1,'วิศวกรรมอุตสาหการ'),(6,2,'วิทยาการคอมพิวเตอร์'),(7,2,'คณิตศาสตร์'),(8,2,'เคมี'),(9,2,'ฟิสิกส์'),(10,2,'ชีววิทยา'),(11,3,'พืชไร่นา'),(12,3,'สัตวบาล'),(13,3,'โรคพืช'),(14,4,'การตลาด'),(15,4,'การเงิน'),(16,4,'การจัดการ'),(17,4,'บัญชี'),(18,5,'ภาษาอังกฤษ'),(19,5,'ภาษาไทย'),(20,5,'ปรัชญาและศาสนา'),(21,6,'รัฐศาสตร์'),(22,6,'นิติศาสตร์'),(23,6,'จิตวิทยา'),(24,6,'สังคมวิทยาและมานุษยวิทยา'),(25,7,'พลศึกษา'),(26,7,'การสอนคณิตศาสตร์'),(27,7,'การสอนวิทยาศาสตร์'),(28,8,'เศรษฐศาสตร์'),(29,8,'เศรษฐศาสตร์เกษตร'),(30,8,'สหกรณ์');
/*!40000 ALTER TABLE `departments` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `email_verification_otps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_verification_otps` (
  `email_verification_otp_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `code_hash` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `attempt_count` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`email_verification_otp_id`),
  KEY `idx_email_verification_otps_user` (`user_id`),
  CONSTRAINT `fk_email_verification_otps_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `email_verification_otps` WRITE;
/*!40000 ALTER TABLE `email_verification_otps` DISABLE KEYS */;
/*!40000 ALTER TABLE `email_verification_otps` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `faculties`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `faculties` (
  `faculty_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  PRIMARY KEY (`faculty_id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `faculties` WRITE;
/*!40000 ALTER TABLE `faculties` DISABLE KEYS */;
INSERT INTO `faculties` VALUES (1,'คณะวิศวกรรมศาสตร์'),(2,'คณะวิทยาศาสตร์'),(3,'คณะเกษตร'),(4,'คณะบริหารธุรกิจ'),(5,'คณะมนุษยศาสตร์'),(6,'คณะสังคมศาสตร์'),(7,'คณะศึกษาศาสตร์'),(8,'คณะเศรษฐศาสตร์');
/*!40000 ALTER TABLE `faculties` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `follows`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `follows` (
  `follow_id` int NOT NULL AUTO_INCREMENT,
  `follower_user_id` int NOT NULL,
  `followed_user_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`follow_id`),
  UNIQUE KEY `follower_user_id` (`follower_user_id`,`followed_user_id`),
  KEY `followed_user_id` (`followed_user_id`),
  CONSTRAINT `follows_ibfk_1` FOREIGN KEY (`follower_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `follows_ibfk_2` FOREIGN KEY (`followed_user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `follows` WRITE;
/*!40000 ALTER TABLE `follows` DISABLE KEYS */;
/*!40000 ALTER TABLE `follows` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `match_checkins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `match_checkins` (
  `match_checkin_id` int NOT NULL AUTO_INCREMENT,
  `match_id` int NOT NULL,
  `user_id` int NOT NULL,
  `method` enum('qr_onsite','photo_online','manual_by_referee') NOT NULL,
  `match_checkin_status` enum('success','rejected','exception','pending') NOT NULL,
  `rejection_reason` varchar(255) DEFAULT NULL,
  `note` varchar(255) DEFAULT NULL,
  `document_type` enum('student_id','national_id') DEFAULT NULL,
  `document_s3_key` varchar(255) DEFAULT NULL,
  `verified_by_referee_id` int DEFAULT NULL,
  `checked_in_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `verified_at` datetime DEFAULT NULL,
  PRIMARY KEY (`match_checkin_id`),
  UNIQUE KEY `uq_match_checkins_match_user` (`match_id`,`user_id`),
  KEY `user_id` (`user_id`),
  KEY `verified_by_referee_id` (`verified_by_referee_id`),
  CONSTRAINT `match_checkins_ibfk_1` FOREIGN KEY (`match_id`) REFERENCES `matches` (`match_id`),
  CONSTRAINT `match_checkins_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `match_checkins_ibfk_3` FOREIGN KEY (`verified_by_referee_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `match_checkins` WRITE;
/*!40000 ALTER TABLE `match_checkins` DISABLE KEYS */;
INSERT INTO `match_checkins` VALUES (1,7,105,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-30 02:45:00',NULL),(2,7,106,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-30 02:45:00',NULL),(3,7,107,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-30 02:45:00',NULL),(4,7,108,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-30 02:45:00',NULL),(5,8,109,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-30 04:45:00',NULL),(6,8,110,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-30 04:45:00',NULL),(7,8,111,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-30 04:45:00',NULL),(8,8,112,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-30 04:45:00',NULL),(9,9,105,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-10-01 06:45:00',NULL),(10,9,106,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-10-01 06:45:00',NULL),(11,9,109,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-10-01 06:45:00',NULL),(12,9,110,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-10-01 06:45:00',NULL),(13,4,109,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-10-08 11:29:51',NULL),(14,4,110,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-10-08 11:29:51',NULL),(15,4,111,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-10-08 11:29:51',NULL),(16,4,112,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-10-08 11:29:51',NULL),(17,5,101,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-10-08 13:29:51',NULL),(18,5,102,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-10-08 13:29:51',NULL),(19,5,103,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-10-08 13:29:51',NULL),(20,5,104,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-10-08 13:29:51',NULL),(21,11,107,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-10-08 06:29:51',NULL),(22,11,108,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-10-08 06:29:51',NULL),(23,11,105,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-10-08 06:29:51',NULL),(24,11,106,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-10-08 06:29:51',NULL),(25,12,101,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-10-08 08:29:51',NULL),(26,12,102,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-10-08 08:29:51',NULL),(27,12,103,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-10-08 08:29:51',NULL),(28,12,104,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-10-08 08:29:51',NULL),(29,13,107,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-10-08 10:29:51',NULL),(30,13,108,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-10-08 10:29:51',NULL),(31,13,103,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-10-08 10:29:51',NULL),(32,13,104,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-10-08 10:29:51',NULL);
/*!40000 ALTER TABLE `match_checkins` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `match_referees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `match_referees` (
  `match_referee_id` int NOT NULL AUTO_INCREMENT,
  `match_id` int NOT NULL,
  `tournament_referee_id` int NOT NULL,
  `assignment_status` enum('pending','accepted','declined') NOT NULL DEFAULT 'pending',
  `responded_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`match_referee_id`),
  UNIQUE KEY `match_id` (`match_id`,`tournament_referee_id`),
  KEY `tournament_referee_id` (`tournament_referee_id`),
  CONSTRAINT `match_referees_ibfk_1` FOREIGN KEY (`match_id`) REFERENCES `matches` (`match_id`),
  CONSTRAINT `match_referees_ibfk_2` FOREIGN KEY (`tournament_referee_id`) REFERENCES `tournament_referees` (`tournament_referee_id`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `match_referees` WRITE;
/*!40000 ALTER TABLE `match_referees` DISABLE KEYS */;
INSERT INTO `match_referees` VALUES (1,7,11,'accepted','2026-10-08 15:45:10','2026-10-08 15:45:10'),(2,7,12,'accepted','2026-10-08 15:45:10','2026-10-08 15:45:10'),(3,8,11,'accepted','2026-10-08 15:45:10','2026-10-08 15:45:10'),(4,8,12,'accepted','2026-10-08 15:45:11','2026-10-08 15:45:11'),(5,9,11,'accepted','2026-10-08 15:45:13','2026-10-08 15:45:13'),(6,9,12,'accepted','2026-10-08 15:45:14','2026-10-08 15:45:14'),(7,4,9,'accepted','2026-10-08 15:45:16','2026-10-08 15:45:16'),(8,4,10,'accepted','2026-10-08 15:45:16','2026-10-08 15:45:16'),(9,5,9,'accepted','2026-10-08 15:45:16','2026-10-08 15:45:16'),(10,5,10,'accepted','2026-10-08 15:45:16','2026-10-08 15:45:16'),(11,11,15,'accepted','2026-10-08 15:45:19','2026-10-08 15:45:19'),(12,11,16,'accepted','2026-10-08 15:45:19','2026-10-08 15:45:19'),(13,12,15,'accepted','2026-10-08 15:45:20','2026-10-08 15:45:20'),(14,12,16,'accepted','2026-10-08 15:45:21','2026-10-08 15:45:21'),(15,13,15,'accepted','2026-10-08 15:45:22','2026-10-08 15:45:22'),(16,13,16,'accepted','2026-10-08 15:45:22','2026-10-08 15:45:22'),(17,1,7,'accepted','2026-10-08 15:45:24','2026-10-08 15:45:24'),(18,1,8,'accepted','2026-10-08 15:45:24','2026-10-08 15:45:24'),(19,2,7,'accepted','2026-10-08 15:45:24','2026-10-08 15:45:24'),(20,2,8,'accepted','2026-10-08 15:45:24','2026-10-08 15:45:24'),(21,3,7,'accepted','2026-10-08 15:45:24','2026-10-08 15:45:24'),(22,10,14,'accepted','2026-10-08 15:45:24','2026-10-08 15:45:24');
/*!40000 ALTER TABLE `match_referees` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `match_result_complaints`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `match_result_complaints` (
  `match_result_complaint_id` int NOT NULL AUTO_INCREMENT,
  `match_id` int NOT NULL,
  `match_result_id` int NOT NULL,
  `filed_by` int NOT NULL,
  `reason` text NOT NULL,
  `claimed_winner_team_id` int DEFAULT NULL,
  `claimed_score` json DEFAULT NULL,
  `evidence` json DEFAULT NULL,
  `complaint_status` enum('open','upheld','no_merit') NOT NULL DEFAULT 'open',
  `organizer_statement` text,
  `organizer_statement_by` int DEFAULT NULL,
  `organizer_statement_at` datetime DEFAULT NULL,
  `remedy` enum('record_only','amend_result') DEFAULT NULL,
  `decided_by` int DEFAULT NULL,
  `decision_note` text,
  `decided_at` datetime DEFAULT NULL,
  `filer_flagged` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`match_result_complaint_id`),
  UNIQUE KEY `uq_complaint_result_filer` (`match_result_id`,`filed_by`),
  KEY `idx_complaint_match` (`match_id`),
  KEY `idx_complaint_queue` (`complaint_status`,`created_at`),
  KEY `filed_by` (`filed_by`),
  KEY `claimed_winner_team_id` (`claimed_winner_team_id`),
  KEY `organizer_statement_by` (`organizer_statement_by`),
  KEY `decided_by` (`decided_by`),
  CONSTRAINT `match_result_complaints_ibfk_1` FOREIGN KEY (`match_id`) REFERENCES `matches` (`match_id`),
  CONSTRAINT `match_result_complaints_ibfk_2` FOREIGN KEY (`match_result_id`) REFERENCES `match_results` (`match_result_id`),
  CONSTRAINT `match_result_complaints_ibfk_3` FOREIGN KEY (`filed_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `match_result_complaints_ibfk_4` FOREIGN KEY (`claimed_winner_team_id`) REFERENCES `teams` (`team_id`),
  CONSTRAINT `match_result_complaints_ibfk_5` FOREIGN KEY (`organizer_statement_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `match_result_complaints_ibfk_6` FOREIGN KEY (`decided_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `match_result_complaints` WRITE;
/*!40000 ALTER TABLE `match_result_complaints` DISABLE KEYS */;
/*!40000 ALTER TABLE `match_result_complaints` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `match_results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `match_results` (
  `match_result_id` int NOT NULL AUTO_INCREMENT,
  `match_id` int NOT NULL,
  `winner_team_id` int DEFAULT NULL,
  `score_data` json DEFAULT NULL,
  `submitted_by_user_id` int NOT NULL,
  `submitted_role` enum('team_leader','referee','organizer') NOT NULL,
  `submitted_at` datetime DEFAULT NULL,
  `match_result_status` enum('submitted','verified','disputed','rejected','walkover') NOT NULL DEFAULT 'submitted',
  `dispute_reason` text,
  `dispute_raised_by` int DEFAULT NULL,
  `dispute_raised_at` datetime DEFAULT NULL,
  `dispute_claimed_winner_team_id` int DEFAULT NULL,
  `dispute_claimed_score` json DEFAULT NULL,
  `dispute_evidence` json DEFAULT NULL,
  `dispute_resolved_by` int DEFAULT NULL,
  `dispute_resolution` text,
  `dispute_resolved_at` datetime DEFAULT NULL,
  `verified_by_user_id` int DEFAULT NULL,
  `verified_at` datetime DEFAULT NULL,
  `amended_by_user_id` int DEFAULT NULL,
  `amend_reason` text,
  `amended_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`match_result_id`),
  UNIQUE KEY `match_id` (`match_id`),
  KEY `winner_team_id` (`winner_team_id`),
  KEY `submitted_by_user_id` (`submitted_by_user_id`),
  KEY `dispute_raised_by` (`dispute_raised_by`),
  KEY `dispute_resolved_by` (`dispute_resolved_by`),
  KEY `verified_by_user_id` (`verified_by_user_id`),
  KEY `amended_by_user_id` (`amended_by_user_id`),
  KEY `fk_match_results_dispute_claimed_team` (`dispute_claimed_winner_team_id`),
  CONSTRAINT `fk_match_results_dispute_claimed_team` FOREIGN KEY (`dispute_claimed_winner_team_id`) REFERENCES `teams` (`team_id`),
  CONSTRAINT `match_results_ibfk_1` FOREIGN KEY (`match_id`) REFERENCES `matches` (`match_id`),
  CONSTRAINT `match_results_ibfk_2` FOREIGN KEY (`winner_team_id`) REFERENCES `teams` (`team_id`),
  CONSTRAINT `match_results_ibfk_3` FOREIGN KEY (`submitted_by_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `match_results_ibfk_4` FOREIGN KEY (`dispute_raised_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `match_results_ibfk_5` FOREIGN KEY (`dispute_resolved_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `match_results_ibfk_6` FOREIGN KEY (`verified_by_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `match_results_ibfk_7` FOREIGN KEY (`amended_by_user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `match_results` WRITE;
/*!40000 ALTER TABLE `match_results` DISABLE KEYS */;
INSERT INTO `match_results` VALUES (1,7,3,'{\"3\": 2, \"4\": 1}',23,'referee','2026-09-30 03:50:00','verified',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,105,'2026-09-30 04:05:00',NULL,NULL,NULL,'2026-10-08 15:45:11'),(2,8,5,'{\"5\": 2, \"6\": 0}',23,'referee','2026-09-30 05:50:00','verified',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,109,'2026-09-30 06:05:00',NULL,NULL,NULL,'2026-10-08 15:45:13'),(3,9,5,'{\"3\": 1, \"5\": 2}',24,'referee','2026-10-01 07:50:00','verified',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,109,'2026-10-01 08:05:00',NULL,NULL,NULL,'2026-10-08 15:45:14'),(4,4,6,'{\"5\": 1, \"6\": 2}',23,'referee','2026-10-08 12:34:51','verified',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,111,'2026-10-08 12:49:51',NULL,NULL,NULL,'2026-10-08 15:45:17'),(5,5,1,'{\"1\": 2, \"2\": 1}',24,'referee','2026-10-08 14:34:51','submitted',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-08 15:45:18'),(6,11,4,'{\"3\": 0, \"4\": 2}',21,'referee','2026-10-08 07:34:51','verified',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,107,'2026-10-08 07:49:51',NULL,NULL,NULL,'2026-10-08 15:45:20'),(7,12,1,'{\"1\": 2, \"2\": 1}',21,'referee','2026-10-08 09:34:51','verified',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,101,'2026-10-08 09:49:51',NULL,NULL,NULL,'2026-10-08 15:45:21'),(8,13,4,'{\"2\": 0, \"4\": 2}',21,'referee','2026-10-08 11:34:51','disputed','เซตที่สามนับแต้มผิด คะแนนจริงคือ 21–19 ฝั่งเรา ขอให้ตรวจใบบันทึกคะแนน',103,'2026-10-08 15:45:23',2,'{\"2\": 2, \"4\": 1}',NULL,NULL,NULL,NULL,107,'2026-10-08 11:49:51',NULL,NULL,NULL,'2026-10-08 15:45:23');
/*!40000 ALTER TABLE `match_results` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `matches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `matches` (
  `match_id` int NOT NULL AUTO_INCREMENT,
  `tournament_id` int NOT NULL,
  `bracket_node_id` int DEFAULT NULL,
  `next_match_id` int DEFAULT NULL,
  `loser_next_match_id` int DEFAULT NULL,
  `round_number` int DEFAULT NULL,
  `best_of` int DEFAULT NULL,
  `team_a_id` int DEFAULT NULL,
  `team_b_id` int DEFAULT NULL,
  `scheduled_time` datetime DEFAULT NULL,
  `scheduled_end_time` datetime DEFAULT NULL,
  `venue` varchar(255) DEFAULT NULL,
  `checkin_open_at` datetime DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `actual_end_time` datetime DEFAULT NULL,
  `match_status` enum('scheduled','checkin_open','in_progress','finished','completed','disputed','result_rejected') NOT NULL DEFAULT 'scheduled',
  `mode` enum('onsite','online') NOT NULL,
  `livestream_url` varchar(500) DEFAULT NULL,
  `room_code` varchar(50) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`match_id`),
  KEY `tournament_id` (`tournament_id`),
  KEY `bracket_node_id` (`bracket_node_id`),
  KEY `team_a_id` (`team_a_id`),
  KEY `team_b_id` (`team_b_id`),
  KEY `next_match_id` (`next_match_id`),
  KEY `loser_next_match_id` (`loser_next_match_id`),
  CONSTRAINT `matches_ibfk_1` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`tournament_id`),
  CONSTRAINT `matches_ibfk_2` FOREIGN KEY (`bracket_node_id`) REFERENCES `bracket_nodes` (`bracket_node_id`),
  CONSTRAINT `matches_ibfk_3` FOREIGN KEY (`team_a_id`) REFERENCES `teams` (`team_id`),
  CONSTRAINT `matches_ibfk_4` FOREIGN KEY (`team_b_id`) REFERENCES `teams` (`team_id`),
  CONSTRAINT `matches_ibfk_5` FOREIGN KEY (`next_match_id`) REFERENCES `matches` (`match_id`),
  CONSTRAINT `matches_ibfk_6` FOREIGN KEY (`loser_next_match_id`) REFERENCES `matches` (`match_id`),
  CONSTRAINT `chk_matches_best_of` CHECK (((`best_of` is null) or (`best_of` in (1,3,5,7))))
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `matches` WRITE;
/*!40000 ALTER TABLE `matches` DISABLE KEYS */;
INSERT INTO `matches` VALUES (1,7,NULL,3,NULL,1,3,1,2,'2026-10-09 06:20:00','2026-10-09 07:20:00','โรงยิม 1 คอร์ตกลาง',NULL,NULL,NULL,'scheduled','onsite',NULL,NULL,'2026-10-08 15:45:05','2026-10-08 15:45:23'),(2,7,NULL,3,NULL,1,3,3,4,'2026-10-09 08:00:00','2026-10-09 09:00:00','โรงยิม 1 คอร์ตกลาง',NULL,NULL,NULL,'scheduled','onsite',NULL,NULL,'2026-10-08 15:45:05','2026-10-08 15:45:24'),(3,7,NULL,NULL,NULL,2,3,NULL,NULL,'2026-10-09 10:00:00','2026-10-09 11:00:00','โรงยิม 1 คอร์ตกลาง',NULL,NULL,NULL,'scheduled','onsite',NULL,NULL,'2026-10-08 15:45:05','2026-10-08 15:45:24'),(4,8,NULL,6,NULL,1,3,5,6,'2026-10-08 11:44:51','2026-10-08 12:44:51','โรงยิม 2 คอร์ต A','2026-10-08 11:14:51','2026-10-08 11:44:51','2026-10-08 12:29:51','completed','onsite',NULL,NULL,'2026-10-08 15:45:06','2026-10-08 15:45:17'),(5,8,NULL,6,NULL,1,3,1,2,'2026-10-08 13:44:51','2026-10-08 14:44:51','โรงยิม 2 คอร์ต A','2026-10-08 13:14:51','2026-10-08 13:44:51','2026-10-08 14:29:51','finished','onsite',NULL,NULL,'2026-10-08 15:45:06','2026-10-08 15:45:18'),(6,8,NULL,NULL,NULL,2,3,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'scheduled','onsite',NULL,NULL,'2026-10-08 15:45:06',NULL),(7,9,NULL,9,NULL,1,3,3,4,'2026-09-30 03:00:00','2026-09-30 04:00:00','โรงยิม 4 คอร์ต A','2026-09-30 02:30:00','2026-09-30 03:00:00','2026-09-30 03:45:00','completed','onsite',NULL,NULL,'2026-10-08 15:45:06','2026-10-08 15:45:11'),(8,9,NULL,9,NULL,1,3,5,6,'2026-09-30 05:00:00','2026-09-30 06:00:00','โรงยิม 4 คอร์ต B','2026-09-30 04:30:00','2026-09-30 05:00:00','2026-09-30 05:45:00','completed','onsite',NULL,NULL,'2026-10-08 15:45:06','2026-10-08 15:45:13'),(9,9,NULL,NULL,NULL,2,3,3,5,'2026-10-01 07:00:00','2026-10-01 08:00:00','โรงยิม 4 คอร์ต A','2026-10-01 06:30:00','2026-10-01 07:00:00','2026-10-01 07:45:00','completed','onsite',NULL,NULL,'2026-10-08 15:45:06','2026-10-08 15:45:14'),(10,10,NULL,NULL,NULL,1,3,12,11,'2026-10-09 09:00:00','2026-10-09 10:00:00','ออนไลน์ (Custom Room)',NULL,NULL,NULL,'scheduled','online',NULL,'LTMS-ROV-2569','2026-10-08 15:45:07','2026-10-08 15:45:25'),(11,11,NULL,NULL,NULL,1,3,4,3,'2026-10-08 06:44:51','2026-10-08 07:44:51','โรงยิม 5','2026-10-08 06:14:51','2026-10-08 06:44:51','2026-10-08 07:29:51','completed','onsite',NULL,NULL,'2026-10-08 15:45:07','2026-10-08 15:45:20'),(12,11,NULL,NULL,NULL,1,3,1,2,'2026-10-08 08:44:51','2026-10-08 09:44:51','โรงยิม 5','2026-10-08 08:14:51','2026-10-08 08:44:51','2026-10-08 09:29:51','completed','onsite',NULL,NULL,'2026-10-08 15:45:07','2026-10-08 15:45:21'),(13,11,NULL,NULL,NULL,2,3,4,2,'2026-10-08 10:44:51','2026-10-08 11:44:51','โรงยิม 5','2026-10-08 10:14:51','2026-10-08 10:44:51','2026-10-08 11:29:51','disputed','onsite',NULL,NULL,'2026-10-08 15:45:07','2026-10-08 15:45:23'),(14,11,NULL,NULL,NULL,2,3,3,1,'2026-10-10 06:00:00','2026-10-10 07:00:00','โรงยิม 5',NULL,NULL,NULL,'scheduled','onsite',NULL,NULL,'2026-10-08 15:45:07','2026-10-08 15:45:23'),(15,11,NULL,NULL,NULL,3,3,4,1,'2026-10-10 08:00:00','2026-10-10 09:00:00','โรงยิม 5',NULL,NULL,NULL,'scheduled','onsite',NULL,NULL,'2026-10-08 15:45:07','2026-10-08 15:45:23'),(16,11,NULL,NULL,NULL,3,3,2,3,'2026-10-10 10:00:00','2026-10-10 11:00:00','โรงยิม 5',NULL,NULL,NULL,'scheduled','onsite',NULL,NULL,'2026-10-08 15:45:07','2026-10-08 15:45:23');
/*!40000 ALTER TABLE `matches` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `notification_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `type` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `related_entity_type` varchar(50) DEFAULT NULL,
  `related_entity_id` int DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`notification_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=535 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES (1,102,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"วิศวะ Smashers\" — ตอบรับได้ภายใน 7 วัน','team',1,0,'2026-10-08 15:44:56'),(2,101,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','ภูมิพัฒน์ พงษ์ไพบูลย์ ตอบรับคำเชิญเข้าทีม \"วิศวะ Smashers\" แล้ว','team',1,0,'2026-10-08 15:44:56'),(3,104,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"Sci Shuttle\" — ตอบรับได้ภายใน 7 วัน','team',2,0,'2026-10-08 15:44:56'),(4,103,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','ณัฐวุฒิ ธารารักษ์ ตอบรับคำเชิญเข้าทีม \"Sci Shuttle\" แล้ว','team',2,0,'2026-10-08 15:44:56'),(5,106,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"เกษตรตบสนั่น\" — ตอบรับได้ภายใน 7 วัน','team',3,0,'2026-10-08 15:44:56'),(6,105,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','ชยพล อินทรีย์ ตอบรับคำเชิญเข้าทีม \"เกษตรตบสนั่น\" แล้ว','team',3,0,'2026-10-08 15:44:56'),(7,108,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"BBA Birdies\" — ตอบรับได้ภายใน 7 วัน','team',4,0,'2026-10-08 15:44:56'),(8,107,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','พิมพ์ลภัส รุ่งเรือง ตอบรับคำเชิญเข้าทีม \"BBA Birdies\" แล้ว','team',4,0,'2026-10-08 15:44:56'),(9,110,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"มนุษย์ลูกขนไก่\" — ตอบรับได้ภายใน 7 วัน','team',5,0,'2026-10-08 15:44:57'),(10,109,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','ชนิกานต์ นาคประเสริฐ ตอบรับคำเชิญเข้าทีม \"มนุษย์ลูกขนไก่\" แล้ว','team',5,0,'2026-10-08 15:44:57'),(11,112,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"Econ Rackets\" — ตอบรับได้ภายใน 7 วัน','team',6,0,'2026-10-08 15:44:57'),(12,111,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','ศุภกร พรหมมา ตอบรับคำเชิญเข้าทีม \"Econ Rackets\" แล้ว','team',6,0,'2026-10-08 15:44:57'),(13,114,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"วิศวะ Ballers\" — ตอบรับได้ภายใน 7 วัน','team',7,0,'2026-10-08 15:44:57'),(14,113,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','ธีรเดช แสงทอง ตอบรับคำเชิญเข้าทีม \"วิศวะ Ballers\" แล้ว','team',7,0,'2026-10-08 15:44:57'),(15,115,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"วิศวะ Ballers\" — ตอบรับได้ภายใน 7 วัน','team',7,0,'2026-10-08 15:44:57'),(16,113,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','ปิยะพงษ์ ศรีสุข ตอบรับคำเชิญเข้าทีม \"วิศวะ Ballers\" แล้ว','team',7,0,'2026-10-08 15:44:57'),(17,116,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"วิศวะ Ballers\" — ตอบรับได้ภายใน 7 วัน','team',7,0,'2026-10-08 15:44:57'),(18,113,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','จิรายุ บุญมา ตอบรับคำเชิญเข้าทีม \"วิศวะ Ballers\" แล้ว','team',7,0,'2026-10-08 15:44:57'),(19,117,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"วิศวะ Ballers\" — ตอบรับได้ภายใน 7 วัน','team',7,0,'2026-10-08 15:44:57'),(20,113,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','รัชชานนท์ จันทร์เพ็ญ ตอบรับคำเชิญเข้าทีม \"วิศวะ Ballers\" แล้ว','team',7,0,'2026-10-08 15:44:57'),(21,118,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"วิศวะ Ballers\" — ตอบรับได้ภายใน 7 วัน','team',7,0,'2026-10-08 15:44:57'),(22,113,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','สิรวิชญ์ ทองคำ ตอบรับคำเชิญเข้าทีม \"วิศวะ Ballers\" แล้ว','team',7,0,'2026-10-08 15:44:57'),(23,120,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"Sci Hoopers\" — ตอบรับได้ภายใน 7 วัน','team',8,0,'2026-10-08 15:44:57'),(24,119,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','นนทกร เกษมสุข ตอบรับคำเชิญเข้าทีม \"Sci Hoopers\" แล้ว','team',8,0,'2026-10-08 15:44:57'),(25,121,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"Sci Hoopers\" — ตอบรับได้ภายใน 7 วัน','team',8,0,'2026-10-08 15:44:57'),(26,119,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','เจษฎา พงษ์ไพบูลย์ ตอบรับคำเชิญเข้าทีม \"Sci Hoopers\" แล้ว','team',8,0,'2026-10-08 15:44:57'),(27,122,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"Sci Hoopers\" — ตอบรับได้ภายใน 7 วัน','team',8,0,'2026-10-08 15:44:57'),(28,119,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','อภิวัฒน์ มณีรัตน์ ตอบรับคำเชิญเข้าทีม \"Sci Hoopers\" แล้ว','team',8,0,'2026-10-08 15:44:57'),(29,123,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"Sci Hoopers\" — ตอบรับได้ภายใน 7 วัน','team',8,0,'2026-10-08 15:44:57'),(30,119,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','ก้องภพ ธารารักษ์ ตอบรับคำเชิญเข้าทีม \"Sci Hoopers\" แล้ว','team',8,0,'2026-10-08 15:44:57'),(31,125,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"วิศวะ Lady Hoops\" — ตอบรับได้ภายใน 7 วัน','team',9,0,'2026-10-08 15:44:57'),(32,124,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','สุพิชญา อินทรีย์ ตอบรับคำเชิญเข้าทีม \"วิศวะ Lady Hoops\" แล้ว','team',9,0,'2026-10-08 15:44:57'),(33,126,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"วิศวะ Lady Hoops\" — ตอบรับได้ภายใน 7 วัน','team',9,0,'2026-10-08 15:44:58'),(34,124,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','อริสรา สุวรรณภูมิ ตอบรับคำเชิญเข้าทีม \"วิศวะ Lady Hoops\" แล้ว','team',9,0,'2026-10-08 15:44:58'),(35,127,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"วิศวะ Lady Hoops\" — ตอบรับได้ภายใน 7 วัน','team',9,0,'2026-10-08 15:44:58'),(36,124,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','วรรณิดา รุ่งเรือง ตอบรับคำเชิญเข้าทีม \"วิศวะ Lady Hoops\" แล้ว','team',9,0,'2026-10-08 15:44:58'),(37,128,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"วิศวะ Lady Hoops\" — ตอบรับได้ภายใน 7 วัน','team',9,0,'2026-10-08 15:44:58'),(38,124,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','ปาริฉัตร ชัยมงคล ตอบรับคำเชิญเข้าทีม \"วิศวะ Lady Hoops\" แล้ว','team',9,0,'2026-10-08 15:44:58'),(39,129,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"วิศวะ Lady Hoops\" — ตอบรับได้ภายใน 7 วัน','team',9,0,'2026-10-08 15:44:58'),(40,124,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','เบญญาภา นาคประเสริฐ ตอบรับคำเชิญเข้าทีม \"วิศวะ Lady Hoops\" แล้ว','team',9,0,'2026-10-08 15:44:58'),(41,131,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"บริหาร Queens\" — ตอบรับได้ภายใน 7 วัน','team',10,0,'2026-10-08 15:44:58'),(42,130,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','กมลชนก พรหมมา ตอบรับคำเชิญเข้าทีม \"บริหาร Queens\" แล้ว','team',10,0,'2026-10-08 15:44:58'),(43,132,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"บริหาร Queens\" — ตอบรับได้ภายใน 7 วัน','team',10,0,'2026-10-08 15:44:58'),(44,130,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','ณิชากร กิตติวงศ์ ตอบรับคำเชิญเข้าทีม \"บริหาร Queens\" แล้ว','team',10,0,'2026-10-08 15:44:58'),(45,133,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"บริหาร Queens\" — ตอบรับได้ภายใน 7 วัน','team',10,0,'2026-10-08 15:44:58'),(46,130,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','พรรณวษา แสงทอง ตอบรับคำเชิญเข้าทีม \"บริหาร Queens\" แล้ว','team',10,0,'2026-10-08 15:44:58'),(47,134,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"บริหาร Queens\" — ตอบรับได้ภายใน 7 วัน','team',10,0,'2026-10-08 15:44:58'),(48,130,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','จิดาภา ศรีสุข ตอบรับคำเชิญเข้าทีม \"บริหาร Queens\" แล้ว','team',10,0,'2026-10-08 15:44:58'),(49,136,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"RoV วิศวะ Dragons\" — ตอบรับได้ภายใน 7 วัน','team',11,0,'2026-10-08 15:44:58'),(50,135,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','วชิรวิทย์ จันทร์เพ็ญ ตอบรับคำเชิญเข้าทีม \"RoV วิศวะ Dragons\" แล้ว','team',11,0,'2026-10-08 15:44:58'),(51,137,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"RoV วิศวะ Dragons\" — ตอบรับได้ภายใน 7 วัน','team',11,0,'2026-10-08 15:44:58'),(52,135,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','ปุณณวิช ทองคำ ตอบรับคำเชิญเข้าทีม \"RoV วิศวะ Dragons\" แล้ว','team',11,0,'2026-10-08 15:44:58'),(53,138,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"RoV วิศวะ Dragons\" — ตอบรับได้ภายใน 7 วัน','team',11,0,'2026-10-08 15:44:58'),(54,135,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','ณภัทร ปัญญาดี ตอบรับคำเชิญเข้าทีม \"RoV วิศวะ Dragons\" แล้ว','team',11,0,'2026-10-08 15:44:58'),(55,139,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"RoV วิศวะ Dragons\" — ตอบรับได้ภายใน 7 วัน','team',11,0,'2026-10-08 15:44:58'),(56,135,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','กันตพงศ์ เกษมสุข ตอบรับคำเชิญเข้าทีม \"RoV วิศวะ Dragons\" แล้ว','team',11,0,'2026-10-08 15:44:58'),(57,141,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"RoV Sci Phoenix\" — ตอบรับได้ภายใน 7 วัน','team',12,0,'2026-10-08 15:44:59'),(58,140,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','สหรัฐ มณีรัตน์ ตอบรับคำเชิญเข้าทีม \"RoV Sci Phoenix\" แล้ว','team',12,0,'2026-10-08 15:44:59'),(59,142,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"RoV Sci Phoenix\" — ตอบรับได้ภายใน 7 วัน','team',12,0,'2026-10-08 15:44:59'),(60,140,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','พงศกร ธารารักษ์ ตอบรับคำเชิญเข้าทีม \"RoV Sci Phoenix\" แล้ว','team',12,0,'2026-10-08 15:44:59'),(61,143,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"RoV Sci Phoenix\" — ตอบรับได้ภายใน 7 วัน','team',12,0,'2026-10-08 15:44:59'),(62,140,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','ธนดล วงศ์สวัสดิ์ ตอบรับคำเชิญเข้าทีม \"RoV Sci Phoenix\" แล้ว','team',12,0,'2026-10-08 15:44:59'),(63,144,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"RoV Sci Phoenix\" — ตอบรับได้ภายใน 7 วัน','team',12,0,'2026-10-08 15:44:59'),(64,140,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','อิทธิพล อินทรีย์ ตอบรับคำเชิญเข้าทีม \"RoV Sci Phoenix\" แล้ว','team',12,0,'2026-10-08 15:44:59'),(65,146,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"ฟุตบอลวิศวกรรมศาสตร์\" — ตอบรับได้ภายใน 7 วัน','team',13,0,'2026-10-08 15:44:59'),(66,145,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','คณิน รุ่งเรือง ตอบรับคำเชิญเข้าทีม \"ฟุตบอลวิศวกรรมศาสตร์\" แล้ว','team',13,0,'2026-10-08 15:44:59'),(67,147,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"ฟุตบอลวิศวกรรมศาสตร์\" — ตอบรับได้ภายใน 7 วัน','team',13,0,'2026-10-08 15:44:59'),(68,145,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','ปรเมศวร์ ชัยมงคล ตอบรับคำเชิญเข้าทีม \"ฟุตบอลวิศวกรรมศาสตร์\" แล้ว','team',13,0,'2026-10-08 15:44:59'),(69,148,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"ฟุตบอลวิศวกรรมศาสตร์\" — ตอบรับได้ภายใน 7 วัน','team',13,0,'2026-10-08 15:44:59'),(70,145,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','ธนวัฒน์ นาคประเสริฐ ตอบรับคำเชิญเข้าทีม \"ฟุตบอลวิศวกรรมศาสตร์\" แล้ว','team',13,0,'2026-10-08 15:44:59'),(71,149,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"ฟุตบอลวิศวกรรมศาสตร์\" — ตอบรับได้ภายใน 7 วัน','team',13,0,'2026-10-08 15:44:59'),(72,145,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','ภูมิพัฒน์ ศักดิ์ดี ตอบรับคำเชิญเข้าทีม \"ฟุตบอลวิศวกรรมศาสตร์\" แล้ว','team',13,0,'2026-10-08 15:44:59'),(73,150,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"ฟุตบอลวิศวกรรมศาสตร์\" — ตอบรับได้ภายใน 7 วัน','team',13,0,'2026-10-08 15:44:59'),(74,145,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','กฤษณะ พรหมมา ตอบรับคำเชิญเข้าทีม \"ฟุตบอลวิศวกรรมศาสตร์\" แล้ว','team',13,0,'2026-10-08 15:44:59'),(75,151,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"ฟุตบอลวิศวกรรมศาสตร์\" — ตอบรับได้ภายใน 7 วัน','team',13,0,'2026-10-08 15:44:59'),(76,145,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','ณัฐวุฒิ กิตติวงศ์ ตอบรับคำเชิญเข้าทีม \"ฟุตบอลวิศวกรรมศาสตร์\" แล้ว','team',13,0,'2026-10-08 15:44:59'),(77,152,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"ฟุตบอลวิศวกรรมศาสตร์\" — ตอบรับได้ภายใน 7 วัน','team',13,0,'2026-10-08 15:44:59'),(78,145,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','พีรพล แสงทอง ตอบรับคำเชิญเข้าทีม \"ฟุตบอลวิศวกรรมศาสตร์\" แล้ว','team',13,0,'2026-10-08 15:44:59'),(79,153,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"ฟุตบอลวิศวกรรมศาสตร์\" — ตอบรับได้ภายใน 7 วัน','team',13,0,'2026-10-08 15:44:59'),(80,145,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','ชยพล ศรีสุข ตอบรับคำเชิญเข้าทีม \"ฟุตบอลวิศวกรรมศาสตร์\" แล้ว','team',13,0,'2026-10-08 15:44:59'),(81,154,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"ฟุตบอลวิศวกรรมศาสตร์\" — ตอบรับได้ภายใน 7 วัน','team',13,0,'2026-10-08 15:44:59'),(82,145,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','วรเมธ บุญมา ตอบรับคำเชิญเข้าทีม \"ฟุตบอลวิศวกรรมศาสตร์\" แล้ว','team',13,0,'2026-10-08 15:45:00'),(83,155,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"ฟุตบอลวิศวกรรมศาสตร์\" — ตอบรับได้ภายใน 7 วัน','team',13,0,'2026-10-08 15:45:00'),(84,145,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','ศุภกร จันทร์เพ็ญ ตอบรับคำเชิญเข้าทีม \"ฟุตบอลวิศวกรรมศาสตร์\" แล้ว','team',13,0,'2026-10-08 15:45:00'),(85,157,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"ฟุตบอลวิทยาศาสตร์\" — ตอบรับได้ภายใน 7 วัน','team',14,0,'2026-10-08 15:45:00'),(86,156,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','ธีรเดช ปัญญาดี ตอบรับคำเชิญเข้าทีม \"ฟุตบอลวิทยาศาสตร์\" แล้ว','team',14,0,'2026-10-08 15:45:00'),(87,158,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"ฟุตบอลวิทยาศาสตร์\" — ตอบรับได้ภายใน 7 วัน','team',14,0,'2026-10-08 15:45:00'),(88,156,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','ปิยะพงษ์ เกษมสุข ตอบรับคำเชิญเข้าทีม \"ฟุตบอลวิทยาศาสตร์\" แล้ว','team',14,0,'2026-10-08 15:45:00'),(89,159,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"ฟุตบอลวิทยาศาสตร์\" — ตอบรับได้ภายใน 7 วัน','team',14,0,'2026-10-08 15:45:00'),(90,156,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','จิรายุ พงษ์ไพบูลย์ ตอบรับคำเชิญเข้าทีม \"ฟุตบอลวิทยาศาสตร์\" แล้ว','team',14,0,'2026-10-08 15:45:00'),(91,160,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"ฟุตบอลวิทยาศาสตร์\" — ตอบรับได้ภายใน 7 วัน','team',14,0,'2026-10-08 15:45:00'),(92,156,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','รัชชานนท์ มณีรัตน์ ตอบรับคำเชิญเข้าทีม \"ฟุตบอลวิทยาศาสตร์\" แล้ว','team',14,0,'2026-10-08 15:45:00'),(93,161,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"ฟุตบอลวิทยาศาสตร์\" — ตอบรับได้ภายใน 7 วัน','team',14,0,'2026-10-08 15:45:00'),(94,156,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','สิรวิชญ์ ธารารักษ์ ตอบรับคำเชิญเข้าทีม \"ฟุตบอลวิทยาศาสตร์\" แล้ว','team',14,0,'2026-10-08 15:45:00'),(95,162,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"ฟุตบอลวิทยาศาสตร์\" — ตอบรับได้ภายใน 7 วัน','team',14,0,'2026-10-08 15:45:00'),(96,156,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','ภาณุวัฒน์ วงศ์สวัสดิ์ ตอบรับคำเชิญเข้าทีม \"ฟุตบอลวิทยาศาสตร์\" แล้ว','team',14,0,'2026-10-08 15:45:00'),(97,163,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"ฟุตบอลวิทยาศาสตร์\" — ตอบรับได้ภายใน 7 วัน','team',14,0,'2026-10-08 15:45:00'),(98,156,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','นนทกร อินทรีย์ ตอบรับคำเชิญเข้าทีม \"ฟุตบอลวิทยาศาสตร์\" แล้ว','team',14,0,'2026-10-08 15:45:00'),(99,164,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"ฟุตบอลวิทยาศาสตร์\" — ตอบรับได้ภายใน 7 วัน','team',14,0,'2026-10-08 15:45:00'),(100,156,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','เจษฎา สุวรรณภูมิ ตอบรับคำเชิญเข้าทีม \"ฟุตบอลวิทยาศาสตร์\" แล้ว','team',14,0,'2026-10-08 15:45:00'),(101,165,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"ฟุตบอลวิทยาศาสตร์\" — ตอบรับได้ภายใน 7 วัน','team',14,0,'2026-10-08 15:45:00'),(102,156,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','อภิวัฒน์ รุ่งเรือง ตอบรับคำเชิญเข้าทีม \"ฟุตบอลวิทยาศาสตร์\" แล้ว','team',14,0,'2026-10-08 15:45:00'),(103,166,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"ฟุตบอลวิทยาศาสตร์\" — ตอบรับได้ภายใน 7 วัน','team',14,0,'2026-10-08 15:45:00'),(104,156,'team_invite_answered','มีคนตอบรับคำเชิญเข้าทีม','ก้องภพ ชัยมงคล ตอบรับคำเชิญเข้าทีม \"ฟุตบอลวิทยาศาสตร์\" แล้ว','team',14,0,'2026-10-08 15:45:00'),(105,36,'team_invited','คุณได้รับคำเชิญเข้าทีม','คุณได้รับคำเชิญเข้าทีม \"มือใหม่หัดตบ\" — ตอบรับได้ภายใน 7 วัน','team',15,0,'2026-10-08 15:45:01'),(106,12,'tournament_decided','คำขอจัดทัวร์นาเมนต์ได้รับการอนุมัติ','ทัวร์นาเมนต์ \"บาสเกตบอลเฟรชชี่คัพ\" ได้รับการอนุมัติแล้ว — ตั้งค่าและเปิดเผยแพร่ได้เลย','tournament',3,0,'2026-10-08 15:45:01'),(107,12,'tournament_decided','คำขอจัดทัวร์นาเมนต์ได้รับการอนุมัติ','ทัวร์นาเมนต์ \"แบดมินตันเกษตรแฟร์\" ได้รับการอนุมัติแล้ว — ตั้งค่าและเปิดเผยแพร่ได้เลย','tournament',4,0,'2026-10-08 15:45:01'),(108,11,'tournament_decided','คำขอจัดทัวร์นาเมนต์ได้รับการอนุมัติ','ทัวร์นาเมนต์ \"บาสเกตบอลหญิง ชิงถ้วยคณบดี\" ได้รับการอนุมัติแล้ว — ตั้งค่าและเปิดเผยแพร่ได้เลย','tournament',5,0,'2026-10-08 15:45:01'),(109,13,'tournament_decided','คำขอจัดทัวร์นาเมนต์ได้รับการอนุมัติ','ทัวร์นาเมนต์ \"แบดมินตัน Open รอบคัดเลือก\" ได้รับการอนุมัติแล้ว — ตั้งค่าและเปิดเผยแพร่ได้เลย','tournament',6,0,'2026-10-08 15:45:01'),(110,11,'tournament_decided','คำขอจัดทัวร์นาเมนต์ได้รับการอนุมัติ','ทัวร์นาเมนต์ \"แบดมินตันชิงแชมป์มหาวิทยาลัย 2569\" ได้รับการอนุมัติแล้ว — ตั้งค่าและเปิดเผยแพร่ได้เลย','tournament',7,0,'2026-10-08 15:45:01'),(111,12,'tournament_decided','คำขอจัดทัวร์นาเมนต์ได้รับการอนุมัติ','ทัวร์นาเมนต์ \"แบดมินตัน Faculty League\" ได้รับการอนุมัติแล้ว — ตั้งค่าและเปิดเผยแพร่ได้เลย','tournament',8,0,'2026-10-08 15:45:01'),(112,13,'tournament_decided','คำขอจัดทัวร์นาเมนต์ได้รับการอนุมัติ','ทัวร์นาเมนต์ \"แบดมินตัน Welcome Cup\" ได้รับการอนุมัติแล้ว — ตั้งค่าและเปิดเผยแพร่ได้เลย','tournament',9,0,'2026-10-08 15:45:01'),(113,13,'tournament_decided','คำขอจัดทัวร์นาเมนต์ได้รับการอนุมัติ','ทัวร์นาเมนต์ \"RoV Campus Showdown (ออนไลน์)\" ได้รับการอนุมัติแล้ว — ตั้งค่าและเปิดเผยแพร่ได้เลย','tournament',10,0,'2026-10-08 15:45:01'),(114,11,'tournament_decided','คำขอจัดทัวร์นาเมนต์ได้รับการอนุมัติ','ทัวร์นาเมนต์ \"แบดมินตันกระชับมิตร (พบกันหมด)\" ได้รับการอนุมัติแล้ว — ตั้งค่าและเปิดเผยแพร่ได้เลย','tournament',11,0,'2026-10-08 15:45:01'),(115,23,'referee_invited','คุณได้รับเชิญเป็นกรรมการ','คุณได้รับเชิญเป็นกรรมการทัวร์นาเมนต์ \"แบดมินตันเกษตรแฟร์\"','tournament',4,0,'2026-10-08 15:45:01'),(116,12,'referee_invite_answered','กรรมการตอบรับคำเชิญแล้ว','สุรเชษฐ์ ยุติธรรม ตอบรับเป็นกรรมการ รับ 0 แมตช์','tournament',4,0,'2026-10-08 15:45:01'),(117,24,'referee_invited','คุณได้รับเชิญเป็นกรรมการ','คุณได้รับเชิญเป็นกรรมการทัวร์นาเมนต์ \"แบดมินตันเกษตรแฟร์\"','tournament',4,0,'2026-10-08 15:45:01'),(118,12,'referee_invite_answered','กรรมการตอบรับคำเชิญแล้ว','พิมพ์ชนก เที่ยงตรง ตอบรับเป็นกรรมการ รับ 0 แมตช์','tournament',4,0,'2026-10-08 15:45:01'),(119,21,'referee_invited','คุณได้รับเชิญเป็นกรรมการ','คุณได้รับเชิญเป็นกรรมการทัวร์นาเมนต์ \"บาสเกตบอลหญิง ชิงถ้วยคณบดี\"','tournament',5,0,'2026-10-08 15:45:01'),(120,11,'referee_invite_answered','กรรมการตอบรับคำเชิญแล้ว','วีระชัย นกหวีดทอง ตอบรับเป็นกรรมการ รับ 0 แมตช์','tournament',5,0,'2026-10-08 15:45:01'),(121,22,'referee_invited','คุณได้รับเชิญเป็นกรรมการ','คุณได้รับเชิญเป็นกรรมการทัวร์นาเมนต์ \"บาสเกตบอลหญิง ชิงถ้วยคณบดี\"','tournament',5,0,'2026-10-08 15:45:01'),(122,11,'referee_invite_answered','กรรมการตอบรับคำเชิญแล้ว','อรทัย กฎกติกา ตอบรับเป็นกรรมการ รับ 0 แมตช์','tournament',5,0,'2026-10-08 15:45:01'),(123,23,'referee_invited','คุณได้รับเชิญเป็นกรรมการ','คุณได้รับเชิญเป็นกรรมการทัวร์นาเมนต์ \"แบดมินตัน Open รอบคัดเลือก\"','tournament',6,0,'2026-10-08 15:45:01'),(124,13,'referee_invite_answered','กรรมการตอบรับคำเชิญแล้ว','สุรเชษฐ์ ยุติธรรม ตอบรับเป็นกรรมการ รับ 0 แมตช์','tournament',6,0,'2026-10-08 15:45:02'),(125,24,'referee_invited','คุณได้รับเชิญเป็นกรรมการ','คุณได้รับเชิญเป็นกรรมการทัวร์นาเมนต์ \"แบดมินตัน Open รอบคัดเลือก\"','tournament',6,0,'2026-10-08 15:45:02'),(126,13,'referee_invite_answered','กรรมการตอบรับคำเชิญแล้ว','พิมพ์ชนก เที่ยงตรง ตอบรับเป็นกรรมการ รับ 0 แมตช์','tournament',6,0,'2026-10-08 15:45:02'),(127,21,'referee_invited','คุณได้รับเชิญเป็นกรรมการ','คุณได้รับเชิญเป็นกรรมการทัวร์นาเมนต์ \"แบดมินตันชิงแชมป์มหาวิทยาลัย 2569\"','tournament',7,0,'2026-10-08 15:45:02'),(128,11,'referee_invite_answered','กรรมการตอบรับคำเชิญแล้ว','วีระชัย นกหวีดทอง ตอบรับเป็นกรรมการ รับ 0 แมตช์','tournament',7,0,'2026-10-08 15:45:02'),(129,22,'referee_invited','คุณได้รับเชิญเป็นกรรมการ','คุณได้รับเชิญเป็นกรรมการทัวร์นาเมนต์ \"แบดมินตันชิงแชมป์มหาวิทยาลัย 2569\"','tournament',7,0,'2026-10-08 15:45:02'),(130,11,'referee_invite_answered','กรรมการตอบรับคำเชิญแล้ว','อรทัย กฎกติกา ตอบรับเป็นกรรมการ รับ 0 แมตช์','tournament',7,0,'2026-10-08 15:45:02'),(131,23,'referee_invited','คุณได้รับเชิญเป็นกรรมการ','คุณได้รับเชิญเป็นกรรมการทัวร์นาเมนต์ \"แบดมินตัน Faculty League\"','tournament',8,0,'2026-10-08 15:45:02'),(132,12,'referee_invite_answered','กรรมการตอบรับคำเชิญแล้ว','สุรเชษฐ์ ยุติธรรม ตอบรับเป็นกรรมการ รับ 0 แมตช์','tournament',8,0,'2026-10-08 15:45:02'),(133,24,'referee_invited','คุณได้รับเชิญเป็นกรรมการ','คุณได้รับเชิญเป็นกรรมการทัวร์นาเมนต์ \"แบดมินตัน Faculty League\"','tournament',8,0,'2026-10-08 15:45:02'),(134,12,'referee_invite_answered','กรรมการตอบรับคำเชิญแล้ว','พิมพ์ชนก เที่ยงตรง ตอบรับเป็นกรรมการ รับ 0 แมตช์','tournament',8,0,'2026-10-08 15:45:02'),(135,23,'referee_invited','คุณได้รับเชิญเป็นกรรมการ','คุณได้รับเชิญเป็นกรรมการทัวร์นาเมนต์ \"แบดมินตัน Welcome Cup\"','tournament',9,0,'2026-10-08 15:45:02'),(136,13,'referee_invite_answered','กรรมการตอบรับคำเชิญแล้ว','สุรเชษฐ์ ยุติธรรม ตอบรับเป็นกรรมการ รับ 0 แมตช์','tournament',9,0,'2026-10-08 15:45:02'),(137,24,'referee_invited','คุณได้รับเชิญเป็นกรรมการ','คุณได้รับเชิญเป็นกรรมการทัวร์นาเมนต์ \"แบดมินตัน Welcome Cup\"','tournament',9,0,'2026-10-08 15:45:02'),(138,13,'referee_invite_answered','กรรมการตอบรับคำเชิญแล้ว','พิมพ์ชนก เที่ยงตรง ตอบรับเป็นกรรมการ รับ 0 แมตช์','tournament',9,0,'2026-10-08 15:45:02'),(139,23,'referee_invited','คุณได้รับเชิญเป็นกรรมการ','คุณได้รับเชิญเป็นกรรมการทัวร์นาเมนต์ \"RoV Campus Showdown (ออนไลน์)\"','tournament',10,0,'2026-10-08 15:45:02'),(140,13,'referee_invite_answered','กรรมการตอบรับคำเชิญแล้ว','สุรเชษฐ์ ยุติธรรม ตอบรับเป็นกรรมการ รับ 0 แมตช์','tournament',10,0,'2026-10-08 15:45:02'),(141,24,'referee_invited','คุณได้รับเชิญเป็นกรรมการ','คุณได้รับเชิญเป็นกรรมการทัวร์นาเมนต์ \"RoV Campus Showdown (ออนไลน์)\"','tournament',10,0,'2026-10-08 15:45:02'),(142,13,'referee_invite_answered','กรรมการตอบรับคำเชิญแล้ว','พิมพ์ชนก เที่ยงตรง ตอบรับเป็นกรรมการ รับ 0 แมตช์','tournament',10,0,'2026-10-08 15:45:02'),(143,21,'referee_invited','คุณได้รับเชิญเป็นกรรมการ','คุณได้รับเชิญเป็นกรรมการทัวร์นาเมนต์ \"แบดมินตันกระชับมิตร (พบกันหมด)\"','tournament',11,0,'2026-10-08 15:45:02'),(144,11,'referee_invite_answered','กรรมการตอบรับคำเชิญแล้ว','วีระชัย นกหวีดทอง ตอบรับเป็นกรรมการ รับ 0 แมตช์','tournament',11,0,'2026-10-08 15:45:02'),(145,22,'referee_invited','คุณได้รับเชิญเป็นกรรมการ','คุณได้รับเชิญเป็นกรรมการทัวร์นาเมนต์ \"แบดมินตันกระชับมิตร (พบกันหมด)\"','tournament',11,0,'2026-10-08 15:45:02'),(146,11,'referee_invite_answered','กรรมการตอบรับคำเชิญแล้ว','อรทัย กฎกติกา ตอบรับเป็นกรรมการ รับ 0 แมตช์','tournament',11,0,'2026-10-08 15:45:02'),(147,21,'tournament_published','ทัวร์นาเมนต์เปิดเผยแพร่แล้ว','ทัวร์นาเมนต์ \"บาสเกตบอลหญิง ชิงถ้วยคณบดี\" ที่คุณเป็นกรรมการ เปิดเผยแพร่แล้ว','tournament',5,0,'2026-10-08 15:45:03'),(148,22,'tournament_published','ทัวร์นาเมนต์เปิดเผยแพร่แล้ว','ทัวร์นาเมนต์ \"บาสเกตบอลหญิง ชิงถ้วยคณบดี\" ที่คุณเป็นกรรมการ เปิดเผยแพร่แล้ว','tournament',5,0,'2026-10-08 15:45:03'),(149,23,'tournament_published','ทัวร์นาเมนต์เปิดเผยแพร่แล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Open รอบคัดเลือก\" ที่คุณเป็นกรรมการ เปิดเผยแพร่แล้ว','tournament',6,0,'2026-10-08 15:45:03'),(150,24,'tournament_published','ทัวร์นาเมนต์เปิดเผยแพร่แล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Open รอบคัดเลือก\" ที่คุณเป็นกรรมการ เปิดเผยแพร่แล้ว','tournament',6,0,'2026-10-08 15:45:03'),(151,21,'tournament_published','ทัวร์นาเมนต์เปิดเผยแพร่แล้ว','ทัวร์นาเมนต์ \"แบดมินตันชิงแชมป์มหาวิทยาลัย 2569\" ที่คุณเป็นกรรมการ เปิดเผยแพร่แล้ว','tournament',7,0,'2026-10-08 15:45:03'),(152,22,'tournament_published','ทัวร์นาเมนต์เปิดเผยแพร่แล้ว','ทัวร์นาเมนต์ \"แบดมินตันชิงแชมป์มหาวิทยาลัย 2569\" ที่คุณเป็นกรรมการ เปิดเผยแพร่แล้ว','tournament',7,0,'2026-10-08 15:45:03'),(153,23,'tournament_published','ทัวร์นาเมนต์เปิดเผยแพร่แล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Faculty League\" ที่คุณเป็นกรรมการ เปิดเผยแพร่แล้ว','tournament',8,0,'2026-10-08 15:45:03'),(154,24,'tournament_published','ทัวร์นาเมนต์เปิดเผยแพร่แล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Faculty League\" ที่คุณเป็นกรรมการ เปิดเผยแพร่แล้ว','tournament',8,0,'2026-10-08 15:45:03'),(155,23,'tournament_published','ทัวร์นาเมนต์เปิดเผยแพร่แล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Welcome Cup\" ที่คุณเป็นกรรมการ เปิดเผยแพร่แล้ว','tournament',9,0,'2026-10-08 15:45:03'),(156,24,'tournament_published','ทัวร์นาเมนต์เปิดเผยแพร่แล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Welcome Cup\" ที่คุณเป็นกรรมการ เปิดเผยแพร่แล้ว','tournament',9,0,'2026-10-08 15:45:03'),(157,23,'tournament_published','ทัวร์นาเมนต์เปิดเผยแพร่แล้ว','ทัวร์นาเมนต์ \"RoV Campus Showdown (ออนไลน์)\" ที่คุณเป็นกรรมการ เปิดเผยแพร่แล้ว','tournament',10,0,'2026-10-08 15:45:03'),(158,24,'tournament_published','ทัวร์นาเมนต์เปิดเผยแพร่แล้ว','ทัวร์นาเมนต์ \"RoV Campus Showdown (ออนไลน์)\" ที่คุณเป็นกรรมการ เปิดเผยแพร่แล้ว','tournament',10,0,'2026-10-08 15:45:03'),(159,21,'tournament_published','ทัวร์นาเมนต์เปิดเผยแพร่แล้ว','ทัวร์นาเมนต์ \"แบดมินตันกระชับมิตร (พบกันหมด)\" ที่คุณเป็นกรรมการ เปิดเผยแพร่แล้ว','tournament',11,0,'2026-10-08 15:45:03'),(160,22,'tournament_published','ทัวร์นาเมนต์เปิดเผยแพร่แล้ว','ทัวร์นาเมนต์ \"แบดมินตันกระชับมิตร (พบกันหมด)\" ที่คุณเป็นกรรมการ เปิดเผยแพร่แล้ว','tournament',11,0,'2026-10-08 15:45:03'),(161,105,'application_decided','ใบสมัครได้รับการอนุมัติ','ใบสมัครของทีม \"เกษตรตบสนั่น\" ได้รับการอนุมัติแล้ว','tournament',6,0,'2026-10-08 15:45:03'),(162,107,'application_decided','ใบสมัครได้รับการอนุมัติ','ใบสมัครของทีม \"BBA Birdies\" ได้รับการอนุมัติแล้ว','tournament',6,0,'2026-10-08 15:45:03'),(163,109,'application_decided','ใบสมัครได้รับการอนุมัติ','ใบสมัครของทีม \"มนุษย์ลูกขนไก่\" ได้รับการอนุมัติแล้ว','tournament',6,0,'2026-10-08 15:45:03'),(164,111,'application_decided','ใบสมัครได้รับการอนุมัติ','ใบสมัครของทีม \"Econ Rackets\" ได้รับการอนุมัติแล้ว','tournament',6,0,'2026-10-08 15:45:03'),(165,101,'application_decided','ใบสมัครได้รับการอนุมัติ','ใบสมัครของทีม \"วิศวะ Smashers\" ได้รับการอนุมัติแล้ว','tournament',7,0,'2026-10-08 15:45:03'),(166,103,'application_decided','ใบสมัครได้รับการอนุมัติ','ใบสมัครของทีม \"Sci Shuttle\" ได้รับการอนุมัติแล้ว','tournament',7,0,'2026-10-08 15:45:03'),(167,105,'application_decided','ใบสมัครได้รับการอนุมัติ','ใบสมัครของทีม \"เกษตรตบสนั่น\" ได้รับการอนุมัติแล้ว','tournament',7,0,'2026-10-08 15:45:04'),(168,107,'application_decided','ใบสมัครได้รับการอนุมัติ','ใบสมัครของทีม \"BBA Birdies\" ได้รับการอนุมัติแล้ว','tournament',7,0,'2026-10-08 15:45:04'),(169,101,'application_decided','ใบสมัครได้รับการอนุมัติ','ใบสมัครของทีม \"วิศวะ Smashers\" ได้รับการอนุมัติแล้ว','tournament',8,0,'2026-10-08 15:45:04'),(170,103,'application_decided','ใบสมัครได้รับการอนุมัติ','ใบสมัครของทีม \"Sci Shuttle\" ได้รับการอนุมัติแล้ว','tournament',8,0,'2026-10-08 15:45:04'),(171,109,'application_decided','ใบสมัครได้รับการอนุมัติ','ใบสมัครของทีม \"มนุษย์ลูกขนไก่\" ได้รับการอนุมัติแล้ว','tournament',8,0,'2026-10-08 15:45:04'),(172,111,'application_decided','ใบสมัครได้รับการอนุมัติ','ใบสมัครของทีม \"Econ Rackets\" ได้รับการอนุมัติแล้ว','tournament',8,0,'2026-10-08 15:45:04'),(173,105,'application_decided','ใบสมัครได้รับการอนุมัติ','ใบสมัครของทีม \"เกษตรตบสนั่น\" ได้รับการอนุมัติแล้ว','tournament',9,0,'2026-10-08 15:45:04'),(174,107,'application_decided','ใบสมัครได้รับการอนุมัติ','ใบสมัครของทีม \"BBA Birdies\" ได้รับการอนุมัติแล้ว','tournament',9,0,'2026-10-08 15:45:04'),(175,109,'application_decided','ใบสมัครได้รับการอนุมัติ','ใบสมัครของทีม \"มนุษย์ลูกขนไก่\" ได้รับการอนุมัติแล้ว','tournament',9,0,'2026-10-08 15:45:04'),(176,111,'application_decided','ใบสมัครได้รับการอนุมัติ','ใบสมัครของทีม \"Econ Rackets\" ได้รับการอนุมัติแล้ว','tournament',9,0,'2026-10-08 15:45:04'),(177,135,'application_decided','ใบสมัครได้รับการอนุมัติ','ใบสมัครของทีม \"RoV วิศวะ Dragons\" ได้รับการอนุมัติแล้ว','tournament',10,0,'2026-10-08 15:45:04'),(178,140,'application_decided','ใบสมัครได้รับการอนุมัติ','ใบสมัครของทีม \"RoV Sci Phoenix\" ได้รับการอนุมัติแล้ว','tournament',10,0,'2026-10-08 15:45:04'),(179,101,'application_decided','ใบสมัครได้รับการอนุมัติ','ใบสมัครของทีม \"วิศวะ Smashers\" ได้รับการอนุมัติแล้ว','tournament',11,0,'2026-10-08 15:45:04'),(180,103,'application_decided','ใบสมัครได้รับการอนุมัติ','ใบสมัครของทีม \"Sci Shuttle\" ได้รับการอนุมัติแล้ว','tournament',11,0,'2026-10-08 15:45:04'),(181,105,'application_decided','ใบสมัครได้รับการอนุมัติ','ใบสมัครของทีม \"เกษตรตบสนั่น\" ได้รับการอนุมัติแล้ว','tournament',11,0,'2026-10-08 15:45:04'),(182,107,'application_decided','ใบสมัครได้รับการอนุมัติ','ใบสมัครของทีม \"BBA Birdies\" ได้รับการอนุมัติแล้ว','tournament',11,0,'2026-10-08 15:45:05'),(183,105,'registration_toggled','ปิดรับสมัครแล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Open รอบคัดเลือก\" ปิดรับสมัครแล้ว','tournament',6,0,'2026-10-08 15:45:05'),(184,107,'registration_toggled','ปิดรับสมัครแล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Open รอบคัดเลือก\" ปิดรับสมัครแล้ว','tournament',6,0,'2026-10-08 15:45:05'),(185,109,'registration_toggled','ปิดรับสมัครแล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Open รอบคัดเลือก\" ปิดรับสมัครแล้ว','tournament',6,0,'2026-10-08 15:45:05'),(186,111,'registration_toggled','ปิดรับสมัครแล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Open รอบคัดเลือก\" ปิดรับสมัครแล้ว','tournament',6,0,'2026-10-08 15:45:05'),(187,101,'registration_toggled','ปิดรับสมัครแล้ว','ทัวร์นาเมนต์ \"แบดมินตันชิงแชมป์มหาวิทยาลัย 2569\" ปิดรับสมัครแล้ว','tournament',7,0,'2026-10-08 15:45:05'),(188,103,'registration_toggled','ปิดรับสมัครแล้ว','ทัวร์นาเมนต์ \"แบดมินตันชิงแชมป์มหาวิทยาลัย 2569\" ปิดรับสมัครแล้ว','tournament',7,0,'2026-10-08 15:45:05'),(189,105,'registration_toggled','ปิดรับสมัครแล้ว','ทัวร์นาเมนต์ \"แบดมินตันชิงแชมป์มหาวิทยาลัย 2569\" ปิดรับสมัครแล้ว','tournament',7,0,'2026-10-08 15:45:05'),(190,107,'registration_toggled','ปิดรับสมัครแล้ว','ทัวร์นาเมนต์ \"แบดมินตันชิงแชมป์มหาวิทยาลัย 2569\" ปิดรับสมัครแล้ว','tournament',7,0,'2026-10-08 15:45:05'),(191,101,'registration_toggled','ปิดรับสมัครแล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Faculty League\" ปิดรับสมัครแล้ว','tournament',8,0,'2026-10-08 15:45:05'),(192,103,'registration_toggled','ปิดรับสมัครแล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Faculty League\" ปิดรับสมัครแล้ว','tournament',8,0,'2026-10-08 15:45:05'),(193,109,'registration_toggled','ปิดรับสมัครแล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Faculty League\" ปิดรับสมัครแล้ว','tournament',8,0,'2026-10-08 15:45:05'),(194,111,'registration_toggled','ปิดรับสมัครแล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Faculty League\" ปิดรับสมัครแล้ว','tournament',8,0,'2026-10-08 15:45:05'),(195,105,'registration_toggled','ปิดรับสมัครแล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Welcome Cup\" ปิดรับสมัครแล้ว','tournament',9,0,'2026-10-08 15:45:05'),(196,107,'registration_toggled','ปิดรับสมัครแล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Welcome Cup\" ปิดรับสมัครแล้ว','tournament',9,0,'2026-10-08 15:45:05'),(197,109,'registration_toggled','ปิดรับสมัครแล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Welcome Cup\" ปิดรับสมัครแล้ว','tournament',9,0,'2026-10-08 15:45:05'),(198,111,'registration_toggled','ปิดรับสมัครแล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Welcome Cup\" ปิดรับสมัครแล้ว','tournament',9,0,'2026-10-08 15:45:05'),(199,135,'registration_toggled','ปิดรับสมัครแล้ว','ทัวร์นาเมนต์ \"RoV Campus Showdown (ออนไลน์)\" ปิดรับสมัครแล้ว','tournament',10,0,'2026-10-08 15:45:05'),(200,140,'registration_toggled','ปิดรับสมัครแล้ว','ทัวร์นาเมนต์ \"RoV Campus Showdown (ออนไลน์)\" ปิดรับสมัครแล้ว','tournament',10,0,'2026-10-08 15:45:05'),(201,101,'registration_toggled','ปิดรับสมัครแล้ว','ทัวร์นาเมนต์ \"แบดมินตันกระชับมิตร (พบกันหมด)\" ปิดรับสมัครแล้ว','tournament',11,0,'2026-10-08 15:45:05'),(202,103,'registration_toggled','ปิดรับสมัครแล้ว','ทัวร์นาเมนต์ \"แบดมินตันกระชับมิตร (พบกันหมด)\" ปิดรับสมัครแล้ว','tournament',11,0,'2026-10-08 15:45:05'),(203,105,'registration_toggled','ปิดรับสมัครแล้ว','ทัวร์นาเมนต์ \"แบดมินตันกระชับมิตร (พบกันหมด)\" ปิดรับสมัครแล้ว','tournament',11,0,'2026-10-08 15:45:05'),(204,107,'registration_toggled','ปิดรับสมัครแล้ว','ทัวร์นาเมนต์ \"แบดมินตันกระชับมิตร (พบกันหมด)\" ปิดรับสมัครแล้ว','tournament',11,0,'2026-10-08 15:45:05'),(205,101,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตันชิงแชมป์มหาวิทยาลัย 2569\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',7,0,'2026-10-08 15:45:05'),(206,102,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตันชิงแชมป์มหาวิทยาลัย 2569\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',7,0,'2026-10-08 15:45:05'),(207,103,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตันชิงแชมป์มหาวิทยาลัย 2569\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',7,0,'2026-10-08 15:45:05'),(208,104,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตันชิงแชมป์มหาวิทยาลัย 2569\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',7,0,'2026-10-08 15:45:05'),(209,105,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตันชิงแชมป์มหาวิทยาลัย 2569\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',7,0,'2026-10-08 15:45:05'),(210,106,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตันชิงแชมป์มหาวิทยาลัย 2569\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',7,0,'2026-10-08 15:45:05'),(211,107,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตันชิงแชมป์มหาวิทยาลัย 2569\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',7,0,'2026-10-08 15:45:05'),(212,108,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตันชิงแชมป์มหาวิทยาลัย 2569\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',7,0,'2026-10-08 15:45:05'),(213,101,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Faculty League\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',8,0,'2026-10-08 15:45:06'),(214,102,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Faculty League\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',8,0,'2026-10-08 15:45:06'),(215,103,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Faculty League\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',8,0,'2026-10-08 15:45:06'),(216,104,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Faculty League\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',8,0,'2026-10-08 15:45:06'),(217,109,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Faculty League\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',8,0,'2026-10-08 15:45:06'),(218,110,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Faculty League\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',8,0,'2026-10-08 15:45:06'),(219,111,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Faculty League\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',8,0,'2026-10-08 15:45:06'),(220,112,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Faculty League\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',8,0,'2026-10-08 15:45:06'),(221,105,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Welcome Cup\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',9,0,'2026-10-08 15:45:06'),(222,106,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Welcome Cup\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',9,0,'2026-10-08 15:45:06'),(223,107,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Welcome Cup\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',9,0,'2026-10-08 15:45:06'),(224,108,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Welcome Cup\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',9,0,'2026-10-08 15:45:07'),(225,109,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Welcome Cup\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',9,0,'2026-10-08 15:45:07'),(226,110,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Welcome Cup\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',9,0,'2026-10-08 15:45:07'),(227,111,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Welcome Cup\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',9,0,'2026-10-08 15:45:07'),(228,112,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตัน Welcome Cup\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',9,0,'2026-10-08 15:45:07'),(229,135,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"RoV Campus Showdown (ออนไลน์)\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',10,0,'2026-10-08 15:45:07'),(230,136,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"RoV Campus Showdown (ออนไลน์)\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',10,0,'2026-10-08 15:45:07'),(231,137,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"RoV Campus Showdown (ออนไลน์)\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',10,0,'2026-10-08 15:45:07'),(232,138,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"RoV Campus Showdown (ออนไลน์)\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',10,0,'2026-10-08 15:45:07'),(233,139,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"RoV Campus Showdown (ออนไลน์)\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',10,0,'2026-10-08 15:45:07'),(234,140,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"RoV Campus Showdown (ออนไลน์)\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',10,0,'2026-10-08 15:45:07'),(235,141,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"RoV Campus Showdown (ออนไลน์)\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',10,0,'2026-10-08 15:45:07'),(236,142,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"RoV Campus Showdown (ออนไลน์)\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',10,0,'2026-10-08 15:45:07'),(237,143,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"RoV Campus Showdown (ออนไลน์)\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',10,0,'2026-10-08 15:45:07'),(238,144,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"RoV Campus Showdown (ออนไลน์)\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',10,0,'2026-10-08 15:45:07'),(239,101,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตันกระชับมิตร (พบกันหมด)\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',11,0,'2026-10-08 15:45:07'),(240,102,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตันกระชับมิตร (พบกันหมด)\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',11,0,'2026-10-08 15:45:07'),(241,103,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตันกระชับมิตร (พบกันหมด)\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',11,0,'2026-10-08 15:45:07'),(242,104,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตันกระชับมิตร (พบกันหมด)\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',11,0,'2026-10-08 15:45:08'),(243,105,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตันกระชับมิตร (พบกันหมด)\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',11,0,'2026-10-08 15:45:08'),(244,106,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตันกระชับมิตร (พบกันหมด)\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',11,0,'2026-10-08 15:45:08'),(245,107,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตันกระชับมิตร (พบกันหมด)\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',11,0,'2026-10-08 15:45:08'),(246,108,'bracket_created','สายการแข่งขันออกแล้ว','ทัวร์นาเมนต์ \"แบดมินตันกระชับมิตร (พบกันหมด)\" จัดสายการแข่งขันแล้ว — ดูคู่แข่งและรอบของทีมคุณได้เลย','tournament',11,0,'2026-10-08 15:45:08'),(247,105,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #7 แข่ง 9 ต.ค. 2569 01:44 ที่ โรงยิม 4 คอร์ต A','match',7,0,'2026-10-08 15:45:10'),(248,106,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #7 แข่ง 9 ต.ค. 2569 01:44 ที่ โรงยิม 4 คอร์ต A','match',7,0,'2026-10-08 15:45:10'),(249,107,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #7 แข่ง 9 ต.ค. 2569 01:44 ที่ โรงยิม 4 คอร์ต A','match',7,0,'2026-10-08 15:45:10'),(250,108,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #7 แข่ง 9 ต.ค. 2569 01:44 ที่ โรงยิม 4 คอร์ต A','match',7,0,'2026-10-08 15:45:10'),(251,23,'referee_change_request','ผู้จัดขอให้คุณคุมแมตช์เพิ่ม','ผู้จัดขอให้คุณเป็นกรรมการแมตช์ #7 เพิ่ม','match',7,0,'2026-10-08 15:45:10'),(252,13,'referee_assigned','เปลี่ยนกรรมการสำเร็จ','ทุกฝ่ายตกลงแล้ว กรรมการของแมตช์ #7 ถูกเปลี่ยนตามคำขอ','match',7,0,'2026-10-08 15:45:10'),(253,24,'referee_change_request','ผู้จัดขอให้คุณคุมแมตช์เพิ่ม','ผู้จัดขอให้คุณเป็นกรรมการแมตช์ #7 เพิ่ม','match',7,0,'2026-10-08 15:45:10'),(254,13,'referee_assigned','เปลี่ยนกรรมการสำเร็จ','ทุกฝ่ายตกลงแล้ว กรรมการของแมตช์ #7 ถูกเปลี่ยนตามคำขอ','match',7,0,'2026-10-08 15:45:10'),(255,109,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #8 แข่ง 9 ต.ค. 2569 03:44 ที่ โรงยิม 4 คอร์ต B','match',8,0,'2026-10-08 15:45:10'),(256,110,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #8 แข่ง 9 ต.ค. 2569 03:44 ที่ โรงยิม 4 คอร์ต B','match',8,0,'2026-10-08 15:45:10'),(257,111,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #8 แข่ง 9 ต.ค. 2569 03:44 ที่ โรงยิม 4 คอร์ต B','match',8,0,'2026-10-08 15:45:10'),(258,112,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #8 แข่ง 9 ต.ค. 2569 03:44 ที่ โรงยิม 4 คอร์ต B','match',8,0,'2026-10-08 15:45:10'),(259,23,'referee_change_request','ผู้จัดขอให้คุณคุมแมตช์เพิ่ม','ผู้จัดขอให้คุณเป็นกรรมการแมตช์ #8 เพิ่ม','match',8,0,'2026-10-08 15:45:10'),(260,13,'referee_assigned','เปลี่ยนกรรมการสำเร็จ','ทุกฝ่ายตกลงแล้ว กรรมการของแมตช์ #8 ถูกเปลี่ยนตามคำขอ','match',8,0,'2026-10-08 15:45:10'),(261,24,'referee_change_request','ผู้จัดขอให้คุณคุมแมตช์เพิ่ม','ผู้จัดขอให้คุณเป็นกรรมการแมตช์ #8 เพิ่ม','match',8,0,'2026-10-08 15:45:10'),(262,13,'referee_assigned','เปลี่ยนกรรมการสำเร็จ','ทุกฝ่ายตกลงแล้ว กรรมการของแมตช์ #8 ถูกเปลี่ยนตามคำขอ','match',8,0,'2026-10-08 15:45:11'),(263,105,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #7 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',7,0,'2026-10-08 15:45:11'),(264,106,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #7 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',7,0,'2026-10-08 15:45:11'),(265,107,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #7 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',7,0,'2026-10-08 15:45:11'),(266,108,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #7 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',7,0,'2026-10-08 15:45:11'),(267,23,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #7 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',7,0,'2026-10-08 15:45:11'),(268,24,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #7 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',7,0,'2026-10-08 15:45:11'),(269,105,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #7 จบการแข่งขันแล้ว รอการส่งผล','match',7,0,'2026-10-08 15:45:11'),(270,106,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #7 จบการแข่งขันแล้ว รอการส่งผล','match',7,0,'2026-10-08 15:45:11'),(271,107,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #7 จบการแข่งขันแล้ว รอการส่งผล','match',7,0,'2026-10-08 15:45:11'),(272,108,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #7 จบการแข่งขันแล้ว รอการส่งผล','match',7,0,'2026-10-08 15:45:11'),(273,23,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #7 จบการแข่งขันแล้ว รอการส่งผล','match',7,0,'2026-10-08 15:45:11'),(274,24,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #7 จบการแข่งขันแล้ว รอการส่งผล','match',7,0,'2026-10-08 15:45:11'),(275,105,'result_submitted','มีการส่งผลการแข่งขัน','ผลการแข่งขันแมตช์ #7 ถูกส่งแล้ว รอการยืนยัน','match',7,0,'2026-10-08 15:45:11'),(276,107,'result_submitted','มีการส่งผลการแข่งขัน','ผลการแข่งขันแมตช์ #7 ถูกส่งแล้ว รอการยืนยัน','match',7,0,'2026-10-08 15:45:11'),(277,24,'result_submitted','มีการส่งผลการแข่งขัน','ผลการแข่งขันแมตช์ #7 ถูกส่งแล้ว รอการยืนยัน','match',7,0,'2026-10-08 15:45:11'),(278,107,'result_verified','ผลการแข่งขันยืนยันแล้ว','ผลการแข่งขันแมตช์ #7 ได้รับการยืนยันแล้ว','match',7,0,'2026-10-08 15:45:11'),(279,23,'result_verified','ผลการแข่งขันยืนยันแล้ว','ผลการแข่งขันแมตช์ #7 ได้รับการยืนยันแล้ว','match',7,0,'2026-10-08 15:45:12'),(280,24,'result_verified','ผลการแข่งขันยืนยันแล้ว','ผลการแข่งขันแมตช์ #7 ได้รับการยืนยันแล้ว','match',7,0,'2026-10-08 15:45:12'),(281,109,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #8 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',8,0,'2026-10-08 15:45:12'),(282,110,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #8 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',8,0,'2026-10-08 15:45:12'),(283,111,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #8 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',8,0,'2026-10-08 15:45:12'),(284,112,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #8 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',8,0,'2026-10-08 15:45:12'),(285,23,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #8 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',8,0,'2026-10-08 15:45:12'),(286,24,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #8 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',8,0,'2026-10-08 15:45:12'),(287,109,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #8 จบการแข่งขันแล้ว รอการส่งผล','match',8,0,'2026-10-08 15:45:13'),(288,110,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #8 จบการแข่งขันแล้ว รอการส่งผล','match',8,0,'2026-10-08 15:45:13'),(289,111,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #8 จบการแข่งขันแล้ว รอการส่งผล','match',8,0,'2026-10-08 15:45:13'),(290,112,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #8 จบการแข่งขันแล้ว รอการส่งผล','match',8,0,'2026-10-08 15:45:13'),(291,23,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #8 จบการแข่งขันแล้ว รอการส่งผล','match',8,0,'2026-10-08 15:45:13'),(292,24,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #8 จบการแข่งขันแล้ว รอการส่งผล','match',8,0,'2026-10-08 15:45:13'),(293,109,'result_submitted','มีการส่งผลการแข่งขัน','ผลการแข่งขันแมตช์ #8 ถูกส่งแล้ว รอการยืนยัน','match',8,0,'2026-10-08 15:45:13'),(294,111,'result_submitted','มีการส่งผลการแข่งขัน','ผลการแข่งขันแมตช์ #8 ถูกส่งแล้ว รอการยืนยัน','match',8,0,'2026-10-08 15:45:13'),(295,24,'result_submitted','มีการส่งผลการแข่งขัน','ผลการแข่งขันแมตช์ #8 ถูกส่งแล้ว รอการยืนยัน','match',8,0,'2026-10-08 15:45:13'),(296,111,'result_verified','ผลการแข่งขันยืนยันแล้ว','ผลการแข่งขันแมตช์ #8 ได้รับการยืนยันแล้ว','match',8,0,'2026-10-08 15:45:13'),(297,23,'result_verified','ผลการแข่งขันยืนยันแล้ว','ผลการแข่งขันแมตช์ #8 ได้รับการยืนยันแล้ว','match',8,0,'2026-10-08 15:45:13'),(298,24,'result_verified','ผลการแข่งขันยืนยันแล้ว','ผลการแข่งขันแมตช์ #8 ได้รับการยืนยันแล้ว','match',8,0,'2026-10-08 15:45:13'),(299,105,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #9 แข่ง 9 ต.ค. 2569 05:44 ที่ โรงยิม 4 คอร์ต A','match',9,0,'2026-10-08 15:45:13'),(300,106,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #9 แข่ง 9 ต.ค. 2569 05:44 ที่ โรงยิม 4 คอร์ต A','match',9,0,'2026-10-08 15:45:13'),(301,109,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #9 แข่ง 9 ต.ค. 2569 05:44 ที่ โรงยิม 4 คอร์ต A','match',9,0,'2026-10-08 15:45:13'),(302,110,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #9 แข่ง 9 ต.ค. 2569 05:44 ที่ โรงยิม 4 คอร์ต A','match',9,0,'2026-10-08 15:45:13'),(303,23,'referee_change_request','ผู้จัดขอให้คุณคุมแมตช์เพิ่ม','ผู้จัดขอให้คุณเป็นกรรมการแมตช์ #9 เพิ่ม','match',9,0,'2026-10-08 15:45:13'),(304,13,'referee_assigned','เปลี่ยนกรรมการสำเร็จ','ทุกฝ่ายตกลงแล้ว กรรมการของแมตช์ #9 ถูกเปลี่ยนตามคำขอ','match',9,0,'2026-10-08 15:45:13'),(305,24,'referee_change_request','ผู้จัดขอให้คุณคุมแมตช์เพิ่ม','ผู้จัดขอให้คุณเป็นกรรมการแมตช์ #9 เพิ่ม','match',9,0,'2026-10-08 15:45:13'),(306,13,'referee_assigned','เปลี่ยนกรรมการสำเร็จ','ทุกฝ่ายตกลงแล้ว กรรมการของแมตช์ #9 ถูกเปลี่ยนตามคำขอ','match',9,0,'2026-10-08 15:45:14'),(307,105,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #9 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',9,0,'2026-10-08 15:45:14'),(308,106,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #9 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',9,0,'2026-10-08 15:45:14'),(309,109,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #9 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',9,0,'2026-10-08 15:45:14'),(310,110,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #9 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',9,0,'2026-10-08 15:45:14'),(311,23,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #9 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',9,0,'2026-10-08 15:45:14'),(312,24,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #9 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',9,0,'2026-10-08 15:45:14'),(313,105,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #9 จบการแข่งขันแล้ว รอการส่งผล','match',9,0,'2026-10-08 15:45:14'),(314,106,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #9 จบการแข่งขันแล้ว รอการส่งผล','match',9,0,'2026-10-08 15:45:14'),(315,109,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #9 จบการแข่งขันแล้ว รอการส่งผล','match',9,0,'2026-10-08 15:45:14'),(316,110,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #9 จบการแข่งขันแล้ว รอการส่งผล','match',9,0,'2026-10-08 15:45:14'),(317,23,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #9 จบการแข่งขันแล้ว รอการส่งผล','match',9,0,'2026-10-08 15:45:14'),(318,24,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #9 จบการแข่งขันแล้ว รอการส่งผล','match',9,0,'2026-10-08 15:45:14'),(319,105,'result_submitted','มีการส่งผลการแข่งขัน','ผลการแข่งขันแมตช์ #9 ถูกส่งแล้ว รอการยืนยัน','match',9,0,'2026-10-08 15:45:14'),(320,109,'result_submitted','มีการส่งผลการแข่งขัน','ผลการแข่งขันแมตช์ #9 ถูกส่งแล้ว รอการยืนยัน','match',9,0,'2026-10-08 15:45:14'),(321,23,'result_submitted','มีการส่งผลการแข่งขัน','ผลการแข่งขันแมตช์ #9 ถูกส่งแล้ว รอการยืนยัน','match',9,0,'2026-10-08 15:45:14'),(322,105,'result_verified','ผลการแข่งขันยืนยันแล้ว','ผลการแข่งขันแมตช์ #9 ได้รับการยืนยันแล้ว','match',9,0,'2026-10-08 15:45:14'),(323,23,'result_verified','ผลการแข่งขันยืนยันแล้ว','ผลการแข่งขันแมตช์ #9 ได้รับการยืนยันแล้ว','match',9,0,'2026-10-08 15:45:14'),(324,24,'result_verified','ผลการแข่งขันยืนยันแล้ว','ผลการแข่งขันแมตช์ #9 ได้รับการยืนยันแล้ว','match',9,0,'2026-10-08 15:45:14'),(325,109,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #4 แข่ง 9 ต.ค. 2569 01:44 ที่ โรงยิม 2 คอร์ต A','match',4,0,'2026-10-08 15:45:16'),(326,110,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #4 แข่ง 9 ต.ค. 2569 01:44 ที่ โรงยิม 2 คอร์ต A','match',4,0,'2026-10-08 15:45:16'),(327,111,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #4 แข่ง 9 ต.ค. 2569 01:44 ที่ โรงยิม 2 คอร์ต A','match',4,0,'2026-10-08 15:45:16'),(328,112,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #4 แข่ง 9 ต.ค. 2569 01:44 ที่ โรงยิม 2 คอร์ต A','match',4,0,'2026-10-08 15:45:16'),(329,23,'referee_change_request','ผู้จัดขอให้คุณคุมแมตช์เพิ่ม','ผู้จัดขอให้คุณเป็นกรรมการแมตช์ #4 เพิ่ม','match',4,0,'2026-10-08 15:45:16'),(330,12,'referee_assigned','เปลี่ยนกรรมการสำเร็จ','ทุกฝ่ายตกลงแล้ว กรรมการของแมตช์ #4 ถูกเปลี่ยนตามคำขอ','match',4,0,'2026-10-08 15:45:16'),(331,24,'referee_change_request','ผู้จัดขอให้คุณคุมแมตช์เพิ่ม','ผู้จัดขอให้คุณเป็นกรรมการแมตช์ #4 เพิ่ม','match',4,0,'2026-10-08 15:45:16'),(332,12,'referee_assigned','เปลี่ยนกรรมการสำเร็จ','ทุกฝ่ายตกลงแล้ว กรรมการของแมตช์ #4 ถูกเปลี่ยนตามคำขอ','match',4,0,'2026-10-08 15:45:16'),(333,101,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #5 แข่ง 9 ต.ค. 2569 03:44 ที่ โรงยิม 2 คอร์ต A','match',5,0,'2026-10-08 15:45:16'),(334,102,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #5 แข่ง 9 ต.ค. 2569 03:44 ที่ โรงยิม 2 คอร์ต A','match',5,0,'2026-10-08 15:45:16'),(335,103,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #5 แข่ง 9 ต.ค. 2569 03:44 ที่ โรงยิม 2 คอร์ต A','match',5,0,'2026-10-08 15:45:16'),(336,104,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #5 แข่ง 9 ต.ค. 2569 03:44 ที่ โรงยิม 2 คอร์ต A','match',5,0,'2026-10-08 15:45:16'),(337,23,'referee_change_request','ผู้จัดขอให้คุณคุมแมตช์เพิ่ม','ผู้จัดขอให้คุณเป็นกรรมการแมตช์ #5 เพิ่ม','match',5,0,'2026-10-08 15:45:16'),(338,12,'referee_assigned','เปลี่ยนกรรมการสำเร็จ','ทุกฝ่ายตกลงแล้ว กรรมการของแมตช์ #5 ถูกเปลี่ยนตามคำขอ','match',5,0,'2026-10-08 15:45:16'),(339,24,'referee_change_request','ผู้จัดขอให้คุณคุมแมตช์เพิ่ม','ผู้จัดขอให้คุณเป็นกรรมการแมตช์ #5 เพิ่ม','match',5,0,'2026-10-08 15:45:16'),(340,12,'referee_assigned','เปลี่ยนกรรมการสำเร็จ','ทุกฝ่ายตกลงแล้ว กรรมการของแมตช์ #5 ถูกเปลี่ยนตามคำขอ','match',5,0,'2026-10-08 15:45:16'),(341,109,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #4 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',4,0,'2026-10-08 15:45:17'),(342,110,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #4 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',4,0,'2026-10-08 15:45:17'),(343,111,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #4 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',4,0,'2026-10-08 15:45:17'),(344,112,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #4 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',4,0,'2026-10-08 15:45:17'),(345,23,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #4 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',4,0,'2026-10-08 15:45:17'),(346,24,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #4 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',4,0,'2026-10-08 15:45:17'),(347,109,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #4 จบการแข่งขันแล้ว รอการส่งผล','match',4,0,'2026-10-08 15:45:17'),(348,110,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #4 จบการแข่งขันแล้ว รอการส่งผล','match',4,0,'2026-10-08 15:45:17'),(349,111,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #4 จบการแข่งขันแล้ว รอการส่งผล','match',4,0,'2026-10-08 15:45:17'),(350,112,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #4 จบการแข่งขันแล้ว รอการส่งผล','match',4,0,'2026-10-08 15:45:17'),(351,23,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #4 จบการแข่งขันแล้ว รอการส่งผล','match',4,0,'2026-10-08 15:45:17'),(352,24,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #4 จบการแข่งขันแล้ว รอการส่งผล','match',4,0,'2026-10-08 15:45:17'),(353,109,'result_submitted','มีการส่งผลการแข่งขัน','ผลการแข่งขันแมตช์ #4 ถูกส่งแล้ว รอการยืนยัน','match',4,0,'2026-10-08 15:45:17'),(354,111,'result_submitted','มีการส่งผลการแข่งขัน','ผลการแข่งขันแมตช์ #4 ถูกส่งแล้ว รอการยืนยัน','match',4,0,'2026-10-08 15:45:17'),(355,24,'result_submitted','มีการส่งผลการแข่งขัน','ผลการแข่งขันแมตช์ #4 ถูกส่งแล้ว รอการยืนยัน','match',4,0,'2026-10-08 15:45:17'),(356,109,'result_verified','ผลการแข่งขันยืนยันแล้ว','ผลการแข่งขันแมตช์ #4 ได้รับการยืนยันแล้ว','match',4,0,'2026-10-08 15:45:17'),(357,23,'result_verified','ผลการแข่งขันยืนยันแล้ว','ผลการแข่งขันแมตช์ #4 ได้รับการยืนยันแล้ว','match',4,0,'2026-10-08 15:45:17'),(358,24,'result_verified','ผลการแข่งขันยืนยันแล้ว','ผลการแข่งขันแมตช์ #4 ได้รับการยืนยันแล้ว','match',4,0,'2026-10-08 15:45:17'),(359,101,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #5 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',5,0,'2026-10-08 15:45:18'),(360,102,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #5 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',5,0,'2026-10-08 15:45:18'),(361,103,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #5 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',5,0,'2026-10-08 15:45:18'),(362,104,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #5 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',5,0,'2026-10-08 15:45:18'),(363,23,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #5 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',5,0,'2026-10-08 15:45:18'),(364,24,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #5 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',5,0,'2026-10-08 15:45:18'),(365,101,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #5 จบการแข่งขันแล้ว รอการส่งผล','match',5,0,'2026-10-08 15:45:18'),(366,102,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #5 จบการแข่งขันแล้ว รอการส่งผล','match',5,0,'2026-10-08 15:45:18'),(367,103,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #5 จบการแข่งขันแล้ว รอการส่งผล','match',5,0,'2026-10-08 15:45:18'),(368,104,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #5 จบการแข่งขันแล้ว รอการส่งผล','match',5,0,'2026-10-08 15:45:18'),(369,23,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #5 จบการแข่งขันแล้ว รอการส่งผล','match',5,0,'2026-10-08 15:45:18'),(370,24,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #5 จบการแข่งขันแล้ว รอการส่งผล','match',5,0,'2026-10-08 15:45:18'),(371,101,'result_submitted','มีการส่งผลการแข่งขัน','ผลการแข่งขันแมตช์ #5 ถูกส่งแล้ว รอการยืนยัน','match',5,0,'2026-10-08 15:45:18'),(372,103,'result_submitted','มีการส่งผลการแข่งขัน','ผลการแข่งขันแมตช์ #5 ถูกส่งแล้ว รอการยืนยัน','match',5,0,'2026-10-08 15:45:18'),(373,23,'result_submitted','มีการส่งผลการแข่งขัน','ผลการแข่งขันแมตช์ #5 ถูกส่งแล้ว รอการยืนยัน','match',5,0,'2026-10-08 15:45:18'),(374,101,'tournament_announcement','ประกาศผลการแข่งขัน: ผลรอบรองชนะเลิศคู่แรก','Econ Rackets ชนะ มนุษย์ลูกขนไก่ 2–1 เข้ารอบชิงชนะเลิศ','tournament',8,0,'2026-10-08 15:45:19'),(375,102,'tournament_announcement','ประกาศผลการแข่งขัน: ผลรอบรองชนะเลิศคู่แรก','Econ Rackets ชนะ มนุษย์ลูกขนไก่ 2–1 เข้ารอบชิงชนะเลิศ','tournament',8,0,'2026-10-08 15:45:19'),(376,103,'tournament_announcement','ประกาศผลการแข่งขัน: ผลรอบรองชนะเลิศคู่แรก','Econ Rackets ชนะ มนุษย์ลูกขนไก่ 2–1 เข้ารอบชิงชนะเลิศ','tournament',8,0,'2026-10-08 15:45:19'),(377,104,'tournament_announcement','ประกาศผลการแข่งขัน: ผลรอบรองชนะเลิศคู่แรก','Econ Rackets ชนะ มนุษย์ลูกขนไก่ 2–1 เข้ารอบชิงชนะเลิศ','tournament',8,0,'2026-10-08 15:45:19'),(378,109,'tournament_announcement','ประกาศผลการแข่งขัน: ผลรอบรองชนะเลิศคู่แรก','Econ Rackets ชนะ มนุษย์ลูกขนไก่ 2–1 เข้ารอบชิงชนะเลิศ','tournament',8,0,'2026-10-08 15:45:19'),(379,110,'tournament_announcement','ประกาศผลการแข่งขัน: ผลรอบรองชนะเลิศคู่แรก','Econ Rackets ชนะ มนุษย์ลูกขนไก่ 2–1 เข้ารอบชิงชนะเลิศ','tournament',8,0,'2026-10-08 15:45:19'),(380,111,'tournament_announcement','ประกาศผลการแข่งขัน: ผลรอบรองชนะเลิศคู่แรก','Econ Rackets ชนะ มนุษย์ลูกขนไก่ 2–1 เข้ารอบชิงชนะเลิศ','tournament',8,0,'2026-10-08 15:45:19'),(381,112,'tournament_announcement','ประกาศผลการแข่งขัน: ผลรอบรองชนะเลิศคู่แรก','Econ Rackets ชนะ มนุษย์ลูกขนไก่ 2–1 เข้ารอบชิงชนะเลิศ','tournament',8,0,'2026-10-08 15:45:19'),(382,23,'tournament_announcement','ประกาศผลการแข่งขัน: ผลรอบรองชนะเลิศคู่แรก','Econ Rackets ชนะ มนุษย์ลูกขนไก่ 2–1 เข้ารอบชิงชนะเลิศ','tournament',8,0,'2026-10-08 15:45:19'),(383,24,'tournament_announcement','ประกาศผลการแข่งขัน: ผลรอบรองชนะเลิศคู่แรก','Econ Rackets ชนะ มนุษย์ลูกขนไก่ 2–1 เข้ารอบชิงชนะเลิศ','tournament',8,0,'2026-10-08 15:45:19'),(384,101,'tournament_announcement_urgent','เปลี่ยนสนามแข่ง: ย้ายสนามรอบชิง','รอบชิงชนะเลิศย้ายไปแข่งที่โรงยิม 1 คอร์ตกลาง','tournament',8,0,'2026-10-08 15:45:19'),(385,102,'tournament_announcement_urgent','เปลี่ยนสนามแข่ง: ย้ายสนามรอบชิง','รอบชิงชนะเลิศย้ายไปแข่งที่โรงยิม 1 คอร์ตกลาง','tournament',8,0,'2026-10-08 15:45:19'),(386,103,'tournament_announcement_urgent','เปลี่ยนสนามแข่ง: ย้ายสนามรอบชิง','รอบชิงชนะเลิศย้ายไปแข่งที่โรงยิม 1 คอร์ตกลาง','tournament',8,0,'2026-10-08 15:45:19'),(387,104,'tournament_announcement_urgent','เปลี่ยนสนามแข่ง: ย้ายสนามรอบชิง','รอบชิงชนะเลิศย้ายไปแข่งที่โรงยิม 1 คอร์ตกลาง','tournament',8,0,'2026-10-08 15:45:19'),(388,109,'tournament_announcement_urgent','เปลี่ยนสนามแข่ง: ย้ายสนามรอบชิง','รอบชิงชนะเลิศย้ายไปแข่งที่โรงยิม 1 คอร์ตกลาง','tournament',8,0,'2026-10-08 15:45:19'),(389,110,'tournament_announcement_urgent','เปลี่ยนสนามแข่ง: ย้ายสนามรอบชิง','รอบชิงชนะเลิศย้ายไปแข่งที่โรงยิม 1 คอร์ตกลาง','tournament',8,0,'2026-10-08 15:45:19'),(390,111,'tournament_announcement_urgent','เปลี่ยนสนามแข่ง: ย้ายสนามรอบชิง','รอบชิงชนะเลิศย้ายไปแข่งที่โรงยิม 1 คอร์ตกลาง','tournament',8,0,'2026-10-08 15:45:19'),(391,112,'tournament_announcement_urgent','เปลี่ยนสนามแข่ง: ย้ายสนามรอบชิง','รอบชิงชนะเลิศย้ายไปแข่งที่โรงยิม 1 คอร์ตกลาง','tournament',8,0,'2026-10-08 15:45:19'),(392,23,'tournament_announcement_urgent','เปลี่ยนสนามแข่ง: ย้ายสนามรอบชิง','รอบชิงชนะเลิศย้ายไปแข่งที่โรงยิม 1 คอร์ตกลาง','tournament',8,0,'2026-10-08 15:45:19'),(393,24,'tournament_announcement_urgent','เปลี่ยนสนามแข่ง: ย้ายสนามรอบชิง','รอบชิงชนะเลิศย้ายไปแข่งที่โรงยิม 1 คอร์ตกลาง','tournament',8,0,'2026-10-08 15:45:19'),(394,12,'comment_reported','มีคนรายงานความเห็นในทัวร์ของคุณ','มีผู้รายงานความเห็นในทัวร์นาเมนต์ \"แบดมินตัน Faculty League\" — เปิดรายการที่ถูกรายงาน (?reported=true) เพื่อตรวจและลบถ้าไม่เหมาะสม','tournament',8,0,'2026-10-08 15:45:19'),(395,105,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #11 แข่ง 9 ต.ค. 2569 01:44 ที่ โรงยิม 5','match',11,0,'2026-10-08 15:45:19'),(396,106,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #11 แข่ง 9 ต.ค. 2569 01:44 ที่ โรงยิม 5','match',11,0,'2026-10-08 15:45:19'),(397,107,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #11 แข่ง 9 ต.ค. 2569 01:44 ที่ โรงยิม 5','match',11,0,'2026-10-08 15:45:19'),(398,108,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #11 แข่ง 9 ต.ค. 2569 01:44 ที่ โรงยิม 5','match',11,0,'2026-10-08 15:45:19'),(399,21,'referee_change_request','ผู้จัดขอให้คุณคุมแมตช์เพิ่ม','ผู้จัดขอให้คุณเป็นกรรมการแมตช์ #11 เพิ่ม','match',11,0,'2026-10-08 15:45:19'),(400,11,'referee_assigned','เปลี่ยนกรรมการสำเร็จ','ทุกฝ่ายตกลงแล้ว กรรมการของแมตช์ #11 ถูกเปลี่ยนตามคำขอ','match',11,0,'2026-10-08 15:45:19'),(401,22,'referee_change_request','ผู้จัดขอให้คุณคุมแมตช์เพิ่ม','ผู้จัดขอให้คุณเป็นกรรมการแมตช์ #11 เพิ่ม','match',11,0,'2026-10-08 15:45:19'),(402,11,'referee_assigned','เปลี่ยนกรรมการสำเร็จ','ทุกฝ่ายตกลงแล้ว กรรมการของแมตช์ #11 ถูกเปลี่ยนตามคำขอ','match',11,0,'2026-10-08 15:45:19'),(403,105,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #11 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',11,0,'2026-10-08 15:45:20'),(404,106,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #11 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',11,0,'2026-10-08 15:45:20'),(405,107,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #11 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',11,0,'2026-10-08 15:45:20'),(406,108,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #11 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',11,0,'2026-10-08 15:45:20'),(407,21,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #11 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',11,0,'2026-10-08 15:45:20'),(408,22,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #11 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',11,0,'2026-10-08 15:45:20'),(409,105,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #11 จบการแข่งขันแล้ว รอการส่งผล','match',11,0,'2026-10-08 15:45:20'),(410,106,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #11 จบการแข่งขันแล้ว รอการส่งผล','match',11,0,'2026-10-08 15:45:20'),(411,107,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #11 จบการแข่งขันแล้ว รอการส่งผล','match',11,0,'2026-10-08 15:45:20'),(412,108,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #11 จบการแข่งขันแล้ว รอการส่งผล','match',11,0,'2026-10-08 15:45:20'),(413,21,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #11 จบการแข่งขันแล้ว รอการส่งผล','match',11,0,'2026-10-08 15:45:20'),(414,22,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #11 จบการแข่งขันแล้ว รอการส่งผล','match',11,0,'2026-10-08 15:45:20'),(415,105,'result_submitted','มีการส่งผลการแข่งขัน','ผลการแข่งขันแมตช์ #11 ถูกส่งแล้ว รอการยืนยัน','match',11,0,'2026-10-08 15:45:20'),(416,107,'result_submitted','มีการส่งผลการแข่งขัน','ผลการแข่งขันแมตช์ #11 ถูกส่งแล้ว รอการยืนยัน','match',11,0,'2026-10-08 15:45:20'),(417,22,'result_submitted','มีการส่งผลการแข่งขัน','ผลการแข่งขันแมตช์ #11 ถูกส่งแล้ว รอการยืนยัน','match',11,0,'2026-10-08 15:45:20'),(418,105,'result_verified','ผลการแข่งขันยืนยันแล้ว','ผลการแข่งขันแมตช์ #11 ได้รับการยืนยันแล้ว','match',11,0,'2026-10-08 15:45:20'),(419,21,'result_verified','ผลการแข่งขันยืนยันแล้ว','ผลการแข่งขันแมตช์ #11 ได้รับการยืนยันแล้ว','match',11,0,'2026-10-08 15:45:20'),(420,22,'result_verified','ผลการแข่งขันยืนยันแล้ว','ผลการแข่งขันแมตช์ #11 ได้รับการยืนยันแล้ว','match',11,0,'2026-10-08 15:45:20'),(421,101,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #12 แข่ง 9 ต.ค. 2569 03:44 ที่ โรงยิม 5','match',12,0,'2026-10-08 15:45:20'),(422,102,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #12 แข่ง 9 ต.ค. 2569 03:44 ที่ โรงยิม 5','match',12,0,'2026-10-08 15:45:20'),(423,103,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #12 แข่ง 9 ต.ค. 2569 03:44 ที่ โรงยิม 5','match',12,0,'2026-10-08 15:45:20'),(424,104,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #12 แข่ง 9 ต.ค. 2569 03:44 ที่ โรงยิม 5','match',12,0,'2026-10-08 15:45:20'),(425,21,'referee_change_request','ผู้จัดขอให้คุณคุมแมตช์เพิ่ม','ผู้จัดขอให้คุณเป็นกรรมการแมตช์ #12 เพิ่ม','match',12,0,'2026-10-08 15:45:20'),(426,11,'referee_assigned','เปลี่ยนกรรมการสำเร็จ','ทุกฝ่ายตกลงแล้ว กรรมการของแมตช์ #12 ถูกเปลี่ยนตามคำขอ','match',12,0,'2026-10-08 15:45:20'),(427,22,'referee_change_request','ผู้จัดขอให้คุณคุมแมตช์เพิ่ม','ผู้จัดขอให้คุณเป็นกรรมการแมตช์ #12 เพิ่ม','match',12,0,'2026-10-08 15:45:20'),(428,11,'referee_assigned','เปลี่ยนกรรมการสำเร็จ','ทุกฝ่ายตกลงแล้ว กรรมการของแมตช์ #12 ถูกเปลี่ยนตามคำขอ','match',12,0,'2026-10-08 15:45:21'),(429,101,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #12 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',12,0,'2026-10-08 15:45:21'),(430,102,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #12 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',12,0,'2026-10-08 15:45:21'),(431,103,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #12 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',12,0,'2026-10-08 15:45:21'),(432,104,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #12 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',12,0,'2026-10-08 15:45:21'),(433,21,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #12 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',12,0,'2026-10-08 15:45:21'),(434,22,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #12 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',12,0,'2026-10-08 15:45:21'),(435,101,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #12 จบการแข่งขันแล้ว รอการส่งผล','match',12,0,'2026-10-08 15:45:21'),(436,102,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #12 จบการแข่งขันแล้ว รอการส่งผล','match',12,0,'2026-10-08 15:45:21'),(437,103,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #12 จบการแข่งขันแล้ว รอการส่งผล','match',12,0,'2026-10-08 15:45:21'),(438,104,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #12 จบการแข่งขันแล้ว รอการส่งผล','match',12,0,'2026-10-08 15:45:21'),(439,21,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #12 จบการแข่งขันแล้ว รอการส่งผล','match',12,0,'2026-10-08 15:45:21'),(440,22,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #12 จบการแข่งขันแล้ว รอการส่งผล','match',12,0,'2026-10-08 15:45:21'),(441,101,'result_submitted','มีการส่งผลการแข่งขัน','ผลการแข่งขันแมตช์ #12 ถูกส่งแล้ว รอการยืนยัน','match',12,0,'2026-10-08 15:45:21'),(442,103,'result_submitted','มีการส่งผลการแข่งขัน','ผลการแข่งขันแมตช์ #12 ถูกส่งแล้ว รอการยืนยัน','match',12,0,'2026-10-08 15:45:21'),(443,22,'result_submitted','มีการส่งผลการแข่งขัน','ผลการแข่งขันแมตช์ #12 ถูกส่งแล้ว รอการยืนยัน','match',12,0,'2026-10-08 15:45:21'),(444,103,'result_verified','ผลการแข่งขันยืนยันแล้ว','ผลการแข่งขันแมตช์ #12 ได้รับการยืนยันแล้ว','match',12,0,'2026-10-08 15:45:21'),(445,21,'result_verified','ผลการแข่งขันยืนยันแล้ว','ผลการแข่งขันแมตช์ #12 ได้รับการยืนยันแล้ว','match',12,0,'2026-10-08 15:45:21'),(446,22,'result_verified','ผลการแข่งขันยืนยันแล้ว','ผลการแข่งขันแมตช์ #12 ได้รับการยืนยันแล้ว','match',12,0,'2026-10-08 15:45:21'),(447,103,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #13 แข่ง 9 ต.ค. 2569 05:44 ที่ โรงยิม 5','match',13,0,'2026-10-08 15:45:22'),(448,104,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #13 แข่ง 9 ต.ค. 2569 05:44 ที่ โรงยิม 5','match',13,0,'2026-10-08 15:45:22'),(449,107,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #13 แข่ง 9 ต.ค. 2569 05:44 ที่ โรงยิม 5','match',13,0,'2026-10-08 15:45:22'),(450,108,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #13 แข่ง 9 ต.ค. 2569 05:44 ที่ โรงยิม 5','match',13,0,'2026-10-08 15:45:22'),(451,21,'referee_change_request','ผู้จัดขอให้คุณคุมแมตช์เพิ่ม','ผู้จัดขอให้คุณเป็นกรรมการแมตช์ #13 เพิ่ม','match',13,0,'2026-10-08 15:45:22'),(452,11,'referee_assigned','เปลี่ยนกรรมการสำเร็จ','ทุกฝ่ายตกลงแล้ว กรรมการของแมตช์ #13 ถูกเปลี่ยนตามคำขอ','match',13,0,'2026-10-08 15:45:22'),(453,22,'referee_change_request','ผู้จัดขอให้คุณคุมแมตช์เพิ่ม','ผู้จัดขอให้คุณเป็นกรรมการแมตช์ #13 เพิ่ม','match',13,0,'2026-10-08 15:45:22'),(454,11,'referee_assigned','เปลี่ยนกรรมการสำเร็จ','ทุกฝ่ายตกลงแล้ว กรรมการของแมตช์ #13 ถูกเปลี่ยนตามคำขอ','match',13,0,'2026-10-08 15:45:22'),(455,103,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #13 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',13,0,'2026-10-08 15:45:22'),(456,104,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #13 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',13,0,'2026-10-08 15:45:22'),(457,107,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #13 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',13,0,'2026-10-08 15:45:22'),(458,108,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #13 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',13,0,'2026-10-08 15:45:22'),(459,21,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #13 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',13,0,'2026-10-08 15:45:22'),(460,22,'checkin_opened','เปิดเช็คอินแล้ว','แมตช์ #13 เปิดเช็คอินแล้ว เช็คอินก่อนเริ่มแข่งด้วย','match',13,0,'2026-10-08 15:45:22'),(461,103,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #13 จบการแข่งขันแล้ว รอการส่งผล','match',13,0,'2026-10-08 15:45:22'),(462,104,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #13 จบการแข่งขันแล้ว รอการส่งผล','match',13,0,'2026-10-08 15:45:22'),(463,107,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #13 จบการแข่งขันแล้ว รอการส่งผล','match',13,0,'2026-10-08 15:45:22'),(464,108,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #13 จบการแข่งขันแล้ว รอการส่งผล','match',13,0,'2026-10-08 15:45:22'),(465,21,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #13 จบการแข่งขันแล้ว รอการส่งผล','match',13,0,'2026-10-08 15:45:22'),(466,22,'match_finished','แมตช์จบการแข่งขันแล้ว','แมตช์ #13 จบการแข่งขันแล้ว รอการส่งผล','match',13,0,'2026-10-08 15:45:22'),(467,103,'result_submitted','มีการส่งผลการแข่งขัน','ผลการแข่งขันแมตช์ #13 ถูกส่งแล้ว รอการยืนยัน','match',13,0,'2026-10-08 15:45:23'),(468,107,'result_submitted','มีการส่งผลการแข่งขัน','ผลการแข่งขันแมตช์ #13 ถูกส่งแล้ว รอการยืนยัน','match',13,0,'2026-10-08 15:45:23'),(469,22,'result_submitted','มีการส่งผลการแข่งขัน','ผลการแข่งขันแมตช์ #13 ถูกส่งแล้ว รอการยืนยัน','match',13,0,'2026-10-08 15:45:23'),(470,103,'result_verified','ผลการแข่งขันยืนยันแล้ว','ผลการแข่งขันแมตช์ #13 ได้รับการยืนยันแล้ว','match',13,0,'2026-10-08 15:45:23'),(471,21,'result_verified','ผลการแข่งขันยืนยันแล้ว','ผลการแข่งขันแมตช์ #13 ได้รับการยืนยันแล้ว','match',13,0,'2026-10-08 15:45:23'),(472,22,'result_verified','ผลการแข่งขันยืนยันแล้ว','ผลการแข่งขันแมตช์ #13 ได้รับการยืนยันแล้ว','match',13,0,'2026-10-08 15:45:23'),(473,107,'result_disputed','มีการโต้แย้งผลการแข่งขัน','ผลการแข่งขันแมตช์ #13 ถูกโต้แย้ง — เหตุผล: เซตที่สามนับแต้มผิด คะแนนจริงคือ 21–19 ฝั่งเรา ขอให้ตรวจใบบันทึกคะแนน','match',13,0,'2026-10-08 15:45:23'),(474,21,'result_disputed','มีการโต้แย้งผลการแข่งขัน','ผลการแข่งขันแมตช์ #13 ถูกโต้แย้ง — เหตุผล: เซตที่สามนับแต้มผิด คะแนนจริงคือ 21–19 ฝั่งเรา ขอให้ตรวจใบบันทึกคะแนน','match',13,0,'2026-10-08 15:45:23'),(475,22,'result_disputed','มีการโต้แย้งผลการแข่งขัน','ผลการแข่งขันแมตช์ #13 ถูกโต้แย้ง — เหตุผล: เซตที่สามนับแต้มผิด คะแนนจริงคือ 21–19 ฝั่งเรา ขอให้ตรวจใบบันทึกคะแนน','match',13,0,'2026-10-08 15:45:23'),(476,11,'result_disputed','มีการโต้แย้งผลการแข่งขัน','ผลการแข่งขันแมตช์ #13 ถูกโต้แย้ง — เหตุผล: เซตที่สามนับแต้มผิด คะแนนจริงคือ 21–19 ฝั่งเรา ขอให้ตรวจใบบันทึกคะแนน','match',13,0,'2026-10-08 15:45:23'),(477,101,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #14 แข่ง 10 ต.ค. 2569 13:00 ที่ โรงยิม 5','match',14,0,'2026-10-08 15:45:23'),(478,102,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #14 แข่ง 10 ต.ค. 2569 13:00 ที่ โรงยิม 5','match',14,0,'2026-10-08 15:45:23'),(479,105,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #14 แข่ง 10 ต.ค. 2569 13:00 ที่ โรงยิม 5','match',14,0,'2026-10-08 15:45:23'),(480,106,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #14 แข่ง 10 ต.ค. 2569 13:00 ที่ โรงยิม 5','match',14,0,'2026-10-08 15:45:23'),(481,101,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #15 แข่ง 10 ต.ค. 2569 15:00 ที่ โรงยิม 5','match',15,0,'2026-10-08 15:45:23'),(482,102,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #15 แข่ง 10 ต.ค. 2569 15:00 ที่ โรงยิม 5','match',15,0,'2026-10-08 15:45:23'),(483,107,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #15 แข่ง 10 ต.ค. 2569 15:00 ที่ โรงยิม 5','match',15,0,'2026-10-08 15:45:23'),(484,108,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #15 แข่ง 10 ต.ค. 2569 15:00 ที่ โรงยิม 5','match',15,0,'2026-10-08 15:45:23'),(485,103,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #16 แข่ง 10 ต.ค. 2569 17:00 ที่ โรงยิม 5','match',16,0,'2026-10-08 15:45:23'),(486,104,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #16 แข่ง 10 ต.ค. 2569 17:00 ที่ โรงยิม 5','match',16,0,'2026-10-08 15:45:23'),(487,105,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #16 แข่ง 10 ต.ค. 2569 17:00 ที่ โรงยิม 5','match',16,0,'2026-10-08 15:45:23'),(488,106,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #16 แข่ง 10 ต.ค. 2569 17:00 ที่ โรงยิม 5','match',16,0,'2026-10-08 15:45:23'),(489,101,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #1 แข่ง 9 ต.ค. 2569 13:20 ที่ โรงยิม 1 คอร์ตกลาง','match',1,0,'2026-10-08 15:45:23'),(490,102,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #1 แข่ง 9 ต.ค. 2569 13:20 ที่ โรงยิม 1 คอร์ตกลาง','match',1,0,'2026-10-08 15:45:23'),(491,103,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #1 แข่ง 9 ต.ค. 2569 13:20 ที่ โรงยิม 1 คอร์ตกลาง','match',1,0,'2026-10-08 15:45:23'),(492,104,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #1 แข่ง 9 ต.ค. 2569 13:20 ที่ โรงยิม 1 คอร์ตกลาง','match',1,0,'2026-10-08 15:45:23'),(493,21,'referee_change_request','ผู้จัดขอให้คุณคุมแมตช์เพิ่ม','ผู้จัดขอให้คุณเป็นกรรมการแมตช์ #1 เพิ่ม','match',1,0,'2026-10-08 15:45:23'),(494,11,'referee_assigned','เปลี่ยนกรรมการสำเร็จ','ทุกฝ่ายตกลงแล้ว กรรมการของแมตช์ #1 ถูกเปลี่ยนตามคำขอ','match',1,0,'2026-10-08 15:45:24'),(495,22,'referee_change_request','ผู้จัดขอให้คุณคุมแมตช์เพิ่ม','ผู้จัดขอให้คุณเป็นกรรมการแมตช์ #1 เพิ่ม','match',1,0,'2026-10-08 15:45:24'),(496,11,'referee_assigned','เปลี่ยนกรรมการสำเร็จ','ทุกฝ่ายตกลงแล้ว กรรมการของแมตช์ #1 ถูกเปลี่ยนตามคำขอ','match',1,0,'2026-10-08 15:45:24'),(497,105,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #2 แข่ง 9 ต.ค. 2569 15:00 ที่ โรงยิม 1 คอร์ตกลาง','match',2,0,'2026-10-08 15:45:24'),(498,106,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #2 แข่ง 9 ต.ค. 2569 15:00 ที่ โรงยิม 1 คอร์ตกลาง','match',2,0,'2026-10-08 15:45:24'),(499,107,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #2 แข่ง 9 ต.ค. 2569 15:00 ที่ โรงยิม 1 คอร์ตกลาง','match',2,0,'2026-10-08 15:45:24'),(500,108,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #2 แข่ง 9 ต.ค. 2569 15:00 ที่ โรงยิม 1 คอร์ตกลาง','match',2,0,'2026-10-08 15:45:24'),(501,21,'referee_change_request','ผู้จัดขอให้คุณคุมแมตช์เพิ่ม','ผู้จัดขอให้คุณเป็นกรรมการแมตช์ #2 เพิ่ม','match',2,0,'2026-10-08 15:45:24'),(502,11,'referee_assigned','เปลี่ยนกรรมการสำเร็จ','ทุกฝ่ายตกลงแล้ว กรรมการของแมตช์ #2 ถูกเปลี่ยนตามคำขอ','match',2,0,'2026-10-08 15:45:24'),(503,22,'referee_change_request','ผู้จัดขอให้คุณคุมแมตช์เพิ่ม','ผู้จัดขอให้คุณเป็นกรรมการแมตช์ #2 เพิ่ม','match',2,0,'2026-10-08 15:45:24'),(504,11,'referee_assigned','เปลี่ยนกรรมการสำเร็จ','ทุกฝ่ายตกลงแล้ว กรรมการของแมตช์ #2 ถูกเปลี่ยนตามคำขอ','match',2,0,'2026-10-08 15:45:24'),(505,21,'referee_change_request','ผู้จัดขอให้คุณคุมแมตช์เพิ่ม','ผู้จัดขอให้คุณเป็นกรรมการแมตช์ #3 เพิ่ม','match',3,0,'2026-10-08 15:45:24'),(506,11,'referee_assigned','เปลี่ยนกรรมการสำเร็จ','ทุกฝ่ายตกลงแล้ว กรรมการของแมตช์ #3 ถูกเปลี่ยนตามคำขอ','match',3,0,'2026-10-08 15:45:24'),(507,22,'referee_change_request','ผู้จัดขอให้คุณคุมแมตช์เพิ่ม','ผู้จัดขอให้คุณเป็นกรรมการแมตช์ #3 เพิ่ม','match',3,0,'2026-10-08 15:45:24'),(508,101,'tournament_announcement_urgent','เปลี่ยนกำหนดการแข่ง: ตารางแข่งวันชิงแชมป์','รอบรองชนะเลิศเริ่ม 13:20 น. ที่โรงยิม 1 คอร์ตกลาง กรุณามาเช็คอินก่อนเวลา 30 นาที','tournament',7,0,'2026-10-08 15:45:24'),(509,102,'tournament_announcement_urgent','เปลี่ยนกำหนดการแข่ง: ตารางแข่งวันชิงแชมป์','รอบรองชนะเลิศเริ่ม 13:20 น. ที่โรงยิม 1 คอร์ตกลาง กรุณามาเช็คอินก่อนเวลา 30 นาที','tournament',7,0,'2026-10-08 15:45:24'),(510,103,'tournament_announcement_urgent','เปลี่ยนกำหนดการแข่ง: ตารางแข่งวันชิงแชมป์','รอบรองชนะเลิศเริ่ม 13:20 น. ที่โรงยิม 1 คอร์ตกลาง กรุณามาเช็คอินก่อนเวลา 30 นาที','tournament',7,0,'2026-10-08 15:45:24'),(511,104,'tournament_announcement_urgent','เปลี่ยนกำหนดการแข่ง: ตารางแข่งวันชิงแชมป์','รอบรองชนะเลิศเริ่ม 13:20 น. ที่โรงยิม 1 คอร์ตกลาง กรุณามาเช็คอินก่อนเวลา 30 นาที','tournament',7,0,'2026-10-08 15:45:24'),(512,105,'tournament_announcement_urgent','เปลี่ยนกำหนดการแข่ง: ตารางแข่งวันชิงแชมป์','รอบรองชนะเลิศเริ่ม 13:20 น. ที่โรงยิม 1 คอร์ตกลาง กรุณามาเช็คอินก่อนเวลา 30 นาที','tournament',7,0,'2026-10-08 15:45:24'),(513,106,'tournament_announcement_urgent','เปลี่ยนกำหนดการแข่ง: ตารางแข่งวันชิงแชมป์','รอบรองชนะเลิศเริ่ม 13:20 น. ที่โรงยิม 1 คอร์ตกลาง กรุณามาเช็คอินก่อนเวลา 30 นาที','tournament',7,0,'2026-10-08 15:45:24'),(514,107,'tournament_announcement_urgent','เปลี่ยนกำหนดการแข่ง: ตารางแข่งวันชิงแชมป์','รอบรองชนะเลิศเริ่ม 13:20 น. ที่โรงยิม 1 คอร์ตกลาง กรุณามาเช็คอินก่อนเวลา 30 นาที','tournament',7,0,'2026-10-08 15:45:24'),(515,108,'tournament_announcement_urgent','เปลี่ยนกำหนดการแข่ง: ตารางแข่งวันชิงแชมป์','รอบรองชนะเลิศเริ่ม 13:20 น. ที่โรงยิม 1 คอร์ตกลาง กรุณามาเช็คอินก่อนเวลา 30 นาที','tournament',7,0,'2026-10-08 15:45:24'),(516,21,'tournament_announcement_urgent','เปลี่ยนกำหนดการแข่ง: ตารางแข่งวันชิงแชมป์','รอบรองชนะเลิศเริ่ม 13:20 น. ที่โรงยิม 1 คอร์ตกลาง กรุณามาเช็คอินก่อนเวลา 30 นาที','tournament',7,0,'2026-10-08 15:45:24'),(517,22,'tournament_announcement_urgent','เปลี่ยนกำหนดการแข่ง: ตารางแข่งวันชิงแชมป์','รอบรองชนะเลิศเริ่ม 13:20 น. ที่โรงยิม 1 คอร์ตกลาง กรุณามาเช็คอินก่อนเวลา 30 นาที','tournament',7,0,'2026-10-08 15:45:24'),(518,135,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #10 แข่ง 9 ต.ค. 2569 16:00 ที่ ออนไลน์ (Custom Room)','match',10,0,'2026-10-08 15:45:24'),(519,136,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #10 แข่ง 9 ต.ค. 2569 16:00 ที่ ออนไลน์ (Custom Room)','match',10,0,'2026-10-08 15:45:24'),(520,137,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #10 แข่ง 9 ต.ค. 2569 16:00 ที่ ออนไลน์ (Custom Room)','match',10,0,'2026-10-08 15:45:24'),(521,138,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #10 แข่ง 9 ต.ค. 2569 16:00 ที่ ออนไลน์ (Custom Room)','match',10,0,'2026-10-08 15:45:24'),(522,139,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #10 แข่ง 9 ต.ค. 2569 16:00 ที่ ออนไลน์ (Custom Room)','match',10,0,'2026-10-08 15:45:24'),(523,140,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #10 แข่ง 9 ต.ค. 2569 16:00 ที่ ออนไลน์ (Custom Room)','match',10,0,'2026-10-08 15:45:24'),(524,141,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #10 แข่ง 9 ต.ค. 2569 16:00 ที่ ออนไลน์ (Custom Room)','match',10,0,'2026-10-08 15:45:24'),(525,142,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #10 แข่ง 9 ต.ค. 2569 16:00 ที่ ออนไลน์ (Custom Room)','match',10,0,'2026-10-08 15:45:24'),(526,143,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #10 แข่ง 9 ต.ค. 2569 16:00 ที่ ออนไลน์ (Custom Room)','match',10,0,'2026-10-08 15:45:24'),(527,144,'match_scheduled','นัดเวลาแข่งแล้ว','แมตช์ #10 แข่ง 9 ต.ค. 2569 16:00 ที่ ออนไลน์ (Custom Room)','match',10,0,'2026-10-08 15:45:24'),(528,24,'referee_change_request','ผู้จัดขอให้คุณคุมแมตช์เพิ่ม','ผู้จัดขอให้คุณเป็นกรรมการแมตช์ #10 เพิ่ม','match',10,0,'2026-10-08 15:45:24'),(529,13,'referee_assigned','เปลี่ยนกรรมการสำเร็จ','ทุกฝ่ายตกลงแล้ว กรรมการของแมตช์ #10 ถูกเปลี่ยนตามคำขอ','match',10,0,'2026-10-08 15:45:24'),(530,25,'referee_invited','คุณได้รับเชิญเป็นกรรมการ','คุณได้รับเชิญเป็นกรรมการทัวร์นาเมนต์ \"แบดมินตัน Open รอบคัดเลือก\"','tournament',6,0,'2026-10-08 15:45:25'),(531,13,'referee_invite_answered','กรรมการตอบรับคำเชิญแล้ว','สมเกียรติ ผู้ตัดสินอาชีพ ตอบรับเป็นกรรมการ รับ 0 แมตช์ — รอแอดมินตรวจตัวตนก่อนนับเป็นกรรมการ','tournament',6,0,'2026-10-08 15:45:25'),(532,26,'referee_invited','คุณได้รับเชิญเป็นกรรมการ','คุณได้รับเชิญเป็นกรรมการทัวร์นาเมนต์ \"แบดมินตันเกษตรแฟร์\"','tournament',4,0,'2026-10-08 15:45:25'),(533,12,'referee_invite_answered','กรรมการตอบรับคำเชิญแล้ว','ดารุณี กรรมการรับเชิญ ตอบรับเป็นกรรมการ รับ 0 แมตช์ — รอแอดมินตรวจตัวตนก่อนนับเป็นกรรมการ','tournament',4,0,'2026-10-08 15:45:25'),(534,25,'referee_external_decided','ยืนยันตัวตนกรรมการผ่านแล้ว','แอดมินยืนยันตัวตนของคุณแล้ว คุณทำหน้าที่กรรมการได้ทันที',NULL,NULL,0,'2026-10-08 15:45:25');
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `official_team_memberships`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `official_team_memberships` (
  `official_team_membership_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `sport_type_id` int NOT NULL,
  `team_id` int NOT NULL,
  `joined_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`official_team_membership_id`),
  UNIQUE KEY `user_id` (`user_id`,`sport_type_id`),
  KEY `sport_type_id` (`sport_type_id`),
  KEY `team_id` (`team_id`),
  CONSTRAINT `official_team_memberships_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `official_team_memberships_ibfk_2` FOREIGN KEY (`sport_type_id`) REFERENCES `sport_types` (`sport_type_id`),
  CONSTRAINT `official_team_memberships_ibfk_3` FOREIGN KEY (`team_id`) REFERENCES `teams` (`team_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `official_team_memberships` WRITE;
/*!40000 ALTER TABLE `official_team_memberships` DISABLE KEYS */;
/*!40000 ALTER TABLE `official_team_memberships` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `password_reset_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_reset_tokens` (
  `password_reset_token_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token_hash` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  PRIMARY KEY (`password_reset_token_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `password_reset_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `password_reset_tokens` WRITE;
/*!40000 ALTER TABLE `password_reset_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_reset_tokens` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `pickem_predictions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pickem_predictions` (
  `pickem_prediction_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `match_id` int NOT NULL,
  `predicted_winner_team_id` int NOT NULL,
  `predicted_score_data` json DEFAULT NULL,
  `points_earned` int DEFAULT NULL,
  `tier` enum('spot_on','close','side_only','wrong_side') DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`pickem_prediction_id`),
  UNIQUE KEY `user_id` (`user_id`,`match_id`),
  KEY `match_id` (`match_id`),
  KEY `predicted_winner_team_id` (`predicted_winner_team_id`),
  CONSTRAINT `pickem_predictions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `pickem_predictions_ibfk_2` FOREIGN KEY (`match_id`) REFERENCES `matches` (`match_id`),
  CONSTRAINT `pickem_predictions_ibfk_3` FOREIGN KEY (`predicted_winner_team_id`) REFERENCES `teams` (`team_id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `pickem_predictions` WRITE;
/*!40000 ALTER TABLE `pickem_predictions` DISABLE KEYS */;
INSERT INTO `pickem_predictions` VALUES (1,31,7,3,'{\"3\": 2, \"4\": 1}',10,'spot_on','2026-10-08 15:45:11'),(2,32,7,4,'{\"3\": 0, \"4\": 2}',0,'wrong_side','2026-10-08 15:45:11'),(3,33,7,3,'{\"3\": 2, \"4\": 0}',4,'side_only','2026-10-08 15:45:11'),(4,31,8,5,'{\"5\": 2, \"6\": 0}',10,'spot_on','2026-10-08 15:45:11'),(5,32,8,5,'{\"5\": 2, \"6\": 1}',4,'side_only','2026-10-08 15:45:11'),(6,33,8,6,'{\"5\": 1, \"6\": 2}',0,'wrong_side','2026-10-08 15:45:11'),(7,31,9,5,'{\"3\": 1, \"5\": 2}',10,'spot_on','2026-10-08 15:45:14'),(8,32,9,3,'{\"3\": 2, \"5\": 1}',0,'wrong_side','2026-10-08 15:45:14'),(9,33,9,5,'{\"3\": 0, \"5\": 2}',4,'side_only','2026-10-08 15:45:14'),(10,31,4,5,'{\"5\": 2, \"6\": 1}',0,'wrong_side','2026-10-08 15:45:16'),(11,33,4,6,'{\"5\": 0, \"6\": 2}',4,'side_only','2026-10-08 15:45:16'),(12,31,5,1,'{\"1\": 2, \"2\": 0}',NULL,NULL,'2026-10-08 15:45:16'),(13,32,5,2,'{\"1\": 1, \"2\": 2}',NULL,NULL,'2026-10-08 15:45:16'),(14,31,2,3,'{\"3\": 2, \"4\": 1}',NULL,NULL,'2026-10-08 15:45:24'),(15,32,2,4,'{\"3\": 0, \"4\": 2}',NULL,NULL,'2026-10-08 15:45:24');
/*!40000 ALTER TABLE `pickem_predictions` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `player_match_stat_values`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `player_match_stat_values` (
  `player_match_stat_value_id` int NOT NULL AUTO_INCREMENT,
  `player_match_stat_id` int NOT NULL,
  `sport_stat_definition_id` int NOT NULL,
  `value_int` int DEFAULT NULL,
  PRIMARY KEY (`player_match_stat_value_id`),
  UNIQUE KEY `player_match_stat_id` (`player_match_stat_id`,`sport_stat_definition_id`),
  KEY `sport_stat_definition_id` (`sport_stat_definition_id`),
  CONSTRAINT `player_match_stat_values_ibfk_1` FOREIGN KEY (`player_match_stat_id`) REFERENCES `player_match_stats` (`player_match_stat_id`),
  CONSTRAINT `player_match_stat_values_ibfk_2` FOREIGN KEY (`sport_stat_definition_id`) REFERENCES `sport_stat_definitions` (`sport_stat_definition_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `player_match_stat_values` WRITE;
/*!40000 ALTER TABLE `player_match_stat_values` DISABLE KEYS */;
/*!40000 ALTER TABLE `player_match_stat_values` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `player_match_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `player_match_stats` (
  `player_match_stat_id` int NOT NULL AUTO_INCREMENT,
  `match_id` int NOT NULL,
  `user_id` int NOT NULL,
  `team_id` int NOT NULL,
  `recorded_by_referee_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`player_match_stat_id`),
  UNIQUE KEY `match_id` (`match_id`,`user_id`),
  KEY `user_id` (`user_id`),
  KEY `team_id` (`team_id`),
  KEY `recorded_by_referee_id` (`recorded_by_referee_id`),
  CONSTRAINT `player_match_stats_ibfk_1` FOREIGN KEY (`match_id`) REFERENCES `matches` (`match_id`),
  CONSTRAINT `player_match_stats_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `player_match_stats_ibfk_3` FOREIGN KEY (`team_id`) REFERENCES `teams` (`team_id`),
  CONSTRAINT `player_match_stats_ibfk_4` FOREIGN KEY (`recorded_by_referee_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `player_match_stats` WRITE;
/*!40000 ALTER TABLE `player_match_stats` DISABLE KEYS */;
/*!40000 ALTER TABLE `player_match_stats` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `player_profile_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `player_profile_stats` (
  `player_profile_stat_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `sport_type_id` int NOT NULL,
  `matches_played` int NOT NULL DEFAULT '0',
  `wins` int NOT NULL DEFAULT '0',
  `losses` int NOT NULL DEFAULT '0',
  `championships` int NOT NULL DEFAULT '0',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`player_profile_stat_id`),
  UNIQUE KEY `user_id` (`user_id`,`sport_type_id`),
  KEY `sport_type_id` (`sport_type_id`),
  CONSTRAINT `player_profile_stats_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `player_profile_stats_ibfk_2` FOREIGN KEY (`sport_type_id`) REFERENCES `sport_types` (`sport_type_id`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `player_profile_stats` WRITE;
/*!40000 ALTER TABLE `player_profile_stats` DISABLE KEYS */;
INSERT INTO `player_profile_stats` VALUES (1,105,3,3,1,2,0,'2026-10-08 15:45:20'),(2,106,3,3,1,2,0,'2026-10-08 15:45:20'),(4,107,3,3,2,1,0,'2026-10-08 15:45:23'),(5,108,3,3,2,1,0,'2026-10-08 15:45:23'),(7,109,3,3,2,1,1,'2026-10-08 15:45:17'),(8,110,3,3,2,1,1,'2026-10-08 15:45:17'),(10,111,3,2,1,1,0,'2026-10-08 15:45:17'),(11,112,3,2,1,1,0,'2026-10-08 15:45:17'),(20,101,3,1,1,0,0,'2026-10-08 15:45:21'),(21,102,3,1,1,0,0,'2026-10-08 15:45:21'),(23,103,3,2,0,2,0,'2026-10-08 15:45:23'),(24,104,3,2,0,2,0,'2026-10-08 15:45:23');
/*!40000 ALTER TABLE `player_profile_stats` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `point_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `point_transactions` (
  `point_transaction_id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `amount` int NOT NULL,
  `source` enum('pickem_correct','reward_redeem','admin_adjustment','other') NOT NULL,
  `ref_id` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`point_transaction_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `point_transactions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `point_transactions` WRITE;
/*!40000 ALTER TABLE `point_transactions` DISABLE KEYS */;
/*!40000 ALTER TABLE `point_transactions` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `referee_change_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `referee_change_requests` (
  `request_id` int NOT NULL AUTO_INCREMENT,
  `tournament_id` int NOT NULL,
  `request_type` enum('org_add_match','ref_transfer','ref_swap','org_swap','ref_withdraw') NOT NULL,
  `withdraw_scope` enum('match','tournament') DEFAULT NULL,
  `requested_by` int NOT NULL,
  `referee_a_id` int NOT NULL,
  `referee_b_id` int DEFAULT NULL,
  `match_a_id` int DEFAULT NULL,
  `match_b_id` int DEFAULT NULL,
  `a_status` enum('not_required','pending','accepted','declined') NOT NULL,
  `b_status` enum('not_required','pending','accepted','declined') NOT NULL,
  `request_reason` text,
  `request_status` enum('open','applied','declined','cancelled') NOT NULL DEFAULT 'open',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` datetime DEFAULT NULL,
  PRIMARY KEY (`request_id`),
  KEY `requested_by` (`requested_by`),
  KEY `referee_a_id` (`referee_a_id`),
  KEY `referee_b_id` (`referee_b_id`),
  KEY `match_a_id` (`match_a_id`),
  KEY `match_b_id` (`match_b_id`),
  KEY `idx_rcr_tournament_status` (`tournament_id`,`request_status`),
  CONSTRAINT `referee_change_requests_ibfk_1` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`tournament_id`),
  CONSTRAINT `referee_change_requests_ibfk_2` FOREIGN KEY (`requested_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `referee_change_requests_ibfk_3` FOREIGN KEY (`referee_a_id`) REFERENCES `tournament_referees` (`tournament_referee_id`),
  CONSTRAINT `referee_change_requests_ibfk_4` FOREIGN KEY (`referee_b_id`) REFERENCES `tournament_referees` (`tournament_referee_id`),
  CONSTRAINT `referee_change_requests_ibfk_5` FOREIGN KEY (`match_a_id`) REFERENCES `matches` (`match_id`),
  CONSTRAINT `referee_change_requests_ibfk_6` FOREIGN KEY (`match_b_id`) REFERENCES `matches` (`match_id`),
  CONSTRAINT `chk_rcr_withdraw_shape` CHECK ((((`request_type` <> _utf8mb4'ref_withdraw') and (`withdraw_scope` is null) and (`match_a_id` is not null)) or ((`request_type` = _utf8mb4'ref_withdraw') and (`withdraw_scope` = _utf8mb4'match') and (`match_a_id` is not null)) or ((`request_type` = _utf8mb4'ref_withdraw') and (`withdraw_scope` = _utf8mb4'tournament') and (`match_a_id` is null))))
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `referee_change_requests` WRITE;
/*!40000 ALTER TABLE `referee_change_requests` DISABLE KEYS */;
INSERT INTO `referee_change_requests` VALUES (1,9,'org_add_match',NULL,13,11,NULL,7,NULL,'accepted','not_required',NULL,'applied','2026-10-08 15:45:10','2026-10-08 15:45:10'),(2,9,'org_add_match',NULL,13,12,NULL,7,NULL,'accepted','not_required',NULL,'applied','2026-10-08 15:45:10','2026-10-08 15:45:10'),(3,9,'org_add_match',NULL,13,11,NULL,8,NULL,'accepted','not_required',NULL,'applied','2026-10-08 15:45:10','2026-10-08 15:45:10'),(4,9,'org_add_match',NULL,13,12,NULL,8,NULL,'accepted','not_required',NULL,'applied','2026-10-08 15:45:10','2026-10-08 15:45:11'),(5,9,'org_add_match',NULL,13,11,NULL,9,NULL,'accepted','not_required',NULL,'applied','2026-10-08 15:45:13','2026-10-08 15:45:13'),(6,9,'org_add_match',NULL,13,12,NULL,9,NULL,'accepted','not_required',NULL,'applied','2026-10-08 15:45:13','2026-10-08 15:45:14'),(7,8,'org_add_match',NULL,12,9,NULL,4,NULL,'accepted','not_required',NULL,'applied','2026-10-08 15:45:16','2026-10-08 15:45:16'),(8,8,'org_add_match',NULL,12,10,NULL,4,NULL,'accepted','not_required',NULL,'applied','2026-10-08 15:45:16','2026-10-08 15:45:16'),(9,8,'org_add_match',NULL,12,9,NULL,5,NULL,'accepted','not_required',NULL,'applied','2026-10-08 15:45:16','2026-10-08 15:45:16'),(10,8,'org_add_match',NULL,12,10,NULL,5,NULL,'accepted','not_required',NULL,'applied','2026-10-08 15:45:16','2026-10-08 15:45:16'),(11,11,'org_add_match',NULL,11,15,NULL,11,NULL,'accepted','not_required',NULL,'applied','2026-10-08 15:45:19','2026-10-08 15:45:19'),(12,11,'org_add_match',NULL,11,16,NULL,11,NULL,'accepted','not_required',NULL,'applied','2026-10-08 15:45:19','2026-10-08 15:45:19'),(13,11,'org_add_match',NULL,11,15,NULL,12,NULL,'accepted','not_required',NULL,'applied','2026-10-08 15:45:20','2026-10-08 15:45:20'),(14,11,'org_add_match',NULL,11,16,NULL,12,NULL,'accepted','not_required',NULL,'applied','2026-10-08 15:45:20','2026-10-08 15:45:21'),(15,11,'org_add_match',NULL,11,15,NULL,13,NULL,'accepted','not_required',NULL,'applied','2026-10-08 15:45:22','2026-10-08 15:45:22'),(16,11,'org_add_match',NULL,11,16,NULL,13,NULL,'accepted','not_required',NULL,'applied','2026-10-08 15:45:22','2026-10-08 15:45:22'),(17,7,'org_add_match',NULL,11,7,NULL,1,NULL,'accepted','not_required',NULL,'applied','2026-10-08 15:45:23','2026-10-08 15:45:24'),(18,7,'org_add_match',NULL,11,8,NULL,1,NULL,'accepted','not_required',NULL,'applied','2026-10-08 15:45:24','2026-10-08 15:45:24'),(19,7,'org_add_match',NULL,11,7,NULL,2,NULL,'accepted','not_required',NULL,'applied','2026-10-08 15:45:24','2026-10-08 15:45:24'),(20,7,'org_add_match',NULL,11,8,NULL,2,NULL,'accepted','not_required',NULL,'applied','2026-10-08 15:45:24','2026-10-08 15:45:24'),(21,7,'org_add_match',NULL,11,7,NULL,3,NULL,'accepted','not_required',NULL,'applied','2026-10-08 15:45:24','2026-10-08 15:45:24'),(22,7,'org_add_match',NULL,11,8,NULL,3,NULL,'pending','not_required',NULL,'open','2026-10-08 15:45:24',NULL),(23,10,'org_add_match',NULL,13,14,NULL,10,NULL,'accepted','not_required',NULL,'applied','2026-10-08 15:45:24','2026-10-08 15:45:24');
/*!40000 ALTER TABLE `referee_change_requests` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `rewards`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rewards` (
  `reward_id` int NOT NULL AUTO_INCREMENT,
  `reward_type` enum('badge','achievement') NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `points_required` int DEFAULT NULL,
  `criteria` json DEFAULT NULL,
  `icon_key` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`reward_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `rewards` WRITE;
/*!40000 ALTER TABLE `rewards` DISABLE KEYS */;
INSERT INTO `rewards` VALUES (1,'badge','ลงแข่งครั้งแรก','ลงแข่งขันแมตช์แรกสำเร็จ',NULL,'{\"gte\": 1, \"stat\": \"matches_played\"}',NULL,1,'2026-10-08 15:28:38',NULL),(2,'badge','ชนะครั้งแรก','ชนะแมตช์แรกในชีวิต',NULL,'{\"gte\": 1, \"stat\": \"wins\"}',NULL,1,'2026-10-08 15:28:38',NULL),(3,'achievement','ชนะ 10 แมตช์','ชนะรวม 10 แมตช์ในกีฬาเดียวกัน',NULL,'{\"gte\": 10, \"stat\": \"wins\"}',NULL,1,'2026-10-08 15:28:38',NULL),(4,'achievement','แชมป์ครั้งแรก','คว้าแชมป์ทัวร์นาเมนต์ครั้งแรก',NULL,'{\"gte\": 1, \"stat\": \"championships\"}',NULL,1,'2026-10-08 15:28:38',NULL),(5,'achievement','แชมป์ 3 สมัย','คว้าแชมป์ทัวร์นาเมนต์รวม 3 ครั้งในกีฬาเดียวกัน',NULL,'{\"gte\": 3, \"stat\": \"championships\"}',NULL,1,'2026-10-08 15:28:38',NULL),(6,'achievement','นักทายแม่น','ทายสกอร์ได้ชั้นสูงสุดครบ 5 แมตช์',NULL,'{\"gte\": 5, \"pickem\": \"spot_on\"}',NULL,1,'2026-10-08 15:28:38',NULL);
/*!40000 ALTER TABLE `rewards` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `schema_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schema_migrations` (
  `name` varchar(255) NOT NULL,
  `applied_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `schema_migrations` WRITE;
/*!40000 ALTER TABLE `schema_migrations` DISABLE KEYS */;
INSERT INTO `schema_migrations` VALUES ('001_matches_scheduled_end_time.sql','2026-09-17 13:00:43'),('002_match_referees_assignment_status.sql','2026-09-17 13:00:43'),('003_referee_change_requests.sql','2026-09-17 13:00:43'),('004_tournament_referees_external_docs.sql','2026-09-17 13:00:43'),('005_external_approval_needs_docs.sql','2026-09-17 13:00:43'),('006_add_tournament_description.sql','2026-09-17 13:00:43'),('007_match_results_livestream.sql','2026-09-17 13:00:43'),('008_match_checkins_unique_match_user.sql','2026-09-17 13:00:43'),('009_match_checkins_pending_status.sql','2026-09-17 13:00:43'),('010_sport_types_renumber.sql','2026-09-19 05:54:47'),('011_walkover.sql','2026-09-19 05:54:47'),('012_forfeit_organizer_role.sql','2026-09-19 05:54:47'),('013_team_invitations_expires_at.sql','2026-09-19 05:55:41'),('014_bracket_nodes_backfill_teams.sql','2026-09-20 16:30:15'),('015_match_checkins_note.sql','2026-09-20 16:30:16'),('016_matches_room_code.sql','2026-09-20 16:42:21'),('017_team_visibility_join_requests.sql','2026-09-20 16:42:21'),('018_application_players.sql','2026-09-20 16:42:21'),('019_drop_team_member_position.sql','2026-09-20 16:42:21'),('020_amendment_reason_stat_integer_only.sql','2026-09-20 17:10:33'),('021_standings_goals.sql','2026-10-01 10:16:17'),('022_tournament_completion.sql','2026-10-01 10:16:17'),('023_tournament_entry_notes.sql','2026-10-01 10:16:17'),('024_user_reports.sql','2026-10-01 10:16:17'),('025_admin_scopes_root.sql','2026-10-01 10:16:17'),('026_match_finish_timestamps.sql','2026-10-01 10:16:17'),('027_dispute_claim_and_evidence.sql','2026-10-01 10:16:17'),('028_match_result_complaints.sql','2026-10-01 10:16:17'),('029_team_admin_requests_supporting_docs.sql','2026-10-01 10:16:17'),('030_admin_scopes_single_root.sql','2026-10-01 10:16:17'),('031_team_logo_key.sql','2026-10-01 10:16:17'),('032_feedback_report_cleared.sql','2026-10-01 10:16:17'),('033_users_suspended_until.sql','2026-10-01 10:16:17'),('034_users_suspended_category.sql','2026-10-01 10:16:18'),('035_users_show_profile_stats.sql','2026-10-08 15:28:35'),('036_tournament_referees_one_active_row.sql','2026-10-08 15:28:36'),('037_email_verification_otp.sql','2026-10-08 15:28:38'),('038_pickem_predicted_score.sql','2026-10-08 15:28:38'),('039_sport_pickem_tolerance.sql','2026-10-08 15:28:38'),('040_pickem_tolerance_per_side.sql','2026-10-08 15:28:38'),('041_reward_catalogue.sql','2026-10-08 15:28:38'),('042_pickem_tier.sql','2026-10-08 15:28:38'),('043_user_rewards_displayed_default.sql','2026-10-08 15:28:38'),('044_match_best_of.sql','2026-10-08 15:28:39'),('045_referee_withdraw_request.sql','2026-10-08 15:28:39'),('046_user_token_version.sql','2026-10-08 15:28:39'),('047_sport_supports_best_of.sql','2026-10-08 15:28:39'),('048_unique_pending_requests.sql','2026-10-08 15:28:44'),('049_application_unique_active_only.sql','2026-10-08 15:28:45'),('050_referee_invitation_expiry.sql','2026-10-08 15:28:45');
/*!40000 ALTER TABLE `schema_migrations` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `sport_stat_definitions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sport_stat_definitions` (
  `sport_stat_definition_id` int NOT NULL AUTO_INCREMENT,
  `sport_type_id` int NOT NULL,
  `stat_key` varchar(50) NOT NULL,
  `stat_label_th` varchar(100) NOT NULL,
  `data_type` enum('integer') NOT NULL DEFAULT 'integer',
  `display_order` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`sport_stat_definition_id`),
  UNIQUE KEY `sport_type_id` (`sport_type_id`,`stat_key`),
  CONSTRAINT `sport_stat_definitions_ibfk_1` FOREIGN KEY (`sport_type_id`) REFERENCES `sport_types` (`sport_type_id`)
) ENGINE=InnoDB AUTO_INCREMENT=124 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `sport_stat_definitions` WRITE;
/*!40000 ALTER TABLE `sport_stat_definitions` DISABLE KEYS */;
INSERT INTO `sport_stat_definitions` VALUES (1,1,'goals','ประตู','integer',1),(2,1,'assists','แอสซิสต์','integer',2),(3,1,'yellow_cards','ใบเหลือง','integer',3),(4,1,'red_cards','ใบแดง','integer',4),(5,2,'points','แต้ม','integer',1),(6,2,'rebounds','รีบาวด์','integer',2),(7,2,'assists','แอสซิสต์','integer',3),(8,2,'fouls','ฟาวล์','integer',4),(9,3,'points','แต้ม','integer',1),(10,4,'kills','สังหาร','integer',1),(11,4,'deaths','ตาย','integer',2),(12,4,'assists','ช่วยสังหาร','integer',3),(13,5,'kills','สังหาร','integer',1),(14,5,'deaths','ตาย','integer',2),(15,5,'assists','ช่วยสังหาร','integer',3);
/*!40000 ALTER TABLE `sport_stat_definitions` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `sport_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sport_types` (
  `sport_type_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `min_members` int NOT NULL,
  `max_members` int NOT NULL,
  `default_mode` enum('onsite','online') NOT NULL DEFAULT 'onsite',
  `supports_best_of` tinyint(1) NOT NULL DEFAULT '0',
  `walkover_score` json DEFAULT NULL,
  `pickem_tolerance_exact` int NOT NULL DEFAULT '0',
  `pickem_tolerance_close` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`sport_type_id`),
  CONSTRAINT `chk_sport_pickem_tolerance` CHECK ((`pickem_tolerance_close` >= `pickem_tolerance_exact`))
) ENGINE=InnoDB AUTO_INCREMENT=110 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `sport_types` WRITE;
/*!40000 ALTER TABLE `sport_types` DISABLE KEYS */;
INSERT INTO `sport_types` VALUES (1,'ฟุตบอล',11,18,'onsite',0,'{\"loser\": 0, \"winner\": 3}',0,1),(2,'บาสเกตบอล',5,12,'onsite',0,'{\"loser\": 0, \"winner\": 20}',5,10),(3,'แบดมินตัน',2,4,'onsite',1,'{\"loser\": 0, \"winner\": 2}',0,0),(4,'E-Sport: RoV',5,7,'online',1,'{\"loser\": 0, \"winner\": 2}',0,0),(5,'E-Sport: VALORANT',5,7,'online',1,'{\"loser\": 0, \"winner\": 2}',0,0);
/*!40000 ALTER TABLE `sport_types` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `team_admin_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `team_admin_requests` (
  `team_admin_request_id` int NOT NULL AUTO_INCREMENT,
  `team_id` int NOT NULL,
  `request_type` enum('official_status','leader_transfer') NOT NULL,
  `requested_by` int NOT NULL,
  `target_user_id` int DEFAULT NULL,
  `team_admin_request_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `requested_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `supporting_docs` json DEFAULT NULL,
  `reviewed_by` int DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `rejection_reason` text,
  `pending_key` varchar(48) GENERATED ALWAYS AS (if((`team_admin_request_status` = _utf8mb4'pending'),concat_ws(_utf8mb4':',`team_id`,`request_type`),NULL)) VIRTUAL,
  PRIMARY KEY (`team_admin_request_id`),
  UNIQUE KEY `uq_team_admin_request_pending` (`pending_key`),
  KEY `team_id` (`team_id`),
  KEY `requested_by` (`requested_by`),
  KEY `target_user_id` (`target_user_id`),
  KEY `reviewed_by` (`reviewed_by`),
  CONSTRAINT `team_admin_requests_ibfk_1` FOREIGN KEY (`team_id`) REFERENCES `teams` (`team_id`),
  CONSTRAINT `team_admin_requests_ibfk_2` FOREIGN KEY (`requested_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `team_admin_requests_ibfk_3` FOREIGN KEY (`target_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `team_admin_requests_ibfk_4` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `team_admin_requests` WRITE;
/*!40000 ALTER TABLE `team_admin_requests` DISABLE KEYS */;
INSERT INTO `team_admin_requests` (`team_admin_request_id`, `team_id`, `request_type`, `requested_by`, `target_user_id`, `team_admin_request_status`, `requested_at`, `supporting_docs`, `reviewed_by`, `reviewed_at`, `rejection_reason`) VALUES (1,13,'official_status',145,NULL,'approved','2026-10-08 15:45:00','[\"หนังสือรับรองชมรมฟุตบอลคณะวิศวกรรมศาสตร์ ปี 2569\"]',2,'2026-10-08 15:45:00',NULL),(2,13,'leader_transfer',145,146,'pending','2026-10-08 15:45:00',NULL,NULL,NULL,NULL),(3,14,'official_status',156,NULL,'pending','2026-10-08 15:45:00','[\"หนังสือรับรองชมรมฟุตบอลคณะวิทยาศาสตร์ ปี 2569\"]',NULL,NULL,NULL);
/*!40000 ALTER TABLE `team_admin_requests` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `team_invitations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `team_invitations` (
  `team_invitation_id` int NOT NULL AUTO_INCREMENT,
  `team_id` int NOT NULL,
  `invited_user_id` int NOT NULL,
  `invited_by_user_id` int NOT NULL,
  `team_invitation_status` enum('pending','accepted','rejected','expired') NOT NULL DEFAULT 'pending',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime NOT NULL,
  `responded_at` datetime DEFAULT NULL,
  `pending_key` varchar(32) GENERATED ALWAYS AS (if((`team_invitation_status` = _utf8mb4'pending'),concat_ws(_utf8mb4':',`team_id`,`invited_user_id`),NULL)) VIRTUAL,
  PRIMARY KEY (`team_invitation_id`),
  UNIQUE KEY `uq_invitation_pending` (`pending_key`),
  KEY `team_id` (`team_id`),
  KEY `invited_user_id` (`invited_user_id`),
  KEY `invited_by_user_id` (`invited_by_user_id`),
  CONSTRAINT `team_invitations_ibfk_1` FOREIGN KEY (`team_id`) REFERENCES `teams` (`team_id`),
  CONSTRAINT `team_invitations_ibfk_2` FOREIGN KEY (`invited_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `team_invitations_ibfk_3` FOREIGN KEY (`invited_by_user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=54 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `team_invitations` WRITE;
/*!40000 ALTER TABLE `team_invitations` DISABLE KEYS */;
INSERT INTO `team_invitations` (`team_invitation_id`, `team_id`, `invited_user_id`, `invited_by_user_id`, `team_invitation_status`, `created_at`, `expires_at`, `responded_at`) VALUES (1,1,102,101,'accepted','2026-10-08 15:44:56','2026-10-15 15:44:57','2026-10-08 15:44:56'),(2,2,104,103,'accepted','2026-10-08 15:44:56','2026-10-15 15:44:57','2026-10-08 15:44:56'),(3,3,106,105,'accepted','2026-10-08 15:44:56','2026-10-15 15:44:57','2026-10-08 15:44:56'),(4,4,108,107,'accepted','2026-10-08 15:44:56','2026-10-15 15:44:57','2026-10-08 15:44:56'),(5,5,110,109,'accepted','2026-10-08 15:44:57','2026-10-15 15:44:57','2026-10-08 15:44:57'),(6,6,112,111,'accepted','2026-10-08 15:44:57','2026-10-15 15:44:57','2026-10-08 15:44:57'),(7,7,114,113,'accepted','2026-10-08 15:44:57','2026-10-15 15:44:57','2026-10-08 15:44:57'),(8,7,115,113,'accepted','2026-10-08 15:44:57','2026-10-15 15:44:57','2026-10-08 15:44:57'),(9,7,116,113,'accepted','2026-10-08 15:44:57','2026-10-15 15:44:57','2026-10-08 15:44:57'),(10,7,117,113,'accepted','2026-10-08 15:44:57','2026-10-15 15:44:57','2026-10-08 15:44:57'),(11,7,118,113,'accepted','2026-10-08 15:44:57','2026-10-15 15:44:57','2026-10-08 15:44:57'),(12,8,120,119,'accepted','2026-10-08 15:44:57','2026-10-15 15:44:58','2026-10-08 15:44:57'),(13,8,121,119,'accepted','2026-10-08 15:44:57','2026-10-15 15:44:58','2026-10-08 15:44:57'),(14,8,122,119,'accepted','2026-10-08 15:44:57','2026-10-15 15:44:58','2026-10-08 15:44:57'),(15,8,123,119,'accepted','2026-10-08 15:44:57','2026-10-15 15:44:58','2026-10-08 15:44:57'),(16,9,125,124,'accepted','2026-10-08 15:44:57','2026-10-15 15:44:58','2026-10-08 15:44:57'),(17,9,126,124,'accepted','2026-10-08 15:44:58','2026-10-15 15:44:58','2026-10-08 15:44:58'),(18,9,127,124,'accepted','2026-10-08 15:44:58','2026-10-15 15:44:58','2026-10-08 15:44:58'),(19,9,128,124,'accepted','2026-10-08 15:44:58','2026-10-15 15:44:58','2026-10-08 15:44:58'),(20,9,129,124,'accepted','2026-10-08 15:44:58','2026-10-15 15:44:58','2026-10-08 15:44:58'),(21,10,131,130,'accepted','2026-10-08 15:44:58','2026-10-15 15:44:58','2026-10-08 15:44:58'),(22,10,132,130,'accepted','2026-10-08 15:44:58','2026-10-15 15:44:58','2026-10-08 15:44:58'),(23,10,133,130,'accepted','2026-10-08 15:44:58','2026-10-15 15:44:59','2026-10-08 15:44:58'),(24,10,134,130,'accepted','2026-10-08 15:44:58','2026-10-15 15:44:59','2026-10-08 15:44:58'),(25,11,136,135,'accepted','2026-10-08 15:44:58','2026-10-15 15:44:59','2026-10-08 15:44:58'),(26,11,137,135,'accepted','2026-10-08 15:44:58','2026-10-15 15:44:59','2026-10-08 15:44:58'),(27,11,138,135,'accepted','2026-10-08 15:44:58','2026-10-15 15:44:59','2026-10-08 15:44:58'),(28,11,139,135,'accepted','2026-10-08 15:44:58','2026-10-15 15:44:59','2026-10-08 15:44:58'),(29,12,141,140,'accepted','2026-10-08 15:44:59','2026-10-15 15:44:59','2026-10-08 15:44:59'),(30,12,142,140,'accepted','2026-10-08 15:44:59','2026-10-15 15:44:59','2026-10-08 15:44:59'),(31,12,143,140,'accepted','2026-10-08 15:44:59','2026-10-15 15:44:59','2026-10-08 15:44:59'),(32,12,144,140,'accepted','2026-10-08 15:44:59','2026-10-15 15:44:59','2026-10-08 15:44:59'),(33,13,146,145,'accepted','2026-10-08 15:44:59','2026-10-15 15:44:59','2026-10-08 15:44:59'),(34,13,147,145,'accepted','2026-10-08 15:44:59','2026-10-15 15:44:59','2026-10-08 15:44:59'),(35,13,148,145,'accepted','2026-10-08 15:44:59','2026-10-15 15:45:00','2026-10-08 15:44:59'),(36,13,149,145,'accepted','2026-10-08 15:44:59','2026-10-15 15:45:00','2026-10-08 15:44:59'),(37,13,150,145,'accepted','2026-10-08 15:44:59','2026-10-15 15:45:00','2026-10-08 15:44:59'),(38,13,151,145,'accepted','2026-10-08 15:44:59','2026-10-15 15:45:00','2026-10-08 15:44:59'),(39,13,152,145,'accepted','2026-10-08 15:44:59','2026-10-15 15:45:00','2026-10-08 15:44:59'),(40,13,153,145,'accepted','2026-10-08 15:44:59','2026-10-15 15:45:00','2026-10-08 15:44:59'),(41,13,154,145,'accepted','2026-10-08 15:44:59','2026-10-15 15:45:00','2026-10-08 15:45:00'),(42,13,155,145,'accepted','2026-10-08 15:45:00','2026-10-15 15:45:00','2026-10-08 15:45:00'),(43,14,157,156,'accepted','2026-10-08 15:45:00','2026-10-15 15:45:00','2026-10-08 15:45:00'),(44,14,158,156,'accepted','2026-10-08 15:45:00','2026-10-15 15:45:00','2026-10-08 15:45:00'),(45,14,159,156,'accepted','2026-10-08 15:45:00','2026-10-15 15:45:00','2026-10-08 15:45:00'),(46,14,160,156,'accepted','2026-10-08 15:45:00','2026-10-15 15:45:00','2026-10-08 15:45:00'),(47,14,161,156,'accepted','2026-10-08 15:45:00','2026-10-15 15:45:00','2026-10-08 15:45:00'),(48,14,162,156,'accepted','2026-10-08 15:45:00','2026-10-15 15:45:01','2026-10-08 15:45:00'),(49,14,163,156,'accepted','2026-10-08 15:45:00','2026-10-15 15:45:01','2026-10-08 15:45:00'),(50,14,164,156,'accepted','2026-10-08 15:45:00','2026-10-15 15:45:01','2026-10-08 15:45:00'),(51,14,165,156,'accepted','2026-10-08 15:45:00','2026-10-15 15:45:01','2026-10-08 15:45:00'),(52,14,166,156,'accepted','2026-10-08 15:45:00','2026-10-15 15:45:01','2026-10-08 15:45:00'),(53,15,36,35,'pending','2026-10-08 15:45:01','2026-10-15 15:45:01',NULL);
/*!40000 ALTER TABLE `team_invitations` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `team_join_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `team_join_requests` (
  `team_join_request_id` int NOT NULL AUTO_INCREMENT,
  `team_id` int NOT NULL,
  `user_id` int NOT NULL,
  `message` varchar(255) DEFAULT NULL,
  `team_join_request_status` enum('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  `reject_reason` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `responded_at` datetime DEFAULT NULL,
  `responded_by` int DEFAULT NULL,
  PRIMARY KEY (`team_join_request_id`),
  KEY `responded_by` (`responded_by`),
  KEY `idx_join_req_team_status` (`team_id`,`team_join_request_status`),
  KEY `idx_join_req_user` (`user_id`),
  CONSTRAINT `team_join_requests_ibfk_1` FOREIGN KEY (`team_id`) REFERENCES `teams` (`team_id`),
  CONSTRAINT `team_join_requests_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `team_join_requests_ibfk_3` FOREIGN KEY (`responded_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `team_join_requests` WRITE;
/*!40000 ALTER TABLE `team_join_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `team_join_requests` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `team_members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `team_members` (
  `team_member_id` int NOT NULL AUTO_INCREMENT,
  `team_id` int NOT NULL,
  `user_id` int NOT NULL,
  `joined_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`team_member_id`),
  UNIQUE KEY `team_id` (`team_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `team_members_ibfk_1` FOREIGN KEY (`team_id`) REFERENCES `teams` (`team_id`),
  CONSTRAINT `team_members_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=68 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `team_members` WRITE;
/*!40000 ALTER TABLE `team_members` DISABLE KEYS */;
INSERT INTO `team_members` VALUES (1,1,101,'2026-10-08 15:44:56'),(2,1,102,'2026-10-08 15:44:56'),(3,2,103,'2026-10-08 15:44:56'),(4,2,104,'2026-10-08 15:44:56'),(5,3,105,'2026-10-08 15:44:56'),(6,3,106,'2026-10-08 15:44:56'),(7,4,107,'2026-10-08 15:44:56'),(8,4,108,'2026-10-08 15:44:56'),(9,5,109,'2026-10-08 15:44:56'),(10,5,110,'2026-10-08 15:44:57'),(11,6,111,'2026-10-08 15:44:57'),(12,6,112,'2026-10-08 15:44:57'),(13,7,113,'2026-10-08 15:44:57'),(14,7,114,'2026-10-08 15:44:57'),(15,7,115,'2026-10-08 15:44:57'),(16,7,116,'2026-10-08 15:44:57'),(17,7,117,'2026-10-08 15:44:57'),(18,7,118,'2026-10-08 15:44:57'),(19,8,119,'2026-10-08 15:44:57'),(20,8,120,'2026-10-08 15:44:57'),(21,8,121,'2026-10-08 15:44:57'),(22,8,122,'2026-10-08 15:44:57'),(23,8,123,'2026-10-08 15:44:57'),(24,9,124,'2026-10-08 15:44:57'),(25,9,125,'2026-10-08 15:44:57'),(26,9,126,'2026-10-08 15:44:58'),(27,9,127,'2026-10-08 15:44:58'),(28,9,128,'2026-10-08 15:44:58'),(29,9,129,'2026-10-08 15:44:58'),(30,10,130,'2026-10-08 15:44:58'),(31,10,131,'2026-10-08 15:44:58'),(32,10,132,'2026-10-08 15:44:58'),(33,10,133,'2026-10-08 15:44:58'),(34,10,134,'2026-10-08 15:44:58'),(35,11,135,'2026-10-08 15:44:58'),(36,11,136,'2026-10-08 15:44:58'),(37,11,137,'2026-10-08 15:44:58'),(38,11,138,'2026-10-08 15:44:58'),(39,11,139,'2026-10-08 15:44:58'),(40,12,140,'2026-10-08 15:44:59'),(41,12,141,'2026-10-08 15:44:59'),(42,12,142,'2026-10-08 15:44:59'),(43,12,143,'2026-10-08 15:44:59'),(44,12,144,'2026-10-08 15:44:59'),(45,13,145,'2026-10-08 15:44:59'),(46,13,146,'2026-10-08 15:44:59'),(47,13,147,'2026-10-08 15:44:59'),(48,13,148,'2026-10-08 15:44:59'),(49,13,149,'2026-10-08 15:44:59'),(50,13,150,'2026-10-08 15:44:59'),(51,13,151,'2026-10-08 15:44:59'),(52,13,152,'2026-10-08 15:44:59'),(53,13,153,'2026-10-08 15:44:59'),(54,13,154,'2026-10-08 15:45:00'),(55,13,155,'2026-10-08 15:45:00'),(56,14,156,'2026-10-08 15:45:00'),(57,14,157,'2026-10-08 15:45:00'),(58,14,158,'2026-10-08 15:45:00'),(59,14,159,'2026-10-08 15:45:00'),(60,14,160,'2026-10-08 15:45:00'),(61,14,161,'2026-10-08 15:45:00'),(62,14,162,'2026-10-08 15:45:00'),(63,14,163,'2026-10-08 15:45:00'),(64,14,164,'2026-10-08 15:45:00'),(65,14,165,'2026-10-08 15:45:00'),(66,14,166,'2026-10-08 15:45:00'),(67,15,35,'2026-10-08 15:45:00');
/*!40000 ALTER TABLE `team_members` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `teams`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `teams` (
  `team_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `logo_key` varchar(512) DEFAULT NULL,
  `sport_type_id` int NOT NULL,
  `leader_id` int NOT NULL,
  `readiness_status` enum('Forming','Ready') NOT NULL DEFAULT 'Forming',
  `official_status` enum('Unofficial','Official') NOT NULL DEFAULT 'Unofficial',
  `visibility` enum('private','public') NOT NULL DEFAULT 'private',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL,
  `last_competed_at` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_reason` enum('no_registration','leader_deleted','inactive_6_months') DEFAULT NULL,
  PRIMARY KEY (`team_id`),
  UNIQUE KEY `name` (`name`,`sport_type_id`),
  KEY `sport_type_id` (`sport_type_id`),
  KEY `leader_id` (`leader_id`),
  CONSTRAINT `teams_ibfk_1` FOREIGN KEY (`sport_type_id`) REFERENCES `sport_types` (`sport_type_id`),
  CONSTRAINT `teams_ibfk_2` FOREIGN KEY (`leader_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `teams` WRITE;
/*!40000 ALTER TABLE `teams` DISABLE KEYS */;
INSERT INTO `teams` VALUES (1,'วิศวะ Smashers',NULL,3,101,'Ready','Unofficial','private','2026-10-08 15:44:56','2026-10-08 15:44:56',NULL,NULL,NULL),(2,'Sci Shuttle',NULL,3,103,'Ready','Unofficial','private','2026-10-08 15:44:56','2026-10-08 15:44:56',NULL,NULL,NULL),(3,'เกษตรตบสนั่น',NULL,3,105,'Ready','Unofficial','private','2026-10-08 15:44:56','2026-10-08 15:44:56','2026-10-08 15:45:15',NULL,NULL),(4,'BBA Birdies',NULL,3,107,'Ready','Unofficial','private','2026-10-08 15:44:56','2026-10-08 15:44:56','2026-10-08 15:45:15',NULL,NULL),(5,'มนุษย์ลูกขนไก่',NULL,3,109,'Ready','Unofficial','private','2026-10-08 15:44:56','2026-10-08 15:44:57','2026-10-08 15:45:15',NULL,NULL),(6,'Econ Rackets',NULL,3,111,'Ready','Unofficial','private','2026-10-08 15:44:57','2026-10-08 15:44:57','2026-10-08 15:45:15',NULL,NULL),(7,'วิศวะ Ballers',NULL,2,113,'Ready','Unofficial','private','2026-10-08 15:44:57','2026-10-08 15:44:57',NULL,NULL,NULL),(8,'Sci Hoopers',NULL,2,119,'Ready','Unofficial','private','2026-10-08 15:44:57','2026-10-08 15:44:57',NULL,NULL,NULL),(9,'วิศวะ Lady Hoops',NULL,2,124,'Ready','Unofficial','private','2026-10-08 15:44:57','2026-10-08 15:44:58',NULL,NULL,NULL),(10,'บริหาร Queens',NULL,2,130,'Ready','Unofficial','private','2026-10-08 15:44:58','2026-10-08 15:44:58',NULL,NULL,NULL),(11,'RoV วิศวะ Dragons',NULL,4,135,'Ready','Unofficial','private','2026-10-08 15:44:58','2026-10-08 15:44:58',NULL,NULL,NULL),(12,'RoV Sci Phoenix',NULL,4,140,'Ready','Unofficial','private','2026-10-08 15:44:59','2026-10-08 15:44:59',NULL,NULL,NULL),(13,'ฟุตบอลวิศวกรรมศาสตร์',NULL,1,145,'Ready','Official','private','2026-10-08 15:44:59','2026-10-08 15:45:00',NULL,NULL,NULL),(14,'ฟุตบอลวิทยาศาสตร์',NULL,1,156,'Ready','Unofficial','private','2026-10-08 15:45:00','2026-10-08 15:45:00',NULL,NULL,NULL),(15,'มือใหม่หัดตบ',NULL,3,35,'Forming','Unofficial','private','2026-10-08 15:45:00',NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `teams` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `tournament_amendment_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament_amendment_requests` (
  `tournament_amendment_request_id` int NOT NULL AUTO_INCREMENT,
  `tournament_id` int NOT NULL,
  `requested_by` int NOT NULL,
  `requested_changes` json NOT NULL,
  `request_reason` text,
  `tournament_amendment_request_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `requested_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_by` int DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `rejection_reason` text,
  `pending_key` varchar(16) GENERATED ALWAYS AS (if((`tournament_amendment_request_status` = _utf8mb4'pending'),`tournament_id`,NULL)) VIRTUAL,
  PRIMARY KEY (`tournament_amendment_request_id`),
  UNIQUE KEY `uq_amendment_pending` (`pending_key`),
  KEY `tournament_id` (`tournament_id`),
  KEY `requested_by` (`requested_by`),
  KEY `reviewed_by` (`reviewed_by`),
  CONSTRAINT `tournament_amendment_requests_ibfk_1` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`tournament_id`),
  CONSTRAINT `tournament_amendment_requests_ibfk_2` FOREIGN KEY (`requested_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `tournament_amendment_requests_ibfk_3` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `tournament_amendment_requests` WRITE;
/*!40000 ALTER TABLE `tournament_amendment_requests` DISABLE KEYS */;
INSERT INTO `tournament_amendment_requests` (`tournament_amendment_request_id`, `tournament_id`, `requested_by`, `requested_changes`, `request_reason`, `tournament_amendment_request_status`, `requested_at`, `reviewed_by`, `reviewed_at`, `rejection_reason`) VALUES (1,5,11,'{\"maxAge\": 28}','มีนิสิตปริญญาโทขอร่วมแข่ง ขอขยายอายุสูงสุดจาก 25 เป็น 28 ปี','pending','2026-10-08 15:45:25',NULL,NULL,NULL);
/*!40000 ALTER TABLE `tournament_amendment_requests` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `tournament_applications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament_applications` (
  `tournament_application_id` int NOT NULL AUTO_INCREMENT,
  `tournament_id` int NOT NULL,
  `team_id` int NOT NULL,
  `hard_filter_passed` tinyint(1) DEFAULT NULL,
  `hard_filter_details` json DEFAULT NULL,
  `soft_filter_documents` json DEFAULT NULL,
  `tournament_application_status` enum('pending','approved','rejected','cancelled','withdrawn') NOT NULL DEFAULT 'pending',
  `reviewed_by` int DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `rejection_reason` text,
  `applied_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `active_key` varchar(32) GENERATED ALWAYS AS (if((`tournament_application_status` in (_utf8mb4'pending',_utf8mb4'approved')),concat_ws(_utf8mb4':',`tournament_id`,`team_id`),NULL)) VIRTUAL,
  PRIMARY KEY (`tournament_application_id`),
  UNIQUE KEY `uq_application_active` (`active_key`),
  KEY `team_id` (`team_id`),
  KEY `reviewed_by` (`reviewed_by`),
  KEY `idx_application_tournament` (`tournament_id`),
  CONSTRAINT `tournament_applications_ibfk_1` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`tournament_id`),
  CONSTRAINT `tournament_applications_ibfk_2` FOREIGN KEY (`team_id`) REFERENCES `teams` (`team_id`),
  CONSTRAINT `tournament_applications_ibfk_3` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `tournament_applications` WRITE;
/*!40000 ALTER TABLE `tournament_applications` DISABLE KEYS */;
INSERT INTO `tournament_applications` (`tournament_application_id`, `tournament_id`, `team_id`, `hard_filter_passed`, `hard_filter_details`, `soft_filter_documents`, `tournament_application_status`, `reviewed_by`, `reviewed_at`, `rejection_reason`, `applied_at`) VALUES (1,5,10,1,'[{\"passed\": true, \"userId\": 130, \"fullName\": \"ศิริลักษณ์ ศักดิ์ดี\"}, {\"passed\": true, \"userId\": 131, \"fullName\": \"กมลชนก พรหมมา\"}, {\"passed\": true, \"userId\": 132, \"fullName\": \"ณิชากร กิตติวงศ์\"}, {\"passed\": true, \"userId\": 133, \"fullName\": \"พรรณวษา แสงทอง\"}, {\"passed\": true, \"userId\": 134, \"fullName\": \"จิดาภา ศรีสุข\"}]','[]','pending',NULL,NULL,NULL,'2026-10-08 15:45:03'),(2,6,3,1,'[{\"passed\": true, \"userId\": 105, \"fullName\": \"พีรพล วงศ์สวัสดิ์\"}, {\"passed\": true, \"userId\": 106, \"fullName\": \"ชยพล อินทรีย์\"}]','[]','approved',NULL,NULL,NULL,'2026-10-08 15:45:03'),(3,6,4,1,'[{\"passed\": true, \"userId\": 107, \"fullName\": \"ณัฐธิดา สุวรรณภูมิ\"}, {\"passed\": true, \"userId\": 108, \"fullName\": \"พิมพ์ลภัส รุ่งเรือง\"}]','[]','approved',NULL,NULL,NULL,'2026-10-08 15:45:03'),(4,6,5,1,'[{\"passed\": true, \"userId\": 109, \"fullName\": \"กัญญาณัฐ ชัยมงคล\"}, {\"passed\": true, \"userId\": 110, \"fullName\": \"ชนิกานต์ นาคประเสริฐ\"}]','[]','approved',NULL,NULL,NULL,'2026-10-08 15:45:03'),(5,6,6,1,'[{\"passed\": true, \"userId\": 111, \"fullName\": \"วรเมธ ศักดิ์ดี\"}, {\"passed\": true, \"userId\": 112, \"fullName\": \"ศุภกร พรหมมา\"}]','[]','approved',NULL,NULL,NULL,'2026-10-08 15:45:03'),(6,7,1,1,'[{\"passed\": true, \"userId\": 101, \"fullName\": \"ธนวัฒน์ เกษมสุข\"}, {\"passed\": true, \"userId\": 102, \"fullName\": \"ภูมิพัฒน์ พงษ์ไพบูลย์\"}]','[]','approved',NULL,NULL,NULL,'2026-10-08 15:45:03'),(7,7,2,1,'[{\"passed\": true, \"userId\": 103, \"fullName\": \"กฤษณะ มณีรัตน์\"}, {\"passed\": true, \"userId\": 104, \"fullName\": \"ณัฐวุฒิ ธารารักษ์\"}]','[]','approved',NULL,NULL,NULL,'2026-10-08 15:45:03'),(8,7,3,1,'[{\"passed\": true, \"userId\": 105, \"fullName\": \"พีรพล วงศ์สวัสดิ์\"}, {\"passed\": true, \"userId\": 106, \"fullName\": \"ชยพล อินทรีย์\"}]','[]','approved',NULL,NULL,NULL,'2026-10-08 15:45:03'),(9,7,4,1,'[{\"passed\": true, \"userId\": 107, \"fullName\": \"ณัฐธิดา สุวรรณภูมิ\"}, {\"passed\": true, \"userId\": 108, \"fullName\": \"พิมพ์ลภัส รุ่งเรือง\"}]','[]','approved',NULL,NULL,NULL,'2026-10-08 15:45:04'),(10,8,1,1,'[{\"passed\": true, \"userId\": 101, \"fullName\": \"ธนวัฒน์ เกษมสุข\"}, {\"passed\": true, \"userId\": 102, \"fullName\": \"ภูมิพัฒน์ พงษ์ไพบูลย์\"}]','[]','approved',NULL,NULL,NULL,'2026-10-08 15:45:04'),(11,8,2,1,'[{\"passed\": true, \"userId\": 103, \"fullName\": \"กฤษณะ มณีรัตน์\"}, {\"passed\": true, \"userId\": 104, \"fullName\": \"ณัฐวุฒิ ธารารักษ์\"}]','[]','approved',NULL,NULL,NULL,'2026-10-08 15:45:04'),(12,8,5,1,'[{\"passed\": true, \"userId\": 109, \"fullName\": \"กัญญาณัฐ ชัยมงคล\"}, {\"passed\": true, \"userId\": 110, \"fullName\": \"ชนิกานต์ นาคประเสริฐ\"}]','[]','approved',NULL,NULL,NULL,'2026-10-08 15:45:04'),(13,8,6,1,'[{\"passed\": true, \"userId\": 111, \"fullName\": \"วรเมธ ศักดิ์ดี\"}, {\"passed\": true, \"userId\": 112, \"fullName\": \"ศุภกร พรหมมา\"}]','[]','approved',NULL,NULL,NULL,'2026-10-08 15:45:04'),(14,9,3,1,'[{\"passed\": true, \"userId\": 105, \"fullName\": \"พีรพล วงศ์สวัสดิ์\"}, {\"passed\": true, \"userId\": 106, \"fullName\": \"ชยพล อินทรีย์\"}]','[]','approved',NULL,NULL,NULL,'2026-10-08 15:45:04'),(15,9,4,1,'[{\"passed\": true, \"userId\": 107, \"fullName\": \"ณัฐธิดา สุวรรณภูมิ\"}, {\"passed\": true, \"userId\": 108, \"fullName\": \"พิมพ์ลภัส รุ่งเรือง\"}]','[]','approved',NULL,NULL,NULL,'2026-10-08 15:45:04'),(16,9,5,1,'[{\"passed\": true, \"userId\": 109, \"fullName\": \"กัญญาณัฐ ชัยมงคล\"}, {\"passed\": true, \"userId\": 110, \"fullName\": \"ชนิกานต์ นาคประเสริฐ\"}]','[]','approved',NULL,NULL,NULL,'2026-10-08 15:45:04'),(17,9,6,1,'[{\"passed\": true, \"userId\": 111, \"fullName\": \"วรเมธ ศักดิ์ดี\"}, {\"passed\": true, \"userId\": 112, \"fullName\": \"ศุภกร พรหมมา\"}]','[]','approved',NULL,NULL,NULL,'2026-10-08 15:45:04'),(18,10,11,1,'[{\"passed\": true, \"userId\": 135, \"fullName\": \"ธนกฤต บุญมา\"}, {\"passed\": true, \"userId\": 136, \"fullName\": \"วชิรวิทย์ จันทร์เพ็ญ\"}, {\"passed\": true, \"userId\": 137, \"fullName\": \"ปุณณวิช ทองคำ\"}, {\"passed\": true, \"userId\": 138, \"fullName\": \"ณภัทร ปัญญาดี\"}, {\"passed\": true, \"userId\": 139, \"fullName\": \"กันตพงศ์ เกษมสุข\"}]','[]','approved',NULL,NULL,NULL,'2026-10-08 15:45:04'),(19,10,12,1,'[{\"passed\": true, \"userId\": 140, \"fullName\": \"ชัยวัฒน์ พงษ์ไพบูลย์\"}, {\"passed\": true, \"userId\": 141, \"fullName\": \"สหรัฐ มณีรัตน์\"}, {\"passed\": true, \"userId\": 142, \"fullName\": \"พงศกร ธารารักษ์\"}, {\"passed\": true, \"userId\": 143, \"fullName\": \"ธนดล วงศ์สวัสดิ์\"}, {\"passed\": true, \"userId\": 144, \"fullName\": \"อิทธิพล อินทรีย์\"}]','[]','approved',NULL,NULL,NULL,'2026-10-08 15:45:04'),(20,11,1,1,'[{\"passed\": true, \"userId\": 101, \"fullName\": \"ธนวัฒน์ เกษมสุข\"}, {\"passed\": true, \"userId\": 102, \"fullName\": \"ภูมิพัฒน์ พงษ์ไพบูลย์\"}]','[]','approved',NULL,NULL,NULL,'2026-10-08 15:45:04'),(21,11,2,1,'[{\"passed\": true, \"userId\": 103, \"fullName\": \"กฤษณะ มณีรัตน์\"}, {\"passed\": true, \"userId\": 104, \"fullName\": \"ณัฐวุฒิ ธารารักษ์\"}]','[]','approved',NULL,NULL,NULL,'2026-10-08 15:45:04'),(22,11,3,1,'[{\"passed\": true, \"userId\": 105, \"fullName\": \"พีรพล วงศ์สวัสดิ์\"}, {\"passed\": true, \"userId\": 106, \"fullName\": \"ชยพล อินทรีย์\"}]','[]','approved',NULL,NULL,NULL,'2026-10-08 15:45:04'),(23,11,4,1,'[{\"passed\": true, \"userId\": 107, \"fullName\": \"ณัฐธิดา สุวรรณภูมิ\"}, {\"passed\": true, \"userId\": 108, \"fullName\": \"พิมพ์ลภัส รุ่งเรือง\"}]','[]','approved',NULL,NULL,NULL,'2026-10-08 15:45:04');
/*!40000 ALTER TABLE `tournament_applications` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `tournament_eligibility_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament_eligibility_rules` (
  `tournament_eligibility_rule_id` int NOT NULL AUTO_INCREMENT,
  `tournament_id` int NOT NULL,
  `rule_type` enum('year','faculty') NOT NULL,
  `rule_value` int NOT NULL,
  PRIMARY KEY (`tournament_eligibility_rule_id`),
  UNIQUE KEY `tournament_id` (`tournament_id`,`rule_type`,`rule_value`),
  CONSTRAINT `tournament_eligibility_rules_ibfk_1` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`tournament_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `tournament_eligibility_rules` WRITE;
/*!40000 ALTER TABLE `tournament_eligibility_rules` DISABLE KEYS */;
/*!40000 ALTER TABLE `tournament_eligibility_rules` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `tournament_feedback`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament_feedback` (
  `tournament_feedback_id` int NOT NULL AUTO_INCREMENT,
  `tournament_id` int NOT NULL,
  `user_id` int NOT NULL,
  `feedback_type` enum('comment','organizer_feedback','mvp_vote') NOT NULL,
  `content` text,
  `rating` int DEFAULT NULL,
  `voted_for_user_id` int DEFAULT NULL,
  `match_id` int DEFAULT NULL,
  `match_key` int GENERATED ALWAYS AS (ifnull(`match_id`,0)) STORED,
  `is_reported` tinyint(1) NOT NULL DEFAULT '0',
  `report_cleared_at` datetime DEFAULT NULL,
  `removed_at` datetime DEFAULT NULL,
  `removed_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`tournament_feedback_id`),
  UNIQUE KEY `tournament_id` (`tournament_id`,`match_key`,`user_id`,`feedback_type`),
  KEY `user_id` (`user_id`),
  KEY `voted_for_user_id` (`voted_for_user_id`),
  KEY `match_id` (`match_id`),
  KEY `removed_by` (`removed_by`),
  CONSTRAINT `tournament_feedback_ibfk_1` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`tournament_id`),
  CONSTRAINT `tournament_feedback_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `tournament_feedback_ibfk_3` FOREIGN KEY (`voted_for_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `tournament_feedback_ibfk_4` FOREIGN KEY (`match_id`) REFERENCES `matches` (`match_id`),
  CONSTRAINT `tournament_feedback_ibfk_5` FOREIGN KEY (`removed_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `tournament_feedback` WRITE;
/*!40000 ALTER TABLE `tournament_feedback` DISABLE KEYS */;
INSERT INTO `tournament_feedback` (`tournament_feedback_id`, `tournament_id`, `user_id`, `feedback_type`, `content`, `rating`, `voted_for_user_id`, `match_id`, `is_reported`, `report_cleared_at`, `removed_at`, `removed_by`, `created_at`) VALUES (1,9,31,'mvp_vote',NULL,NULL,105,7,0,NULL,NULL,NULL,'2026-10-08 15:45:12'),(2,9,32,'mvp_vote',NULL,NULL,105,7,0,NULL,NULL,NULL,'2026-10-08 15:45:12'),(3,9,33,'mvp_vote',NULL,NULL,108,7,0,NULL,NULL,NULL,'2026-10-08 15:45:12'),(4,9,31,'mvp_vote',NULL,NULL,109,8,0,NULL,NULL,NULL,'2026-10-08 15:45:13'),(5,9,32,'mvp_vote',NULL,NULL,110,8,0,NULL,NULL,NULL,'2026-10-08 15:45:13'),(6,9,33,'mvp_vote',NULL,NULL,109,8,0,NULL,NULL,NULL,'2026-10-08 15:45:13'),(7,9,31,'mvp_vote',NULL,NULL,109,9,0,NULL,NULL,NULL,'2026-10-08 15:45:14'),(8,9,32,'mvp_vote',NULL,NULL,109,9,0,NULL,NULL,NULL,'2026-10-08 15:45:14'),(9,9,33,'mvp_vote',NULL,NULL,105,9,0,NULL,NULL,NULL,'2026-10-08 15:45:15'),(10,9,31,'comment','รอบชิงสนุกมาก ลุ้นจนเซตสุดท้าย',NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-10-08 15:45:15'),(11,9,32,'comment','ขอบคุณผู้จัดและกรรมการ จัดได้ตรงเวลาทุกแมตช์',NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-10-08 15:45:15'),(12,9,109,'comment','ขอบคุณทุกทีมที่มาร่วมแข่ง แล้วเจอกันรายการหน้า',NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-10-08 15:45:15'),(13,9,109,'organizer_feedback','จัดการดี สนามพร้อม กรรมการตัดสินชัดเจน',5,NULL,NULL,0,NULL,NULL,NULL,'2026-10-08 15:45:15'),(14,9,105,'organizer_feedback','โดยรวมดี อยากให้มีเวลาพักระหว่างแมตช์มากขึ้น',4,NULL,NULL,0,NULL,NULL,NULL,'2026-10-08 15:45:15'),(15,9,107,'organizer_feedback','ประกาศตารางล่วงหน้าชัดเจน',5,NULL,NULL,0,NULL,NULL,NULL,'2026-10-08 15:45:15'),(16,9,112,'organizer_feedback','สนามคอร์ต B ไฟสว่างไม่พอ',3,NULL,NULL,0,NULL,NULL,NULL,'2026-10-08 15:45:15'),(17,9,111,'organizer_feedback',NULL,4,NULL,NULL,0,NULL,NULL,NULL,'2026-10-08 15:45:15'),(18,8,31,'mvp_vote',NULL,NULL,111,4,0,NULL,NULL,NULL,'2026-10-08 15:45:17'),(19,8,32,'mvp_vote',NULL,NULL,110,4,0,NULL,NULL,NULL,'2026-10-08 15:45:17'),(20,8,33,'comment','กรรมการเป่าเข้าข้างชัด ๆ แย่มาก',NULL,NULL,NULL,1,NULL,NULL,NULL,'2026-10-08 15:45:19'),(21,8,32,'comment','คู่แรกสูสีมาก เชียร์ทั้งสองทีม',NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-10-08 15:45:19'),(22,7,31,'comment','รอดูคู่วิศวะ–วิทยา คู่นี้เจอกันทุกปี',NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-10-08 15:45:24'),(23,7,33,'comment','ปีนี้เชียร์เกษตรตบสนั่น',NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-10-08 15:45:24');
/*!40000 ALTER TABLE `tournament_feedback` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `tournament_questions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament_questions` (
  `tournament_question_id` int NOT NULL AUTO_INCREMENT,
  `tournament_id` int NOT NULL,
  `asked_by` int NOT NULL,
  `question` text NOT NULL,
  `answer` text,
  `answered_by` int DEFAULT NULL,
  `answered_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`tournament_question_id`),
  KEY `tournament_id` (`tournament_id`),
  KEY `asked_by` (`asked_by`),
  KEY `answered_by` (`answered_by`),
  CONSTRAINT `tournament_questions_ibfk_1` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`tournament_id`),
  CONSTRAINT `tournament_questions_ibfk_2` FOREIGN KEY (`asked_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `tournament_questions_ibfk_3` FOREIGN KEY (`answered_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `tournament_questions` WRITE;
/*!40000 ALTER TABLE `tournament_questions` DISABLE KEYS */;
/*!40000 ALTER TABLE `tournament_questions` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `tournament_referees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament_referees` (
  `tournament_referee_id` int NOT NULL AUTO_INCREMENT,
  `tournament_id` int NOT NULL,
  `user_id` int NOT NULL,
  `invited_by` int NOT NULL,
  `invitation_status` enum('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  `is_external` tinyint(1) NOT NULL DEFAULT '0',
  `external_approval_status` enum('not_required','pending','needs_docs','approved','rejected') NOT NULL DEFAULT 'not_required',
  `external_verification_docs` json DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `external_rejection_reason` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `removed_at` datetime DEFAULT NULL,
  `removed_by` int DEFAULT NULL,
  `active_user_id` int GENERATED ALWAYS AS ((case when ((`removed_at` is null) and (`invitation_status` = _utf8mb4'accepted') and ((`is_external` = 0) or (`external_approval_status` in (_utf8mb4'not_required',_utf8mb4'approved')))) then `user_id` end)) VIRTUAL,
  `expires_at` datetime DEFAULT NULL COMMENT 'คำเชิญหมดอายุเมื่อไหร่ (เฉพาะแถวที่ยัง pending) — NULL = ไม่มีวันหมดอายุ',
  PRIMARY KEY (`tournament_referee_id`),
  UNIQUE KEY `uq_tr_active_once` (`tournament_id`,`active_user_id`),
  KEY `tournament_id` (`tournament_id`),
  KEY `user_id` (`user_id`),
  KEY `invited_by` (`invited_by`),
  KEY `approved_by` (`approved_by`),
  KEY `removed_by` (`removed_by`),
  CONSTRAINT `tournament_referees_ibfk_1` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`tournament_id`),
  CONSTRAINT `tournament_referees_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `tournament_referees_ibfk_3` FOREIGN KEY (`invited_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `tournament_referees_ibfk_4` FOREIGN KEY (`approved_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `tournament_referees_ibfk_5` FOREIGN KEY (`removed_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `tournament_referees` WRITE;
/*!40000 ALTER TABLE `tournament_referees` DISABLE KEYS */;
INSERT INTO `tournament_referees` (`tournament_referee_id`, `tournament_id`, `user_id`, `invited_by`, `invitation_status`, `is_external`, `external_approval_status`, `external_verification_docs`, `approved_by`, `approved_at`, `external_rejection_reason`, `created_at`, `removed_at`, `removed_by`, `expires_at`) VALUES (1,4,23,12,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-10-08 15:45:01',NULL,NULL,'2026-10-15 15:45:01'),(2,4,24,12,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-10-08 15:45:01',NULL,NULL,'2026-10-15 15:45:01'),(3,5,21,11,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-10-08 15:45:01',NULL,NULL,'2026-10-15 15:45:01'),(4,5,22,11,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-10-08 15:45:01',NULL,NULL,'2026-10-15 15:45:01'),(5,6,23,13,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-10-08 15:45:01',NULL,NULL,'2026-10-15 15:45:01'),(6,6,24,13,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-10-08 15:45:02',NULL,NULL,'2026-10-15 15:45:02'),(7,7,21,11,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-10-08 15:45:02',NULL,NULL,'2026-10-15 15:45:02'),(8,7,22,11,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-10-08 15:45:02',NULL,NULL,'2026-10-15 15:45:02'),(9,8,23,12,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-10-08 15:45:02',NULL,NULL,'2026-10-15 15:45:02'),(10,8,24,12,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-10-08 15:45:02',NULL,NULL,'2026-10-15 15:45:02'),(11,9,23,13,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-10-08 15:45:02',NULL,NULL,'2026-10-15 15:45:02'),(12,9,24,13,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-10-08 15:45:02',NULL,NULL,'2026-10-15 15:45:02'),(13,10,23,13,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-10-08 15:45:02',NULL,NULL,'2026-10-15 15:45:02'),(14,10,24,13,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-10-08 15:45:02',NULL,NULL,'2026-10-15 15:45:02'),(15,11,21,11,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-10-08 15:45:02',NULL,NULL,'2026-10-15 15:45:02'),(16,11,22,11,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-10-08 15:45:02',NULL,NULL,'2026-10-15 15:45:02'),(17,6,25,13,'accepted',1,'approved',NULL,2,'2026-10-08 15:45:25',NULL,'2026-10-08 15:45:25',NULL,NULL,'2026-10-15 15:45:25'),(18,4,26,12,'accepted',1,'pending','[\"referee_identity/26/00000000-0000-4000-8000-000000000026.png\"]',NULL,NULL,NULL,'2026-10-08 15:45:25',NULL,NULL,'2026-10-15 15:45:25');
/*!40000 ALTER TABLE `tournament_referees` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `tournament_standings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament_standings` (
  `standing_id` int NOT NULL AUTO_INCREMENT,
  `tournament_id` int NOT NULL,
  `team_id` int NOT NULL,
  `played` int NOT NULL DEFAULT '0',
  `won` int NOT NULL DEFAULT '0',
  `lost` int NOT NULL DEFAULT '0',
  `points` int NOT NULL DEFAULT '0',
  `goals_for` int NOT NULL DEFAULT '0',
  `goals_against` int NOT NULL DEFAULT '0',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`standing_id`),
  UNIQUE KEY `tournament_id` (`tournament_id`,`team_id`),
  KEY `team_id` (`team_id`),
  CONSTRAINT `tournament_standings_ibfk_1` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`tournament_id`),
  CONSTRAINT `tournament_standings_ibfk_2` FOREIGN KEY (`team_id`) REFERENCES `teams` (`team_id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `tournament_standings` WRITE;
/*!40000 ALTER TABLE `tournament_standings` DISABLE KEYS */;
INSERT INTO `tournament_standings` VALUES (1,9,3,2,1,1,3,3,3,'2026-10-08 15:45:14'),(2,9,4,1,0,1,0,1,2,'2026-10-08 15:45:11'),(3,9,5,2,2,0,6,4,1,'2026-10-08 15:45:14'),(4,9,6,1,0,1,0,0,2,'2026-10-08 15:45:13'),(7,8,6,1,1,0,3,2,1,'2026-10-08 15:45:17'),(8,8,5,1,0,1,0,1,2,'2026-10-08 15:45:17'),(9,11,4,2,2,0,6,4,0,'2026-10-08 15:45:23'),(10,11,3,1,0,1,0,0,2,'2026-10-08 15:45:20'),(11,11,1,1,1,0,3,2,1,'2026-10-08 15:45:21'),(12,11,2,2,0,2,0,1,4,'2026-10-08 15:45:23');
/*!40000 ALTER TABLE `tournament_standings` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `tournaments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournaments` (
  `tournament_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `entry_notes` text,
  `sport_type_id` int NOT NULL,
  `bracket_format` enum('single_elimination','double_elimination','round_robin') DEFAULT NULL,
  `best_of` int DEFAULT NULL,
  `scope_type` enum('department','faculty','university') NOT NULL,
  `organizing_faculty_id` int DEFAULT NULL,
  `organizing_department_id` int DEFAULT NULL,
  `requested_by_user_id` int NOT NULL,
  `organizer_external_approval_status` enum('not_required','pending','approved','rejected') NOT NULL DEFAULT 'not_required',
  `organizer_external_reviewed_by` int DEFAULT NULL,
  `organizer_external_reviewed_at` datetime DEFAULT NULL,
  `organizer_external_rejection_reason` text,
  `organizer_external_verification_docs` json DEFAULT NULL,
  `tournament_status` enum('pending_approval','rejected','private','public','completed','auto_deleted') NOT NULL DEFAULT 'pending_approval',
  `registration_open` tinyint(1) NOT NULL DEFAULT '0',
  `registration_start` datetime DEFAULT NULL,
  `registration_end` datetime DEFAULT NULL,
  `event_start_date` date NOT NULL,
  `event_end_date` date DEFAULT NULL,
  `max_teams` int NOT NULL,
  `min_teams` int NOT NULL,
  `venue` varchar(255) DEFAULT NULL,
  `dispute_window_hours` int NOT NULL DEFAULT '24',
  `gender_requirement` enum('any','male','female') NOT NULL DEFAULT 'any',
  `min_age` int DEFAULT NULL,
  `max_age` int DEFAULT NULL,
  `rejection_reason` text,
  `approved_by` int DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `champion_team_id` int DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `completed_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int DEFAULT NULL,
  PRIMARY KEY (`tournament_id`),
  KEY `sport_type_id` (`sport_type_id`),
  KEY `organizing_faculty_id` (`organizing_faculty_id`),
  KEY `organizing_department_id` (`organizing_department_id`),
  KEY `requested_by_user_id` (`requested_by_user_id`),
  KEY `organizer_external_reviewed_by` (`organizer_external_reviewed_by`),
  KEY `approved_by` (`approved_by`),
  KEY `updated_by` (`updated_by`),
  KEY `deleted_by` (`deleted_by`),
  KEY `fk_tournaments_champion` (`champion_team_id`),
  KEY `fk_tournaments_completed_by` (`completed_by`),
  CONSTRAINT `fk_tournaments_champion` FOREIGN KEY (`champion_team_id`) REFERENCES `teams` (`team_id`),
  CONSTRAINT `fk_tournaments_completed_by` FOREIGN KEY (`completed_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `tournaments_ibfk_1` FOREIGN KEY (`sport_type_id`) REFERENCES `sport_types` (`sport_type_id`),
  CONSTRAINT `tournaments_ibfk_2` FOREIGN KEY (`organizing_faculty_id`) REFERENCES `faculties` (`faculty_id`),
  CONSTRAINT `tournaments_ibfk_3` FOREIGN KEY (`organizing_department_id`) REFERENCES `departments` (`department_id`),
  CONSTRAINT `tournaments_ibfk_4` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `tournaments_ibfk_5` FOREIGN KEY (`organizer_external_reviewed_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `tournaments_ibfk_6` FOREIGN KEY (`approved_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `tournaments_ibfk_7` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `tournaments_ibfk_8` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `chk_tournaments_best_of` CHECK (((`best_of` is null) or (`best_of` in (1,3,5,7))))
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `tournaments` WRITE;
/*!40000 ALTER TABLE `tournaments` DISABLE KEYS */;
INSERT INTO `tournaments` VALUES (1,'ฟุตบอลประเพณี วิศวะ–วิทยา 2569',NULL,NULL,1,'single_elimination',NULL,'faculty',1,NULL,11,'not_required',NULL,NULL,NULL,NULL,'pending_approval',0,'2026-10-08 15:42:51','2026-10-16 06:00:00','2026-10-23','2026-10-24',4,2,'สนามกีฬากลาง',72,'any',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-08 15:45:01',NULL,NULL,NULL,NULL),(2,'VALORANT Night Cup',NULL,NULL,5,'single_elimination',3,'faculty',4,NULL,13,'not_required',NULL,NULL,NULL,NULL,'pending_approval',0,'2026-10-08 15:42:51','2026-10-16 06:00:00','2026-10-23','2026-10-24',4,2,'ออนไลน์',72,'any',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-08 15:45:01',NULL,NULL,NULL,NULL),(3,'บาสเกตบอลเฟรชชี่คัพ',NULL,NULL,2,'single_elimination',NULL,'faculty',2,NULL,12,'not_required',NULL,NULL,NULL,NULL,'private',0,'2026-10-08 15:42:51','2026-10-16 06:00:00','2026-10-23','2026-10-24',4,2,'โรงยิม 2',72,'any',NULL,NULL,NULL,2,'2026-10-08 15:45:01',NULL,NULL,NULL,'2026-10-08 15:45:01','2026-10-08 15:45:01',2,NULL,NULL),(4,'แบดมินตันเกษตรแฟร์',NULL,NULL,3,'single_elimination',3,'faculty',2,NULL,12,'not_required',NULL,NULL,NULL,NULL,'private',0,'2026-10-08 15:42:51','2026-10-16 06:00:00','2026-10-23','2026-10-24',4,2,'โรงยิม 1',72,'any',NULL,NULL,NULL,2,'2026-10-08 15:45:01',NULL,NULL,NULL,'2026-10-08 15:45:01','2026-10-08 15:45:01',2,NULL,NULL),(5,'บาสเกตบอลหญิง ชิงถ้วยคณบดี',NULL,'รับเฉพาะทีมหญิง อายุ 18–25 ปี · นำบัตรนักศึกษามาเช็คอินทุกแมตช์',2,'single_elimination',NULL,'faculty',1,NULL,11,'not_required',NULL,NULL,NULL,NULL,'public',1,'2026-10-08 15:42:51','2026-10-16 06:00:00','2026-10-23','2026-10-24',4,2,'ศูนย์กีฬามหาวิทยาลัย',72,'female',18,25,NULL,2,'2026-10-08 15:45:01',NULL,NULL,NULL,'2026-10-08 15:45:01','2026-10-08 15:45:03',11,NULL,NULL),(6,'แบดมินตัน Open รอบคัดเลือก',NULL,NULL,3,'single_elimination',3,'faculty',4,NULL,13,'not_required',NULL,NULL,NULL,NULL,'public',0,'2026-09-18 15:44:51','2026-10-08 12:44:51','2026-10-12','2026-10-13',4,2,'โรงยิม 3',72,'any',NULL,NULL,NULL,2,'2026-10-08 15:45:01',NULL,NULL,NULL,'2026-10-08 15:45:01','2026-10-08 15:45:05',13,NULL,NULL),(7,'แบดมินตันชิงแชมป์มหาวิทยาลัย 2569',NULL,NULL,3,'single_elimination',3,'faculty',1,NULL,11,'not_required',NULL,NULL,NULL,NULL,'public',0,'2026-09-18 15:44:51','2026-10-02 15:44:51','2026-10-08','2026-10-10',4,2,'โรงยิม 1',72,'any',NULL,NULL,NULL,2,'2026-10-08 15:45:01',NULL,NULL,NULL,'2026-10-08 15:45:01','2026-10-08 15:45:05',11,NULL,NULL),(8,'แบดมินตัน Faculty League',NULL,NULL,3,'single_elimination',3,'faculty',2,NULL,12,'not_required',NULL,NULL,NULL,NULL,'public',0,'2026-09-18 15:44:51','2026-10-02 15:44:51','2026-10-07','2026-10-10',4,2,'โรงยิม 2',72,'any',NULL,NULL,NULL,2,'2026-10-08 15:45:01',NULL,NULL,NULL,'2026-10-08 15:45:01','2026-10-08 15:45:05',12,NULL,NULL),(9,'แบดมินตัน Welcome Cup',NULL,NULL,3,'single_elimination',3,'faculty',4,NULL,13,'not_required',NULL,NULL,NULL,NULL,'completed',0,'2026-09-08 15:44:51','2026-09-26 15:44:51','2026-09-30','2026-10-01',4,2,'โรงยิม 4',72,'any',NULL,NULL,NULL,2,'2026-10-08 15:45:01',5,'2026-10-06 15:44:51',13,'2026-10-08 15:45:01','2026-10-08 15:45:15',13,NULL,NULL),(10,'RoV Campus Showdown (ออนไลน์)',NULL,NULL,4,'single_elimination',3,'faculty',4,NULL,13,'not_required',NULL,NULL,NULL,NULL,'public',0,'2026-09-18 15:44:51','2026-10-02 15:44:51','2026-10-08','2026-10-10',4,2,'ออนไลน์',72,'any',NULL,NULL,NULL,2,'2026-10-08 15:45:01',NULL,NULL,NULL,'2026-10-08 15:45:01','2026-10-08 15:45:05',13,NULL,NULL),(11,'แบดมินตันกระชับมิตร (พบกันหมด)',NULL,NULL,3,'round_robin',3,'faculty',1,NULL,11,'not_required',NULL,NULL,NULL,NULL,'public',0,'2026-09-18 15:44:51','2026-10-02 15:44:51','2026-10-07','2026-10-12',4,2,'โรงยิม 5',72,'any',NULL,NULL,NULL,2,'2026-10-08 15:45:01',NULL,NULL,NULL,'2026-10-08 15:45:01','2026-10-08 15:45:05',11,NULL,NULL);
/*!40000 ALTER TABLE `tournaments` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `user_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_reports` (
  `user_report_id` int NOT NULL AUTO_INCREMENT,
  `reported_by` int NOT NULL,
  `target_user_id` int NOT NULL,
  `reason` text NOT NULL,
  `evidence` json DEFAULT NULL,
  `user_report_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `reviewed_by` int DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `rejection_reason` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `pending_key` varchar(32) GENERATED ALWAYS AS (if((`user_report_status` = _utf8mb4'pending'),concat_ws(_utf8mb4':',`reported_by`,`target_user_id`),NULL)) VIRTUAL,
  PRIMARY KEY (`user_report_id`),
  UNIQUE KEY `uq_user_report_pending` (`pending_key`),
  KEY `reported_by` (`reported_by`),
  KEY `target_user_id` (`target_user_id`),
  KEY `reviewed_by` (`reviewed_by`),
  CONSTRAINT `user_reports_ibfk_1` FOREIGN KEY (`reported_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `user_reports_ibfk_2` FOREIGN KEY (`target_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `user_reports_ibfk_3` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `user_reports` WRITE;
/*!40000 ALTER TABLE `user_reports` DISABLE KEYS */;
INSERT INTO `user_reports` (`user_report_id`, `reported_by`, `target_user_id`, `reason`, `evidence`, `user_report_status`, `reviewed_by`, `reviewed_at`, `rejection_reason`, `created_at`) VALUES (1,31,33,'ใช้ถ้อยคำไม่เหมาะสมในช่องความเห็นของทัวร์ Faculty League','[]','pending',NULL,NULL,NULL,'2026-10-08 15:45:25');
/*!40000 ALTER TABLE `user_reports` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `user_rewards`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_rewards` (
  `user_reward_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `reward_id` int NOT NULL,
  `earned_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_displayed` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`user_reward_id`),
  UNIQUE KEY `user_id` (`user_id`,`reward_id`),
  KEY `reward_id` (`reward_id`),
  CONSTRAINT `user_rewards_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `user_rewards_ibfk_2` FOREIGN KEY (`reward_id`) REFERENCES `rewards` (`reward_id`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `user_rewards` WRITE;
/*!40000 ALTER TABLE `user_rewards` DISABLE KEYS */;
INSERT INTO `user_rewards` VALUES (1,105,1,'2026-10-08 15:45:15',1),(2,106,1,'2026-10-08 15:45:15',1),(3,107,1,'2026-10-08 15:45:15',1),(4,108,1,'2026-10-08 15:45:15',1),(5,109,1,'2026-10-08 15:45:15',1),(6,110,1,'2026-10-08 15:45:15',1),(7,111,1,'2026-10-08 15:45:15',1),(8,112,1,'2026-10-08 15:45:15',1),(16,105,2,'2026-10-08 15:45:15',1),(17,106,2,'2026-10-08 15:45:15',1),(18,109,2,'2026-10-08 15:45:15',1),(19,110,2,'2026-10-08 15:45:15',1),(23,109,4,'2026-10-08 15:45:15',1),(24,110,4,'2026-10-08 15:45:15',1);
/*!40000 ALTER TABLE `user_rewards` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `full_name` varchar(150) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `gender` enum('male','female','other') NOT NULL,
  `birth_date` date NOT NULL,
  `user_type` enum('student','staff','external') NOT NULL,
  `faculty_id` int DEFAULT NULL,
  `department_id` int DEFAULT NULL,
  `year` int DEFAULT NULL,
  `profile_image_key` varchar(255) DEFAULT NULL,
  `contact_info` varchar(255) DEFAULT NULL,
  `address` text,
  `is_suspended` tinyint(1) NOT NULL DEFAULT '0',
  `suspended_reason` text,
  `suspended_category` enum('abusive_language','cheating','false_information','spam','other') DEFAULT NULL,
  `suspended_until` datetime DEFAULT NULL,
  `total_points` int NOT NULL DEFAULT '0',
  `notification_prefs` json DEFAULT NULL,
  `show_profile_stats` tinyint(1) NOT NULL DEFAULT '1',
  `email_verified` tinyint(1) NOT NULL DEFAULT '0',
  `token_version` int NOT NULL DEFAULT '0',
  `profile_edit_log` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`),
  KEY `faculty_id` (`faculty_id`),
  KEY `department_id` (`department_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`faculty_id`) REFERENCES `faculties` (`faculty_id`),
  CONSTRAINT `users_ibfk_2` FOREIGN KEY (`department_id`) REFERENCES `departments` (`department_id`)
) ENGINE=InnoDB AUTO_INCREMENT=167 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'ผู้ดูแลระบบสูงสุด','root@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','other','1985-02-11','staff',NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(2,'สมชาย ใจดี','admin@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','1980-03-12','staff',1,1,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(3,'วิภาวรรณ ศรีวิศวะ','admin.eng@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','1984-04-13','staff',1,2,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(4,'ธนากร วิทยาการ','admin.sci@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','1986-05-14','staff',2,6,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(11,'ปกรณ์ จัดการดี','org1@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2003-03-12','student',1,1,4,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(12,'ณัฐธิดา ประสานงาน','org2@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2003-04-13','student',2,7,4,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(13,'กิตติพงษ์ สโมสร','org3@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-05-14','student',4,16,3,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(21,'วีระชัย นกหวีดทอง','ref1@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','1990-04-13','staff',7,25,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(22,'อรทัย กฎกติกา','ref2@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','1992-05-14','staff',7,25,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(23,'สุรเชษฐ์ ยุติธรรม','ref3@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2002-06-15','student',7,25,4,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(24,'พิมพ์ชนก เที่ยงตรง','ref4@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2003-07-16','student',7,25,4,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(25,'สมเกียรติ ผู้ตัดสินอาชีพ','ref.ext1@gmail.com','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','1988-08-17','external',NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(26,'ดารุณี กรรมการรับเชิญ','ref.ext2@gmail.com','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','1991-09-18','external',NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(31,'ชนาธิป แฟนกีฬา','viewer1@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2005-05-14','student',5,18,2,NULL,NULL,NULL,0,NULL,NULL,NULL,30,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(32,'ปาณิสรา เชียร์สุดใจ','viewer2@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2006-06-15','student',6,23,1,NULL,NULL,NULL,0,NULL,NULL,NULL,4,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(33,'ธีรภัทร ชอบทายผล','viewer3@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-07-16','student',8,28,3,NULL,NULL,NULL,0,NULL,NULL,NULL,12,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(34,'อดิศร ถูกระงับ','banned@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-08-17','student',3,11,3,NULL,NULL,NULL,1,'ส่งข้อความรบกวนซ้ำในช่องความเห็นหลายรายการ','spam','2026-11-07 15:45:26',0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(35,'ศุภวิชญ์ มือใหม่','newbie@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2007-09-18','student',5,19,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(36,'กัญญารัตน์ ยังไม่มีทีม','free1@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2006-01-10','student',6,21,2,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(101,'ธนวัฒน์ เกษมสุข','b1.lead@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-03-12','student',1,2,2,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(102,'ภูมิพัฒน์ พงษ์ไพบูลย์','b1.p2@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2005-04-13','student',1,1,3,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(103,'กฤษณะ มณีรัตน์','b2.lead@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2006-05-14','student',2,7,4,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(104,'ณัฐวุฒิ ธารารักษ์','b2.p2@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2003-06-15','student',2,6,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(105,'พีรพล วงศ์สวัสดิ์','b3.lead@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-07-16','student',3,12,2,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(106,'ชยพล อินทรีย์','b3.p2@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2005-08-17','student',3,11,3,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(107,'ณัฐธิดา สุวรรณภูมิ','b4.lead@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2006-09-18','student',4,15,4,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(108,'พิมพ์ลภัส รุ่งเรือง','b4.p2@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2003-01-10','student',4,14,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(109,'กัญญาณัฐ ชัยมงคล','b5.lead@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2004-02-11','student',5,19,2,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(110,'ชนิกานต์ นาคประเสริฐ','b5.p2@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2005-03-12','student',5,18,3,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(111,'วรเมธ ศักดิ์ดี','b6.lead@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2006-04-13','student',8,29,4,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(112,'ศุภกร พรหมมา','b6.p2@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2003-05-14','student',8,28,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(113,'อนุชา กิตติวงศ์','k1.lead@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-06-15','student',1,2,2,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(114,'ธีรเดช แสงทอง','k1.p2@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2005-07-16','student',1,1,3,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(115,'ปิยะพงษ์ ศรีสุข','k1.p3@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2006-08-17','student',1,2,4,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(116,'จิรายุ บุญมา','k1.p4@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2003-09-18','student',1,1,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(117,'รัชชานนท์ จันทร์เพ็ญ','k1.p5@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-01-10','student',1,2,2,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(118,'สิรวิชญ์ ทองคำ','k1.p6@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2005-02-11','student',1,1,3,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(119,'ภาณุวัฒน์ ปัญญาดี','k2.lead@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2006-03-12','student',2,7,4,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(120,'นนทกร เกษมสุข','k2.p2@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2003-04-13','student',2,6,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(121,'เจษฎา พงษ์ไพบูลย์','k2.p3@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-05-14','student',2,7,2,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(122,'อภิวัฒน์ มณีรัตน์','k2.p4@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2005-06-15','student',2,6,3,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(123,'ก้องภพ ธารารักษ์','k2.p5@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2006-07-16','student',2,7,4,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(124,'ธัญชนก วงศ์สวัสดิ์','k3.lead@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2003-08-17','student',1,1,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(125,'สุพิชญา อินทรีย์','k3.p2@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2004-09-18','student',1,2,2,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(126,'อริสรา สุวรรณภูมิ','k3.p3@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2005-01-10','student',1,1,3,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(127,'วรรณิดา รุ่งเรือง','k3.p4@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2006-02-11','student',1,2,4,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(128,'ปาริฉัตร ชัยมงคล','k3.p5@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2003-03-12','student',1,1,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(129,'เบญญาภา นาคประเสริฐ','k3.p6@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2004-04-13','student',1,2,2,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(130,'ศิริลักษณ์ ศักดิ์ดี','k4.lead@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2005-05-14','student',4,14,3,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(131,'กมลชนก พรหมมา','k4.p2@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2006-06-15','student',4,15,4,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(132,'ณิชากร กิตติวงศ์','k4.p3@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2003-07-16','student',4,14,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(133,'พรรณวษา แสงทอง','k4.p4@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2004-08-17','student',4,15,2,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(134,'จิดาภา ศรีสุข','k4.p5@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2005-09-18','student',4,14,3,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(135,'ธนกฤต บุญมา','r1.lead@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2006-01-10','student',1,2,4,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(136,'วชิรวิทย์ จันทร์เพ็ญ','r1.p2@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2003-02-11','student',1,1,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(137,'ปุณณวิช ทองคำ','r1.p3@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-03-12','student',1,2,2,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(138,'ณภัทร ปัญญาดี','r1.p4@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2005-04-13','student',1,1,3,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(139,'กันตพงศ์ เกษมสุข','r1.p5@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2006-05-14','student',1,2,4,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(140,'ชัยวัฒน์ พงษ์ไพบูลย์','r2.lead@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2003-06-15','student',2,6,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(141,'สหรัฐ มณีรัตน์','r2.p2@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-07-16','student',2,7,2,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(142,'พงศกร ธารารักษ์','r2.p3@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2005-08-17','student',2,6,3,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(143,'ธนดล วงศ์สวัสดิ์','r2.p4@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2006-09-18','student',2,7,4,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(144,'อิทธิพล อินทรีย์','r2.p5@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2003-01-10','student',2,6,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(145,'ศิวกร สุวรรณภูมิ','f1.lead@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-02-11','student',1,2,2,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(146,'คณิน รุ่งเรือง','f1.p2@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2005-03-12','student',1,1,3,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(147,'ปรเมศวร์ ชัยมงคล','f1.p3@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2006-04-13','student',1,2,4,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(148,'ธนวัฒน์ นาคประเสริฐ','f1.p4@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2003-05-14','student',1,1,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(149,'ภูมิพัฒน์ ศักดิ์ดี','f1.p5@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-06-15','student',1,2,2,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(150,'กฤษณะ พรหมมา','f1.p6@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2005-07-16','student',1,1,3,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(151,'ณัฐวุฒิ กิตติวงศ์','f1.p7@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2006-08-17','student',1,2,4,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(152,'พีรพล แสงทอง','f1.p8@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2003-09-18','student',1,1,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(153,'ชยพล ศรีสุข','f1.p9@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-01-10','student',1,2,2,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(154,'วรเมธ บุญมา','f1.p10@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2005-02-11','student',1,1,3,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(155,'ศุภกร จันทร์เพ็ญ','f1.p11@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2006-03-12','student',1,2,4,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(156,'อนุชา ทองคำ','f2.lead@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2003-04-13','student',2,6,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(157,'ธีรเดช ปัญญาดี','f2.p2@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-05-14','student',2,7,2,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(158,'ปิยะพงษ์ เกษมสุข','f2.p3@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2005-06-15','student',2,6,3,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(159,'จิรายุ พงษ์ไพบูลย์','f2.p4@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2006-07-16','student',2,7,4,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(160,'รัชชานนท์ มณีรัตน์','f2.p5@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2003-08-17','student',2,6,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(161,'สิรวิชญ์ ธารารักษ์','f2.p6@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-09-18','student',2,7,2,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(162,'ภาณุวัฒน์ วงศ์สวัสดิ์','f2.p7@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2005-01-10','student',2,6,3,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(163,'นนทกร อินทรีย์','f2.p8@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2006-02-11','student',2,7,4,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(164,'เจษฎา สุวรรณภูมิ','f2.p9@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2003-03-12','student',2,6,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(165,'อภิวัฒน์ รุ่งเรือง','f2.p10@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-04-13','student',2,7,2,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL),(166,'ก้องภพ ชัยมงคล','f2.p11@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2005-05-14','student',2,6,3,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,1,1,0,NULL,'2026-08-29 15:44:56',NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

