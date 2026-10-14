-- CC-365 : une « tâche » n'existe plus, le travail d'un projet est fait de
-- tickets, rattachés à un épic ou non. Chaque tâche est COPIÉE en ticket, rien
-- n'est supprimé : les tables Task* restent intactes le temps de valider la
-- reprise, une migration suivante les retirera.
--
-- Le ticket garde l'IDENTIFIANT de la tâche : ses critères, commentaires,
-- pièces jointes, sessions et saisies de temps s'y rebranchent en changeant
-- une seule colonne, et l'ancienne adresse d'une tâche retrouve son ticket.
--
-- Chaque copie n'insère que ce qui manque (`NOT EXISTS` sur l'identifiant) :
-- rejouer ce script — pour une tâche créée par l'ancien code pendant le
-- déploiement — ne duplique rien.

-- AlterTable
ALTER TABLE `Ticket` ADD COLUMN `dueAt` DATETIME(3) NULL;

-- Les tâches deviennent des tickets « Développement », sans gravité ni nature
-- (rien ne permet de les déduire), sans étapes ni créateur (une tâche n'en
-- avait pas). Statut, assigné, épic, estimation, temps passé (heures importées
-- d'Asana comprises), échéance et dates sont repris tels quels.
--
-- Les références continuent la numérotation du préfixe du projet, au-delà de
-- la plus haute déjà attribuée (300 si aucune, comme `create`), dans l'ordre
-- d'affichage : épic après épic, tâche après tâche. Le plus haut numéro se lit
-- sur TOUS les tickets du préfixe, comme `maxSuffix` : deux projets aux mêmes
-- initiales partageraient la suite.
INSERT INTO `Ticket` (
  `id`, `ref`, `projectId`, `epicId`, `type`, `severity`, `devNature`, `status`,
  `title`, `description`, `steps`, `module`, `estHours`, `spentHours`,
  `assigneeId`, `creatorId`, `clientReported`, `triageState`, `dueAt`,
  `createdAt`, `updatedAt`
)
SELECT
  t.`id`,
  CONCAT(
    p.`initials`, '-',
    COALESCE(
      (
        SELECT MAX(CAST(SUBSTRING(k.`ref`, CHAR_LENGTH(p.`initials`) + 2) AS UNSIGNED))
        FROM `Ticket` k
        WHERE k.`ref` REGEXP CONCAT('^', p.`initials`, '-[0-9]+$')
      ),
      300
    ) + ROW_NUMBER() OVER (
      PARTITION BY p.`initials`
      ORDER BY e.`order`, e.`createdAt`, e.`id`, t.`order`, t.`createdAt`, t.`id`
    )
  ),
  e.`projectId`, t.`epicId`, 'DEV', NULL, NULL, t.`status`,
  t.`title`, t.`description`, '', NULL, t.`estHours`, t.`spentHours`,
  t.`assigneeId`, NULL, false, 'A_QUALIFIER', t.`dueAt`,
  t.`createdAt`, t.`updatedAt`
FROM `Task` t
JOIN `Epic` e ON e.`id` = t.`epicId`
JOIN `Project` p ON p.`id` = e.`projectId`
WHERE NOT EXISTS (SELECT 1 FROM `Ticket` x WHERE x.`id` = t.`id`);

-- Critères, commentaires, pièces jointes : mêmes identifiants, rattachés au
-- ticket de même identifiant que leur tâche.
INSERT INTO `TicketCriterion` (`id`, `ticketId`, `label`, `done`, `order`)
SELECT c.`id`, c.`taskId`, c.`label`, c.`done`, c.`order`
FROM `TaskCriterion` c
WHERE NOT EXISTS (SELECT 1 FROM `TicketCriterion` x WHERE x.`id` = c.`id`);

INSERT INTO `TicketComment` (`id`, `ticketId`, `authorId`, `body`, `createdAt`)
SELECT c.`id`, c.`taskId`, c.`authorId`, c.`body`, c.`createdAt`
FROM `TaskComment` c
WHERE NOT EXISTS (SELECT 1 FROM `TicketComment` x WHERE x.`id` = c.`id`);

INSERT INTO `TicketAttachment` (`id`, `ticketId`, `filename`, `meta`, `fileId`, `driveFileId`, `mimeType`, `sizeBytes`, `createdAt`)
SELECT a.`id`, a.`taskId`, a.`filename`, a.`meta`, a.`fileId`, NULL, '', 0, a.`createdAt`
FROM `TaskAttachment` a
WHERE NOT EXISTS (SELECT 1 FROM `TicketAttachment` x WHERE x.`id` = a.`id`);

-- Le temps mesuré et déclaré passe au ticket. `taskId` est VIDÉ, pas seulement
-- doublé : la session pointe vers Task en cascade, et supprimer plus tard les
-- tâches emporterait sinon les sessions avec elles.
UPDATE `WorkSession` SET `ticketId` = `taskId`, `taskId` = NULL WHERE `taskId` IS NOT NULL;
UPDATE `TimeEntry` SET `ticketId` = `taskId`, `taskId` = NULL WHERE `taskId` IS NOT NULL;

-- L'avancement se lit désormais sur TOUS les tickets du projet, dans un épic
-- ou non (arbitrage du 14/10). Un projet sans ticket garde sa valeur, comme le
-- fait `recomputeProjectProgress`.
UPDATE `Project` p
JOIN (
  SELECT `projectId`, ROUND(100 * SUM(`status` = 'TERMINE') / COUNT(*)) AS pct
  FROM `Ticket`
  GROUP BY `projectId`
) x ON x.`projectId` = p.`id`
SET p.`progressPct` = x.pct;
