import "server-only";
import { z } from "zod";
import { NextRequest } from "next/server";
import type { RouteMeta } from "@/lib/admin-api";

import * as accounts from "@/app/api/admin/accounts/route";
import * as attachments from "@/app/api/admin/attachments/route";
import * as automations from "@/app/api/admin/automations/route";
import * as automationsDraft from "@/app/api/admin/automations/draft/route";
import * as clientBugs from "@/app/api/admin/client/bugs/route";
import * as clientContext from "@/app/api/admin/client/context/route";
import * as clientMessages from "@/app/api/admin/client/messages/route";
import * as clientProgress from "@/app/api/admin/client/progress/route";
import * as clientProject from "@/app/api/admin/client/project/route";
import * as clientRdv from "@/app/api/admin/client/rdv/route";
import * as crm from "@/app/api/admin/crm/route";
import * as dashboard from "@/app/api/admin/dashboard/route";
import * as finance from "@/app/api/admin/finance/route";
import * as maintenance from "@/app/api/admin/maintenance/route";
import * as me from "@/app/api/admin/me/route";
import * as notifications from "@/app/api/admin/notifications/route";
import * as objectifs from "@/app/api/admin/objectifs/route";
import * as pilotage from "@/app/api/admin/pilotage/route";
import * as projects from "@/app/api/admin/projects/route";
import * as projectsDetail from "@/app/api/admin/projects/detail/route";
import * as resources from "@/app/api/admin/resources/route";
import * as rh from "@/app/api/admin/rh/route";
import * as siteContent from "@/app/api/admin/site/content/route";
import * as siteInbox from "@/app/api/admin/site/inbox/route";
import * as siteSettings from "@/app/api/admin/site/settings/route";
import * as siteVeille from "@/app/api/admin/site/veille/route";
import * as siteVeillePrefill from "@/app/api/admin/site/veille/prefill/route";
import * as tickets from "@/app/api/admin/tickets/route";
import * as ticketsDetail from "@/app/api/admin/tickets/detail/route";
import * as ticketsNew from "@/app/api/admin/tickets/new/route";
import * as time from "@/app/api/admin/time/route";
import * as todo from "@/app/api/admin/todo/route";
import * as triage from "@/app/api/admin/triage/route";
import * as triageDraft from "@/app/api/admin/triage/draft/route";
import * as changePassword from "@/app/api/auth/change-password/route";

// Catalogue de l'API : chaque route authentifiée, avec ce qu'elle attend.
//
// C'est la source de la documentation (GET /api/admin/openapi.json) et du
// serveur MCP (/api/mcp), qui appelle les routes D'ICI, dans le même process :
// un agent passe exactement par les mêmes gestionnaires, donc les mêmes droits
// et les mêmes contrôles, que l'écran. Aucune règle n'est recopiée.
//
// Une route ajoutée doit l'être aussi dans cette liste ; le script
// prisma/test-api-catalog.ts le vérifie (et que chaque action envoyée par
// frontend-admin y figure).

export const METHODS = ["GET", "POST", "DELETE"] as const;
export type Method = (typeof METHODS)[number];

type Handler = ((request: NextRequest, routeCtx: unknown) => Promise<Response>) & { meta: RouteMeta };
type RouteModule = Partial<Record<Method, Handler>>;

export const API_ROUTES: { path: string; module: RouteModule }[] = [
  { path: "/api/admin/me", module: me },
  { path: "/api/admin/notifications", module: notifications },
  { path: "/api/admin/tickets", module: tickets },
  { path: "/api/admin/tickets/detail", module: ticketsDetail },
  { path: "/api/admin/tickets/new", module: ticketsNew },
  { path: "/api/admin/attachments", module: attachments },
  { path: "/api/admin/projects", module: projects },
  { path: "/api/admin/projects/detail", module: projectsDetail },
  { path: "/api/admin/time", module: time },
  { path: "/api/admin/dashboard", module: dashboard },
  { path: "/api/admin/objectifs", module: objectifs },
  { path: "/api/admin/resources", module: resources },
  { path: "/api/admin/rh", module: rh },
  { path: "/api/admin/crm", module: crm },
  { path: "/api/admin/triage", module: triage },
  { path: "/api/admin/triage/draft", module: triageDraft },
  { path: "/api/admin/finance", module: finance },
  { path: "/api/admin/maintenance", module: maintenance },
  { path: "/api/admin/pilotage", module: pilotage },
  { path: "/api/admin/todo", module: todo },
  { path: "/api/admin/automations", module: automations },
  { path: "/api/admin/automations/draft", module: automationsDraft },
  { path: "/api/admin/accounts", module: accounts },
  { path: "/api/admin/site/content", module: siteContent },
  { path: "/api/admin/site/settings", module: siteSettings },
  { path: "/api/admin/site/inbox", module: siteInbox },
  { path: "/api/admin/site/veille", module: siteVeille },
  { path: "/api/admin/site/veille/prefill", module: siteVeillePrefill },
  { path: "/api/admin/client/context", module: clientContext },
  { path: "/api/admin/client/progress", module: clientProgress },
  { path: "/api/admin/client/bugs", module: clientBugs },
  { path: "/api/admin/client/project", module: clientProject },
  { path: "/api/admin/client/rdv", module: clientRdv },
  { path: "/api/admin/client/messages", module: clientMessages },
  { path: "/api/auth/change-password", module: changePassword },
];

export type Endpoint = { path: string; method: Method; meta: RouteMeta };

export function endpoints(): Endpoint[] {
  return API_ROUTES.flatMap(({ path, module }) =>
    METHODS.flatMap((method) => {
      const handler = module[method];
      return handler ? [{ path, method, meta: handler.meta }] : [];
    }),
  );
}

// JSON Schema d'un schéma zod, tel que l'appelant doit l'ENVOYER (valeurs par
// défaut facultatives). Le motif d'une date ISO, illisible, cède la place au
// seul `format: date-time`.
type JsonSchema = Record<string, unknown>;

export function jsonSchemaOf(schema: z.ZodType): JsonSchema {
  const out = z.toJSONSchema(schema, {
    io: "input",
    unrepresentable: "any",
    override: (ctx) => {
      const js = ctx.jsonSchema as JsonSchema;
      if (js.format === "date-time") delete js.pattern;
    },
  }) as JsonSchema;
  delete out.$schema;
  return out;
}

// Les actions d'une route d'écran : une variante par valeur de `action`.
export function actionsOf(meta: RouteMeta): { action: string; description?: string; schema: JsonSchema }[] {
  if (!meta.body) return [];
  const root = jsonSchemaOf(meta.body);
  const variants = (root.oneOf ?? root.anyOf ?? [root]) as JsonSchema[];
  return variants.flatMap((variant) => {
    const action = (variant.properties as Record<string, JsonSchema> | undefined)?.action?.const;
    return typeof action === "string"
      ? [{ action, description: variant.description as string | undefined, schema: variant }]
      : [];
  });
}

// Paramètres d'adresse, un par propriété du schéma de la requête.
export function queryParamsOf(meta: RouteMeta) {
  if (!meta.query) return [];
  const root = jsonSchemaOf(meta.query);
  const properties = (root.properties ?? {}) as Record<string, JsonSchema>;
  const required = new Set((root.required ?? []) as string[]);
  return Object.entries(properties).map(([name, schema]) => {
    const { description, ...rest } = schema;
    return { name, required: required.has(name), description: description as string | undefined, schema: rest };
  });
}

export function findRoute(path: string) {
  return API_ROUTES.find((route) => route.path === path) ?? null;
}

// Appelle une route du catalogue DANS le process, avec l'en-tête Authorization
// de l'appelant : c'est elle qui authentifie et applique les droits, comme si
// la requête arrivait de l'extérieur. Aucune requête réseau, donc aucune
// adresse arbitraire possible : seules les routes de cette liste répondent.
export async function callRoute(
  authorization: string,
  method: Method,
  path: string,
  options: { query?: Record<string, unknown>; body?: unknown } = {},
): Promise<{ status: number; data: unknown }> {
  const route = findRoute(path);
  if (!route) return { status: 404, data: { error: `Route inconnue : ${path}` } };
  const handler = route.module[method];
  if (!handler) return { status: 405, data: { error: `${method} n'existe pas sur ${path}` } };
  if (handler.meta.rawBody) {
    return {
      status: 400,
      data: { error: "Cette route attend un fichier brut : l'appeler en HTTP (voir API.md)" },
    };
  }

  // L'hôte ne sert qu'à construire une URL valide : rien n'est envoyé.
  const url = new URL(path, "http://codialis.interne");
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value === undefined || value === null) continue;
    for (const item of Array.isArray(value) ? value : [value]) url.searchParams.append(key, String(item));
  }
  const request = new NextRequest(url, {
    method,
    headers: { authorization, "content-type": "application/json" },
    body: method === "POST" ? JSON.stringify(options.body ?? {}) : undefined,
  });
  const response = await handler(request, { params: Promise.resolve({}) });
  const text = await response.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Une route renvoie toujours du JSON ; on garde le texte si ce n'est pas le cas.
  }
  return { status: response.status, data };
}

// --- OpenAPI ----------------------------------------------------------------

function firstSentence(text: string): string {
  const cut = text.search(/[.:;](\s|$)/);
  return cut > 0 ? text.slice(0, cut) : text;
}

function rolesLabel(roles: RouteMeta["roles"]): string {
  return roles.length ? roles.join(", ") : "tout compte connecté";
}

export function openApiDocument(apiUrl: string) {
  const paths: Record<string, Record<string, unknown>> = {
    "/api/auth/login": {
      post: {
        summary: "Connexion par e-mail et mot de passe",
        description:
          "Renvoie un jeton de session de 30 jours (`token`). Pour un script ou un agent, préférer un jeton d'API personnel, créé dans Paramètres.",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { email: { type: "string" }, password: { type: "string" } },
                required: ["email", "password"],
              },
            },
          },
        },
        responses: { "200": { description: "{ token, role }" }, "401": { description: "Identifiants incorrects" } },
      },
    },
  };

  for (const { path, method, meta } of endpoints()) {
    const actions = actionsOf(meta);
    const operation: Record<string, unknown> = {
      summary: firstSentence(meta.summary),
      description: `${meta.summary}\n\nRôles : ${rolesLabel(meta.roles)}.${
        actions.length ? `\n\nActions (champ \`action\` du corps) :\n${actions.map((a) => `- \`${a.action}\` — ${a.description ?? ""}`).join("\n")}` : ""
      }`,
      "x-roles": meta.roles,
      parameters: queryParamsOf(meta).map((p) => ({
        name: p.name,
        in: "query",
        required: p.required,
        description: p.description,
        schema: p.schema,
      })),
      responses: {
        "200": { description: "JSON ; une écriture sans résultat répond `{ ok: true }`" },
        "400": { description: "`{ error, details?: [{ champ, message }] }`" },
        "401": { description: "Jeton absent, invalide ou expiré" },
        "403": { description: "Rôle insuffisant, ou jeton en lecture seule sur une écriture" },
      },
    };
    if (meta.rawBody) {
      operation.requestBody = {
        required: true,
        content: { "application/octet-stream": { schema: { type: "string", format: "binary" } } },
      };
    } else if (meta.body) {
      operation.requestBody = {
        required: true,
        content: { "application/json": { schema: jsonSchemaOf(meta.body) } },
      };
    }
    paths[path] = { ...paths[path], [method.toLowerCase()]: operation };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "API Codialis",
      version: "1",
      description: [
        "L'API du back-office Codialis : tout ce que fait l'écran passe par elle, avec les mêmes droits.",
        "",
        "Authentification : `Authorization: Bearer <jeton>`, avec un jeton d'API personnel (`cdl_…`, créé dans Paramètres → Jetons d'API) ou un jeton de session (POST /api/auth/login).",
        "",
        "Conventions : une route par écran ; GET lit l'écran, POST y écrit avec un champ `action` qui choisit l'opération. Dates en ISO 8601 (UTC). Durées et heures en heures décimales. Un ticket se désigne par son identifiant ou par sa référence (« CC-365 »).",
        "",
        "Serveur MCP : POST /api/mcp (Streamable HTTP, même jeton).",
      ].join("\n"),
    },
    servers: [{ url: apiUrl }],
    components: {
      securitySchemes: {
        bearer: { type: "http", scheme: "bearer", description: "Jeton d'API `cdl_…` ou jeton de session" },
      },
    },
    security: [{ bearer: [] }],
    paths,
  };
}
