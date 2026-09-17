import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Jeu d'essai pour la vérification locale : un compte par rôle, un client, deux
// projets, des lots, des tâches et des tickets. Rien de tout cela ne part en
// production — le script vise une base de test jetable, qu'il vide d'abord.
//
//   DATABASE_URL=... npx tsx prisma/seed-test.ts
//
// Mot de passe commun : Test1234!

const prisma = new PrismaClient();

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error("Ce script ne s'exécute que sur une base locale.");
  }

  await prisma.workSession.deleteMany();
  await prisma.workSchedule.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.ticketCriterion.deleteMany();
  await prisma.ticketComment.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.taskCriterion.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.epic.deleteMany();
  await prisma.projectAssignment.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("Test1234!", 10);
  const mk = (email: string, name: string, initials: string, role: "DIR" | "PM" | "DEV") =>
    prisma.user.create({
      data: { email, name, initials, role, passwordHash, mustChangePassword: false },
    });

  const dir = await mk("dir@t.fr", "Diane Direction", "DD", "DIR");
  const pm = await mk("pm@t.fr", "Paul Chefdeprojet", "PC", "PM");
  const dev = await mk("dev@t.fr", "Dora Développeuse", "DD", "DEV");
  const dev2 = await mk("dev2@t.fr", "Denis Développeur", "DE", "DEV");

  const client = await prisma.client.create({ data: { name: "Client Test" } });

  const alpha = await prisma.project.create({
    data: {
      clientId: client.id,
      name: "Projet Alpha",
      initials: "ALP",
      description: "Projet de test",
      group: "DEV",
      phaseLabel: "Développement",
      hoursSold: 100,
      hoursSpent: 0,
      progressPct: 0,
      openedAt: new Date(),
      soldAmount: 20000,
    },
  });
  const beta = await prisma.project.create({
    data: {
      clientId: client.id,
      name: "Projet Beta",
      initials: "BET",
      description: "Projet de test",
      group: "DEV",
      phaseLabel: "Cadrage",
      hoursSold: 40,
      hoursSpent: 0,
      progressPct: 0,
      openedAt: new Date(),
      soldAmount: 8000,
    },
  });

  // Dora est affectée à Alpha seulement : c'est ce qui permet de vérifier le
  // cloisonnement des développeurs.
  await prisma.projectAssignment.create({ data: { projectId: alpha.id, userId: dev.id } });

  // Chaque développeur n'a du travail que sur UN projet : c'est ce qui rend
  // vérifiable le cloisonnement — Dora sur Alpha, Denis sur Beta, et personne
  // ne doit voir le projet de l'autre.
  for (const project of [alpha, beta]) {
    const onAlpha = project.id === alpha.id;
    const worker = onAlpha ? dev : dev2;

    const epic = await prisma.epic.create({
      data: { projectId: project.id, title: `Lot ${project.initials}`, estHours: 12, order: 0 },
    });
    for (let i = 1; i <= 3; i++) {
      await prisma.task.create({
        data: {
          epicId: epic.id,
          title: `${project.initials} — tâche ${i}`,
          description: "Description de test",
          estHours: 4,
          assigneeId: i === 1 ? worker.id : null,
          order: i,
        },
      });
    }
    for (let i = 1; i <= 2; i++) {
      await prisma.ticket.create({
        data: {
          ref: `${project.initials}-${300 + i}`,
          projectId: project.id,
          type: i === 1 ? "BUG" : "DEV",
          severity: i === 1 ? "MAJEUR" : null,
          devNature: i === 2 ? "FRONT" : null,
          title: `${project.initials} — ticket ${i}`,
          description: "Description de test",
          steps: "1. Ouvrir\n2. Cliquer",
          estHours: 2,
          assigneeId: i === 1 ? worker.id : null,
          creatorId: pm.id,
        },
      });
    }
  }

  console.log("Jeu d'essai prêt : dir@t.fr, pm@t.fr, dev@t.fr, dev2@t.fr — Test1234!");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
