import { z } from "zod";
import { adminRoute, notFound, parseQuery } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { generateAutomationDraft } from "@/lib/gemini";

export const dynamic = "force-dynamic";

// GET /api/admin/automations/draft?draftId=
//
// Réécrit une relance en attente avec Gemini. Appelée uniquement quand
// quelqu'un clique explicitement « Générer avec l'IA » : le palier gratuit est
// plafonné à 20 requêtes par jour, l'écran affiche sinon le texte enregistré.
//
// Le contexte du prompt est relu en base à partir du seul identifiant : le
// client de l'API ne dicte pas ce qui part vers Gemini.

const querySchema = z.object({ draftId: z.string().min(1) });

export const GET = adminRoute(["PM", "DIR"], async (_ctx, request) => {
  const { draftId } = parseQuery(querySchema, request);

  const draft = await prisma.automationDraft.findUnique({ where: { id: draftId } });
  if (!draft) notFound("Relance introuvable");

  // Retombe sur le texte enregistré si la clé manque ou si l'appel échoue.
  return generateAutomationDraft(draft.kind, draft.toWho, draft.text);
}, {
  summary:
    "Réécrit une relance en attente avec Gemini (quota gratuit limité à 20 appels par jour) ; retombe sur le texte enregistré si l'IA est indisponible.",
  query: querySchema,
});
