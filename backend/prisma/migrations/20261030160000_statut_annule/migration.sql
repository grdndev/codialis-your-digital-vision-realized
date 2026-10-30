-- CC-372 : un ticket peut être ANNULÉ, pour garder la trace de ce qu'on a
-- abandonné sans le confondre avec ce qui a été livré. Valeur ajoutée en fin
-- d'ENUM : aucune ligne existante ne change. InternalTask partage
-- l'énumération Prisma et suit donc le même type, sans l'utiliser.

-- AlterTable
ALTER TABLE `InternalTask` MODIFY `status` ENUM('A_FAIRE', 'EN_COURS', 'EN_REVUE', 'TERMINE', 'ANNULE') NOT NULL DEFAULT 'A_FAIRE';

-- AlterTable
ALTER TABLE `Ticket` MODIFY `status` ENUM('A_FAIRE', 'EN_COURS', 'EN_REVUE', 'TERMINE', 'ANNULE') NOT NULL DEFAULT 'A_FAIRE';
