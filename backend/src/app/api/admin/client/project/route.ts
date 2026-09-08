import { z } from "zod";
import { adminRoute, badRequest } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { clientProjectId } from "@/lib/client-scope";

export const dynamic = "force-dynamic";

// Portail client — écran « Mon projet ».
//
// Comme sur l'écran Ressources, seul l'onglet demandé est chargé : les trois
// volets (devis, fonctionnalités, cahier des charges) n'ont rien en commun.

const querySchema = z.object({ tab: z.enum(["devis", "features", "cdc"]) });

export const GET = adminRoute(["CLIENT"], async ({ user }, request) => {
  const parsed = querySchema.safeParse({ tab: request.nextUrl.searchParams.get("tab") ?? "devis" });
  if (!parsed.success) badRequest("Onglet inconnu");
  const { tab } = parsed.data;

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
      epics: await prisma.epic.findMany({
        where: { projectId },
        orderBy: { order: "asc" },
        include: { tasks: { orderBy: { order: "asc" } } },
      }),
      docs: [],
    };
  }

  return {
    tab,
    quote: null,
    epics: [],
    docs: await prisma.cdcDocument.findMany({ where: { projectId }, orderBy: { order: "asc" } }),
  };
});
