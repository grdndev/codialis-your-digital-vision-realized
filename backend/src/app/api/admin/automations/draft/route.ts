import { z } from "zod";
import { adminRoute, badRequest, notFound } from "@/lib/admin-api";
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
  const parsed = querySchema.safeParse({ draftId: request.nextUrl.searchParams.get("draftId") });
  if (!parsed.success) badRequest("Requête invalide");

  const draft = await prisma.automationDraft.findUnique({ where: { id: parsed.data.draftId } });
  if (!draft) notFound("Relance introuvable");

  // Retombe sur le texte enregistré si la clé manque ou si l'appel échoue.
  return generateAutomationDraft(draft.kind, draft.toWho, draft.text);
});
