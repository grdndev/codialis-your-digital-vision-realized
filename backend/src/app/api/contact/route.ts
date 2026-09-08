import { prisma } from "@/lib/prisma";
import { EMAIL_RE, apiError, apiJson, apiPreflight, clip, readJsonBody } from "@/lib/public-api";

export const dynamic = "force-dynamic";

// POST /api/contact — formulaire de la page publique /contact. Les champs sont
// tronqués aux longueurs de colonne : une saisie trop longue est coupée, elle
// ne fait pas échouer l'envoi.
export async function POST(request: Request) {
  const body = await readJsonBody(request);
  const name = clip(body.name, 200);
  const email = clip(body.email, 320);
  const message = clip(body.message, 5000);

  if (!name || !message) return apiError(request, "Nom et message obligatoires", 400);
  if (!EMAIL_RE.test(email)) return apiError(request, "Email invalide", 400);

  const created = await prisma.contactRequest.create({
    data: {
      name,
      email,
      message,
      company: clip(body.company, 200),
      phone: clip(body.phone, 60),
      project: clip(body.project, 100),
      budget: clip(body.budget, 60),
    },
    select: { id: true },
  });

  return apiJson(
    request,
    { ok: true, id: created.id },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

export async function OPTIONS(request: Request) {
  return apiPreflight(request, "POST");
}
