-- Tâches internes : priorité (CC-361) et archivage (CC-360). Les tâches
-- existantes passent en « Normale » et restent actives.
-- AlterTable
ALTER TABLE `InternalTask` ADD COLUMN `archivedAt` DATETIME(3) NULL,
    ADD COLUMN `priority` ENUM('NORMALE', 'HAUTE', 'URGENTE') NOT NULL DEFAULT 'NORMALE';

