import { z } from "zod";
import { adminRoute, badRequest, jsonBody } from "@/lib/admin-api";
import { reprendreFichiersJoints } from "@/lib/files";
import { prisma } from "@/lib/prisma";
import { visibleProjectIds } from "@/lib/project-access";
import { closeSessions, openSession, refreshProjectSpent } from "@/lib/work-sessions";
import { maxSuffix, withUniqueRef } from "@/lib/refs";
import type { TaskStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

// Écran « Projets » — liste, plus toutes les mutations des écrans projet
// (liste, détail, fiche, détail de tâche), regroupées ici parce qu'elles
// touchent le même agrégat.

// Lecture ouverte aux développeurs, mais bornée : un développeur ne voit que
// les projets où il a une tâche ou un ticket assigné (voir project-access.ts).
// Le tri des projets se fait donc ici et non à l'affichage — la requête ne doit
// jamais rapporter les autres. La création d'un client ou d'un projet reste à la
// direction et à la chefferie, contrôlée plus bas dans le POST.
export const GET = adminRoute(["DEV", "PM", "DIR"], async ({ user }) => {
  // `null` = rôle non cloisonné (chefferie, direction) : aucun filtre. Une
  // liste vide, elle, est un développeur sans travail assigné, donc sans projet.
  const ids = await visibleProjectIds(user);
  const scope = ids === null ? {} : { id: { in: ids } };
  const [allProjects, clients] = await Promise.all([
    prisma.project.findMany({
      where: scope,
      include: { client: true },
      orderBy: [{ openedAt: "desc" }],
    }),
    // Le formulaire « nouveau projet » doit pouvoir rattacher à un client
    // existant : un projet sans client n'a pas de place dans le modèle. La
    // liste suit le même périmètre que les projets, sinon l'écran annoncerait
    // à un développeur plus de clients que de projets visibles. Hors
    // cloisonnement, elle reste ENTIÈRE : un client tout juste créé n'a pas
    // encore de projet, et c'est précisément pour lui en ouvrir un qu'on le
    // cherche dans cette liste.
    prisma.client.findMany({
      where: ids === null ? {} : { projects: { some: scope } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return { allProjects, clients };
});

// Le sigle affiché dans les pastilles du back-office. Déduit du nom plutôt que
// saisi : un champ de plus à remplir pour une valeur qu'on sait calculer.
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const NEXT_STATUS: Record<TaskStatus, TaskStatus | null> = {
  A_FAIRE: "EN_COURS",
  EN_COURS: "EN_REVUE",
  EN_REVUE: "TERMINE",
  TERMINE: null,
};

// `Project.progressPct` est une colonne stockée, relue directement par le
// dashboard, la liste des projets et le portail client — pas un calcul fait à
// chaque lecture. Il faut donc la rafraîchir dès qu'une tâche apparaît ou change
// d'état. Un projet sans tâche modélisée garde sa valeur : une liste vide n'est
// pas la preuve d'un avancement nul, seulement de ce qui n'est pas suivi à ce
// niveau de détail.
async function recomputeProjectProgress(projectId: string) {
  const tasks = await prisma.task.findMany({
    where: { epic: { projectId } },
    select: { status: true },
  });
  if (tasks.length === 0) return;
  const done = tasks.filter((t) => t.status === "TERMINE").length;
  await prisma.project.update({
    where: { id: projectId },
    data: { progressPct: Math.round((done / tasks.length) * 100) },
  });
}

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create-client"),
    name: z.string().min(1).max(200),
    contactName: z.string().nullable(),
    contactEmail: z.string().nullable(),
    contactPhone: z.string().nullable(),
  }),
  z.object({
    action: z.literal("create-project"),
    clientId: z.string().min(1),
    name: z.string().min(1).max(200),
    group: z.enum(["DEV", "FIN", "WAR", "MAI", "CLO"]),
    phaseLabel: z.string().max(200),
    hoursSold: z.number().min(0),
    soldAmount: z.number().min(0).nullable(),
    deadlineAt: z.string().datetime().nullable(),
  }),
  z.object({
    action: z.literal("create-epic"),
    projectId: z.string().min(1),
    title: z.string().min(1),
    estHours: z.number().min(0),
    leadId: z.string().nullable(),
    dueAt: z.string().datetime().nullable(),
  }),
  z.object({
    action: z.literal("create-task"),
    epicId: z.string().min(1),
    projectId: z.string().min(1),
    title: z.string().min(1),
    estHours: z.number().min(0),
    assigneeId: z.string().nullable(),
  }),
  z.object({
    action: z.literal("update-epic"),
    epicId: z.string().min(1),
    title: z.string().min(1).max(200),
    objective: z.string().nullable(),
    estHours: z.number().min(0),
    leadId: z.string().nullable(),
    dueAt: z.string().datetime().nullable(),
  }),
  z.object({ action: z.literal("delete-epic"), epicId: z.string().min(1) }),
  z.object({
    action: z.literal("update-task"),
    taskId: z.string().min(1),
    projectId: z.string().min(1),
    epicId: z.string().min(1),
    title: z.string().min(1).max(300),
    description: z.string(),
    estHours: z.number().min(0),
    assigneeId: z.string().nullable(),
    dueAt: z.string().datetime().nullable(),
  }),
  z.object({
    action: z.literal("delete-task"),
    taskId: z.string().min(1),
    projectId: z.string().min(1),
  }),
  // `transition` fait avancer d'un cran, `status` vise une colonne précise —
  // y compris en arrière : on doit pouvoir arrêter une tâche sans être forcé
  // de la déclarer livrée.
  z.object({
    action: z.literal("update-task-status"),
    taskId: z.string().min(1),
    projectId: z.string().min(1),
    transition: z.enum(["advance", "reopen"]).optional(),
    status: z.enum(["A_FAIRE", "EN_COURS", "EN_REVUE", "TERMINE"]).optional(),
  }),
  // Import JSON — poser d'un coup les lots, les tâches et les tickets d'un
  // projet. Le contenu est validé par `importSchema` plus bas : ici on ne
  // reçoit que le texte brut, pour pouvoir répondre une erreur lisible plutôt
  // qu'un « requête invalide » qui ne dit pas où ça coince.
  z.object({
    action: z.literal("import-json"),
    projectId: z.string().min(1),
    payload: z.string().min(1).max(500_000),
  }),
  z.object({ action: z.literal("toggle-task-criterion"), criterionId: z.string().min(1) }),
  z.object({
    action: z.literal("add-task-criterion"),
    taskId: z.string().min(1),
    label: z.string().min(1).max(300),
  }),
  z.object({
    action: z.literal("update-task-criterion"),
    criterionId: z.string().min(1),
    label: z.string().min(1).max(300),
  }),
  z.object({ action: z.literal("delete-task-criterion"), criterionId: z.string().min(1) }),
  z.object({
    action: z.literal("add-task-comment"),
    taskId: z.string().min(1),
    body: z.string().min(1),
  }),
  z.object({
    action: z.literal("update-client-contact"),
    clientId: z.string().min(1),
    contactName: z.string().nullable(),
    contactEmail: z.string().nullable(),
    contactPhone: z.string().nullable(),
  }),
  // Tout ce qui décrit un projet se corrige : une phase avance, une échéance
  // se décale, un chiffrage se révise. Restent dehors `initials` (préfixe des
  // références de tickets, deux préfixes sur un même projet n'auraient pas de
  // sens) et les colonnes calculées — avancement et heures passées reflètent
  // les tâches et les saisies de temps, ce ne sont pas des saisies.
  z.object({
    action: z.literal("update-project"),
    projectId: z.string().min(1),
    clientId: z.string().min(1),
    name: z.string().min(1).max(200),
    group: z.enum(["DEV", "FIN", "WAR", "MAI", "CLO"]),
    phaseLabel: z.string().max(200),
    description: z.string(),
    hoursSold: z.number().min(0),
    soldAmount: z.number().min(0).nullable(),
    costAmount: z.number().min(0).nullable(),
    deadlineAt: z.string().datetime().nullable(),
    deadlineNote: z.string().max(200).nullable(),
    openedAt: z.string().datetime(),
  }),
  // La phase se change seule, depuis l'en-tête du projet : c'est le geste le
  // plus courant de la chefferie, et il n'a pas à passer par le formulaire
  // complet, où il était replié dans l'onglet Fiche.
  z.object({
    action: z.literal("update-project-phase"),
    projectId: z.string().min(1),
    group: z.enum(["DEV", "FIN", "WAR", "MAI", "CLO"]),
    phaseLabel: z.string().max(200),
  }),
  z.object({
    action: z.literal("update-client"),
    clientId: z.string().min(1),
    name: z.string().min(1).max(200),
  }),
  z.object({
    action: z.literal("update-project-description"),
    projectId: z.string().min(1),
    description: z.string(),
  }),
  z.object({
    action: z.literal("add-client-question"),
    projectId: z.string().min(1),
    question: z.string().min(1),
  }),
  z.object({ action: z.literal("mark-question-asked"), questionId: z.string().min(1) }),
  z.object({
    action: z.literal("answer-client-question"),
    questionId: z.string().min(1),
    answer: z.string().min(1),
  }),
]);

export const POST = adminRoute(["DEV", "PM", "DIR"], async ({ user }, request) => {
  const parsed = bodySchema.safeParse(await jsonBody(request));
  if (!parsed.success) badRequest("Requête invalide");
  const body = parsed.data;

  // Ouvrir un client ou un projet engage la structure du suivi : c'est à la
  // direction et à la chefferie de projet, pas au développement. Le contrôle est
  // ici et non sur la route, qui sert aussi aux écrans ouverts aux DEV.
  if (
    body.action === "create-client" ||
    body.action === "create-project" ||
    body.action === "update-project" ||
    body.action === "update-project-phase" ||
    body.action === "update-client" ||
    // Poser d'un coup les lots et les tickets d'un projet, c'est en dessiner la
    // structure : même main que la création.
    body.action === "import-json"
  ) {
    if (user.role !== "DIR" && user.role !== "PM") {
      badRequest("Réservé à la direction et à la chefferie de projet");
    }
  }

  switch (body.action) {
    case "create-client": {
      const name = body.name.trim();
      // `Client.name` est unique : sans ce contrôle, le doublon remonterait en
      // erreur Prisma, donc en 500 illisible.
      const duplicate = await prisma.client.findUnique({ where: { name }, select: { id: true } });
      if (duplicate) badRequest("Ce client existe déjà");

      const client = await prisma.client.create({
        data: {
          name,
          contactName: body.contactName,
          contactEmail: body.contactEmail,
          contactPhone: body.contactPhone,
        },
        select: { id: true },
      });
      return { ok: true, id: client.id };
    }

    case "create-project": {
      const client = await prisma.client.findUnique({
        where: { id: body.clientId },
        select: { id: true },
      });
      if (!client) badRequest("Client introuvable");

      const name = body.name.trim();
      const project = await prisma.project.create({
        data: {
          clientId: body.clientId,
          name,
          initials: initialsOf(name),
          group: body.group,
          // Sans libellé saisi, l'affichage retombe déjà sur le libellé du
          // groupe (voir GROUP_LABEL côté front) : inutile d'en inventer un.
          phaseLabel: body.phaseLabel.trim(),
          description: "",
          hoursSold: body.hoursSold,
          hoursSpent: 0,
          progressPct: 0,
          openedAt: new Date(),
          deadlineAt: body.deadlineAt ? new Date(body.deadlineAt) : null,
          soldAmount: body.soldAmount,
        },
        select: { id: true },
      });
      return { ok: true, id: project.id };
    }

    case "create-epic": {
      const count = await prisma.epic.count({ where: { projectId: body.projectId } });
      await prisma.epic.create({
        data: {
          projectId: body.projectId,
          title: body.title,
          estHours: body.estHours,
          leadId: body.leadId,
          dueAt: body.dueAt ? new Date(body.dueAt) : null,
          order: count,
        },
      });
      return;
    }

    case "create-task": {
      const count = await prisma.task.count({ where: { epicId: body.epicId } });
      await prisma.task.create({
        data: {
          epicId: body.epicId,
          title: body.title,
          estHours: body.estHours,
          assigneeId: body.assigneeId,
          order: count,
          description: ""
        },
      });
      await recomputeProjectProgress(body.projectId);
      return;
    }

    case "update-epic": {
      await prisma.epic.update({
        where: { id: body.epicId },
        data: {
          title: body.title.trim(),
          objective: body.objective?.trim() || null,
          estHours: body.estHours,
          leadId: body.leadId,
          dueAt: body.dueAt ? new Date(body.dueAt) : null,
        },
      });
      return;
    }

    case "delete-epic": {
      // Les tâches du lot tombent avec lui (cascade au schéma) : supprimer un
      // lot rempli n'est pas un geste anodin, on le refuse plutôt que de
      // l'exécuter silencieusement.
      const tasks = await prisma.task.count({ where: { epicId: body.epicId } });
      if (tasks > 0) badRequest(`Ce lot porte ${tasks} tâche(s) : videz-le d'abord`);
      await prisma.epic.delete({ where: { id: body.epicId } });
      return;
    }

    case "update-task": {
      const before = await prisma.task.findUnique({
        where: { id: body.taskId },
        select: { status: true, assigneeId: true },
      });
      if (!before) badRequest("Tâche introuvable");

      // Passer la main pendant que le chronomètre tourne l'arrête pour le
      // précédent assigné : les heures déjà comptées lui restent, et la tâche
      // revient à « À faire » pour que le suivant la démarre lui-même.
      const handover = before.status === "EN_COURS" && before.assigneeId !== body.assigneeId;

      await prisma.$transaction(async (tx) => {
        if (handover) await closeSessions(tx, { taskId: body.taskId });
        await tx.task.update({
          where: { id: body.taskId },
          data: {
            epicId: body.epicId,
            title: body.title.trim(),
            description: body.description,
            estHours: body.estHours,
            assigneeId: body.assigneeId,
            dueAt: body.dueAt ? new Date(body.dueAt) : null,
            ...(handover ? { status: "A_FAIRE" as TaskStatus } : {}),
          },
        });
      });
      await recomputeProjectProgress(body.projectId);
      return handover
        ? {
            ok: true,
            notice:
              "Le temps en cours a été arrêté pour l'assigné précédent, la tâche est repassée à « À faire ».",
          }
        : undefined;
    }

    case "delete-task": {
      const pieces = await prisma.taskAttachment.findMany({
        where: { taskId: body.taskId },
        select: { fileId: true },
      });
      await prisma.task.delete({ where: { id: body.taskId } });
      await reprendreFichiersJoints(pieces.map((p) => p.fileId));
      await recomputeProjectProgress(body.projectId);
      await prisma.$transaction((tx) => refreshProjectSpent(tx, body.projectId));
      return;
    }

    case "update-task-status": {
      const task = await prisma.task.findUnique({ where: { id: body.taskId } });
      if (!task) badRequest("Tâche introuvable");

      const nextStatus: TaskStatus | null =
        body.status ?? (body.transition === "reopen" ? "A_FAIRE" : NEXT_STATUS[task.status]);
      // Une tâche déjà terminée n'a pas d'étape suivante.
      if (!nextStatus || nextStatus === task.status) return;

      // « En cours » lance le chronomètre, tout autre statut l'arrête : le
      // temps se mesure, il ne se déclare pas.
      let notice: string | undefined;
      await prisma.$transaction(async (tx) => {
        await tx.task.update({ where: { id: body.taskId }, data: { status: nextStatus } });
        if (nextStatus !== "EN_COURS") {
          await closeSessions(tx, { taskId: task.id });
          return;
        }
        const started = await openSession(tx, { taskId: task.id }, task.assigneeId, user.id);
        if (!started) notice = "Aucun assigné : le temps ne sera décompté pour personne.";
        else if (task.assigneeId !== user.id)
          notice = "Le temps sera décompté pour l'utilisateur assigné.";
      });
      await recomputeProjectProgress(body.projectId);
      return notice ? { ok: true, notice } : undefined;
    }

    case "import-json": {
      const project = await prisma.project.findUnique({ where: { id: body.projectId } });
      if (!project) badRequest("Projet introuvable");

      let parsedPayload: unknown;
      try {
        parsedPayload = JSON.parse(body.payload);
      } catch {
        badRequest("JSON illisible : vérifiez les virgules et les guillemets.");
      }

      const content = importSchema.safeParse(parsedPayload);
      if (!content.success) {
        const first = content.error.issues[0];
        badRequest(`JSON refusé — ${first.path.join(".") || "racine"} : ${first.message}`);
      }
      const { epics, tickets } = content.data;
      if (!epics.length && !tickets.length) badRequest("Rien à importer.");

      // Les lots déjà présents sont réutilisés, pas dupliqués : réimporter un
      // fichier corrigé ne doit pas créer un deuxième « Lot 1 ».
      const existingEpics = await prisma.epic.findMany({
        where: { projectId: project.id },
        select: { id: true, title: true },
      });
      const epicByTitle = new Map(existingEpics.map((e) => [e.title.toLowerCase(), e.id]));
      let order = existingEpics.length;
      let createdEpics = 0;
      let createdTasks = 0;

      for (const epic of epics) {
        let epicId = epicByTitle.get(epic.title.toLowerCase());
        if (!epicId) {
          const created = await prisma.epic.create({
            data: {
              projectId: project.id,
              title: epic.title,
              objective: epic.objective ?? null,
              estHours: epic.estHours ?? 0,
              order: order++,
            },
          });
          epicId = created.id;
          epicByTitle.set(epic.title.toLowerCase(), epicId);
          createdEpics++;
        }
        let taskOrder = await prisma.task.count({ where: { epicId } });
        for (const task of epic.tasks) {
          await prisma.task.create({
            data: {
              epicId,
              title: task.title,
              description: task.description ?? "",
              estHours: task.estHours ?? 0,
              order: taskOrder++,
            },
          });
          createdTasks++;
        }
      }

      const prefix = `${project.initials}-`;
      let createdTickets = 0;
      for (const ticket of tickets) {
        const epicId = ticket.epic ? (epicByTitle.get(ticket.epic.toLowerCase()) ?? null) : null;
        await withUniqueRef(
          async () => {
            const refs = await prisma.ticket.findMany({
              where: { ref: { startsWith: prefix } },
              select: { ref: true },
            });
            return `${prefix}${(maxSuffix(refs.map((r) => r.ref), prefix) ?? 300) + 1}`;
          },
          (ref) =>
            prisma.ticket.create({
              data: {
                ref,
                projectId: project.id,
                epicId,
                type: ticket.type,
                // La gravité ne concerne qu'un bug, la nature qu'un développement.
                severity: ticket.type === "BUG" ? (ticket.severity ?? "MINEUR") : null,
                devNature: ticket.type === "DEV" ? (ticket.devNature ?? null) : null,
                title: ticket.title,
                description: ticket.description ?? "",
                steps: ticket.steps ?? "",
                estHours: ticket.estHours ?? 0,
                creatorId: user.id,
              },
            }),
        );
        createdTickets++;
      }

      await recomputeProjectProgress(project.id);
      return { ok: true, createdEpics, createdTasks, createdTickets };
    }

    case "toggle-task-criterion": {
      const criterion = await prisma.taskCriterion.findUnique({
        where: { id: body.criterionId },
      });
      if (!criterion) badRequest("Critère introuvable");
      await prisma.taskCriterion.update({
        where: { id: body.criterionId },
        data: { done: !criterion.done },
      });
      return;
    }

    case "add-task-criterion": {
      const count = await prisma.taskCriterion.count({ where: { taskId: body.taskId } });
      await prisma.taskCriterion.create({
        data: { taskId: body.taskId, label: body.label.trim(), order: count },
      });
      return;
    }

    case "update-task-criterion":
      await prisma.taskCriterion.update({
        where: { id: body.criterionId },
        data: { label: body.label.trim() },
      });
      return;

    case "delete-task-criterion":
      await prisma.taskCriterion.delete({ where: { id: body.criterionId } });
      return;

    case "add-task-comment":
      // L'auteur est la session.
      await prisma.taskComment.create({
        data: { taskId: body.taskId, authorId: user.id, body: body.body },
      });
      return;

    case "update-client-contact":
      await prisma.client.update({
        where: { id: body.clientId },
        data: {
          contactName: body.contactName,
          contactEmail: body.contactEmail,
          contactPhone: body.contactPhone,
        },
      });
      return;

    case "update-project": {
      const client = await prisma.client.findUnique({
        where: { id: body.clientId },
        select: { id: true },
      });
      if (!client) badRequest("Client introuvable");

      await prisma.project.update({
        where: { id: body.projectId },
        data: {
          clientId: body.clientId,
          name: body.name.trim(),
          group: body.group,
          phaseLabel: body.phaseLabel.trim(),
          description: body.description,
          hoursSold: body.hoursSold,
          soldAmount: body.soldAmount,
          costAmount: body.costAmount,
          deadlineAt: body.deadlineAt ? new Date(body.deadlineAt) : null,
          deadlineNote: body.deadlineNote?.trim() || null,
          openedAt: new Date(body.openedAt),
          // Clôturer horodate la clôture ; rouvrir l'efface. La date suit la
          // phase plutôt que d'être saisie à part, où elle pourrait la démentir.
          closedAt: body.group === "CLO" ? new Date() : null,
        },
      });
      return;
    }

    case "update-project-phase": {
      // On relit la clôture : repasser un projet clôturé en « Clôturé » ne doit
      // pas décaler sa date de clôture à aujourd'hui.
      const current = await prisma.project.findUnique({
        where: { id: body.projectId },
        select: { closedAt: true },
      });
      if (!current) badRequest("Projet introuvable");
      await prisma.project.update({
        where: { id: body.projectId },
        data: {
          group: body.group,
          phaseLabel: body.phaseLabel.trim(),
          closedAt: body.group === "CLO" ? (current.closedAt ?? new Date()) : null,
        },
      });
      return;
    }

    case "update-client": {
      const name = body.name.trim();
      const duplicate = await prisma.client.findFirst({
        where: { name, id: { not: body.clientId } },
        select: { id: true },
      });
      if (duplicate) badRequest("Un autre client porte déjà ce nom");
      await prisma.client.update({ where: { id: body.clientId }, data: { name } });
      return;
    }

    case "update-project-description":
      await prisma.project.update({
        where: { id: body.projectId },
        data: { description: body.description },
      });
      return;

    case "add-client-question":
      await prisma.clientQuestion.create({
        data: { projectId: body.projectId, question: body.question, answer: "" },
      });
      return;

    case "mark-question-asked":
      await prisma.clientQuestion.update({
        where: { id: body.questionId },
        data: { status: "DEMANDE", askedAt: new Date() },
      });
      return;

    case "answer-client-question":
      await prisma.clientQuestion.update({
        where: { id: body.questionId },
        data: { status: "REPONDU", answer: body.answer, answeredAt: new Date() },
      });
      return;
  }
});

// Forme attendue du JSON d'import. Tout est facultatif sauf les titres : un
// fichier rédigé à la main ne doit pas être refusé pour une estimation absente.
const importSchema = z.object({
  epics: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        objective: z.string().max(2000).optional(),
        estHours: z.number().min(0).optional(),
        tasks: z
          .array(
            z.object({
              title: z.string().min(1).max(300),
              description: z.string().max(5000).optional(),
              estHours: z.number().min(0).optional(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
  tickets: z
    .array(
      z.object({
        type: z.enum(["BUG", "DEV"]),
        title: z.string().min(1).max(300),
        description: z.string().max(5000).optional(),
        steps: z.string().max(5000).optional(),
        severity: z.enum(["BLOQUANT", "MAJEUR", "MINEUR"]).optional(),
        devNature: z.enum(["FRONT", "BACK", "API", "DESIGN"]).optional(),
        estHours: z.number().min(0).optional(),
        // Rattachement au lot par son TITRE : un identifiant technique ne se
        // rédige pas à la main.
        epic: z.string().max(200).optional(),
      }),
    )
    .default([]),
});
