-- CreateTable
CREATE TABLE `WorkSchedule` (
    `userId` VARCHAR(191) NOT NULL,
    `startMin` INTEGER NOT NULL DEFAULT 540,
    `breakStartMin` INTEGER NULL DEFAULT 720,
    `breakEndMin` INTEGER NULL DEFAULT 780,
    `endMin` INTEGER NOT NULL DEFAULT 1080,
    `weekdays` VARCHAR(191) NOT NULL DEFAULT '1,2,3,4,5',
    `overtimeStartMin` INTEGER NULL,
    `overtimeEndMin` INTEGER NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkSession` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `startedById` VARCHAR(191) NULL,
    `taskId` VARCHAR(191) NULL,
    `ticketId` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NOT NULL,
    `endedAt` DATETIME(3) NULL,
    `hours` DOUBLE NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WorkSession_userId_startedAt_idx`(`userId`, `startedAt`),
    INDEX `WorkSession_taskId_idx`(`taskId`),
    INDEX `WorkSession_ticketId_idx`(`ticketId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WorkSchedule` ADD CONSTRAINT `WorkSchedule_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkSession` ADD CONSTRAINT `WorkSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkSession` ADD CONSTRAINT `WorkSession_startedById_fkey` FOREIGN KEY (`startedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkSession` ADD CONSTRAINT `WorkSession_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkSession` ADD CONSTRAINT `WorkSession_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `Ticket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
