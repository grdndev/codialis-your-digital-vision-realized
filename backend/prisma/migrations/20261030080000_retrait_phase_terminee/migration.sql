-- CC-364 : la phase « Terminé » (FIN) disparaît, elle faisait doublon avec
-- « Clôturé » (CLO). Les projets qui y étaient passent SOUS GARANTIE (WAR),
-- arbitrage Denis du 30/10 (cookstra seul en prod). La mise à jour vient
-- AVANT le changement de type : MySQL refuse de retirer une valeur d'ENUM
-- encore portée par une ligne.
UPDATE `Project` SET `group` = 'WAR' WHERE `group` = 'FIN';

-- AlterTable
ALTER TABLE `Project` MODIFY `group` ENUM('DEV', 'WAR', 'MAI', 'CLO') NOT NULL;
