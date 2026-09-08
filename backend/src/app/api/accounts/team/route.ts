import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PUBLIC_CACHE, apiJson, apiPreflight } from "@/lib/public-api";

export const dynamic = "force-dynamic";

// Section « équipe » de la page d'accueil. TOUTE l'équipe est publiée, direction
// comprise : il n'y a pas de sélection « à la une ». Les comptes CLIENT sont
// évidemment exclus — ce ne sont pas des membres de l'agence.
const TEAM_ROLES: Role[] = ["DIR", "PM", "DEV"];

// Ordre d'affichage : direction, puis cheffes de projet, puis développeurs.
const TEAM_RANK: Record<string, number> = { DIR: 0, PM: 1, DEV: 2 };

// Seuls les champs d'affichage sortent — jamais l'email ni le rôle applicatif.
// `role` porte l'intitulé de poste (c'est le libellé que le site rend sous le
// nom) et `image` la photo ; le site calcule lui-même les initiales et la
// couleur d'avatar à partir du nom.
export async function GET(request: Request) {
  const members = await prisma.user.findMany({
    where: { role: { in: TEAM_ROLES } },
    select: { id: true, name: true, role: true, jobTitle: true, photo: true },
    orderBy: { name: "asc" },
  });

  // Tri stable : l'ordre alphabétique est conservé à l'intérieur de chaque rôle.
  members.sort((a, b) => (TEAM_RANK[a.role] ?? 3) - (TEAM_RANK[b.role] ?? 3));

  return apiJson(
    request,
    members.map((m) => ({
      id: m.id,
      name: m.name,
      role: m.jobTitle ?? "",
      image: m.photo ?? "",
    })),
    { headers: { "Cache-Control": PUBLIC_CACHE } },
  );
}

export async function OPTIONS(request: Request) {
  return apiPreflight(request, "GET");
}
