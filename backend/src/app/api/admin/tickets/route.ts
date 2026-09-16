import { z } from "zod";
import { adminRoute, badRequest, jsonBody } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import type { Prisma, TaskStatus } from "@prisma/client";
import { maxSuffix, withUniqueRef } from "@/lib/refs";

export const dynamic = "force-dynamic";

// Écran « Tickets » — liste filtrable.
//
// Le filtrage par rôle est appliqué ICI, pas à l'affichage : un développeur ne
// voit que les tickets des projets sur lesquels il est affecté, et la requête
// ne doit jamais rapporter les autres, même s'ils ne sont pas rendus.

const STATUSES: TaskStatus[] = ["A_FAIRE", "EN_COURS", "EN_REVUE", "TERMINE"];

export const GET = adminRoute(
  ["DEV", "PM", "DIR"],
  async ({ user }, request) => {
    const params = request.nextUrl.searchParams;
    const projectFilter = params.get("project");
    const typeFilter = params.get("type");
    const statusFilter = params.get("status");

    const where: Prisma.TicketWhereInput = {};
    if (projectFilter) where.projectId = projectFilter;
    if (typeFilter === "BUG" || typeFilter === "DEV") where.type = typeFilter;
    if (statusFilter && STATUSES.includes(statusFilter as TaskStatus)) {
      where.status = statusFilter as TaskStatus;
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

    return { projects, tickets };
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
  z.object({
    action: z.literal("add-comment"),
    ticketId: z.string().min(1),
    body: z.string().min(1),
  }),
]);

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

        await prisma.ticket.update({
          where: { id: body.ticketId },
          data: { status: nextStatus },
        });
        return { ok: true, ref: ticket.ref };
      }

      case "set-status": {
        const ticket = await prisma.ticket.update({
          where: { id: body.ticketId },
          data: { status: body.status },
          select: { ref: true },
        });
        return { ok: true, ref: ticket.ref };
      }

      case "update": {
        const ticket = await prisma.ticket.findUnique({
          where: { id: body.ticketId },
          select: { ref: true, type: true },
        });
        if (!ticket) badRequest("Ticket introuvable");

        await prisma.ticket.update({
          where: { id: body.ticketId },
          data: {
            title: body.title,
            description: body.description,
            steps: body.steps,
            // Même règle qu'à la création : la gravité ne concerne qu'un bug,
            // la nature qu'un développement. Le type, lui, ne se change pas —
            // la référence et les critères en découlent.
            severity: ticket.type === "BUG" ? body.severity : null,
            devNature: ticket.type === "DEV" ? body.devNature : null,
            estHours: body.estHours,
            assigneeId: body.assigneeId,
            epicId: body.epicId,
          },
        });
        return { ok: true, ref: ticket.ref };
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
