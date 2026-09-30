// Vérifie l'échéancier de facturation d'un projet (CC-350).
//
//   npx tsx prisma/test-billing.ts
//
// Module pur : le test tourne sans base ni application.
import { isValidPlan, milestoneName, nextMilestone, parsePlan } from "@/lib/billing";

let failures = 0;

function check(label: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  const suffix = ok ? "" : ` (attendu ${JSON.stringify(want)})`;
  console.log(`  ${ok ? "OK   " : "ÉCHEC"} ${label} -> ${JSON.stringify(got)}${suffix}`);
}

const pick = (m: ReturnType<typeof nextMilestone>) =>
  m.status === "next" ? { index: m.index, label: m.label, amount: m.amount } : m.status;

console.log("Échéanciers");
check("NULL = 30/40/30", parsePlan(null), [30, 40, 30]);
check("40/30/30 lu", parsePlan("40,30,30"), [40, 30, 30]);
check("50/50 lu", parsePlan("50,50"), [50, 50]);
check("illisible = défaut", parsePlan("abc"), [30, 40, 30]);
check("ne fait pas 100 % = défaut", parsePlan("30,30,30"), [30, 40, 30]);
check("une seule échéance refusée", isValidPlan([100]), false);
check("cinq échéances refusées", isValidPlan([20, 20, 20, 20, 20]), false);
check("pourcentage décimal refusé", isValidPlan([33.5, 66.5]), false);
check("zéro refusé", isValidPlan([0, 50, 50]), false);

console.log("Noms");
check("3 échéances", [0, 1, 2].map((i) => milestoneName(i, 3)), ["Acompte", "Mi-parcours", "Solde"]);
check("2 échéances", [0, 1].map((i) => milestoneName(i, 2)), ["Acompte", "Solde"]);
check("4 échéances", [0, 1, 2, 3].map((i) => milestoneName(i, 4)), ["Acompte", "Échéance 2", "Échéance 3", "Solde"]);

console.log("Échéance suivante, 30/40/30 sur 10 000 €");
const plan = [30, 40, 30];
check("rien de facturé : acompte", pick(nextMilestone(10000, plan, [])), { index: 0, label: "Acompte (30 %)", amount: 3000 });
check("acompte fait : mi-parcours", pick(nextMilestone(10000, plan, [{ milestone: 0, amount: 3000 }])), { index: 1, label: "Mi-parcours (40 %)", amount: 4000 });
check(
  "acompte et mi-parcours faits : solde",
  pick(nextMilestone(10000, plan, [{ milestone: 0, amount: 3000 }, { milestone: 1, amount: 4000 }])),
  { index: 2, label: "Solde (30 %)", amount: 3000 },
);
check(
  "tout facturé",
  pick(nextMilestone(10000, plan, [{ milestone: 0, amount: 3000 }, { milestone: 1, amount: 4000 }, { milestone: 2, amount: 3000 }])),
  "done",
);
check(
  "les factures libres (avenant) ne comptent pas dans l'échéancier",
  pick(nextMilestone(10000, plan, [{ milestone: null, amount: 2000 }, { milestone: 0, amount: 3000 }])),
  { index: 1, label: "Mi-parcours (40 %)", amount: 4000 },
);
check(
  "…ni dans le solde",
  pick(nextMilestone(10000, plan, [{ milestone: null, amount: 2000 }, { milestone: 0, amount: 3000 }, { milestone: 1, amount: 4000 }])),
  { index: 2, label: "Solde (30 %)", amount: 3000 },
);
check(
  "mi-parcours annulé : il redevient la suivante",
  pick(nextMilestone(10000, plan, [{ milestone: 0, amount: 3000 }, { milestone: 2, amount: 3000 }])),
  { index: 1, label: "Mi-parcours (40 %)", amount: 4000 },
);

console.log("Arrondis et changements en route");
check("acompte arrondi au centime", pick(nextMilestone(3333, plan, [])), { index: 0, label: "Acompte (30 %)", amount: 999.9 });
check(
  "le solde rattrape les arrondis : total exact",
  pick(nextMilestone(1000.01, plan, [{ milestone: 0, amount: 300 }, { milestone: 1, amount: 400 }])),
  { index: 2, label: "Solde (30 %)", amount: 300.01 },
);
check(
  "prix revu à la hausse après l'acompte : le solde absorbe l'écart",
  pick(nextMilestone(12000, plan, [{ milestone: 0, amount: 3000 }, { milestone: 1, amount: 4800 }])),
  { index: 2, label: "Solde (30 %)", amount: 4200 },
);
check(
  "passage en 50/50 après un acompte à 30 % : solde = le reste",
  pick(nextMilestone(10000, [50, 50], [{ milestone: 0, amount: 3000 }])),
  { index: 1, label: "Solde (50 %)", amount: 7000 },
);
check("50/50 : acompte", pick(nextMilestone(8000, [50, 50], [])), { index: 0, label: "Acompte (50 %)", amount: 4000 });
check("40/30/30 : acompte", pick(nextMilestone(8000, [40, 30, 30], [])), { index: 0, label: "Acompte (40 %)", amount: 3200 });

console.log("Sans prix");
check("prix absent", pick(nextMilestone(null, plan, [])), "no-total");
check("prix nul", pick(nextMilestone(0, plan, [])), "no-total");

console.log(failures ? `\n${failures} échec(s)` : "\nTout est bon.");
process.exit(failures ? 1 : 0);
