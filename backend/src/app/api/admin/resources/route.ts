import { z } from "zod";
import { adminRoute, badRequest, parseBody, parseQuery } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { visibleProjectIds } from "@/lib/project-access";
import { USER_IDENTITY } from "@/lib/user-identity";
import type { CategoryVisibility, Role } from "@prisma/client";

export const dynamic = "force-dynamic";

// Écran « Ressources projet ».
//
// Le projet et l'onglet demandés sont RÉSOLUS ici, et seules les données de
// l'onglet retenu sont chargées. C'est ce qui permet de ne faire qu'un
// aller-retour : sans cela, l'écran devrait d'abord demander la liste des
// projets et des catégories pour savoir quoi demander ensuite.

const BASE_TABS = ["api", "url", "acc", "mock", "doc"];

// Qui voit quelle catégorie libre (CC-368). La chefferie et la direction
// voient tout. Un développeur ne voit que les catégories des projets où il a
// du travail assigné (même règle que DEC-023), les communes à tous les projets
// avec elles, et jamais celles marquées « Chef de projet seul » : c'est là que
// l'équipe range ses identifiants, et la mention n'était appliquée nulle part.
// La règle vaut pour la lecture COMME pour l'écriture : une catégorie qu'on ne
// voit pas ne se modifie pas davantage par son identifiant.
type Viewer = { id: string; role: Role };

async function categoryVisible(
  user: Viewer,
  category: { projectId: string | null; visibility: CategoryVisibility },
): Promise<boolean> {
  if (user.role !== "DEV") return true;
  if (category.visibility === "PM_ONLY") return false;
  const ids = (await visibleProjectIds(user)) ?? [];
  // Une catégorie commune s'affiche sur chacun de SES projets : il lui en faut
  // au moins un.
  return category.projectId === null ? ids.length > 0 : ids.includes(category.projectId);
}

// Une catégorie hors de portée répond comme une catégorie inexistante : le
// refus ne doit pas confirmer qu'elle existe.
async function visibleCategory(user: Viewer, categoryId: string) {
  const category = await prisma.customCategory.findUnique({ where: { id: categoryId } });
  if (!category || !(await categoryVisible(user, category))) badRequest("Catégorie introuvable");
  return category;
}

// Là où l'on dépose ou déplace une catégorie, le refus s'explique : c'est le
// choix de l'utilisateur qui est en cause, pas une référence périmée.
async function checkCategoryTarget(
  user: Viewer,
  target: { projectId: string | null; visibility: CategoryVisibility },
) {
  if (user.role !== "DEV") return;
  if (target.visibility === "PM_ONLY") {
    badRequest("Une catégorie « Chef de projet seul » se crée par la chefferie ou la direction");
  }
  if (!(await categoryVisible(user, target))) {
    badRequest("Aucun ticket ne vous est assigné sur ce projet : ses catégories ne vous sont pas ouvertes");
  }
}

const querySchema = z.object({
  project: z.string().optional().describe("Identifiant du projet ; par défaut le premier non clos"),
  tab: z
    .string()
    .optional()
    .describe("Onglet : api, url, acc, mock, doc ou custom:<id de catégorie> ; par défaut api"),
});

export const GET = adminRoute(["DEV", "PM", "DIR"], async ({ user }, request) => {
  const query = parseQuery(querySchema, request);

  // Toute l'équipe interne voit les projets non clôturés.
  const projects = await prisma.project.findMany({
    where: { group: { not: "CLO" } },
    include: { client: true },
    orderBy: { name: "asc" },
  });

  const requestedProject = query.project;
  const activeProjectId =
    requestedProject && projects.some((p) => p.id === requestedProject)
      ? requestedProject
      : projects[0]?.id;

  if (!activeProjectId) {
    return {
      projects,
      activeProjectId: null,
      activeTab: "api",
      categoriesOpen: false,
      customCategories: [],
      team: [],
      panel: null,
    };
  }

  // Les catégories du projet, puis celles communes à tous les projets (DEC-081),
  // dans la limite de ce que le compte a le droit de voir (DEC-082).
  const devProjects = await visibleProjectIds(user);
  const categoriesOpen = devProjects === null || devProjects.includes(activeProjectId);
  const customCategories = categoriesOpen
    ? (
        await prisma.customCategory.findMany({
          where: {
            OR: [{ projectId: activeProjectId }, { projectId: null }],
            ...(user.role === "DEV" ? { visibility: "TEAM" as const } : {}),
          },
          include: { rows: { orderBy: { order: "asc" } } },
          orderBy: { createdAt: "asc" },
        })
      ).sort((a, b) => Number(a.projectId === null) - Number(b.projectId === null))
    : [];

  const validTabs = [...BASE_TABS, ...customCategories.map((c) => `custom:${c.id}`)];
  const requestedTab = query.tab;
  const activeTab = requestedTab && validTabs.includes(requestedTab) ? requestedTab : "api";

  const team = await prisma.user.findMany({
    where: { role: { in: ["DEV", "PM"] } },
    orderBy: { name: "asc" },
  });

  // Une seule famille de ressources est lue : celle de l'onglet ouvert.
  const projectId = activeProjectId;
  const panel = await (async () => {
    switch (activeTab) {
      case "api":
        return {
          kind: "api" as const,
          apis: await prisma.apiCredential.findMany({
            where: { projectId },
            include: { owner: USER_IDENTITY },
            orderBy: { order: "asc" },
          }),
        };
      case "url":
        return {
          kind: "url" as const,
          urls: await prisma.projectUrl.findMany({ where: { projectId }, orderBy: { order: "asc" } }),
        };
      case "acc":
        return {
          kind: "acc" as const,
          accounts: await prisma.testAccount.findMany({
            where: { projectId },
            orderBy: { order: "asc" },
          }),
        };
      case "mock": {
        const [mockups, sources] = await Promise.all([
          prisma.mockup.findMany({ where: { projectId }, orderBy: { updatedAt: "desc" } }),
          prisma.mockupSource.findMany({ where: { projectId } }),
        ]);
        return { kind: "mock" as const, mockups, sources };
      }
      case "doc": {
        const [cdc, techDocs] = await Promise.all([
          prisma.cdcDocument.findMany({ where: { projectId }, orderBy: { order: "asc" } }),
          prisma.techDoc.findMany({ where: { projectId }, orderBy: { order: "asc" } }),
        ]);
        return { kind: "doc" as const, cdc, techDocs };
      }
      default:
        // Onglet personnalisé : ses lignes sont déjà dans `customCategories`.
        return { kind: "custom" as const };
    }
  })();

  return {
    projects,
    activeProjectId,
    activeTab,
    categoriesOpen,
    customCategories,
    team: team.map((t) => ({ id: t.id, name: t.name })),
    panel,
  };
}, {
  summary:
    "Ressources d'un projet non clos, un onglet à la fois : `panel` porte les données de l'onglet retenu (api = accès techniques, url, acc = comptes, mock = maquettes, doc = cahier des charges et docs techniques, custom:<id> = catégorie libre). Renvoie aussi les projets, l'équipe et les catégories libres : celles du projet puis les communes à tous les projets (projectId null). Un développeur ne reçoit que les catégories « Équipe » des projets où un ticket lui est assigné (`categoriesOpen` faux sinon) ; la chefferie et la direction les reçoivent toutes.",
  query: querySchema,
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add-api"),
    projectId: z.string().min(1),
    name: z.string(),
    role: z.string(),
    env: z.string(),
    baseUrl: z.string(),
    maskedKey: z.string(),
    authType: z.string(),
    ownerId: z.string().nullable(),
    expiryNote: z.string(),
  }),
  z.object({
    action: z.literal("update-api"),
    apiId: z.string().min(1),
    name: z.string(),
    role: z.string(),
    env: z.string(),
    baseUrl: z.string(),
    maskedKey: z.string(),
    authType: z.string(),
    ownerId: z.string().nullable(),
    expiryNote: z.string(),
  }),
  z.object({ action: z.literal("delete-api"), apiId: z.string().min(1) }),
  z.object({
    action: z.literal("add-url"),
    projectId: z.string().min(1),
    env: z.string(),
    url: z.string(),
    access: z.string(),
    deployNote: z.string(),
  }),
  z.object({
    action: z.literal("add-account"),
    projectId: z.string().min(1),
    role: z.string(),
    login: z.string(),
    passwordMasked: z.string(),
    env: z.string(),
    note: z.string(),
  }),
  z.object({
    action: z.literal("add-mockup"),
    projectId: z.string().min(1),
    name: z.string(),
    version: z.string(),
    status: z.enum(["VALIDE", "EN_INTEGRATION", "A_VALIDER", "BROUILLON"]),
  }),
  z.object({
    action: z.literal("add-cdc-doc"),
    projectId: z.string().min(1),
    name: z.string(),
    version: z.string(),
    meta: z.string(),
    status: z.string(),
  }),
  z.object({
    action: z.literal("add-tech-doc"),
    projectId: z.string().min(1),
    name: z.string(),
    ext: z.string(),
    meta: z.string(),
    status: z.string(),
  }),
  z.object({
    action: z.literal("add-custom-category"),
    projectId: z.string().min(1).nullable().describe("null = catégorie commune à tous les projets"),
    name: z.string(),
    visibility: z.enum(["TEAM", "PM_ONLY"]).describe("PM_ONLY : chefferie et direction seules, refusé à un développeur"),
    format: z.enum(["TABLE", "FILES", "NOTES"]),
    columns: z.array(z.string()),
  }).describe("Un développeur ne crée une catégorie que sur un projet où un ticket lui est assigné"),
  z.object({
    action: z.literal("add-custom-category-row"),
    categoryId: z.string().min(1),
    // Les valeurs arrivent dans l'ordre des colonnes de la catégorie.
    values: z.array(z.string()),
  }),

  // Les sept autres types de ressources se modifiaient aussi peu que les clés
  // d'API avant CC-301 : on ne pouvait qu'ajouter. Même traitement pour tous,
  // le `projectId` restant hors du formulaire — une ressource appartient au
  // projet sur lequel on l'a déposée.
  z.object({
    action: z.literal("update-url"),
    urlId: z.string().min(1),
    env: z.string(),
    url: z.string(),
    access: z.string(),
    deployNote: z.string(),
  }),
  z.object({ action: z.literal("delete-url"), urlId: z.string().min(1) }),
  z.object({
    action: z.literal("update-account"),
    accountId: z.string().min(1),
    role: z.string(),
    login: z.string(),
    passwordMasked: z.string(),
    env: z.string(),
    note: z.string(),
  }),
  z.object({ action: z.literal("delete-account"), accountId: z.string().min(1) }),
  z.object({
    action: z.literal("update-mockup"),
    mockupId: z.string().min(1),
    name: z.string(),
    version: z.string(),
    status: z.enum(["VALIDE", "EN_INTEGRATION", "A_VALIDER", "BROUILLON"]),
  }),
  z.object({ action: z.literal("delete-mockup"), mockupId: z.string().min(1) }),
  z.object({
    action: z.literal("update-cdc-doc"),
    docId: z.string().min(1),
    name: z.string(),
    version: z.string(),
    meta: z.string(),
    status: z.string(),
  }),
  z.object({ action: z.literal("delete-cdc-doc"), docId: z.string().min(1) }),
  z.object({
    action: z.literal("update-tech-doc"),
    docId: z.string().min(1),
    name: z.string(),
    ext: z.string(),
    meta: z.string(),
    status: z.string(),
  }),
  z.object({ action: z.literal("delete-tech-doc"), docId: z.string().min(1) }),
  z.object({
    action: z.literal("update-custom-category"),
    categoryId: z.string().min(1),
    name: z.string(),
    visibility: z.enum(["TEAM", "PM_ONLY"]),
    format: z.enum(["TABLE", "FILES", "NOTES"]),
    projectId: z
      .string()
      .min(1)
      .nullable()
      .optional()
      .describe("Déplace la catégorie : un projet, null = commune à tous les projets, absent = inchangé"),
  }),
  z.object({ action: z.literal("delete-custom-category"), categoryId: z.string().min(1) }),
  z.object({
    action: z.literal("update-custom-category-row"),
    rowId: z.string().min(1),
    values: z.array(z.string()),
  }),
  z.object({ action: z.literal("delete-custom-category-row"), rowId: z.string().min(1) }),
]);

export const POST = adminRoute(["DEV", "PM", "DIR"], async ({ user }, request) => {
  const body = await parseBody(bodySchema, request);

  switch (body.action) {
    case "add-api":
      await prisma.apiCredential.create({
        data: {
          projectId: body.projectId,
          name: body.name,
          role: body.role,
          env: body.env,
          baseUrl: body.baseUrl,
          maskedKey: body.maskedKey,
          authType: body.authType,
          ownerId: body.ownerId,
          expiryNote: body.expiryNote,
        },
      });
      return;
    case "update-api":
      await prisma.apiCredential.update({
        where: { id: body.apiId },
        data: {
          name: body.name,
          role: body.role,
          env: body.env,
          baseUrl: body.baseUrl,
          maskedKey: body.maskedKey,
          authType: body.authType,
          ownerId: body.ownerId,
          expiryNote: body.expiryNote,
        },
      });
      return;
    case "delete-api":
      await prisma.apiCredential.delete({ where: { id: body.apiId } });
      return;
    case "add-url":
      await prisma.projectUrl.create({
        data: {
          projectId: body.projectId,
          env: body.env,
          url: body.url,
          access: body.access,
          deployNote: body.deployNote,
        },
      });
      return;
    case "add-account":
      await prisma.testAccount.create({
        data: {
          projectId: body.projectId,
          role: body.role,
          login: body.login,
          passwordMasked: body.passwordMasked,
          env: body.env,
          note: body.note,
        },
      });
      return;
    case "add-mockup":
      await prisma.mockup.create({
        data: {
          projectId: body.projectId,
          name: body.name,
          version: body.version,
          status: body.status,
        },
      });
      return;
    case "add-cdc-doc":
      // Déposer un cahier des charges est un acte de cadrage : direction et
      // chefferie de projet uniquement.
      if (user.role === "DEV") badRequest("Réservé à la direction et aux chefs de projet");
      await prisma.cdcDocument.create({
        data: {
          projectId: body.projectId,
          name: body.name,
          version: body.version,
          meta: body.meta,
          status: body.status,
          sections: '[]'
        },
      });
      return;
    case "add-tech-doc":
      await prisma.techDoc.create({
        data: {
          projectId: body.projectId,
          name: body.name,
          ext: body.ext,
          meta: body.meta,
          status: body.status,
        },
      });
      return;
    case "add-custom-category":
      await checkCategoryTarget(user, body);
      await prisma.customCategory.create({
        data: {
          projectId: body.projectId,
          name: body.name,
          visibility: body.visibility,
          format: body.format,
          // Une catégorie sans colonne nommée en reçoit une par défaut, sinon
          // elle serait inutilisable.
          columns: JSON.stringify(body.columns.length ? body.columns : ["Détail"]),
          authorId: user.id,
        },
      });
      return;

    case "add-custom-category-row": {
      const category = await visibleCategory(user, body.categoryId);

      // On tronque/complète aux colonnes réellement déclarées : une ligne ne
      // doit pas porter plus de valeurs que la catégorie n'a de colonnes.
      const columns: string[] = JSON.parse(category.columns);
      const values = columns.map((_, i) => body.values[i] ?? "");
      const count = await prisma.customCategoryRow.count({ where: { categoryId: body.categoryId } });
      await prisma.customCategoryRow.create({
        data: { categoryId: body.categoryId, data: JSON.stringify(values), order: count },
      });
      return;
    }

    case "update-url":
      await prisma.projectUrl.update({
        where: { id: body.urlId },
        data: { env: body.env, url: body.url, access: body.access, deployNote: body.deployNote },
      });
      return;
    case "delete-url":
      await prisma.projectUrl.delete({ where: { id: body.urlId } });
      return;

    case "update-account":
      await prisma.testAccount.update({
        where: { id: body.accountId },
        data: {
          role: body.role,
          login: body.login,
          passwordMasked: body.passwordMasked,
          env: body.env,
          note: body.note,
        },
      });
      return;
    case "delete-account":
      await prisma.testAccount.delete({ where: { id: body.accountId } });
      return;

    case "update-mockup":
      await prisma.mockup.update({
        where: { id: body.mockupId },
        data: { name: body.name, version: body.version, status: body.status },
      });
      return;
    case "delete-mockup":
      await prisma.mockup.delete({ where: { id: body.mockupId } });
      return;

    case "update-cdc-doc":
      await prisma.cdcDocument.update({
        where: { id: body.docId },
        data: { name: body.name, version: body.version, meta: body.meta, status: body.status },
      });
      return;
    case "delete-cdc-doc":
      await prisma.cdcDocument.delete({ where: { id: body.docId } });
      return;

    case "update-tech-doc":
      await prisma.techDoc.update({
        where: { id: body.docId },
        data: { name: body.name, ext: body.ext, meta: body.meta, status: body.status },
      });
      return;
    case "delete-tech-doc":
      await prisma.techDoc.delete({ where: { id: body.docId } });
      return;

    case "update-custom-category": {
      const category = await visibleCategory(user, body.categoryId);
      // Le projet de destination est vérifié comme à la création : déplacer
      // une catégorie revient à la déposer ailleurs.
      const projectId = body.projectId === undefined ? category.projectId : body.projectId;
      await checkCategoryTarget(user, { projectId, visibility: body.visibility });
      // Les colonnes ne se modifient pas ici : elles décrivent la forme des
      // lignes déjà saisies, en changer le nombre les rendrait bancales.
      await prisma.customCategory.update({
        where: { id: body.categoryId },
        data: { name: body.name, visibility: body.visibility, format: body.format, projectId },
      });
      return;
    }
    case "delete-custom-category":
      await visibleCategory(user, body.categoryId);
      await prisma.customCategory.delete({ where: { id: body.categoryId } });
      return;

    case "update-custom-category-row": {
      const row = await prisma.customCategoryRow.findUnique({
        where: { id: body.rowId },
        include: { category: true },
      });
      if (!row || !(await categoryVisible(user, row.category))) badRequest("Ligne introuvable");
      const columns: string[] = JSON.parse(row.category.columns);
      await prisma.customCategoryRow.update({
        where: { id: body.rowId },
        data: { data: JSON.stringify(columns.map((_, i) => body.values[i] ?? "")) },
      });
      return;
    }
    case "delete-custom-category-row": {
      const row = await prisma.customCategoryRow.findUnique({
        where: { id: body.rowId },
        include: { category: true },
      });
      if (!row || !(await categoryVisible(user, row.category))) badRequest("Ligne introuvable");
      await prisma.customCategoryRow.delete({ where: { id: body.rowId } });
      return;
    }
  }
}, {
  summary:
    "Ressources d'un projet : accès techniques (api), URL, comptes, maquettes, documents de cahier des charges et techniques, catégories libres et leurs lignes. Une action add-*, update-*, delete-* par famille. Une catégorie libre peut être commune à tous les projets (projectId null) ; un développeur n'agit que sur les catégories qu'il voit (voir GET).",
  body: bodySchema,
});
