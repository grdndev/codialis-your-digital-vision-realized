import "server-only";
import { prisma } from "@/lib/prisma";
import { refNumber } from "@/lib/refs";

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

// Les épics du projet et leurs tickets, pour les écrans « Avancement » et
// « Fonctionnalités » du portail. Le client ne voit d'un ticket que son
// intitulé, sa description et son état : ni assigné, ni temps, ni estimation.
// Les tickets suivent l'ordre de leur numérotation, celui des anciennes
// tâches (CC-365). Un ticket ANNULÉ n'y figure pas (CC-372) : c'est une
// décision interne, le client n'a pas à voir ce qu'on a écarté.
export async function portalEpics(projectId: string) {
  const epics = await prisma.epic.findMany({
    where: { projectId },
    orderBy: { order: "asc" },
    include: {
      tickets: {
        where: { status: { not: "ANNULE" } },
        select: { id: true, ref: true, title: true, description: true, status: true, updatedAt: true },
      },
    },
  });
  return epics.map((e) => ({
    ...e,
    tickets: [...e.tickets].sort((a, b) => refNumber(a.ref) - refNumber(b.ref)),
  }));
}
