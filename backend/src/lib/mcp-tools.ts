import "server-only";
import { z } from "zod";
import {
  actionsOf,
  callRoute,
  endpoints,
  findRoute,
  jsonSchemaOf,
  METHODS,
  queryParamsOf,
} from "@/lib/api-catalog";

// Outils du serveur MCP (/api/mcp).
//
// Quatre outils pour le quotidien d'un développeur sur ses tickets, et deux
// génériques — `catalogue` et `appel_api` — qui couvrent TOUTE l'API sans un
// outil par action (il y en a plus de 130 : autant d'outils noieraient
// l'agent). Chaque outil appelle une route du catalogue avec le jeton de
// l'appelant : il ne sait rien faire que ce jeton ne permette déjà par HTTP.

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

// Une réponse trop longue n'aide pas un agent : mieux vaut lui dire de filtrer.
const MAX_TEXT = 100_000;

function text(value: unknown, isError = false): ToolResult {
  let out = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  if (out.length > MAX_TEXT) {
    out = `${out.slice(0, MAX_TEXT)}\n… réponse tronquée (${out.length} caractères) : préciser les filtres.`;
  }
  return { content: [{ type: "text", text: out }], ...(isError ? { isError: true } : {}) };
}

function failure(status: number, data: unknown): ToolResult {
  return text({ status, ...(data && typeof data === "object" ? data : { error: data }) }, true);
}

type Tool = {
  name: string;
  title: string;
  description: string;
  input: z.ZodObject;
  annotations: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean };
  run: (args: Record<string, unknown>, authorization: string) => Promise<ToolResult>;
};

const STATUSES = ["A_FAIRE", "EN_COURS", "EN_REVUE", "TERMINE", "ANNULE"] as const;
const REF = z.string().min(1).describe("Référence du ticket, ex. « CC-365 »");

type TicketRow = {
  ref: string;
  title: string;
  type: string;
  status: string;
  severity: string | null;
  dueAt: string | null;
  project: { name: string; initials: string; client: { name: string } };
  epic: { title: string } | null;
  assignee: { name: string } | null;
};

type TicketDetail = TicketRow & {
  id: string;
  description: string;
  steps: string;
  devNature: string | null;
  estHours: number;
  spentHours: number;
  createdAt: string;
  updatedAt: string;
  creator: { name: string } | null;
  criteria: { id: string; label: string; done: boolean }[];
  comments: { author: { name: string } | null; createdAt: string; body: string }[];
  attachments: { id: string; filename: string; url: string | null; createdAt: string; uploadedBy: { name: string } | null }[];
};

const TOOLS: Tool[] = [
  {
    name: "lister_tickets",
    title: "Lister des tickets",
    description:
      "Liste des tickets, une ligne par ticket (référence, statut, type et gravité, projet, titre, assigné, échéance). Par défaut : MES tickets non clos.",
    input: z.object({
      assignee: z
        .string()
        .default("me")
        .describe("`me` (défaut), `none` (sans assigné), `all`, ou des identifiants de comptes séparés par des virgules"),
      status: z
        .array(z.enum(STATUSES))
        .default(["A_FAIRE", "EN_COURS", "EN_REVUE"])
        .describe("Statuts retenus ; par défaut tout sauf TERMINE et ANNULE"),
      type: z.enum(["BUG", "DEV"]).optional(),
      projet: z.string().optional().describe("Filtre sur le nom du projet, son sigle ou le nom du client"),
      recherche: z.string().optional().describe("Dans la référence, le titre, la description, les étapes"),
    }),
    annotations: { readOnlyHint: true },
    async run(args, authorization) {
      const { status, data } = await callRoute(authorization, "GET", "/api/admin/tickets", {
        query: {
          assignee: args.assignee,
          status: (args.status as string[]).join(","),
          type: args.type,
          q: args.recherche,
        },
      });
      if (status !== 200) return failure(status, data);
      let rows = (data as { tickets: TicketRow[] }).tickets;
      const projet = typeof args.projet === "string" ? args.projet.trim().toLowerCase() : "";
      if (projet) {
        rows = rows.filter((t) =>
          [t.project.name, t.project.initials, t.project.client.name].some((v) =>
            v.toLowerCase().includes(projet),
          ),
        );
      }
      if (!rows.length) return text("Aucun ticket.");
      const lines = rows.map((t) =>
        [
          t.ref,
          t.status,
          t.severity ? `${t.type}/${t.severity}` : t.type,
          `${t.project.client.name} — ${t.project.name}${t.epic ? ` › ${t.epic.title}` : ""}`,
          t.title,
          `assigné : ${t.assignee?.name ?? "personne"}`,
          ...(t.dueAt ? [`échéance : ${t.dueAt.slice(0, 10)}`] : []),
        ].join(" · "),
      );
      return text(`${rows.length} ticket(s)\n${lines.join("\n")}`);
    },
  },
  {
    name: "lire_ticket",
    title: "Lire un ticket",
    description:
      "Tout le dossier d'un ticket : description, étapes de reproduction, critères d'acceptation, commentaires, pièces jointes (avec leur URL).",
    input: z.object({ ref: REF }),
    annotations: { readOnlyHint: true },
    async run(args, authorization) {
      const { status, data } = await callRoute(authorization, "GET", "/api/admin/tickets/detail", {
        query: { ref: args.ref },
      });
      if (status !== 200) return failure(status, data);
      const t = (data as { ticket: TicketDetail | null }).ticket;
      if (!t) return text(`Ticket introuvable : ${String(args.ref)}`, true);
      return text({
        ref: t.ref,
        id: t.id,
        titre: t.title,
        type: t.type,
        statut: t.status,
        gravite: t.severity,
        nature: t.devNature,
        projet: `${t.project.client.name} — ${t.project.name}`,
        epic: t.epic?.title ?? null,
        assigne: t.assignee?.name ?? null,
        createur: t.creator?.name ?? null,
        estimationHeures: t.estHours,
        heuresPassees: t.spentHours,
        echeance: t.dueAt,
        creeLe: t.createdAt,
        modifieLe: t.updatedAt,
        description: t.description,
        etapes: t.steps,
        criteres: t.criteria.map((c) => ({ id: c.id, libelle: c.label, fait: c.done })),
        commentaires: t.comments.map((c) => ({
          auteur: c.author?.name ?? "compte supprimé",
          le: c.createdAt,
          texte: c.body,
        })),
        piecesJointes: t.attachments.map((a) => ({
          id: a.id,
          fichier: a.filename,
          url: a.url,
          // Les pièces d'avant CC-373 n'ont pas d'auteur connu.
          par: a.uploadedBy?.name ?? null,
          le: a.createdAt,
        })),
      });
    },
  },
  {
    name: "changer_statut_ticket",
    title: "Changer le statut d'un ticket",
    description:
      "EN_COURS quand on commence (lance le chronomètre de l'assigné), EN_REVUE à la livraison. TERMINE (livré) et ANNULE (abandonné) sont réservés à la chefferie et à la direction : un développeur s'arrête à EN_REVUE.",
    input: z.object({ ref: REF, statut: z.enum(STATUSES) }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async run(args, authorization) {
      const { status, data } = await callRoute(authorization, "POST", "/api/admin/tickets", {
        body: { action: "set-status", ticketId: args.ref, status: args.statut },
      });
      if (status !== 200) return failure(status, data);
      const notice = (data as { notice?: string }).notice;
      return text(`${String(args.ref)} → ${String(args.statut)}${notice ? `\n${notice}` : ""}`);
    },
  },
  {
    name: "commenter_ticket",
    title: "Commenter un ticket",
    description: "Ajoute un commentaire au ticket, au nom du propriétaire du jeton. Texte brut, retours à la ligne conservés.",
    input: z.object({ ref: REF, commentaire: z.string().min(1) }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async run(args, authorization) {
      const { status, data } = await callRoute(authorization, "POST", "/api/admin/tickets", {
        body: { action: "add-comment", ticketId: args.ref, body: args.commentaire },
      });
      if (status !== 200) return failure(status, data);
      return text(`Commentaire ajouté sur ${String(args.ref)}.`);
    },
  },
  {
    name: "catalogue",
    title: "Catalogue de l'API",
    description:
      "Sans argument : toutes les routes de l'API, leurs rôles et leurs actions. Avec `route` : le détail d'une route (paramètres, schéma de chaque action) avant de l'appeler avec `appel_api`.",
    input: z.object({
      route: z.string().optional().describe("Chemin d'une route, ex. « /api/admin/rh »"),
    }),
    annotations: { readOnlyHint: true },
    async run(args) {
      if (typeof args.route === "string" && args.route) {
        const route = findRoute(args.route);
        if (!route) return text(`Route inconnue : ${args.route}. Appeler catalogue sans argument pour la liste.`, true);
        return text(
          endpoints()
            .filter((e) => e.path === route.path)
            .map(({ method, meta }) => ({
              methode: method,
              resume: meta.summary,
              roles: meta.roles.length ? meta.roles : "tout compte connecté",
              ...(meta.rawBody ? { corps: "fichier brut : à envoyer en HTTP, pas par appel_api" } : {}),
              parametres: queryParamsOf(meta),
              ...(meta.body ? { actions: actionsOf(meta) } : {}),
            })),
        );
      }
      const lines = endpoints().map(({ path, method, meta }) => {
        const actions = actionsOf(meta).map((a) => a.action);
        return `${method} ${path} [${meta.roles.join(", ") || "tous"}] — ${meta.summary}${
          actions.length ? `\n    actions : ${actions.join(", ")}` : ""
        }`;
      });
      return text(lines.join("\n"));
    },
  },
  {
    name: "appel_api",
    title: "Appeler l'API",
    description:
      "Appelle n'importe quelle route de l'API avec les droits du jeton. GET lit (paramètres dans `parametres`), POST écrit (`corps` avec son champ `action`). Consulter `catalogue` d'abord.",
    input: z.object({
      methode: z.enum(METHODS),
      chemin: z.string().min(1).describe("Ex. « /api/admin/tickets »"),
      parametres: z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]))
        .optional()
        .describe("Paramètres d'adresse"),
      corps: z.record(z.string(), z.unknown()).optional().describe("Corps JSON d'un POST"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true },
    async run(args, authorization) {
      const { status, data } = await callRoute(
        authorization,
        args.methode as (typeof METHODS)[number],
        String(args.chemin),
        {
          query: args.parametres as Record<string, unknown> | undefined,
          body: args.corps,
        },
      );
      if (status !== 200) return failure(status, data);
      return text(data);
    },
  },
];

export function toolList() {
  return TOOLS.map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: jsonSchemaOf(tool.input),
    annotations: tool.annotations,
  }));
}

export class UnknownToolError extends Error {}

export async function runTool(
  name: string,
  rawArgs: unknown,
  authorization: string,
): Promise<ToolResult> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) throw new UnknownToolError(`Outil inconnu : ${name}`);
  const parsed = tool.input.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    return text(
      {
        error: "Arguments invalides",
        details: parsed.error.issues.map((i) => ({ champ: i.path.join(".") || "(racine)", message: i.message })),
      },
      true,
    );
  }
  return tool.run(parsed.data, authorization);
}
