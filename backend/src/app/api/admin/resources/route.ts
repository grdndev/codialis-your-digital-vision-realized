import { z } from "zod";
import { adminRoute, badRequest, jsonBody } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Écran « Ressources projet ».
//
// Le projet et l'onglet demandés sont RÉSOLUS ici, et seules les données de
// l'onglet retenu sont chargées. C'est ce qui permet de ne faire qu'un
// aller-retour : sans cela, l'écran devrait d'abord demander la liste des
// projets et des catégories pour savoir quoi demander ensuite.

const BASE_TABS = ["api", "url", "acc", "mock", "doc"];

export const GET = adminRoute(["DEV", "PM", "DIR"], async ({ user }, request) => {
  const params = request.nextUrl.searchParams;

  // Un développeur ne voit que les projets sur lesquels il est affecté ; les
  // autres rôles voient tout ce qui n'est pas clôturé.
  const projects = await prisma.project.findMany({
    where:
      user.role === "DEV"
        ? { assignments: { some: { userId: user.id } } }
        : { group: { not: "CLO" } },
    include: { client: true },
    orderBy: { name: "asc" },
  });

  const requestedProject = params.get("project");
  const activeProjectId =
    requestedProject && projects.some((p) => p.id === requestedProject)
      ? requestedProject
      : projects[0]?.id;

  if (!activeProjectId) {
    return { projects, activeProjectId: null, activeTab: "api", customCategories: [], team: [], panel: null };
  }

  const customCategories = await prisma.customCategory.findMany({
    where: { projectId: activeProjectId },
    include: { rows: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  const validTabs = [...BASE_TABS, ...customCategories.map((c) => `custom:${c.id}`)];
  const requestedTab = params.get("tab");
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
            include: { owner: true },
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
    customCategories,
    team: team.map((t) => ({ id: t.id, name: t.name })),
    panel,
  };
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
    projectId: z.string().min(1),
    name: z.string(),
    visibility: z.enum(["TEAM", "PM_ONLY"]),
    format: z.enum(["TABLE", "FILES", "NOTES"]),
    columns: z.array(z.string()),
  }),
  z.object({
    action: z.literal("add-custom-category-row"),
    categoryId: z.string().min(1),
    // Les valeurs arrivent dans l'ordre des colonnes de la catégorie.
    values: z.array(z.string()),
  }),
]);

export const POST = adminRoute(["DEV", "PM", "DIR"], async ({ user }, request) => {
  const parsed = bodySchema.safeParse(await jsonBody(request));
  if (!parsed.success) badRequest("Requête invalide");
  const body = parsed.data;

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
      const category = await prisma.customCategory.findUnique({
        where: { id: body.categoryId },
      });
      if (!category) badRequest("Catégorie introuvable");

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
  }
});
