-- Veille RSS et flux e-mail : file de curation, jetons à usage unique, et
-- confirmation d'adresse sur les comptes.
--
-- `emailVerified` vaut true par défaut : les comptes déjà en base ont été
-- créés avant l'existence de la confirmation, les considérer non confirmés
-- les empêcherait de se connecter. Seuls les comptes créés APRÈS, par la
-- route /api/admin/accounts, démarrent à false.

-- AlterTable
ALTER TABLE `User` ADD COLUMN `emailVerified` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `mustChangePassword` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `FeedItem` (
    `id` VARCHAR(191) NOT NULL,
    `guid` VARCHAR(512) NOT NULL,
    `source` VARCHAR(255) NOT NULL,
    `category` VARCHAR(64) NOT NULL,
    `title` VARCHAR(512) NOT NULL,
    `excerpt` TEXT NULL,
    `content` MEDIUMTEXT NULL,
    `image` VARCHAR(2048) NULL,
    `link` VARCHAR(1024) NOT NULL,
    `publishedAt` DATETIME(3) NULL,
    `status` ENUM('NEW', 'IGNORED', 'LATER', 'PUBLISHED') NOT NULL DEFAULT 'NEW',
    `fetchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `FeedItem_guid_key`(`guid`),
    INDEX `FeedItem_status_publishedAt_fetchedAt_idx`(`status`, `publishedAt`, `fetchedAt`),
    INDEX `FeedItem_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `kind` ENUM('VERIFY', 'RESET') NOT NULL,
    `tokenHash` VARCHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserToken_tokenHash_idx`(`tokenHash`),
    INDEX `UserToken_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserToken` ADD CONSTRAINT `UserToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

