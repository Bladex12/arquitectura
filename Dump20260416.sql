-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
--
-- Host: localhost    Database: mision_emprende2
-- ------------------------------------------------------
-- Server version	8.0.45

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
-- Table structure for table `activities`
--

DROP TABLE IF EXISTS `activities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `activities` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` longtext COLLATE utf8mb4_unicode_ci,
  `order_number` int NOT NULL,
  `timer_duration` int DEFAULT NULL,
  `config_data` json DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `activity_type_id` bigint NOT NULL,
  `stage_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `activities_stage_id_order_number_55d59c0c_uniq` (`stage_id`,`order_number`),
  KEY `activities_stage_i_7425c6_idx` (`stage_id`),
  KEY `activities_activit_a33aa7_idx` (`activity_type_id`),
  KEY `activities_stage_i_f1817d_idx` (`stage_id`,`order_number`),
  CONSTRAINT `activities_activity_type_id_4b2a4435_fk_activity_types_id` FOREIGN KEY (`activity_type_id`) REFERENCES `activity_types` (`id`),
  CONSTRAINT `activities_stage_id_0c437802_fk_stages_id` FOREIGN KEY (`stage_id`) REFERENCES `stages` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `activities`
--

LOCK TABLES `activities` WRITE;
/*!40000 ALTER TABLE `activities` DISABLE KEYS */;
INSERT INTO `activities` VALUES (1,'Instructivo','Instructivo del juego - Instrucciones para los estudiantes',2,NULL,NULL,1,'2026-04-14 14:15:15.133403','2026-04-14 14:15:15.133428',1,1),(2,'Personalización','Los equipos personalizan su nombre e indican si se conocen',1,NULL,NULL,1,'2026-04-14 23:25:49.631667','2026-04-14 23:25:49.631694',2,1),(3,'Seleccionar Tema','Elige un tema de interés relacionado con tu facultad',1,160,NULL,1,'2025-11-04 23:19:09.746000','2025-11-07 14:28:30.822001',3,2),(4,'Ver el Desafío','Lee y analiza el desafío asociado a tu tema',2,160,NULL,1,'2025-11-04 23:19:09.755000','2025-11-07 14:28:43.478728',3,2),(5,'Bubble Map','Crea un mapa mental con ideas y conceptos relacionados al desafío',3,480,NULL,1,'2025-11-04 23:19:09.756000','2025-11-07 14:28:58.964030',3,2),(6,'Subida de Prototipo Lego','Los equipos construyen físicamente un prototipo con legos y suben una foto del resultado',1,600,NULL,1,'2025-11-05 02:28:51.637000','2025-11-07 14:29:11.498568',4,3),(7,'Formulario de Pitch','Los equipos completan un formulario estructurado para crear el pitch: intro-problema (etapa 2), solución (etapa 3) y cierre',1,360,NULL,1,'2025-11-05 05:28:59.108000','2025-11-07 14:29:29.883250',5,4),(8,'Presentación del Pitch','Los equipos presentan su pitch siguiendo un orden de presentación. Después de cada presentación, los otros equipos pueden evaluar.',2,800,NULL,1,'2025-11-05 05:28:59.120000','2025-11-07 14:29:46.273248',6,4);
/*!40000 ALTER TABLE `activities` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `activity_duration_metrics`
--

DROP TABLE IF EXISTS `activity_duration_metrics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `activity_duration_metrics` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `total_completions` int NOT NULL,
  `total_duration_seconds` double NOT NULL,
  `avg_duration_seconds` double NOT NULL,
  `min_duration_seconds` double DEFAULT NULL,
  `max_duration_seconds` double DEFAULT NULL,
  `last_updated` datetime(6) NOT NULL,
  `activity_id` bigint NOT NULL,
  `stage_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `activity_duration_metrics_activity_id_stage_id_7574a410_uniq` (`activity_id`,`stage_id`),
  KEY `activity_du_activit_444351_idx` (`activity_id`),
  KEY `activity_du_stage_i_98cff4_idx` (`stage_id`),
  CONSTRAINT `activity_duration_metrics_activity_id_7dcea142_fk_activities_id` FOREIGN KEY (`activity_id`) REFERENCES `activities` (`id`),
  CONSTRAINT `activity_duration_metrics_stage_id_6cb769df_fk_stages_id` FOREIGN KEY (`stage_id`) REFERENCES `stages` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `activity_duration_metrics`
--

LOCK TABLES `activity_duration_metrics` WRITE;
/*!40000 ALTER TABLE `activity_duration_metrics` DISABLE KEYS */;
INSERT INTO `activity_duration_metrics` VALUES (1,12,535047.056439,44587.25470324999,20.400837,89143.403845,'2026-04-16 01:57:25.311800',2,1),(2,4,19.748662,4.9371655,4.115492,5.764738,'2026-04-16 01:57:29.461460',1,1),(3,2,24.030006,12.015003,12.009422,12.020584,'2026-04-16 03:33:10.825110',3,2),(4,2,13.975269,6.9876345,6.976938,6.998331,'2026-04-16 03:33:17.842598',5,2),(5,2,11.819142,5.909571,5.89826,5.920882,'2026-04-16 03:33:28.964616',6,3),(6,2,9.710794,4.855397,4.846623,4.864171,'2026-04-16 03:33:36.794794',7,4),(7,2,31.040146,15.520073,15.50914,15.531006,'2026-04-16 03:33:52.344226',8,4);
/*!40000 ALTER TABLE `activity_duration_metrics` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `activity_types`
--

DROP TABLE IF EXISTS `activity_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `activity_types` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` longtext COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `activity_ty_code_0cb432_idx` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `activity_types`
--

LOCK TABLES `activity_types` WRITE;
/*!40000 ALTER TABLE `activity_types` DISABLE KEYS */;
INSERT INTO `activity_types` VALUES (1,'instructivo','Instructivo','Instructivo del juego',1,'2026-04-14 14:15:15.110532','2026-04-14 14:15:15.110589'),(2,'personalizacion','Personalización','Actividad de personalización de equipos',1,'2026-04-14 23:25:49.623234','2026-04-14 23:25:49.623253'),(3,'','Interactiva','Actividad interactiva',1,'2025-11-04 23:19:09.732000','2025-11-04 23:19:09.732000'),(4,'prototipo','Subida de Prototipo','Actividad para subir imagen del prototipo físico construido',1,'2025-11-05 02:28:51.612000','2025-11-05 02:28:51.612000'),(5,'formulario_pitch','Formulario de Pitch','Actividad para completar el formulario del pitch con intro-problema, solución y cierre',1,'2025-11-05 05:28:59.078000','2025-11-05 05:28:59.078000'),(6,'presentacion_pitch','Presentación del Pitch','Actividad para presentar el pitch y evaluar a otros equipos',1,'2025-11-05 05:28:59.089000','2025-11-05 05:28:59.089000'),(8,'video_institucional','Video Institucional','Video institucional de la universidad',1,'2025-12-01 21:30:26.175703','2025-12-01 21:30:26.175703');
/*!40000 ALTER TABLE `activity_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `administrators`
--

DROP TABLE IF EXISTS `administrators`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `administrators` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `is_super_admin` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `user_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  KEY `administrat_user_id_20df6f_idx` (`user_id`),
  CONSTRAINT `administrators_user_id_5ff75f06_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `administrators`
--

LOCK TABLES `administrators` WRITE;
/*!40000 ALTER TABLE `administrators` DISABLE KEYS */;
INSERT INTO `administrators` VALUES (1,0,'2026-04-10 17:21:24.467136','2026-04-10 17:21:24.467184',1);
/*!40000 ALTER TABLE `administrators` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `anagram_words`
--

DROP TABLE IF EXISTS `anagram_words`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `anagram_words` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `word` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `scrambled_word` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `anagram_wor_is_acti_e5207d_idx` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `anagram_words`
--

LOCK TABLES `anagram_words` WRITE;
/*!40000 ALTER TABLE `anagram_words` DISABLE KEYS */;
INSERT INTO `anagram_words` VALUES (1,'EMPRENDIMIENTO','MEIEDNTREINMOP',1,'2025-11-26 14:17:12.882500','2025-11-26 14:17:12.892739'),(2,'INNOVACION','CNIONIAVON',1,'2025-11-26 14:17:12.901740','2025-11-26 14:17:12.906922'),(3,'CREATIVIDAD','DCDARIVTIEA',1,'2025-11-26 14:17:12.913096','2025-11-26 14:17:12.917096'),(4,'LIDERAZGO','ODZIGREAL',1,'2025-11-26 14:17:12.922281','2025-11-26 14:17:12.926277'),(5,'EQUIPO','PIQOUE',1,'2025-11-26 14:17:12.930279','2025-11-26 14:17:12.934521'),(6,'NEGOCIO','GCONEIO',1,'2025-11-26 14:17:12.938525','2025-11-26 14:17:12.942684'),(7,'CLIENTE','NILTECE',1,'2025-11-26 14:17:12.947682','2025-11-26 14:17:12.951685'),(8,'PRODUCTO','TUOCROPD',1,'2025-11-26 14:17:12.957865','2025-11-26 14:17:12.961865'),(9,'VENTA','TENVA',1,'2025-11-26 14:17:12.966099','2025-11-26 14:17:12.970099'),(10,'MARKETING','EGRMIAKNT',1,'2025-11-26 14:17:12.974290','2025-11-26 14:17:12.978290'),(11,'ESTRATEGIA','ATIEEAGSRT',1,'2025-11-26 14:17:12.983454','2025-11-26 14:17:12.987456'),(12,'PLANIFICACION','FNNPOICCAILAI',1,'2025-11-26 14:17:12.992455','2025-11-26 14:17:12.996459'),(13,'OBJETIVO','VIOBEJTO',1,'2025-11-26 14:17:13.002454','2025-11-26 14:17:13.006110'),(14,'META','ETAM',1,'2025-11-26 14:17:13.012458','2025-11-26 14:17:13.016457'),(15,'RESULTADO','TRUDLESOA',1,'2025-11-26 14:17:13.021455','2025-11-26 14:17:13.024717'),(16,'COMPETENCIA','TIEAEMOCCNP',1,'2025-11-26 14:17:13.029717','2025-11-26 14:17:13.033311'),(17,'MERCADO','DEROMAC',1,'2025-11-26 14:17:13.038304','2025-11-26 14:17:13.042486'),(18,'OPORTUNIDAD','DRNOIPOTUDA',1,'2025-11-26 14:17:13.048486','2025-11-26 14:17:13.053688'),(19,'RIESGO','RSOEIG',1,'2025-11-26 14:17:13.058687','2025-11-26 14:17:13.063091'),(20,'EXITO','IETXO',1,'2025-11-26 14:17:13.069093','2025-11-26 14:17:13.073520'),(21,'FRACASO','FASCARO',1,'2025-11-26 14:17:13.078518','2025-11-26 14:17:13.082521'),(22,'APRENDIZAJE','RZANPEEJIDA',1,'2025-11-26 14:17:13.087534','2025-11-26 14:17:13.091968'),(23,'EXPERIENCIA','REAEXINCIPE',1,'2025-11-26 14:17:13.096968','2025-11-26 14:17:13.101971'),(24,'CONOCIMIENTO','NMCIOIONEOTC',1,'2025-11-26 14:17:13.106967','2025-11-26 14:17:13.110966'),(25,'HABILIDAD','AAILDHIDB',1,'2025-11-26 14:17:13.115172','2025-11-26 14:17:13.120172'),(26,'COMUNICACION','OMUICCNAINOC',1,'2025-11-26 14:17:13.124384','2025-11-26 14:17:13.128387'),(27,'COLABORACION','BROAAIOLCNCO',1,'2025-11-26 14:17:13.132791','2025-11-26 14:17:13.136785'),(28,'TRABAJO','JARTBAO',1,'2025-11-26 14:17:13.141785','2025-11-26 14:17:13.146136'),(29,'PROYECTO','CEORTYOP',1,'2025-11-26 14:17:13.150134','2025-11-26 14:17:13.154284'),(30,'SOLUCION','NLOUICSO',1,'2025-11-26 14:17:13.158285','2025-11-26 14:17:13.162432'),(31,'PROBLEMA','AMORLPBE',1,'2025-11-26 14:17:13.166441','2025-11-26 14:17:13.170443'),(32,'DESAFIO','DSEIOAF',1,'2025-11-26 14:17:13.174766','2025-11-26 14:17:13.178766'),(33,'RETO','REOT',1,'2025-11-26 14:17:13.183295','2025-11-26 14:17:13.187296'),(34,'MOTIVACION','TIIOOCMNAV',1,'2025-11-26 14:17:13.192457','2025-11-26 14:17:13.197459'),(35,'PASION','ISNAOP',1,'2025-11-26 14:17:13.201462','2025-11-26 14:17:13.206653'),(36,'VISION','NSIOVI',1,'2025-11-26 14:17:13.210653','2025-11-26 14:17:13.214651'),(37,'MISION','IISOMN',1,'2025-11-26 14:17:13.219654','2025-11-26 14:17:13.223651'),(38,'VALORES','ERSOLAV',1,'2025-11-26 14:17:13.228652','2025-11-26 14:17:13.232654'),(39,'CULTURA','LARCTUU',1,'2025-11-26 14:17:13.237654','2025-11-26 14:17:13.241652'),(40,'ORGANIZACION','ONCIANZAORGI',1,'2025-11-26 14:17:13.246653','2025-11-26 14:17:13.250654'),(41,'ADMINISTRACION','AMIOTNDNACIISR',1,'2025-11-26 14:17:13.255653','2025-11-26 14:17:13.258656'),(42,'GESTION','TNEISGO',1,'2025-11-26 14:17:13.263654','2025-11-26 14:17:13.267652'),(43,'DIRECCION','CRDCEOINI',1,'2025-11-26 14:17:13.272652','2025-11-26 14:17:13.276656'),(44,'SUPERVISION','SSINURIPVEO',1,'2025-11-26 14:17:13.281654','2025-11-26 14:17:13.285657'),(45,'COORDINACION','OODOINCIARNC',1,'2025-11-26 14:17:13.290653','2025-11-26 14:17:13.294651'),(46,'EJECUCION','UCNJEIOCE',1,'2025-11-26 14:17:13.299657','2025-11-26 14:17:13.303653'),(47,'EVALUACION','ACVNILAEUO',1,'2025-11-26 14:17:13.307654','2025-11-26 14:17:13.311654'),(48,'MEJORA','RMAOJE',1,'2025-11-26 14:17:13.316652','2025-11-26 14:17:13.319657'),(49,'OPTIMIZACION','ONCZPTIOIMAI',1,'2025-11-26 14:17:13.324651','2025-11-26 14:17:13.328654'),(50,'CAMALEON','OECMALNA',1,'2025-11-29 18:47:13.466192','2025-11-29 18:47:13.466192');
/*!40000 ALTER TABLE `anagram_words` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_group`
--

DROP TABLE IF EXISTS `auth_group`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_group` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_group`
--

LOCK TABLES `auth_group` WRITE;
/*!40000 ALTER TABLE `auth_group` DISABLE KEYS */;
/*!40000 ALTER TABLE `auth_group` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_group_permissions`
--

DROP TABLE IF EXISTS `auth_group_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_group_permissions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `group_id` int NOT NULL,
  `permission_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_group_permissions_group_id_permission_id_0cd325b0_uniq` (`group_id`,`permission_id`),
  KEY `auth_group_permissio_permission_id_84c5c92e_fk_auth_perm` (`permission_id`),
  CONSTRAINT `auth_group_permissio_permission_id_84c5c92e_fk_auth_perm` FOREIGN KEY (`permission_id`) REFERENCES `auth_permission` (`id`),
  CONSTRAINT `auth_group_permissions_group_id_b120cbf9_fk_auth_group_id` FOREIGN KEY (`group_id`) REFERENCES `auth_group` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_group_permissions`
--

LOCK TABLES `auth_group_permissions` WRITE;
/*!40000 ALTER TABLE `auth_group_permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `auth_group_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_permission`
--

DROP TABLE IF EXISTS `auth_permission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_permission` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content_type_id` int NOT NULL,
  `codename` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_permission_content_type_id_codename_01ab375a_uniq` (`content_type_id`,`codename`),
  CONSTRAINT `auth_permission_content_type_id_2f476e4b_fk_django_co` FOREIGN KEY (`content_type_id`) REFERENCES `django_content_type` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=189 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_permission`
--

LOCK TABLES `auth_permission` WRITE;
/*!40000 ALTER TABLE `auth_permission` DISABLE KEYS */;
INSERT INTO `auth_permission` VALUES (1,'Can add log entry',1,'add_logentry'),(2,'Can change log entry',1,'change_logentry'),(3,'Can delete log entry',1,'delete_logentry'),(4,'Can view log entry',1,'view_logentry'),(5,'Can add permission',2,'add_permission'),(6,'Can change permission',2,'change_permission'),(7,'Can delete permission',2,'delete_permission'),(8,'Can view permission',2,'view_permission'),(9,'Can add group',3,'add_group'),(10,'Can change group',3,'change_group'),(11,'Can delete group',3,'delete_group'),(12,'Can view group',3,'view_group'),(13,'Can add user',4,'add_user'),(14,'Can change user',4,'change_user'),(15,'Can delete user',4,'delete_user'),(16,'Can view user',4,'view_user'),(17,'Can add content type',5,'add_contenttype'),(18,'Can change content type',5,'change_contenttype'),(19,'Can delete content type',5,'delete_contenttype'),(20,'Can view content type',5,'view_contenttype'),(21,'Can add session',6,'add_session'),(22,'Can change session',6,'change_session'),(23,'Can delete session',6,'delete_session'),(24,'Can view session',6,'view_session'),(25,'Can add access attempt',7,'add_accessattempt'),(26,'Can change access attempt',7,'change_accessattempt'),(27,'Can delete access attempt',7,'delete_accessattempt'),(28,'Can view access attempt',7,'view_accessattempt'),(29,'Can add access log',8,'add_accesslog'),(30,'Can change access log',8,'change_accesslog'),(31,'Can delete access log',8,'delete_accesslog'),(32,'Can view access log',8,'view_accesslog'),(33,'Can add access failure',9,'add_accessfailurelog'),(34,'Can change access failure',9,'change_accessfailurelog'),(35,'Can delete access failure',9,'delete_accessfailurelog'),(36,'Can view access failure',9,'view_accessfailurelog'),(37,'Can add Estudiante',10,'add_student'),(38,'Can change Estudiante',10,'change_student'),(39,'Can delete Estudiante',10,'delete_student'),(40,'Can view Estudiante',10,'view_student'),(41,'Can add Administrador',11,'add_administrator'),(42,'Can change Administrador',11,'change_administrator'),(43,'Can delete Administrador',11,'delete_administrator'),(44,'Can view Administrador',11,'view_administrator'),(45,'Can add Profesor',12,'add_professor'),(46,'Can change Profesor',12,'change_professor'),(47,'Can delete Profesor',12,'delete_professor'),(48,'Can view Profesor',12,'view_professor'),(49,'Can add Código de Acceso de Profesor',13,'add_professoraccesscode'),(50,'Can change Código de Acceso de Profesor',13,'change_professoraccesscode'),(51,'Can delete Código de Acceso de Profesor',13,'delete_professoraccesscode'),(52,'Can view Código de Acceso de Profesor',13,'view_professoraccesscode'),(53,'Can add Facultad',14,'add_faculty'),(54,'Can change Facultad',14,'change_faculty'),(55,'Can delete Facultad',14,'delete_faculty'),(56,'Can view Facultad',14,'view_faculty'),(57,'Can add Carrera',15,'add_career'),(58,'Can change Carrera',15,'change_career'),(59,'Can delete Carrera',15,'delete_career'),(60,'Can view Carrera',15,'view_career'),(61,'Can add Curso',16,'add_course'),(62,'Can change Curso',16,'change_course'),(63,'Can delete Curso',16,'delete_course'),(64,'Can view Curso',16,'view_course'),(65,'Can add Equipo',17,'add_team'),(66,'Can change Equipo',17,'change_team'),(67,'Can delete Equipo',17,'delete_team'),(68,'Can view Equipo',17,'view_team'),(69,'Can add Sesión de Juego',18,'add_gamesession'),(70,'Can change Sesión de Juego',18,'change_gamesession'),(71,'Can delete Sesión de Juego',18,'delete_gamesession'),(72,'Can view Sesión de Juego',18,'view_gamesession'),(73,'Can add Etapa de Sesión',19,'add_sessionstage'),(74,'Can change Etapa de Sesión',19,'change_sessionstage'),(75,'Can delete Etapa de Sesión',19,'delete_sessionstage'),(76,'Can view Etapa de Sesión',19,'view_sessionstage'),(77,'Can add Tablet',20,'add_tablet'),(78,'Can change Tablet',20,'change_tablet'),(79,'Can delete Tablet',20,'delete_tablet'),(80,'Can view Tablet',20,'view_tablet'),(81,'Can add Personalización del Equipo',21,'add_teampersonalization'),(82,'Can change Personalización del Equipo',21,'change_teampersonalization'),(83,'Can delete Personalización del Equipo',21,'delete_teampersonalization'),(84,'Can view Personalización del Equipo',21,'view_teampersonalization'),(85,'Can add Conexión de Tablet',22,'add_tabletconnection'),(86,'Can change Conexión de Tablet',22,'change_tabletconnection'),(87,'Can delete Conexión de Tablet',22,'delete_tabletconnection'),(88,'Can view Conexión de Tablet',22,'view_tabletconnection'),(89,'Can add Evaluación Peer',23,'add_peerevaluation'),(90,'Can change Evaluación Peer',23,'change_peerevaluation'),(91,'Can delete Evaluación Peer',23,'delete_peerevaluation'),(92,'Can view Evaluación Peer',23,'view_peerevaluation'),(93,'Can add Progreso de Actividad del Equipo',24,'add_teamactivityprogress'),(94,'Can change Progreso de Actividad del Equipo',24,'change_teamactivityprogress'),(95,'Can delete Progreso de Actividad del Equipo',24,'delete_teamactivityprogress'),(96,'Can view Progreso de Actividad del Equipo',24,'view_teamactivityprogress'),(97,'Can add Asignación de Reto de Ruleta',25,'add_teamrouletteassignment'),(98,'Can change Asignación de Reto de Ruleta',25,'change_teamrouletteassignment'),(99,'Can delete Asignación de Reto de Ruleta',25,'delete_teamrouletteassignment'),(100,'Can view Asignación de Reto de Ruleta',25,'view_teamrouletteassignment'),(101,'Can add team student',26,'add_teamstudent'),(102,'Can change team student',26,'change_teamstudent'),(103,'Can delete team student',26,'delete_teamstudent'),(104,'Can view team student',26,'view_teamstudent'),(105,'Can add Transacción de Tokens',27,'add_tokentransaction'),(106,'Can change Transacción de Tokens',27,'change_tokentransaction'),(107,'Can delete Transacción de Tokens',27,'delete_tokentransaction'),(108,'Can view Transacción de Tokens',27,'view_tokentransaction'),(109,'Can add Bubble Map del Equipo',28,'add_teambubblemap'),(110,'Can change Bubble Map del Equipo',28,'change_teambubblemap'),(111,'Can delete Bubble Map del Equipo',28,'delete_teambubblemap'),(112,'Can view Bubble Map del Equipo',28,'view_teambubblemap'),(113,'Can add Evaluación de Reflexión',29,'add_reflectionevaluation'),(114,'Can change Evaluación de Reflexión',29,'change_reflectionevaluation'),(115,'Can delete Evaluación de Reflexión',29,'delete_reflectionevaluation'),(116,'Can view Evaluación de Reflexión',29,'view_reflectionevaluation'),(117,'Can add Grupo de Sesiones',30,'add_sessiongroup'),(118,'Can change Grupo de Sesiones',30,'change_sessiongroup'),(119,'Can delete Grupo de Sesiones',30,'delete_sessiongroup'),(120,'Can view Grupo de Sesiones',30,'view_sessiongroup'),(121,'Can add Tipo de Actividad',31,'add_activitytype'),(122,'Can change Tipo de Actividad',31,'change_activitytype'),(123,'Can delete Tipo de Actividad',31,'delete_activitytype'),(124,'Can view Tipo de Actividad',31,'view_activitytype'),(125,'Can add Minijuego',32,'add_minigame'),(126,'Can change Minijuego',32,'change_minigame'),(127,'Can delete Minijuego',32,'delete_minigame'),(128,'Can view Minijuego',32,'view_minigame'),(129,'Can add Reto de Ruleta',33,'add_roulettechallenge'),(130,'Can change Reto de Ruleta',33,'change_roulettechallenge'),(131,'Can delete Reto de Ruleta',33,'delete_roulettechallenge'),(132,'Can view Reto de Ruleta',33,'view_roulettechallenge'),(133,'Can add Etapa',34,'add_stage'),(134,'Can change Etapa',34,'change_stage'),(135,'Can delete Etapa',34,'delete_stage'),(136,'Can view Etapa',34,'view_stage'),(137,'Can add Tema',35,'add_topic'),(138,'Can change Tema',35,'change_topic'),(139,'Can delete Tema',35,'delete_topic'),(140,'Can view Tema',35,'view_topic'),(141,'Can add Desafío',36,'add_challenge'),(142,'Can change Desafío',36,'change_challenge'),(143,'Can delete Desafío',36,'delete_challenge'),(144,'Can view Desafío',36,'view_challenge'),(145,'Can add Objetivo de Aprendizaje',37,'add_learningobjective'),(146,'Can change Objetivo de Aprendizaje',37,'change_learningobjective'),(147,'Can delete Objetivo de Aprendizaje',37,'delete_learningobjective'),(148,'Can view Objetivo de Aprendizaje',37,'view_learningobjective'),(149,'Can add Actividad',38,'add_activity'),(150,'Can change Actividad',38,'change_activity'),(151,'Can delete Actividad',38,'delete_activity'),(152,'Can view Actividad',38,'view_activity'),(153,'Can add Opción de Sopa de Letras',39,'add_wordsearchoption'),(154,'Can change Opción de Sopa de Letras',39,'change_wordsearchoption'),(155,'Can delete Opción de Sopa de Letras',39,'delete_wordsearchoption'),(156,'Can view Opción de Sopa de Letras',39,'view_wordsearchoption'),(157,'Can add Palabra de Anagrama',40,'add_anagramword'),(158,'Can change Palabra de Anagrama',40,'change_anagramword'),(159,'Can delete Palabra de Anagrama',40,'delete_anagramword'),(160,'Can view Palabra de Anagrama',40,'view_anagramword'),(161,'Can add Pregunta del Caos',41,'add_chaosquestion'),(162,'Can change Pregunta del Caos',41,'change_chaosquestion'),(163,'Can delete Pregunta del Caos',41,'delete_chaosquestion'),(164,'Can view Pregunta del Caos',41,'view_chaosquestion'),(165,'Can add Pregunta de Conocimiento General',42,'add_generalknowledgequestion'),(166,'Can change Pregunta de Conocimiento General',42,'change_generalknowledgequestion'),(167,'Can delete Pregunta de Conocimiento General',42,'delete_generalknowledgequestion'),(168,'Can view Pregunta de Conocimiento General',42,'view_generalknowledgequestion'),(169,'Can add Métrica de Duración de Actividad',43,'add_activitydurationmetric'),(170,'Can change Métrica de Duración de Actividad',43,'change_activitydurationmetric'),(171,'Can delete Métrica de Duración de Actividad',43,'delete_activitydurationmetric'),(172,'Can view Métrica de Duración de Actividad',43,'view_activitydurationmetric'),(173,'Can add Métrica de Selección de Desafío',44,'add_challengeselectionmetric'),(174,'Can change Métrica de Selección de Desafío',44,'change_challengeselectionmetric'),(175,'Can delete Métrica de Selección de Desafío',44,'delete_challengeselectionmetric'),(176,'Can view Métrica de Selección de Desafío',44,'view_challengeselectionmetric'),(177,'Can add Snapshot Diario de Métricas',45,'add_dailymetricssnapshot'),(178,'Can change Snapshot Diario de Métricas',45,'change_dailymetricssnapshot'),(179,'Can delete Snapshot Diario de Métricas',45,'delete_dailymetricssnapshot'),(180,'Can view Snapshot Diario de Métricas',45,'view_dailymetricssnapshot'),(181,'Can add Métrica de Duración de Etapa',46,'add_stagedurationmetric'),(182,'Can change Métrica de Duración de Etapa',46,'change_stagedurationmetric'),(183,'Can delete Métrica de Duración de Etapa',46,'delete_stagedurationmetric'),(184,'Can view Métrica de Duración de Etapa',46,'view_stagedurationmetric'),(185,'Can add Métrica de Selección de Tema',47,'add_topicselectionmetric'),(186,'Can change Métrica de Selección de Tema',47,'change_topicselectionmetric'),(187,'Can delete Métrica de Selección de Tema',47,'delete_topicselectionmetric'),(188,'Can view Métrica de Selección de Tema',47,'view_topicselectionmetric');
/*!40000 ALTER TABLE `auth_permission` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_user`
--

DROP TABLE IF EXISTS `auth_user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_user` (
  `id` int NOT NULL AUTO_INCREMENT,
  `password` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_login` datetime(6) DEFAULT NULL,
  `is_superuser` tinyint(1) NOT NULL,
  `username` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `first_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(254) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_staff` tinyint(1) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `date_joined` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_user`
--

LOCK TABLES `auth_user` WRITE;
/*!40000 ALTER TABLE `auth_user` DISABLE KEYS */;
INSERT INTO `auth_user` VALUES (1,'pbkdf2_sha256$720000$efHLIL5bHKibqeYZkxWR4t$Iz/Wk2mKwkV8gehWMLlhdBb7zp6PGDipOQVj0EuJ8Zs=','2026-04-16 02:06:16.301820',1,'agu@udd.cl','','','',1,1,'2026-04-10 17:21:24.131445');
/*!40000 ALTER TABLE `auth_user` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_user_groups`
--

DROP TABLE IF EXISTS `auth_user_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_user_groups` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `group_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_user_groups_user_id_group_id_94350c0c_uniq` (`user_id`,`group_id`),
  KEY `auth_user_groups_group_id_97559544_fk_auth_group_id` (`group_id`),
  CONSTRAINT `auth_user_groups_group_id_97559544_fk_auth_group_id` FOREIGN KEY (`group_id`) REFERENCES `auth_group` (`id`),
  CONSTRAINT `auth_user_groups_user_id_6a12ed8b_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_user_groups`
--

LOCK TABLES `auth_user_groups` WRITE;
/*!40000 ALTER TABLE `auth_user_groups` DISABLE KEYS */;
/*!40000 ALTER TABLE `auth_user_groups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_user_user_permissions`
--

DROP TABLE IF EXISTS `auth_user_user_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_user_user_permissions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `permission_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_user_user_permissions_user_id_permission_id_14a6b632_uniq` (`user_id`,`permission_id`),
  KEY `auth_user_user_permi_permission_id_1fbb5f2c_fk_auth_perm` (`permission_id`),
  CONSTRAINT `auth_user_user_permi_permission_id_1fbb5f2c_fk_auth_perm` FOREIGN KEY (`permission_id`) REFERENCES `auth_permission` (`id`),
  CONSTRAINT `auth_user_user_permissions_user_id_a95ead1b_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_user_user_permissions`
--

LOCK TABLES `auth_user_user_permissions` WRITE;
/*!40000 ALTER TABLE `auth_user_user_permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `auth_user_user_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `axes_accessattempt`
--

DROP TABLE IF EXISTS `axes_accessattempt`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `axes_accessattempt` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ip_address` char(39) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `username` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `http_accept` varchar(1025) COLLATE utf8mb4_unicode_ci NOT NULL,
  `path_info` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempt_time` datetime(6) NOT NULL,
  `get_data` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `post_data` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `failures_since_start` int unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `axes_accessattempt_username_ip_address_user_agent_8ea22282_uniq` (`username`,`ip_address`,`user_agent`),
  KEY `axes_accessattempt_ip_address_10922d9c` (`ip_address`),
  KEY `axes_accessattempt_user_agent_ad89678b` (`user_agent`),
  KEY `axes_accessattempt_username_3f2d4ca0` (`username`),
  CONSTRAINT `axes_accessattempt_chk_1` CHECK ((`failures_since_start` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `axes_accessattempt`
--

LOCK TABLES `axes_accessattempt` WRITE;
/*!40000 ALTER TABLE `axes_accessattempt` DISABLE KEYS */;
/*!40000 ALTER TABLE `axes_accessattempt` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `axes_accessfailurelog`
--

DROP TABLE IF EXISTS `axes_accessfailurelog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `axes_accessfailurelog` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ip_address` char(39) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `username` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `http_accept` varchar(1025) COLLATE utf8mb4_unicode_ci NOT NULL,
  `path_info` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempt_time` datetime(6) NOT NULL,
  `locked_out` tinyint(1) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `axes_accessfailurelog_user_agent_ea145dda` (`user_agent`),
  KEY `axes_accessfailurelog_ip_address_2e9f5a7f` (`ip_address`),
  KEY `axes_accessfailurelog_username_a8b7e8a4` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `axes_accessfailurelog`
--

LOCK TABLES `axes_accessfailurelog` WRITE;
/*!40000 ALTER TABLE `axes_accessfailurelog` DISABLE KEYS */;
/*!40000 ALTER TABLE `axes_accessfailurelog` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `axes_accesslog`
--

DROP TABLE IF EXISTS `axes_accesslog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `axes_accesslog` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ip_address` char(39) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `username` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `http_accept` varchar(1025) COLLATE utf8mb4_unicode_ci NOT NULL,
  `path_info` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempt_time` datetime(6) NOT NULL,
  `logout_time` datetime(6) DEFAULT NULL,
  `session_hash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `axes_accesslog_ip_address_86b417e5` (`ip_address`),
  KEY `axes_accesslog_user_agent_0e659004` (`user_agent`),
  KEY `axes_accesslog_username_df93064b` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `axes_accesslog`
--

LOCK TABLES `axes_accesslog` WRITE;
/*!40000 ALTER TABLE `axes_accesslog` DISABLE KEYS */;
INSERT INTO `axes_accesslog` VALUES (1,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','172.18.0.1','agu@udd.cl','text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7','/admin/login/','2026-04-16 02:06:16.312460',NULL,'b50e9b7665e403247c605e4cfff8b948d4daf16f6d16fbe7b8009234c211aff1');
/*!40000 ALTER TABLE `axes_accesslog` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `careers`
--

DROP TABLE IF EXISTS `careers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `careers` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `faculty_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `careers_faculty_id_name_c4366f21_uniq` (`faculty_id`,`name`),
  UNIQUE KEY `code` (`code`),
  KEY `careers_faculty_58893f_idx` (`faculty_id`),
  KEY `careers_is_acti_c4cbef_idx` (`is_active`),
  CONSTRAINT `careers_faculty_id_ae4a8821_fk_faculties_id` FOREIGN KEY (`faculty_id`) REFERENCES `faculties` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `careers`
--

LOCK TABLES `careers` WRITE;
/*!40000 ALTER TABLE `careers` DISABLE KEYS */;
INSERT INTO `careers` VALUES (1,'Ingeniería Civil en Informática e Innovación Tecnológica',NULL,1,'2026-04-13 00:31:28.312242','2026-04-13 00:31:28.312274',1),(2,'Pedagogía en Educación Básica',NULL,1,'2026-04-14 13:33:46.810945','2026-04-14 13:33:46.810978',2),(3,'Cine y Comunicación Audiovisual',NULL,1,'2026-04-14 13:45:33.548591','2026-04-14 13:45:33.548633',3),(4,'Diseño de Espacios y Objetos',NULL,1,'2026-04-14 14:00:50.022406','2026-04-14 14:00:50.022453',4),(5,'Arquitectura',NULL,1,'2026-04-14 14:11:30.785741','2026-04-14 14:11:30.785795',5),(6,'Derecho',NULL,1,'2026-04-14 14:28:33.350657','2026-04-14 14:28:33.350711',6),(7,'Diseño de Interacción Digital',NULL,1,'2026-04-14 16:54:07.291634','2026-04-14 16:54:07.291682',4),(8,'Publicidad',NULL,1,'2026-04-14 19:17:46.494709','2026-04-14 19:17:46.494731',3),(9,'Periodismo',NULL,1,'2026-04-14 19:32:01.216469','2026-04-14 19:32:01.216512',3),(10,'Diseño Gráfico',NULL,1,'2026-04-14 23:25:14.311062','2026-04-14 23:25:14.311084',4);
/*!40000 ALTER TABLE `careers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `challenge_selection_metrics`
--

DROP TABLE IF EXISTS `challenge_selection_metrics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `challenge_selection_metrics` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `selection_count` int NOT NULL,
  `avg_tokens_earned` double NOT NULL,
  `last_selected_at` datetime(6) DEFAULT NULL,
  `challenge_id` bigint NOT NULL,
  `topic_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `challenge_selection_metrics_challenge_id_0c601301_uniq` (`challenge_id`),
  KEY `challenge_selection_metrics_topic_id_3dc0c55d_fk_topics_id` (`topic_id`),
  CONSTRAINT `challenge_selection__challenge_id_0c601301_fk_challenge` FOREIGN KEY (`challenge_id`) REFERENCES `challenges` (`id`),
  CONSTRAINT `challenge_selection_metrics_topic_id_3dc0c55d_fk_topics_id` FOREIGN KEY (`topic_id`) REFERENCES `topics` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `challenge_selection_metrics`
--

LOCK TABLES `challenge_selection_metrics` WRITE;
/*!40000 ALTER TABLE `challenge_selection_metrics` DISABLE KEYS */;
/*!40000 ALTER TABLE `challenge_selection_metrics` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `challenges`
--

DROP TABLE IF EXISTS `challenges`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `challenges` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `difficulty_level` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `learning_objectives` longtext COLLATE utf8mb4_unicode_ci,
  `additional_resources` longtext COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `topic_id` bigint NOT NULL,
  `icon` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `persona_age` int DEFAULT NULL,
  `persona_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `persona_story` longtext COLLATE utf8mb4_unicode_ci,
  `description` longtext COLLATE utf8mb4_unicode_ci,
  `persona_image` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `challenges_topic_i_f14e19_idx` (`topic_id`),
  KEY `challenges_difficu_238107_idx` (`difficulty_level`),
  KEY `challenges_is_acti_5318b2_idx` (`is_active`),
  CONSTRAINT `challenges_topic_id_f5b3d705_fk_topics_id` FOREIGN KEY (`topic_id`) REFERENCES `topics` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `challenges`
--

LOCK TABLES `challenges` WRITE;
/*!40000 ALTER TABLE `challenges` DISABLE KEYS */;
INSERT INTO `challenges` VALUES (1,'Autogestión de tratamientos','medium','','',1,'2025-11-04 23:30:45.718000','2025-11-17 08:07:58.153589',1,'?',50,'Humberto','Fue dado de alta con indicaciones médicas complejas, pero no entendió qué debía seguir tomando ni a quién acudir si se sentía mal.','Muchos errores médicos y complicaciones surgen al cambiar de un centro de salud a otro, por falta de continuidad y seguimiento personalizado.','personas/perfil-ia-1763366872037.png'),(2,'Obesidad','medium','','',1,'2025-11-04 23:30:45.727000','2025-11-17 08:03:35.132286',1,'⚖️',27,'Simona','Tiene una hija pequeña y trabaja tiempo completo. Sabe que la alimentación es clave, pero no ha podido organizar ni aprender a darle una nutrición buena a su hija.','Más de un 70% de la población en Chile presenta sobrepeso u obesidad (MINSAL). Esta situación se debe múltiples factores, entre ellos la falta de ejercicio y educación nutricional, disponibilidad de productos ultraprocesados y la desinformación.','personas/perfil-ia-1763366608710.png'),(3,'Envejecimiento activo','medium','','',1,'2025-11-04 23:30:45.734000','2025-11-17 07:55:32.568298',1,'?',72,'Juana','Vive sola desde que sus hijos se independizaron. Le gustaría mantenerse activa, pero no conoce programas accesibles que la motiven a hacer ejercicio, socializar y prevenir enfermedades.','La población chilena está envejeciendo rápidamente y muchos adultos mayores enfrentan soledad, pérdida de movilidad y falta de programas de prevención.','personas/persona-profile_6.jpg'),(4,'Educación financiera accesible','medium','','',1,'2025-11-04 23:30:45.753000','2025-11-17 07:53:31.801716',2,'?',22,'Martina','Joven emprendedora de 22 años, vende productos por redes sociales. Aunque gana dinero, no sabe cómo organizarlo ni cuánto debe ahorrar o invertir, lo que lo mantiene en constante inestabilidad.','La ausencia de educación financiera en realidades económicas inestables dificulta la planificación y el uso responsable del dinero.','personas/persona-profile_5.jpg'),(5,'Inicio de vida laboral','medium','','',1,'2025-11-04 23:30:45.760000','2025-11-17 07:51:08.129717',2,'?',23,'Andrés','Acaba de egresar de odontología. Le preocupa no poder trabajar pronto, pero ninguna clínica lo ha llamado porque no tiene experiencia previa.','Muchos estudiantes recién titulados enfrentan barreras para conseguir su primer empleo, ya que se les exige experiencia previa que aún no han podido adquirir.','personas/persona-profile_4.jpg'),(6,'Tecnología adultos mayores','medium','','',1,'2025-11-04 23:30:45.766000','2025-11-17 07:47:53.283466',2,'?',70,'Osvaldo','Es un adulto mayor de 70 años y debe pedir ayuda a sus hijos o nietos cada vez que debe hacer tramites.','El avance tecnológico en los últimos años ha sido incremental. Esto ha beneficiado a múltiples sectores, sin embargo el conocimiento y adaptación para los adultos mayores ha sido una gran dificultad.','personas/persona-profile_3.jpg'),(7,'Contaminación por fast fashion','medium','','',1,'2025-11-04 23:30:45.791000','2025-11-17 07:46:31.242909',3,'?',18,'Gabriela','Estudiante de 18 años que vive cerca de esta zona y debe pasar a diario por lugares con desagradables olores.','La moda rápida ha traído graves consecuencias al medio ambiente. Especialmente en sectores del norte de Chile en donde los vertederos y basurales están afectando el diario vivir de las personas.','personas/persona-profile_2.jpg'),(8,'Acceso al agua en la agricultura','medium','','',1,'2025-11-04 23:30:45.798000','2025-11-17 07:44:09.892309',3,'?',50,'Camila','Agricultora de 50 años que cultiva paltas de exportación, ella está complicada de perder su negocio por la cantidad de agua que debe utilizar.','El agua dulce es un recurso natural fundamental para la vida. Hay zonas rurales en que el agua se ha hecho escasa.','personas/persona-profile_1.jpg'),(9,'Gestión de residuos electrónicos','medium','','',1,'2025-11-04 23:30:45.804000','2025-11-17 07:41:19.185456',3,'♻️',29,'Francisco','Cambió su celular y computador el año pasado, pero no sabe dónde llevar los antiguos dispositivos. Terminó guardándolos en un cajón, como millones de personas que desconocen alternativas de reciclaje.','El aumento del consumo tecnológico ha generado toneladas de desechos electrónicos difíciles de reciclar.','personas/persona-profile.jpg');
/*!40000 ALTER TABLE `challenges` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chaos_questions`
--

DROP TABLE IF EXISTS `chaos_questions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chaos_questions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `question` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `chaos_quest_is_acti_ed3ea2_idx` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chaos_questions`
--

LOCK TABLES `chaos_questions` WRITE;
/*!40000 ALTER TABLE `chaos_questions` DISABLE KEYS */;
INSERT INTO `chaos_questions` VALUES (1,'¿Cuál es tu mayor miedo al emprender?',1,'2025-11-26 14:17:13.336652','2025-11-26 14:17:13.336652'),(2,'¿Qué te motiva más en la vida?',1,'2025-11-26 14:17:13.341654','2025-11-26 14:17:13.341654'),(3,'¿Cuál es tu superpoder oculto?',1,'2025-11-26 14:17:13.346653','2025-11-26 14:17:13.346653'),(4,'¿Qué harías si tuvieras un millón de dólares?',1,'2025-11-26 14:17:13.351653','2025-11-26 14:17:13.351653'),(5,'¿Cuál es tu comida favorita?',1,'2025-11-26 14:17:13.354901','2025-11-26 14:17:13.355899'),(6,'¿Qué animal te representa mejor y por qué?',1,'2025-11-26 14:17:13.359902','2025-11-26 14:17:13.359902'),(7,'¿Cuál es tu película favorita?',1,'2025-11-26 14:17:13.364085','2025-11-26 14:17:13.364085'),(8,'¿Qué lugar del mundo te gustaría visitar?',1,'2025-11-26 14:17:13.368086','2025-11-26 14:17:13.368086'),(9,'¿Cuál es tu hobby favorito?',1,'2025-11-26 14:17:13.372311','2025-11-26 14:17:13.372311'),(10,'¿Qué te hace reír?',1,'2025-11-26 14:17:13.376312','2025-11-26 14:17:13.376312'),(11,'¿Cuál es tu mayor fortaleza?',1,'2025-11-26 14:17:13.379306','2025-11-26 14:17:13.379306'),(12,'¿Qué te gustaría aprender?',1,'2025-11-26 14:17:13.383486','2025-11-26 14:17:13.383486'),(13,'¿Cuál es tu sueño más grande?',1,'2025-11-26 14:17:13.387641','2025-11-26 14:17:13.387641'),(14,'¿Qué te inspira?',1,'2025-11-26 14:17:13.391644','2025-11-26 14:17:13.391644'),(15,'¿Cuál es tu canción favorita?',1,'2025-11-26 14:17:13.395644','2025-11-26 14:17:13.395644'),(16,'¿Qué te relaja?',1,'2025-11-26 14:17:13.400643','2025-11-26 14:17:13.400643'),(17,'¿Cuál es tu libro favorito?',1,'2025-11-26 14:17:13.404644','2025-11-26 14:17:13.404644'),(18,'¿Qué te enoja?',1,'2025-11-26 14:17:13.408645','2025-11-26 14:17:13.408645'),(19,'¿Cuál es tu mayor logro?',1,'2025-11-26 14:17:13.412641','2025-11-26 14:17:13.412641'),(20,'¿Qué te da miedo?',1,'2025-11-26 14:17:13.416641','2025-11-26 14:17:13.416641'),(21,'¿Cuál es tu color favorito?',1,'2025-11-26 14:17:13.420640','2025-11-26 14:17:13.420640'),(22,'¿Qué te hace feliz?',1,'2025-11-26 14:17:13.424641','2025-11-26 14:17:13.424641'),(23,'¿Cuál es tu estación del año favorita?',1,'2025-11-26 14:17:13.428643','2025-11-26 14:17:13.428643'),(24,'¿Qué te sorprende?',1,'2025-11-26 14:17:13.433650','2025-11-26 14:17:13.433650'),(25,'¿Cuál es tu deporte favorito?',1,'2025-11-26 14:17:13.437644','2025-11-26 14:17:13.437644'),(26,'¿Qué te emociona?',1,'2025-11-26 14:17:13.442643','2025-11-26 14:17:13.442643'),(27,'¿Cuál es tu serie favorita?',1,'2025-11-26 14:17:13.446854','2025-11-26 14:17:13.446854'),(28,'¿Qué te frustra?',1,'2025-11-26 14:17:13.450851','2025-11-26 14:17:13.450851'),(29,'¿Cuál es tu juego favorito?',1,'2025-11-26 14:17:13.455013','2025-11-26 14:17:13.455013'),(30,'¿Qué te apasiona?',1,'2025-11-26 14:17:13.460011','2025-11-26 14:17:13.460011'),(31,'¿Tienes mascotas?',1,'2025-11-29 18:48:01.324585','2025-11-29 18:48:01.324585');
/*!40000 ALTER TABLE `chaos_questions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `courses`
--

DROP TABLE IF EXISTS `courses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `courses` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `career_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `courses_career__131c4c_idx` (`career_id`),
  KEY `courses_is_acti_25e634_idx` (`is_active`),
  CONSTRAINT `courses_career_id_9d0a8719_fk_careers_id` FOREIGN KEY (`career_id`) REFERENCES `careers` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `courses`
--

LOCK TABLES `courses` WRITE;
/*!40000 ALTER TABLE `courses` DISABLE KEYS */;
INSERT INTO `courses` VALUES (1,'Sección 2',NULL,1,'2026-04-13 00:31:28.328159','2026-04-13 00:31:28.328197',1),(2,'Sección 1',NULL,1,'2026-04-13 00:47:40.401971','2026-04-13 00:47:40.402036',1),(3,'Sección 2',NULL,1,'2026-04-14 13:33:46.823267','2026-04-14 13:33:46.823301',2),(4,'Sección 1',NULL,1,'2026-04-14 13:45:33.563077','2026-04-14 13:45:33.563165',3),(5,'Sección 4',NULL,1,'2026-04-14 13:55:49.331928','2026-04-14 13:55:49.331984',3),(6,'Sección 4',NULL,1,'2026-04-14 14:00:50.033900','2026-04-14 14:00:50.033977',4),(7,'Sección 1',NULL,1,'2026-04-14 14:11:30.798934','2026-04-14 14:11:30.798983',5),(8,'Sección 3',NULL,1,'2026-04-14 14:28:33.365148','2026-04-14 14:28:33.365189',6),(9,'Sección 2',NULL,1,'2026-04-14 16:54:07.349839','2026-04-14 16:54:07.349870',7),(10,'Sección 2',NULL,1,'2026-04-14 18:47:55.031232','2026-04-14 18:47:55.031265',5),(11,'Sección 2',NULL,1,'2026-04-14 19:17:46.503494','2026-04-14 19:17:46.503515',8),(12,'Sección 1',NULL,1,'2026-04-14 19:32:01.226985','2026-04-14 19:32:01.227008',9),(13,'Sección 2',NULL,1,'2026-04-14 20:07:28.235041','2026-04-14 20:07:28.235072',9),(14,'Sección 3',NULL,1,'2026-04-14 23:25:14.324110','2026-04-14 23:25:14.324138',10),(15,'Sección 2',NULL,1,'2026-04-16 01:16:17.262918','2026-04-16 01:16:17.262944',6);
/*!40000 ALTER TABLE `courses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `daily_metrics_snapshots`
--

DROP TABLE IF EXISTS `daily_metrics_snapshots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `daily_metrics_snapshots` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `games_completed` int NOT NULL,
  `new_professors` int NOT NULL,
  `new_students` int NOT NULL,
  `total_sessions` int NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `date` (`date`),
  KEY `daily_metri_date_3f4067_idx` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `daily_metrics_snapshots`
--

LOCK TABLES `daily_metrics_snapshots` WRITE;
/*!40000 ALTER TABLE `daily_metrics_snapshots` DISABLE KEYS */;
/*!40000 ALTER TABLE `daily_metrics_snapshots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `django_admin_log`
--

DROP TABLE IF EXISTS `django_admin_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `django_admin_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `action_time` datetime(6) NOT NULL,
  `object_id` longtext COLLATE utf8mb4_unicode_ci,
  `object_repr` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action_flag` smallint unsigned NOT NULL,
  `change_message` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `content_type_id` int DEFAULT NULL,
  `user_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `django_admin_log_content_type_id_c4bce8eb_fk_django_co` (`content_type_id`),
  KEY `django_admin_log_user_id_c564eba6_fk_auth_user_id` (`user_id`),
  CONSTRAINT `django_admin_log_content_type_id_c4bce8eb_fk_django_co` FOREIGN KEY (`content_type_id`) REFERENCES `django_content_type` (`id`),
  CONSTRAINT `django_admin_log_user_id_c564eba6_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`),
  CONSTRAINT `django_admin_log_chk_1` CHECK ((`action_flag` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `django_admin_log`
--

LOCK TABLES `django_admin_log` WRITE;
/*!40000 ALTER TABLE `django_admin_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `django_admin_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `django_content_type`
--

DROP TABLE IF EXISTS `django_content_type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `django_content_type` (
  `id` int NOT NULL AUTO_INCREMENT,
  `app_label` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `model` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `django_content_type_app_label_model_76bd3d3b_uniq` (`app_label`,`model`)
) ENGINE=InnoDB AUTO_INCREMENT=48 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `django_content_type`
--

LOCK TABLES `django_content_type` WRITE;
/*!40000 ALTER TABLE `django_content_type` DISABLE KEYS */;
INSERT INTO `django_content_type` VALUES (15,'academic','career'),(16,'academic','course'),(14,'academic','faculty'),(1,'admin','logentry'),(43,'admin_dashboard','activitydurationmetric'),(44,'admin_dashboard','challengeselectionmetric'),(45,'admin_dashboard','dailymetricssnapshot'),(46,'admin_dashboard','stagedurationmetric'),(47,'admin_dashboard','topicselectionmetric'),(3,'auth','group'),(2,'auth','permission'),(4,'auth','user'),(7,'axes','accessattempt'),(9,'axes','accessfailurelog'),(8,'axes','accesslog'),(38,'challenges','activity'),(31,'challenges','activitytype'),(40,'challenges','anagramword'),(36,'challenges','challenge'),(41,'challenges','chaosquestion'),(42,'challenges','generalknowledgequestion'),(37,'challenges','learningobjective'),(32,'challenges','minigame'),(33,'challenges','roulettechallenge'),(34,'challenges','stage'),(35,'challenges','topic'),(39,'challenges','wordsearchoption'),(5,'contenttypes','contenttype'),(18,'game_sessions','gamesession'),(23,'game_sessions','peerevaluation'),(29,'game_sessions','reflectionevaluation'),(30,'game_sessions','sessiongroup'),(19,'game_sessions','sessionstage'),(20,'game_sessions','tablet'),(22,'game_sessions','tabletconnection'),(17,'game_sessions','team'),(24,'game_sessions','teamactivityprogress'),(28,'game_sessions','teambubblemap'),(21,'game_sessions','teampersonalization'),(25,'game_sessions','teamrouletteassignment'),(26,'game_sessions','teamstudent'),(27,'game_sessions','tokentransaction'),(6,'sessions','session'),(11,'users','administrator'),(12,'users','professor'),(13,'users','professoraccesscode'),(10,'users','student');
/*!40000 ALTER TABLE `django_content_type` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `django_migrations`
--

DROP TABLE IF EXISTS `django_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `django_migrations` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `app` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `applied` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=62 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `django_migrations`
--

LOCK TABLES `django_migrations` WRITE;
/*!40000 ALTER TABLE `django_migrations` DISABLE KEYS */;
INSERT INTO `django_migrations` VALUES (1,'academic','0001_initial','2026-04-09 16:56:42.581969'),(2,'contenttypes','0001_initial','2026-04-09 16:56:42.637662'),(3,'auth','0001_initial','2026-04-09 16:56:43.301131'),(4,'admin','0001_initial','2026-04-09 16:56:43.442532'),(5,'admin','0002_logentry_remove_auto_add','2026-04-09 16:56:43.452741'),(6,'admin','0003_logentry_add_action_flag_choices','2026-04-09 16:56:43.466180'),(7,'challenges','0001_initial','2026-04-09 16:56:44.389603'),(8,'admin_dashboard','0001_initial','2026-04-09 16:56:45.048043'),(9,'admin_dashboard','0002_rename_activity_du_activit_idx_activity_du_activit_444351_idx_and_more','2026-04-09 16:56:45.111375'),(10,'contenttypes','0002_remove_content_type_name','2026-04-09 16:56:45.260106'),(11,'auth','0002_alter_permission_name_max_length','2026-04-09 16:56:45.341855'),(12,'auth','0003_alter_user_email_max_length','2026-04-09 16:56:45.378624'),(13,'auth','0004_alter_user_username_opts','2026-04-09 16:56:45.391089'),(14,'auth','0005_alter_user_last_login_null','2026-04-09 16:56:45.469295'),(15,'auth','0006_require_contenttypes_0002','2026-04-09 16:56:45.474669'),(16,'auth','0007_alter_validators_add_error_messages','2026-04-09 16:56:45.489208'),(17,'auth','0008_alter_user_username_max_length','2026-04-09 16:56:45.574955'),(18,'auth','0009_alter_user_last_name_max_length','2026-04-09 16:56:45.658054'),(19,'auth','0010_alter_group_name_max_length','2026-04-09 16:56:45.688091'),(20,'auth','0011_update_proxy_permissions','2026-04-09 16:56:45.720870'),(21,'auth','0012_alter_user_first_name_max_length','2026-04-09 16:56:45.800118'),(22,'axes','0001_initial','2026-04-09 16:56:45.859873'),(23,'axes','0002_auto_20151217_2044','2026-04-09 16:56:46.033566'),(24,'axes','0003_auto_20160322_0929','2026-04-09 16:56:46.051094'),(25,'axes','0004_auto_20181024_1538','2026-04-09 16:56:46.070890'),(26,'axes','0005_remove_accessattempt_trusted','2026-04-09 16:56:46.124031'),(27,'axes','0006_remove_accesslog_trusted','2026-04-09 16:56:46.175343'),(28,'axes','0007_alter_accessattempt_unique_together','2026-04-09 16:56:46.229029'),(29,'axes','0008_accessfailurelog','2026-04-09 16:56:46.325106'),(30,'axes','0009_add_session_hash','2026-04-09 16:56:46.393472'),(31,'challenges','0002_add_challenge_icon_and_persona','2026-04-09 16:56:46.633746'),(32,'challenges','0003_remove_user_story_field','2026-04-09 16:56:46.697627'),(33,'challenges','0004_add_challenge_description','2026-04-09 16:56:46.762795'),(34,'challenges','0005_add_topic_icon','2026-04-09 16:56:46.831182'),(35,'challenges','0006_wordsearchoption','2026-04-09 16:56:46.948771'),(36,'challenges','0007_challenge_persona_image','2026-04-09 16:56:47.014280'),(37,'challenges','0008_wordsearchoption_grid_wordsearchoption_seed_and_more','2026-04-09 16:56:47.293716'),(38,'users','0001_initial','2026-04-09 16:56:47.584884'),(39,'game_sessions','0001_initial','2026-04-09 16:56:51.624347'),(40,'game_sessions','0002_remove_duplicate_progress','2026-04-09 16:56:51.826263'),(41,'game_sessions','0003_alter_teamactivityprogress_unique_together','2026-04-09 16:56:51.887197'),(42,'game_sessions','0004_teambubblemap','2026-04-09 16:56:52.150970'),(43,'game_sessions','0005_sessionstage_current_presentation_team_id_and_more','2026-04-09 16:56:52.320080'),(44,'game_sessions','0006_sessionstage_presentation_state','2026-04-09 16:56:52.431379'),(45,'game_sessions','0007_sessionstage_presentation_timestamps','2026-04-09 16:56:52.519101'),(46,'game_sessions','0008_reflectionevaluation','2026-04-09 16:56:52.705616'),(47,'game_sessions','0009_reflectionevaluation_faculty_and_more','2026-04-09 16:56:52.784384'),(48,'game_sessions','0010_sessiongroup_gamesession_session_group_and_more','2026-04-09 16:56:53.210430'),(49,'game_sessions','0011_teamactivityprogress_pitch_value_and_pitch_impact','2026-04-09 16:56:53.405492'),(50,'game_sessions','0012_alter_teamactivityprogress_pitch_intro_problem','2026-04-09 16:56:53.433438'),(51,'game_sessions','0013_gamesession_cancellation_reason_and_more','2026-04-09 16:56:53.656957'),(52,'game_sessions','0014_gamesession_game_sessio_created_7179a2_idx_and_more','2026-04-09 16:56:53.815994'),(53,'game_sessions','0015_add_logo_to_team_personalization','2026-04-09 16:56:53.879616'),(54,'game_sessions','0016_remove_logo_from_team_personalization','2026-04-09 16:56:53.940668'),(55,'sessions','0001_initial','2026-04-09 16:56:53.987585'),(56,'users','0002_professoraccesscode','2026-04-09 16:56:54.098738'),(57,'users','0003_create_professor_for_existing_administrators','2026-04-09 16:56:54.152800'),(58,'users','0004_professoraccesscode_prof_access_code_lookup_idx','2026-04-09 16:56:54.188373'),(59,'users','0005_create_administrator_for_existing_superusers','2026-04-09 16:56:54.245727'),(60,'users','0006_create_admin_and_professor_for_existing_staff','2026-04-09 16:56:54.464627'),(61,'game_sessions','0017_tablet_connection_byod','2026-04-13 14:14:24.314051');
/*!40000 ALTER TABLE `django_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `django_session`
--

DROP TABLE IF EXISTS `django_session`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `django_session` (
  `session_key` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `session_data` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `expire_date` datetime(6) NOT NULL,
  PRIMARY KEY (`session_key`),
  KEY `django_session_expire_date_a5c62663` (`expire_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `django_session`
--

LOCK TABLES `django_session` WRITE;
/*!40000 ALTER TABLE `django_session` DISABLE KEYS */;
INSERT INTO `django_session` VALUES ('f7lz7lk2kchm98hp5azvgohbfg79cqr2','.eJxVjEEOwiAQRe_C2hBmIAy4dO8ZCDAgVUOT0q6Md9cmXej2v_f-S4S4rS1soyxhYnEWIE6_W4r5UfoO-B77bZZ57usyJbkr8qBDXmcuz8vh_h20ONq3jtaSssV4k6laB8CMmDhr48AlTUCKsFoFmFJFyr4UUymC12xYI4j3B8jFN0A:1wDC7U:SoyD1WpbUh4ACflahEuC1wCTtO4s88gUeWaWPbwO4ls','2026-04-30 02:06:16.330069');
/*!40000 ALTER TABLE `django_session` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `faculties`
--

DROP TABLE IF EXISTS `faculties`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `faculties` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `code` (`code`),
  KEY `faculties_is_acti_5069b3_idx` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `faculties`
--

LOCK TABLES `faculties` WRITE;
/*!40000 ALTER TABLE `faculties` DISABLE KEYS */;
INSERT INTO `faculties` VALUES (1,'Ingeniería',NULL,1,'2026-04-13 00:31:28.236643','2026-04-13 00:31:28.236713'),(2,'Educación',NULL,1,'2026-04-14 13:33:46.781748','2026-04-14 13:33:46.781780'),(3,'Comunicaciones',NULL,1,'2026-04-14 13:45:33.536533','2026-04-14 13:45:33.536577'),(4,'Diseño',NULL,1,'2026-04-14 14:00:49.971655','2026-04-14 14:00:49.971709'),(5,'Arquitectura y Arte',NULL,1,'2026-04-14 14:11:30.734593','2026-04-14 14:11:30.734642'),(6,'Derecho',NULL,1,'2026-04-14 14:28:33.316410','2026-04-14 14:28:33.316459');
/*!40000 ALTER TABLE `faculties` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `game_sessions`
--

DROP TABLE IF EXISTS `game_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `game_sessions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `room_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `qr_code` longtext COLLATE utf8mb4_unicode_ci,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `started_at` datetime(6) DEFAULT NULL,
  `ended_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `course_id` bigint NOT NULL,
  `current_activity_id` bigint DEFAULT NULL,
  `current_stage_id` bigint DEFAULT NULL,
  `professor_id` bigint NOT NULL,
  `session_group_id` bigint DEFAULT NULL,
  `cancellation_reason` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cancellation_reason_other` longtext COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `room_code` (`room_code`),
  KEY `game_sessio_profess_2d4bd5_idx` (`professor_id`),
  KEY `game_sessio_room_co_529049_idx` (`room_code`),
  KEY `game_sessio_status_381f09_idx` (`status`),
  KEY `game_sessio_status_972612_idx` (`status`,`started_at`),
  KEY `game_sessions_current_activity_id_0a0772c5_fk_activities_id` (`current_activity_id`),
  KEY `game_sessions_current_stage_id_445084f8_fk_stages_id` (`current_stage_id`),
  KEY `game_sessions_session_group_id_836e533a_fk_session_groups_id` (`session_group_id`),
  KEY `game_sessio_created_7179a2_idx` (`created_at`),
  KEY `game_sessio_course__601678_idx` (`course_id`),
  CONSTRAINT `game_sessions_course_id_9d225134_fk_courses_id` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`),
  CONSTRAINT `game_sessions_current_activity_id_0a0772c5_fk_activities_id` FOREIGN KEY (`current_activity_id`) REFERENCES `activities` (`id`),
  CONSTRAINT `game_sessions_current_stage_id_445084f8_fk_stages_id` FOREIGN KEY (`current_stage_id`) REFERENCES `stages` (`id`),
  CONSTRAINT `game_sessions_professor_id_698ca57b_fk_professors_id` FOREIGN KEY (`professor_id`) REFERENCES `professors` (`id`),
  CONSTRAINT `game_sessions_session_group_id_836e533a_fk_session_groups_id` FOREIGN KEY (`session_group_id`) REFERENCES `session_groups` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `game_sessions`
--

LOCK TABLES `game_sessions` WRITE;
/*!40000 ALTER TABLE `game_sessions` DISABLE KEYS */;
INSERT INTO `game_sessions` VALUES (1,'33TR3Q','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAYYAAAGGAQAAAABX+xtIAAACdklEQVR4nO2cUYrjMAyGP20CfXRgDpTcbJkj7Q2So8wNksdCwr8PltOUwkKXSZsJ8kMxqB/IKLJ/OWpNPDeWX08CEEQQQQQRRBBBBBHELsRgPgAwa9xsHUsxNS/3KohdiSRJmoHJDFjMuslMnw1IktS/wasgdiWWkslpBqjE0IB1kHeB93gVxEuIqcaTPc1I4zG8CmJXohLtWIl2BIbmIF4F8W1EXSaVgAWGDoN0NYZmlJGAdntZd8x1BPE8MZmZWU3e0T8bUM9i6oEs27s3eBXEHoSL8vtBW4T6o20+5jqCeGJ4IZaUD3D1VJLGSqVCq/wRiJifheAWWvWpzDSCB36d9Slifg7iLs814/V5mvFLmHXWRp6fhCi6fapnDc0oAFn75yJII8Z0kd0Rx1xHEE8MP6ZHUF+u4LKQ426XX69nj7mOIP6TmC6i1dXMmsXUpxnrqATpauuN3A9YRxD/HpsKbTM2aq6SbwCR5ychNns77SrUe7xqy7ouX8WGhjsJcbt7nWFazGeAteMHMH0Iphd7FcSexLq3lzeoObE14+V6mr1Mi/r8LMSmPi+BB1bx7jEP3X4m4k7DpfUjv2ZzK22xRszPQHBL55znntMu1P1L2RoxPwfx8OasLz0TLt7XQz3y/GTEre+11TX3QJY8z1re22Ze61UQuxKrhhvsIobGz3PrvIEmeiDPQ2zO8/tj2609UJ6I2NtPSgzl9wtFy3vPu3Xv9CqIPYms20t/O0wXr94/mzd6FcQ3Eg99r6SrCZZa7Zch0pjtFhrubMTa9zo0lRisxjoqWQfY76/6kXiFV0HsQVj8z0QQQQQRRBBBBBHEjyP+Al+pMKHaCe5mAAAAAElFTkSuQmCC','cancelled',NULL,'2026-04-13 00:37:41.095174','2026-04-13 00:31:28.957968','2026-04-13 00:37:41.095392',1,NULL,NULL,1,NULL,'Probando el juego',NULL),(2,'H47DNB','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAYYAAAGGAQAAAABX+xtIAAACOElEQVR4nO2cTY6jMBCFXw1IWZobzFHI1eZm+Cg5QEuwbAn0ZuEfnKY30QzppPS8iBLIJxk9VZXr2YkRj43t14MAIEKECBEiRIgQIeIUIloeADYDAJgNgF2xlVvD02cl4lQikCRXINqFZsNmGG9miANAkuT0A7MScSqx5UgeZ4ATOnIKa/qImBLAD8xKxAlEf7gSPg3jzQCED3zTvb/mc4j4ByIOJcSBXNRfYFYi/iNRinWp5yTJlNHHuSPGcq1+5TWfQ8QD436BBk5h/fqShzR3QmTNmzHnNVwO9q+3pfnbEzVxl8AmSSCQADruab2oL83fnmg159yRTFW8aj4j31A990KU3D4DnFDreZV7CizLeGnuhKiad2wW6smTQb6W3ym3OyGaOAfCir05w31uV5z7I7os8p8BsOvSI9nveWwmv90NUXu1NdfzZMzMtZSjK8t4xbkTonoyRdpqwZUqvlZHTpr7IBpPJuub+vMVaOo5FecOicUM0S4EFrOybgeK+qrn/oj4ewVGfpZt8qVPK3jEAbDrcqFdnz8rEacQba82Ni5sreyq5+6Iw15q9daR+zeglHJp7oM47KtNqAY75L26JA775znY9x22bMVKc3dEye1pjLceiNYDKcHX05BPnpWIM4hmL7XENBrbtTRsqueOiIPmuws7hXp6QvXcNZEa8kACSw/ylk9Dy5NxQxzPve6nXed93a6zUY6Ib8693vnt6ccs8ts9Eab/mRAhQoQIESJEiHg74i9mHLTOwcDEJgAAAABJRU5ErkJggg==','cancelled',NULL,'2026-04-13 21:58:27.044683','2026-04-13 00:47:40.501879','2026-04-13 21:58:27.044935',2,NULL,NULL,1,NULL,'Probando el juego',NULL),(3,'GIT0RT','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAYYAAAGGAQAAAABX+xtIAAACVUlEQVR4nO2cTYrjMBCFX40MWSrQB5ijyDebq9lHyQEa5GWDzJuFpESOexOIk27xtAj++0CmXPWkqiJGPDbWPw8CgAgRIkSIECFChIhDiNnKwGxmwDLAxmUAgLXeOr98ViIOIUCS5ORJkglkBBCYwMnXn80jP/M9RDwwqkETAJ/ACY7Z8OVuAicAsnm/RIiA2dkxH40/Y1YinkgMuys+gVg+8gnn8+cbZiXiSGKn5xMAwG81XnreI7GYmdmAKuqrAVgN8xnIy/bxDbMScQRRnHg7EEhm6++G/PzXE826nWTK2zQAjoCv1i9bN9m8O8LG5UROywBO/suKsuco72jje2Yl4ulEE70BX1w8b9cbj4f25x0Rm0V5LBG9fgK7I9m8N2L++2W3FTwnADZiNYQIYD6/Z1Yink2UnEyI60AsJwLLRzL4T0O4DKk+tg6Af92sRBxJ1NgO5LRrFvUQHXFdvOccvPS8F6K1+VbAy2m828LL5v0QjgiXUjpHuJgVPfcJuZIuPe+FqE58XbJvV/A53pegLz/vg2hie2mXiOVaFfX7MszPfA8RD4wmJxOiK9bPjRO1bUZ63hfR+nlphiqxPR9N+SmXM++yeQ/ErnJ2NXxJxfrbFyGbd0Xc+l6xnGj/LmYIlxNLJd2T98QrZiXiEOLbvleSVxfPfu6k5/0Qu75Xxlsh7Zp6lZ73RHxjczRl1JJ2hfS8I2LX9zqPLhngaPARFqqQm2osvRB7PWfNw7U9E9LzjohNjQVNCK8bNgDNdl0274Aw/c+ECBEiRIgQIULEryP+A1o+ufxmxWljAAAAAElFTkSuQmCC','cancelled',NULL,'2026-04-14 13:32:58.283350','2026-04-13 21:58:47.604436','2026-04-14 13:32:58.283525',2,NULL,NULL,1,NULL,'Probando el juego',NULL),(4,'86YJ91','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAYYAAAGGAQAAAABX+xtIAAACYklEQVR4nO2cTW7jMAyFH0cGupSBHqBHkW8wV7aO0gMUkJcFJHAWomyl6SYzdZIRnhdBbOdDaDASH38QUdx2lF83AgAJEiRIkCBBggSJU4godiDORRBnoL4Apd2a724ViVMIqKqqrl5VVXM9RUho79q1/SPP+Rwk/oIobSVvIoDPALbJFnsUkcdYReIeRHzTmrLL4j8FIT2FVSR+kJiurmyCo06jcf745+8g8VzE7nOnAEp3RwFA4AGEvlj3nM9B4nZiExGRCTWU77pdVwBVti8PsIrEGYSJ8uNY4RTwFtS/3qVuH4DoE7HVZ7tm75w2DeeYq41DtJWcANSg7nOfmu+/A4A+H41wqiuK6Lq9aKu5OUV4f1GEuuk/wCoSJxBNt/tPUfgEAEU0/i6TYnvNdjonU/B3sorEmcS+t7u6mVsA9xkIySlCctq2eu7tYxAXyjw5S8TN3RdqjvF8FKLpdgBNvmVc52oZ1O3jEa6m5rIAQEhFjmUvy37j3laROIHo1/menNnpEc9rtOc6H4PoajLVvysA66Xu3q9bPff2QYhOw1XdXl2bABucSFZ0ZzwfhuhVmmpTbrXojmNYhut8PCLKZOMw4TJhiyKCKBNYhxuG+Kavhi6Kt+aLsscyHHHMvQJOZfGqCO8isqCIzcjd3yoSpxDfzL1my9o0tQ7qyjrcSMTu8z056/Lz41Psnw9EXPm866QDOHos9PkwxPXcq8+TYpsF8B+TxjebmWAvdTzCaVvidui6TZAFpeZqj7GKxAnERV8N1jw1IZfaNGRgvX0kQvg/EyRIkCBBggQJEv8d8QfXZVCTV37R9AAAAABJRU5ErkJggg==','cancelled',NULL,'2026-04-14 13:45:06.023216','2026-04-14 13:33:47.322865','2026-04-14 13:45:06.023388',3,NULL,NULL,1,NULL,'Probando el juego',NULL),(5,'0D016Q','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAYYAAAGGAQAAAABX+xtIAAACRElEQVR4nO2cQY7bMAxFn2rv7RvkKM4NemX7KHOAAeRlAAXsQpSsJhigUzRpInwtnMTOQ2TQ5KcoIsH43rj++CYAIkSIECFChAgRIh5CbMEHAOEMhDBDOHMtl+anz0rEQwjMzMzWyczMErYymFkcjCUCTOnmK695HyL+gri6Jy92CeE8XYKtUyIbfisB4OmzEvEUYh8BBgtnwNaH/IaIlyK2U4JtdnNXFf/PsxLxD4k7PbdIFnWWOBiLSc97I0Z/3Ytgbz/TCNNnsO10CbbNn/il6XmzEvFIwp24GbGo+BKB5fay/PztiRq4E/ngCzYwi4MdYb1YXzZ/e6LEdgYDBgt+qGOfseVjTLbN8WmzEvFIosT2OLizZ+/OB8iZ2zolQDlcJ0TV8wTgwZwlDnYk7/5Osb0Toug5g92oOPkRiH5Oft4N0cb2w+OXeFyAJsrL5h0Q1c+Lad36qUg57uLy826IRs+biL5Si3HZ7aXnHRG/1WQilBy9pnSR8jDIzzshGtmGsnV+hPUSAJL0vB/itg7n55oSXInt8vNeiCZvr1bFi60RpOcdEu1G6ZrP1EQ912OhPAyyeR/E3b7aIeUrqr12STTrc/8YoV26Td4XKZt3RxQpByCc9xG24J1xeemW22Bf/T5E/MFo0nP3aTxzg9oDKT3vibizec7gcSkvZVfpec/EdroEN/I+YvbhXRVV8t/kPkR8PZpsvWZu1nTATqbeqM6Iu7z92FnJuy1Tyo2Qiu3dEEH/MyFChAgRIkSIEPF2xC+0AOkdeYUhdgAAAABJRU5ErkJggg==','cancelled',NULL,'2026-04-14 13:51:22.359483','2026-04-14 13:45:34.114260','2026-04-14 13:51:22.359645',4,NULL,NULL,1,NULL,'Probando el juego',NULL),(6,'3SPQEZ','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAYYAAAGGAQAAAABX+xtIAAACbElEQVR4nO2cUYrjMAyGP60DfXSgB9ijODdb5mbNUXqAhfhxwUH7YDtJp/MSmLQZIz+1NR/ICFm/ZFFR9q35104AjDDCCCOMMMIII4w4hBilLGCWdVsG5rrVv9wqIw4lvKqqJiBeVKQHGaKIfvSgqqp6e4NVRhxKzDWSfSL7d+xBBsi3wHusMuIlROyAKJK9r9M5rDLiSML/E8DpGuxnsMqI7yO6+sEpMMM4gGQh550KHgjbZt05z2HEfiKKiEhHyec5qc+iNyDL9uENVhlxBFFE+WZNLit4vX21q+mc5zBixyqFmFclTCyeTkuF5pRgPm+JqJE8AUFVCZoAXI34CfKnmzeft0E8NFx8Ko5fdftargeL80aIqtv93w7iRSFekxKvgJ8Q4kXlgTjnOYzYsWo+L2o9Bzu+Bvtyty/t2XOew4gda/X5pume1VzWdVXGm4ZrjnBKuNe2+tg7hdhtO+/2rtYKsanAq24vFVot0xKEaS3YLM5/PLHUaq72V/1Suk2u3u3m85aIbadtSeAETTmf50Qf6q75vAViq9v1UztmEXfBdHtLxKrHtx258sxWdkufxnzeCPFYq6WHBmwu0qFMT1g+b4R4ejm75Z9L73WT1C3OGyPWudfyuDZLjfM5j80QppdbZcQhxNJvnwDmjnFwScJ0TQAIPg/QLPM0Jz2HETvWp3ye1Vz+SnlOr9e63e2NEqN0yECV7PnJJdpsVMtEzuexqyOv8VLaMR/9G60y4huJp7lXAAk6d4S7oCXRg5iGa41Y5l7H36UqlwGnMgDy5949E6+wyogjCLH/mTDCCCOMMMIII4z4ccR/EzZCql99SEQAAAAASUVORK5CYII=','cancelled',NULL,'2026-04-14 13:59:43.450154','2026-04-14 13:55:49.687779','2026-04-14 13:59:43.450313',5,NULL,NULL,1,NULL,'Faltó tiempo',NULL),(7,'IHUTCD','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAYYAAAGGAQAAAABX+xtIAAAClElEQVR4nO2bTY6cMBBGXwWkWYKUA8xR4AZzpCg3g6PMASLBciRbXxa2gUnnZ1oaGoLKC4vGPKksq1xVn90m7mvxy50AOOGEE0444YQTTjixCzFabjCbmbV52HpiGWofbpUTuxKNJCkAVIKy0vregiRJwwFWObErETferaF01kPaBY6xyokdiPrmTRMwqKFTrAXxAKuceDARTZoqMbaQujNY5cSnEYufpygO48uUpDmjqWQ0QLcV6845DyfuJ2YzM6sBojE+v5kGoqWgbmZm/QFWObEHYTd6+9wiAAO4VeNdb78KMbZg/WyWnqyNBo3EaDXWH2SVE/sTjZS7+Ukw19BN0TTM9ZrN/QfzcOLvLQkumippaEL6SadAFmGa8tSlD8M55+HEx9umPi+J+o9ao1WCZsKYn2TviHPOw4k7WhZWm+LdmirRSQIqSRP5XZFnzzkPJ+5oeW9XgC5t8Np06Z0U1u/OOQ8n7iZGe0onK0A0+zZFg7nOoTzn8g+3yoldiMV/i08PTT5c00CV9nu6st+7n1+BWA5KK6UcXUvKnlZ6qrTGeF/zKxBLrUauxnIoD6xPmwFf8wsQuVYbX0It5ha61zokTaablq/mryGdtjzIKif2JDZ5+yZbz8dsLBKNvFa7DvGn+jyQVVigBHpf82sQm7y9rH5AQ8rb2QZ19/OLEeu91xzFy7lartmrNbyfeh5OfKAVvb2ZAGLN2INBFYCswaeBR1rlxJ4E646ew3YRW9PoAJRt3ff2ixLj85tZP9c5ZacJpJtT/ZFWOfGJxG/8HLaaDO/OXdzPL0Dc3HsFsG6K0L0ayoEezHO4qxC//DFpU6YlvZ0mH7643n4Z4vbe6z+a33t1wgknnHDCCSecOJz4CU7mDYdjgKZXAAAAAElFTkSuQmCC','cancelled','2026-04-14 14:02:00.114597','2026-04-14 14:11:14.225909','2026-04-14 14:00:50.320301','2026-04-14 14:11:14.226039',6,NULL,NULL,1,NULL,'Cambio de planes',NULL),(8,'18IPRH','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAYYAAAGGAQAAAABX+xtIAAACa0lEQVR4nO2cTYrjMBCFX40CWcowB5ijyDeYM82R5gb2gRqUZYPEm4Uk20l60YZxfsSrlWPyQYlS/ahKiRH7JP/YCQAiRIgQIUKECBEiDiFmq9LeZ7PxcqpPRYaHayXiUMKTJFOz/uDIySdgHgCSJKcnaCXiUCKvngwyZrMR2WwEyj54jlYiHkg4ApfzV4f391qHiG8QITraiGyc/KchxJfQSsR/JE7twRFABuATOA+RmH9/oDh62Pr7a65DxH7iYmZmJ2AesgHINYHPA1DK9vEJWok4gqhF+SqTT+Dkb18vkl5zHSJ2E/MAoHq3I0LMze3NrESB8fFaiTiWyGZjK9RthCPgP81GT5r9Sk/SSsQBRIvtsX2cfAJqSQeQEdehXrH97YnWZPMkQnQkoyPgyVLBkySC8nlPxFLDJRQjTz6BjK7tAyYUm1dnl83fntjW7VPJ4tXmpR0T2mZYWvKvuQ4RO2Q7QPGtVAubiN4CgGJ7Z0SIS4Pdk6intmyY7Vx3RD3OvfY6RHxHVj+vqXxJ4EtSJyk/74jY1u1oxXt1e5+wnbEon3dC3ObzVsg162++Ipt3QiwGrV121HaMa7E8qifTG7GxefNzYHNgQ/uo2N4NcT9XA7B2Yoqlp9XtZfNuiPXea2nCwPFq1pZ1H64/oh3JgMuZ/NMuTtSSDo53xCO0EnEEcZfPGVFOaG3CBqDM1BXbOyHubc6lkANQU3lci3fZ/O2J01cvLTCfEP7+TID/MMAT1rozr7kOETvkuuFSY/tyOKvDtSg/74i4+WFSCeslmHO5QhHUb++JMP3PhAgRIkSIECFCxNsR/wCTZ2NWf7XaawAAAABJRU5ErkJggg==','cancelled','2026-04-14 14:12:13.351291','2026-04-14 14:23:03.854512','2026-04-14 14:11:30.866706','2026-04-14 14:23:03.854743',7,1,1,1,NULL,'Faltó tiempo',NULL),(9,'4IP5NU','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAYYAAAGGAQAAAABX+xtIAAACbElEQVR4nO2cS2rcQBCGv4oEXkqQA8xRem4WfDPpKL5Ba2mQ+LPoh2QniwzMQ2lKC9Ga4YNqfld1PTQ2cdu1/bgRACeccMIJJ5xwwgkn7ksgSdJUHyeAoBUYJBjW8tUgSVrPuQ8nbieyoACd9D6CpsVMit//LM69DyduIDYzG4EQNyN8vCn5+TwCs5m9xionnkHMY5eVDh899iuewionHkkEfVo6xZOLj6ewyok7En1ZdAI2YPkpA0MMEcK0QTg26865DyduJxYzM+thvnyappStb6b3EczMzK4vsMqJRxDZzw+evPRYiAiWHnIAeLJVTjySKIXYsEKIQIhdqsukCDCsSLGT1+fNEFlzxU4ESUAnTXS5XA8RktyTa94IUTTX3m5bi7MPNQBohSDXvA3iqHlIIbysgqTchaVzP2+HOMb29JhcfK0r6dCAdc0bIA7NdE3s3l1uKYdLK9e8DaL6r0SIea6Wb3uUj+CaN0NUP89xvBzlKznAp1V2e9e8BeJrDgcpmNdsfS/NXfPmiNpzCxHsmrpvpQUX4uaz1OaI+SIBm8HyJk2L2XGktvT4OxPNEIccLjfjYm67ptsEJcp7bG+EqPU51ZNros7+mdfnDRFf/Fyq7ba8yq12wGu11ojZ8kU61NPJvj8efP/U+3DiH67ynswQAbYeljcxX8GCwFLyPkQ0j/FpVjnxSOI4P8+z8r+c8UN+3d1je5PEPILZCGaX0pZL9dsrrXLiocQg5YJ8sfrO+8utcuJ+BHuOnnrrdZK+T9P2cbrH9haIP3+vNuSRSxm0lKrNNW+FMP8/E0444YQTTjjhhBP/HfEb5R9bJt6cDB0AAAAASUVORK5CYII=','cancelled','2026-04-14 14:24:01.849600','2026-04-14 14:28:24.892599','2026-04-14 14:23:12.402170','2026-04-14 14:28:24.892897',7,1,NULL,1,NULL,'Probando el juego',NULL),(10,'5YL740','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAYYAAAGGAQAAAABX+xtIAAACM0lEQVR4nO2cTW7jMAyFn8YGZmnfoEdxbzBHmqtFR+kN7L2M1wVFR3ZaYIKpm5R4Whj+yQdIoMlHUXIScV9bf90JACJEiBAhQoQIESJOIXKqDVi2A4D0itUfjd/eKxGnEgNJsgB57CyVt1cgjwBJkpcH9ErEqcRaPXliATAU8DIUYJphUeAxvRJxAtHf3FlGEKjO/sHs/TnHIeI/iPxSgDzCXHxT8Qf3SsQXEi7WrufkDA/w6IiJ5fCT5xyHiDvaPkEzFT8capPNgxDV5m1zZwcATDdPn3McIu5oHrjdsTkDvAAg547XsO7Wl81/PNHa3Nq8PZg7u7Qz6XkUYovtxS9nNNY3S5uoy+ZBiCaH48Vm5R0xzR3tsjlTbA9CNBMxq7lN9Oob0MZ2+XkYwutwS1+Yx64kLCOYx0MJbk3Mf76vVyLOJPY5XHE/Z3EpR3Vx+XkYop2f1wBfRd1VvMDuSc+jEDs931ycXnu9pvHy8zBE4+cWwqcZTVgn/RXQ/DwM0eh5zdYH1tjePlDeHojY6i8+F98qrrupm/Q8ENH6OdzZTd63jRPu4rJ5DOJmXc1WWyxvV+01JHGzfl5rbmXL1guuk3TZPBJRDQoL8Fh6IKcesAB/zfCefRwi/qEd9PywO6YGAOl5aGJ6+01g6U3K06tlc6u+aQhM5JeC9Jc1wJNvdRVG3zSEIT7b90ru9kxob1Qg4oN9r16isYWWodgroLw9DJH0PxMiRIgQIUKECBE/jngH7OrFy8ff2AoAAAAASUVORK5CYII=','cancelled','2026-04-14 14:29:11.144591','2026-04-14 16:43:08.660539','2026-04-14 14:28:33.540067','2026-04-14 16:43:08.660733',8,1,1,1,NULL,'Probando el juego',NULL),(11,'1T2I3H','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAYYAAAGGAQAAAABX+xtIAAACJUlEQVR4nO2cTW6jQBCFX6WRsoQbkavNzeAoOUCk9h70ZtHVTceMFCUZJ3bp9cLC4E8GPdVvl23E59b+9EkAECFChAgRIkSIEHETYjVfwGWAvQAwmwB7wV4vTT9+VyJuQoAkyWUkSW7ggkRgJDFnABi3q4/c53OI+AKxuyXPRfjduIwbivCrmf3OXYm4ATGcT+0D5tcBhvEN/6je7/M5RHyDWCc/ILMH9f/+HSJ+lTjFc2aAzIkAEourVzwPRVRB29tl3K5ffEnzIIRr3q3sbr2kb/P1ZWn+8ERz3NWwm+ZkTjzcelVfmj880Xx7KqpiLqG8aZ7rkeJ5FKL69nycOTQHitIlqEvzIERn54exu9xIxez7C9L88YkuhwNKjl57r0Dv22XnIQm36d1cabYyDbu1cu7+n0PEB+tcptVOTAnlh9nLzoMQfa1GekkGdOF9Kw5A8TwM8S5vH926i9JdPKfsPCKRCFyefR9tnVLtx5a8TvE8ENFtoBR9S8e1a8FV3y47j0I03177cKj9l9pvVzyPRrzL4XJfi6N15KqJS/MYxGlfrVVoXKDea0jitH9+1OetN3cU6dI8EuGCooj8xwZgtQHwVmxN7n74rkTcgujieVefo07H1IJN8TwQcdK8DMXxUL/P5aV5SGK1Z5pNicBlAPnq09DqyYQhznOv3PyHDf3MhGajAhHnuVf0s87eh6P67YEI0/9MiBAhQoQIESJEPBzxF6GF0O3fuDrkAAAAAElFTkSuQmCC','cancelled','2026-04-14 17:46:29.376099','2026-04-14 18:47:29.521009','2026-04-14 16:54:07.948430','2026-04-14 18:47:29.521248',9,1,1,1,NULL,'Faltó tiempo',NULL),(12,'WFXKST','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAYYAAAGGAQAAAABX+xtIAAACZUlEQVR4nO2cS4rjMBBAX40MWco36KPYN5ur2UeZAzTIy4BMzUIq2+nOogOdn6haBGLnQYlSfSUiym2y/rkRACeccMIJJ5xwwgkn7kLMUgVYBQAZlw5gtVf9w7Vy4q5EVFXVDHMPMgI6xfpVVVV1eoJWTtyVWM2Ti3cDc7+KjFCiwHO0cuJhxNwDLKdrzfs7rcOJHxGDqjL865AxnoUhvYRWTvwiYcna8rlqCgoE1Slm6rPjT15zHU7cTiwiItLB/HEWneK5JvC5h1K2j0/Qyol7ENWJd9k83mr5L+J+3gpRijZWgUXEarjOSvbF/bwhwhoz1g4IKsTPTohBKVsgJoSYt9+96DqcuEEsomcgZhg0w1AKOVBNYPHeY3sbhOXzRGnTdIqqxfDEWrKXF27zVoiLwWrMWEMejtbfNoPbvAXiULfXcYxulk6we/w2kn/NdThxg+z53AL8ntn3ri1ve8Nt3goxpKAyUis3C/CrMMupRv7azr32Opz4iVg+vyjUa10XLoay7ueNEEebD8mm7GULHEo68HzeDHGweWnSh4R1aHuT7nV7S8TBoMXIQwo1rG+Nu89k2iKOc7gSx20YZ6eq9sxjeyvE1XO1fRJTLD2xub3b/P2JLxcc2at1KB8ZncDr9vYIa8mAVRjSWm49WxMX9BvxCK2cuAfx9VytZPEh2V3nKmE7aHE/f3uiu/445k6gQ+cxZFh60blPD9PKiScQy8n683gWkQ9V+ZuerpUTv0JcufcKut2Hq4draW/SPba/PfGtbt/GrnUwk4LWdt3zeSOE+P9MOOGEE0444YQTTrwd8R/G54F9Mjk/MAAAAABJRU5ErkJggg==','cancelled','2026-04-14 18:48:58.655452','2026-04-14 18:54:36.411311','2026-04-14 18:47:55.297546','2026-04-14 18:54:36.411437',10,1,1,1,NULL,'Faltó tiempo',NULL),(13,'MKPP0E','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAYYAAAGGAQAAAABX+xtIAAACZUlEQVR4nO2cTY6kMAxGnydIsww36KOEo8NR6gAthWVLRJ5FfgpmejElDVATmQUqoJ5kZDn+7LhKlNeO9ONFAIwwwggjjDDCCCOMOIVYpBwsI4jIAMsIQKqPxsutMuJUwquq6gbhMUCISQCQCVBVVZ1vsMqIU4lUI9lv6OxVYa3BvojIPVYZcQWxjEnyCf8lhPgWVhnxD4nhu5sSHj9zr0aX8fMGq4w4k2g+dwokYB1Q1iQKIHgg7Jt17/keRrxOrCJZreM3WD62fFtnIMv26QarjDiDKKL8ecwAQVUJ8c+nqtt7vocRLxNZno+phXMSwKlMbQEo5fp7v4cRf3PU6HZKiO7wKVdtW/2mtzjvg6ird9xflrU9P3Dl02w+74RoGXvjEN3F3aqR2qIxn3dCHNZ2rS24EN3u9Ix983kPRKvPk2gt0geKhkuiy8eXAG5jGeNlVhlxJrGrxvJ1iOyU23Plt3zeDdE0nMsZu6zoulHyeZN0ls97IfZdl9lXT8/APp838W4+74DYb47ncMYVGZ93VYG8AFic90LsM3auyyin0nt93jOfd0IcNVztwxUFf2jRWJx3RiwiohoPkxIhOs0jMosM2GxUb0SLZEqwJykbqr6IuzusMuJM4jn3yjogk1clPERkIgmsNg/XEVF1u29CLkd8q9p87cxaPu+FaD5vxZkvCv4w/uhsX61jIkSQCad5SKLssVg+74j4Zu7VqRT59jlom4zL05AXWWXEJUTZK8+/ZAiPAZ3XAZlIuVa7xyojTiB++2ESOnPot+/3XSyf90GI/c+EEUYYYYQRRhhhxH9H/ALQmD9zWf64eAAAAABJRU5ErkJggg==','cancelled','2026-04-14 18:55:33.571629','2026-04-14 19:03:25.989901','2026-04-14 18:54:55.455023','2026-04-14 19:03:25.990051',10,1,1,1,NULL,'Faltó tiempo',NULL),(14,'SH10VU','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAYYAAAGGAQAAAABX+xtIAAACW0lEQVR4nO2cTY7iMBCFX40tsUykOVBygznSaG6WHIUDIDnLkWK9WfinE2BDqxN6rJcFCphPFCrKr34sjHjtij9eBAARIkSIECFChAgRhxCz5SvdjYsHZvMAEMtSf7pVIg4hQJLk1JEkV5BcAdSnU7feveV7fg8RnyBijuS5BzBcPczMA0NA2gXeY5WIM4jheiH/9EjutvGIzxDxVsI/vhSNQ/iZ7jn3tzdYJeJI4kHPJzhiuNd46XlDRInzpQp2dzPO/c0TiJ7zrxvyUneeVSKOJHIQ7y8M6WF9sqo4b4WY+2gAotkIgNPiAcDRRgA2IlpK6M+1SsQhRInk4IghOAJwBLoVnLoc7CnsS83+Pb+HiBeunc8BDMFx4+70EwCgHK4Zoibl1b8dNw9J3uudfN4SsVzIqftrZIgGLB6cUKQ8NeP6860ScQSx6ckYcKHlzTwahqtfy1r0qtWaIcreDmznKdxkcyQnOPVk2iF2et4xn44bPoZr4a6El8/bIhazXKZ96Hm3Io/T+zdZJeKLibqZA2RwZZevGXyu3wDV580QVc9d3dZZ6vNQSnOW1+TzFoiNWCd31/SNaaQWpOetEdu8nQGlz1oT9Sm9q8xX5fMGiIfJ2VRb7Si5fKnk5POmiI9zr1g8bFzM0impCdE2Rdy5Vok4hHg89xrcLsRrT0Z63gqx78nkPlxayHMXANLzpoinPifLGDW3XSE9b5mYzcqZmG6F/WYOdhvfaZWILySe6/kQ3P7MhPS8IWJTn6eneYZWCzbUpqz29kYI0/9MiBAhQoQIESJE/HfEPyFsn+wsaYAIAAAAAElFTkSuQmCC','cancelled','2026-04-14 19:04:11.062948','2026-04-14 19:17:37.188251','2026-04-14 19:03:35.737731','2026-04-14 19:17:37.188437',4,1,1,1,NULL,'Faltó tiempo',NULL),(15,'HUVIOS','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAYYAAAGGAQAAAABX+xtIAAACV0lEQVR4nO2cTYrbQBBGX6UFs5QgB2rfLORm0lHmAIH2MmBRWfSPNFaymIDscfNpISzJD0qUq+qr7sLmfO5Yv30SABEiRIgQIUKECBGnEIuVgyWfBuxyHQDW+mh6uFUiTiFwd3efR3d3v+Hut/JgHm/l9OErX/M9RPwHsZZIXmzAZ8B+vA8QEzkLPMcqEScQw/2NmCYs+jr4MoHF+RlWiTiTOPgcwJfpFxbTlD893ioRZxKHej4DkC+3Gq963iFxNTOzARhv+MxqLNNqLBNk2X55glUiziDw+yMBsSr4w1PF+esTLXHXNi2m4D4TcjInunv+CSi390LsNJzFObgtU8Bi+t5urwMQ3BgfZ5WIM4ka54Sc1n0m7KIbCHm3VXHeDdF83ip7guLuKt4/yviv+R4iPnFUTwevkj047Or5DaJ6tZ6IXfOdXdskHTGF5vMt7OXzlyd2un2L83JJKGm9yXj5vAdi34E3IQdjC+x018LL5y9PfNRwN4qTUxHqJbcnxXlHxE6tlzj3JuRG97yXGhOonndD7PrzstxGC/FUW/Mm8+TzHohdsS4tWS7qNeJVz7slFquzb5d8ApYpeN1XG8j3HmuViFOIw87Ztr2yifcZrb32R2xzr4y/jfhuRnx/87yTzuh+TzzCKhGnEP+Ye91CvK3JqJ73QhzW4TblVhbjAOpem3zeA3H0eYIS57TpCVTPOyIOc6/LBZzrmxtjwmIt5JqZ6Ib4Sz2vkn0/M6F63iHR5l5Lpw7+cwoOrJbz/TI93ioRZxCm/5kQIUKECBEiRIh4OeIPyxK9146NI38AAAAASUVORK5CYII=','cancelled','2026-04-14 19:18:20.529514','2026-04-14 19:31:52.429570','2026-04-14 19:17:46.726706','2026-04-14 19:31:52.429746',11,1,NULL,1,NULL,'Faltó tiempo',NULL),(16,'J1KE12','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAYYAAAGGAQAAAABX+xtIAAACgUlEQVR4nO2cUYrjMAyGP20M8+jcoEdJbrBHGvZIe4P4KHOAQvxYcNA+2E7bySxMYZN2jfxQStSPyriyf8miojw2lh8PAmCEEUYYYYQRRhhhxC5EkDKARWSMIgDIyFJN/eFeGbELgaqq6uRVVTWhOoNOdMowg04+ffrIa87DiO8PV98sDvwZoEuCP4uGHgQPhBHWnO4152HE94fbPPEXYfjtEPzZKSxP8MqIY4no0AlgmIHQ7/EdRrwE0anqDISTqox0CnQqI8CgqlviCK+M2IGoe3uU9dHiNJwuoqE/Ow0/oZj8cV4ZsSdRRPntSOSX6Wvra87DiAfGNRGryZnmbR28asnabM1bImokz53W1S9JOusZn62Wn7dC1DiHItSHuct6LT/DpyrjLc4bIaqG82enxC5J6BENY5fAzwjxTeWOeM15GPHAuCo3hqtym4H7vT0f7xbnDRA3yhzoimjLO3rWdd2q5W3N2yKiQyd/EfAX0Sm+6U1FLvRg92rNELe5Wt7MVxlf0rRUdJ1puNaI6GCYy105oV9E3meA+FZU/TO8MmIPgs+BXYK9nOc6+VTSNMvPWyG2PRPbEk3J2W3NGyHuczW9rbiu1huDrXkDxF29XRNQczXw6w2qt1ytIWJzczZB3sxzdeZ6qFucN0Zc+15Ld8wiNc4XgdoSebBXRuxKVA1HOKVabAWkdMwssiGO8MqIPYj1PE/UY7tU3rN1Auovwvb2RokgDv3VV8me1VwUkfGZXhnxD4m/xXnN2Sdqu4TVZFoh1v72fGwDsc8vOnwIip+zXUzDtUZEERFxudeZ0uZcep3l/cNtiSO8MmIPQux/JowwwggjjDDCCCP+O+IPVBBtMwEN2zgAAAAASUVORK5CYII=','cancelled','2026-04-14 19:32:34.146075','2026-04-14 19:40:45.972093','2026-04-14 19:32:01.511411','2026-04-14 19:40:45.972207',12,1,NULL,1,NULL,'Faltó tiempo',NULL),(17,'FH1L7M','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAYYAAAGGAQAAAABX+xtIAAACbUlEQVR4nO2cTa6bMBCAv6mR3tJI7wA5CtygR3rqzfBRcoBKeBkJNF3YBvLYNFUhiTVeEAvnUwZN5s/jRJTHxvzjQQCMMMIII4wwwggjjDiECJIHRBFCCyItSM9cltrTpTLiEAJVVdXBq6rqhOrolE415fM6+OnbW17zOYz4B2JeLHkWHdIFpIfkBZ4jlRGnEH5C+thAl8z+NaQy4mgiXCYILflyyGcY8SxiF88HP0G3BnWL59URTX6Nsrmp4XITDe3vRsNPyEv+PKmMOJLIRrwZI9CV2W7V7Pz9iY3jphshzcBlZz6QvbzpvBpia8lJ8Zq1D7hi7KOzeF4PUXQ+kouzAVe+AkDK4QYo/t50/v5Es041iNOUr4XeTeBHhPihcke85nMY8cAobn2i1GrZzLn37WC+vRJiE8/pRlc8esnh0r20EW++vTIiStplh5TI3QRik0P50mY7WyojDiTCZUJ6nEJsyBdAen8T+bp+LLn8az+HEX8zFp8NpG1XcmclbcCOTtf+qvn2GoiNzktQL13ztCfjp1ymWX1eGRHafCZGf7VOIW6cORAbpD9fKiMOIe7y9uUCTtfV0mEzO6+D+L7fnkaXwruWHzx4q9UqInads6V/rgNsg7rZeWXEeu61uzZsKnWYBXBWq9VH+FKw5WNROZ5LqtmT4s+XyogjiM1+ew7bI2mWVgegfCPMt1dKhDZrOjda/AREEemfKZUR/5HY27nebcIM64kZy+EqIZb+eQrbQPxUIX5OdFdB8WNaF8vhaiOiiIg0y4H2WaTHqfSAfF2bPXGGVEYcQYj9z4QRRhhhhBFGGGHE2xF/AL7jaU5ZsBX6AAAAAElFTkSuQmCC','cancelled','2026-04-14 19:41:30.743544','2026-04-14 20:06:55.866205','2026-04-14 19:40:54.951770','2026-04-14 20:06:55.866303',8,1,NULL,1,NULL,'Problemas técnicos',NULL),(18,'3NVWJL','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAYYAAAGGAQAAAABX+xtIAAACfklEQVR4nO2cTarjMAyAP40NXTo3mKMkN3hHmjPNDZKj9AAPkmXBRrOwnaT0bQqTtDXypk3MBzKqfiyJivLcSr+eBMAII4wwwggjjDDCiEOIScqCRYSpK9sykOpWd7pURhxC+PIZZoDkARcFJL/Wqfsmp/bT13lSGXEKkTZLBoIq/QwyQPYCr5HKiAMI//Am3ERZBIXoFdILpDLiXGK5qAw4zUF9jewvlsqI/0esdu4USDANDoWIEJwKAej3xbr3PIcRzxOLiIh4INyEqUuiI0l0BHLaPrxAKiOOINCf1hgiOv64G9/zHEY8saqSS6KuI0CvsW7glN503hKxqhZ0DEXJZc1OVWfI38ZgOm+DWO08ojoDvapmOx8BqF6+Grvp/OOJkrf3V4/0f11kEoClA8KMsFxU7oj3PIcRT6x92J5LPM/hHfa+Hcy3N0Kwi91Z02tQL3mdU9U1pTOdN0Dc116TV0ieXpMoi4/KAkxf30hpw7zpOYx4nggRwKlI5xSWSy69yRBuIn+ul+z5z5bKiCOIXd5etJpDOdDPrvr2ebukm2//eGKN51A6qEW19boeYrmm2f28FWJ/Px+pKXvJ3DYHYHl7Q8SWjwM4LZWY3GYru7lOYzpvhbirw+Xqm6s/gTWyE+yu1hDx0Dkbw97id0Hd7LwxYpt77Wegn5NUO08CtUp3slRGHEI8zL1Og1OmzkWAPCxDGYg9TyojjiT29/M1bNcSDWtzbfP95tvbI/JY1OLvtL/YbFRDxKOdz1A6bEF33RaryTRDPMy9EqJn+h09/VXQ2llBLIdrhdjNRuXHsXbNt+pbqbxbPG+EEPufCSOMMMIII4wwwoiPI/4BtAtTvV9hqqQAAAAASUVORK5CYII=','cancelled','2026-04-14 20:14:08.702627','2026-04-14 23:24:56.431983','2026-04-14 20:07:28.562189','2026-04-14 23:24:56.432115',13,1,NULL,1,NULL,'Probando el juego',NULL),(19,'ASXKCA','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAYYAAAGGAQAAAABX+xtIAAACZklEQVR4nO2cTY7iMBCF35tEYuncoI/i3GCO1JqbxUfpAyAlS6RYNQv/EKAXw8LQYz0vQmTnkyoqyvVnoOG5EX89CQAiRIgQIUKECBEimhCBeSBwBGcAnLcRAGJZml4ulYimhDMzsx3wa56xPx8XIkyAmZnZ8gapRDQlYrbkMEUCGwlsY/4KBJLvkUpEA2K8n/AWRwP2tEC/vEMqES2JB51jm9In/TrBwnR+g1QiWhLFWRd/bgsGg1+H49zNIz/zPUT8+yh2vlWH7c608HGhAXG08PuMvOReJ5WIlkQ24tsBn6x7/2ZVdt4LkaJ1RHJGJLCdjJwG4wwgzYXp5VKJaEsMVi4A4HaUhDwSQNb+y6US0ZYgp6xfAJH8XCMReDIEkqrJdENUj70DPoXn2ZWX2pzZ9U7+vCdiG5GrbxiM83ZKxVbOiMzFuOn1UoloQdwU052ZWUnN4dchRfDpUkryP/M9RDwxDhlaityc1eNSQ97WFwyqyfRDHIpsqMG7La4a9nqXwkvn/RCRtrgLAXchP79GZH/udqROuvx5L8TN3n5I0vO2nsK31FPX3t4JcYjh7jM0v+YSzXX7l857IA75eWqpoYTsud6+yp/3RlQ7rza9AodAfUlPDZYqNtJ5B8RD52wBUkUOqMH7AkB7e2/E9dxrStI3Ev7rZLYgMu33b5BKRBPi4ZxMvWQTrzUZ+fNeiKrzHcnErUbraS4N+fOOiG91fo3ccjQH+fOOiIdzr2Eeyq1bQV8cOXUerhfi0Z/fddNqDV7+vBfi7odJh77a4a72V6XzHgjqfyZEiBAhQoQIESL+O+IvXMF0gTCMymcAAAAASUVORK5CYII=','cancelled','2026-04-14 23:25:45.357884','2026-04-16 01:15:56.627067','2026-04-14 23:25:14.550702','2026-04-16 01:15:56.627357',14,1,1,1,NULL,'Problemas técnicos',NULL),(20,'RWABLH','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAYYAAAGGAQAAAABX+xtIAAACaklEQVR4nO2cTYrjMBCFX40Ms5ShD5CjKDeYIw1zs/gofYCAvGyQqFmoJNsdBsbQjtPiaRESKx8pUaly/SWi2Lfyj50AQIIECRIkSJAgQeIQYhJb9Xouz+SKXLfGp0tF4lDCq6pqKi9ERqdynUX0zwioqqreTpCKxKFEbpacBSEudo7iBc6RisQBxPBwZX5TTAJguqRBgXyCVCSeS3hz8MWZT+MRn0HiTKLZuVMAGZiuLgH+PkiIUIEHENbFutc8B4n/X1Xnc7th+7soAOg03gedfgG25Z8nFYkjCQvKVysCevMWqD/sanrNc5DYsSwR86oIEdAbnCJoahmaUwTqvCdim3y7qnivCsCZ2Wt05WtBnfdAbOxcU7FzUzIAwCeL4APtvBNim587FYvhsih8hGD+qbJ5z2ueg8SOVSM31/IxV65g69tbefY1z0Fix1qFaqZV1eUGjhBdKcQzhuuO8B+it1J0zyJySQDmYVWMY1+tG2IdtxebjpawLVkbQlwSNtr5tydWVZfyOsTlwVXfTp33RKxiuJqVA5aheVW9+WRpGvPzXoiWn1s3rVh3C95N54zbeyI2vt20ClibzXYR1ruveQ4SO9ZSh1ONAMzEE4Ctq2eu1gvx0Dkz7VvtdXVTp513Rixzr+F9gMiYpdp5FrTmy5OlInEo0W7l05jFynIA5GoDNJyB7IfYxO0+Wd+0TT3X5tri++nb+yOmy4dgGmvIXkYiZxG5nikViS8k/mXnNZorVVjPmkyPhGu5GmzCObyLLKPP8jueIBWJA4hPP0yqY1Gb6ht7LH0Rwv+ZIEGCBAkSJEiQ+HbEX9qLa2e3wcADAAAAAElFTkSuQmCC','cancelled','2026-04-16 01:16:58.320428','2026-04-16 01:55:52.854990','2026-04-16 01:16:17.692375','2026-04-16 01:55:52.855208',15,NULL,1,1,NULL,'Problemas técnicos',NULL),(21,'LG7DBY','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAYYAAAGGAQAAAABX+xtIAAACTklEQVR4nO2cTY7jIBCFX429x9IcIEfBV+ub2UfpA7RElpGM3iz4Men0YtJqJ2n0WCDL+JOxiqIeBYkR95X4504AECFChAgRIkSIEHEIsVouWG2EzecRNqemWJqmh/dKxCEESJJcHElyAxnae/DcPj3ymt8h4htErJ48EEA0+PcRWCekWeA5vRLxCGKd8oXZ6WLw4YB3iHhBYrURXADwbTrqHSKeRYzlIs3o6dp8+LvBhwiDA+DbZN1rfoeI+4mzmZmNANzF+Ha6GNYJydmTbJ+f0CsRRxBZlO9lAQBPEj7ctkq390MkeT5Fs9mRwHkEgIE21wmgiLuX/g4R/1Oy+waACwZySZEd4OK2VOWi9XknRJ29SzpmccyG92kwlCvlZHoh2iRb9fPi+wP3cSA/74Zo53ZyQ3bx0FYkWdxeNv/9RKvMa9K90e05ng/y836I6udFuVWfblu5QfG8G6LEcwwlqBe1nuP5PgRk806IanMg7ZsmDReANp5X8S6bd0BcbY4nx94AuFylwQDp9p6Iq/U5i5F9yFVJ1kDxvB/iSqXt8vwrSSebd0J8judpRmcN5Ut6alAerh/ii321oeyWO1YtT9m8O2I/95qOwpGEfzezGdGAs87DdUTcnnvdq1DX7MrD9URUm7eLs7I+359SPO+Z8GGg2YlMhyT8vmZ/Zq9E/CAx3t6KlkWc+xi5nrK502nIB/VKxEOIknGFI21GNC7pB0wx/Z7pOb0ScQDRrs+BJt2W8+1wLDvpyrd3Qpj+Z0KECBEiRIgQIeLXEf8A9AGb9JWAxGYAAAAASUVORK5CYII=','completed','2026-04-16 01:57:01.270196','2026-04-16 03:33:59.390513','2026-04-16 01:56:22.582710','2026-04-16 03:33:59.390722',3,NULL,4,1,NULL,NULL,NULL);
/*!40000 ALTER TABLE `game_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `general_knowledge_questions`
--

DROP TABLE IF EXISTS `general_knowledge_questions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `general_knowledge_questions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `question` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `option_a` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `option_b` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `option_c` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `option_d` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `correct_answer` int NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `general_kno_is_acti_092043_idx` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `general_knowledge_questions`
--

LOCK TABLES `general_knowledge_questions` WRITE;
/*!40000 ALTER TABLE `general_knowledge_questions` DISABLE KEYS */;
INSERT INTO `general_knowledge_questions` VALUES (1,'¿Cuál es la capital de Francia?','Londres','París','Madrid','Roma',1,1,'2025-11-26 14:17:13.468245','2025-11-26 14:17:13.468245'),(2,'¿En qué año llegó el hombre a la Luna?','1965','1969','1972','1975',1,1,'2025-11-26 14:17:13.473535','2025-11-26 14:17:13.473535'),(3,'¿Cuál es el océano más grande del mundo?','Atlántico','Índico','Pacífico','Ártico',2,1,'2025-11-26 14:17:13.479535','2025-11-26 14:17:13.479535'),(4,'¿Quién pintó la Mona Lisa?','Picasso','Van Gogh','Leonardo da Vinci','Miguel Ángel',2,1,'2025-11-26 14:17:13.484767','2025-11-26 14:17:13.484767'),(5,'¿Cuál es el planeta más cercano al Sol?','Venus','Tierra','Mercurio','Marte',2,1,'2025-11-26 14:17:13.488731','2025-11-26 14:17:13.488731'),(6,'¿Cuántos continentes hay en el mundo?','5','6','7','8',2,1,'2025-11-26 14:17:13.492941','2025-11-26 14:17:13.492941'),(7,'¿Cuál es el río más largo del mundo?','Amazonas','Nilo','Misisipi','Yangtsé',0,1,'2025-11-26 14:17:13.497941','2025-11-26 14:17:13.497941'),(8,'¿En qué continente está Egipto?','Asia','Europa','África','América',2,1,'2025-11-26 14:17:13.503150','2025-11-26 14:17:13.503150'),(9,'¿Cuál es la montaña más alta del mundo?','K2','Kilimanjaro','Everest','Aconcagua',2,1,'2025-11-26 14:17:13.507150','2025-11-26 14:17:13.507150'),(10,'¿Quién escribió \'Don Quijote de la Mancha\'?','Gabriel García Márquez','Miguel de Cervantes','Pablo Neruda','Mario Vargas Llosa',1,1,'2025-11-26 14:17:13.512328','2025-11-26 14:17:13.512328'),(11,'¿Cuál es el elemento químico más abundante en el universo?','Oxígeno','Hidrógeno','Helio','Carbono',1,1,'2025-11-26 14:17:13.516369','2025-11-26 14:17:13.516369'),(12,'¿En qué año comenzó la Segunda Guerra Mundial?','1937','1939','1941','1943',1,1,'2025-11-26 14:17:13.521334','2025-11-26 14:17:13.521334'),(13,'¿Cuál es el país más grande del mundo?','China','Estados Unidos','Rusia','Canadá',2,1,'2025-11-26 14:17:13.525598','2025-11-26 14:17:13.525598'),(14,'¿Qué instrumento tocaba Mozart?','Violín','Piano','Flauta','Todos los anteriores',3,1,'2025-11-26 14:17:13.530092','2025-11-26 14:17:13.530092'),(15,'¿Cuál es el animal más rápido del mundo?','Guepardo','León','Águila','Pez vela',0,1,'2025-11-26 14:17:13.535339','2025-11-26 14:17:13.535339'),(16,'¿Cuántos huesos tiene el cuerpo humano adulto?','196','206','216','226',1,1,'2025-11-26 14:17:13.541372','2025-11-26 14:17:13.541372'),(17,'¿Cuál es la velocidad de la luz?','300,000 km/s','150,000 km/s','450,000 km/s','600,000 km/s',0,1,'2025-11-26 14:17:13.548591','2025-11-26 14:17:13.549593'),(18,'¿En qué país está la Torre Eiffel?','Italia','España','Francia','Alemania',2,1,'2025-11-26 14:17:13.559018','2025-11-26 14:17:13.559018'),(20,'¿Qué es la fotosíntesis?','Proceso de respiración de las plantas','Proceso por el cual las plantas producen su alimento','Proceso de reproducción de las plantas','Proceso de crecimiento de las plantas',1,1,'2025-11-26 14:17:13.573460','2025-11-26 14:17:13.573460');
/*!40000 ALTER TABLE `general_knowledge_questions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `learning_objectives`
--

DROP TABLE IF EXISTS `learning_objectives`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `learning_objectives` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` longtext COLLATE utf8mb4_unicode_ci,
  `evaluation_criteria` longtext COLLATE utf8mb4_unicode_ci,
  `pedagogical_recommendations` longtext COLLATE utf8mb4_unicode_ci,
  `estimated_time` int DEFAULT NULL,
  `associated_resources` longtext COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `stage_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `learning_ob_stage_i_1b85ec_idx` (`stage_id`),
  KEY `learning_ob_is_acti_0b73ef_idx` (`is_active`),
  CONSTRAINT `learning_objectives_stage_id_9248a876_fk_stages_id` FOREIGN KEY (`stage_id`) REFERENCES `stages` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `learning_objectives`
--

LOCK TABLES `learning_objectives` WRITE;
/*!40000 ALTER TABLE `learning_objectives` DISABLE KEYS */;
/*!40000 ALTER TABLE `learning_objectives` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `minigames`
--

DROP TABLE IF EXISTS `minigames`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `minigames` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `config` json DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `minigames_is_acti_7fdda0_idx` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `minigames`
--

LOCK TABLES `minigames` WRITE;
/*!40000 ALTER TABLE `minigames` DISABLE KEYS */;
/*!40000 ALTER TABLE `minigames` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `peer_evaluations`
--

DROP TABLE IF EXISTS `peer_evaluations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `peer_evaluations` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `criteria_scores` json NOT NULL,
  `total_score` int NOT NULL,
  `tokens_awarded` int NOT NULL,
  `feedback` longtext COLLATE utf8mb4_unicode_ci,
  `submitted_at` datetime(6) NOT NULL,
  `game_session_id` bigint NOT NULL,
  `evaluated_team_id` bigint NOT NULL,
  `evaluator_team_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `peer_evaluations_evaluator_team_id_evalua_6adfd797_uniq` (`evaluator_team_id`,`evaluated_team_id`,`game_session_id`),
  KEY `peer_evalua_evaluat_41ec08_idx` (`evaluator_team_id`),
  KEY `peer_evalua_evaluat_813a7f_idx` (`evaluated_team_id`),
  KEY `peer_evalua_game_se_cf2369_idx` (`game_session_id`),
  CONSTRAINT `peer_evaluations_evaluated_team_id_c19f8124_fk_teams_id` FOREIGN KEY (`evaluated_team_id`) REFERENCES `teams` (`id`),
  CONSTRAINT `peer_evaluations_evaluator_team_id_248009cc_fk_teams_id` FOREIGN KEY (`evaluator_team_id`) REFERENCES `teams` (`id`),
  CONSTRAINT `peer_evaluations_game_session_id_fd7c8f42_fk_game_sessions_id` FOREIGN KEY (`game_session_id`) REFERENCES `game_sessions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `peer_evaluations`
--

LOCK TABLES `peer_evaluations` WRITE;
/*!40000 ALTER TABLE `peer_evaluations` DISABLE KEYS */;
/*!40000 ALTER TABLE `peer_evaluations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `professor_access_codes`
--

DROP TABLE IF EXISTS `professor_access_codes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `professor_access_codes` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `email` varchar(254) COLLATE utf8mb4_unicode_ci NOT NULL,
  `access_code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_used` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `used_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `access_code` (`access_code`),
  KEY `professor_a_email_a5c55d_idx` (`email`),
  KEY `professor_a_access__60970d_idx` (`access_code`),
  KEY `professor_a_is_used_157546_idx` (`is_used`),
  KEY `prof_access_code_lookup_idx` (`access_code`,`is_used`,`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `professor_access_codes`
--

LOCK TABLES `professor_access_codes` WRITE;
/*!40000 ALTER TABLE `professor_access_codes` DISABLE KEYS */;
/*!40000 ALTER TABLE `professor_access_codes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `professors`
--

DROP TABLE IF EXISTS `professors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `professors` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `access_code` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `user_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  UNIQUE KEY `access_code` (`access_code`),
  KEY `professors_user_id_88fbd9_idx` (`user_id`),
  KEY `professors_access__6616cd_idx` (`access_code`),
  CONSTRAINT `professors_user_id_5d848ad9_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `professors`
--

LOCK TABLES `professors` WRITE;
/*!40000 ALTER TABLE `professors` DISABLE KEYS */;
INSERT INTO `professors` VALUES (1,NULL,'2026-04-10 17:21:24.483290','2026-04-10 17:21:24.483334',1);
/*!40000 ALTER TABLE `professors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reflection_evaluations`
--

DROP TABLE IF EXISTS `reflection_evaluations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reflection_evaluations` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `student_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `student_email` varchar(254) COLLATE utf8mb4_unicode_ci NOT NULL,
  `career` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `value_areas` json NOT NULL,
  `satisfaction` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entrepreneurship_interest` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `comments` longtext COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(6) NOT NULL,
  `game_session_id` bigint NOT NULL,
  `faculty` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `reflection__game_se_728398_idx` (`game_session_id`),
  KEY `reflection__student_836c1c_idx` (`student_email`),
  CONSTRAINT `reflection_evaluatio_game_session_id_22c4e282_fk_game_sess` FOREIGN KEY (`game_session_id`) REFERENCES `game_sessions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reflection_evaluations`
--

LOCK TABLES `reflection_evaluations` WRITE;
/*!40000 ALTER TABLE `reflection_evaluations` DISABLE KEYS */;
/*!40000 ALTER TABLE `reflection_evaluations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roulette_challenges`
--

DROP TABLE IF EXISTS `roulette_challenges`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roulette_challenges` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `description` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `challenge_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `difficulty_estimated` int NOT NULL,
  `token_reward_min` int NOT NULL,
  `token_reward_max` int NOT NULL,
  `stages_applicable` json DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `roulette_ch_challen_ddbd15_idx` (`challenge_type`),
  KEY `roulette_ch_is_acti_977e2a_idx` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roulette_challenges`
--

LOCK TABLES `roulette_challenges` WRITE;
/*!40000 ALTER TABLE `roulette_challenges` DISABLE KEYS */;
/*!40000 ALTER TABLE `roulette_challenges` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `session_groups`
--

DROP TABLE IF EXISTS `session_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `session_groups` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `total_students` int NOT NULL,
  `number_of_sessions` int NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `course_id` bigint NOT NULL,
  `professor_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `session_gro_profess_20eb21_idx` (`professor_id`),
  KEY `session_gro_course__2145cd_idx` (`course_id`),
  CONSTRAINT `session_groups_course_id_b808e141_fk_courses_id` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`),
  CONSTRAINT `session_groups_professor_id_2d33326a_fk_professors_id` FOREIGN KEY (`professor_id`) REFERENCES `professors` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `session_groups`
--

LOCK TABLES `session_groups` WRITE;
/*!40000 ALTER TABLE `session_groups` DISABLE KEYS */;
/*!40000 ALTER TABLE `session_groups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `session_stages`
--

DROP TABLE IF EXISTS `session_stages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `session_stages` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `started_at` datetime(6) DEFAULT NULL,
  `completed_at` datetime(6) DEFAULT NULL,
  `game_session_id` bigint NOT NULL,
  `stage_id` bigint NOT NULL,
  `current_presentation_team_id` int DEFAULT NULL,
  `presentation_order` json DEFAULT NULL,
  `presentation_state` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `presentation_timestamps` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_stages_game_session_id_stage_id_36ac96ff_uniq` (`game_session_id`,`stage_id`),
  KEY `session_sta_game_se_80d31a_idx` (`game_session_id`),
  KEY `session_sta_stage_i_9da390_idx` (`stage_id`),
  KEY `session_sta_status_9dc993_idx` (`status`),
  CONSTRAINT `session_stages_game_session_id_fd63e682_fk_game_sessions_id` FOREIGN KEY (`game_session_id`) REFERENCES `game_sessions` (`id`),
  CONSTRAINT `session_stages_stage_id_61fec690_fk_stages_id` FOREIGN KEY (`stage_id`) REFERENCES `stages` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `session_stages`
--

LOCK TABLES `session_stages` WRITE;
/*!40000 ALTER TABLE `session_stages` DISABLE KEYS */;
INSERT INTO `session_stages` VALUES (1,'in_progress','2026-04-14 14:21:49.455730',NULL,8,1,NULL,NULL,'not_started',NULL),(2,'in_progress','2026-04-14 14:29:45.404302',NULL,10,1,NULL,NULL,'not_started',NULL),(3,'in_progress','2026-04-14 17:46:35.173774',NULL,11,1,NULL,NULL,'not_started',NULL),(4,'in_progress','2026-04-14 18:49:03.651687',NULL,12,1,NULL,NULL,'not_started',NULL),(5,'in_progress','2026-04-14 18:55:37.689532',NULL,13,1,NULL,NULL,'not_started',NULL),(6,'in_progress','2026-04-14 19:04:19.669172',NULL,14,1,NULL,NULL,'not_started',NULL),(7,'in_progress','2026-04-14 23:25:49.643346',NULL,19,1,NULL,NULL,'not_started',NULL),(8,'completed','2026-04-16 01:17:11.107082','2026-04-16 01:35:10.638356',20,1,NULL,NULL,'not_started',NULL),(9,'completed','2026-04-16 01:57:04.882503','2026-04-16 01:57:29.464575',21,1,NULL,NULL,'not_started',NULL),(10,'completed','2026-04-16 03:32:58.765630','2026-04-16 03:33:17.846258',21,2,NULL,NULL,'not_started',NULL),(11,'completed','2026-04-16 03:33:23.015974','2026-04-16 03:33:28.968238',21,3,NULL,NULL,'not_started',NULL),(12,'completed','2026-04-16 03:33:31.901903','2026-04-16 03:33:52.291467',21,4,68,'[69, 68]','evaluating','{\"68\": \"2026-04-16T03:33:51.068595+00:00\", \"69\": \"2026-04-16T03:33:47.031659+00:00\", \"_reflection\": true, \"_reflection_started_at\": \"2026-04-16T03:33:59.380149+00:00\"}');
/*!40000 ALTER TABLE `session_stages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stage_duration_metrics`
--

DROP TABLE IF EXISTS `stage_duration_metrics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stage_duration_metrics` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `total_completions` int NOT NULL,
  `total_duration_seconds` double NOT NULL,
  `avg_duration_seconds` double NOT NULL,
  `last_updated` datetime(6) NOT NULL,
  `stage_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stage_duration_metrics_stage_id_d473df5f_uniq` (`stage_id`),
  CONSTRAINT `stage_duration_metrics_stage_id_d473df5f_fk_stages_id` FOREIGN KEY (`stage_id`) REFERENCES `stages` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stage_duration_metrics`
--

LOCK TABLES `stage_duration_metrics` WRITE;
/*!40000 ALTER TABLE `stage_duration_metrics` DISABLE KEYS */;
INSERT INTO `stage_duration_metrics` VALUES (1,2,1104.1133459999999,552.0566729999999,'2026-04-16 01:57:29.471195',1),(2,1,19.080628,19.080628,'2026-04-16 03:33:17.861090',2),(3,1,5.952264,5.952264,'2026-04-16 03:33:28.980227',3),(4,2,40.779128,20.389564,'2026-04-16 03:33:59.386928',4);
/*!40000 ALTER TABLE `stage_duration_metrics` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stages`
--

DROP TABLE IF EXISTS `stages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stages` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `number` int NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` longtext COLLATE utf8mb4_unicode_ci,
  `objective` longtext COLLATE utf8mb4_unicode_ci,
  `estimated_duration` int DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `number` (`number`),
  KEY `stages_number_09a69d_idx` (`number`),
  KEY `stages_is_acti_aa6986_idx` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stages`
--

LOCK TABLES `stages` WRITE;
/*!40000 ALTER TABLE `stages` DISABLE KEYS */;
INSERT INTO `stages` VALUES (1,1,'Trabajo en Equipo','Primera etapa del juego enfocada en trabajo colaborativo','Fomentar el trabajo en equipo y la colaboración',60,1,'2026-04-14 14:15:15.046974','2026-04-14 14:15:15.047031'),(2,2,'Empatía','Conocer problemas y abordar un caso o desafío',NULL,30,1,'2025-11-04 23:18:44.809000','2025-11-04 23:18:44.809000'),(3,3,'Creatividad','Tercera etapa del juego enfocada en la creatividad y construcción de prototipos','Crear una solución con legos',30,1,'2025-11-05 02:28:51.625000','2025-11-05 02:28:51.625000'),(4,4,'Comunicación','Cuarta etapa del juego enfocada en la comunicación y presentación del pitch','Crear y comunicar pitch',45,1,'2025-11-05 05:28:59.097000','2025-11-05 05:28:59.097000');
/*!40000 ALTER TABLE `stages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `students`
--

DROP TABLE IF EXISTS `students`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `students` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `full_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(254) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rut` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `rut` (`rut`),
  KEY `students_email_b942ac_idx` (`email`),
  KEY `students_rut_b476d2_idx` (`rut`)
) ENGINE=InnoDB AUTO_INCREMENT=54 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `students`
--

LOCK TABLES `students` WRITE;
/*!40000 ALTER TABLE `students` DISABLE KEYS */;
INSERT INTO `students` VALUES (1,'JESUS ALEJANDRO AZUAJE PEREZ','j.azuajep@udd.cl','26083316','2026-04-13 00:31:28.758765','2026-04-13 00:31:28.758808'),(2,'LEANDRO AÑASCO TELLERI','lanascot@udd.cl','21793579','2026-04-13 00:31:28.769998','2026-04-13 00:31:28.770042'),(3,'RAIMUNDO BARBOSA PETIT','r.barbosap@udd.cl','21552660','2026-04-13 00:31:28.780683','2026-04-13 00:31:28.780724'),(4,'ALEJANDRO PATRICIO BARRIENTOS VILLALOBOS','a.barrientosv@udd.cl','21594003','2026-04-13 00:31:28.790266','2026-04-13 00:31:28.790299'),(5,'BASTIÁN IGNACIO FARIÑA LARA','b.farinal@udd.cl','21756083','2026-04-13 00:31:28.798382','2026-04-13 00:31:28.798423'),(6,'MARTÍN ISAIAS GUERRERO ANCAPICHÚN','m.guerreroa@udd.cl','21605843','2026-04-13 00:31:28.808033','2026-04-13 00:31:28.808067'),(7,'MARTÍN ALEJANDRO OLIVARES ROJAS','m.olivaresr@udd.cl','21644638','2026-04-13 00:31:28.816254','2026-04-13 00:31:28.816292'),(8,'SANTIAGO ANDRÉS PAGE MUNITA','spagem@udd.cl','21612007','2026-04-13 00:31:28.825237','2026-04-13 00:31:28.825266'),(9,'SEBASTIÁN RAMORINO CARRILLO','sramorinoc@udd.cl','21782154','2026-04-13 00:31:28.835238','2026-04-13 00:31:28.835294'),(10,'AGUSTÍN EDUARDO REYES PEREIRA','a.reyesp@udd.cl','21150243','2026-04-13 00:31:28.843731','2026-04-13 00:31:28.843759'),(11,'LUCAS JEREMÍAS RIQUELME TORRES','l.riquelmet@udd.cl','21303074','2026-04-13 00:31:28.853618','2026-04-13 00:31:28.853647'),(12,'DANIEL ANDRÉS ROMERO BELTRÁN','d.romerob@udd.cl','21439688','2026-04-13 00:31:28.861496','2026-04-13 00:31:28.861528'),(13,'SEBASTIAN FERNANDO RUIZ RIFFO','s.ruizr@udd.cl','21675942','2026-04-13 00:31:28.871544','2026-04-13 00:31:28.871574'),(14,'JOSE IGNACIO SAAVEDRA HANS','jsaavedrah@udd.cl','21551254','2026-04-13 00:31:28.880625','2026-04-13 00:31:28.880660'),(15,'ÁLVARO FRANCISCO TORRES FERNÁNDEZ','a.torresf@udd.cl','21740840','2026-04-13 00:31:28.888912','2026-04-13 00:31:28.888939'),(16,'RENATO IGNACIO VARELA ROJAS','r.varelar@udd.cl','21765535','2026-04-13 00:31:28.897641','2026-04-13 00:31:28.897681'),(17,'MATÍAS ALEJANDRO VERGARA FLORES','matvergaraf@udd.cl','20914842','2026-04-13 00:31:28.907487','2026-04-13 00:31:28.907519'),(18,'CAMILA PAOLA ALBORNOZ GONZALEZ','c.albornozg@udd.cl','26094270','2026-04-13 21:58:47.124368','2026-04-13 21:58:47.124417'),(19,'AMAIA CONSTANZA ARTEAGA COINDREAU','a.arteagac@udd.cl','22398239','2026-04-13 21:58:47.143617','2026-04-13 21:58:47.143663'),(20,'ALEX OSVALDO BADILLA LÓPEZ','a.badillal@udd.cl','22461847','2026-04-13 21:58:47.155264','2026-04-13 21:58:47.155313'),(21,'ANDRÉS BISQUERTT HUDSON','a.bisquertth@udd.cl','21527786','2026-04-13 21:58:47.167140','2026-04-13 21:58:47.167186'),(22,'BENJAMÍN EDUARDO BOTELLO GALAZ','b.botellog@udd.cl','22386205','2026-04-13 21:58:47.177900','2026-04-13 21:58:47.177959'),(23,'KURT AUGUSTO BUCHHOLTZ ASTORQUIZA','k.buchholtza@udd.cl','20837048','2026-04-13 21:58:47.189173','2026-04-13 21:58:47.189222'),(24,'MARTÍN ALONSO CAMPOS LÓPEZ','m.camposl@udd.cl','22536228','2026-04-13 21:58:47.200719','2026-04-13 21:58:47.200766'),(25,'NICOLÁS ALEJANDRO CAMPOS CLARO','ni.camposc@udd.cl','22302955','2026-04-13 21:58:47.212339','2026-04-13 21:58:47.212388'),(26,'EMILIO CASTELBLANCO MEDINA','e.castelblancom@udd.cl','22407418','2026-04-13 21:58:47.223789','2026-04-13 21:58:47.223840'),(27,'NICOLÁS ALONSO CASTILLO OYANADEL','n.castilloo@udd.cl','22685263','2026-04-13 21:58:47.235317','2026-04-13 21:58:47.235364'),(28,'NICOLÁS MAXIMILIANO CASTRO PÉREZ','ni.castrop@udd.cl','22625784','2026-04-13 21:58:47.246768','2026-04-13 21:58:47.246820'),(29,'VALERIA EUNICE CHUNGA LARA','v.chungal@udd.cl','21217185','2026-04-13 21:58:47.258835','2026-04-13 21:58:47.258887'),(30,'IGNACIO ALONSO CLEMENTE BERNAL','i.clementeb@udd.cl','22232446','2026-04-13 21:58:47.271022','2026-04-13 21:58:47.271067'),(31,'AGUSTÍN ANDRÉS CONTRERAS PEÑA','ag.contrerasp@udd.cl','22255285','2026-04-13 21:58:47.282721','2026-04-13 21:58:47.282793'),(32,'LAURA SOFÍA CRUZ RAMÍREZ','l.cruzr@udd.cl','24748247','2026-04-13 21:58:47.294484','2026-04-13 21:58:47.294534'),(33,'JOAQUÍN MAURICIO DELGADO JACOB','j.delgadoj@udd.cl','22682074','2026-04-13 21:58:47.306785','2026-04-13 21:58:47.306832'),(34,'JOSÉ BENJAMÍN FERNÁNDEZ ZÚÑIGA','j.fernandezz@udd.cl','22260533','2026-04-13 21:58:47.319089','2026-04-13 21:58:47.319136'),(35,'LUCAS ISRAEL FREIRE MUÑOZ','l.freirem@udd.cl','20108212','2026-04-13 21:58:47.332275','2026-04-13 21:58:47.332320'),(36,'ALEJANDRO ANDRÉS GARCÍA ARANCIBIA','a.garciaar@udd.cl','22572155','2026-04-13 21:58:47.343819','2026-04-13 21:58:47.343870'),(37,'MARÍA JOSÉ GONZÁLEZ CORNEJO','maria.gonzalezc@udd.cl','22445863','2026-04-13 21:58:47.356349','2026-04-13 21:58:47.356399'),(38,'FERNANDO TOMÁS HASENBERG SANTELICES','f.hasenbergs@udd.cl','22048631','2026-04-13 21:58:47.369748','2026-04-13 21:58:47.369796'),(39,'AMARO INFANTE REBOLLEDO','a.infanter@udd.cl','22451479','2026-04-13 21:58:47.383774','2026-04-13 21:58:47.383827'),(40,'LUCAS KLUCK MIDDLETON','l.kluckm@udd.cl','22376215','2026-04-13 21:58:47.396136','2026-04-13 21:58:47.396180'),(41,'FELIPE ANDRÉS LEAL SALINAS','f.leals@udd.cl','22702592','2026-04-13 21:58:47.408307','2026-04-13 21:58:47.408351'),(42,'JAVIERA IGNACIA MILLAR PEZO','j.millarp@udd.cl','22446005','2026-04-13 21:58:47.419958','2026-04-13 21:58:47.420006'),(43,'VICTORIA ANTONIA MIRANDA LUTJENS','v.mirandal@udd.cl','22377298','2026-04-13 21:58:47.432044','2026-04-13 21:58:47.432085'),(44,'CRISTHIAN MOISES MUJICA MENESES','c.mujicam@udd.cl','26131859','2026-04-13 21:58:47.445196','2026-04-13 21:58:47.445245'),(45,'AGUSTÍN IGNACIO OSORIO GOICH','a.osoriog@udd.cl','22424994','2026-04-13 21:58:47.457200','2026-04-13 21:58:47.457249'),(46,'MARTÍN VICENTE PIRUL CANOUET','m.pirulc@udd.cl','22366349','2026-04-13 21:58:47.471676','2026-04-13 21:58:47.471735'),(47,'MATIAS IGNACIO RIFO SALAZAR','m.rifos@udd.cl','21938563','2026-04-13 21:58:47.484276','2026-04-13 21:58:47.484320'),(48,'LUCAS ALONSO ROMERO DONOSO','l.romerod@udd.cl','22417791','2026-04-13 21:58:47.497090','2026-04-13 21:58:47.497141'),(49,'VICENTE ELÍAS RUIZ MORALES','v.ruizm@udd.cl','22496854','2026-04-13 21:58:47.511189','2026-04-13 21:58:47.511237'),(50,'VALENTÍN NAHUEL SANCHO ROITMAN','v.sanchor@udd.cl','22435492','2026-04-13 21:58:47.524630','2026-04-13 21:58:47.524677'),(51,'CRISTIAN JESÚS TORO BRITO','c.torob@udd.cl','22562209','2026-04-13 21:58:47.537930','2026-04-13 21:58:47.537976'),(52,'MATÍAS VILLEGAS VALDÉS','m.villegasv@udd.cl','21704928','2026-04-13 21:58:47.550650','2026-04-13 21:58:47.550752'),(53,'JAVIER ALONSO ÁLVAREZ QUEVEDO','j.alvarezq@udd.cl','22634414','2026-04-13 21:58:47.563823','2026-04-13 21:58:47.563868');
/*!40000 ALTER TABLE `students` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tablet_connections`
--

DROP TABLE IF EXISTS `tablet_connections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tablet_connections` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `connected_at` datetime(6) NOT NULL,
  `disconnected_at` datetime(6) DEFAULT NULL,
  `last_seen` datetime(6) NOT NULL,
  `game_session_id` bigint NOT NULL,
  `tablet_id` bigint DEFAULT NULL,
  `team_id` bigint NOT NULL,
  `team_session_token` char(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `team_session_token` (`team_session_token`),
  KEY `tablet_conn_tablet__aebeaa_idx` (`tablet_id`),
  KEY `tablet_conn_team_id_842e97_idx` (`team_id`),
  KEY `tablet_conn_game_se_380fa9_idx` (`game_session_id`),
  KEY `tablet_conn_last_se_be9684_idx` (`last_seen`),
  CONSTRAINT `tablet_connections_game_session_id_91f1926c_fk_game_sessions_id` FOREIGN KEY (`game_session_id`) REFERENCES `game_sessions` (`id`),
  CONSTRAINT `tablet_connections_tablet_id_7ddc0d0f_fk_tablets_id` FOREIGN KEY (`tablet_id`) REFERENCES `tablets` (`id`),
  CONSTRAINT `tablet_connections_team_id_dffc7a3d_fk_teams_id` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tablet_connections`
--

LOCK TABLES `tablet_connections` WRITE;
/*!40000 ALTER TABLE `tablet_connections` DISABLE KEYS */;
INSERT INTO `tablet_connections` VALUES (1,'2026-04-13 14:33:03.923317','2026-04-13 21:58:26.980262','2026-04-13 21:58:26.982661',2,NULL,5,'d060562cb0974284a90ab0c314afe9c5'),(2,'2026-04-13 14:48:39.084529','2026-04-13 21:58:26.980262','2026-04-13 21:58:27.030858',2,NULL,6,'60f74589c5ea4c4eb26b89362e387a1a'),(3,'2026-04-13 14:49:01.517547','2026-04-13 21:58:26.980262','2026-04-13 21:58:27.037997',2,NULL,4,'0accab9e4f764b17a9e5973ebf6ea24c'),(4,'2026-04-14 13:30:23.792020','2026-04-14 13:32:58.272399','2026-04-14 13:32:58.274323',3,NULL,10,'357e9c1756154107bc91c597816bccdb'),(5,'2026-04-14 13:30:41.767606','2026-04-14 13:32:58.272399','2026-04-14 13:32:58.279082',3,NULL,8,'9c795dc60e7c43ef961fe489d7ee5bd8'),(6,'2026-04-14 13:34:21.284537','2026-04-14 13:45:06.006264','2026-04-14 13:45:06.007836',4,NULL,15,'7456cfa251d34cda8008e06cb9a1bb9c'),(7,'2026-04-14 13:34:30.961267','2026-04-14 13:45:06.006264','2026-04-14 13:45:06.012807',4,NULL,13,'20848a964fb844b8a4d05323310db1e0'),(8,'2026-04-14 13:44:44.402450','2026-04-14 13:45:06.006264','2026-04-14 13:45:06.018314',4,NULL,16,'abe4e2818945488aa1c4ff7974bf6b60'),(9,'2026-04-14 13:45:50.838013','2026-04-14 13:51:22.343815','2026-04-14 13:51:22.345261',5,NULL,18,'17893a5fe45247ae90a5927b1ae145b3'),(10,'2026-04-14 13:46:06.023625','2026-04-14 13:51:22.343815','2026-04-14 13:51:22.353515',5,NULL,19,'512f58dac06346c0a0c824eb568c79cc'),(11,'2026-04-14 13:56:14.055309','2026-04-14 13:59:43.396693','2026-04-14 13:59:43.398231',6,NULL,21,'888875f18c6e488983a7b5e1f5ceb1b9'),(12,'2026-04-14 13:56:20.103431','2026-04-14 13:59:43.396693','2026-04-14 13:59:43.445323',6,NULL,22,'04ac00eb1d1347e3a3de364d0a95421a'),(13,'2026-04-14 14:01:39.914474','2026-04-14 14:11:14.213684','2026-04-14 14:11:14.215129',7,NULL,24,'758d4699e00245e49a5cb62fc4e9cf43'),(14,'2026-04-14 14:01:43.984746','2026-04-14 14:11:14.213684','2026-04-14 14:11:14.221140',7,NULL,25,'829fbed301ed436fb8f57f800900fbfb'),(15,'2026-04-14 14:12:00.702168','2026-04-14 14:23:03.839384','2026-04-14 14:23:03.840858',8,NULL,27,'1e8b8ee86ed549e197c1cc2baa488dcb'),(16,'2026-04-14 14:12:04.081593','2026-04-14 14:23:03.839384','2026-04-14 14:23:03.848398',8,NULL,28,'2c90c34084914588a623e285f90df2a1'),(17,'2026-04-14 14:23:31.492155','2026-04-14 14:28:24.880737','2026-04-14 14:28:24.882444',9,NULL,30,'7ff476b2d45344579435ff897eaf5049'),(18,'2026-04-14 14:23:40.396643','2026-04-14 14:28:24.880737','2026-04-14 14:28:24.887978',9,NULL,31,'cae6c1821e22408c859687372ba93ab5'),(19,'2026-04-14 14:28:56.509080','2026-04-14 16:43:08.604042','2026-04-14 16:43:08.606434',10,NULL,33,'ef79f83926804e899717ce5b6c882af3'),(20,'2026-04-14 14:29:00.047176','2026-04-14 16:43:08.604042','2026-04-14 16:43:08.654879',10,NULL,34,'62e5673854bc4335aea0b3db2c61c92d'),(21,'2026-04-14 17:45:29.698929','2026-04-14 18:47:29.493737','2026-04-14 18:47:29.495751',11,NULL,36,'194efbeb07a34e0e92dcc5894d8340f9'),(22,'2026-04-14 17:45:36.671079','2026-04-14 18:47:29.493737','2026-04-14 18:47:29.517045',11,NULL,37,'30aea818fb0d4881a03e5b66f0ed32e7'),(23,'2026-04-14 18:48:40.976128','2026-04-14 18:54:36.402359','2026-04-14 18:54:36.403907',12,NULL,39,'9aa4d39d65dd4502b55629d1efd9a9a3'),(24,'2026-04-14 18:48:44.300778','2026-04-14 18:54:36.402359','2026-04-14 18:54:36.407445',12,NULL,40,'9daca539a55040589666b852f5763abf'),(25,'2026-04-14 18:55:22.332064','2026-04-14 19:03:25.978125','2026-04-14 19:03:25.979519',13,NULL,42,'7b176b0a2187453eafc5bf7a27ba3230'),(26,'2026-04-14 18:55:26.074635','2026-04-14 19:03:25.978125','2026-04-14 19:03:25.986030',13,NULL,43,'ac5a1a7d82d2428c9d01f38321aedae0'),(27,'2026-04-14 19:04:00.966546','2026-04-14 19:17:37.179598','2026-04-14 19:17:37.180744',14,NULL,45,'b89e6f06f729421ca87dee1cf1cfbd02'),(28,'2026-04-14 19:04:03.802848','2026-04-14 19:17:37.179598','2026-04-14 19:17:37.185014',14,NULL,46,'cc6446801f674902936a92445338da97'),(29,'2026-04-14 19:18:03.671855','2026-04-14 19:31:52.421111','2026-04-14 19:31:52.422339',15,NULL,48,'5c7ee5833e4b4e02aaa224ac59f1f8c0'),(30,'2026-04-14 19:18:06.939468','2026-04-14 19:31:52.421111','2026-04-14 19:31:52.426531',15,NULL,49,'c611d137f85f4cc0b4982566271f0c29'),(31,'2026-04-14 19:32:24.286256','2026-04-14 19:40:45.964375','2026-04-14 19:40:45.965531',16,NULL,51,'75a870fc45064e81bbe44f1b12762b0f'),(32,'2026-04-14 19:32:27.633650','2026-04-14 19:40:45.964375','2026-04-14 19:40:45.969069',16,NULL,52,'52fdf44cc9ac408098f612bbd98b1be6'),(33,'2026-04-14 19:41:21.185204','2026-04-14 20:06:55.855189','2026-04-14 20:06:55.856329',17,NULL,54,'64863005e08d4cfc85e1e9f42bdcbcfc'),(34,'2026-04-14 19:41:24.245223','2026-04-14 20:06:55.855189','2026-04-14 20:06:55.862355',17,NULL,55,'2faebaa7641e4f68906d0a4e007afe92'),(35,'2026-04-14 20:12:37.025541','2026-04-14 23:24:56.399414','2026-04-14 23:24:56.400787',18,NULL,59,'108cbd79b83449cabd810418069f8c89'),(36,'2026-04-14 20:13:46.521549','2026-04-14 23:24:56.399414','2026-04-14 23:24:56.427302',18,NULL,57,'31cab046f96b4e4ca78619bfc8c2b96d'),(37,'2026-04-14 23:25:34.969686','2026-04-16 01:15:56.584827','2026-04-16 01:15:56.595333',19,NULL,62,'efe516d247aa41e78e0b504c9528f910'),(38,'2026-04-14 23:25:38.064809','2026-04-16 01:15:56.584827','2026-04-16 01:15:56.621293',19,NULL,63,'838046b9d24a4b5fbfec50a3d93e5879'),(39,'2026-04-16 01:16:40.774467','2026-04-16 01:55:52.841898','2026-04-16 01:55:52.843478',20,NULL,65,'d7695f8a485a450c9da8fd42f0392dd9'),(40,'2026-04-16 01:16:43.472585','2026-04-16 01:55:52.841898','2026-04-16 01:55:52.850839',20,NULL,66,'4608d2123804432b854dac1cc97102e3'),(41,'2026-04-16 01:56:48.312573',NULL,'2026-04-16 01:56:48.312608',21,NULL,68,'f709e267ea3843fd9fb32ce30bef88fc'),(42,'2026-04-16 01:56:51.365858',NULL,'2026-04-16 01:56:51.365885',21,NULL,69,'51b069f708a04c8da1bf0d89530ed5f8');
/*!40000 ALTER TABLE `tablet_connections` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tablets`
--

DROP TABLE IF EXISTS `tablets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tablets` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tablet_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tablet_code` (`tablet_code`),
  KEY `tablets_tablet__9cb635_idx` (`tablet_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tablets`
--

LOCK TABLES `tablets` WRITE;
/*!40000 ALTER TABLE `tablets` DISABLE KEYS */;
/*!40000 ALTER TABLE `tablets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `team_activity_progress`
--

DROP TABLE IF EXISTS `team_activity_progress`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `team_activity_progress` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `started_at` datetime(6) DEFAULT NULL,
  `completed_at` datetime(6) DEFAULT NULL,
  `progress_percentage` int NOT NULL,
  `response_data` json DEFAULT NULL,
  `prototype_image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pitch_intro_problem` longtext COLLATE utf8mb4_unicode_ci,
  `pitch_solution` longtext COLLATE utf8mb4_unicode_ci,
  `pitch_closing` longtext COLLATE utf8mb4_unicode_ci,
  `activity_id` bigint NOT NULL,
  `selected_challenge_id` bigint DEFAULT NULL,
  `selected_topic_id` bigint DEFAULT NULL,
  `session_stage_id` bigint NOT NULL,
  `team_id` bigint NOT NULL,
  `pitch_value` longtext COLLATE utf8mb4_unicode_ci,
  `pitch_impact` longtext COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `team_activity_progress_team_id_activity_id_sess_b25a7a5c_uniq` (`team_id`,`activity_id`,`session_stage_id`),
  KEY `team_activi_team_id_2c8afb_idx` (`team_id`),
  KEY `team_activi_session_0d2b15_idx` (`session_stage_id`),
  KEY `team_activi_activit_e95388_idx` (`activity_id`),
  KEY `team_activi_status_00750a_idx` (`status`),
  KEY `team_activi_team_id_d1bada_idx` (`team_id`,`activity_id`),
  KEY `team_activi_session_1a4ca1_idx` (`session_stage_id`,`activity_id`),
  KEY `team_activity_progre_selected_challenge_i_b972b61d_fk_challenge` (`selected_challenge_id`),
  KEY `team_activity_progress_selected_topic_id_6bb5e15b_fk_topics_id` (`selected_topic_id`),
  CONSTRAINT `team_activity_progre_selected_challenge_i_b972b61d_fk_challenge` FOREIGN KEY (`selected_challenge_id`) REFERENCES `challenges` (`id`),
  CONSTRAINT `team_activity_progre_session_stage_id_b07378b9_fk_session_s` FOREIGN KEY (`session_stage_id`) REFERENCES `session_stages` (`id`),
  CONSTRAINT `team_activity_progress_activity_id_8a7df130_fk_activities_id` FOREIGN KEY (`activity_id`) REFERENCES `activities` (`id`),
  CONSTRAINT `team_activity_progress_selected_topic_id_6bb5e15b_fk_topics_id` FOREIGN KEY (`selected_topic_id`) REFERENCES `topics` (`id`),
  CONSTRAINT `team_activity_progress_team_id_692cd6e6_fk_teams_id` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `team_activity_progress`
--

LOCK TABLES `team_activity_progress` WRITE;
/*!40000 ALTER TABLE `team_activity_progress` DISABLE KEYS */;
INSERT INTO `team_activity_progress` VALUES (1,'pending','2026-04-14 14:21:49.455730',NULL,0,NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,1,28,NULL,NULL),(2,'pending','2026-04-14 14:21:49.455730',NULL,0,NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,1,27,NULL,NULL),(3,'pending','2026-04-14 14:29:45.404302',NULL,0,NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,2,34,NULL,NULL),(4,'pending','2026-04-14 14:29:45.404302',NULL,0,NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,2,33,NULL,NULL),(5,'pending','2026-04-14 17:46:35.173774',NULL,0,NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,3,37,NULL,NULL),(6,'pending','2026-04-14 17:46:35.173774',NULL,0,NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,3,36,NULL,NULL),(7,'pending','2026-04-14 18:49:03.651687',NULL,0,NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,4,40,NULL,NULL),(8,'pending','2026-04-14 18:49:03.651687',NULL,0,NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,4,39,NULL,NULL),(9,'pending','2026-04-14 18:55:37.689532',NULL,0,NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,5,43,NULL,NULL),(10,'pending','2026-04-14 18:55:37.689532',NULL,0,NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,5,42,NULL,NULL),(11,'pending','2026-04-14 19:04:19.669172',NULL,0,NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,6,46,NULL,NULL),(12,'pending','2026-04-14 19:04:19.669172',NULL,0,NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,6,45,NULL,NULL),(13,'completed','2026-04-14 23:25:49.643346','2026-04-16 00:11:33.020734',100,NULL,NULL,NULL,NULL,NULL,2,NULL,NULL,7,63,NULL,NULL),(14,'completed','2026-04-14 23:25:49.643346','2026-04-16 00:11:33.047191',100,NULL,NULL,NULL,NULL,NULL,2,NULL,NULL,7,62,NULL,NULL),(15,'pending','2026-04-16 00:20:12.693211',NULL,0,NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,7,63,NULL,NULL),(16,'pending','2026-04-16 00:20:12.693211',NULL,0,NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,7,62,NULL,NULL),(17,'completed','2026-04-16 01:17:11.107082','2026-04-16 01:17:47.571922',100,NULL,NULL,NULL,NULL,NULL,2,NULL,NULL,8,66,NULL,NULL),(18,'completed','2026-04-16 01:17:11.107082','2026-04-16 01:17:47.587799',100,NULL,NULL,NULL,NULL,NULL,2,NULL,NULL,8,65,NULL,NULL),(19,'completed','2026-04-16 01:35:04.857271','2026-04-16 01:35:10.595565',100,NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,8,66,NULL,NULL),(20,'completed','2026-04-16 01:35:04.857271','2026-04-16 01:35:10.622009',100,NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,8,65,NULL,NULL),(21,'completed','2026-04-16 01:57:04.882503','2026-04-16 01:57:25.283340',100,NULL,NULL,NULL,NULL,NULL,2,NULL,NULL,9,69,NULL,NULL),(22,'completed','2026-04-16 01:57:04.882503','2026-04-16 01:57:25.303292',100,NULL,NULL,NULL,NULL,NULL,2,NULL,NULL,9,68,NULL,NULL),(23,'completed','2026-04-16 01:57:25.323379','2026-04-16 01:57:29.438871',100,NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,9,69,NULL,NULL),(24,'completed','2026-04-16 01:57:25.323379','2026-04-16 01:57:29.453517',100,NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,9,68,NULL,NULL),(25,'completed','2026-04-16 03:32:58.781773','2026-04-16 03:33:10.791195',100,NULL,NULL,NULL,NULL,NULL,3,NULL,NULL,10,69,NULL,NULL),(26,'completed','2026-04-16 03:32:58.795671','2026-04-16 03:33:10.816255',100,NULL,NULL,NULL,NULL,NULL,3,NULL,NULL,10,68,NULL,NULL),(27,'completed','2026-04-16 03:33:10.835136','2026-04-16 03:33:17.812074',100,NULL,NULL,NULL,NULL,NULL,5,NULL,NULL,10,69,NULL,NULL),(28,'completed','2026-04-16 03:33:10.835136','2026-04-16 03:33:17.833467',100,NULL,NULL,NULL,NULL,NULL,5,NULL,NULL,10,68,NULL,NULL),(29,'completed','2026-04-16 03:33:23.026165','2026-04-16 03:33:28.924425',100,NULL,NULL,NULL,NULL,NULL,6,NULL,NULL,11,69,NULL,NULL),(30,'completed','2026-04-16 03:33:23.033353','2026-04-16 03:33:28.954235',100,NULL,NULL,NULL,NULL,NULL,6,NULL,NULL,11,68,NULL,NULL),(31,'completed','2026-04-16 03:33:31.912307','2026-04-16 03:33:36.758930',100,NULL,NULL,NULL,NULL,NULL,7,NULL,NULL,12,69,NULL,NULL),(32,'completed','2026-04-16 03:33:31.920409','2026-04-16 03:33:36.784580',100,NULL,NULL,NULL,NULL,NULL,7,NULL,NULL,12,68,NULL,NULL),(33,'completed','2026-04-16 03:33:36.803096','2026-04-16 03:33:52.312236',100,NULL,NULL,NULL,NULL,NULL,8,NULL,NULL,12,69,NULL,NULL),(34,'completed','2026-04-16 03:33:36.803096','2026-04-16 03:33:52.334102',100,NULL,NULL,NULL,NULL,NULL,8,NULL,NULL,12,68,NULL,NULL);
/*!40000 ALTER TABLE `team_activity_progress` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `team_bubble_maps`
--

DROP TABLE IF EXISTS `team_bubble_maps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `team_bubble_maps` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `map_data` json NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `session_stage_id` bigint NOT NULL,
  `team_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `team_bubble_maps_team_id_session_stage_id_17b57cd0_uniq` (`team_id`,`session_stage_id`),
  KEY `team_bubble_team_id_9bb24e_idx` (`team_id`),
  KEY `team_bubble_session_86d871_idx` (`session_stage_id`),
  CONSTRAINT `team_bubble_maps_session_stage_id_49de9bcb_fk_session_stages_id` FOREIGN KEY (`session_stage_id`) REFERENCES `session_stages` (`id`),
  CONSTRAINT `team_bubble_maps_team_id_fbae9ea2_fk_teams_id` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `team_bubble_maps`
--

LOCK TABLES `team_bubble_maps` WRITE;
/*!40000 ALTER TABLE `team_bubble_maps` DISABLE KEYS */;
/*!40000 ALTER TABLE `team_bubble_maps` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `team_personalization`
--

DROP TABLE IF EXISTS `team_personalization`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `team_personalization` (
  `team_id` bigint NOT NULL,
  `team_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `team_members_know_each_other` tinyint(1) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`team_id`),
  CONSTRAINT `team_personalization_team_id_711bccdd_fk_teams_id` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `team_personalization`
--

LOCK TABLES `team_personalization` WRITE;
/*!40000 ALTER TABLE `team_personalization` DISABLE KEYS */;
INSERT INTO `team_personalization` VALUES (62,'sadas',0,'2026-04-14 23:27:05.023634','2026-04-14 23:27:05.023655'),(63,'xd',0,'2026-04-14 23:26:57.056692','2026-04-14 23:26:57.056740'),(65,'Estrellita',0,'2026-04-16 01:17:35.401915','2026-04-16 01:17:35.401958'),(66,'increible',0,'2026-04-16 01:17:37.713378','2026-04-16 01:17:37.713430');
/*!40000 ALTER TABLE `team_personalization` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `team_roulette_assignments`
--

DROP TABLE IF EXISTS `team_roulette_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `team_roulette_assignments` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token_reward` int NOT NULL,
  `assigned_at` datetime(6) NOT NULL,
  `accepted_at` datetime(6) DEFAULT NULL,
  `rejected_at` datetime(6) DEFAULT NULL,
  `completed_at` datetime(6) DEFAULT NULL,
  `roulette_challenge_id` bigint NOT NULL,
  `session_stage_id` bigint NOT NULL,
  `team_id` bigint NOT NULL,
  `validated_by_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `team_roulet_team_id_af552c_idx` (`team_id`),
  KEY `team_roulet_roulett_8c9155_idx` (`roulette_challenge_id`),
  KEY `team_roulet_status_d5a38d_idx` (`status`),
  KEY `team_roulette_assign_session_stage_id_c5a1861e_fk_session_s` (`session_stage_id`),
  KEY `team_roulette_assign_validated_by_id_8dad8bd1_fk_professor` (`validated_by_id`),
  CONSTRAINT `team_roulette_assign_roulette_challenge_i_1483d73e_fk_roulette_` FOREIGN KEY (`roulette_challenge_id`) REFERENCES `roulette_challenges` (`id`),
  CONSTRAINT `team_roulette_assign_session_stage_id_c5a1861e_fk_session_s` FOREIGN KEY (`session_stage_id`) REFERENCES `session_stages` (`id`),
  CONSTRAINT `team_roulette_assign_validated_by_id_8dad8bd1_fk_professor` FOREIGN KEY (`validated_by_id`) REFERENCES `professors` (`id`),
  CONSTRAINT `team_roulette_assignments_team_id_6bae2cdf_fk_teams_id` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `team_roulette_assignments`
--

LOCK TABLES `team_roulette_assignments` WRITE;
/*!40000 ALTER TABLE `team_roulette_assignments` DISABLE KEYS */;
/*!40000 ALTER TABLE `team_roulette_assignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `team_students`
--

DROP TABLE IF EXISTS `team_students`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `team_students` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `student_id` bigint NOT NULL,
  `team_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `team_students_team_id_student_id_1fd980a1_uniq` (`team_id`,`student_id`),
  KEY `team_studen_student_28cbe0_idx` (`student_id`),
  CONSTRAINT `team_students_student_id_c1a42457_fk_students_id` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`),
  CONSTRAINT `team_students_team_id_b4fd8642_fk_teams_id` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1084 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `team_students`
--

LOCK TABLES `team_students` WRITE;
/*!40000 ALTER TABLE `team_students` DISABLE KEYS */;
INSERT INTO `team_students` VALUES (4,4,1),(3,8,1),(6,10,1),(2,14,1),(1,15,1),(5,17,1),(10,1,2),(9,2,2),(8,3,2),(7,7,2),(11,9,2),(12,16,2),(15,5,3),(13,6,3),(16,11,3),(17,12,3),(14,13,3),(121,4,4),(109,8,4),(110,10,4),(113,11,4),(114,12,4),(111,14,4),(119,5,5),(115,6,5),(118,9,5),(116,16,5),(117,17,5),(105,1,6),(107,2,6),(108,3,6),(120,7,6),(103,13,6),(106,15,6),(124,31,7),(127,36,7),(122,42,7),(129,44,7),(126,45,7),(125,47,7),(123,48,7),(128,49,7),(134,19,8),(131,22,8),(136,23,8),(135,34,8),(130,35,8),(132,43,8),(133,51,8),(138,21,9),(140,29,9),(142,32,9),(137,33,9),(143,37,9),(139,38,9),(141,40,9),(148,24,10),(147,27,10),(149,30,10),(146,39,10),(150,46,10),(145,50,10),(144,53,10),(157,18,11),(152,20,11),(156,25,11),(151,26,11),(153,28,11),(155,41,11),(154,52,11),(160,20,12),(162,22,12),(158,24,12),(159,28,12),(164,31,12),(161,37,12),(165,43,12),(163,49,12),(172,18,13),(169,19,13),(167,29,13),(171,30,13),(168,35,13),(166,50,13),(170,51,13),(179,21,14),(177,25,14),(173,33,14),(176,39,14),(178,41,14),(174,45,14),(175,47,14),(185,26,15),(186,40,15),(180,44,15),(183,46,15),(182,48,15),(184,52,15),(181,53,15),(193,23,16),(192,27,16),(191,32,16),(190,34,16),(189,36,16),(188,38,16),(187,42,16),(196,1,17),(198,2,17),(195,3,17),(199,5,17),(197,13,17),(194,16,17),(203,4,18),(200,8,18),(205,9,18),(204,10,18),(202,12,18),(201,14,18),(208,6,19),(209,7,19),(207,11,19),(206,15,19),(210,17,19),(228,1,21),(234,3,21),(231,4,21),(235,8,21),(232,9,21),(229,11,21),(236,12,21),(230,14,21),(233,17,21),(242,2,22),(237,5,22),(240,6,22),(243,7,22),(244,10,22),(238,13,22),(241,15,22),(239,16,22),(282,1,24),(279,3,24),(285,4,24),(280,8,24),(283,9,24),(286,10,24),(281,13,24),(287,14,24),(284,17,24),(293,2,25),(288,5,25),(291,6,25),(294,7,25),(295,11,25),(289,12,25),(290,15,25),(292,16,25),(330,1,27),(333,3,27),(336,4,27),(337,7,27),(334,8,27),(331,12,27),(332,14,27),(335,15,27),(338,16,27),(344,2,28),(342,5,28),(345,6,28),(339,9,28),(343,10,28),(346,11,28),(340,13,28),(341,17,28),(381,1,30),(387,3,30),(384,5,30),(382,7,30),(388,9,30),(385,12,30),(389,13,30),(383,14,30),(386,16,30),(395,2,31),(390,4,31),(396,6,31),(391,8,31),(397,10,31),(393,11,31),(394,15,31),(392,17,31),(432,1,33),(435,3,33),(438,4,33),(433,6,33),(436,9,33),(439,11,33),(440,14,33),(437,15,33),(434,16,33),(446,2,34),(441,5,34),(442,7,34),(444,8,34),(447,10,34),(448,12,34),(445,13,34),(443,17,34),(486,1,36),(489,3,36),(483,5,36),(490,6,36),(487,8,36),(484,10,36),(491,14,36),(488,15,36),(485,16,36),(497,2,37),(498,4,37),(495,7,37),(492,9,37),(499,11,37),(493,12,37),(496,13,37),(494,17,37),(551,1,39),(554,2,39),(555,5,39),(552,7,39),(557,8,39),(558,12,39),(553,14,39),(559,15,39),(556,16,39),(565,3,40),(563,4,40),(560,6,40),(561,9,40),(564,10,40),(566,11,40),(567,13,40),(562,17,40),(605,2,42),(602,3,42),(603,6,42),(608,8,42),(606,10,42),(609,11,42),(604,14,42),(607,15,42),(610,16,42),(616,1,43),(611,4,43),(614,5,43),(612,7,43),(617,9,43),(618,12,43),(615,13,43),(613,17,43),(656,1,45),(653,3,45),(659,5,45),(654,7,45),(657,9,45),(660,11,45),(661,13,45),(655,15,45),(658,16,45),(667,2,46),(665,4,46),(662,6,46),(668,8,46),(666,10,46),(669,12,46),(663,14,46),(664,17,46),(704,1,48),(705,3,48),(707,4,48),(710,6,48),(708,9,48),(711,11,48),(706,14,48),(712,16,48),(709,17,48),(713,2,49),(718,5,49),(714,7,49),(716,8,49),(719,10,49),(717,12,49),(720,13,49),(715,15,49),(758,2,51),(761,3,51),(755,5,51),(759,8,51),(762,9,51),(756,11,51),(763,13,51),(760,14,51),(757,16,51),(769,1,52),(770,4,52),(764,6,52),(767,7,52),(771,10,52),(768,12,52),(765,15,52),(766,17,52),(809,2,54),(806,3,54),(812,5,54),(810,7,54),(813,10,54),(811,11,54),(807,12,54),(808,15,54),(814,16,54),(820,1,55),(818,4,55),(815,6,55),(821,8,55),(819,9,55),(822,13,55),(816,14,55),(817,17,55),(930,18,57),(913,21,57),(914,22,57),(925,23,57),(926,24,57),(923,26,57),(915,28,57),(924,29,57),(916,30,57),(921,31,57),(920,33,57),(922,35,57),(928,36,57),(929,39,57),(919,40,57),(917,43,57),(927,46,57),(918,51,57),(902,19,59),(895,20,59),(896,25,59),(909,27,59),(912,32,59),(897,34,59),(905,37,59),(900,38,59),(910,41,59),(898,42,59),(903,44,59),(906,45,59),(908,47,59),(899,48,59),(904,49,59),(911,50,59),(907,52,59),(901,53,59),(968,1,62),(965,2,62),(969,6,62),(971,7,62),(966,10,62),(972,12,62),(967,14,62),(970,15,62),(973,17,62),(979,3,63),(974,4,63),(977,5,63),(980,8,63),(978,9,63),(975,11,63),(981,13,63),(976,16,63),(1016,1,65),(1019,4,65),(1022,5,65),(1020,8,65),(1023,9,65),(1024,11,65),(1017,12,65),(1018,14,65),(1021,17,65),(1030,2,66),(1025,3,66),(1028,6,66),(1031,7,66),(1032,10,66),(1026,13,66),(1029,15,66),(1027,16,66),(1070,1,68),(1071,4,68),(1073,5,68),(1067,6,68),(1074,9,68),(1068,10,68),(1069,13,68),(1072,16,68),(1075,17,68),(1079,2,69),(1081,3,69),(1082,7,69),(1076,8,69),(1077,11,69),(1080,12,69),(1083,14,69),(1078,15,69);
/*!40000 ALTER TABLE `team_students` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `teams`
--

DROP TABLE IF EXISTS `teams`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `teams` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tokens_total` int NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `game_session_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `teams_game_session_id_name_c9e89b99_uniq` (`game_session_id`,`name`),
  KEY `teams_game_se_7d8aab_idx` (`game_session_id`),
  KEY `teams_color_56beec_idx` (`color`),
  CONSTRAINT `teams_game_session_id_d946ac99_fk_game_sessions_id` FOREIGN KEY (`game_session_id`) REFERENCES `game_sessions` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=70 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `teams`
--

LOCK TABLES `teams` WRITE;
/*!40000 ALTER TABLE `teams` DISABLE KEYS */;
INSERT INTO `teams` VALUES (1,'Equipo Verde','Verde',0,'2026-04-13 00:31:28.978427','2026-04-13 00:31:28.978490',1),(2,'Equipo Azul','Azul',0,'2026-04-13 00:31:29.010222','2026-04-13 00:31:29.010253',1),(3,'Equipo Rojo','Rojo',0,'2026-04-13 00:31:29.038913','2026-04-13 00:31:29.038944',1),(4,'Emprendedor','Verde',0,'2026-04-13 00:47:40.507553','2026-04-13 14:49:01.473396',2),(5,'Estrellita','Rojo',0,'2026-04-13 00:47:40.532586','2026-04-13 14:33:03.906187',2),(6,'Increible','Azul',0,'2026-04-13 00:47:40.555831','2026-04-13 14:48:39.078312',2),(7,'Equipo Verde','Verde',0,'2026-04-13 21:58:47.614514','2026-04-13 21:58:47.614561',3),(8,'Estrellita','Amarillo',0,'2026-04-13 21:58:47.666725','2026-04-14 13:30:41.723724',3),(9,'Equipo Rojo','Rojo',0,'2026-04-13 21:58:47.714238','2026-04-13 21:58:47.714287',3),(10,'increible','Rojo',0,'2026-04-13 21:58:47.758915','2026-04-14 13:30:23.729870',3),(11,'Equipo Naranja','Naranja',0,'2026-04-13 21:58:47.801886','2026-04-13 21:58:47.801918',3),(12,'Equipo Verde','Verde',0,'2026-04-14 13:33:47.329113','2026-04-14 13:33:47.329137',4),(13,'Estrellita','Azul',0,'2026-04-14 13:33:47.369860','2026-04-14 13:34:30.916811',4),(14,'Equipo Rojo','Rojo',0,'2026-04-14 13:33:47.402155','2026-04-14 13:33:47.402198',4),(15,'increible','Verde',0,'2026-04-14 13:33:47.442542','2026-04-14 13:34:21.239919',4),(16,'asdas','Amarillo',0,'2026-04-14 13:33:47.472101','2026-04-14 13:44:44.380181',4),(17,'Equipo Verde','Verde',0,'2026-04-14 13:45:34.121442','2026-04-14 13:45:34.121481',5),(18,'increible','Rojo',0,'2026-04-14 13:45:34.156225','2026-04-14 13:45:50.829114',5),(19,'Estrellita','Azul',0,'2026-04-14 13:45:34.191454','2026-04-14 13:46:06.013150',5),(21,'increible','Rojo',0,'2026-04-14 13:55:49.730414','2026-04-14 13:56:14.043712',6),(22,'Estrellita','Morado',0,'2026-04-14 13:55:49.766061','2026-04-14 13:56:20.058766',6),(24,'increible','Rojo',0,'2026-04-14 14:00:50.357506','2026-04-14 14:01:39.870413',7),(25,'Estrellita','Azul',0,'2026-04-14 14:00:50.387313','2026-04-14 14:01:43.973306',7),(27,'increible','Rojo',0,'2026-04-14 14:11:30.905992','2026-04-14 14:12:00.658705',8),(28,'Estrellita','Azul',0,'2026-04-14 14:11:30.938323','2026-04-14 14:12:04.030159',8),(30,'Estrellita','Azul',0,'2026-04-14 14:23:12.435461','2026-04-14 14:23:31.483499',9),(31,'Increible','Rojo',0,'2026-04-14 14:23:12.462343','2026-04-14 14:23:40.386347',9),(33,'increible','Rojo',0,'2026-04-14 14:28:33.581441','2026-04-14 14:28:56.488078',10),(34,'Estrellita','Azul',0,'2026-04-14 14:28:33.618422','2026-04-14 14:29:00.041253',10),(36,'increible','Rojo',0,'2026-04-14 16:54:07.995337','2026-04-14 17:45:29.689782',11),(37,'Estrellita','Azul',0,'2026-04-14 16:54:08.026564','2026-04-14 17:45:36.663964',11),(39,'increible','Rojo',0,'2026-04-14 18:47:55.328305','2026-04-14 18:48:40.971584',12),(40,'Estrellita','Rojo',0,'2026-04-14 18:47:55.352022','2026-04-14 18:48:44.294826',12),(42,'increible','Rojo',0,'2026-04-14 18:54:55.482315','2026-04-14 18:55:22.327762',13),(43,'Estrellita','Azul',0,'2026-04-14 18:54:55.504927','2026-04-14 18:55:26.070140',13),(45,'increible','Rojo',0,'2026-04-14 19:03:35.766721','2026-04-14 19:04:00.960865',14),(46,'Estrellita','Azul',0,'2026-04-14 19:03:35.790802','2026-04-14 19:04:03.798251',14),(48,'increible','Rojo',0,'2026-04-14 19:17:46.751297','2026-04-14 19:18:03.664238',15),(49,'Estrellita','Azul',0,'2026-04-14 19:17:46.770572','2026-04-14 19:18:06.935290',15),(51,'increible','Rojo',0,'2026-04-14 19:32:01.537117','2026-04-14 19:32:24.281332',16),(52,'Estrellita','Azul',0,'2026-04-14 19:32:01.557786','2026-04-14 19:32:27.628673',16),(54,'increible','Rojo',0,'2026-04-14 19:40:54.978406','2026-04-14 19:41:21.177795',17),(55,'Estrellita','Azul',0,'2026-04-14 19:40:55.001557','2026-04-14 19:41:24.240706',17),(57,'Estrellita','Azul',0,'2026-04-14 20:07:28.599918','2026-04-14 20:13:46.512659',18),(59,'increible','Rojo',0,'2026-04-14 20:07:28.655689','2026-04-14 20:12:37.016909',18),(62,'increible','Rojo',0,'2026-04-14 23:25:14.578514','2026-04-14 23:25:34.963366',19),(63,'Estrellita','Azul',0,'2026-04-14 23:25:14.599438','2026-04-14 23:25:38.059310',19),(65,'increible','Verde',0,'2026-04-16 01:16:17.722224','2026-04-16 01:16:40.769839',20),(66,'Estrellita','Azul',0,'2026-04-16 01:16:17.745351','2026-04-16 01:16:43.468412',20),(68,'increible','Rojo',0,'2026-04-16 01:56:22.613838','2026-04-16 01:56:48.308082',21),(69,'Estrellita','Verde',0,'2026-04-16 01:56:22.641094','2026-04-16 01:56:51.361202',21);
/*!40000 ALTER TABLE `teams` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `token_transactions`
--

DROP TABLE IF EXISTS `token_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `token_transactions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `amount` int NOT NULL,
  `source_type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_id` int DEFAULT NULL,
  `reason` longtext COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(6) NOT NULL,
  `awarded_by_id` bigint DEFAULT NULL,
  `game_session_id` bigint NOT NULL,
  `session_stage_id` bigint DEFAULT NULL,
  `team_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `token_trans_team_id_901680_idx` (`team_id`),
  KEY `token_trans_game_se_6b0306_idx` (`game_session_id`),
  KEY `token_trans_source__621a3e_idx` (`source_type`,`source_id`),
  KEY `token_trans_created_4c5cdd_idx` (`created_at`),
  KEY `token_transactions_awarded_by_id_115120a7_fk_professors_id` (`awarded_by_id`),
  KEY `token_transactions_session_stage_id_6212aa59_fk_session_s` (`session_stage_id`),
  CONSTRAINT `token_transactions_awarded_by_id_115120a7_fk_professors_id` FOREIGN KEY (`awarded_by_id`) REFERENCES `professors` (`id`),
  CONSTRAINT `token_transactions_game_session_id_6bfe21bc_fk_game_sessions_id` FOREIGN KEY (`game_session_id`) REFERENCES `game_sessions` (`id`),
  CONSTRAINT `token_transactions_session_stage_id_6212aa59_fk_session_s` FOREIGN KEY (`session_stage_id`) REFERENCES `session_stages` (`id`),
  CONSTRAINT `token_transactions_team_id_f387a4f1_fk_teams_id` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `token_transactions`
--

LOCK TABLES `token_transactions` WRITE;
/*!40000 ALTER TABLE `token_transactions` DISABLE KEYS */;
/*!40000 ALTER TABLE `token_transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `topic_selection_metrics`
--

DROP TABLE IF EXISTS `topic_selection_metrics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `topic_selection_metrics` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `selection_count` int NOT NULL,
  `last_selected_at` datetime(6) DEFAULT NULL,
  `topic_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `topic_selection_metrics_topic_id_32a24333_uniq` (`topic_id`),
  CONSTRAINT `topic_selection_metrics_topic_id_32a24333_fk_topics_id` FOREIGN KEY (`topic_id`) REFERENCES `topics` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `topic_selection_metrics`
--

LOCK TABLES `topic_selection_metrics` WRITE;
/*!40000 ALTER TABLE `topic_selection_metrics` DISABLE KEYS */;
/*!40000 ALTER TABLE `topic_selection_metrics` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `topics`
--

DROP TABLE IF EXISTS `topics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `topics` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` longtext COLLATE utf8mb4_unicode_ci,
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `icon` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `topics_is_acti_45fe00_idx` (`is_active`),
  KEY `topics_categor_7de43b_idx` (`category`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `topics`
--

LOCK TABLES `topics` WRITE;
/*!40000 ALTER TABLE `topics` DISABLE KEYS */;
INSERT INTO `topics` VALUES (1,'Salud','Temas relacionados con salud, bienestar y calidad de vida',NULL,'health',1,'2025-11-04 23:30:45.694000','2025-11-06 18:30:01.831000','?'),(2,'Educación','Temas relacionados con educación, formación y desarrollo de habilidades',NULL,'education',1,'2025-11-04 23:30:45.741000','2025-11-06 18:30:01.835000','?'),(3,'Sustentabilidad','Temas relacionados con sostenibilidad, medio ambiente y recursos naturales',NULL,'sustainability',1,'2025-11-04 23:30:45.775000','2025-11-06 18:30:01.835000','?');
/*!40000 ALTER TABLE `topics` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `topics_faculties`
--

DROP TABLE IF EXISTS `topics_faculties`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `topics_faculties` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `topic_id` bigint NOT NULL,
  `faculty_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `topics_faculties_topic_id_faculty_id_1e55427d_uniq` (`topic_id`,`faculty_id`),
  KEY `topics_faculties_faculty_id_c3ce4990_fk_faculties_id` (`faculty_id`),
  CONSTRAINT `topics_faculties_faculty_id_c3ce4990_fk_faculties_id` FOREIGN KEY (`faculty_id`) REFERENCES `faculties` (`id`),
  CONSTRAINT `topics_faculties_topic_id_b46cd624_fk_topics_id` FOREIGN KEY (`topic_id`) REFERENCES `topics` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `topics_faculties`
--

LOCK TABLES `topics_faculties` WRITE;
/*!40000 ALTER TABLE `topics_faculties` DISABLE KEYS */;
INSERT INTO `topics_faculties` VALUES (1,1,1),(2,2,1),(3,3,1);
/*!40000 ALTER TABLE `topics_faculties` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `word_search_options`
--

DROP TABLE IF EXISTS `word_search_options`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `word_search_options` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `words` json NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `activity_id` bigint NOT NULL,
  `grid` json DEFAULT NULL,
  `seed` int DEFAULT NULL,
  `word_positions` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `word_search_activit_21d157_idx` (`activity_id`,`is_active`),
  CONSTRAINT `word_search_options_activity_id_0d3f5a64_fk_activities_id` FOREIGN KEY (`activity_id`) REFERENCES `activities` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `word_search_options`
--

LOCK TABLES `word_search_options` WRITE;
/*!40000 ALTER TABLE `word_search_options` DISABLE KEYS */;
INSERT INTO `word_search_options` VALUES (1,'Sopa de Letras 1','[\"IDEA\", \"META\", \"EQUIPO\", \"PITCH\", \"LIDER\"]',1,'2025-11-26 14:23:06.489580','2025-11-26 14:23:06.489580',2,'[[\"I\", \"E\", \"F\", \"G\", \"H\", \"I\", \"J\", \"K\", \"L\", \"M\", \"N\", \"P\"], [\"P\", \"D\", \"R\", \"S\", \"T\", \"U\", \"V\", \"W\", \"X\", \"Y\", \"I\", \"B\"], [\"C\", \"D\", \"E\", \"F\", \"G\", \"H\", \"I\", \"J\", \"K\", \"T\", \"M\", \"N\"], [\"O\", \"P\", \"Q\", \"A\", \"S\", \"T\", \"U\", \"V\", \"C\", \"X\", \"E\", \"Z\"], [\"A\", \"B\", \"C\", \"E\", \"E\", \"G\", \"H\", \"H\", \"J\", \"K\", \"T\", \"M\"], [\"N\", \"O\", \"P\", \"Q\", \"R\", \"Q\", \"T\", \"U\", \"V\", \"W\", \"A\", \"Y\"], [\"Z\", \"A\", \"B\", \"C\", \"D\", \"E\", \"U\", \"H\", \"I\", \"J\", \"K\", \"L\"], [\"M\", \"N\", \"O\", \"P\", \"Q\", \"R\", \"S\", \"I\", \"U\", \"V\", \"W\", \"X\"], [\"Y\", \"Z\", \"A\", \"B\", \"C\", \"D\", \"E\", \"F\", \"P\", \"I\", \"J\", \"K\"], [\"L\", \"I\", \"D\", \"E\", \"R\", \"Q\", \"R\", \"S\", \"T\", \"O\", \"V\", \"W\"], [\"X\", \"Y\", \"Z\", \"A\", \"B\", \"C\", \"D\", \"E\", \"F\", \"G\", \"H\", \"I\"], [\"K\", \"L\", \"M\", \"N\", \"O\", \"P\", \"Q\", \"R\", \"S\", \"T\", \"U\", \"V\"]]',955440,'[{\"word\": \"IDEA\", \"cells\": [{\"col\": 0, \"row\": 0}, {\"col\": 1, \"row\": 1}, {\"col\": 2, \"row\": 2}, {\"col\": 3, \"row\": 3}], \"direction\": \"diagonal\"}, {\"word\": \"EQUIPO\", \"cells\": [{\"col\": 4, \"row\": 4}, {\"col\": 5, \"row\": 5}, {\"col\": 6, \"row\": 6}, {\"col\": 7, \"row\": 7}, {\"col\": 8, \"row\": 8}, {\"col\": 9, \"row\": 9}], \"direction\": \"diagonal\"}, {\"word\": \"PITCH\", \"cells\": [{\"col\": 11, \"row\": 0}, {\"col\": 10, \"row\": 1}, {\"col\": 9, \"row\": 2}, {\"col\": 8, \"row\": 3}, {\"col\": 7, \"row\": 4}], \"direction\": \"diagonal\"}, {\"word\": \"META\", \"cells\": [{\"col\": 10, \"row\": 2}, {\"col\": 10, \"row\": 3}, {\"col\": 10, \"row\": 4}, {\"col\": 10, \"row\": 5}], \"direction\": \"vertical\"}, {\"word\": \"LIDER\", \"cells\": [{\"col\": 0, \"row\": 9}, {\"col\": 1, \"row\": 9}, {\"col\": 2, \"row\": 9}, {\"col\": 3, \"row\": 9}, {\"col\": 4, \"row\": 9}], \"direction\": \"horizontal\"}]'),(2,'Sopa de Letras 2','[\"NEGOCIO\", \"CLIENTE\", \"VENTA\", \"PRODUCTO\", \"MERCADO\"]',1,'2025-11-26 14:23:06.507805','2025-11-26 14:23:06.507805',2,'[[\"N\", \"J\", \"K\", \"L\", \"V\", \"E\", \"N\", \"T\", \"A\", \"R\", \"S\", \"P\"], [\"U\", \"E\", \"W\", \"X\", \"Y\", \"Z\", \"A\", \"B\", \"C\", \"D\", \"R\", \"G\"], [\"H\", \"I\", \"G\", \"K\", \"L\", \"M\", \"N\", \"O\", \"P\", \"O\", \"R\", \"S\"], [\"T\", \"U\", \"V\", \"O\", \"X\", \"Y\", \"Z\", \"A\", \"D\", \"C\", \"D\", \"E\"], [\"F\", \"G\", \"H\", \"J\", \"C\", \"L\", \"M\", \"U\", \"O\", \"P\", \"Q\", \"R\"], [\"S\", \"T\", \"U\", \"V\", \"W\", \"I\", \"C\", \"Z\", \"A\", \"B\", \"C\", \"D\"], [\"E\", \"F\", \"G\", \"H\", \"I\", \"T\", \"O\", \"M\", \"N\", \"O\", \"P\", \"Q\"], [\"R\", \"S\", \"T\", \"U\", \"O\", \"M\", \"E\", \"R\", \"C\", \"A\", \"D\", \"O\"], [\"D\", \"C\", \"L\", \"I\", \"E\", \"N\", \"T\", \"E\", \"L\", \"N\", \"O\", \"P\"], [\"Q\", \"R\", \"S\", \"T\", \"U\", \"V\", \"W\", \"X\", \"Y\", \"Z\", \"A\", \"B\"], [\"C\", \"D\", \"E\", \"F\", \"G\", \"H\", \"I\", \"J\", \"K\", \"L\", \"M\", \"N\"], [\"P\", \"Q\", \"R\", \"S\", \"T\", \"U\", \"V\", \"W\", \"X\", \"Y\", \"Z\", \"A\"]]',748174,'[{\"word\": \"NEGOCIO\", \"cells\": [{\"col\": 0, \"row\": 0}, {\"col\": 1, \"row\": 1}, {\"col\": 2, \"row\": 2}, {\"col\": 3, \"row\": 3}, {\"col\": 4, \"row\": 4}, {\"col\": 5, \"row\": 5}, {\"col\": 6, \"row\": 6}], \"direction\": \"diagonal\"}, {\"word\": \"PRODUCTO\", \"cells\": [{\"col\": 11, \"row\": 0}, {\"col\": 10, \"row\": 1}, {\"col\": 9, \"row\": 2}, {\"col\": 8, \"row\": 3}, {\"col\": 7, \"row\": 4}, {\"col\": 6, \"row\": 5}, {\"col\": 5, \"row\": 6}, {\"col\": 4, \"row\": 7}], \"direction\": \"diagonal\"}, {\"word\": \"CLIENTE\", \"cells\": [{\"col\": 1, \"row\": 8}, {\"col\": 2, \"row\": 8}, {\"col\": 3, \"row\": 8}, {\"col\": 4, \"row\": 8}, {\"col\": 5, \"row\": 8}, {\"col\": 6, \"row\": 8}, {\"col\": 7, \"row\": 8}], \"direction\": \"horizontal\"}, {\"word\": \"VENTA\", \"cells\": [{\"col\": 4, \"row\": 0}, {\"col\": 5, \"row\": 0}, {\"col\": 6, \"row\": 0}, {\"col\": 7, \"row\": 0}, {\"col\": 8, \"row\": 0}], \"direction\": \"horizontal\"}, {\"word\": \"MERCADO\", \"cells\": [{\"col\": 5, \"row\": 7}, {\"col\": 6, \"row\": 7}, {\"col\": 7, \"row\": 7}, {\"col\": 8, \"row\": 7}, {\"col\": 9, \"row\": 7}, {\"col\": 10, \"row\": 7}, {\"col\": 11, \"row\": 7}], \"direction\": \"horizontal\"}]'),(5,'Sopa de Letras 5','[\"LIDERAZGO\", \"MOTIVACION\", \"PASION\", \"VISION\", \"MISION\"]',1,'2025-11-26 14:23:06.525124','2025-11-26 14:23:06.525124',2,'[[\"L\", \"C\", \"D\", \"E\", \"F\", \"G\", \"H\", \"I\", \"J\", \"K\", \"L\", \"V\"], [\"N\", \"I\", \"P\", \"Q\", \"R\", \"S\", \"T\", \"U\", \"P\", \"W\", \"I\", \"Y\"], [\"Z\", \"B\", \"D\", \"D\", \"E\", \"F\", \"G\", \"A\", \"I\", \"S\", \"K\", \"L\"], [\"M\", \"N\", \"O\", \"E\", \"Q\", \"R\", \"S\", \"T\", \"I\", \"V\", \"W\", \"X\"], [\"Y\", \"Z\", \"A\", \"B\", \"R\", \"I\", \"F\", \"O\", \"H\", \"I\", \"J\", \"K\"], [\"L\", \"M\", \"N\", \"O\", \"O\", \"A\", \"N\", \"S\", \"T\", \"U\", \"V\", \"W\"], [\"X\", \"Y\", \"Z\", \"N\", \"B\", \"C\", \"Z\", \"F\", \"G\", \"H\", \"I\", \"J\"], [\"K\", \"L\", \"M\", \"N\", \"O\", \"P\", \"Q\", \"G\", \"S\", \"T\", \"U\", \"V\"], [\"M\", \"O\", \"T\", \"I\", \"V\", \"A\", \"C\", \"I\", \"O\", \"N\", \"H\", \"I\"], [\"J\", \"K\", \"L\", \"M\", \"N\", \"O\", \"P\", \"Q\", \"R\", \"S\", \"T\", \"U\"], [\"V\", \"W\", \"X\", \"Y\", \"Z\", \"A\", \"B\", \"C\", \"D\", \"E\", \"F\", \"G\"], [\"H\", \"I\", \"K\", \"L\", \"M\", \"I\", \"S\", \"I\", \"O\", \"N\", \"S\", \"T\"]]',307190,'[{\"word\": \"LIDERAZGO\", \"cells\": [{\"col\": 0, \"row\": 0}, {\"col\": 1, \"row\": 1}, {\"col\": 2, \"row\": 2}, {\"col\": 3, \"row\": 3}, {\"col\": 4, \"row\": 4}, {\"col\": 5, \"row\": 5}, {\"col\": 6, \"row\": 6}, {\"col\": 7, \"row\": 7}, {\"col\": 8, \"row\": 8}], \"direction\": \"diagonal\"}, {\"word\": \"VISION\", \"cells\": [{\"col\": 11, \"row\": 0}, {\"col\": 10, \"row\": 1}, {\"col\": 9, \"row\": 2}, {\"col\": 8, \"row\": 3}, {\"col\": 7, \"row\": 4}, {\"col\": 6, \"row\": 5}], \"direction\": \"diagonal\"}, {\"word\": \"MOTIVACION\", \"cells\": [{\"col\": 0, \"row\": 8}, {\"col\": 1, \"row\": 8}, {\"col\": 2, \"row\": 8}, {\"col\": 3, \"row\": 8}, {\"col\": 4, \"row\": 8}, {\"col\": 5, \"row\": 8}, {\"col\": 6, \"row\": 8}, {\"col\": 7, \"row\": 8}, {\"col\": 8, \"row\": 8}, {\"col\": 9, \"row\": 8}], \"direction\": \"horizontal\"}, {\"word\": \"PASION\", \"cells\": [{\"col\": 8, \"row\": 1}, {\"col\": 7, \"row\": 2}, {\"col\": 6, \"row\": 3}, {\"col\": 5, \"row\": 4}, {\"col\": 4, \"row\": 5}, {\"col\": 3, \"row\": 6}], \"direction\": \"diagonal\"}, {\"word\": \"MISION\", \"cells\": [{\"col\": 4, \"row\": 11}, {\"col\": 5, \"row\": 11}, {\"col\": 6, \"row\": 11}, {\"col\": 7, \"row\": 11}, {\"col\": 8, \"row\": 11}, {\"col\": 9, \"row\": 11}], \"direction\": \"horizontal\"}]'),(17,'daniela','[\"LOCURA\", \"KALI\", \"BOBBY\", \"ROCKY\", \"PRINCESA\"]',1,'2025-12-03 17:46:04.500799','2025-12-03 17:46:04.500823',2,'[[\"E\", \"F\", \"G\", \"H\", \"P\", \"R\", \"I\", \"N\", \"C\", \"E\", \"S\", \"A\"], [\"Q\", \"R\", \"S\", \"T\", \"L\", \"V\", \"W\", \"X\", \"Y\", \"K\", \"B\", \"C\"], [\"D\", \"E\", \"F\", \"G\", \"H\", \"O\", \"J\", \"K\", \"A\", \"M\", \"N\", \"O\"], [\"P\", \"Q\", \"R\", \"S\", \"T\", \"U\", \"C\", \"L\", \"X\", \"Y\", \"Z\", \"A\"], [\"B\", \"C\", \"E\", \"F\", \"G\", \"H\", \"I\", \"U\", \"K\", \"L\", \"M\", \"N\"], [\"O\", \"P\", \"Q\", \"R\", \"S\", \"T\", \"U\", \"V\", \"R\", \"X\", \"Y\", \"Z\"], [\"A\", \"B\", \"C\", \"D\", \"O\", \"G\", \"H\", \"I\", \"J\", \"A\", \"L\", \"M\"], [\"N\", \"O\", \"P\", \"Q\", \"R\", \"C\", \"T\", \"U\", \"V\", \"W\", \"X\", \"Y\"], [\"Z\", \"A\", \"B\", \"C\", \"D\", \"E\", \"K\", \"G\", \"I\", \"J\", \"K\", \"L\"], [\"M\", \"N\", \"O\", \"P\", \"Q\", \"R\", \"S\", \"Y\", \"U\", \"V\", \"W\", \"X\"], [\"Y\", \"Z\", \"A\", \"B\", \"C\", \"D\", \"E\", \"F\", \"G\", \"H\", \"I\", \"J\"], [\"B\", \"O\", \"B\", \"B\", \"Y\", \"Q\", \"R\", \"S\", \"T\", \"U\", \"V\", \"W\"]]',526578,'[{\"word\": \"LOCURA\", \"cells\": [{\"col\": 4, \"row\": 1}, {\"col\": 5, \"row\": 2}, {\"col\": 6, \"row\": 3}, {\"col\": 7, \"row\": 4}, {\"col\": 8, \"row\": 5}, {\"col\": 9, \"row\": 6}], \"direction\": \"diagonal\"}, {\"word\": \"KALI\", \"cells\": [{\"col\": 9, \"row\": 1}, {\"col\": 8, \"row\": 2}, {\"col\": 7, \"row\": 3}, {\"col\": 6, \"row\": 4}], \"direction\": \"diagonal\"}, {\"word\": \"BOBBY\", \"cells\": [{\"col\": 0, \"row\": 11}, {\"col\": 1, \"row\": 11}, {\"col\": 2, \"row\": 11}, {\"col\": 3, \"row\": 11}, {\"col\": 4, \"row\": 11}], \"direction\": \"horizontal\"}, {\"word\": \"ROCKY\", \"cells\": [{\"col\": 3, \"row\": 5}, {\"col\": 4, \"row\": 6}, {\"col\": 5, \"row\": 7}, {\"col\": 6, \"row\": 8}, {\"col\": 7, \"row\": 9}], \"direction\": \"diagonal\"}, {\"word\": \"PRINCESA\", \"cells\": [{\"col\": 4, \"row\": 0}, {\"col\": 5, \"row\": 0}, {\"col\": 6, \"row\": 0}, {\"col\": 7, \"row\": 0}, {\"col\": 8, \"row\": 0}, {\"col\": 9, \"row\": 0}, {\"col\": 10, \"row\": 0}, {\"col\": 11, \"row\": 0}], \"direction\": \"horizontal\"}]');
/*!40000 ALTER TABLE `word_search_options` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-04-16  8:57:59
