-- CreateTable
CREATE TABLE `MonthlyGoal` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `detail` TEXT NOT NULL,
    `dueAt` DATETIME(3) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `authorId` VARCHAR(191) NULL,
    `doneAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MonthlyGoal_dueAt_idx`(`dueAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MonthlyGoal` ADD CONSTRAINT `MonthlyGoal_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MonthlyGoal` ADD CONSTRAINT `MonthlyGoal_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
