import "server-only";
import type { Prisma } from "@prisma/client";
import { reprendreFichiersJoints } from "@/lib/files";
import { prisma } from "@/lib/prisma";
import { recomputeProjectProgress } from "@/lib/project-progress";
import { refreshAfterTimeChange, refreshProjectSpent } from "@/lib/work-sessions";

// Suppression de tickets — à l'unité (fiche ticket), en masse (bandeau de
// sélection) — et d'un projet entier (CC-375). Une seule règle pour les trois :
// la base emporte d'elle-même critères, commentaires, pièces jointes et
// sessions de temps (CASCADE), mais deux choses lui échappent.
//
// - Les FICHIERS des pièces jointes : la ligne part, le fichier resterait dans
//   le volume de codialis.files sans plus rien qui le désigne (TRAP-029).
// - Le PARTAGE du temps : une session qui disparaît rend sa part aux sessions
//   menées en parallèle par la même personne (TRAP-046). Sans recalcul, les
//   tickets d'à côté garderaient un temps passé amputé.
//
// Les deux se relèvent donc AVANT la suppression, pendant que les lignes
// existent encore, et se traitent après.

type Leftovers = { fileIds: (string | null)[]; userIds: string[] };

async function leftoversOf(where: Prisma.TicketWhereInput): Promise<Leftovers> {
  const [pieces, sessions] = await Promise.all([
    prisma.ticketAttachment.findMany({ where: { ticket: where }, select: { fileId: true } }),
    prisma.workSession.findMany({
      where: { ticket: where },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);
  return { fileIds: pieces.map((p) => p.fileId), userIds: sessions.map((s) => s.userId) };
}

async function cleanUp({ fileIds, userIds }: Leftovers): Promise<void> {
  await reprendreFichiersJoints(fileIds);
  // Recalcule les sessions restantes de chaque personne, puis le temps passé
  // des tickets dont la part a bougé et celui de leurs projets.
  for (const userId of userIds) {
    await prisma.$transaction((tx) => refreshAfterTimeChange(tx, { userId }));
  }
}

// Supprime des tickets, d'un ou de plusieurs projets. Les saisies de temps ne
// tombent PAS : elles perdent leur rattachement au ticket et restent au
// projet — le travail a bien eu lieu. Rend les tickets effectivement
// supprimés : une liste vide veut dire qu'aucun n'existait.
export async function deleteTickets(ticketIds: string[]) {
  const tickets = await prisma.ticket.findMany({
    where: { id: { in: ticketIds } },
    select: { id: true, ref: true, projectId: true },
  });
  if (!tickets.length) return tickets;
  const ids = tickets.map((t) => t.id);

  const leftovers = await leftoversOf({ id: { in: ids } });
  await prisma.$transaction([
    prisma.timeEntry.updateMany({ where: { ticketId: { in: ids } }, data: { ticketId: null } }),
    prisma.ticket.deleteMany({ where: { id: { in: ids } } }),
  ]);
  await cleanUp(leftovers);

  // Chaque projet touché perd ces tickets de son avancement, et le temps
  // mesuré qu'ils portaient de ses heures.
  for (const projectId of new Set(tickets.map((t) => t.projectId))) {
    await recomputeProjectProgress(projectId);
    await prisma.$transaction((tx) => refreshProjectSpent(tx, projectId));
  }
  return tickets;
}

// Supprime un projet et tout ce qui n'a de sens que par lui : tickets, épics,
// ressources, échanges avec le client (CASCADE). Ce qui a une vie propre lui
// survit sans projet (SET NULL) : saisies de temps, affaires du CRM, objectifs,
// fils de messagerie interne. Les factures, elles, sont refusées en amont par
// la route : elles partiraient en cascade, payées comprises.
export async function deleteProject(projectId: string): Promise<void> {
  const leftovers = await leftoversOf({ projectId });
  await prisma.project.delete({ where: { id: projectId } });
  await cleanUp(leftovers);
}
