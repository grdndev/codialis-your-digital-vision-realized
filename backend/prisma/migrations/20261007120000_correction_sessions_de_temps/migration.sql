-- Temps mesuré : correction après coup d'une session (dates ou durée), avec
-- son auteur et sa date. Les sessions existantes restent telles quelles.
-- AlterTable
ALTER TABLE `WorkSession` ADD COLUMN `correctedAt` DATETIME(3) NULL,
    ADD COLUMN `correctedById` VARCHAR(191) NULL,
    ADD COLUMN `hoursOverride` DOUBLE NULL;

-- AddForeignKey
ALTER TABLE `WorkSession` ADD CONSTRAINT `WorkSession_correctedById_fkey` FOREIGN KEY (`correctedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

