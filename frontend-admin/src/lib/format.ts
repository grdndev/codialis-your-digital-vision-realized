import type {
  ProjectGroup, TaskStatus, Severity, DevNature, TicketType,
  TriageState, DealStage, MockupStatus, InvoiceStatus, AutomationMode, DraftStatus,
} from "@/lib/types";

export function fmtHours(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  const str = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(".", ",");
  return `${str} h`;
}

export function fmtDate(date: Date | null): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function daysUntil(date: Date | null, now: Date = new Date()): number | null {
  if (!date) return null;
  const ms = date.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

// Kept as a standalone helper (rather than inlined `Date.now()`) so the
// impure call doesn't sit directly in a page component's render body.
export function daysFromNow(target: Date): number {
  return Math.ceil((target.getTime() - Date.now()) / 86400000);
}

const PERIOD_FORMATTER = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

// Same reasoning as daysFromNow: keep `new Date()` out of a component's render body.
export function currentPeriodLabel(): string {
  const label = PERIOD_FORMATTER.format(new Date());
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// [start, end) of the current calendar month in UTC.
export function currentMonthBounds(): { start: Date; end: Date } {
  const now = new Date();
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}

// The 5 weekdays (Mon-Fri) of the current week, at UTC midnight — the grid
// a planned-shift picker is built from.
export function currentWeekdays(): Date[] {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + mondayOffset));
  return Array.from({ length: 5 }, (_, i) => new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + i)));
}

// How far into the current month "now" is, as a 0..1 fraction — used to judge
// whether revenue booked so far is on pace for a monthly target.
export function monthProgressFraction(): number {
  const { start, end } = currentMonthBounds();
  return (Date.now() - start.getTime()) / (end.getTime() - start.getTime());
}

export const GROUP_LABEL: Record<ProjectGroup, string> = {
  DEV: "En développement",
  FIN: "Terminé",
  WAR: "Sous garantie",
  MAI: "En maintenance",
  CLO: "Clôturé",
};

export const GROUP_BADGE_CLASS: Record<ProjectGroup, string> = {
  DEV: "bg-mint/10 text-mint",
  FIN: "bg-blue/10 text-blue",
  WAR: "bg-blue/10 text-blue",
  MAI: "bg-amber/10 text-amber",
  CLO: "bg-white/5 text-muted",
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  A_FAIRE: "À faire",
  EN_COURS: "En cours",
  EN_REVUE: "En revue",
  TERMINE: "Terminé",
};

export const STATUS_BADGE_CLASS: Record<TaskStatus, string> = {
  A_FAIRE: "bg-white/5 text-muted",
  EN_COURS: "bg-mint/10 text-mint",
  EN_REVUE: "bg-amber/10 text-amber",
  TERMINE: "bg-blue/10 text-blue",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  BLOQUANT: "Bloquant",
  MAJEUR: "Majeur",
  MINEUR: "Mineur",
};

export const SEVERITY_BADGE_CLASS: Record<Severity, string> = {
  BLOQUANT: "bg-red/10 text-red",
  MAJEUR: "bg-amber/10 text-amber",
  MINEUR: "bg-blue/10 text-blue",
};

export const DEV_NATURE_LABEL: Record<DevNature, string> = {
  FRONT: "Front",
  BACK: "Back",
  API: "API",
  DESIGN: "Design",
};

export const TICKET_TYPE_LABEL: Record<TicketType, string> = {
  BUG: "Bug",
  DEV: "Développement",
};

export const TICKET_TYPE_BADGE_CLASS: Record<TicketType, string> = {
  BUG: "bg-red/10 text-red",
  DEV: "bg-blue/10 text-blue",
};

export const TICKET_TYPE_CLIENT_LABEL: Record<TicketType, string> = {
  BUG: "Bug",
  DEV: "Demande d’ajout",
};

export const TRIAGE_STATE_LABEL: Record<TriageState, string> = {
  A_QUALIFIER: "À qualifier",
  A_CHIFFRER: "À chiffrer",
  TRANSMIS: "Transmis",
  DEVIS_ENVOYE: "Devis envoyé",
  CLOS: "Clos",
};

export const TRIAGE_STATE_BADGE_CLASS: Record<TriageState, string> = {
  A_QUALIFIER: "bg-red/10 text-red",
  A_CHIFFRER: "bg-blue/10 text-blue",
  TRANSMIS: "bg-mint/10 text-mint",
  DEVIS_ENVOYE: "bg-amber/10 text-amber",
  CLOS: "bg-white/5 text-muted",
};

export const DEAL_STAGE_LABEL: Record<DealStage, string> = {
  CONTACT: "Prise de contact",
  QUALIFIE: "Qualifié",
  DEVIS: "Devis envoyé",
  NEGOCIATION: "Négociation",
  SIGNE: "Signé ce trimestre",
  REFUSE: "Refusé",
};

export const DEAL_STAGE_COLOR: Record<DealStage, string> = {
  CONTACT: "#5C6B85",
  QUALIFIE: "#5AA9FF",
  DEVIS: "#F5B544",
  NEGOCIATION: "#2BF08A",
  SIGNE: "#2E4066",
  REFUSE: "#FF6B6B",
};

export const MOCKUP_STATUS_LABEL: Record<MockupStatus, string> = {
  VALIDE: "Validé",
  EN_INTEGRATION: "En intégration",
  A_VALIDER: "À valider",
  BROUILLON: "Brouillon",
};

export const MOCKUP_STATUS_BADGE_CLASS: Record<MockupStatus, string> = {
  VALIDE: "bg-mint/10 text-mint",
  EN_INTEGRATION: "bg-blue/10 text-blue",
  A_VALIDER: "bg-amber/10 text-amber",
  BROUILLON: "bg-white/5 text-muted",
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  EN_ATTENTE: "En attente",
  EN_RETARD: "En retard",
  PAYEE: "Payée",
};

export const INVOICE_STATUS_BADGE_CLASS: Record<InvoiceStatus, string> = {
  EN_ATTENTE: "bg-blue/10 text-blue",
  EN_RETARD: "bg-amber/10 text-amber",
  PAYEE: "bg-mint/10 text-mint",
};

export const AUTOMATION_MODE_LABEL: Record<AutomationMode, string> = {
  AUTO: "Automatique",
  TO_VALIDATE: "À valider",
};

export const DRAFT_STATUS_LABEL: Record<DraftStatus, string> = {
  PENDING: "En attente",
  SENT: "Envoyé",
  IGNORED: "Ignoré",
};

export function fmtEUR(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

export function fmtDateTime(date: Date | null): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}
