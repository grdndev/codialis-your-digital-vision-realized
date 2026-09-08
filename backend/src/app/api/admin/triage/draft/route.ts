import { z } from "zod";
import { adminRoute, badRequest, notFound } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { draftReply, draftBasis, type DraftTicket, type Tone } from "@/lib/ai-draft";
import { generateDraftReply } from "@/lib/gemini";

export const dynamic = "force-dynamic";

// GET /api/admin/triage/draft?ticketId=&tone=&ai=1
//
// La rédaction du brouillon appartient entièrement au backend : c'est lui qui
// détient la clé Gemini et le gabarit de repli. L'écran ne fait qu'afficher le
// texte et la source.
//
// `ai=1` est un opt-in explicite, et le reste : le palier gratuit de Gemini est
// plafonné à 20 requêtes par jour, un appel automatique à chaque affichage le
// brûlerait en quelques minutes. Sans ce drapeau, on renvoie le gabarit
// déterministe, qui ne coûte rien.

const querySchema = z.object({
  ticketId: z.string().min(1),
  tone: z.enum(["Neutre", "Rassurant", "Ferme"]),
  ai: z.boolean(),
});

export const GET = adminRoute(["PM", "DIR"], async (_ctx, request) => {
  const params = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    ticketId: params.get("ticketId"),
    tone: params.get("tone") ?? "Neutre",
    ai: params.get("ai") === "1",
  });
  if (!parsed.success) badRequest("Requête invalide");
  const { ticketId, tone, ai } = parsed.data;

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { project: { include: { client: true } } },
  });
  if (!ticket) notFound("Ticket introuvable");

  const draftTicket: DraftTicket = {
    title: ticket.title,
    type: ticket.type,
    severity: ticket.severity,
    estHours: ticket.estHours,
    triageState: ticket.triageState,
    clientName: ticket.project.client.name,
  };

  const basis = draftBasis(draftTicket);

  if (!ai) {
    return { text: draftReply(draftTicket, tone as Tone), source: "template" as const, basis };
  }

  // `generateDraftReply` retombe déjà sur le gabarit si la clé manque ou si
  // l'appel échoue (quota inclus) : l'écran affiche toujours quelque chose.
  const draft = await generateDraftReply(draftTicket, tone as Tone);
  return { text: draft.text, source: draft.source, basis };
});
