import { DEV_NATURE_LABEL, SEVERITY_LABEL, STATUS_LABEL, TICKET_TYPE_LABEL } from "@/lib/format";
import type { DevNature, Severity, TaskStatus, TicketType } from "@/lib/types";

// Mise en forme de l'export des tickets (CC-353). Fonctions pures : la route
// d'export ne fait que lire l'API et renvoyer le fichier produit ici.

export type ExportFormat = "csv" | "json";

export type ExportableTicket = {
  ref: string;
  type: TicketType;
  status: TaskStatus;
  severity: Severity | null;
  devNature: DevNature | null;
  title: string;
  description: string;
  steps: string;
  estHours: number;
  spentHours: number;
  createdAt: Date;
  updatedAt: Date;
  project: { name: string; client: { name: string } };
  epic: { title: string } | null;
  assignee: { name: string } | null;
};

// Les dates d'un ticket sont des instants : on les écrit à l'heure de l'agence,
// sans quoi un ticket ouvert à 2 h du matin à La Réunion porterait la date de
// la veille (UTC).
const LOCAL_DATE_TIME = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Indian/Reunion",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function localDateTime(date: Date): string {
  return LOCAL_DATE_TIME.format(date).replace(",", "");
}

// Une heure décimale à la française : Excel en France lit « 1,5 », pas « 1.5 ».
function frenchNumber(n: number): string {
  return String(Math.round(n * 100) / 100).replace(".", ",");
}

const CSV_COLUMNS: { header: string; value: (t: ExportableTicket) => string }[] = [
  { header: "Référence", value: (t) => t.ref },
  { header: "Type", value: (t) => TICKET_TYPE_LABEL[t.type] },
  { header: "Statut", value: (t) => STATUS_LABEL[t.status] },
  { header: "Gravité", value: (t) => (t.severity ? SEVERITY_LABEL[t.severity] : "") },
  { header: "Nature", value: (t) => (t.devNature ? DEV_NATURE_LABEL[t.devNature] : "") },
  { header: "Titre", value: (t) => t.title },
  { header: "Client", value: (t) => t.project.client.name },
  { header: "Projet", value: (t) => t.project.name },
  { header: "Lot", value: (t) => t.epic?.title ?? "" },
  { header: "Assigné", value: (t) => t.assignee?.name ?? "" },
  { header: "Estimé (h)", value: (t) => frenchNumber(t.estHours) },
  { header: "Passé (h)", value: (t) => frenchNumber(t.spentHours) },
  { header: "Créé le", value: (t) => localDateTime(t.createdAt) },
  { header: "Mis à jour le", value: (t) => localDateTime(t.updatedAt) },
  { header: "Description", value: (t) => t.description },
  { header: "Étapes de reproduction", value: (t) => t.steps },
];

// Point-virgule et non virgule : c'est le séparateur qu'Excel attend en
// français, la virgule y étant le séparateur décimal.
const CSV_SEPARATOR = ";";

function csvCell(value: string): string {
  return /[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// Le BOM en tête fait reconnaître l'UTF-8 à Excel : sans lui, chaque accent
// s'ouvre en caractères cassés.
export function ticketsToCsv(tickets: ExportableTicket[]): string {
  const lines = [
    CSV_COLUMNS.map((c) => csvCell(c.header)).join(CSV_SEPARATOR),
    ...tickets.map((t) => CSV_COLUMNS.map((c) => csvCell(c.value(t))).join(CSV_SEPARATOR)),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}

// Le JSON garde les valeurs brutes (codes de statut, instants ISO) : il est
// destiné à être relu par un programme, pas par un tableur. Les champs vides
// sont omis plutôt que mis à null, et les noms reprennent ceux de l'import
// JSON d'un projet.
export function ticketsToJson(tickets: ExportableTicket[], exportedAt: Date): string {
  return JSON.stringify(
    {
      exportedAt: exportedAt.toISOString(),
      count: tickets.length,
      tickets: tickets.map((t) => ({
        ref: t.ref,
        type: t.type,
        status: t.status,
        severity: t.severity ?? undefined,
        devNature: t.devNature ?? undefined,
        title: t.title,
        description: t.description,
        steps: t.steps,
        estHours: t.estHours,
        spentHours: t.spentHours,
        client: t.project.client.name,
        project: t.project.name,
        epic: t.epic?.title,
        assignee: t.assignee?.name,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    },
    null,
    2,
  );
}

// Nom de fichier sûr pour l'en-tête Content-Disposition : ni accent, ni espace,
// ni guillemet, qui s'y écrivent mal d'un navigateur à l'autre.
export function exportFileName(scope: string | null, format: ExportFormat, now: Date): string {
  const slug = (scope ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const day = new Intl.DateTimeFormat("fr-CA", { timeZone: "Indian/Reunion" }).format(now);
  return `tickets${slug ? `-${slug}` : ""}-${day}.${format}`;
}
