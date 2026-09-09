import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonBody } from "@/lib/admin-api";
import { peekToken } from "@/lib/tokens";
import { validatePassword } from "@/lib/password";

export const dynamic = "force-dynamic";

const BCRYPT_ROUNDS = 12;

// POST /api/auth/reset { token, password }
export async function POST(request: NextRequest) {
  const body = await jsonBody(request);
  const token = String(body.token ?? "");
  const password = String(body.password ?? "");

  // On valide le mot de passe AVANT de consommer le jeton : un mot de passe
  // refusé ne doit pas brûler le lien.
  const problem = validatePassword(password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const row = await peekToken(token, "RESET");
  if (!row) return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 400 });

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      // Réinitialiser vaut confirmation de l'adresse : le lien n'a pu être
      // reçu que dans la boîte concernée.
      data: { passwordHash, mustChangePassword: false, emailVerified: true },
    }),
    prisma.userToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
  ]);

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
