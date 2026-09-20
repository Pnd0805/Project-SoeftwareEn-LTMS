
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
  `scope_type` enum('faculty','university_wide') NOT NULL,
  `faculty_id` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` int DEFAULT NULL,
  PRIMARY KEY (`admin_scope_id`),
  KEY `user_id` (`user_id`),
  KEY `faculty_id` (`faculty_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `admin_scopes_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `admin_scopes_ibfk_2` FOREIGN KEY (`faculty_id`) REFERENCES `faculties` (`faculty_id`),
  CONSTRAINT `admin_scopes_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `admin_scopes` WRITE;
/*!40000 ALTER TABLE `admin_scopes` DISABLE KEYS */;
INSERT INTO `admin_scopes` VALUES (1,9001,'university_wide',NULL,'2026-09-17 13:20:02',9001);
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
INSERT INTO `announcements` VALUES (1,2,NULL,9001,'general','QA notice','hello team','2026-09-17 14:02:07',NULL,NULL,NULL,NULL),(2,14,NULL,9001,'general','นัดประชุมผู้จัดการทีม','เชิญหัวหน้าทีมทุกทีมประชุมวันที่ 25 ก.ย. เวลา 15:00 ที่ห้องประชุมคณะ','2026-09-18 04:35:22',NULL,NULL,NULL,NULL),(3,13,NULL,9001,'general','aa','aa','2026-09-18 15:03:59',NULL,NULL,NULL,NULL);
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `application_players` WRITE;
/*!40000 ALTER TABLE `application_players` DISABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (1,9001,'tournament_approved','tournament',2,NULL,'2026-09-17 14:00:40'),(2,9001,'tournament_approved','tournament',4,NULL,'2026-09-17 14:04:43'),(3,9001,'tournament_approved','tournament',6,NULL,'2026-09-17 14:11:31'),(4,9001,'tournament_approved','tournament',10,NULL,'2026-09-17 15:30:52'),(5,9001,'tournament_approved','tournament',12,NULL,'2026-09-17 15:36:47'),(6,9101,'match_result_verified','match',2,'{\"winnerId\": 9008, \"verifiedBy\": 9101}','2026-09-17 15:39:17'),(7,9001,'tournament_approved','tournament',13,NULL,'2026-09-17 15:42:28'),(8,9101,'match_result_verified','match',3,'{\"winnerId\": 9008, \"verifiedBy\": 9101}','2026-09-17 15:44:44'),(9,9105,'match_result_verified','match',4,'{\"winnerId\": 9010, \"verifiedBy\": 9105}','2026-09-17 15:44:44'),(10,9101,'match_result_verified','match',5,'{\"winnerId\": 9008, \"verifiedBy\": 9101}','2026-09-18 02:24:07'),(11,9001,'tournament_approved','tournament',14,NULL,'2026-09-18 03:25:44'),(12,9001,'tournament_approved','tournament',16,NULL,'2026-09-18 04:06:31'),(13,9001,'tournament_approved','tournament',17,NULL,'2026-09-18 04:06:32'),(14,9001,'tournament_approved','tournament',18,NULL,'2026-09-18 04:06:32'),(15,9001,'tournament_approved','tournament',19,NULL,'2026-09-18 04:39:20'),(16,9105,'match_result_verified','match',6,'{\"winnerId\": 9010, \"verifiedBy\": 9105}','2026-09-18 04:39:21'),(17,9001,'tournament_approved','tournament',20,NULL,'2026-09-18 04:39:21'),(18,9225,'match_result_verified','match',9,'{\"winnerId\": 9027, \"verifiedBy\": 9225}','2026-09-18 07:48:48'),(19,9001,'tournament_approved','tournament',1,NULL,'2026-09-18 07:54:25'),(20,9001,'tournament_approved','tournament',3,NULL,'2026-09-18 07:54:27'),(21,9001,'tournament_approved','tournament',5,NULL,'2026-09-18 07:54:27'),(22,9001,'tournament_approved','tournament',7,NULL,'2026-09-18 07:54:28'),(23,9001,'tournament_approved','tournament',8,NULL,'2026-09-18 07:54:28'),(24,9001,'tournament_approved','tournament',9,NULL,'2026-09-18 07:54:29'),(25,9001,'tournament_approved','tournament',11,NULL,'2026-09-18 07:54:29'),(26,9001,'tournament_approved','tournament',15,NULL,'2026-09-18 07:54:30'),(27,9001,'tournament_approved','tournament',21,NULL,'2026-09-18 14:25:16'),(28,9001,'tournament_approved','tournament',22,NULL,'2026-09-18 14:25:16'),(29,9001,'tournament_approved','tournament',23,NULL,'2026-09-18 14:26:59'),(30,9001,'tournament_approved','tournament',26,NULL,'2026-09-20 16:53:55');
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
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `bracket_nodes` WRITE;
/*!40000 ALTER TABLE `bracket_nodes` DISABLE KEYS */;
INSERT INTO `bracket_nodes` VALUES (1,10,'W-R1-M1','winners',1,1,9009,9008,1,'2026-09-17 15:30:55',NULL),(2,12,'W-R1-M1','winners',1,1,9009,9008,2,'2026-09-17 15:37:08',NULL),(3,13,'W-R1-M1','winners',1,1,9011,9008,3,'2026-09-17 15:42:33',NULL),(4,13,'W-R1-M2','winners',1,2,9010,9009,4,'2026-09-17 15:42:33',NULL),(5,13,'W-R2-M1','winners',2,1,9008,9010,5,'2026-09-17 15:42:33',NULL),(6,19,'W-R1-M1','winners',1,1,9010,9009,6,'2026-09-18 04:39:20',NULL),(7,19,'W-R1-M2','winners',1,2,9008,9011,7,'2026-09-18 04:39:20',NULL),(8,19,'W-R2-M1','winners',2,1,9010,NULL,8,'2026-09-18 04:39:20',NULL),(9,20,'W-R1-M1','winners',1,1,9027,9028,9,'2026-09-18 04:39:21',NULL),(10,17,'W-R1-M1','winners',1,1,9026,9025,10,'2026-09-18 07:50:31',NULL),(11,18,'W-R1-M1','winners',1,1,9032,9031,11,'2026-09-18 08:22:46',NULL),(12,21,'W-R1-M1','winners',1,1,9009,9008,12,'2026-09-18 14:25:16',NULL),(13,23,'W-R1-M1','winners',1,1,9024,9023,13,'2026-09-18 14:26:59',NULL),(14,22,'W-R1-M1','winners',1,1,9023,9024,14,'2026-09-18 15:57:36',NULL);
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
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `match_checkins` WRITE;
/*!40000 ALTER TABLE `match_checkins` DISABLE KEYS */;
INSERT INTO `match_checkins` VALUES (1,2,9101,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-17 15:38:32',NULL),(2,2,9102,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-17 15:38:32',NULL),(3,2,9103,'photo_online','success',NULL,NULL,'student_id','checkins/fake-b1.jpg',9002,'2026-09-17 15:38:33','2026-09-17 15:38:51'),(4,2,9104,'photo_online','rejected','�ٻ�ѵ����Ѵ',NULL,'national_id','checkins/fake-b2.jpg',9002,'2026-09-17 15:38:33','2026-09-17 15:38:52'),(5,3,9107,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-17 15:44:43',NULL),(6,3,9101,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-17 15:44:43',NULL),(7,4,9105,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-17 15:44:44',NULL),(8,4,9103,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-17 15:44:44',NULL),(9,5,9101,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 02:24:07',NULL),(10,5,9105,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 02:24:07',NULL),(11,6,9105,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 04:39:20',NULL),(12,6,9103,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 04:39:20',NULL),(13,9,9225,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 04:39:21',NULL),(14,9,9213,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 04:39:21',NULL),(15,7,9101,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 07:48:48',NULL),(16,7,9107,'photo_online','pending',NULL,NULL,'student_id','checkins/qa-student-id.jpg',NULL,'2026-09-18 07:48:49',NULL),(17,7,9108,'photo_online','pending',NULL,NULL,'national_id','checkins/qa-national-id.jpg',NULL,'2026-09-18 07:48:49',NULL),(18,10,9207,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 07:50:31',NULL),(19,10,9219,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 07:50:31',NULL),(20,12,9103,'photo_online','pending',NULL,NULL,'student_id','checkins/qa-pakorn-review.jpg',NULL,'2026-09-18 14:25:16',NULL);
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
INSERT INTO `match_referees` VALUES (1,2,11,'accepted','2026-09-17 15:37:23','2026-09-17 15:37:23'),(2,2,12,'accepted','2026-09-17 15:37:57','2026-09-17 15:37:57'),(3,3,13,'accepted','2026-09-17 15:44:43','2026-09-17 15:44:43'),(4,3,14,'accepted','2026-09-17 15:44:43','2026-09-17 15:44:43'),(5,4,13,'accepted','2026-09-17 15:44:44','2026-09-17 15:44:44'),(6,4,14,'accepted','2026-09-17 15:44:44','2026-09-17 15:44:44'),(7,5,13,'accepted','2026-09-18 02:24:07','2026-09-18 02:24:07'),(8,5,14,'accepted','2026-09-18 02:24:07','2026-09-18 02:24:07'),(9,6,23,'accepted','2026-09-18 04:39:20','2026-09-18 04:39:20'),(10,6,24,'accepted','2026-09-18 04:39:20','2026-09-18 04:39:20'),(11,7,23,'accepted','2026-09-18 04:39:21','2026-09-18 04:39:21'),(12,7,24,'accepted','2026-09-18 04:39:21','2026-09-18 04:39:21'),(13,9,25,'accepted','2026-09-18 04:39:21','2026-09-18 04:39:21'),(14,9,26,'accepted','2026-09-18 04:39:21','2026-09-18 04:39:21'),(15,10,19,'accepted','2026-09-18 07:50:31','2026-09-18 07:50:31'),(16,10,20,'accepted','2026-09-18 07:50:31','2026-09-18 07:50:31'),(17,8,24,'accepted','2026-09-18 08:19:48','2026-09-18 08:19:48'),(18,11,21,'accepted','2026-09-18 08:22:46','2026-09-18 08:22:46'),(19,11,22,'accepted','2026-09-18 08:22:46','2026-09-18 08:22:46'),(20,12,29,'accepted','2026-09-18 14:25:16','2026-09-18 14:25:16'),(21,12,30,'accepted','2026-09-18 14:25:16','2026-09-18 14:25:16'),(22,8,33,'accepted','2026-09-18 14:40:32','2026-09-18 14:40:32');
/*!40000 ALTER TABLE `match_referees` ENABLE KEYS */;
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
  `match_result_status` enum('submitted','verified','disputed','rejected','walkover') NOT NULL DEFAULT 'submitted',
  `dispute_reason` text,
  `dispute_raised_by` int DEFAULT NULL,
  `dispute_raised_at` datetime DEFAULT NULL,
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
  CONSTRAINT `match_results_ibfk_1` FOREIGN KEY (`match_id`) REFERENCES `matches` (`match_id`),
  CONSTRAINT `match_results_ibfk_2` FOREIGN KEY (`winner_team_id`) REFERENCES `teams` (`team_id`),
  CONSTRAINT `match_results_ibfk_3` FOREIGN KEY (`submitted_by_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `match_results_ibfk_4` FOREIGN KEY (`dispute_raised_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `match_results_ibfk_5` FOREIGN KEY (`dispute_resolved_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `match_results_ibfk_6` FOREIGN KEY (`verified_by_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `match_results_ibfk_7` FOREIGN KEY (`amended_by_user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `match_results` WRITE;
/*!40000 ALTER TABLE `match_results` DISABLE KEYS */;
INSERT INTO `match_results` VALUES (1,2,9008,'{\"9008\": 2, \"9009\": 1}',9002,'referee','verified','������ùѺ����Դ������ 3',9103,'2026-09-17 15:40:11',9001,'���','2026-09-17 15:40:13',9101,'2026-09-17 15:39:17',NULL,NULL,NULL,'2026-09-17 15:39:14'),(6,3,9008,'{\"9008\": 2, \"9011\": 0}',9002,'referee','verified',NULL,NULL,NULL,NULL,NULL,NULL,9101,'2026-09-17 15:44:44',NULL,NULL,NULL,'2026-09-17 15:44:44'),(7,4,9010,'{\"9009\": 1, \"9010\": 2}',9002,'referee','verified',NULL,NULL,NULL,NULL,NULL,NULL,9105,'2026-09-17 15:44:44',NULL,NULL,NULL,'2026-09-17 15:44:44'),(8,5,9008,'{\"9008\": 2, \"9010\": 0}',9002,'referee','verified',NULL,NULL,NULL,NULL,NULL,NULL,9101,'2026-09-18 02:24:07',NULL,NULL,NULL,'2026-09-18 02:24:07'),(9,6,9010,'{\"9009\": 0, \"9010\": 2}',9002,'referee','verified',NULL,NULL,NULL,NULL,NULL,NULL,9105,'2026-09-18 04:39:20',NULL,NULL,NULL,'2026-09-18 04:39:20'),(10,9,9027,'{\"9027\": 3, \"9028\": 2}',9002,'referee','disputed','เซ็ตที่ 5 กรรมการนับแต้มผิด ขอให้ตรวจสอบคลิปอีกครั้ง',9213,'2026-09-18 07:48:48',NULL,NULL,NULL,9225,'2026-09-18 07:48:48',NULL,NULL,NULL,'2026-09-18 07:48:48'),(11,12,9008,'{\"a\": 1, \"b\": 1}',9201,'referee','submitted',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-18 16:37:13');
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
  `team_a_id` int DEFAULT NULL,
  `team_b_id` int DEFAULT NULL,
  `scheduled_time` datetime DEFAULT NULL,
  `scheduled_end_time` datetime DEFAULT NULL,
  `venue` varchar(255) DEFAULT NULL,
  `checkin_open_at` datetime DEFAULT NULL,
  `match_status` enum('scheduled','checkin_open','in_progress','completed','disputed','result_rejected') NOT NULL DEFAULT 'scheduled',
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
  CONSTRAINT `matches_ibfk_6` FOREIGN KEY (`loser_next_match_id`) REFERENCES `matches` (`match_id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `matches` WRITE;
/*!40000 ALTER TABLE `matches` DISABLE KEYS */;
INSERT INTO `matches` VALUES (1,10,NULL,NULL,NULL,1,9009,9008,NULL,NULL,NULL,'2026-09-17 15:30:56','checkin_open','onsite',NULL,NULL,'2026-09-17 15:30:55','2026-09-17 15:30:56'),(2,12,NULL,NULL,NULL,1,9009,9008,'2026-10-10 02:00:00','2026-10-10 04:00:00','QA Court 2','2026-09-17 15:38:31','completed','onsite',NULL,NULL,'2026-09-17 15:37:08','2026-09-17 15:40:13'),(3,13,NULL,5,NULL,1,9011,9008,'2026-10-12 02:00:00','2026-10-12 04:00:00','QA Court 3','2026-09-17 15:44:43','completed','onsite',NULL,NULL,'2026-09-17 15:42:33','2026-09-17 15:44:44'),(4,13,NULL,5,NULL,1,9010,9009,'2026-10-12 05:00:00','2026-10-12 07:00:00','QA Court 3','2026-09-17 15:44:44','completed','onsite',NULL,NULL,'2026-09-17 15:42:33','2026-09-17 15:44:44'),(5,13,NULL,NULL,NULL,2,9008,9010,'2026-10-13 02:00:00','2026-10-13 04:00:00','QA Court 3','2026-09-18 02:24:07','completed','onsite',NULL,NULL,'2026-09-17 15:42:33','2026-09-18 02:24:07'),(6,19,NULL,8,NULL,1,9010,9009,'2026-10-25 02:00:00','2026-10-25 04:00:00','โรงยิม 1 คอร์ต A','2026-09-18 04:39:20','completed','onsite',NULL,NULL,'2026-09-18 04:39:20','2026-09-18 04:39:20'),(7,19,NULL,8,NULL,1,9008,9011,'2026-10-25 05:00:00','2026-10-25 07:00:00','โรงยิม 1 คอร์ต B','2026-09-18 04:39:21','checkin_open','onsite',NULL,NULL,'2026-09-18 04:39:20','2026-09-18 04:39:21'),(8,19,NULL,NULL,NULL,2,9010,NULL,'2026-10-26 02:00:00','2026-10-26 04:00:00','โรงยิม 1 คอร์ตกลาง',NULL,'scheduled','onsite',NULL,NULL,'2026-09-18 04:39:20','2026-09-18 07:50:30'),(9,20,NULL,NULL,NULL,1,9027,9028,'2026-10-25 08:00:00','2026-10-25 10:00:00','โรงยิม 2','2026-09-18 04:39:21','disputed','onsite',NULL,NULL,'2026-09-18 04:39:21','2026-09-18 07:48:48'),(10,17,NULL,NULL,NULL,1,9026,9025,'2026-09-18 08:00:06','2026-09-18 10:00:06','โรงยิม 3','2026-09-18 07:50:31','in_progress','onsite',NULL,NULL,'2026-09-18 07:50:31','2026-09-18 07:50:31'),(11,18,NULL,NULL,NULL,1,9032,9031,'2026-11-02 03:00:00','2026-11-02 05:00:00','ออนไลน์','2026-09-18 08:22:46','checkin_open','online',NULL,NULL,'2026-09-18 08:22:46','2026-09-18 08:22:46'),(12,21,NULL,NULL,NULL,1,9009,9008,'2026-11-10 03:00:00','2026-11-10 05:00:00','โรงยิม 4 คอร์ต 1','2026-09-18 14:25:16','checkin_open','onsite',NULL,NULL,'2026-09-18 14:25:16','2026-09-18 14:25:16'),(13,23,NULL,NULL,NULL,1,9024,9023,'2026-11-20 03:00:00','2026-11-20 05:00:00','คอร์ต 1',NULL,'scheduled','onsite',NULL,NULL,'2026-09-18 14:26:59','2026-09-18 14:26:59'),(14,22,NULL,NULL,NULL,1,9023,9024,NULL,NULL,NULL,NULL,'scheduled','onsite',NULL,NULL,'2026-09-18 15:57:36',NULL);
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
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
  `points_earned` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`pickem_prediction_id`),
  UNIQUE KEY `user_id` (`user_id`,`match_id`),
  KEY `match_id` (`match_id`),
  KEY `predicted_winner_team_id` (`predicted_winner_team_id`),
  CONSTRAINT `pickem_predictions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `pickem_predictions_ibfk_2` FOREIGN KEY (`match_id`) REFERENCES `matches` (`match_id`),
  CONSTRAINT `pickem_predictions_ibfk_3` FOREIGN KEY (`predicted_winner_team_id`) REFERENCES `teams` (`team_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `pickem_predictions` WRITE;
/*!40000 ALTER TABLE `pickem_predictions` DISABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `player_match_stat_values` WRITE;
/*!40000 ALTER TABLE `player_match_stat_values` DISABLE KEYS */;
INSERT INTO `player_match_stat_values` VALUES (1,1,9,21),(2,2,9,18),(3,3,9,15),(4,4,9,12),(5,5,9,21),(6,6,9,18);
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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `player_match_stats` WRITE;
/*!40000 ALTER TABLE `player_match_stats` DISABLE KEYS */;
INSERT INTO `player_match_stats` VALUES (1,2,9101,9008,9002,'2026-09-17 15:40:14'),(2,2,9102,9008,9002,'2026-09-17 15:40:14'),(3,2,9103,9009,9002,'2026-09-17 15:40:14'),(4,2,9104,9009,9002,'2026-09-17 15:40:14'),(5,6,9103,9009,9002,'2026-09-18 07:50:31'),(6,6,9105,9010,9002,'2026-09-18 07:50:31');
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
) ENGINE=InnoDB AUTO_INCREMENT=9036 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `player_profile_stats` WRITE;
/*!40000 ALTER TABLE `player_profile_stats` DISABLE KEYS */;
INSERT INTO `player_profile_stats` VALUES (9001,9001,1,10,7,3,1,'2026-09-17 13:01:26'),(9002,9001,2,4,1,3,0,'2026-09-17 13:01:26'),(9003,9002,1,0,0,0,0,'2026-09-17 13:01:26'),(9004,9101,3,3,3,0,0,'2026-09-18 02:24:07'),(9005,9102,3,3,3,0,0,'2026-09-18 02:24:07'),(9007,9103,3,3,0,3,0,'2026-09-18 04:39:21'),(9008,9104,3,3,0,3,0,'2026-09-18 04:39:21'),(9011,9107,3,1,0,1,0,'2026-09-17 15:44:44'),(9012,9108,3,1,0,1,0,'2026-09-17 15:44:44'),(9014,9105,3,3,2,1,0,'2026-09-18 04:39:20'),(9015,9106,3,3,2,1,0,'2026-09-18 04:39:20'),(9022,9225,1,1,1,0,0,'2026-09-18 07:48:48'),(9023,9226,1,1,1,0,0,'2026-09-18 07:48:48'),(9024,9227,1,1,1,0,0,'2026-09-18 07:48:48'),(9025,9228,1,1,1,0,0,'2026-09-18 07:48:48'),(9026,9229,1,1,1,0,0,'2026-09-18 07:48:48'),(9027,9230,1,1,1,0,0,'2026-09-18 07:48:48'),(9028,9231,1,1,1,0,0,'2026-09-18 07:48:48'),(9029,9213,1,1,0,1,0,'2026-09-18 07:48:48'),(9030,9214,1,1,0,1,0,'2026-09-18 07:48:48'),(9031,9215,1,1,0,1,0,'2026-09-18 07:48:48'),(9032,9216,1,1,0,1,0,'2026-09-18 07:48:48'),(9033,9217,1,1,0,1,0,'2026-09-18 07:48:48'),(9034,9218,1,1,0,1,0,'2026-09-18 07:48:48'),(9035,9219,1,1,0,1,0,'2026-09-18 07:48:48');
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
  `request_type` enum('org_add_match','ref_transfer','ref_swap','org_swap') NOT NULL,
  `requested_by` int NOT NULL,
  `referee_a_id` int NOT NULL,
  `referee_b_id` int DEFAULT NULL,
  `match_a_id` int NOT NULL,
  `match_b_id` int DEFAULT NULL,
  `a_status` enum('not_required','pending','accepted','declined') NOT NULL,
  `b_status` enum('not_required','pending','accepted','declined') NOT NULL,
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
  CONSTRAINT `referee_change_requests_ibfk_6` FOREIGN KEY (`match_b_id`) REFERENCES `matches` (`match_id`)
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `referee_change_requests` WRITE;
/*!40000 ALTER TABLE `referee_change_requests` DISABLE KEYS */;
INSERT INTO `referee_change_requests` VALUES (1,12,'org_add_match',9001,11,NULL,2,NULL,'accepted','not_required','applied','2026-09-17 15:37:22','2026-09-17 15:37:23'),(2,12,'org_add_match',9001,12,NULL,2,NULL,'pending','not_required','cancelled','2026-09-17 15:37:22','2026-09-17 15:37:23'),(3,12,'org_add_match',9001,12,NULL,2,NULL,'accepted','not_required','applied','2026-09-17 15:37:56','2026-09-17 15:37:57'),(4,13,'org_add_match',9001,14,NULL,3,NULL,'pending','not_required','cancelled','2026-09-17 15:43:00','2026-09-17 15:44:43'),(5,13,'org_add_match',9001,13,NULL,3,NULL,'accepted','not_required','applied','2026-09-17 15:43:01','2026-09-17 15:44:43'),(6,13,'org_add_match',9001,14,NULL,4,NULL,'pending','not_required','cancelled','2026-09-17 15:43:03','2026-09-17 15:44:44'),(7,13,'org_add_match',9001,13,NULL,4,NULL,'accepted','not_required','applied','2026-09-17 15:43:04','2026-09-17 15:44:44'),(8,13,'org_add_match',9001,14,NULL,3,NULL,'accepted','not_required','applied','2026-09-17 15:44:43','2026-09-17 15:44:43'),(9,13,'org_add_match',9001,14,NULL,4,NULL,'accepted','not_required','applied','2026-09-17 15:44:44','2026-09-17 15:44:44'),(10,13,'org_add_match',9001,13,NULL,5,NULL,'accepted','not_required','applied','2026-09-18 02:24:07','2026-09-18 02:24:07'),(11,13,'org_add_match',9001,14,NULL,5,NULL,'accepted','not_required','applied','2026-09-18 02:24:07','2026-09-18 02:24:07'),(12,19,'org_add_match',9001,23,NULL,6,NULL,'accepted','not_required','applied','2026-09-18 04:39:20','2026-09-18 04:39:20'),(13,19,'org_add_match',9001,24,NULL,6,NULL,'accepted','not_required','applied','2026-09-18 04:39:20','2026-09-18 04:39:20'),(14,19,'org_add_match',9001,23,NULL,7,NULL,'accepted','not_required','applied','2026-09-18 04:39:21','2026-09-18 04:39:21'),(15,19,'org_add_match',9001,24,NULL,7,NULL,'accepted','not_required','applied','2026-09-18 04:39:21','2026-09-18 04:39:21'),(16,20,'org_add_match',9001,25,NULL,9,NULL,'accepted','not_required','applied','2026-09-18 04:39:21','2026-09-18 04:39:21'),(17,20,'org_add_match',9001,26,NULL,9,NULL,'accepted','not_required','applied','2026-09-18 04:39:21','2026-09-18 04:39:21'),(18,19,'org_add_match',9001,24,NULL,8,NULL,'accepted','not_required','applied','2026-09-18 07:49:21','2026-09-18 08:19:48'),(19,17,'org_add_match',9001,19,NULL,10,NULL,'accepted','not_required','applied','2026-09-18 07:50:31','2026-09-18 07:50:31'),(20,17,'org_add_match',9001,20,NULL,10,NULL,'accepted','not_required','applied','2026-09-18 07:50:31','2026-09-18 07:50:31'),(21,18,'org_add_match',9001,21,NULL,11,NULL,'accepted','not_required','applied','2026-09-18 08:22:46','2026-09-18 08:22:46'),(22,18,'org_add_match',9001,22,NULL,11,NULL,'accepted','not_required','applied','2026-09-18 08:22:46','2026-09-18 08:22:46'),(23,19,'org_add_match',9001,28,NULL,8,NULL,'pending','not_required','cancelled','2026-09-18 14:06:13','2026-09-18 14:40:32'),(24,21,'org_add_match',9001,29,NULL,12,NULL,'accepted','not_required','applied','2026-09-18 14:25:16','2026-09-18 14:25:16'),(25,21,'org_add_match',9001,30,NULL,12,NULL,'accepted','not_required','applied','2026-09-18 14:25:16','2026-09-18 14:25:16'),(26,19,'org_add_match',9001,33,NULL,8,NULL,'accepted','not_required','applied','2026-09-18 14:25:17','2026-09-18 14:40:32');
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `rewards` WRITE;
/*!40000 ALTER TABLE `rewards` DISABLE KEYS */;
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
INSERT INTO `schema_migrations` VALUES ('001_matches_scheduled_end_time.sql','2026-09-17 13:00:43'),('002_match_referees_assignment_status.sql','2026-09-17 13:00:43'),('003_referee_change_requests.sql','2026-09-17 13:00:43'),('004_tournament_referees_external_docs.sql','2026-09-17 13:00:43'),('005_external_approval_needs_docs.sql','2026-09-17 13:00:43'),('006_add_tournament_description.sql','2026-09-17 13:00:43'),('007_match_results_livestream.sql','2026-09-17 13:00:43'),('008_match_checkins_unique_match_user.sql','2026-09-17 13:00:43'),('009_match_checkins_pending_status.sql','2026-09-17 13:00:43'),('010_sport_types_renumber.sql','2026-09-19 05:54:47'),('011_walkover.sql','2026-09-19 05:54:47'),('012_forfeit_organizer_role.sql','2026-09-19 05:54:47'),('013_team_invitations_expires_at.sql','2026-09-19 05:55:41'),('014_bracket_nodes_backfill_teams.sql','2026-09-20 16:30:15'),('015_match_checkins_note.sql','2026-09-20 16:30:16'),('016_matches_room_code.sql','2026-09-20 16:42:21'),('017_team_visibility_join_requests.sql','2026-09-20 16:42:21'),('018_application_players.sql','2026-09-20 16:42:21'),('019_drop_team_member_position.sql','2026-09-20 16:42:21'),('020_amendment_reason_stat_integer_only.sql','2026-09-20 17:10:33');
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
  `walkover_score` json DEFAULT NULL,
  PRIMARY KEY (`sport_type_id`)
) ENGINE=InnoDB AUTO_INCREMENT=110 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `sport_types` WRITE;
/*!40000 ALTER TABLE `sport_types` DISABLE KEYS */;
INSERT INTO `sport_types` VALUES (1,'ฟุตบอล',11,18,'onsite','{\"loser\": 0, \"winner\": 3}'),(2,'บาสเกตบอล',5,12,'onsite','{\"loser\": 0, \"winner\": 20}'),(3,'แบดมินตัน',2,4,'onsite','{\"loser\": 0, \"winner\": 2}'),(4,'E-Sport: RoV',5,7,'online','{\"loser\": 0, \"winner\": 2}'),(5,'E-Sport: VALORANT',5,7,'online','{\"loser\": 0, \"winner\": 2}');
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
  PRIMARY KEY (`team_admin_request_id`),
  KEY `team_id` (`team_id`),
  KEY `requested_by` (`requested_by`),
  KEY `target_user_id` (`target_user_id`),
  KEY `reviewed_by` (`reviewed_by`),
  CONSTRAINT `team_admin_requests_ibfk_1` FOREIGN KEY (`team_id`) REFERENCES `teams` (`team_id`),
  CONSTRAINT `team_admin_requests_ibfk_2` FOREIGN KEY (`requested_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `team_admin_requests_ibfk_3` FOREIGN KEY (`target_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `team_admin_requests_ibfk_4` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `team_admin_requests` WRITE;
/*!40000 ALTER TABLE `team_admin_requests` DISABLE KEYS */;
INSERT INTO `team_admin_requests` VALUES (1,9004,'official_status',9002,NULL,'approved','2026-09-17 14:00:42','[\"docs/proof.pdf\"]',9001,'2026-09-18 07:54:35',NULL),(2,9020,'official_status',9201,NULL,'approved','2026-09-18 03:08:30','[\"official/9020-approval.jpg\"]',9001,'2026-09-18 03:08:30',NULL),(3,9021,'official_status',9213,NULL,'approved','2026-09-18 03:08:30','[\"official/9021-club-letter.jpg\"]',9001,'2026-09-18 07:54:36',NULL),(4,9004,'official_status',9002,NULL,'approved','2026-09-18 03:15:31','[\"aa\"]',9001,'2026-09-18 07:54:36',NULL),(5,9004,'official_status',9002,NULL,'approved','2026-09-18 03:39:02','[\"koko\"]',9001,'2026-09-18 07:54:37',NULL),(6,9021,'official_status',9213,NULL,'pending','2026-09-18 15:11:46','[\"official/9021-club-letter.jpg\"]',NULL,NULL,NULL),(7,9027,'official_status',9225,NULL,'pending','2026-09-18 15:11:46','[\"official/9027-club-letter.jpg\"]',NULL,NULL,NULL);
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
  PRIMARY KEY (`team_invitation_id`),
  KEY `team_id` (`team_id`),
  KEY `invited_user_id` (`invited_user_id`),
  KEY `invited_by_user_id` (`invited_by_user_id`),
  CONSTRAINT `team_invitations_ibfk_1` FOREIGN KEY (`team_id`) REFERENCES `teams` (`team_id`),
  CONSTRAINT `team_invitations_ibfk_2` FOREIGN KEY (`invited_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `team_invitations_ibfk_3` FOREIGN KEY (`invited_by_user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `team_invitations` WRITE;
/*!40000 ALTER TABLE `team_invitations` DISABLE KEYS */;
INSERT INTO `team_invitations` VALUES (1,9004,9003,9002,'accepted','2026-09-17 15:25:07','2026-09-24 15:25:07','2026-09-18 08:19:36'),(2,9004,9001,9002,'accepted','2026-09-17 15:27:20','2026-09-24 15:27:21','2026-09-18 03:38:32'),(3,9008,9102,9101,'accepted','2026-09-17 15:30:49','2026-09-24 15:30:49','2026-09-17 15:30:49'),(4,9009,9104,9103,'accepted','2026-09-17 15:30:50','2026-09-24 15:30:50','2026-09-17 15:30:50'),(5,9010,9106,9105,'accepted','2026-09-17 15:42:26','2026-09-24 15:42:27','2026-09-17 15:42:26'),(6,9011,9108,9107,'accepted','2026-09-17 15:42:27','2026-09-24 15:42:27','2026-09-17 15:42:27'),(7,9020,9003,9201,'accepted','2026-09-18 03:08:30','2026-09-25 03:08:30','2026-09-18 08:19:37'),(8,9021,9003,9213,'accepted','2026-09-18 03:08:30','2026-09-21 03:08:30','2026-09-18 08:19:38'),(9,9027,9238,9225,'pending','2026-09-18 03:08:30','2026-09-25 03:08:30',NULL),(10,9025,9239,9207,'pending','2026-09-18 03:08:30','2026-09-19 03:08:30',NULL),(11,9022,9239,9233,'expired','2026-09-18 03:08:30','2026-09-17 03:08:30',NULL),(12,9030,9003,9215,'pending','2026-09-18 14:06:13','2026-09-25 14:06:14',NULL),(13,9030,9201,9215,'accepted','2026-09-18 14:25:17','2026-09-25 14:25:17','2026-09-18 14:40:31');
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
) ENGINE=InnoDB AUTO_INCREMENT=9135 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `team_members` WRITE;
/*!40000 ALTER TABLE `team_members` DISABLE KEYS */;
INSERT INTO `team_members` VALUES (9001,9001,9001,'2026-09-17 13:01:26'),(9002,9002,9001,'2026-09-17 13:01:26'),(9003,9003,9001,'2026-09-17 13:01:26'),(9004,9004,9002,'2026-09-17 13:01:26'),(9006,9005,9002,'2026-09-17 14:00:41'),(9007,9006,9002,'2026-09-17 14:03:09'),(9008,9007,9003,'2026-09-17 14:04:01'),(9009,9008,9101,'2026-09-17 15:30:48'),(9010,9008,9102,'2026-09-17 15:30:49'),(9011,9009,9103,'2026-09-17 15:30:50'),(9012,9009,9104,'2026-09-17 15:30:50'),(9013,9010,9105,'2026-09-17 15:42:26'),(9014,9010,9106,'2026-09-17 15:42:26'),(9015,9011,9107,'2026-09-17 15:42:27'),(9016,9011,9108,'2026-09-17 15:42:27'),(9017,9020,9201,'2026-09-18 03:08:30'),(9018,9020,9202,'2026-09-18 03:08:30'),(9019,9020,9203,'2026-09-18 03:08:30'),(9020,9020,9204,'2026-09-18 03:08:30'),(9021,9020,9205,'2026-09-18 03:08:30'),(9022,9020,9206,'2026-09-18 03:08:30'),(9023,9020,9207,'2026-09-18 03:08:30'),(9024,9020,9208,'2026-09-18 03:08:30'),(9025,9020,9209,'2026-09-18 03:08:30'),(9026,9020,9210,'2026-09-18 03:08:30'),(9027,9020,9211,'2026-09-18 03:08:30'),(9028,9020,9212,'2026-09-18 03:08:30'),(9029,9021,9213,'2026-09-18 03:08:30'),(9030,9021,9214,'2026-09-18 03:08:30'),(9031,9021,9215,'2026-09-18 03:08:30'),(9032,9021,9216,'2026-09-18 03:08:30'),(9033,9021,9217,'2026-09-18 03:08:30'),(9034,9021,9218,'2026-09-18 03:08:30'),(9035,9021,9219,'2026-09-18 03:08:30'),(9036,9021,9220,'2026-09-18 03:08:30'),(9037,9021,9221,'2026-09-18 03:08:30'),(9038,9021,9222,'2026-09-18 03:08:30'),(9039,9021,9223,'2026-09-18 03:08:30'),(9040,9021,9224,'2026-09-18 03:08:30'),(9041,9022,9233,'2026-09-18 03:08:30'),(9042,9022,9234,'2026-09-18 03:08:30'),(9043,9022,9235,'2026-09-18 03:08:30'),(9044,9022,9236,'2026-09-18 03:08:30'),(9045,9022,9237,'2026-09-18 03:08:30'),(9046,9023,9201,'2026-09-18 03:08:30'),(9047,9023,9202,'2026-09-18 03:08:30'),(9048,9023,9203,'2026-09-18 03:08:30'),(9049,9023,9204,'2026-09-18 03:08:30'),(9050,9023,9205,'2026-09-18 03:08:30'),(9051,9023,9206,'2026-09-18 03:08:30'),(9052,9024,9213,'2026-09-18 03:08:30'),(9053,9024,9214,'2026-09-18 03:08:30'),(9054,9024,9215,'2026-09-18 03:08:30'),(9055,9024,9216,'2026-09-18 03:08:30'),(9056,9024,9217,'2026-09-18 03:08:30'),(9057,9024,9218,'2026-09-18 03:08:30'),(9058,9025,9207,'2026-09-18 03:08:30'),(9059,9025,9208,'2026-09-18 03:08:30'),(9060,9025,9209,'2026-09-18 03:08:30'),(9061,9025,9210,'2026-09-18 03:08:30'),(9062,9025,9211,'2026-09-18 03:08:30'),(9063,9025,9212,'2026-09-18 03:08:30'),(9064,9026,9219,'2026-09-18 03:08:30'),(9065,9026,9220,'2026-09-18 03:08:30'),(9066,9026,9221,'2026-09-18 03:08:30'),(9067,9026,9222,'2026-09-18 03:08:30'),(9068,9026,9223,'2026-09-18 03:08:30'),(9069,9026,9224,'2026-09-18 03:08:30'),(9070,9027,9225,'2026-09-18 03:08:30'),(9071,9027,9226,'2026-09-18 03:08:30'),(9072,9027,9227,'2026-09-18 03:08:30'),(9073,9027,9228,'2026-09-18 03:08:30'),(9074,9027,9229,'2026-09-18 03:08:30'),(9075,9027,9230,'2026-09-18 03:08:30'),(9076,9027,9231,'2026-09-18 03:08:30'),(9077,9028,9213,'2026-09-18 03:08:30'),(9078,9028,9214,'2026-09-18 03:08:30'),(9079,9028,9215,'2026-09-18 03:08:30'),(9080,9028,9216,'2026-09-18 03:08:30'),(9081,9028,9217,'2026-09-18 03:08:30'),(9082,9028,9218,'2026-09-18 03:08:30'),(9083,9028,9219,'2026-09-18 03:08:30'),(9084,9029,9203,'2026-09-18 03:08:30'),(9085,9029,9204,'2026-09-18 03:08:30'),(9086,9029,9205,'2026-09-18 03:08:30'),(9087,9029,9206,'2026-09-18 03:08:30'),(9088,9030,9215,'2026-09-18 03:08:30'),(9089,9030,9216,'2026-09-18 03:08:30'),(9090,9030,9217,'2026-09-18 03:08:30'),(9091,9031,9201,'2026-09-18 03:08:30'),(9092,9031,9202,'2026-09-18 03:08:30'),(9093,9031,9203,'2026-09-18 03:08:30'),(9094,9031,9204,'2026-09-18 03:08:30'),(9095,9031,9205,'2026-09-18 03:08:30'),(9096,9032,9213,'2026-09-18 03:08:30'),(9097,9032,9214,'2026-09-18 03:08:30'),(9098,9032,9215,'2026-09-18 03:08:30'),(9099,9032,9216,'2026-09-18 03:08:30'),(9100,9032,9217,'2026-09-18 03:08:30'),(9101,9033,9225,'2026-09-18 03:08:30'),(9102,9033,9201,'2026-09-18 03:08:30'),(9103,9001,9241,'2026-09-18 03:08:30'),(9104,9001,9242,'2026-09-18 03:08:30'),(9105,9001,9243,'2026-09-18 03:08:30'),(9106,9001,9244,'2026-09-18 03:08:30'),(9107,9001,9245,'2026-09-18 03:08:30'),(9108,9001,9246,'2026-09-18 03:08:30'),(9109,9001,9247,'2026-09-18 03:08:30'),(9110,9001,9248,'2026-09-18 03:08:30'),(9111,9001,9249,'2026-09-18 03:08:30'),(9112,9001,9250,'2026-09-18 03:08:30'),(9113,9001,9251,'2026-09-18 03:08:30'),(9114,9002,9252,'2026-09-18 03:08:30'),(9115,9002,9253,'2026-09-18 03:08:30'),(9116,9002,9254,'2026-09-18 03:08:30'),(9124,9004,9259,'2026-09-18 03:08:30'),(9125,9004,9260,'2026-09-18 03:08:30'),(9128,9004,9256,'2026-09-18 04:15:16'),(9129,9002,9257,'2026-09-18 04:15:54'),(9130,9004,9258,'2026-09-18 04:15:54'),(9131,9004,9003,'2026-09-18 08:19:36'),(9132,9020,9003,'2026-09-18 08:19:37'),(9133,9021,9003,'2026-09-18 08:19:38'),(9134,9030,9201,'2026-09-18 14:40:31');
/*!40000 ALTER TABLE `team_members` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `teams`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `teams` (
  `team_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
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
) ENGINE=InnoDB AUTO_INCREMENT=9034 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `teams` WRITE;
/*!40000 ALTER TABLE `teams` DISABLE KEYS */;
INSERT INTO `teams` VALUES (9001,'ทีมวิศวะ FC',1,9001,'Ready','Unofficial','private','2026-09-17 13:01:25','2026-09-18 04:15:54',NULL,NULL,NULL),(9002,'ทีมบาสวิศวะ',2,9001,'Ready','Unofficial','private','2026-09-17 13:01:25','2026-09-18 04:15:54',NULL,NULL,NULL),(9003,'ทีมเก่าที่ถูกลบ',1,9001,'Forming','Unofficial','private','2026-09-17 13:01:25',NULL,NULL,'2026-09-17 13:01:25','leader_deleted'),(9004,'ทีมบาสเกตวิทยา',2,9002,'Ready','Official','private','2026-09-17 13:01:25','2026-09-19 06:21:23',NULL,NULL,NULL),(9005,'QA Squad',1,9002,'Forming','Unofficial','private','2026-09-17 14:00:41',NULL,NULL,'2026-09-17 14:02:10','leader_deleted'),(9006,'QA Dup',1,9002,'Forming','Unofficial','private','2026-09-17 14:03:09','2026-09-18 04:15:54',NULL,NULL,NULL),(9007,'QA FC B',1,9003,'Forming','Unofficial','private','2026-09-17 14:04:01','2026-09-18 04:15:54',NULL,NULL,NULL),(9008,'QA Badminton A',3,9101,'Ready','Unofficial','private','2026-09-17 15:30:48','2026-09-18 04:15:54',NULL,NULL,NULL),(9009,'QA Badminton B',3,9103,'Ready','Unofficial','private','2026-09-17 15:30:50','2026-09-18 04:15:54',NULL,NULL,NULL),(9010,'QA Badminton C',3,9105,'Ready','Unofficial','private','2026-09-17 15:42:26','2026-09-18 04:15:54',NULL,NULL,NULL),(9011,'QA Badminton D',3,9107,'Ready','Unofficial','private','2026-09-17 15:42:27','2026-09-18 04:15:54',NULL,NULL,NULL),(9020,'วิศวกรรม ฟุตบอล A',1,9201,'Ready','Official','private','2026-09-18 03:08:30','2026-09-18 08:19:37',NULL,NULL,NULL),(9021,'วิทยาศาสตร์ ฟุตบอล B',1,9213,'Ready','Official','private','2026-09-18 03:08:30','2026-09-18 08:19:38',NULL,NULL,NULL),(9022,'ฟุตบอล ทีมกำลังรวมคน',1,9233,'Forming','Unofficial','private','2026-09-18 03:08:30','2026-09-18 04:15:54',NULL,NULL,NULL),(9023,'บาสเกตบอล วิศวกรรม ชุด 2',2,9201,'Ready','Unofficial','private','2026-09-18 03:08:30','2026-09-19 06:21:23',NULL,NULL,NULL),(9024,'บาสเกตบอล วิทยาศาสตร์ ชุด 2',2,9213,'Ready','Unofficial','private','2026-09-18 03:08:30','2026-09-19 06:21:23',NULL,NULL,NULL),(9025,'บาสเกตบอล วิศวกรรม',2,9207,'Ready','Unofficial','private','2026-09-18 03:08:30','2026-09-18 04:15:54',NULL,NULL,NULL),(9026,'บาสเกตบอล วิทยาศาสตร์',2,9219,'Ready','Unofficial','private','2026-09-18 03:08:30','2026-09-18 04:15:54',NULL,NULL,NULL),(9027,'บาสเกตบอลหญิง วิศวกรรม',2,9225,'Ready','Unofficial','private','2026-09-18 03:08:30','2026-09-19 06:21:23',NULL,NULL,NULL),(9028,'บาสเกตบอลชาย วิทยาศาสตร์',2,9213,'Ready','Unofficial','private','2026-09-18 03:08:30','2026-09-19 06:21:23',NULL,NULL,NULL),(9029,'แบดมินตัน วิศวกรรม',3,9203,'Ready','Unofficial','private','2026-09-18 03:08:30','2026-09-19 06:21:23',NULL,NULL,NULL),(9030,'แบดมินตัน วิทยาศาสตร์',3,9215,'Ready','Unofficial','private','2026-09-18 03:08:30','2026-09-19 06:21:23',NULL,NULL,NULL),(9031,'RoV ทีมแดง',4,9201,'Ready','Unofficial','private','2026-09-18 03:08:30','2026-09-18 04:15:54',NULL,NULL,NULL),(9032,'RoV ทีมน้ำเงิน',4,9213,'Ready','Unofficial','private','2026-09-18 03:08:30','2026-09-18 04:15:54',NULL,NULL,NULL),(9033,'แบดมินตัน คู่ผสม',3,9225,'Ready','Unofficial','private','2026-09-18 03:08:30','2026-09-19 06:21:23',NULL,NULL,NULL);
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
  PRIMARY KEY (`tournament_amendment_request_id`),
  KEY `tournament_id` (`tournament_id`),
  KEY `requested_by` (`requested_by`),
  KEY `reviewed_by` (`reviewed_by`),
  CONSTRAINT `tournament_amendment_requests_ibfk_1` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`tournament_id`),
  CONSTRAINT `tournament_amendment_requests_ibfk_2` FOREIGN KEY (`requested_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `tournament_amendment_requests_ibfk_3` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `tournament_amendment_requests` WRITE;
/*!40000 ALTER TABLE `tournament_amendment_requests` DISABLE KEYS */;
INSERT INTO `tournament_amendment_requests` VALUES (1,14,9001,'{\"maxTeams\": 8, \"eventEndDate\": \"2026-10-23\"}',NULL,'pending','2026-09-18 07:49:21',NULL,NULL,NULL),(2,14,9001,'{\"maxTeams\": 8, \"eventEndDate\": \"2026-10-23\"}',NULL,'pending','2026-09-18 07:49:47',NULL,NULL,NULL),(3,14,9001,'{\"maxTeams\": 8, \"eventEndDate\": \"2026-10-23\"}',NULL,'pending','2026-09-18 07:50:30',NULL,NULL,NULL);
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
  PRIMARY KEY (`tournament_application_id`),
  UNIQUE KEY `tournament_id` (`tournament_id`,`team_id`),
  KEY `team_id` (`team_id`),
  KEY `reviewed_by` (`reviewed_by`),
  CONSTRAINT `tournament_applications_ibfk_1` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`tournament_id`),
  CONSTRAINT `tournament_applications_ibfk_2` FOREIGN KEY (`team_id`) REFERENCES `teams` (`team_id`),
  CONSTRAINT `tournament_applications_ibfk_3` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `tournament_applications` WRITE;
/*!40000 ALTER TABLE `tournament_applications` DISABLE KEYS */;
INSERT INTO `tournament_applications` VALUES (1,2,9004,1,'[{\"passed\": true, \"userId\": 9002, \"fullName\": \"สมหญิง รักเรียน\"}]',NULL,'approved',NULL,NULL,NULL,'2026-09-17 14:04:01'),(2,6,9004,1,'[{\"passed\": true, \"userId\": 9002, \"fullName\": \"สมหญิง รักเรียน\"}]',NULL,'approved',NULL,NULL,NULL,'2026-09-17 14:11:32'),(3,10,9008,1,'[{\"passed\": true, \"userId\": 9101, \"fullName\": \"à¸œà¸¹à¹‰à¹€à¸¥à¹ˆà¸™ à¹€à¸­à¸«à¸™à¸¶à¹ˆà¸‡\"}, {\"passed\": true, \"userId\": 9102, \"fullName\": \"à¸œà¸¹à¹‰à¹€à¸¥à¹ˆà¸™ à¹€à¸­à¸ªà¸­à¸‡\"}]',NULL,'approved',NULL,NULL,NULL,'2026-09-17 15:30:54'),(4,10,9009,1,'[{\"passed\": true, \"userId\": 9103, \"fullName\": \"à¸œà¸¹à¹‰à¹€à¸¥à¹ˆà¸™ à¸šà¸µà¸«à¸™à¸¶à¹ˆà¸‡\"}, {\"passed\": true, \"userId\": 9104, \"fullName\": \"à¸œà¸¹à¹‰à¹€à¸¥à¹ˆà¸™ à¸šà¸µà¸ªà¸­à¸‡\"}]',NULL,'approved',NULL,NULL,NULL,'2026-09-17 15:30:54'),(5,12,9008,1,'[{\"passed\": true, \"userId\": 9101, \"fullName\": \"à¸œà¸¹à¹‰à¹€à¸¥à¹ˆà¸™ à¹€à¸­à¸«à¸™à¸¶à¹ˆà¸‡\"}, {\"passed\": true, \"userId\": 9102, \"fullName\": \"à¸œà¸¹à¹‰à¹€à¸¥à¹ˆà¸™ à¹€à¸­à¸ªà¸­à¸‡\"}]',NULL,'approved',NULL,NULL,NULL,'2026-09-17 15:36:49'),(6,12,9009,1,'[{\"passed\": true, \"userId\": 9103, \"fullName\": \"à¸œà¸¹à¹‰à¹€à¸¥à¹ˆà¸™ à¸šà¸µà¸«à¸™à¸¶à¹ˆà¸‡\"}, {\"passed\": true, \"userId\": 9104, \"fullName\": \"à¸œà¸¹à¹‰à¹€à¸¥à¹ˆà¸™ à¸šà¸µà¸ªà¸­à¸‡\"}]',NULL,'approved',NULL,NULL,NULL,'2026-09-17 15:36:49'),(7,13,9008,1,'[{\"passed\": true, \"userId\": 9101, \"fullName\": \"à¸œà¸¹à¹‰à¹€à¸¥à¹ˆà¸™ à¹€à¸­à¸«à¸™à¸¶à¹ˆà¸‡\"}, {\"passed\": true, \"userId\": 9102, \"fullName\": \"à¸œà¸¹à¹‰à¹€à¸¥à¹ˆà¸™ à¹€à¸­à¸ªà¸­à¸‡\"}]',NULL,'approved',NULL,NULL,NULL,'2026-09-17 15:42:30'),(8,13,9009,1,'[{\"passed\": true, \"userId\": 9103, \"fullName\": \"à¸œà¸¹à¹‰à¹€à¸¥à¹ˆà¸™ à¸šà¸µà¸«à¸™à¸¶à¹ˆà¸‡\"}, {\"passed\": true, \"userId\": 9104, \"fullName\": \"à¸œà¸¹à¹‰à¹€à¸¥à¹ˆà¸™ à¸šà¸µà¸ªà¸­à¸‡\"}]',NULL,'approved',NULL,NULL,NULL,'2026-09-17 15:42:31'),(9,13,9010,1,'[{\"passed\": true, \"userId\": 9105, \"fullName\": \"QA C1\"}, {\"passed\": true, \"userId\": 9106, \"fullName\": \"QA C2\"}]',NULL,'approved',NULL,NULL,NULL,'2026-09-17 15:42:31'),(10,13,9011,1,'[{\"passed\": true, \"userId\": 9107, \"fullName\": \"QA D1\"}, {\"passed\": true, \"userId\": 9108, \"fullName\": \"QA D2\"}]',NULL,'approved',NULL,NULL,NULL,'2026-09-17 15:42:32'),(11,14,9021,1,'[{\"passed\": true, \"userId\": 9213, \"fullName\": \"กันตพงศ์ อินทรีย์\"}, {\"passed\": true, \"userId\": 9214, \"fullName\": \"ธีรเดช แสงทอง\"}, {\"passed\": true, \"userId\": 9215, \"fullName\": \"อัครเดช สุวรรณโชติ\"}, {\"passed\": true, \"userId\": 9216, \"fullName\": \"วชิรวิทย์ ใจดี\"}, {\"passed\": true, \"userId\": 9217, \"fullName\": \"นภัสกร วัฒนกุล\"}, {\"passed\": true, \"userId\": 9218, \"fullName\": \"ปิยะพงษ์ มณีรัตน์\"}, {\"passed\": true, \"userId\": 9219, \"fullName\": \"จิรายุ รุ่งเรือง\"}, {\"passed\": true, \"userId\": 9220, \"fullName\": \"ศิวกร ธารารักษ์\"}, {\"passed\": true, \"userId\": 9221, \"fullName\": \"ปกรณ์ ทองคำ\"}, {\"passed\": true, \"userId\": 9222, \"fullName\": \"ธนวัฒน์ ปัญญาดี\"}, {\"passed\": true, \"userId\": 9223, \"fullName\": \"ศุภโชค พงษ์ไพบูลย์\"}, {\"passed\": true, \"userId\": 9224, \"fullName\": \"กิตติพงศ์ จันทร์เพ็ญ\"}]',NULL,'approved',NULL,NULL,NULL,'2026-09-18 03:29:32'),(18,16,9004,1,'[{\"passed\": true, \"userId\": 9002, \"fullName\": \"สมหญิง รักเรียน\"}, {\"passed\": true, \"userId\": 9255, \"fullName\": \"วรรณิดา มณีรัตน์\"}, {\"passed\": true, \"userId\": 9256, \"fullName\": \"ธัญชนก รุ่งเรือง\"}, {\"passed\": true, \"userId\": 9258, \"fullName\": \"ปรียานุช ทองคำ\"}, {\"passed\": true, \"userId\": 9259, \"fullName\": \"สุพิชญา ปัญญาดี\"}, {\"passed\": true, \"userId\": 9260, \"fullName\": \"เบญญาภา พงษ์ไพบูลย์\"}]',NULL,'approved',NULL,NULL,NULL,'2026-09-18 04:27:48'),(19,19,9008,1,'[{\"passed\": true, \"userId\": 9101, \"fullName\": \"ผู้เล่น เอหนึ่ง\"}, {\"passed\": true, \"userId\": 9102, \"fullName\": \"ผู้เล่น เอสอง\"}]',NULL,'approved',NULL,NULL,NULL,'2026-09-18 04:39:20'),(20,19,9009,1,'[{\"passed\": true, \"userId\": 9103, \"fullName\": \"ผู้เล่น บีหนึ่ง\"}, {\"passed\": true, \"userId\": 9104, \"fullName\": \"ผู้เล่น บีสอง\"}]',NULL,'approved',NULL,NULL,NULL,'2026-09-18 04:39:20'),(21,19,9010,1,'[{\"passed\": true, \"userId\": 9105, \"fullName\": \"QA C1\"}, {\"passed\": true, \"userId\": 9106, \"fullName\": \"QA C2\"}]',NULL,'approved',NULL,NULL,NULL,'2026-09-18 04:39:20'),(22,19,9011,1,'[{\"passed\": true, \"userId\": 9107, \"fullName\": \"QA D1\"}, {\"passed\": true, \"userId\": 9108, \"fullName\": \"QA D2\"}]',NULL,'approved',NULL,NULL,NULL,'2026-09-18 04:39:20'),(23,20,9027,1,'[{\"passed\": true, \"userId\": 9225, \"fullName\": \"ณัฐธิดา ใจดี\"}, {\"passed\": true, \"userId\": 9226, \"fullName\": \"พิมพ์ชนก วัฒนกุล\"}, {\"passed\": true, \"userId\": 9227, \"fullName\": \"กัญญาณัฐ มณีรัตน์\"}, {\"passed\": true, \"userId\": 9228, \"fullName\": \"ศิรประภา รุ่งเรือง\"}, {\"passed\": true, \"userId\": 9229, \"fullName\": \"ชนิกานต์ ธารารักษ์\"}, {\"passed\": true, \"userId\": 9230, \"fullName\": \"วรรณิดา ทองคำ\"}, {\"passed\": true, \"userId\": 9231, \"fullName\": \"ธัญชนก ปัญญาดี\"}]',NULL,'approved',NULL,NULL,NULL,'2026-09-18 04:39:21'),(24,20,9028,1,'[{\"passed\": true, \"userId\": 9213, \"fullName\": \"กันตพงศ์ อินทรีย์\"}, {\"passed\": true, \"userId\": 9214, \"fullName\": \"ธีรเดช แสงทอง\"}, {\"passed\": true, \"userId\": 9215, \"fullName\": \"อัครเดช สุวรรณโชติ\"}, {\"passed\": true, \"userId\": 9216, \"fullName\": \"วชิรวิทย์ ใจดี\"}, {\"passed\": true, \"userId\": 9217, \"fullName\": \"นภัสกร วัฒนกุล\"}, {\"passed\": true, \"userId\": 9218, \"fullName\": \"ปิยะพงษ์ มณีรัตน์\"}, {\"passed\": true, \"userId\": 9219, \"fullName\": \"จิรายุ รุ่งเรือง\"}]',NULL,'approved',NULL,NULL,NULL,'2026-09-18 04:39:21'),(25,17,9025,1,'[{\"passed\": true, \"userId\": 9207, \"fullName\": \"วรินทร ปัญญาดี\"}, {\"passed\": true, \"userId\": 9208, \"fullName\": \"ชัยวัฒน์ พงษ์ไพบูลย์\"}, {\"passed\": true, \"userId\": 9209, \"fullName\": \"พีรพล จันทร์เพ็ญ\"}, {\"passed\": true, \"userId\": 9210, \"fullName\": \"สหรัฐ บุญมา\"}, {\"passed\": true, \"userId\": 9211, \"fullName\": \"ภูมิพัฒน์ เกษมสุข\"}, {\"passed\": true, \"userId\": 9212, \"fullName\": \"รัชชานนท์ ศรีสุข\"}]',NULL,'approved',NULL,NULL,NULL,'2026-09-18 07:50:31'),(26,17,9026,1,'[{\"passed\": true, \"userId\": 9219, \"fullName\": \"จิรายุ รุ่งเรือง\"}, {\"passed\": true, \"userId\": 9220, \"fullName\": \"ศิวกร ธารารักษ์\"}, {\"passed\": true, \"userId\": 9221, \"fullName\": \"ปกรณ์ ทองคำ\"}, {\"passed\": true, \"userId\": 9222, \"fullName\": \"ธนวัฒน์ ปัญญาดี\"}, {\"passed\": true, \"userId\": 9223, \"fullName\": \"ศุภโชค พงษ์ไพบูลย์\"}, {\"passed\": true, \"userId\": 9224, \"fullName\": \"กิตติพงศ์ จันทร์เพ็ญ\"}]',NULL,'approved',NULL,NULL,NULL,'2026-09-18 07:50:31'),(27,18,9031,1,'[{\"passed\": true, \"userId\": 9201, \"fullName\": \"ปกรณ์ ใจดี\"}, {\"passed\": true, \"userId\": 9202, \"fullName\": \"ธนวัฒน์ วัฒนกุล\"}, {\"passed\": true, \"userId\": 9203, \"fullName\": \"ศุภโชค มณีรัตน์\"}, {\"passed\": true, \"userId\": 9204, \"fullName\": \"กิตติพงศ์ รุ่งเรือง\"}, {\"passed\": true, \"userId\": 9205, \"fullName\": \"อนุชา ธารารักษ์\"}]',NULL,'approved',NULL,NULL,NULL,'2026-09-18 08:22:46'),(28,18,9032,1,'[{\"passed\": true, \"userId\": 9213, \"fullName\": \"กันตพงศ์ อินทรีย์\"}, {\"passed\": true, \"userId\": 9214, \"fullName\": \"ธีรเดช แสงทอง\"}, {\"passed\": true, \"userId\": 9215, \"fullName\": \"อัครเดช สุวรรณโชติ\"}, {\"passed\": true, \"userId\": 9216, \"fullName\": \"วชิรวิทย์ ใจดี\"}, {\"passed\": true, \"userId\": 9217, \"fullName\": \"นภัสกร วัฒนกุล\"}]',NULL,'approved',NULL,NULL,NULL,'2026-09-18 08:22:46'),(29,14,9001,1,'[{\"passed\": true, \"userId\": 9001, \"fullName\": \"สมชาย ใจดี\"}, {\"passed\": true, \"userId\": 9241, \"fullName\": \"กิตติพงศ์ รุ่งเรือง\"}, {\"passed\": true, \"userId\": 9242, \"fullName\": \"อนุชา ธารารักษ์\"}, {\"passed\": true, \"userId\": 9243, \"fullName\": \"ณัฐพล ทองคำ\"}, {\"passed\": true, \"userId\": 9244, \"fullName\": \"วรินทร ปัญญาดี\"}, {\"passed\": true, \"userId\": 9245, \"fullName\": \"ชัยวัฒน์ พงษ์ไพบูลย์\"}, {\"passed\": true, \"userId\": 9246, \"fullName\": \"พีรพล จันทร์เพ็ญ\"}, {\"passed\": true, \"userId\": 9247, \"fullName\": \"สหรัฐ บุญมา\"}, {\"passed\": true, \"userId\": 9248, \"fullName\": \"ภูมิพัฒน์ เกษมสุข\"}, {\"passed\": true, \"userId\": 9249, \"fullName\": \"รัชชานนท์ ศรีสุข\"}, {\"passed\": true, \"userId\": 9250, \"fullName\": \"กันตพงศ์ อินทรีย์\"}, {\"passed\": true, \"userId\": 9251, \"fullName\": \"ธีรเดช แสงทอง\"}]',NULL,'approved',NULL,NULL,NULL,'2026-09-18 13:56:17'),(30,21,9008,1,'[{\"passed\": true, \"userId\": 9101, \"fullName\": \"ผู้เล่น เอหนึ่ง\"}, {\"passed\": true, \"userId\": 9102, \"fullName\": \"ผู้เล่น เอสอง\"}]',NULL,'approved',NULL,NULL,NULL,'2026-09-18 14:25:16'),(31,21,9009,1,'[{\"passed\": true, \"userId\": 9103, \"fullName\": \"ผู้เล่น บีหนึ่ง\"}, {\"passed\": true, \"userId\": 9104, \"fullName\": \"ผู้เล่น บีสอง\"}]',NULL,'approved',NULL,NULL,NULL,'2026-09-18 14:25:16'),(32,22,9024,1,'[{\"passed\": true, \"userId\": 9213, \"fullName\": \"กันตพงศ์ อินทรีย์\"}, {\"passed\": true, \"userId\": 9214, \"fullName\": \"ธีรเดช แสงทอง\"}, {\"passed\": true, \"userId\": 9215, \"fullName\": \"อัครเดช สุวรรณโชติ\"}, {\"passed\": true, \"userId\": 9216, \"fullName\": \"วชิรวิทย์ ใจดี\"}, {\"passed\": true, \"userId\": 9217, \"fullName\": \"นภัสกร วัฒนกุล\"}, {\"passed\": true, \"userId\": 9218, \"fullName\": \"ปิยะพงษ์ มณีรัตน์\"}]',NULL,'approved',NULL,NULL,NULL,'2026-09-18 14:25:17'),(33,23,9023,1,'[{\"passed\": true, \"userId\": 9201, \"fullName\": \"ปกรณ์ ใจดี\"}, {\"passed\": true, \"userId\": 9202, \"fullName\": \"ธนวัฒน์ วัฒนกุล\"}, {\"passed\": true, \"userId\": 9203, \"fullName\": \"ศุภโชค มณีรัตน์\"}, {\"passed\": true, \"userId\": 9204, \"fullName\": \"กิตติพงศ์ รุ่งเรือง\"}, {\"passed\": true, \"userId\": 9205, \"fullName\": \"อนุชา ธารารักษ์\"}, {\"passed\": true, \"userId\": 9206, \"fullName\": \"ณัฐพล ทองคำ\"}]',NULL,'approved',NULL,NULL,NULL,'2026-09-18 14:26:59'),(34,23,9024,1,'[{\"passed\": true, \"userId\": 9213, \"fullName\": \"กันตพงศ์ อินทรีย์\"}, {\"passed\": true, \"userId\": 9214, \"fullName\": \"ธีรเดช แสงทอง\"}, {\"passed\": true, \"userId\": 9215, \"fullName\": \"อัครเดช สุวรรณโชติ\"}, {\"passed\": true, \"userId\": 9216, \"fullName\": \"วชิรวิทย์ ใจดี\"}, {\"passed\": true, \"userId\": 9217, \"fullName\": \"นภัสกร วัฒนกุล\"}, {\"passed\": true, \"userId\": 9218, \"fullName\": \"ปิยะพงษ์ มณีรัตน์\"}]',NULL,'approved',NULL,NULL,NULL,'2026-09-18 14:26:59'),(35,22,9023,1,'[{\"passed\": true, \"userId\": 9201, \"fullName\": \"ปกรณ์ ใจดี\"}, {\"passed\": true, \"userId\": 9202, \"fullName\": \"ธนวัฒน์ วัฒนกุล\"}, {\"passed\": true, \"userId\": 9203, \"fullName\": \"ศุภโชค มณีรัตน์\"}, {\"passed\": true, \"userId\": 9204, \"fullName\": \"กิตติพงศ์ รุ่งเรือง\"}, {\"passed\": true, \"userId\": 9205, \"fullName\": \"อนุชา ธารารักษ์\"}, {\"passed\": true, \"userId\": 9206, \"fullName\": \"ณัฐพล ทองคำ\"}]',NULL,'approved',NULL,NULL,NULL,'2026-09-18 15:57:25');
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
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `tournament_eligibility_rules` WRITE;
/*!40000 ALTER TABLE `tournament_eligibility_rules` DISABLE KEYS */;
INSERT INTO `tournament_eligibility_rules` VALUES (1,14,'faculty',1);
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `tournament_feedback` WRITE;
/*!40000 ALTER TABLE `tournament_feedback` DISABLE KEYS */;
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
  PRIMARY KEY (`tournament_referee_id`),
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
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `tournament_referees` WRITE;
/*!40000 ALTER TABLE `tournament_referees` DISABLE KEYS */;
INSERT INTO `tournament_referees` VALUES (1,2,9003,9001,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-17 14:00:43','2026-09-17 14:02:08',9001),(2,2,9002,9001,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-17 14:02:08',NULL,NULL),(3,2,9001,9001,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-17 14:03:08',NULL,NULL),(4,2,9003,9001,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-17 14:03:10',NULL,NULL),(5,4,9003,9001,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-17 14:04:44',NULL,NULL),(6,4,9001,9001,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-17 14:04:44',NULL,NULL),(7,6,9003,9001,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-17 14:11:31',NULL,NULL),(8,6,9002,9001,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-17 14:11:31',NULL,NULL),(9,10,9002,9001,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-17 15:30:52',NULL,NULL),(10,10,9003,9001,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-17 15:30:52',NULL,NULL),(11,12,9002,9001,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-17 15:36:47',NULL,NULL),(12,12,9003,9001,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-17 15:36:47',NULL,NULL),(13,13,9002,9001,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-17 15:42:28',NULL,NULL),(14,13,9003,9001,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-17 15:42:29',NULL,NULL),(15,14,9002,9001,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-18 03:25:44',NULL,NULL),(16,14,9003,9001,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-18 03:25:44',NULL,NULL),(17,16,9002,9001,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-18 04:06:32',NULL,NULL),(18,16,9003,9001,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-18 04:06:32',NULL,NULL),(19,17,9002,9001,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-18 04:06:32',NULL,NULL),(20,17,9003,9001,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-18 04:06:32',NULL,NULL),(21,18,9002,9001,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-18 04:06:32',NULL,NULL),(22,18,9003,9001,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-18 04:06:32',NULL,NULL),(23,19,9002,9001,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-18 04:39:20',NULL,NULL),(24,19,9003,9001,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-18 04:39:20',NULL,NULL),(25,20,9002,9001,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-18 04:39:21',NULL,NULL),(26,20,9003,9001,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-18 04:39:21',NULL,NULL),(27,19,9053,9001,'accepted',1,'pending','[\"referee-identity/9053-id-card.jpg\"]',NULL,NULL,NULL,'2026-09-18 07:48:48',NULL,NULL),(28,19,9052,9001,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-18 14:06:13',NULL,NULL),(29,21,9201,9001,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-18 14:25:16',NULL,NULL),(30,21,9002,9001,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-18 14:25:16',NULL,NULL),(31,22,9002,9201,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-18 14:25:16',NULL,NULL),(32,22,9003,9201,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-18 14:25:16',NULL,NULL),(33,19,9201,9001,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-18 14:25:17',NULL,NULL),(34,23,9002,9201,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-18 14:26:59',NULL,NULL),(35,23,9003,9201,'accepted',0,'not_required',NULL,NULL,NULL,NULL,'2026-09-18 14:26:59',NULL,NULL);
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
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`standing_id`),
  UNIQUE KEY `tournament_id` (`tournament_id`,`team_id`),
  KEY `team_id` (`team_id`),
  CONSTRAINT `tournament_standings_ibfk_1` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`tournament_id`),
  CONSTRAINT `tournament_standings_ibfk_2` FOREIGN KEY (`team_id`) REFERENCES `teams` (`team_id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `tournament_standings` WRITE;
/*!40000 ALTER TABLE `tournament_standings` DISABLE KEYS */;
INSERT INTO `tournament_standings` VALUES (1,12,9008,1,1,0,3,'2026-09-17 15:39:17'),(2,12,9009,1,0,1,0,'2026-09-17 15:39:17'),(3,13,9008,2,2,0,6,'2026-09-18 02:24:07'),(4,13,9011,1,0,1,0,'2026-09-17 15:44:44'),(5,13,9010,2,1,1,3,'2026-09-18 02:24:07'),(6,13,9009,1,0,1,0,'2026-09-17 15:44:44'),(9,19,9010,1,1,0,3,'2026-09-18 04:39:20'),(10,19,9009,1,0,1,0,'2026-09-18 04:39:20'),(11,20,9027,1,1,0,3,'2026-09-18 07:48:48'),(12,20,9028,1,0,1,0,'2026-09-18 07:48:48');
/*!40000 ALTER TABLE `tournament_standings` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `tournaments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournaments` (
  `tournament_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `sport_type_id` int NOT NULL,
  `bracket_format` enum('single_elimination','double_elimination','round_robin') DEFAULT NULL,
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
  CONSTRAINT `tournaments_ibfk_1` FOREIGN KEY (`sport_type_id`) REFERENCES `sport_types` (`sport_type_id`),
  CONSTRAINT `tournaments_ibfk_2` FOREIGN KEY (`organizing_faculty_id`) REFERENCES `faculties` (`faculty_id`),
  CONSTRAINT `tournaments_ibfk_3` FOREIGN KEY (`organizing_department_id`) REFERENCES `departments` (`department_id`),
  CONSTRAINT `tournaments_ibfk_4` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `tournaments_ibfk_5` FOREIGN KEY (`organizer_external_reviewed_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `tournaments_ibfk_6` FOREIGN KEY (`approved_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `tournaments_ibfk_7` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `tournaments_ibfk_8` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `tournaments` WRITE;
/*!40000 ALTER TABLE `tournaments` DISABLE KEYS */;
INSERT INTO `tournaments` VALUES (1,'ทดสอบฟุตบอลคัพ 2026',NULL,1,'single_elimination','faculty',1,NULL,9001,'not_required',NULL,NULL,NULL,NULL,'private',0,'2026-09-17 17:00:00','2026-09-24 17:00:00','2026-10-01','2026-10-05',8,2,'สนามกีฬากลาง',24,'any',NULL,NULL,NULL,9001,'2026-09-18 07:54:25','2026-09-17 13:19:35','2026-09-18 07:54:25',9001,NULL,NULL),(2,'QA Open Cup',NULL,2,'single_elimination','faculty',1,NULL,9001,'not_required',NULL,NULL,NULL,NULL,'public',0,'2026-09-15 17:00:00','2026-10-29 17:00:00','2026-11-01','2026-11-05',8,2,'QA Arena',24,'any',NULL,NULL,NULL,9001,'2026-09-17 14:00:40','2026-09-17 14:00:39','2026-09-17 14:04:02',9001,NULL,NULL),(3,'QA Past Reg',NULL,1,'single_elimination','faculty',1,NULL,9001,'not_required',NULL,NULL,NULL,NULL,'private',0,'2019-12-31 17:00:00','2020-01-31 17:00:00','2020-03-01','2020-03-05',8,2,'QA',24,'any',NULL,NULL,NULL,9001,'2026-09-18 07:54:27','2026-09-17 14:03:08','2026-09-18 07:54:27',9001,NULL,NULL),(4,'QA Age Cup',NULL,2,'single_elimination','faculty',1,NULL,9001,'not_required',NULL,NULL,NULL,NULL,'public',1,'2026-09-15 17:00:00','2026-10-29 17:00:00','2026-11-10','2026-11-12',8,2,'QA Hall',24,'any',30,NULL,NULL,9001,'2026-09-17 14:04:43','2026-09-17 14:04:43','2026-09-17 14:04:45',9001,NULL,NULL),(5,'QA Gender Cup',NULL,2,'single_elimination','faculty',1,NULL,9001,'not_required',NULL,NULL,NULL,NULL,'private',0,'2026-09-15 17:00:00','2026-10-29 17:00:00','2026-11-20','2026-11-22',8,2,'QA Hall',24,'male',NULL,NULL,NULL,9001,'2026-09-18 07:54:27','2026-09-17 14:04:45','2026-09-18 07:54:27',9001,NULL,NULL),(6,'QA Window Cup',NULL,2,'single_elimination','faculty',1,NULL,9001,'not_required',NULL,NULL,NULL,NULL,'public',1,'2026-07-31 17:00:00','2026-08-31 17:00:00','2026-12-01','2026-12-03',8,2,'QA Hall',24,'any',NULL,NULL,NULL,9001,'2026-09-17 14:11:31','2026-09-17 14:11:30','2026-09-17 14:11:32',9001,NULL,NULL),(7,'QA TZ Offset',NULL,1,'single_elimination','faculty',1,NULL,9001,'not_required',NULL,NULL,NULL,NULL,'private',0,'2026-10-01 14:49:00','2026-10-10 14:49:00','2026-11-20','2026-11-22',8,2,'QA',24,'any',NULL,NULL,NULL,9001,'2026-09-18 07:54:28','2026-09-17 14:52:23','2026-09-18 07:54:28',9001,NULL,NULL),(8,'QA Request Form Cup',NULL,1,'single_elimination','faculty',1,NULL,9002,'not_required',NULL,NULL,NULL,NULL,'private',0,'2026-09-19 02:00:00','2026-10-02 10:00:00','2026-10-08','2026-10-09',8,2,'QA Arena',24,'any',NULL,NULL,NULL,9001,'2026-09-18 07:54:28','2026-09-17 14:54:55','2026-09-18 07:54:28',9001,NULL,NULL),(9,'QA Request Form Cup',NULL,1,'single_elimination','faculty',1,NULL,9002,'not_required',NULL,NULL,NULL,NULL,'private',0,'2026-09-18 14:57:00','2026-10-01 14:57:00','2026-10-08','2026-10-09',8,2,'QA Arena',24,'any',NULL,NULL,NULL,9001,'2026-09-18 07:54:29','2026-09-17 15:00:19','2026-09-18 07:54:29',9001,NULL,NULL),(10,'QA Badminton Cup',NULL,3,'single_elimination','faculty',1,NULL,9001,'not_required',NULL,NULL,NULL,NULL,'public',0,'2026-09-17 01:00:00','2026-09-27 01:00:00','2026-10-05','2026-10-06',2,2,'QA Court',24,'any',NULL,NULL,NULL,9001,'2026-09-17 15:30:52','2026-09-17 15:30:51','2026-09-17 15:30:55',9001,NULL,NULL),(11,'aba',NULL,1,'single_elimination','faculty',1,NULL,9002,'not_required',NULL,NULL,NULL,NULL,'private',0,'2026-09-18 15:33:00','2026-10-01 15:33:00','2026-10-08','2026-10-09',8,2,'ss',24,'any',1,51,NULL,9001,'2026-09-18 07:54:29','2026-09-17 15:34:28','2026-09-18 07:54:29',9001,NULL,NULL),(12,'QA Badminton Cup 2',NULL,3,'single_elimination','faculty',1,NULL,9001,'not_required',NULL,NULL,NULL,NULL,'completed',0,'2026-09-17 01:00:00','2026-09-27 01:00:00','2026-08-29','2026-08-31',2,2,'QA Court 2',24,'any',NULL,NULL,NULL,9001,'2026-09-17 15:36:47','2026-09-17 15:36:46','2026-09-17 15:36:50',9001,NULL,NULL),(13,'QA Badminton Cup 4Teams',NULL,3,'single_elimination','faculty',1,NULL,9001,'not_required',NULL,NULL,NULL,NULL,'public',0,'2026-09-17 01:00:00','2026-09-27 01:00:00','2026-09-09','2026-09-11',4,4,'QA Court 3',24,'any',NULL,NULL,NULL,9001,'2026-09-17 15:42:28','2026-09-17 15:42:28','2026-09-17 15:42:33',9001,NULL,NULL),(14,'ฟุตบอลประเพณี คณะวิศวกรรมศาสตร์',NULL,1,'single_elimination','faculty',1,NULL,9001,'not_required',NULL,NULL,NULL,NULL,'public',1,'2026-09-18 01:00:00','2026-09-30 16:59:00','2026-10-20','2026-10-22',4,2,'สนามกีฬากลาง',24,'any',NULL,NULL,NULL,9001,'2026-09-18 03:25:44','2026-09-18 03:25:44','2026-09-18 03:25:44',9001,NULL,NULL),(15,'www',NULL,1,'single_elimination','faculty',1,NULL,9001,'not_required',NULL,NULL,NULL,NULL,'private',0,'2026-09-19 03:35:00','2026-10-02 03:35:00','2026-10-09','2026-10-10',8,2,'aa',24,'any',3,31,NULL,9001,'2026-09-18 07:54:30','2026-09-18 03:35:47','2026-09-18 07:54:30',9001,NULL,NULL),(16,'บาสเกตบอลหญิง ชิงแชมป์มหาวิทยาลัย',NULL,2,'single_elimination','faculty',1,NULL,9001,'not_required',NULL,NULL,NULL,NULL,'public',1,'2026-09-18 01:00:00','2026-10-15 16:59:00','2026-11-01','2026-11-03',4,2,'ศูนย์กีฬามหาวิทยาลัย',24,'female',NULL,NULL,NULL,9001,'2026-09-18 04:06:31','2026-09-18 04:06:31','2026-09-18 04:06:32',9001,NULL,NULL),(17,'บาสเกตบอล ลีกคณะ',NULL,2,'single_elimination','faculty',1,NULL,9001,'not_required',NULL,NULL,NULL,NULL,'public',0,'2026-09-18 01:00:00','2026-10-15 16:59:00','2026-09-17','2026-09-20',4,2,'ศูนย์กีฬามหาวิทยาลัย',24,'any',NULL,NULL,NULL,9001,'2026-09-18 04:06:32','2026-09-18 04:06:32','2026-09-18 07:50:31',9001,NULL,NULL),(18,'RoV ชิงแชมป์มหาวิทยาลัย (ออนไลน์)',NULL,4,'single_elimination','faculty',1,NULL,9001,'not_required',NULL,NULL,NULL,NULL,'public',0,'2026-09-18 01:00:00','2026-10-15 16:59:00','2026-11-01','2026-11-03',4,2,'ศูนย์กีฬามหาวิทยาลัย',24,'any',NULL,NULL,NULL,9001,'2026-09-18 04:06:32','2026-09-18 04:06:32','2026-09-18 08:22:46',9001,NULL,NULL),(19,'แบดมินตัน ชิงแชมป์มหาวิทยาลัย',NULL,3,'single_elimination','faculty',1,NULL,9001,'not_required',NULL,NULL,NULL,NULL,'public',0,'2026-09-18 01:00:00','2026-09-30 16:59:00','2026-10-25','2026-10-26',4,4,'โรงยิม 1',24,'any',NULL,NULL,NULL,9001,'2026-09-18 04:39:20','2026-09-18 04:39:20','2026-09-18 04:39:20',9001,NULL,NULL),(20,'บาสเกตบอล คู่พิเศษ',NULL,2,'single_elimination','faculty',1,NULL,9001,'not_required',NULL,NULL,NULL,NULL,'public',0,'2026-09-18 01:00:00','2026-09-30 16:59:00','2026-10-25','2026-10-26',2,2,'โรงยิม 2',24,'any',NULL,NULL,NULL,9001,'2026-09-18 04:39:21','2026-09-18 04:39:21','2026-09-18 04:39:21',9001,NULL,NULL),(21,'แบดมินตัน ไฟต์พิเศษ',NULL,3,'single_elimination','faculty',1,NULL,9001,'not_required',NULL,NULL,NULL,NULL,'public',0,'2026-09-18 01:00:00','2026-09-30 16:59:00','2026-11-10','2026-11-11',2,2,'โรงยิม 4',24,'any',NULL,NULL,NULL,9001,'2026-09-18 14:25:16','2026-09-18 14:25:16','2026-09-18 14:25:16',9001,NULL,NULL),(22,'บาสเกตบอลสายสัมพันธ์ (ปกรณ์จัด)',NULL,2,'single_elimination','faculty',1,NULL,9201,'not_required',NULL,NULL,NULL,NULL,'public',1,'2026-09-18 01:00:00','2026-10-20 16:59:00','2026-11-15','2026-11-16',4,2,'โรงยิม 3',24,'any',NULL,NULL,NULL,9001,'2026-09-18 14:25:16','2026-09-18 14:25:16','2026-09-18 14:25:17',9201,NULL,NULL),(23,'บาสเกตบอลสายสัมพันธ์ รอบชิงพิเศษ',NULL,2,'single_elimination','faculty',1,NULL,9201,'not_required',NULL,NULL,NULL,NULL,'public',0,'2026-09-18 01:00:00','2026-10-10 16:59:00','2026-11-20','2026-11-21',2,2,'โรงยิม 3',24,'any',NULL,NULL,NULL,9001,'2026-09-18 14:26:59','2026-09-18 14:26:59','2026-09-18 14:26:59',9201,NULL,NULL),(24,'บาสเกตบอลสัมพันธ์ คณะวิทยาศาสตร์',NULL,2,'single_elimination','faculty',1,NULL,9213,'not_required',NULL,NULL,NULL,NULL,'pending_approval',0,'2026-10-01 01:00:00','2026-10-25 16:59:00','2026-12-01','2026-12-03',4,2,'ศูนย์กีฬามหาวิทยาลัย',24,'any',NULL,NULL,NULL,NULL,NULL,'2026-09-18 15:11:46',NULL,NULL,NULL,NULL),(25,'แบดมินตันหญิง ชิงถ้วยคณบดี',NULL,3,'single_elimination','faculty',1,NULL,9225,'not_required',NULL,NULL,NULL,NULL,'pending_approval',0,'2026-10-01 01:00:00','2026-10-25 16:59:00','2026-12-01','2026-12-03',4,2,'ศูนย์กีฬามหาวิทยาลัย',24,'any',NULL,NULL,NULL,NULL,NULL,'2026-09-18 15:11:46',NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `tournaments` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `user_rewards`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_rewards` (
  `user_reward_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `reward_id` int NOT NULL,
  `earned_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_displayed` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`user_reward_id`),
  UNIQUE KEY `user_id` (`user_id`,`reward_id`),
  KEY `reward_id` (`reward_id`),
  CONSTRAINT `user_rewards_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `user_rewards_ibfk_2` FOREIGN KEY (`reward_id`) REFERENCES `rewards` (`reward_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `user_rewards` WRITE;
/*!40000 ALTER TABLE `user_rewards` DISABLE KEYS */;
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
  `total_points` int NOT NULL DEFAULT '0',
  `notification_prefs` json DEFAULT NULL,
  `profile_edit_log` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`),
  KEY `faculty_id` (`faculty_id`),
  KEY `department_id` (`department_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`faculty_id`) REFERENCES `faculties` (`faculty_id`),
  CONSTRAINT `users_ibfk_2` FOREIGN KEY (`department_id`) REFERENCES `departments` (`department_id`)
) ENGINE=InnoDB AUTO_INCREMENT=9261 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (9001,'สมชาย ใจดี','somchai@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-05-01','staff',1,1,3,'avatars/9001.jpg',NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-17 13:01:25',NULL),(9002,'สมหญิง รักเรียน','somying@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2005-02-14','student',2,6,2,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-17 13:01:25',NULL),(9003,'มานะ ไร้ทีม','mana@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2003-11-30','student',8,30,4,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-17 13:01:25',NULL),(9051,'วีระชัย นกหวีดทอง','referee3@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','1990-04-12','staff',1,1,NULL,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9052,'อรทัย กฎกติกา','referee4@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','1992-08-03','staff',2,6,NULL,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9053,'สมเกียรติ ภายนอก','referee.ext@outside.org','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','1988-01-20','external',NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9101,'ผู้เล่น เอหนึ่ง','playerA1@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-01-01','student',1,1,2,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-17 15:29:46',NULL),(9102,'ผู้เล่น เอสอง','playerA2@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-02-01','student',1,1,2,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-17 15:29:46',NULL),(9103,'ผู้เล่น บีหนึ่ง','playerB1@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-03-01','student',1,1,3,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-17 15:29:46',NULL),(9104,'ผู้เล่น บีสอง','playerB2@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-04-01','student',1,1,3,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-17 15:29:46',NULL),(9105,'QA C1','playerC1@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-01-01','student',1,1,2,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-17 15:41:35',NULL),(9106,'QA C2','playerC2@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-01-01','student',1,1,2,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-17 15:41:35',NULL),(9107,'QA D1','playerD1@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-01-01','student',1,1,2,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-17 15:41:35',NULL),(9108,'QA D2','playerD2@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-01-01','student',1,1,2,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-17 15:41:35',NULL),(9201,'ปกรณ์ ใจดี','p9201@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2005-01-01','student',1,1,1,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9202,'ธนวัฒน์ วัฒนกุล','p9202@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-02-02','student',1,2,2,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9203,'ศุภโชค มณีรัตน์','p9203@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2003-03-03','student',1,3,3,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9204,'กิตติพงศ์ รุ่งเรือง','p9204@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2002-04-04','student',1,4,4,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9205,'อนุชา ธารารักษ์','p9205@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2005-05-05','student',1,5,1,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9206,'ณัฐพล ทองคำ','p9206@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-06-06','student',1,1,2,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9207,'วรินทร ปัญญาดี','p9207@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2003-07-07','student',1,2,3,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9208,'ชัยวัฒน์ พงษ์ไพบูลย์','p9208@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2002-08-08','student',1,3,4,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9209,'พีรพล จันทร์เพ็ญ','p9209@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2005-09-09','student',1,4,1,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9210,'สหรัฐ บุญมา','p9210@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-10-10','student',1,5,2,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9211,'ภูมิพัฒน์ เกษมสุข','p9211@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2003-11-11','student',1,1,3,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9212,'รัชชานนท์ ศรีสุข','p9212@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2002-12-12','student',1,2,4,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9213,'กันตพงศ์ อินทรีย์','p9213@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2006-01-01','student',2,6,1,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9214,'ธีรเดช แสงทอง','p9214@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2005-02-02','student',2,7,2,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9215,'อัครเดช สุวรรณโชติ','p9215@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-03-03','student',2,8,3,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9216,'วชิรวิทย์ ใจดี','p9216@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2003-04-04','student',2,9,4,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9217,'นภัสกร วัฒนกุล','p9217@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2006-05-05','student',2,10,1,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9218,'ปิยะพงษ์ มณีรัตน์','p9218@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2005-06-06','student',2,6,2,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9219,'จิรายุ รุ่งเรือง','p9219@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-07-07','student',2,7,3,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9220,'ศิวกร ธารารักษ์','p9220@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2003-08-08','student',2,8,4,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9221,'ปกรณ์ ทองคำ','p9221@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2006-09-09','student',2,9,1,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9222,'ธนวัฒน์ ปัญญาดี','p9222@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2005-10-10','student',2,10,2,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9223,'ศุภโชค พงษ์ไพบูลย์','p9223@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-11-11','student',2,6,3,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9224,'กิตติพงศ์ จันทร์เพ็ญ','p9224@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2003-12-12','student',2,7,4,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9225,'ณัฐธิดา ใจดี','p9225@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2005-01-01','student',1,1,1,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9226,'พิมพ์ชนก วัฒนกุล','p9226@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2004-02-02','student',1,2,2,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9227,'กัญญาณัฐ มณีรัตน์','p9227@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2003-03-03','student',1,3,3,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9228,'ศิรประภา รุ่งเรือง','p9228@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2002-04-04','student',1,4,4,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9229,'ชนิกานต์ ธารารักษ์','p9229@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2005-05-05','student',1,5,1,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9230,'วรรณิดา ทองคำ','p9230@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2004-06-06','student',1,1,2,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9231,'ธัญชนก ปัญญาดี','p9231@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2003-07-07','student',1,2,3,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9232,'อริสรา พงษ์ไพบูลย์','p9232@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2002-08-08','student',2,9,4,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9233,'อนุชา ธารารักษ์','p9233@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2008-05-14','student',3,11,1,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9234,'วรรณิดา ทองคำ','p9234@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2008-09-30','student',3,12,1,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9235,'วรินทร ปัญญาดี','p9235@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2001-02-11','student',3,13,4,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9236,'อริสรา พงษ์ไพบูลย์','p9236@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2000-11-05','student',3,11,4,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9237,'พีรพล จันทร์เพ็ญ','p9237@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-06-18','student',3,12,3,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9238,'สุพิชญา บุญมา','p9238@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2003-03-22','student',3,13,4,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9239,'ภูมิพัฒน์ เกษมสุข','p9239@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2006-07-09','student',3,11,2,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9240,'รัชชานนท์ ศรีสุข','p9240@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2005-12-01','student',3,12,3,NULL,NULL,NULL,1,'ทดสอบบัญชีที่ถูกระงับ',0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9241,'กิตติพงศ์ รุ่งเรือง','p9241@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-01-01','student',1,2,1,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9242,'อนุชา ธารารักษ์','p9242@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2005-02-02','student',1,3,2,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9243,'ณัฐพล ทองคำ','p9243@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2006-03-03','student',1,4,3,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9244,'วรินทร ปัญญาดี','p9244@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2007-04-04','student',1,5,4,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9245,'ชัยวัฒน์ พงษ์ไพบูลย์','p9245@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-05-05','student',1,1,1,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9246,'พีรพล จันทร์เพ็ญ','p9246@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2005-06-06','student',1,2,2,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9247,'สหรัฐ บุญมา','p9247@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2006-07-07','student',1,3,3,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9248,'ภูมิพัฒน์ เกษมสุข','p9248@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2007-08-08','student',1,4,4,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9249,'รัชชานนท์ ศรีสุข','p9249@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-09-09','student',1,5,1,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9250,'กันตพงศ์ อินทรีย์','p9250@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2005-10-10','student',1,1,2,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9251,'ธีรเดช แสงทอง','p9251@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2006-11-11','student',1,2,3,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9252,'อัครเดช สุวรรณโชติ','p9252@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2007-12-12','student',1,3,4,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9253,'ศิรประภา ใจดี','p9253@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2004-01-13','student',1,4,1,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9254,'ชนิกานต์ วัฒนกุล','p9254@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2005-02-14','student',1,5,2,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9255,'วรรณิดา มณีรัตน์','p9255@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2006-03-15','student',2,6,3,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9256,'ธัญชนก รุ่งเรือง','p9256@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2007-04-16','student',2,7,4,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9257,'อริสรา ธารารักษ์','p9257@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2004-05-17','student',1,3,1,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9258,'ปรียานุช ทองคำ','p9258@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2005-06-18','student',2,8,2,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9259,'สุพิชญา ปัญญาดี','p9259@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2006-07-19','student',2,10,3,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL),(9260,'เบญญาภา พงษ์ไพบูลย์','p9260@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2007-08-20','student',2,6,4,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

-- ---------------------------------------------------------------------
-- QA baseline consistency fixes (schema/business rules as of 2026-09-21)
-- ---------------------------------------------------------------------
-- Migration 018 was added after these applications had already been created,
-- so the historical dump had no application_players rows. Rebuild the locked
-- competition rosters from each application's recorded hard-filter snapshot.
INSERT INTO `application_players` (`application_player_id`,`tournament_application_id`,`tournament_id`,`user_id`,`created_at`) VALUES
(1,1,2,9002,'2026-09-17 14:04:01'),(2,2,6,9002,'2026-09-17 14:11:32'),(3,3,10,9101,'2026-09-17 15:30:54'),(4,3,10,9102,'2026-09-17 15:30:54'),(5,4,10,9103,'2026-09-17 15:30:54'),(6,4,10,9104,'2026-09-17 15:30:54'),(7,5,12,9101,'2026-09-17 15:36:49'),(8,5,12,9102,'2026-09-17 15:36:49'),(9,6,12,9103,'2026-09-17 15:36:49'),(10,6,12,9104,'2026-09-17 15:36:49'),(11,7,13,9101,'2026-09-17 15:42:30'),(12,7,13,9102,'2026-09-17 15:42:30'),(13,8,13,9103,'2026-09-17 15:42:31'),(14,8,13,9104,'2026-09-17 15:42:31'),(15,9,13,9105,'2026-09-17 15:42:31'),(16,9,13,9106,'2026-09-17 15:42:31'),(17,10,13,9107,'2026-09-17 15:42:32'),(18,10,13,9108,'2026-09-17 15:42:32'),
(19,11,14,9213,'2026-09-18 03:29:32'),(20,11,14,9214,'2026-09-18 03:29:32'),(21,11,14,9215,'2026-09-18 03:29:32'),(22,11,14,9216,'2026-09-18 03:29:32'),(23,11,14,9217,'2026-09-18 03:29:32'),(24,11,14,9218,'2026-09-18 03:29:32'),(25,11,14,9219,'2026-09-18 03:29:32'),(26,11,14,9220,'2026-09-18 03:29:32'),(27,11,14,9221,'2026-09-18 03:29:32'),(28,11,14,9222,'2026-09-18 03:29:32'),(29,11,14,9223,'2026-09-18 03:29:32'),(30,11,14,9224,'2026-09-18 03:29:32'),
(31,18,16,9002,'2026-09-18 04:27:48'),(32,18,16,9255,'2026-09-18 04:27:48'),(33,18,16,9256,'2026-09-18 04:27:48'),(34,18,16,9258,'2026-09-18 04:27:48'),(35,18,16,9259,'2026-09-18 04:27:48'),(36,18,16,9260,'2026-09-18 04:27:48'),
(37,19,19,9101,'2026-09-18 04:39:20'),(38,19,19,9102,'2026-09-18 04:39:20'),(39,20,19,9103,'2026-09-18 04:39:20'),(40,20,19,9104,'2026-09-18 04:39:20'),(41,21,19,9105,'2026-09-18 04:39:20'),(42,21,19,9106,'2026-09-18 04:39:20'),(43,22,19,9107,'2026-09-18 04:39:20'),(44,22,19,9108,'2026-09-18 04:39:20'),
(45,23,20,9225,'2026-09-18 04:39:21'),(46,23,20,9226,'2026-09-18 04:39:21'),(47,23,20,9227,'2026-09-18 04:39:21'),(48,23,20,9228,'2026-09-18 04:39:21'),(49,23,20,9229,'2026-09-18 04:39:21'),(50,23,20,9230,'2026-09-18 04:39:21'),(51,23,20,9231,'2026-09-18 04:39:21'),(52,24,20,9213,'2026-09-18 04:39:21'),(53,24,20,9214,'2026-09-18 04:39:21'),(54,24,20,9215,'2026-09-18 04:39:21'),(55,24,20,9216,'2026-09-18 04:39:21'),(56,24,20,9217,'2026-09-18 04:39:21'),(57,24,20,9218,'2026-09-18 04:39:21'),(58,24,20,9219,'2026-09-18 04:39:21'),
(59,25,17,9207,'2026-09-18 07:50:31'),(60,25,17,9208,'2026-09-18 07:50:31'),(61,25,17,9209,'2026-09-18 07:50:31'),(62,25,17,9210,'2026-09-18 07:50:31'),(63,25,17,9211,'2026-09-18 07:50:31'),(64,25,17,9212,'2026-09-18 07:50:31'),(65,26,17,9219,'2026-09-18 07:50:31'),(66,26,17,9220,'2026-09-18 07:50:31'),(67,26,17,9221,'2026-09-18 07:50:31'),(68,26,17,9222,'2026-09-18 07:50:31'),(69,26,17,9223,'2026-09-18 07:50:31'),(70,26,17,9224,'2026-09-18 07:50:31'),
(71,27,18,9201,'2026-09-18 08:22:46'),(72,27,18,9202,'2026-09-18 08:22:46'),(73,27,18,9203,'2026-09-18 08:22:46'),(74,27,18,9204,'2026-09-18 08:22:46'),(75,27,18,9205,'2026-09-18 08:22:46'),(76,28,18,9213,'2026-09-18 08:22:46'),(77,28,18,9214,'2026-09-18 08:22:46'),(78,28,18,9215,'2026-09-18 08:22:46'),(79,28,18,9216,'2026-09-18 08:22:46'),(80,28,18,9217,'2026-09-18 08:22:46'),
(81,29,14,9001,'2026-09-18 13:56:17'),(82,29,14,9241,'2026-09-18 13:56:17'),(83,29,14,9242,'2026-09-18 13:56:17'),(84,29,14,9243,'2026-09-18 13:56:17'),(85,29,14,9244,'2026-09-18 13:56:17'),(86,29,14,9245,'2026-09-18 13:56:17'),(87,29,14,9246,'2026-09-18 13:56:17'),(88,29,14,9247,'2026-09-18 13:56:17'),(89,29,14,9248,'2026-09-18 13:56:17'),(90,29,14,9249,'2026-09-18 13:56:17'),(91,29,14,9250,'2026-09-18 13:56:17'),(92,29,14,9251,'2026-09-18 13:56:17'),
(93,30,21,9101,'2026-09-18 14:25:16'),(94,30,21,9102,'2026-09-18 14:25:16'),(95,31,21,9103,'2026-09-18 14:25:16'),(96,31,21,9104,'2026-09-18 14:25:16'),(97,32,22,9213,'2026-09-18 14:25:17'),(98,32,22,9214,'2026-09-18 14:25:17'),(99,32,22,9215,'2026-09-18 14:25:17'),(100,32,22,9216,'2026-09-18 14:25:17'),(101,32,22,9217,'2026-09-18 14:25:17'),(102,32,22,9218,'2026-09-18 14:25:17'),
(103,33,23,9201,'2026-09-18 14:26:59'),(104,33,23,9202,'2026-09-18 14:26:59'),(105,33,23,9203,'2026-09-18 14:26:59'),(106,33,23,9204,'2026-09-18 14:26:59'),(107,33,23,9205,'2026-09-18 14:26:59'),(108,33,23,9206,'2026-09-18 14:26:59'),(109,34,23,9213,'2026-09-18 14:26:59'),(110,34,23,9214,'2026-09-18 14:26:59'),(111,34,23,9215,'2026-09-18 14:26:59'),(112,34,23,9216,'2026-09-18 14:26:59'),(113,34,23,9217,'2026-09-18 14:26:59'),(114,34,23,9218,'2026-09-18 14:26:59'),(115,35,22,9201,'2026-09-18 15:57:25'),(116,35,22,9202,'2026-09-18 15:57:25'),(117,35,22,9203,'2026-09-18 15:57:25'),(118,35,22,9204,'2026-09-18 15:57:25'),(119,35,22,9205,'2026-09-18 15:57:25'),(120,35,22,9206,'2026-09-18 15:57:25'),
-- Applications 1 and 2 predate squad-size validation; use the same eligible
-- five-player pool later submitted by this team. Player 9255 left the team,
-- so application 18 keeps the five members who remain in its locked squad.
(121,1,2,9256,'2026-09-17 14:04:01'),(122,1,2,9258,'2026-09-17 14:04:01'),(123,1,2,9259,'2026-09-17 14:04:01'),(124,1,2,9260,'2026-09-17 14:04:01'),
(125,2,6,9256,'2026-09-17 14:11:32'),(126,2,6,9258,'2026-09-17 14:11:32'),(127,2,6,9259,'2026-09-17 14:11:32'),(128,2,6,9260,'2026-09-17 14:11:32');
DELETE FROM `application_players` WHERE `application_player_id` = 32;
UPDATE `tournament_applications`
SET `hard_filter_details` = JSON_ARRAY(
  JSON_OBJECT('passed', TRUE, 'userId', 9002, 'fullName', 'สมหญิง รักเรียน'),
  JSON_OBJECT('passed', TRUE, 'userId', 9256, 'fullName', 'ธัญชนก รุ่งเรือง'),
  JSON_OBJECT('passed', TRUE, 'userId', 9258, 'fullName', 'ปรียานุช ทองคำ'),
  JSON_OBJECT('passed', TRUE, 'userId', 9259, 'fullName', 'สุพิชญา ปัญญาดี'),
  JSON_OBJECT('passed', TRUE, 'userId', 9260, 'fullName', 'เบญญาภา พงษ์ไพบูลย์')
)
WHERE `tournament_application_id` IN (1, 2);
UPDATE `tournament_applications`
SET `hard_filter_details` = JSON_REMOVE(`hard_filter_details`, '$[1]')
WHERE `tournament_application_id` = 18;
ALTER TABLE `application_players` AUTO_INCREMENT = 129;

-- On-site check-in is QR (or a referee-recorded manual exception), never a
-- photo upload. Clear document-review fields from the old invalid snapshots.
UPDATE `match_checkins` AS `mc`
JOIN `matches` AS `m` ON `m`.`match_id` = `mc`.`match_id`
SET `mc`.`method` = 'qr_onsite',
    `mc`.`match_checkin_status` = 'success',
    `mc`.`rejection_reason` = NULL,
    `mc`.`note` = NULL,
    `mc`.`document_type` = NULL,
    `mc`.`document_s3_key` = NULL,
    `mc`.`verified_by_referee_id` = NULL,
    `mc`.`verified_at` = NULL
WHERE `m`.`mode` = 'onsite' AND `mc`.`method` = 'photo_online';

-- Completed/in-progress matches must have at least sport_types.min_members
-- successful check-ins on both sides. Match 12 is the submitted-result QA case.
INSERT INTO `match_checkins`
(`match_checkin_id`,`match_id`,`user_id`,`method`,`match_checkin_status`,`rejection_reason`,`note`,`document_type`,`document_s3_key`,`verified_by_referee_id`,`checked_in_at`,`verified_at`) VALUES
(21,3,9108,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-17 15:44:43',NULL),(22,3,9102,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-17 15:44:43',NULL),
(23,4,9106,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-17 15:44:44',NULL),(24,4,9104,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-17 15:44:44',NULL),
(25,5,9102,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 02:24:07',NULL),(26,5,9106,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 02:24:07',NULL),
(27,6,9106,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 04:39:20',NULL),(28,6,9104,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 04:39:20',NULL),
(29,9,9226,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 04:39:21',NULL),(30,9,9227,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 04:39:21',NULL),(31,9,9228,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 04:39:21',NULL),(32,9,9229,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 04:39:21',NULL),
(33,9,9214,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 04:39:21',NULL),(34,9,9215,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 04:39:21',NULL),(35,9,9216,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 04:39:21',NULL),(36,9,9217,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 04:39:21',NULL),
(37,10,9208,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 07:50:31',NULL),(38,10,9209,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 07:50:31',NULL),(39,10,9210,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 07:50:31',NULL),(40,10,9211,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 07:50:31',NULL),
(41,10,9220,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 07:50:31',NULL),(42,10,9221,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 07:50:31',NULL),(43,10,9222,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 07:50:31',NULL),(44,10,9223,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 07:50:31',NULL),
(45,12,9104,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 14:25:16',NULL),(46,12,9101,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 14:25:16',NULL),(47,12,9102,'qr_onsite','success',NULL,NULL,NULL,NULL,NULL,'2026-09-18 14:25:16',NULL),
-- Keep photo review states on the actual online RoV match.
(48,11,9201,'photo_online','success',NULL,NULL,'student_id','checkins/qa-online-approved.jpg',9002,'2026-09-18 08:22:46','2026-09-18 08:23:10'),
(49,11,9213,'photo_online','pending',NULL,NULL,'student_id','checkins/qa-online-pending.jpg',NULL,'2026-09-18 08:22:46',NULL),
(50,11,9214,'photo_online','rejected','รูปบัตรไม่ชัดเจน',NULL,'national_id','checkins/qa-online-rejected.jpg',9002,'2026-09-18 08:22:46','2026-09-18 08:23:20');
ALTER TABLE `match_checkins` AUTO_INCREMENT = 51;

UPDATE `matches`
SET `match_status` = 'in_progress', `updated_at` = '2026-09-18 16:37:13'
WHERE `match_id` = 12;

UPDATE `match_results`
SET `score_data` = JSON_OBJECT('9008', 2, '9009', 1)
WHERE `match_id` = 12;

/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

