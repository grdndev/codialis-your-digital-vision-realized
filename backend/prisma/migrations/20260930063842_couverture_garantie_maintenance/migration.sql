-- AlterTable
ALTER TABLE `Project` ADD COLUMN `maintenanceEndsAt` DATETIME(3) NULL,
    ADD COLUMN `warrantyEndsAt` DATETIME(3) NULL;
