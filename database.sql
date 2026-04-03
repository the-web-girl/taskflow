-- ============================================================
-- TaskFlow – Script de création de la base de données MySQL
-- Exécutez ce fichier UNE SEULE FOIS lors de l'installation
-- ============================================================

-- 1. Créer la base de données
CREATE DATABASE IF NOT EXISTS `taskflow`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `taskflow`;

-- 2. Table principale de sauvegarde d'état
CREATE TABLE IF NOT EXISTS `taskflow_states` (
  `id`          INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `user_id`     VARCHAR(64)      NOT NULL  COMMENT 'Identifiant de session utilisateur',
  `state_data`  LONGTEXT         NOT NULL  COMMENT 'État JSON complet de l''application',
  `created_at`  TIMESTAMP        NOT NULL  DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP        NOT NULL  DEFAULT CURRENT_TIMESTAMP
                                           ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE  KEY `uk_user_id` (`user_id`),
  KEY           `idx_updated`   (`updated_at`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='États sauvegardés de TaskFlow par utilisateur';

-- 3. (Optionnel) Table de logs d'accès
CREATE TABLE IF NOT EXISTS `taskflow_logs` (
  `id`         BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`    VARCHAR(64),
  `action`     VARCHAR(32)      NOT NULL,
  `ip_address` VARCHAR(45),
  `created_at` TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user`    (`user_id`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Journal des actions TaskFlow';

-- 4. Utilisateur MySQL dédié (à adapter avec votre mot de passe)
-- ⚠️  Remplacez 'MOT_DE_PASSE_FORT' par un vrai mot de passe
-- ⚠️  Remplacez 'localhost' par '%' si votre app est sur un autre hôte
CREATE USER IF NOT EXISTS 'taskflow_user'@'localhost'
  IDENTIFIED BY 'MOT_DE_PASSE_FORT';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE
  ON `taskflow`.*
  TO 'taskflow_user'@'localhost';

FLUSH PRIVILEGES;

-- ============================================================
-- Vérification
-- ============================================================
SHOW TABLES;
SELECT 'Installation base de données TaskFlow réussie !' AS statut;
