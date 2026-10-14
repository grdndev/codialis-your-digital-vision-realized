-- CC-365, second temps : les tâches ont été copiées en tickets par
-- `taches_en_tickets`, sous le même identifiant, et plus aucun écran ne les
-- lit. On retire les tables Task* et les colonnes `taskId` du temps.
--
-- Contrôlé en production avant de l'écrire (14/10) : 407 tâches, chacune avec
-- son ticket ; aucun critère, commentaire ni pièce jointe ; aucune session ni
-- saisie de temps encore rattachée à une tâche. Sauvegarde complète prise
-- avant le déploiement.

-- Garde-fou : du temps encore rattaché à une tâche serait perdu avec la
-- colonne. Le nombre de lignes concernées est inséré dans une table dont la
-- contrainte CHECK exige zéro : s'il en reste une seule, l'insertion échoue et
-- la migration s'arrête ici, AVANT toute suppression. (Une CHECK posée
-- directement sur `taskId` est refusée, la colonne porte une clé étrangère.)
DROP TABLE IF EXISTS `_garde_taches`;
CREATE TABLE `_garde_taches` (`restant` INT NOT NULL, CONSTRAINT `garde_aucun_temps_sur_tache` CHECK (`restant` = 0));
INSERT INTO `_garde_taches` SELECT COUNT(*) FROM `WorkSession` WHERE `taskId` IS NOT NULL;
INSERT INTO `_garde_taches` SELECT COUNT(*) FROM `TimeEntry` WHERE `taskId` IS NOT NULL;
DROP TABLE `_garde_taches`;

-- DropForeignKey
ALTER TABLE `Task` DROP FOREIGN KEY `Task_assigneeId_fkey`;

-- DropForeignKey
ALTER TABLE `Task` DROP FOREIGN KEY `Task_epicId_fkey`;

-- DropForeignKey
ALTER TABLE `TaskAttachment` DROP FOREIGN KEY `TaskAttachment_taskId_fkey`;

-- DropForeignKey
ALTER TABLE `TaskComment` DROP FOREIGN KEY `TaskComment_authorId_fkey`;

-- DropForeignKey
ALTER TABLE `TaskComment` DROP FOREIGN KEY `TaskComment_taskId_fkey`;

-- DropForeignKey
ALTER TABLE `TaskCriterion` DROP FOREIGN KEY `TaskCriterion_taskId_fkey`;

-- DropForeignKey
ALTER TABLE `TimeEntry` DROP FOREIGN KEY `TimeEntry_taskId_fkey`;

-- DropForeignKey
ALTER TABLE `WorkSession` DROP FOREIGN KEY `WorkSession_taskId_fkey`;

-- DropIndex
DROP INDEX `TimeEntry_taskId_fkey` ON `TimeEntry`;

-- DropIndex
DROP INDEX `WorkSession_taskId_idx` ON `WorkSession`;

-- AlterTable
ALTER TABLE `TimeEntry` DROP COLUMN `taskId`;

-- AlterTable
ALTER TABLE `WorkSession` DROP COLUMN `taskId`;

-- DropTable
DROP TABLE `Task`;

-- DropTable
DROP TABLE `TaskAttachment`;

-- DropTable
DROP TABLE `TaskComment`;

-- DropTable
DROP TABLE `TaskCriterion`;
