-- AlterTable
ALTER TABLE `Invoice` ADD COLUMN `milestone` INTEGER NULL;

-- AlterTable
ALTER TABLE `Project` ADD COLUMN `billingPlan` VARCHAR(20) NULL;
