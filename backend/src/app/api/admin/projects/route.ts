import { z } from "zod";
import { adminRoute, badRequest, parseBody } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { visibleProjectIds } from "@/lib/project-access";
import { maxSuffix, withUniqueRef } from "@/lib/refs";
import { soldHoursFor } from "@/lib/agency-rates";
import { recomputeProjectProgress } from "@/lib/project-progress";

export const dynamic = "force-dynamic";

// Écran « Projets » — liste, plus les mutations des écrans projet (liste,
// détail, fiche), regroupées ici parce qu'elles touchent le même agrégat. Le
// travail d'un projet, lui, est fait de TICKETS, dans un épic ou non : il
// s'écrit par la route Tickets (CC-365, il n'y a plus de « tâche »).

// Lecture ouverte aux développeurs, mais bornée : un développeur ne voit que
// les projets où il a un ticket assigné (voir project-access.ts).
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
}, {
  summary:
    "Écran Projets : `allProjects` (avec client) et `clients`. Un DEV ne voit que les projets où un ticket lui est assigné.",
});

// Le sigle affiché dans les pastilles du back-office. Déduit du nom plutôt que
// saisi : un champ de plus à remplir pour une valeur qu'on sait calculer.
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create-client"),
    name: z.string().min(1).max(200),
    contactName: z.string().nullable(),
    contactEmail: z.string().nullable(),
    contactPhone: z.string().nullable(),
  }).describe("Crée un client. Renvoie son `id`. Réservé à PM et DIR."),
  z.object({
    action: z.literal("create-project"),
    clientId: z.string().min(1),
    name: z.string().min(1).max(200),
    group: z.enum(["DEV", "WAR", "MAI", "CLO"]),
    phaseLabel: z.string().max(200),
    hoursSold: z.number().min(0),
    soldAmount: z.number().min(0).nullable().describe("Montant vendu en euros ; s'il est donné, les heures vendues en découlent"),
    deadlineAt: z.string().datetime().nullable(),
  }).describe("Crée un projet ; son sigle (préfixe des références de tickets) est déduit du nom. Réservé à PM et DIR."),
  z.object({
    action: z.literal("create-epic"),
    projectId: z.string().min(1),
    title: z.string().min(1),
    estHours: z.number().min(0),
    leadId: z.string().nullable(),
    dueAt: z.string().datetime().nullable(),
  }).describe("Crée un épic dans un projet."),
  z.object({
    action: z.literal("update-epic"),
    epicId: z.string().min(1),
    title: z.string().min(1).max(200),
    objective: z.string().nullable(),
    estHours: z.number().min(0),
    leadId: z.string().nullable(),
    dueAt: z.string().datetime().nullable(),
  }).describe("Modifie un épic."),
  z.object({ action: z.literal("delete-epic"), epicId: z.string().min(1) }).describe(
    "Supprime un épic ; ses tickets restent au projet, hors épic.",
  ),
  // Import JSON — poser d'un coup les épics et les tickets d'un projet. Le contenu est validé par `importSchema` plus bas : ici on ne
  // reçoit que le texte brut, pour pouvoir répondre une erreur lisible plutôt
  // qu'un « requête invalide » qui ne dit pas où ça coince.
  z.object({
    action: z.literal("import-json"),
    projectId: z.string().min(1),
    payload: z
      .string()
      .min(1)
      .max(500_000)
      .describe(
        "Le JSON, en TEXTE : { epics?: [{ title, objective?, estHours?, tasks?: [{ title, description?, estHours? }] }], tickets?: [{ type: BUG|DEV, title, description?, steps?, severity?, devNature?, estHours?, epic?: titre d'un épic }] }",
      ),
    // À qui confier d'emblée les tickets créés (CC-354), y compris ceux qui
    // arrivent sous `epics[].tasks`. `null` : personne, ils attendent d'être
    // distribués — c'était le seul comportement possible.
    ticketAssigneeId: z.string().min(1).nullable().default(null),
  }).describe("Pose d'un coup les épics et tickets d'un projet. Réservé à PM et DIR."),
  z.object({
    action: z.literal("update-client-contact"),
    clientId: z.string().min(1),
    contactName: z.string().nullable(),
    contactEmail: z.string().nullable(),
    contactPhone: z.string().nullable(),
  }).describe("Contact d'un client."),
  // Tout ce qui décrit un projet se corrige : une phase avance, une échéance
  // se décale, un chiffrage se révise. Restent dehors `initials` (préfixe des
  // références de tickets, deux préfixes sur un même projet n'auraient pas de
  // sens) et les colonnes calculées — avancement et heures passées reflètent
  // les tickets et les saisies de temps, ce ne sont pas des saisies.
  z.object({
    action: z.literal("update-project"),
    projectId: z.string().min(1),
    clientId: z.string().min(1),
    name: z.string().min(1).max(200),
    group: z.enum(["DEV", "WAR", "MAI", "CLO"]),
    phaseLabel: z.string().max(200),
    description: z.string(),
    hoursSold: z.number().min(0),
    soldAmount: z.number().min(0).nullable(),
    costAmount: z.number().min(0).nullable(),
    deadlineAt: z.string().datetime().nullable(),
    deadlineNote: z.string().max(200).nullable(),
    openedAt: z.string().datetime(),
  }).describe("Modifie la fiche complète d'un projet. Réservé à PM et DIR."),
  // La phase se change seule, depuis l'en-tête du projet : c'est le geste le
  // plus courant de la chefferie, et il n'a pas à passer par le formulaire
  // complet, où il était replié dans l'onglet Fiche.
  z.object({
    action: z.literal("update-project-phase"),
    projectId: z.string().min(1),
    group: z.enum(["DEV", "WAR", "MAI", "CLO"]),
    phaseLabel: z.string().max(200),
  }).describe("Change la phase d'un projet (DEV développement, WAR garantie, MAI maintenance, CLO clos). Réservé à PM et DIR."),
  // Garantie et maintenance (CC-351) : le dernier jour couvert de chacune,
  // indépendamment de la phase. `null` retire la couverture.
  z.object({
    action: z.literal("update-project-coverage"),
    projectId: z.string().min(1),
    warrantyEndsAt: z.string().datetime().nullable().describe("Dernier jour couvert (minuit UTC) ; null = aucune"),
    maintenanceEndsAt: z.string().datetime().nullable().describe("Dernier jour couvert (minuit UTC) ; null = aucune"),
  }).describe("Fin de garantie et fin de maintenance d'un projet. Réservé à PM et DIR."),
  z.object({
    action: z.literal("update-client"),
    clientId: z.string().min(1),
    name: z.string().min(1).max(200),
  }).describe("Renomme un client. Réservé à PM et DIR."),
  z.object({
    action: z.literal("update-project-description"),
    projectId: z.string().min(1),
    description: z.string(),
  }).describe("Description d'un projet."),
  z.object({
    action: z.literal("add-client-question"),
    projectId: z.string().min(1),
    question: z.string().min(1),
  }).describe("Ajoute une question à poser au client."),
  z.object({ action: z.literal("mark-question-asked"), questionId: z.string().min(1) }).describe(
    "Marque une question comme posée au client.",
  ),
  z.object({
    action: z.literal("answer-client-question"),
    questionId: z.string().min(1),
    answer: z.string().min(1),
  }).describe("Enregistre la réponse du client."),
  // Le portail client a un fil « Échanges » (CC-374) : l'agence y répond depuis
  // la fiche projet, au nom de la personne connectée.
  z.object({
    action: z.literal("reply-client-message"),
    projectId: z.string().min(1),
    body: z.string().trim().min(1).max(10_000),
  }).describe("Répond au client dans le fil « Échanges » de son portail, au nom de l'appelant. Réservé à PM et DIR."),
]);

export const POST = adminRoute(["DEV", "PM", "DIR"], async ({ user }, request) => {
  const body = await parseBody(bodySchema, request);

  // Ouvrir un client ou un projet engage la structure du suivi : c'est à la
  // direction et à la chefferie de projet, pas au développement. Le contrôle est
  // ici et non sur la route, qui sert aussi aux écrans ouverts aux DEV.
  if (
    body.action === "create-client" ||
    body.action === "create-project" ||
    body.action === "update-project" ||
    body.action === "update-project-phase" ||
    // Ce qui est couvert après livraison relève du contrat avec le client.
    body.action === "update-project-coverage" ||
    body.action === "update-client" ||
    // Poser d'un coup les lots et les tickets d'un projet, c'est en dessiner la
    // structure : même main que la création.
    body.action === "import-json" ||
    // Parler au client au nom de l'agence relève de la chefferie, seule
    // interlocutrice annoncée par le portail.
    body.action === "reply-client-message"
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
          // Un montant vendu donne les heures vendues au taux de l'agence
          // (CC-357) ; sans montant, ce sont les heures saisies.
          hoursSold: await soldHoursFor(body.soldAmount, null, body.hoursSold),
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

    case "delete-epic":
      // Ses tickets ne tombent pas avec lui : la base les détache (SET NULL),
      // ils restent au projet, hors épic. Rien du travail ne se perd.
      await prisma.epic.delete({ where: { id: body.epicId } });
      return;

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

      // Vérifié AVANT d'écrire quoi que ce soit : un assigné refusé à mi-course
      // laisserait un import à moitié fait. Seule l'équipe interne porte des
      // tickets, un compte client n'en reçoit pas.
      if (body.ticketAssigneeId) {
        const assignee = await prisma.user.findUnique({
          where: { id: body.ticketAssigneeId },
          select: { role: true },
        });
        if (!assignee || assignee.role === "CLIENT") badRequest("Personne à assigner introuvable");
      }

      // Les lots déjà présents sont réutilisés, pas dupliqués : réimporter un
      // fichier corrigé ne doit pas créer un deuxième « Lot 1 ».
      const existingEpics = await prisma.epic.findMany({
        where: { projectId: project.id },
        select: { id: true, title: true },
      });
      const epicByTitle = new Map(existingEpics.map((e) => [e.title.toLowerCase(), e.id]));
      let order = existingEpics.length;
      let createdEpics = 0;

      // `epics[].tasks` et `tickets` donnent la même chose, un ticket : les
      // fichiers rédigés quand les épics portaient des « tâches » s'importent
      // toujours (CC-365).
      const prefix = `${project.initials}-`;
      let createdTickets = 0;
      const createTicket = async (data: {
        epicId: string | null;
        type: "BUG" | "DEV";
        severity?: "BLOQUANT" | "MAJEUR" | "MINEUR";
        devNature?: "FRONT" | "BACK" | "API" | "DESIGN";
        title: string;
        description?: string;
        steps?: string;
        estHours?: number;
      }) => {
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
                epicId: data.epicId,
                type: data.type,
                // La gravité ne concerne qu'un bug, la nature qu'un développement.
                severity: data.type === "BUG" ? (data.severity ?? "MINEUR") : null,
                devNature: data.type === "DEV" ? (data.devNature ?? null) : null,
                title: data.title,
                description: data.description ?? "",
                steps: data.steps ?? "",
                estHours: data.estHours ?? 0,
                assigneeId: body.ticketAssigneeId,
                creatorId: user.id,
              },
            }),
        );
        createdTickets++;
      };

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
        for (const task of epic.tasks) {
          await createTicket({ epicId, type: "DEV", ...task });
        }
      }

      for (const ticket of tickets) {
        const epicId = ticket.epic ? (epicByTitle.get(ticket.epic.toLowerCase()) ?? null) : null;
        await createTicket({ ...ticket, epicId });
      }

      await recomputeProjectProgress(project.id);
      return { ok: true, createdEpics, createdTickets };
    }

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
      const current = await prisma.project.findUnique({
        where: { id: body.projectId },
        select: { soldAmount: true, hoursSold: true },
      });
      if (!current) badRequest("Projet introuvable");

      await prisma.project.update({
        where: { id: body.projectId },
        data: {
          clientId: body.clientId,
          name: body.name.trim(),
          group: body.group,
          phaseLabel: body.phaseLabel.trim(),
          description: body.description,
          // Recalculées si le montant change, gardées sinon (CC-357).
          hoursSold: await soldHoursFor(body.soldAmount, current, body.hoursSold),
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

    case "update-project-coverage": {
      await prisma.project.update({
        where: { id: body.projectId },
        data: {
          warrantyEndsAt: body.warrantyEndsAt ? new Date(body.warrantyEndsAt) : null,
          maintenanceEndsAt: body.maintenanceEndsAt ? new Date(body.maintenanceEndsAt) : null,
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

    case "reply-client-message": {
      const project = await prisma.project.findUnique({ where: { id: body.projectId }, select: { id: true } });
      if (!project) badRequest("Projet introuvable");
      await prisma.clientThreadMessage.create({
        data: { projectId: project.id, fromClient: false, authorLabel: user.name, body: body.body },
      });
      return;
    }
  }
}, {
  summary:
    "Clients, projets, épics, import JSON, questions au client et réponses au fil « Échanges » du portail. Création et modification d'un client ou d'un projet, phase, couverture, import JSON et réponse au client sont réservés à PM et DIR ; le travail d'un projet (tickets) s'écrit par /api/admin/tickets.",
  body: bodySchema,
});

// Forme attendue du JSON d'import. Tout est facultatif sauf les titres : un
// fichier rédigé à la main ne doit pas être refusé pour une estimation absente.
// `epics[].tasks` reste accepté pour les fichiers déjà rédigés : chaque entrée
// devient un ticket « Développement » de l'épic.
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
