import "server-only";
import { prisma } from "@/lib/prisma";

// Le projet auquel un compte client est affecté.
//
// Toutes les routes du portail passent par ici : le périmètre d'un client est
// déduit de SA session, jamais d'un identifiant de projet transmis dans la
// requête. C'est ce qui garantit qu'un client ne peut pas lire le projet d'un
// autre en changeant un paramètre.
export async function clientProjectId(userId: string): Promise<string | null> {
  const assignment = await prisma.projectAssignment.findFirst({
    where: { userId },
    orderBy: { id: "asc" },
    select: { projectId: true },
  });
  return assignment?.projectId ?? null;
}
