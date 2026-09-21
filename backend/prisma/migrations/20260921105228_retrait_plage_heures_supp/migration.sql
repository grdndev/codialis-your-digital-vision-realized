/*
  Warnings:

  - You are about to drop the column `overtimeEndMin` on the `WorkSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `overtimeStartMin` on the `WorkSchedule` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `WorkSchedule` DROP COLUMN `overtimeEndMin`,
    DROP COLUMN `overtimeStartMin`;
