-- CreateIndex
CREATE UNIQUE INDEX `Invoice_projectId_milestone_key` ON `Invoice`(`projectId`, `milestone`);
