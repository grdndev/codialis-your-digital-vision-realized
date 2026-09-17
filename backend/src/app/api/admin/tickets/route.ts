import { z } from "zod";
import { adminRoute, badRequest, jsonBody } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import type { Prisma, Severity, TaskStatus } from "@prisma/client";
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
    const params = request.nextUrl.searchParams;
    const projectFilter = params.get("project");
    const typeFilter = params.get("type");
    const statusFilter = params.get("status");
    const severityFilter = params.get("severity");

    const where: Prisma.TicketWhereInput = {};
    if (projectFilter) where.projectId = projectFilter;
    if (typeFilter === "BUG" || typeFilter === "DEV") where.type = typeFilter;
    if (statusFilter && STATUSES.includes(statusFilter as TaskStatus)) {
      where.status = statusFilter as TaskStatus;
    }
    if (severityFilter && SEVERITIES.includes(severityFilter as Severity)) {
      where.severity = severityFilter as Severity;
    }

    if (user.role === "DEV") {
      const assignments = await prisma.projectAssignment.findMany({
        where: { userId: user.id },
        select: { projectId: true },
      });
      const assignedProjectIds = assignments.map((a) => a.projectId);
      // Deux titres à voir un ticket : être affecté à son projet, ou en être
      // nommément l'assigné. L'affectation seule ne suffisait pas — un ticket
      // confié à quelqu'un qui n'est pas sur le projet restait invisible pour
      // lui, y compris dans sa propre liste.
      where.OR = [{ projectId: { in: assignedProjectIds } }, { assigneeId: user.id }];
      // Le filtre projet reste appliqué par `where.projectId` : deviner un
      // identifiant ne montre donc rien de plus que ses propres tickets.
    }

    const [projects, tickets] = await Promise.all([
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

    return { projects, tickets: ranked };
  },
);

const NEXT_STATUS: Record<TaskStatus, TaskStatus | null> = {
  A_FAIRE: "EN_COURS",
  EN_COURS: "EN_REVUE",
  EN_REVUE: "TERMINE",
  TERMINE: null,
};

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    type: z.enum(["BUG", "DEV"]),
    title: z.string().min(1),
    description: z.string(),
    projectId: z.string().min(1),
    epicId: z.string().nullable(),
    severity: z.enum(["BLOQUANT", "MAJEUR", "MINEUR"]).nullable(),
    devNature: z.enum(["FRONT", "BACK", "API", "DESIGN"]).nullable(),
    estHours: z.number().min(0),
    assigneeId: z.string().nullable(),
  }),
  z.object({
    action: z.literal("update-status"),
    ticketId: z.string().min(1),
    transition: z.enum(["advance", "reopen"]),
  }),
  // Le kanban déplace une carte vers une colonne précise : l'enchaînement pas
  // à pas d'`update-status` ne sait pas exprimer ce geste.
  z.object({
    action: z.literal("set-status"),
    ticketId: z.string().min(1),
    status: z.enum(["A_FAIRE", "EN_COURS", "EN_REVUE", "TERMINE"]),
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
  actorId: string,
): Promise<{ ok: true; ref: string; notice?: string }> {
  if (nextStatus === ticket.status) return { ok: true, ref: ticket.ref };

  let notice: string | undefined;
  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({ where: { id: ticket.id }, data: { status: nextStatus } });
    if (nextStatus !== "EN_COURS") {
      await closeSessions(tx, { ticketId: ticket.id });
      return;
    }
    const started = await openSession(tx, { ticketId: ticket.id }, ticket.assigneeId, actorId);
    if (!started) notice = "Aucun assigné : le temps ne sera décompté pour personne.";
    else if (ticket.assigneeId !== actorId)
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
              steps: "",
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

      case "update-status": {
        const ticket = await prisma.ticket.findUnique({
          where: { id: body.ticketId },
        });
        if (!ticket) badRequest("Ticket introuvable");

        const nextStatus =
          body.transition === "reopen" ? "A_FAIRE" : NEXT_STATUS[ticket.status];
        // Un ticket déjà terminé n'a pas d'étape suivante.
        if (!nextStatus) return { ok: true, ref: ticket.ref };

        return applyTicketStatus(ticket, nextStatus, user.id);
      }

      case "set-status": {
        const ticket = await prisma.ticket.findUnique({ where: { id: body.ticketId } });
        if (!ticket) badRequest("Ticket introuvable");
        return applyTicketStatus(ticket, body.status, user.id);
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
