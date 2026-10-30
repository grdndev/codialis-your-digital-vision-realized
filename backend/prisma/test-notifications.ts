// Vérifie les notifications d'échéance de la cloche (CC-366).
//
//   npx tsx prisma/test-notifications.ts
//
// Module pur : le test tourne sans base ni application.
import { dueHorizon, dueNotifications, officeTodayIso, type NotifiableTicket } from "@/lib/notifications";

let failures = 0;

function check(label: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  const suffix = ok ? "" : ` (attendu ${JSON.stringify(want)})`;
  console.log(`  ${ok ? "OK   " : "ÉCHEC"} ${label} -> ${JSON.stringify(got)}${suffix}`);
}

type T = NotifiableTicket & { ref: string };

// Une échéance posée par l'écran : le jour à 09:00 UTC.
const due = (iso: string) => new Date(`${iso}T09:00:00.000Z`);
const ticket = (ref: string, over: Partial<T>): T => ({
  ref,
  status: "A_FAIRE",
  dueAt: null,
  assigneeId: "dev",
  createdAt: new Date("2026-10-01T08:00:00.000Z"),
  ...over,
});

const dev = { id: "dev", role: "DEV" };
const pm = { id: "pm", role: "PM" };
const dir = { id: "dir", role: "DIR" };
// Jeudi 30 octobre 2026, 10 h à La Réunion.
const now = new Date("2026-10-30T06:00:00.000Z");

const refs = (list: { ticket: T }[]) => list.map((n) => n.ticket.ref);

console.log("Jour de bureau à La Réunion");
check("06:00 UTC = même jour", officeTodayIso(now), "2026-10-30");
check("19:59 UTC = même jour", officeTodayIso(new Date("2026-10-30T19:59:00.000Z")), "2026-10-30");
check("20:00 UTC = déjà le lendemain", officeTodayIso(new Date("2026-10-30T20:00:00.000Z")), "2026-10-31");
check("horizon = J+8 à minuit UTC", dueHorizon(now).toISOString(), "2026-11-07T00:00:00.000Z");

console.log("Fenêtre d'échéance");
const window = [
  ticket("SANS", {}),
  ticket("HIER", { dueAt: due("2026-10-29") }),
  ticket("AUJ", { dueAt: due("2026-10-30") }),
  ticket("J7", { dueAt: due("2026-11-06") }),
  ticket("J8", { dueAt: due("2026-11-07") }),
  ticket("ANCIEN", { dueAt: due("2025-12-01") }),
];
const got = dueNotifications(window, dev, now);
check("sans échéance et J+8 écartés, ordre par échéance", refs(got), ["ANCIEN", "HIER", "AUJ", "J7"]);
check("jours", got.map((n) => n.days), [-333, -1, 0, 7]);
check("en retard", got.map((n) => n.overdue), [true, true, false, false]);
check(
  "le soir à La Réunion, aujourd'hui devient hier",
  dueNotifications([ticket("AUJ", { dueAt: due("2026-10-30") })], dev, new Date("2026-10-30T21:00:00.000Z")).map(
    (n) => [n.days, n.overdue],
  ),
  [[-1, true]],
);
check(
  "échéance hors convention (minuit UTC) : sa date UTC fait foi",
  dueNotifications([ticket("MINUIT", { dueAt: new Date("2026-10-30T00:00:00.000Z") })], dev, now).map((n) => n.days),
  [0],
);

console.log("Statuts et rôles");
const statuses = [
  ticket("AF", { status: "A_FAIRE", dueAt: due("2026-10-29") }),
  ticket("EC", { status: "EN_COURS", dueAt: due("2026-10-29") }),
  ticket("ER", { status: "EN_REVUE", dueAt: due("2026-10-29") }),
  ticket("TE", { status: "TERMINE", dueAt: due("2026-10-29") }),
  ticket("AUTRE", { status: "A_FAIRE", dueAt: due("2026-10-29"), assigneeId: "dev2" }),
  ticket("PERSONNE", { status: "A_FAIRE", dueAt: due("2026-10-29"), assigneeId: null }),
  ticket("ER-AUTRE", { status: "EN_REVUE", dueAt: due("2026-10-29"), assigneeId: "dev2" }),
];
check("DEV : ses tickets À faire et En cours seulement", refs(dueNotifications(statuses, dev, now)), ["AF", "EC"]);
check("PM : tous les En revue de l'agence", refs(dueNotifications(statuses, pm, now)), ["ER", "ER-AUTRE"]);
check("DIR : même règle que PM", refs(dueNotifications(statuses, dir, now)), ["ER", "ER-AUTRE"]);
check(
  "PM assignée : ses tickets à faire en plus des En revue",
  dueNotifications([...statuses, ticket("PM-AF", { dueAt: due("2026-10-29"), assigneeId: "pm" })], pm, now).map(
    (n) => [n.ticket.ref, n.reason],
  ),
  [["ER", "review"], ["ER-AUTRE", "review"], ["PM-AF", "assignee"]],
);
check(
  "PM ne reçoit pas les À faire des autres",
  refs(dueNotifications([ticket("AF", { dueAt: due("2026-10-29") })], pm, now)),
  [],
);

console.log("Ordre");
const order = [
  ticket("BIENTOT-LOIN", { dueAt: due("2026-11-05") }),
  ticket("RETARD-RECENT", { dueAt: due("2026-10-28") }),
  ticket("BIENTOT-PROCHE", { dueAt: due("2026-10-31") }),
  ticket("RETARD-VIEUX", { dueAt: due("2026-10-01") }),
  ticket("MEME-JOUR-RECENT", { dueAt: due("2026-10-01"), createdAt: new Date("2026-10-20T00:00:00.000Z") }),
  ticket("MEME-JOUR-VIEUX", { dueAt: due("2026-10-01"), createdAt: new Date("2026-09-01T00:00:00.000Z") }),
];
check(
  "dépassées (plus ancienne d'abord) puis proches (plus proche d'abord), à égalité le plus vieux ticket",
  refs(dueNotifications(order, dev, now)),
  ["MEME-JOUR-VIEUX", "RETARD-VIEUX", "MEME-JOUR-RECENT", "RETARD-RECENT", "BIENTOT-PROCHE", "BIENTOT-LOIN"],
);

console.log(failures ? `\n${failures} échec(s)` : "\nTout est bon");
process.exit(failures ? 1 : 0);
