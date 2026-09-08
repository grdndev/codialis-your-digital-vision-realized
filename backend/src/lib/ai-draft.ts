// Deterministic, template-based reply drafting for the "Remontées client" screen.
//
// The prototype's AI-drafted replies were themselves canned text keyed by ticket
// state, not a live LLM call. This implementation is functionally equivalent —
// it composes real sentences from the ticket's actual data (client, title,
// estimate, state) — but no Anthropic API key was available in this environment
// to wire an actual Claude call. To upgrade: replace `draftReply`'s body with a
// call to the Claude API (client.messages.create) using this same context, and
// keep the tone/state framing below as the prompt.
import type { Severity, TriageState, TicketType } from "@prisma/client";
import { fmtHours } from "@/lib/format";

export type Tone = "Neutre" | "Rassurant" | "Ferme";

export type DraftTicket = {
  title: string;
  type: TicketType;
  severity: Severity | null;
  estHours: number;
  triageState: TriageState;
  clientName: string;
};

const SEVERITY_WORD: Record<Severity, string> = {
  BLOQUANT: "bloquant",
  MAJEUR: "majeur",
  MINEUR: "mineur",
};

export function draftReply(t: DraftTicket, tone: Tone): string {
  const hours = fmtHours(t.estHours);
  const opener = { Neutre: "Bonjour,", Rassurant: "Bonjour,", Ferme: "Bonjour," }[tone];

  if (t.triageState === "CLOS") {
    return {
      Neutre: `${opener} ce point a été corrigé et le ticket est clos. Si le comportement se reproduit de votre côté, répondez à ce message et nous rouvrons le ticket immédiatement.`,
      Rassurant: `${opener} tout est réglé de notre côté et le ticket est clos. N’hésitez pas à revenir vers nous si vous constatez à nouveau le problème, nous le rouvrons sans formalité.`,
      Ferme: `${opener} correction livrée et ticket clos. Toute nouvelle occurrence doit faire l’objet d’un nouveau signalement via le portail.`,
    }[tone];
  }

  if (t.type === "DEV" || t.triageState === "A_CHIFFRER" || t.triageState === "DEVIS_ENVOYE") {
    return {
      Neutre: `${opener} votre demande « ${t.title} » sort du périmètre initial : nous la chiffrons comme une évolution, estimée à ${hours}. Le devis vous parvient sous 24 h ouvrées.`,
      Rassurant: `${opener} c’est tout à fait faisable. « ${t.title} » ne figurait pas au cahier des charges, nous passons par un avenant d’environ ${hours} : je vous envoie le chiffrage sous 24 h et nous pourrons enchaîner dès votre accord.`,
      Ferme: `${opener} « ${t.title} » est une évolution hors périmètre du cahier des charges signé. Chiffrage en cours (≈ ${hours}), devis sous 24 h ouvrées. Aucun développement ne démarre avant signature.`,
    }[tone];
  }

  const sev = t.severity ? SEVERITY_WORD[t.severity] : "à qualifier";
  if (t.triageState === "A_QUALIFIER") {
    return {
      Neutre: `${opener} merci pour votre signalement « ${t.title} ». Nous le qualifions aujourd’hui — premier retour attendu ${sev === "bloquant" ? "sous 2 h" : "sous 24 h ouvrées"} avec le délai de correction.`,
      Rassurant: `${opener} merci de nous l’avoir signalé, c’est bien reçu. Nous regardons « ${t.title} » aujourd’hui et revenons vers vous rapidement avec un délai précis.`,
      Ferme: `${opener} votre signalement « ${t.title} » est enregistré et en cours de qualification. Retour de notre part ${sev === "bloquant" ? "sous 2 h" : "sous 24 h ouvrées"} avec le délai de correction.`,
    }[tone];
  }

  // TRANSMIS
  return {
    Neutre: `${opener} « ${t.title} » est qualifié ${sev} et transmis à l’équipe de développement, estimé à ${hours}. Je vous confirme la mise en ligne dès qu’elle est faite.`,
    Rassurant: `${opener} c’est pris en charge : « ${t.title} » est chez le développeur, estimé à ${hours}. Vous n’avez rien à faire de votre côté, je reviens vers vous à la mise en ligne.`,
    Ferme: `${opener} ticket qualifié ${sev} et transmis au développement (≈ ${hours}). Retour de notre part à la livraison.`,
  }[tone];
}

export function draftBasis(t: DraftTicket): string[] {
  const basis = ["signalement du client", `état du ticket · ${t.triageState}`];
  if (t.severity) basis.push(`gravité ${SEVERITY_WORD[t.severity]}`);
  basis.push(`estimation ${fmtHours(t.estHours)}`);
  return basis;
}
