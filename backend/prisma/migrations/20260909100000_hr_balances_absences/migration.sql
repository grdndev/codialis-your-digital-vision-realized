-- RH : soldes ancrés, absences avec circuit de validation, récupérations et
-- règles de présence récurrentes.
--
-- `OvertimeEntry` devient `HoursEntry` : la table portait déjà des heures
-- déclarées, elle porte maintenant aussi les récupérations (`kind`), donc son
-- ancien nom mentait. La table est vide sur les déploiements existants (la
-- fonctionnalité n'avait pas encore servi), le renommage est donc sans risque
-- pour les données.

-- DropForeignKey
ALTER TABLE `OvertimeEntry` DROP FOREIGN KEY `OvertimeEntry_userId_fkey`;

-- RenameTable
RENAME TABLE `OvertimeEntry` TO `HoursEntry`;

-- AlterTable : sens de l'écriture + heure sup payée (paie) ou mise en récup
ALTER TABLE `HoursEntry`
    ADD COLUMN `kind` ENUM('SUP', 'RECUP') NOT NULL DEFAULT 'SUP',
    ADD COLUMN `paid` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `status` ENUM('DECLARE', 'VALIDE', 'REFUSE') NOT NULL DEFAULT 'DECLARE';

-- Le refus manquait au circuit de validation, y compris pour les déplacements.
ALTER TABLE `TravelEntry`
    MODIFY `status` ENUM('DECLARE', 'VALIDE', 'REFUSE') NOT NULL DEFAULT 'DECLARE';

-- AlterTable : soldes « à ancre » sur le compte
ALTER TABLE `User`
    ADD COLUMN `leaveBalance` DOUBLE NULL,
    ADD COLUMN `leaveAnchor` DATE NULL,
    ADD COLUMN `hoursBalance` DOUBLE NULL,
    ADD COLUMN `hoursAnchor` DATE NULL;

-- CreateIndex
CREATE INDEX `HoursEntry_userId_idx` ON `HoursEntry`(`userId`);

-- CreateTable
CREATE TABLE `Absence` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` ENUM('TELETRAVAIL', 'CONGE', 'ABSENCE', 'FORMATION') NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `halfDay` ENUM('AM', 'PM') NULL,
    `motif` VARCHAR(191) NOT NULL DEFAULT '',
    `status` ENUM('DECLARE', 'VALIDE', 'REFUSE') NOT NULL DEFAULT 'DECLARE',
    `paid` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Absence_userId_idx`(`userId`),
    INDEX `Absence_startDate_idx`(`startDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PresenceRecurrence` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `effect` ENUM('PRESENT', 'TELETRAVAIL', 'CONGE', 'ABSENCE', 'FORMATION') NOT NULL,
    `freq` ENUM('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'DAILY') NOT NULL,
    `weekday` INTEGER NULL,
    `monthday` INTEGER NULL,
    `halfDay` ENUM('AM', 'PM') NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NULL,
    `motif` VARCHAR(191) NOT NULL DEFAULT '',
    `paid` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PresenceRecurrence_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `HoursEntry` ADD CONSTRAINT `HoursEntry_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Absence` ADD CONSTRAINT `Absence_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PresenceRecurrence` ADD CONSTRAINT `PresenceRecurrence_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
