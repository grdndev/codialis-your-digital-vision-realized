import { z } from "zod";
import { adminRoute, parseQuery } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { clientProjectId, portalEpics, portalProjectParam } from "@/lib/client-scope";

export const dynamic = "force-dynamic";

// Portail client — écran « Mon projet ».
//
// Comme sur l'écran Ressources, seul l'onglet demandé est chargé : les deux
// volets (fonctionnalités, cahier des charges) n'ont rien en commun. L'onglet
// « Devis » est retiré (CC-374) : aucun écran de l'agence ne remplit les devis,
// il ne montrait donc jamais rien.

const querySchema = z.object({
  tab: z.enum(["features", "cdc"]).default("features"),
  project: portalProjectParam,
});

export const GET = adminRoute(["CLIENT"], async ({ user }, request) => {
  const { tab, project } = parseQuery(querySchema, request, "Onglet inconnu");

  const projectId = await clientProjectId(user, project);
  if (!projectId) return { tab, epics: [], docs: [] };

  if (tab === "features") {
    return { tab, epics: await portalEpics(projectId), docs: [] };
  }

  return {
    tab,
    epics: [],
    docs: await prisma.cdcDocument.findMany({ where: { projectId }, orderBy: { order: "asc" } }),
  };
}, { summary: "Portail client (compte CLIENT, session seulement : un compte client n'a pas de jeton d'API). Mon projet, un onglet à la fois : fonctionnalités ou cahier des charges.", query: querySchema });
