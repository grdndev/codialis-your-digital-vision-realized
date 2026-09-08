-- Site vitrine (codialis.com) : tables lues/écrites par les routes publiques
-- /api/content, /api/settings, /api/newsletter et /api/contact.
--
-- Les CREATE TABLE sont volontairement en `IF NOT EXISTS` : ces cinq tables
-- portent les mêmes noms que dans l'ancien backend Express. Sur une base qui
-- tourne déjà en production, elles existent et contiennent le contenu du site
-- — cette migration doit alors être un no-op, pas une remise à zéro.

-- AlterTable
ALTER TABLE `User` ADD COLUMN `jobTitle` VARCHAR(255) NULL,
    ADD COLUMN `photo` LONGTEXT NULL;

-- CreateTable
CREATE TABLE IF NOT EXISTS `content` (
    `id` CHAR(36) NOT NULL,
    `type` VARCHAR(16) NOT NULL,
    `data` JSON NOT NULL,
    `views` BIGINT NOT NULL DEFAULT 0,
    `position` BIGINT NOT NULL DEFAULT 0,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `content_type_created_idx`(`type`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `settings` (
    `key` VARCHAR(191) NOT NULL,
    `data` JSON NOT NULL,
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `page_views` (
    `page` VARCHAR(191) NOT NULL,
    `count` BIGINT NOT NULL DEFAULT 0,

    PRIMARY KEY (`page`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `newsletter_subscribers` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(320) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `newsletter_subscribers_email_key`(`email`),
    INDEX `newsletter_created_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `contact_requests` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL DEFAULT '',
    `company` VARCHAR(200) NOT NULL DEFAULT '',
    `email` VARCHAR(320) NOT NULL DEFAULT '',
    `phone` VARCHAR(60) NOT NULL DEFAULT '',
    `project` VARCHAR(200) NOT NULL DEFAULT '',
    `budget` VARCHAR(60) NOT NULL DEFAULT '',
    `message` TEXT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'nouveau',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `contact_requests_created_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
