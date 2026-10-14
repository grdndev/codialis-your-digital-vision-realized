import { adminRoute } from "@/lib/admin-api";
import { openApiDocument } from "@/lib/api-catalog";

export const dynamic = "force-dynamic";

// GET /api/admin/openapi.json — la description de toute l'API, construite à
// partir des schémas qui valident chaque route (voir lib/api-catalog.ts).
// Réservée aux comptes internes : elle n'a rien de secret, mais n'a pas non
// plus à être lisible par n'importe qui.
export const GET = adminRoute(
  ["DEV", "PM", "DIR"],
  async () => openApiDocument((process.env.API_URL || "https://landingback.codialis.com").replace(/\/$/, "")),
  { summary: "Description OpenAPI 3.1 de l'API." },
);
