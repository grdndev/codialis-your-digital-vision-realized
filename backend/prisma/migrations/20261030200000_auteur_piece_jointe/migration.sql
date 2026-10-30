-- CC-373 : une pièce jointe s'affiche aussi dans le fil des commentaires, au
-- moment où elle a été déposée, avec qui l'a jointe. Les pièces existantes
-- restent sans auteur (NULL), comme celles d'un compte supprimé (DEC-032).

-- AlterTable
ALTER TABLE `TicketAttachment` ADD COLUMN `uploadedById` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `TicketAttachment` ADD CONSTRAINT `TicketAttachment_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
