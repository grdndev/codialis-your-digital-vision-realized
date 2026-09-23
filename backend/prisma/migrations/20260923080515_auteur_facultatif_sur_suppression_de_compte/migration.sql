-- DropForeignKey
ALTER TABLE `CustomCategory` DROP FOREIGN KEY `CustomCategory_authorId_fkey`;

-- DropForeignKey
ALTER TABLE `DealNote` DROP FOREIGN KEY `DealNote_authorId_fkey`;

-- DropForeignKey
ALTER TABLE `Decision` DROP FOREIGN KEY `Decision_authorId_fkey`;

-- DropForeignKey
ALTER TABLE `Message` DROP FOREIGN KEY `Message_authorId_fkey`;

-- DropForeignKey
ALTER TABLE `Rdv` DROP FOREIGN KEY `Rdv_hostId_fkey`;

-- DropForeignKey
ALTER TABLE `TaskComment` DROP FOREIGN KEY `TaskComment_authorId_fkey`;

-- DropForeignKey
ALTER TABLE `TeamProfitSnapshot` DROP FOREIGN KEY `TeamProfitSnapshot_userId_fkey`;

-- DropForeignKey
ALTER TABLE `TicketComment` DROP FOREIGN KEY `TicketComment_authorId_fkey`;

-- DropForeignKey
ALTER TABLE `TimeEntry` DROP FOREIGN KEY `TimeEntry_userId_fkey`;

-- DropIndex
DROP INDEX `CustomCategory_authorId_fkey` ON `CustomCategory`;

-- DropIndex
DROP INDEX `DealNote_authorId_fkey` ON `DealNote`;

-- DropIndex
DROP INDEX `Decision_authorId_fkey` ON `Decision`;

-- DropIndex
DROP INDEX `Message_authorId_fkey` ON `Message`;

-- DropIndex
DROP INDEX `Rdv_hostId_fkey` ON `Rdv`;

-- DropIndex
DROP INDEX `TaskComment_authorId_fkey` ON `TaskComment`;

-- DropIndex
DROP INDEX `TeamProfitSnapshot_userId_fkey` ON `TeamProfitSnapshot`;

-- DropIndex
DROP INDEX `TicketComment_authorId_fkey` ON `TicketComment`;

-- DropIndex
DROP INDEX `TimeEntry_userId_fkey` ON `TimeEntry`;

-- AlterTable
ALTER TABLE `CustomCategory` MODIFY `authorId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `DealNote` MODIFY `authorId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Decision` MODIFY `authorId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Message` MODIFY `authorId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Rdv` MODIFY `hostId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `TaskComment` MODIFY `authorId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `TicketComment` MODIFY `authorId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `TimeEntry` MODIFY `userId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `TaskComment` ADD CONSTRAINT `TaskComment_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketComment` ADD CONSTRAINT `TicketComment_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DealNote` ADD CONSTRAINT `DealNote_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomCategory` ADD CONSTRAINT `CustomCategory_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Decision` ADD CONSTRAINT `Decision_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TimeEntry` ADD CONSTRAINT `TimeEntry_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamProfitSnapshot` ADD CONSTRAINT `TeamProfitSnapshot_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Rdv` ADD CONSTRAINT `Rdv_hostId_fkey` FOREIGN KEY (`hostId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
