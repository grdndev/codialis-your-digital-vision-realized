-- Objectifs (CC-356) : la date d'atteinte devient la date du constat, qui dit
-- aussi « non atteint » et pourquoi. La table est vide en production au moment
-- de la migration (30/09) : le renommage ne réécrit rien.
ALTER TABLE `MonthlyGoal` RENAME COLUMN `doneAt` TO `closedAt`;
ALTER TABLE `MonthlyGoal` ADD COLUMN `outcome` ENUM('ATTEINT', 'NON_ATTEINT') NULL,
    ADD COLUMN `outcomeNote` TEXT NULL;
