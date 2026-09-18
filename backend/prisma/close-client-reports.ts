import { writeFileSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

// Bascule des remontées client en tickets ordinaires terminés.
//
// Les remontées ne sont pas un objet à part : ce sont déjà des tickets, sur
// leur projet, marqués `clientReported` et rangés dans une file de triage.
// L'opération les en sort définitivement — statut « Terminé », état de triage
// « Clos », marqueur retiré.
//
// ATTENTION : retirer `clientReported` vide aussi l'écran « Bugs » du PORTAIL
// CLIENT, qui liste ce que le client a signalé (api/admin/client/bugs). D'où la
// sauvegarde, et la restauration qui la rejoue.
//
//   npx tsx prisma/close-client-reports.ts --dry-run
//   npx tsx prisma/close-client-reports.ts --backup=/chemin/avant.json
//   npx tsx prisma/close-client-reports.ts --restore=/chemin/avant.json

const prisma = new PrismaClient();

type Snapshot = {
  id: string;
  ref: string;
  status: string;
  triageState: string;
  clientReported: boolean;
};

async function restore(path: string) {
  const rows: Snapshot[] = JSON.parse(readFileSync(path, "utf8"));
  for (const row of rows) {
    await prisma.ticket.update({
      where: { id: row.id },
      data: {
        status: row.status as never,
        triageState: row.triageState as never,
        clientReported: row.clientReported,
      },
    });
  }
  console.log(`${rows.length} tickets remis dans l'état de ${path}.`);
}

async function main() {
  const args = process.argv.slice(2);
  const restorePath = args.find((a) => a.startsWith("--restore="))?.split("=")[1];
  if (restorePath) return restore(restorePath);

  const dryRun = args.includes("--dry-run");
  const backupPath = args.find((a) => a.startsWith("--backup="))?.split("=")[1];

  const tickets = await prisma.ticket.findMany({
    where: { clientReported: true },
    select: {
      id: true,
      ref: true,
      status: true,
      triageState: true,
      clientReported: true,
      project: { select: { name: true } },
    },
    orderBy: { ref: "asc" },
  });

  const byStatus = new Map<string, number>();
  const byProject = new Map<string, number>();
  for (const t of tickets) {
    byStatus.set(t.status, (byStatus.get(t.status) ?? 0) + 1);
    byProject.set(t.project.name, (byProject.get(t.project.name) ?? 0) + 1);
  }

  console.log(`${tickets.length} remontées client.`);
  console.log("  statuts :", [...byStatus].map(([k, v]) => `${k} ${v}`).join("  "));
  console.log("  projets :", [...byProject].map(([k, v]) => `${k} ${v}`).join("  "));
  const open = tickets.filter((t) => t.status !== "TERMINE");
  if (open.length) {
    console.log(`  ${open.length} pas encore terminées : ${open.map((t) => `${t.ref}(${t.status})`).join(" ")}`);
  }

  if (backupPath) {
    const snapshot: Snapshot[] = tickets.map(({ id, ref, status, triageState, clientReported }) => ({
      id,
      ref,
      status,
      triageState,
      clientReported,
    }));
    writeFileSync(backupPath, JSON.stringify(snapshot, null, 2));
    console.log(`Sauvegarde écrite dans ${backupPath}.`);
  }

  if (dryRun) {
    console.log("--dry-run : rien n'a été modifié.");
    return;
  }
  if (!backupPath) {
    throw new Error("Refus d'écrire sans --backup= : l'opération n'est pas réversible sans.");
  }

  const result = await prisma.ticket.updateMany({
    where: { clientReported: true },
    data: { status: "TERMINE", triageState: "CLOS", clientReported: false },
  });
  console.log(`${result.count} tickets terminés, sortis du triage, marqueur retiré.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
