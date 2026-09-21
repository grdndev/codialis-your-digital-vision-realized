import { z } from "zod";
import { adminRoute, badRequest, jsonBody } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import type { Prisma, Role, Severity, TaskStatus, TicketType } from "@prisma/client";
import { maxSuffix, withUniqueRef } from "@/lib/refs";
import { closeSessions, openSession } from "@/lib/work-sessions";

export const dynamic = "force-dynamic";

// Écran « Tickets » — liste filtrable.
//
// Le filtrage par rôle est appliqué ICI, pas à l'affichage : un développeur ne
// voit que les tickets des projets sur lesquels il est affecté, et la requête
// ne doit jamais rapporter les autres, même s'ils ne sont pas rendus.

const STATUSES: TaskStatus[] = ["A_FAIRE", "EN_COURS", "EN_REVUE", "TERMINE"];
const SEVERITIES: Severity[] = ["BLOQUANT", "MAJEUR", "MINEUR"];

export const GET = adminRoute(
  ["DEV", "PM", "DIR"],
  async ({ user }, request) => {
    // Chaque filtre accepte PLUSIEURS valeurs, séparées par des virgules :
    // « les bloquants et les majeurs », « ces deux projets ». Une seule valeur
    // par critère obligeait à repasser la liste autant de fois qu'on voulait
    // de cas.
    const params = request.nextUrl.searchParams;
    const listOf = (key: string) =>
      (params.get(key) ?? "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);

    const projectFilter = listOf("project");
    const typeFilter = listOf("type").filter((t) => t === "BUG" || t === "DEV") as TicketType[];
    const statusFilter = listOf("status").filter((s) =>
      STATUSES.includes(s as TaskStatus),
    ) as TaskStatus[];
    const severityFilter = listOf("severity").filter((s) =>
      SEVERITIES.includes(s as Severity),
    ) as Severity[];

    // « Assigné à » n'est pas une liste : les trois cas s'excluent. `me` est le
    // cas courant — on ouvre l'écran pour voir ce qu'on a à faire — et c'est
    // pour cela que l'écran l'applique par défaut.
    const assigneeFilter = params.get("assignee");

    // Recherche libre. Elle porte sur la référence, le titre, la description et
    // les étapes de reproduction : on cherche un ticket soit par son numéro,
    // soit par un mot dont on se souvient. Elle se CROISE avec les filtres, elle
    // ne les remplace pas.
    const recherche = (params.get("q") ?? "").trim();

    const where: Prisma.TicketWhereInput = {};
    if (assigneeFilter === "me") where.assigneeId = user.id;
    else if (assigneeFilter === "none") where.assigneeId = null;
    if (projectFilter.length) where.projectId = { in: projectFilter };
    if (typeFilter.length) where.type = { in: typeFilter };
    if (statusFilter.length) where.status = { in: statusFilter };
    if (severityFilter.length) where.severity = { in: severityFilter };
    if (recherche) {
      where.OR = [
        { ref: { contains: recherche } },
        { title: { contains: recherche } },
        { description: { contains: recherche } },
        { steps: { contains: recherche } },
      ];
    }

    const [projects, tickets, team] = await Promise.all([
      prisma.project.findMany({
        include: { client: true },
        orderBy: { name: "asc" },
      }),
      prisma.ticket.findMany({
        where,
        include: {
          project: { include: { client: true } },
          epic: true,
          assignee: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      // Pour le traitement en masse : à qui réassigner une sélection.
      prisma.user.findMany({
        where: { role: { in: ["DEV", "PM", "DIR"] } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    // Tri par gravité fait ici et non en SQL : MySQL place les NULL en tête, et
    // Prisma n'expose pas `nulls: "last"` sur ce connecteur. Les tickets sans
    // gravité — les développements — doivent passer après les bugs, pas avant.
    const RANK: Record<string, number> = { BLOQUANT: 0, MAJEUR: 1, MINEUR: 2 };
    const ranked = [...tickets].sort((a, b) => {
      const ra = a.severity ? RANK[a.severity] : 3;
      const rb = b.severity ? RANK[b.severity] : 3;
      if (ra !== rb) return ra - rb;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return { projects, tickets: ranked, team };
  },
);


const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    type: z.enum(["BUG", "DEV"]),
    title: z.string().min(1),
    description: z.string(),
    // Les étapes se saisissaient seulement en modification : un bug arrivait
    // donc toujours sans la façon de le reproduire, c'est-à-dire sans ce qui
    // permet de le traiter.
    steps: z.string(),
    projectId: z.string().min(1),
    epicId: z.string().nullable(),
    severity: z.enum(["BLOQUANT", "MAJEUR", "MINEUR"]).nullable(),
    devNature: z.enum(["FRONT", "BACK", "API", "DESIGN"]).nullable(),
    estHours: z.number().min(0),
    assigneeId: z.string().nullable(),
  }),
  // Le kanban déplace une carte vers une colonne précise : l'enchaînement pas
  // à pas d'`update-status` ne sait pas exprimer ce geste.
  z.object({
    action: z.literal("set-status"),
    ticketId: z.string().min(1),
    status: z.enum(["A_FAIRE", "EN_COURS", "EN_REVUE", "TERMINE"]),
  }),
  // Traitement en masse : trier vingt tickets un par un pour leur poser le
  // même statut ou le même assigné coûte vingt allers-retours. `null` sur un
  // champ signifie « ne pas y toucher », et non « vider ».
  z.object({
    action: z.literal("bulk-update"),
    ticketIds: z.array(z.string().min(1)).min(1).max(200),
    status: z.enum(["A_FAIRE", "EN_COURS", "EN_REVUE", "TERMINE"]).nullable(),
    assigneeId: z.string().nullable(),
    clearAssignee: z.boolean(),
  }),
  z.object({
    action: z.literal("update"),
    ticketId: z.string().min(1),
    projectId: z.string().min(1),
    type: z.enum(["BUG", "DEV"]),
    title: z.string().min(1).max(300),
    description: z.string(),
    steps: z.string(),
    severity: z.enum(["BLOQUANT", "MAJEUR", "MINEUR"]).nullable(),
    devNature: z.enum(["FRONT", "BACK", "API", "DESIGN"]).nullable(),
    estHours: z.number().min(0),
    assigneeId: z.string().nullable(),
    epicId: z.string().nullable(),
  }),
  z.object({
    action: z.literal("toggle-criterion"),
    criterionId: z.string().min(1),
  }),
  // Les critères ne savaient que se cocher : la liste posée à la création était
  // définitive, alors que c'est justement ce qu'on affine en cours de route.
  z.object({
    action: z.literal("add-criterion"),
    ticketId: z.string().min(1),
    label: z.string().min(1).max(300),
  }),
  z.object({
    action: z.literal("update-criterion"),
    criterionId: z.string().min(1),
    label: z.string().min(1).max(300),
  }),
  z.object({ action: z.literal("delete-criterion"), criterionId: z.string().min(1) }),
  z.object({ action: z.literal("delete"), ticketId: z.string().min(1) }),
  z.object({
    action: z.literal("add-comment"),
    ticketId: z.string().min(1),
    body: z.string().min(1),
  }),
]);

// « En cours » lance le chronomètre au nom de l'assigné, tout autre statut
// l'arrête. Le temps se mesure à partir des changements de statut : personne
// n'a à le saisir.
async function applyTicketStatus(
  ticket: { id: string; ref: string; assigneeId: string | null; status: TaskStatus },
  nextStatus: TaskStatus,
  actor: { id: string; role: Role },
): Promise<{ ok: true; ref: string; notice?: string }> {
  // Clôturer, c'est constater que le travail est bon. Ce n'est pas à qui l'a
  // fait de le dire : un développeur va jusqu'à « En revue », la chefferie de
  // projet et la direction ferment.
  if (nextStatus === "TERMINE" && actor.role === "DEV") {
    badRequest("La clôture revient à la chefferie de projet ou à la direction.");
  }

  if (nextStatus === ticket.status) return { ok: true, ref: ticket.ref };

  let notice: string | undefined;
  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({ where: { id: ticket.id }, data: { status: nextStatus } });
    if (nextStatus !== "EN_COURS") {
      await closeSessions(tx, { ticketId: ticket.id });
      return;
    }
    const started = await openSession(tx, { ticketId: ticket.id }, ticket.assigneeId, actor.id);
    if (!started) notice = "Aucun assigné : le temps ne sera décompté pour personne.";
    else if (ticket.assigneeId !== actor.id)
      notice = "Le temps sera décompté pour l'utilisateur assigné.";
  });
  return { ok: true, ref: ticket.ref, notice };
}

export const POST = adminRoute(
  ["DEV", "PM", "DIR"],
  async ({ user }, request) => {
    const parsed = bodySchema.safeParse(await jsonBody(request));
    if (!parsed.success) badRequest("Requête invalide");
    const body = parsed.data;

    switch (body.action) {
      case "create": {
        const project = await prisma.project.findUnique({
          where: { id: body.projectId },
        });
        const prefix = `${project?.initials ?? "TIX"}-`;
        // Les références sont numérotées par projet, à la suite de la plus
        // haute déjà attribuée sur ce préfixe.
        const nextRef = async () => {
          const refs = await prisma.ticket.findMany({
            where: { ref: { startsWith: prefix } },
            select: { ref: true },
          });
          return `${prefix}${
            (maxSuffix(
              refs.map((r) => r.ref),
              prefix,
            ) ?? 300) + 1
          }`;
        };

        const ticket = await withUniqueRef(nextRef, (ref) =>
          prisma.ticket.create({
            data: {
              ref,
              steps: body.steps,
              projectId: body.projectId,
              epicId: body.epicId,
              type: body.type,
              // La gravité ne concerne qu'un bug, la nature qu'un développement.
              severity: body.type === "BUG" ? body.severity : null,
              devNature: body.type === "DEV" ? body.devNature : null,
              title: body.title,
              description: body.description,
              estHours: body.estHours,
              // Un développeur qui crée un ticket sans désigner personne se
              // l'attribue : c'est le cas courant.
              assigneeId:
                body.assigneeId ?? (user.role === "DEV" ? user.id : null),
              creatorId: user.id,
              // Critères d'acceptation de départ, adaptés au type de ticket.
              criteria: {
                create: [
                  {
                    label:
                      body.type === "BUG"
                        ? "Le comportement signalé ne se reproduit plus"
                        : "La fonctionnalité correspond à la description",
                    order: 0,
                  },
                  { label: "Testé en préprod", order: 1 },
                  {
                    label:
                      body.type === "BUG"
                        ? "Pas de régression identifiée"
                        : "Validé par le chef de projet",
                    order: 2,
                  },
                ],
              },
            },
          }),
        );
        // La référence sert au frontend pour rediriger vers le ticket créé.
        return { ok: true, ref: ticket.ref };
      }

      case "set-status": {
        const ticket = await prisma.ticket.findUnique({ where: { id: body.ticketId } });
        if (!ticket) badRequest("Ticket introuvable");
        return applyTicketStatus(ticket, body.status, user);
      }

      case "bulk-update": {
        if (!body.status && !body.assigneeId && !body.clearAssignee) {
          badRequest("Aucune modification demandée");
        }
        const tickets = await prisma.ticket.findMany({ where: { id: { in: body.ticketIds } } });
        if (!tickets.length) badRequest("Aucun ticket sélectionné");

        // L'assigné se pose d'abord : changer de porteur arrête le chronomètre
        // du précédent, et le statut demandé s'applique ensuite par-dessus.
        if (body.assigneeId || body.clearAssignee) {
          const nextAssignee = body.clearAssignee ? null : body.assigneeId;
          for (const ticket of tickets) {
            if (ticket.assigneeId === nextAssignee) continue;
            if (ticket.status === "EN_COURS") {
              await prisma.$transaction((tx) => closeSessions(tx, { ticketId: ticket.id }));
            }
            await prisma.ticket.update({
              where: { id: ticket.id },
              data: {
                assigneeId: nextAssignee,
                ...(ticket.status === "EN_COURS" && !body.status
                  ? { status: "A_FAIRE" as TaskStatus }
                  : {}),
              },
            });
          }
        }

        if (body.status) {
          const fresh = await prisma.ticket.findMany({ where: { id: { in: body.ticketIds } } });
          for (const ticket of fresh) {
            await applyTicketStatus(ticket, body.status, user);
          }
        }
        return { ok: true, count: tickets.length };
      }

      case "update": {
        const ticket = await prisma.ticket.findUnique({
          where: { id: body.ticketId },
          select: { ref: true, projectId: true, status: true, assigneeId: true },
        });
        if (!ticket) badRequest("Ticket introuvable");

        const movedProject = body.projectId !== ticket.projectId;
        // Passer la main pendant que le chronomètre tourne l'arrête pour le
        // précédent assigné, et le ticket revient à « À faire » : au suivant de
        // le démarrer.
        const handover = ticket.status === "EN_COURS" && ticket.assigneeId !== body.assigneeId;
        // Déplacer un ticket lui donne une nouvelle référence, au préfixe du
        // projet d'accueil : une référence porte le projet, en garder une qui
        // désigne l'ancien induirait en erreur à chaque lecture. Le numéro
        // reprend au-delà du plus grand déjà attribué sur ce préfixe.
        let nextRef = ticket.ref;
        if (movedProject) {
          const target = await prisma.project.findUnique({
            where: { id: body.projectId },
            select: { id: true, initials: true },
          });
          if (!target) badRequest("Projet introuvable");

          const prefix = `${target.initials}-`;
          const refs = await prisma.ticket.findMany({
            where: { ref: { startsWith: prefix } },
            select: { ref: true },
          });
          nextRef = `${prefix}${(maxSuffix(refs.map((r) => r.ref), prefix) ?? 300) + 1}`;
        }

        if (handover) await prisma.$transaction((tx) => closeSessions(tx, { ticketId: body.ticketId }));
        await prisma.ticket.update({
          where: { id: body.ticketId },
          data: {
            ...(handover ? { status: "A_FAIRE" as TaskStatus } : {}),
            ref: nextRef,
            projectId: body.projectId,
            // Un lot appartient à un projet : le changer de projet rend le
            // rattachement caduc.
            epicId: movedProject ? null : body.epicId,
            type: body.type,
            title: body.title,
            description: body.description,
            steps: body.steps,
            // La gravité ne concerne qu'un bug, la nature qu'un développement :
            // on efface celle qui ne correspond plus au type retenu.
            severity: body.type === "BUG" ? body.severity : null,
            devNature: body.type === "DEV" ? body.devNature : null,
            estHours: body.estHours,
            assigneeId: body.assigneeId,
          },
        });
        // La référence renvoyée est la NOUVELLE : le frontend s'en sert pour
        // revalider et rediriger, l'ancienne adresse n'existe plus.
        return {
          ok: true,
          ref: nextRef,
          previousRef: ticket.ref,
          notice: handover
            ? "Le temps en cours a été arrêté pour l'assigné précédent, le ticket est repassé à « À faire »."
            : undefined,
        };
      }

      case "toggle-criterion": {
        // Bascule lue en base : deux clics concurrents ne se contredisent pas.
        const criterion = await prisma.ticketCriterion.findUnique({
          where: { id: body.criterionId },
        });
        if (!criterion) badRequest("Critère introuvable");
        await prisma.ticketCriterion.update({
          where: { id: body.criterionId },
          data: { done: !criterion.done },
        });
        return;
      }

      case "delete": {
        // Critères, commentaires et pièces jointes tombent en cascade (schéma).
        // Les saisies de temps, elles, ne tombent PAS : `TimeEntry.ticketId` est
        // une relation facultative, les heures déjà passées restent au projet.
        // Elles perdent seulement leur rattachement au ticket, ce qui est juste
        // — le travail a bien eu lieu.
        const ticket = await prisma.ticket.findUnique({
          where: { id: body.ticketId },
          select: { ref: true },
        });
        if (!ticket) badRequest("Ticket introuvable");
        await prisma.timeEntry.updateMany({
          where: { ticketId: body.ticketId },
          data: { ticketId: null },
        });
        await prisma.ticket.delete({ where: { id: body.ticketId } });
        return { ok: true, ref: ticket.ref };
      }

      case "add-criterion": {
        const ticket = await prisma.ticket.findUnique({
          where: { id: body.ticketId },
          select: { ref: true },
        });
        if (!ticket) badRequest("Ticket introuvable");
        const count = await prisma.ticketCriterion.count({ where: { ticketId: body.ticketId } });
        await prisma.ticketCriterion.create({
          data: { ticketId: body.ticketId, label: body.label.trim(), order: count },
        });
        return { ok: true, ref: ticket.ref };
      }

      case "update-criterion": {
        const criterion = await prisma.ticketCriterion.update({
          where: { id: body.criterionId },
          data: { label: body.label.trim() },
          select: { ticket: { select: { ref: true } } },
        });
        return { ok: true, ref: criterion.ticket.ref };
      }

      case "delete-criterion": {
        const criterion = await prisma.ticketCriterion.findUnique({
          where: { id: body.criterionId },
          select: { ticket: { select: { ref: true } } },
        });
        if (!criterion) badRequest("Critère introuvable");
        await prisma.ticketCriterion.delete({ where: { id: body.criterionId } });
        return { ok: true, ref: criterion.ticket.ref };
      }

      case "add-comment":
        // L'auteur est la session.
        await prisma.ticketComment.create({
          data: { ticketId: body.ticketId, authorId: user.id, body: body.body },
        });
        return;
    }
  },
);
