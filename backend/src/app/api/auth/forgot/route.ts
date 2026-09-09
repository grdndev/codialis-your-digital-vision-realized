import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonBody } from "@/lib/admin-api";
import { consumeToken, createToken, peekToken } from "@/lib/tokens";
import { sendResetEmail } from "@/lib/mail";
import { EMAIL_RE } from "@/lib/public-api";

export const dynamic = "force-dynamic";

// POST /api/auth/forgot { email }
//
// Répond TOUJOURS 200, quoi qu'il arrive : une réponse différente selon que
// l'adresse existe ou non transformerait cette route en énumérateur de comptes.
// L'absence d'e-mail reçu est le seul signal, et il n'est visible que par le
// propriétaire de la boîte.
export async function POST(request: NextRequest) {
  const body = await jsonBody(request);
  const email = String(body.email ?? "").trim().toLowerCase();

  if (EMAIL_RE.test(email)) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, emailVerified: true },
    });
    // Un compte non confirmé n'a pas encore de mot de passe réel : il n'y a
    // rien à réinitialiser, c'est le lien de confirmation qu'il lui faut.
    if (user?.emailVerified) {
      let token: string | null = null;
      try {
        token = await createToken(user.id, "RESET");
        await sendResetEmail({ name: user.name, email, token });
      } catch (err) {
        console.error("Envoi du lien de réinitialisation en échec:", err);
        // L'e-mail n'est pas parti : le jeton émis n'atteindra personne, on le
        // consomme pour ne pas laisser traîner un lien valide dont nul ne
        // dispose.
        if (token) {
          const row = await peekToken(token, "RESET");
          if (row) await consumeToken(row.id);
        }
      }
    }
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
