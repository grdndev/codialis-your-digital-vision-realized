import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyUnsubscribe } from "@/lib/tokens";

export const dynamic = "force-dynamic";

// GET /api/newsletter/unsubscribe?email=&token= — PUBLIQUE.
//
// Le lien est cliqué directement depuis la newsletter : le navigateur atterrit
// ici, la route rend donc sa propre page HTML plutôt que du JSON.
//
// Le jeton est un HMAC de l'adresse (voir src/lib/tokens.ts) : sans état à
// stocker, et infalsifiable sans le secret. Aucune requête n'est donc nécessaire
// pour décider si la demande est légitime.

function page(status: number, title: string, message: string): Response {
  return new Response(
    `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>${title} — Codialis</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"></head>
<body style="margin:0;padding:0;background:#08111e;color:#eaf0f7;font-family:Arial,Helvetica,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh">
<div style="max-width:420px;padding:40px 32px;text-align:center">
  <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
  <p style="font-size:14px;color:#a6b3c6;line-height:1.6;margin:0">${message}</p>
</div></body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const email = (params.get("email") ?? "").trim().toLowerCase();
  const token = params.get("token") ?? "";

  if (!verifyUnsubscribe(email, token)) {
    return page(
      400,
      "Lien invalide",
      "Ce lien de désinscription n'est plus valide.",
    );
  }

  await prisma.newsletterSubscriber.deleteMany({ where: { email } });
  return page(
    200,
    "Désinscription confirmée",
    `${email} a bien été retiré de la newsletter Codialis.`,
  );
}
