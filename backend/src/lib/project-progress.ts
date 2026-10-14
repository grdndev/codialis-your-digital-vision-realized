import "server-only";
import { prisma } from "@/lib/prisma";

// `Project.progressPct` est une colonne stockée, relue directement par le
// dashboard, la liste des projets et le portail client — pas un calcul fait à
// chaque lecture. Il faut donc la rafraîchir dès qu'un ticket apparaît, change
// d'état, change de projet ou disparaît. Elle compte TOUS les tickets du
// projet, dans un épic ou non (arbitrage du 14/10, CC-365). Un projet sans
// ticket garde sa valeur : une liste vide n'est pas la preuve d'un avancement
// nul, seulement de ce qui n'est pas suivi à ce niveau de détail.
export async function recomputeProjectProgress(projectId: string) {
  const tickets = await prisma.ticket.findMany({
    where: { projectId },
    select: { status: true },
  });
  if (tickets.length === 0) return;
  const done = tickets.filter((t) => t.status === "TERMINE").length;
  await prisma.project.update({
    where: { id: projectId },
    data: { progressPct: Math.round((done / tickets.length) * 100) },
  });
}
