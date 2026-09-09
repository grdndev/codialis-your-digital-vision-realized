import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonBody } from "@/lib/admin-api";
import { consumeToken, peekToken } from "@/lib/tokens";
import { generatePassword, sendWelcomeEmail } from "@/lib/mail";

export const dynamic = "force-dynamic";

const BCRYPT_ROUNDS = 12;

// POST /api/auth/verify { token }
//
// Confirme l'adresse, engendre le mot de passe réel, l'envoie, puis seulement
// après met le compte à jour. Cet ordre est le point important : un compte créé
// démarre avec un hash inutilisable, et aucun identifiant ne quitte le serveur
// avant que l'adresse ne soit prouvée. Si l'envoi échoue, rien n'est modifié et
// le même lien reste utilisable.
export async function POST(request: NextRequest) {
  const body = await jsonBody(request);
  const token = String(body.token ?? "");

  const row = await peekToken(token, "VERIFY");
  if (!row) return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: row.userId },
    select: { id: true, name: true, email: true, role: true, emailVerified: true },
  });
  if (!user) return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 400 });

  // Déjà confirmé : on consomme le lien et on répond succès, sans réémettre un
  // mot de passe par-dessus un qui fonctionne.
  if (user.emailVerified) {
    await consumeToken(row.id);
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  const password = generatePassword();
  try {
    await sendWelcomeEmail({ name: user.name, email: user.email, password, role: user.role });
  } catch (err) {
    console.error("Envoi des identifiants en échec:", err);
    return NextResponse.json(
      { error: "Échec de l'envoi de l'e-mail — réessayez" },
      { status: 502 },
    );
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, emailVerified: true, mustChangePassword: true },
    }),
    prisma.userToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
  ]);

  return NextResponse.json({ ok: true, email: user.email });
}
