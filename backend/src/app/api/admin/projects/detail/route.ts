import { z } from "zod";
import { adminRoute, parseQuery } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { USER_IDENTITY } from "@/lib/user-identity";
import { devCanSeeProject } from "@/lib/project-access";

export const dynamic = "force-dynamic";

// GET /api/admin/projects/detail?id=[&fiche=1][&echanges=1]
//
// Renvoie le projet, ses épics et ses tickets — rangés dans un épic ou non,
// c'est l'écran qui les regroupe —, plus l'équipe assignable.
// Les données de l'onglet « Fiche » (accès techniques, questions client) ne
// sont chargées que si l'onglet est ouvert : c'est deux requêtes de moins sur
// les vues Liste et Kanban, qui sont les plus consultées. De même pour
// l'onglet « Échanges client » (CC-374), réservé à la chefferie et à la
// direction : seul `clientThreadWaiting` est lu à chaque fois, pour signaler
// sur l'onglet un message du client resté sans réponse.
//
// `access` distingue les deux raisons d'un écran vide : le projet n'existe pas,
// ou le développeur n'y a aucun ticket assigné — l'écran renvoie
// à la liste avec un message différent dans chaque cas. Le contrôle est ici et
// pas seulement sur la liste : sans lui, l'adresse d'un projet masqué suffirait
// à le lire en entier.

const querySchema = z.object({
  id: z.string().min(1).describe("Identifiant du projet"),
  fiche: z.string().optional().describe("`1` = charger aussi l'onglet Fiche (accès techniques, questions au client)"),
  echanges: z
    .string()
    .optional()
    .describe("`1` = charger aussi l'onglet Échanges client (PM et DIR) : le fil avec le client et le nombre de comptes client"),
});

export const GET = adminRoute(["DEV", "PM", "DIR"], async ({ user }, request) => {
  const query = parseQuery(querySchema, request);
  const id = query.id;
  const fiche = query.fiche === "1";
  // La relation avec le client est l'affaire de la chefferie et de la
  // direction : un développeur ne reçoit pas le fil.
  const clientDesk = user.role === "PM" || user.role === "DIR";
  const echanges = clientDesk && query.echanges === "1";

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      epics: {
        orderBy: { order: "asc" },
        include: { lead: USER_IDENTITY },
      },
    },
  });
  if (!project) return { access: "not-found" as const };
  if (!(await devCanSeeProject(user, project.id))) return { access: "forbidden" as const };

  const [team, apis, questions, tickets, clients, lastClientMessage, clientMessages, clientAccounts] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: ["DEV", "PM"] } }, orderBy: { name: "asc" } }),
    fiche ? prisma.apiCredential.findMany({ where: { projectId: id }, orderBy: { order: "asc" } }) : [],
    fiche
      ? prisma.clientQuestion.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" } })
      : [],
    // Tout le travail du projet : bugs et développements, dans un épic ou non
    // (les anciennes tâches en sont, CC-365).
    prisma.ticket.findMany({
      where: { projectId: id },
      include: { assignee: USER_IDENTITY, epic: true },
      orderBy: { createdAt: "desc" },
    }),
    // Pour pouvoir rattacher le projet à un autre client depuis sa fiche.
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    // Le dernier message écrit par quelqu'un : une réponse automatique ne
    // répond pas au client (même règle que la cloche).
    clientDesk
      ? prisma.clientThreadMessage.findFirst({
          where: { projectId: id, auto: false },
          orderBy: { createdAt: "desc" },
          select: { fromClient: true },
        })
      : null,
    echanges
      ? prisma.clientThreadMessage.findMany({ where: { projectId: id }, orderBy: { createdAt: "asc" } })
      : [],
    // Sans compte client rattaché à ce client, personne ne lit le portail :
    // l'onglet le dit plutôt que de laisser répondre dans le vide.
    echanges ? prisma.user.count({ where: { role: "CLIENT", clientId: project.clientId } }) : 0,
  ]);

  return {
    access: "ok" as const,
    project,
    team: team.map((t) => ({ id: t.id, name: t.name })),
    apis,
    questions,
    tickets,
    clients,
    clientThreadWaiting: lastClientMessage?.fromClient ?? false,
    clientMessages,
    clientAccounts,
  };
}, {
  summary:
    "Fiche projet : `project` (client, épics), tous ses `tickets`, équipe assignable, clients. `access` vaut `not-found`, `forbidden` (DEV sans ticket assigné sur ce projet) ou `ok`. Avec `fiche=1` : accès techniques (`apis`) et questions au client. Pour PM et DIR : `clientThreadWaiting` (le dernier message du fil vient du client) et, avec `echanges=1`, le fil (`clientMessages`) et le nombre de comptes client (`clientAccounts`).",
  query: querySchema,
});
