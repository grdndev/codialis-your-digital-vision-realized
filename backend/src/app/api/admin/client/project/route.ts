import { z } from "zod";
import { adminRoute, parseQuery } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { clientProjectId, portalEpics } from "@/lib/client-scope";

export const dynamic = "force-dynamic";

// Portail client — écran « Mon projet ».
//
// Comme sur l'écran Ressources, seul l'onglet demandé est chargé : les trois
// volets (devis, fonctionnalités, cahier des charges) n'ont rien en commun.

const querySchema = z.object({ tab: z.enum(["devis", "features", "cdc"]).default("devis") });

export const GET = adminRoute(["CLIENT"], async ({ user }, request) => {
  const { tab } = parseQuery(querySchema, request, "Onglet inconnu");

  const projectId = await clientProjectId(user.id);
  if (!projectId) return { tab, quote: null, epics: [], docs: [] };

  if (tab === "devis") {
    return {
      tab,
      quote: await prisma.quote.findUnique({
        where: { projectId },
        include: { lines: { orderBy: { order: "asc" } }, schedule: { orderBy: { order: "asc" } } },
      }),
      epics: [],
      docs: [],
    };
  }

  if (tab === "features") {
    return {
      tab,
      quote: null,
      epics: await portalEpics(projectId),
      docs: [],
    };
  }

  return {
    tab,
    quote: null,
    epics: [],
    docs: await prisma.cdcDocument.findMany({ where: { projectId }, orderBy: { order: "asc" } }),
  };
}, { summary: "Portail client (compte CLIENT, session seulement : un compte client n'a pas de jeton d'API). Mon projet, un onglet à la fois : devis, fonctionnalités ou cahier des charges.", query: querySchema });
