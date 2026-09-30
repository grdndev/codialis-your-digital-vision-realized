// Échéancier de facturation d'un projet (CC-350).
//
// Un projet se facture en plusieurs fois, en pourcentages de son prix total :
// le plus souvent 30 % au démarrage, 40 % à mi-parcours, 30 % à la fin, mais
// aussi 40/30/30 ou 50/50. Créer « la facture suivante » d'un projet revient à
// trouver la première échéance pas encore facturée et à en calculer le
// montant.
//
// Module pur (ni base, ni session) : il se vérifie par prisma/test-billing.ts.

export const DEFAULT_PLAN = [30, 40, 30];

// Les échéanciers proposés à l'écran. L'API en accepte d'autres, pourvu qu'ils
// tiennent debout (voir isValidPlan).
export const PLAN_PRESETS = ["30,40,30", "40,30,30", "50,50"];

export type BillingInvoice = { milestone: number | null; amount: number };

export type NextMilestone =
  | { status: "no-total" }
  | { status: "done" }
  | { status: "next"; index: number; name: string; pct: number; amount: number; label: string };

// De deux à quatre échéances entières, positives, qui font 100 % à elles
// toutes : au-delà, ce n'est plus un échéancier mais une facturation au fil
// de l'eau, qui passe par les factures libres.
export function isValidPlan(plan: number[]): boolean {
  return (
    plan.length >= 2 &&
    plan.length <= 4 &&
    plan.every((p) => Number.isInteger(p) && p > 0) &&
    plan.reduce((s, p) => s + p, 0) === 100
  );
}

// Lecture de la colonne `billingPlan`. NULL ou illisible = l'échéancier
// habituel de l'agence, plutôt qu'un projet impossible à facturer.
export function parsePlan(raw: string | null | undefined): number[] {
  if (!raw) return DEFAULT_PLAN;
  const plan = raw.split(",").map((p) => Number(p.trim()));
  return isValidPlan(plan) ? plan : DEFAULT_PLAN;
}

// La première échéance s'appelle toujours acompte, la dernière solde. Entre
// les deux, une seule est « à mi-parcours » ; s'il y en a deux, on les numérote.
export function milestoneName(index: number, count: number): string {
  if (index === 0) return "Acompte";
  if (index === count - 1) return "Solde";
  if (count === 3) return "Mi-parcours";
  return `Échéance ${index + 1}`;
}

function cents(n: number): number {
  return Math.round(n * 100) / 100;
}

// Première échéance non facturée, et son montant. Une échéance supprimée
// (facture annulée avant paiement) redevient la suivante.
//
// Le solde n'est PAS son pourcentage du total : c'est le total moins ce qui a
// réellement été facturé sur les échéances précédentes. Un acompte arrondi, un
// prix revu en cours de projet ou un échéancier changé en route se rattrapent
// donc sur la dernière facture, et le projet est facturé à l'euro près.
export function nextMilestone(
  total: number | null,
  plan: number[],
  invoices: BillingInvoice[],
): NextMilestone {
  if (!total || total <= 0) return { status: "no-total" };
  const billed = new Set(invoices.map((i) => i.milestone).filter((m): m is number => m !== null));
  const index = plan.findIndex((_, i) => !billed.has(i));
  if (index === -1) return { status: "done" };

  const pct = plan[index];
  const isLast = index === plan.length - 1;
  const alreadyBilled = invoices
    .filter((i) => i.milestone !== null)
    .reduce((s, i) => s + i.amount, 0);
  const amount = isLast ? cents(total - alreadyBilled) : cents((total * pct) / 100);
  const name = milestoneName(index, plan.length);
  return { status: "next", index, name, pct, amount, label: `${name} (${pct} %)` };
}
