// Contrôle de parité entre l'écran et l'API documentée.
//
//   npx tsx prisma/test-api-catalog.ts
//
// Vérifie que :
//   1. chaque route.ts authentifiée du backend figure dans lib/api-catalog.ts,
//      sous la bonne adresse, et rien d'autre ;
//   2. chaque méthode exportée porte une description, et chaque POST JSON son
//      schéma de corps ;
//   3. chaque adresse d'API appelée par frontend-admin est au catalogue ;
//   4. chaque `action: "…"` envoyée par un fichier de frontend-admin existe sur
//      une route que ce même fichier appelle ;
//   5. le document OpenAPI se construit.
// Aucune base n'est nécessaire : rien n'est exécuté, tout est lu.

import Module from "node:module";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

// Les modules du backend importent `server-only`, qui refuse de se charger
// hors d'un serveur React : on le remplace par sa version vide, celle que Next
// sert aux composants serveur. D'où le `require` qui suit, APRÈS ce détour —
// un `import` serait remonté avant lui.
type Resolver = (request: string, ...rest: unknown[]) => string;
const moduleInternals = Module as unknown as { _resolveFilename: Resolver };
const resolveFilename = moduleInternals._resolveFilename;
moduleInternals._resolveFilename = function (this: unknown, request: string, ...rest: unknown[]) {
  if (request === "server-only") return require.resolve("next/dist/compiled/server-only/empty.js");
  return resolveFilename.call(this, request, ...rest);
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const catalog: typeof import("@/lib/api-catalog") = require("@/lib/api-catalog");
const { actionsOf, API_ROUTES, endpoints, METHODS, openApiDocument } = catalog;

const BACKEND = join(__dirname, "..");
const ADMIN = join(BACKEND, "..", "frontend-admin", "src");

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, detail = "") {
  if (cond) pass++;
  else {
    fail++;
    console.log(`  KO  ${label} ${detail}`);
  }
}

function walk(dir: string, keep: (file: string) => boolean): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "node_modules" ? [] : walk(full, keep);
    return keep(full) ? [full] : [];
  });
}

// --- 1. Routes du backend ----------------------------------------------------

// Hors catalogue, et c'est voulu : les routes publiques du site, les routes
// d'authentification ouvertes sans session, ce document lui-même et le MCP.
const OUTSIDE = [/^\/api\/admin\/openapi\.json$/, /^\/api\/mcp$/];

const routeFiles = walk(join(BACKEND, "src", "app", "api"), (f) => f.endsWith(`${sep}route.ts`));
const authenticated = routeFiles
  .filter((f) => readFileSync(f, "utf8").includes("adminRoute("))
  .map((f) => "/" + relative(join(BACKEND, "src", "app"), f).split(sep).slice(0, -1).join("/"))
  .filter((path) => !OUTSIDE.some((re) => re.test(path)));

const cataloged = new Set(API_ROUTES.map((r) => r.path));
for (const path of authenticated) check(`route au catalogue : ${path}`, cataloged.has(path));
for (const path of cataloged) check(`route du catalogue existante : ${path}`, authenticated.includes(path));
check("pas de doublon au catalogue", cataloged.size === API_ROUTES.length);

// --- 2. Descriptions ---------------------------------------------------------

for (const { path, module } of API_ROUTES) {
  for (const method of METHODS) {
    const handler = module[method];
    if (!handler) continue;
    check(`${method} ${path} décrit`, typeof handler.meta?.summary === "string" && handler.meta.summary.length > 10);
    if (method === "POST") {
      check(`${method} ${path} : schéma du corps`, Boolean(handler.meta.body || handler.meta.rawBody));
    }
  }
}

// --- 3 et 4. Ce qu'envoie frontend-admin ---------------------------------------

const allActions = new Map<string, Set<string>>();
for (const { path, meta } of endpoints()) {
  const set = allActions.get(path) ?? new Set<string>();
  for (const a of actionsOf(meta)) set.add(a.action);
  allActions.set(path, set);
}

let actionsSeen = 0;
for (const file of walk(ADMIN, (f) => /\.(ts|tsx)$/.test(f))) {
  const source = readFileSync(file, "utf8");
  const paths = [...source.matchAll(/["`](\/api\/(?:admin|auth)\/[A-Za-z0-9/._-]+)/g)].map((m) =>
    m[1].replace(/\/$/, ""),
  );
  const short = relative(ADMIN, file);
  for (const path of paths) {
    if (/^\/api\/auth\/(login|forgot|reset|verify)$/.test(path)) continue;
    check(`${short} appelle une route connue : ${path}`, cataloged.has(path));
  }
  const actions = [...source.matchAll(/action: "([a-z0-9-]+)"/g)].map((m) => m[1]);
  for (const action of actions) {
    actionsSeen++;
    const candidates = paths.length ? paths : [...allActions.keys()];
    check(
      `${short} : action « ${action} » connue de ${candidates.join(" ou ")}`,
      candidates.some((p) => allActions.get(p)?.has(action)),
    );
  }
}

// --- 5. OpenAPI ----------------------------------------------------------------

const doc = openApiDocument("https://landingback.codialis.com");
const operations = Object.values(doc.paths).flatMap((item) => Object.keys(item));
const totalActions = [...allActions.values()].reduce((n, s) => n + s.size, 0);
check("document OpenAPI sérialisable", JSON.stringify(doc).length > 10_000);

console.log(
  `${pass} OK, ${fail} KO — ${API_ROUTES.length} routes, ${operations.length} opérations, ${totalActions} actions, ${actionsSeen} actions envoyées par l'écran`,
);
process.exit(fail ? 1 : 0);
