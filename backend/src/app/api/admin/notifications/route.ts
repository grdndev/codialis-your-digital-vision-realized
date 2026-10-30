import { adminRoute } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { dueHorizon, dueNotifications, waitingClientThreads } from "@/lib/notifications";
import { USER_IDENTITY } from "@/lib/user-identity";

export const dynamic = "force-dynamic";

// GET /api/admin/notifications — la cloche de la barre du haut (CC-366).
//
// Hors convention « une route par écran » : la cloche est sur TOUS les écrans,
// et la liste se lit à chaque changement de page ; la greffer sur /me ferait
// payer la requête aux appels qui n'en ont pas l'usage (Paramètres, jetons).
//
// La requête ne fait que dégrossir — tickets datés d'avant l'horizon, aux
// statuts concernés ; la règle elle-même, et l'ordre, sont ceux de
// lib/notifications.ts. Pour PM et DIR s'y ajoutent les fils du portail client
// restés sans réponse (CC-374).
export const GET = adminRoute(["DEV", "PM", "DIR"], async ({ user }) => {
  const now = new Date();
  const reviewer = user.role === "PM" || user.role === "DIR";

  const tickets = await prisma.ticket.findMany({
    where: {
      dueAt: { not: null, lt: dueHorizon(now) },
      OR: [
        { assigneeId: user.id, status: { in: ["A_FAIRE", "EN_COURS"] } },
        ...(reviewer ? [{ status: "EN_REVUE" as const }] : []),
      ],
    },
    select: {
      id: true,
      ref: true,
      title: true,
      status: true,
      dueAt: true,
      createdAt: true,
      assigneeId: true,
      assignee: USER_IDENTITY,
      project: { select: { id: true, name: true, client: { select: { name: true } } } },
    },
  });

  const notifications = dueNotifications(tickets, user, now).map(({ ticket, reason, days, overdue }) => ({
    ref: ticket.ref,
    title: ticket.title,
    status: ticket.status,
    dueAt: ticket.dueAt,
    assignee: ticket.assignee,
    project: ticket.project,
    reason,
    days,
    overdue,
  }));

  return {
    notifications,
    overdueCount: notifications.filter((n) => n.overdue).length,
    clientMessages: reviewer ? await waitingClientMessages() : [],
  };
}, {
  summary:
    "Notifications d'échéance de l'appelant, calculées à chaque lecture : ses tickets À faire ou En cours (`reason: assignee`), et pour PM et DIR tous les tickets En revue de l'agence (`reason: review`), dont l'échéance est dépassée ou tombe dans les 7 jours. Les dépassées d'abord, la plus ancienne en tête. `days` = jours jusqu'à l'échéance (négatif = en retard). Pour PM et DIR, `clientMessages` : les projets dont le fil « Échanges » du portail client attend une réponse, le plus ancien en tête (`since` = premier message sans réponse, `count`, extrait du dernier).",
});

// Les fils qui attendent, avec le projet et le dernier message du client. La
// règle ne lit que trois colonnes de chaque message ; le texte n'est relu que
// pour les fils retenus.
async function waitingClientMessages() {
  const messages = await prisma.clientThreadMessage.findMany({
    where: { auto: false },
    select: { projectId: true, fromClient: true, auto: true, createdAt: true },
  });
  const waiting = waitingClientThreads(messages);
  if (!waiting.length) return [];

  const [projects, lasts] = await Promise.all([
    prisma.project.findMany({
      where: { id: { in: waiting.map((w) => w.projectId) } },
      select: { id: true, name: true, client: { select: { name: true } } },
    }),
    Promise.all(
      waiting.map((w) =>
        prisma.clientThreadMessage.findFirst({
          where: { projectId: w.projectId, fromClient: true, auto: false },
          orderBy: { createdAt: "desc" },
          select: { authorLabel: true, body: true },
        }),
      ),
    ),
  ]);
  const projectOf = new Map(projects.map((p) => [p.id, p]));

  return waiting.flatMap((w, i) => {
    const project = projectOf.get(w.projectId);
    const last = lasts[i];
    if (!project || !last) return [];
    return [{
      project,
      since: w.since,
      count: w.count,
      author: last.authorLabel,
      excerpt: last.body.length > 140 ? `${last.body.slice(0, 140)}…` : last.body,
    }];
  });
}
