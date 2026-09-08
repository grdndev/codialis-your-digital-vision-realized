import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { signSessionToken } from "@/lib/auth";
import { jsonBody } from "@/lib/admin-api";

export const dynamic = "force-dynamic";

// POST /api/auth/login — seule route de l'API admin ouverte sans session.
// Renvoie le JWT dans le corps : c'est frontend-admin qui le range en cookie
// httpOnly sur son propre domaine (voir frontend-admin/src/lib/auth.ts).
export async function POST(request: NextRequest) {
  const body = await jsonBody(request);
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!email || !password) {
    return NextResponse.json(
      { error: "Renseignez votre e-mail et votre mot de passe." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // On compare toujours contre un hash, même sans compte trouvé : le temps de
  // réponse ne doit pas révéler si l'adresse existe.
  const hash = user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva";
  const ok = await bcrypt.compare(password, hash);
  if (!user || !ok) {
    return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
  }

  const token = await signSessionToken(user.id, user.role);
  return NextResponse.json({ token, role: user.role }, { headers: { "Cache-Control": "no-store" } });
}
