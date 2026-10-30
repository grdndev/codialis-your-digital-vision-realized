import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { refNumber } from "@/lib/refs";

// Le périmètre d'un compte client (CC-374) : les projets de SON entreprise.
//
// Un compte CLIENT est rattaché à un client par l'écran Comptes
// (`User.clientId`) ; il voit tous les projets de ce client. Le portail lisait
// jusqu'ici `ProjectAssignment`, qu'aucun écran n'écrit (TRAP-014) : tout
// compte client tombait sur une page introuvable.
//
// Toutes les routes du portail passent par ici. Le projet demandé (`?project=`)
// n'est qu'une PRÉFÉRENCE : il n'est retenu que s'il appartient au client de la
// session, sinon c'est le premier de ses projets. Changer le paramètre ne peut
// donc pas ouvrir le projet d'un autre client.

type ClientUser = { clientId: string | null };

// Les projets du client, ceux en cours d'abord (le plus récent en tête), puis
// les clôturés : on vient voir ce qui avance, pas ce qui est livré depuis
// longtemps.
export async function clientProjects(user: ClientUser) {
  if (!user.clientId) return [];
  const projects = await prisma.project.findMany({
    where: { clientId: user.clientId },
    orderBy: { openedAt: "desc" },
    select: { id: true, name: true, group: true },
  });
  return [...projects.filter((p) => p.group !== "CLO"), ...projects.filter((p) => p.group === "CLO")];
}

export async function clientProjectId(user: ClientUser, wanted?: string | null): Promise<string | null> {
  const projects = await clientProjects(user);
  return (projects.find((p) => p.id === wanted) ?? projects[0])?.id ?? null;
}

// Paramètre commun aux lectures du portail.
export const portalProjectParam = z
  .string()
  .optional()
  .describe("Projet du client à afficher ; absent ou étranger à son entreprise = le premier de ses projets");

// Ce que le client voit d'un ticket : ni assigné, ni temps, ni estimation. La
// description n'est envoyée que pour les tickets d'un épic (DEC-070) : hors
// épic, ce sont surtout des bugs et des tickets internes, rédigés pour
// l'équipe.
const TICKET_FIELDS = { id: true, ref: true, title: true, type: true, status: true, dueAt: true, updatedAt: true } as const;

// Les épics du projet et leurs tickets, pour les écrans « Avancement » et
// « Fonctionnalités » du portail. Les tickets suivent l'ordre de leur
// numérotation, celui des anciennes tâches (CC-365). Un ticket ANNULÉ n'y
// figure pas (CC-372) : c'est une décision interne, le client n'a pas à voir ce
// qu'on a écarté. De l'épic, ni l'estimation ni le responsable ne sortent.
export async function portalEpics(projectId: string) {
  const epics = await prisma.epic.findMany({
    where: { projectId },
    orderBy: { order: "asc" },
    select: {
      id: true,
      title: true,
      objective: true,
      dueAt: true,
      tickets: {
        where: { status: { not: "ANNULE" } },
        select: { ...TICKET_FIELDS, description: true },
      },
    },
  });
  return epics.map((e) => ({
    ...e,
    tickets: [...e.tickets].sort((a, b) => refNumber(a.ref) - refNumber(b.ref)),
  }));
}

// Les tickets HORS épic (CC-374) : l'avancement du projet les compte (DEC-064),
// la liste du client doit donc les montrer aussi, sans quoi un projet sans épic
// affichait un pourcentage au-dessus d'une liste vide.
export async function portalOtherTickets(projectId: string) {
  const tickets = await prisma.ticket.findMany({
    where: { projectId, epicId: null, status: { not: "ANNULE" } },
    select: TICKET_FIELDS,
  });
  return tickets.sort((a, b) => refNumber(a.ref) - refNumber(b.ref));
}
