import { apiJson, apiPreflight } from "@/lib/public-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return apiJson(request, { ok: true }, { headers: { "Cache-Control": "no-store" } });
}

export async function OPTIONS(request: Request) {
  return apiPreflight(request, "GET");
}
