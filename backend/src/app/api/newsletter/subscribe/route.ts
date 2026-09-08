import { prisma } from "@/lib/prisma";
import { EMAIL_RE, apiError, apiJson, apiPreflight, readJsonBody } from "@/lib/public-api";

export const dynamic = "force-dynamic";

// POST /api/newsletter/subscribe — formulaire du blog.
export async function POST(request: Request) {
  const body = await readJsonBody(request);
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return apiError(request, "Email invalide", 400);

  // Une seconde inscription avec la même adresse est un succès silencieux :
  // le visiteur n'a pas à savoir qu'il était déjà inscrit.
  await prisma.newsletterSubscriber.upsert({
    where: { email },
    create: { email },
    update: {},
  });

  return apiJson(request, { ok: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

export async function OPTIONS(request: Request) {
  return apiPreflight(request, "POST");
}
