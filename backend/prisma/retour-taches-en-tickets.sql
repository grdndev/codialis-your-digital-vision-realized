-- RETOUR ARRIÈRE de la migration `taches_en_tickets` (CC-365), à n'utiliser
-- que si l'on revient au code d'avant (revert puis redéploiement). Tant que
-- les tables Task* existent, il rend aux tâches tout ce qui s'est passé sur
-- leurs tickets depuis la reprise, puis retire ces tickets.
--
--   docker compose exec -T codialis.db mysql -ucodialis -p… codialis < backend/prisma/retour-taches-en-tickets.sql
--
-- Les tickets issus d'une tâche se reconnaissent à leur identifiant, qui est
-- celui de la tâche. Un ticket créé APRÈS la reprise dans un épic reste un
-- ticket : il n'a pas de tâche d'origine.
--
-- Ce qui ne revient pas : un ancien ticket de tâche déplacé vers un autre
-- projet ou sorti de son épic retrouve SON épic d'origine, la tâche n'ayant
-- pas d'existence hors épic.

START TRANSACTION;

-- L'état courant du ticket redescend sur sa tâche.
UPDATE `Task` t JOIN `Ticket` k ON k.`id` = t.`id`
SET t.`title` = k.`title`, t.`description` = k.`description`, t.`status` = k.`status`,
    t.`estHours` = k.`estHours`, t.`spentHours` = k.`spentHours`,
    t.`assigneeId` = k.`assigneeId`, t.`dueAt` = k.`dueAt`,
    t.`epicId` = IF(k.`epicId` IS NOT NULL AND EXISTS (SELECT 1 FROM `Epic` e WHERE e.`id` = k.`epicId`), k.`epicId`, t.`epicId`),
    t.`updatedAt` = k.`updatedAt`;

-- Ce qui a été ajouté sur ces tickets depuis la reprise.
INSERT INTO `TaskCriterion` (`id`, `taskId`, `label`, `done`, `order`)
SELECT c.`id`, c.`ticketId`, c.`label`, c.`done`, c.`order` FROM `TicketCriterion` c
WHERE c.`ticketId` IN (SELECT `id` FROM `Task`) AND NOT EXISTS (SELECT 1 FROM `TaskCriterion` x WHERE x.`id` = c.`id`);
UPDATE `TaskCriterion` x JOIN `TicketCriterion` c ON c.`id` = x.`id` SET x.`label` = c.`label`, x.`done` = c.`done`;
INSERT INTO `TaskComment` (`id`, `taskId`, `authorId`, `body`, `createdAt`)
SELECT c.`id`, c.`ticketId`, c.`authorId`, c.`body`, c.`createdAt` FROM `TicketComment` c
WHERE c.`ticketId` IN (SELECT `id` FROM `Task`) AND NOT EXISTS (SELECT 1 FROM `TaskComment` x WHERE x.`id` = c.`id`);
INSERT INTO `TaskAttachment` (`id`, `taskId`, `filename`, `fileId`, `meta`, `createdAt`)
SELECT a.`id`, a.`ticketId`, a.`filename`, a.`fileId`, a.`meta`, a.`createdAt` FROM `TicketAttachment` a
WHERE a.`ticketId` IN (SELECT `id` FROM `Task`) AND NOT EXISTS (SELECT 1 FROM `TaskAttachment` x WHERE x.`id` = a.`id`);

-- Le temps repasse à la tâche AVANT de supprimer les tickets : leurs sessions
-- partiraient sinon en cascade.
UPDATE `WorkSession` SET `taskId` = `ticketId`, `ticketId` = NULL WHERE `ticketId` IN (SELECT `id` FROM `Task`);
UPDATE `TimeEntry` SET `taskId` = `ticketId`, `ticketId` = NULL WHERE `ticketId` IN (SELECT `id` FROM `Task`);

DELETE FROM `Ticket` WHERE `id` IN (SELECT `id` FROM `Task`);

-- L'avancement redevient celui des tâches (règle d'avant la reprise).
UPDATE `Project` p
JOIN (
  SELECT e.`projectId`, ROUND(100 * SUM(t.`status` = 'TERMINE') / COUNT(*)) AS pct
  FROM `Task` t JOIN `Epic` e ON e.`id` = t.`epicId`
  GROUP BY e.`projectId`
) x ON x.`projectId` = p.`id`
SET p.`progressPct` = x.pct;

COMMIT;
