-- CC-368 : une catégorie de ressources peut être commune à TOUS les projets
-- (projectId NULL), pour un compte de l'agence qu'on ne veut pas recopier dans
-- chaque projet. Les catégories existantes gardent leur projet.

-- AlterTable
ALTER TABLE `CustomCategory` MODIFY `projectId` VARCHAR(191) NULL;
