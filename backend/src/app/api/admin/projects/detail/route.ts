import { z } from "zod";
import { adminRoute, parseQuery } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { USER_IDENTITY } from "@/lib/user-identity";
import { devCanSeeProject } from "@/lib/project-access";

export const dynamic = "force-dynamic";

// GET /api/admin/projects/detail?id=[&fiche=1]
//
// Renvoie le projet, ses épics et ses tickets — rangés dans un épic ou non,
// c'est l'écran qui les regroupe —, plus l'équipe assignable.
// Les données de l'onglet « Fiche » (accès techniques, questions client) ne
// sont chargées que si l'onglet est ouvert : c'est deux requêtes de moins sur
// les vues Liste et Kanban, qui sont les plus consultées.
//
// `access` distingue les deux raisons d'un écran vide : le projet n'existe pas,
// ou le développeur n'y a aucun ticket assigné — l'écran renvoie
// à la liste avec un message différent dans chaque cas. Le contrôle est ici et
// pas seulement sur la liste : sans lui, l'adresse d'un projet masqué suffirait
// à le lire en entier.

const querySchema = z.object({
  id: z.string().min(1).describe("Identifiant du projet"),
  fiche: z.string().optional().describe("`1` = charger aussi l'onglet Fiche (accès techniques, questions au client)"),
});

export const GET = adminRoute(["DEV", "PM", "DIR"], async ({ user }, request) => {
  const query = parseQuery(querySchema, request);
  const id = query.id;
  const fiche = query.fiche === "1";

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

  const [team, apis, questions, tickets, clients] = await Promise.all([
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
  ]);

  return {
    access: "ok" as const,
    project,
    team: team.map((t) => ({ id: t.id, name: t.name })),
    apis,
    questions,
    tickets,
    clients,
  };
}, {
  summary:
    "Fiche projet : `project` (client, épics), tous ses `tickets`, équipe assignable, clients. `access` vaut `not-found`, `forbidden` (DEV sans ticket assigné sur ce projet) ou `ok`. Avec `fiche=1` : accès techniques (`apis`) et questions au client.",
  query: querySchema,
});
