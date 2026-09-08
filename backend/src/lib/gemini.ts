// Live AI drafting via the Google Gemini API (free tier — https://aistudio.google.com/apikey).
// Falls back to the deterministic templates in `ai-draft.ts` when no key is configured
// or the call fails, so the screen always renders something.
import { draftReply as templateDraftReply, type DraftTicket, type Tone } from "@/lib/ai-draft";

const GEMINI_MODEL = "gemini-3.6-flash";

function apiKey(): string | null {
  return process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || null;
}

async function callGemini(prompt: string): Promise<string> {
  const key = apiKey();
  if (!key) throw new Error("Gemini API: no key configured");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        // gemini-3.6-flash reasons internally before answering, and those
        // "thinking" tokens count against maxOutputTokens — a low cap here
        // silently truncates the visible reply, so leave plenty of headroom.
        // A small thinkingBudget also cuts latency substantially in practice
        // (thinkingBudget: 0 is rejected by this model — some budget is required).
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 2048,
          thinkingConfig: { thinkingBudget: 128 },
        },
      }),
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error("Gemini API: empty response");
  return text;
}

const TONE_INSTRUCTIONS: Record<Tone, string> = {
  Neutre: "un ton neutre et professionnel",
  Rassurant: "un ton rassurant et chaleureux, qui met le client en confiance",
  Ferme: "un ton ferme et direct, sans être froid",
};

function buildTicketPrompt(t: DraftTicket, tone: Tone): string {
  return [
    "Tu es la cheffe de projet d'une agence web française qui répond à un client sur un ticket de support.",
    `Rédige une réponse courte (2 à 4 phrases), en français, avec ${TONE_INSTRUCTIONS[tone]}.`,
    "Contexte du ticket :",
    `- Client : ${t.clientName}`,
    `- Titre : ${t.title}`,
    `- Type : ${t.type === "BUG" ? "bug" : "demande d'évolution"}`,
    t.severity ? `- Gravité : ${t.severity}` : null,
    `- Statut de qualification : ${t.triageState}`,
    `- Estimation : ${t.estHours} h`,
    "Réponds uniquement avec le texte du message, sans formule de politesse finale ni signature.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateDraftReply(
  t: DraftTicket,
  tone: Tone
): Promise<{ text: string; source: "gemini" | "template" }> {
  try {
    return { text: await callGemini(buildTicketPrompt(t, tone)), source: "gemini" };
  } catch (err) {
    console.error("Gemini draft generation failed, falling back to template:", err);
    return { text: templateDraftReply(t, tone), source: "template" };
  }
}

function buildAutomationPrompt(kind: string, toWho: string, seedText: string): string {
  return [
    "Tu es la cheffe de projet d'une agence web française qui prépare une relance automatique à valider avant envoi.",
    `Rédige un message court (2 à 3 phrases), en français, de type « ${kind} », destiné à : ${toWho}.`,
    "Voici un exemple du type de message attendu pour ce cas (reprends la même situation et le même objectif, mais reformule) :",
    seedText,
    "Réponds uniquement avec le texte du message, sans formule de politesse finale ni signature.",
  ].join("\n");
}

export async function generateAutomationDraft(
  kind: string,
  toWho: string,
  seedText: string
): Promise<{ text: string; source: "gemini" | "template" }> {
  try {
    return { text: await callGemini(buildAutomationPrompt(kind, toWho, seedText)), source: "gemini" };
  } catch (err) {
    console.error("Gemini automation draft generation failed, falling back to template:", err);
    return { text: seedText, source: "template" };
  }
}
