import "server-only";
import { prisma } from "@/lib/prisma";
import { sendHrNotifEmail, sendInBackground, mailConfigured } from "@/lib/mail";
import { isoOf } from "@/lib/work-calendar";

// Notifications RH par e-mail.
//
// Tout part en « best-effort » : une demande enregistrée ne doit jamais échouer
// parce que Brevo est indisponible. Sans clé configurée, rien n'est tenté — pas
// même une erreur journalisée à chaque demande, ce qui noierait les logs.

const DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

function fmt(d: Date): string {
  return DATE.format(d);
}

function hours(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1).replace(".", ",")} h`;
}

// Les destinataires d'une demande : la direction, qui doit trancher.
async function directors(): Promise<{ email: string; name: string }[]> {
  return prisma.user.findMany({
    where: { role: "DIR", emailVerified: true },
    select: { email: true, name: true },
  });
}

type Kind = "hours" | "absence" | "travel";

const SUBJECT: Record<Kind, string> = {
  hours: "Nouvelle déclaration d'heures",
  absence: "Nouvelle demande d'absence",
  travel: "Nouveau déplacement déclaré",
};

// Une demande vient d'être posée : la direction est prévenue.
export async function notifyRequestCreated(args: {
  kind: Kind;
  authorName: string;
  details: [string, string][];
}) {
  if (!mailConfigured()) return;
  const recipients = await directors();
  for (const to of recipients) {
    sendInBackground(`${args.kind} créé -> ${to.email}`, () =>
      sendHrNotifEmail({
        email: to.email,
        name: to.name,
        subject: SUBJECT[args.kind],
        heading: "À traiter",
        intro: `${args.authorName} vient de déposer une demande qui attend votre validation.`,
        details: args.details,
        tone: "amber",
      }),
    );
  }
}

// La direction a tranché : l'auteur de la demande est prévenu du verdict.
// `agreement` porte l'accord du participe : "" masculin singulier, "e" féminin,
// "es" féminin pluriel. Sans lui on lirait « Absence validé », et concaténer un
// participe sans accord dans une langue qui en demande un se remarque.
export async function notifyRequestDecided(args: {
  userId: string;
  approved: boolean;
  what: string;
  agreement: "" | "e" | "s" | "es";
  details: [string, string][];
}) {
  if (!mailConfigured()) return;
  const target = await prisma.user.findUnique({
    where: { id: args.userId },
    select: { email: true, name: true, emailVerified: true },
  });
  if (!target?.emailVerified) return;

  sendInBackground(`verdict -> ${target.email}`, () =>
    sendHrNotifEmail({
      email: target.email,
      name: target.name,
      subject: `${args.what} ${args.approved ? "validé" : "refusé"}${args.agreement}`,
      heading: args.approved ? "Validé" : "Refusé",
      // Le déterminant et l'auxiliaire s'accordent aussi : « Vos heures
      // supplémentaires ONT été refusées », pas « Votre … a été refusées ».
      // Le nombre se lit dans l'accord, qui se termine par « s » au pluriel.
      intro: (() => {
        const plural = args.agreement.endsWith("s");
        const participle = `${args.approved ? "validé" : "refusé"}${args.agreement}`;
        return `${plural ? "Vos" : "Votre"} ${args.what.toLowerCase()} ${
          plural ? "ont" : "a"
        } été ${participle} par la direction.`;
      })(),
      details: args.details,
      tone: args.approved ? "green" : "red",
    }),
  );
}

// --- Mise en forme des détails, partagée entre création et verdict ----------

export function hoursDetails(e: {
  kind: string;
  hours: number;
  date: Date;
  reason: string;
}): [string, string][] {
  return [
    ["Type", e.kind === "RECUP" ? "Récupération" : "Heures supplémentaires"],
    ["Volume", hours(e.hours)],
    ["Date", fmt(e.date)],
    ["Motif", e.reason],
  ];
}

export function absenceDetails(a: {
  type: string;
  startDate: Date;
  endDate: Date;
  halfDay: string | null;
  motif: string;
  paid: boolean;
}): [string, string][] {
  const sameDay = isoOf(a.startDate) === isoOf(a.endDate);
  const half = a.halfDay === "AM" ? " (matin)" : a.halfDay === "PM" ? " (après-midi)" : "";
  return [
    ["Type", a.type],
    ["Période", sameDay ? `${fmt(a.startDate)}${half}` : `${fmt(a.startDate)} → ${fmt(a.endDate)}`],
    ["Décompte", a.paid ? "sur le solde de congés" : "sans solde"],
    ["Motif", a.motif],
  ];
}

export function travelDetails(t: {
  destination: string;
  startDate: Date;
  endDate: Date | null;
  motif: string;
}): [string, string][] {
  return [
    ["Destination", t.destination],
    ["Période", t.endDate ? `${fmt(t.startDate)} → ${fmt(t.endDate)}` : fmt(t.startDate)],
    ["Motif", t.motif],
  ];
}
