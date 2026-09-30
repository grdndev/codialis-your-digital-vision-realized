import { z } from "zod";
import { adminRoute, badRequest, jsonBody, notFound } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { maxSuffix, withUniqueRef } from "@/lib/refs";
import { PLAN_PRESETS, isValidPlan, milestoneName, nextMilestone, parsePlan } from "@/lib/billing";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// Écran « Facturation & rentabilité ».
//
// `activeProjects` ne garde que les projets dont le montant vendu ET le coût
// sont renseignés : l'écran calcule une marge dessus, un null y produirait NaN.
//
// `billing` est l'échéancier de chaque projet ouvert (CC-350) : prix total,
// pourcentages, déjà facturé, et la prochaine échéance toute calculée — c'est
// l'API qui en fixe le montant, l'écran ne fait que l'annoncer.

// Référence de facture suivante : au-delà du plus grand numéro déjà attribué.
async function nextInvoiceRef() {
  const refs = await prisma.invoice.findMany({ select: { ref: true } });
  const max = maxSuffix(
    refs.map((r) => r.ref),
    "F-",
  );
  return `F-${(max ?? 2600) + 1}`;
}

export const GET = adminRoute(["PM", "DIR"], async () => {
  const [invoices, activeProjects, projects] = await Promise.all([
    prisma.invoice.findMany({
      include: {
        project: { include: { client: true } },
        comments: {
          include: { author: { select: { id: true, name: true, initials: true, role: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { issuedAt: "desc" },
    }),
    prisma.project.findMany({
      where: {
        group: "DEV",
        soldAmount: { not: null },
        costAmount: { not: null },
      },
      include: { client: true },
      orderBy: { soldAmount: "desc" },
    }),
    prisma.project.findMany({
      where: { group: { not: "CLO" } },
      include: { client: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const billing = projects.map((p) => {
    const own = invoices.filter((i) => i.projectId === p.id);
    const plan = parsePlan(p.billingPlan);
    return {
      projectId: p.id,
      total: p.soldAmount,
      plan: plan.join(","),
      steps: plan.map((pct, index) => ({ index, name: milestoneName(index, plan.length), pct })),
      // Ce que l'échéancier a déjà facturé, et à côté les factures libres
      // (avenants), qui s'ajoutent au prix sans entrer dans son découpage.
      planInvoiced: own.filter((i) => i.milestone !== null).reduce((s, i) => s + i.amount, 0),
      extraInvoiced: own.filter((i) => i.milestone === null).reduce((s, i) => s + i.amount, 0),
      next: nextMilestone(p.soldAmount, plan, own),
    };
  });
  return { invoices, activeProjects, projects, billing, planPresets: PLAN_PRESETS };
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create-invoice"),
    projectId: z.string().min(1),
    label: z.string().min(1),
    amount: z.number().positive(),
    dueAt: z.string().datetime().nullable(),
  }),
  // La facture de l'échéance suivante du projet (CC-350) : ni libellé ni
  // montant dans la requête, c'est l'échéancier qui les donne.
  z.object({
    action: z.literal("create-milestone-invoice"),
    projectId: z.string().min(1),
    dueAt: z.string().datetime().nullable(),
  }),
  // Prix total et échéancier d'un projet. Le prix est le `soldAmount` déjà
  // saisi dans la fiche projet : un seul chiffre, lu par la rentabilité comme
  // par la facturation.
  z.object({
    action: z.literal("update-project-billing"),
    projectId: z.string().min(1),
    total: z.number().positive().nullable(),
    plan: z.string().max(20),
  }),
  z.object({
    action: z.literal("mark-paid"),
    invoiceId: z.string().min(1),
  }),
  // « En retard » se pose à la main : c'est la personne qui relance le client
  // qui sait si l'échéance dépassée est un retard ou un délai convenu (CC-348).
  // « Payée » garde son action, qui date aussi le règlement.
  z.object({
    action: z.literal("set-invoice-status"),
    invoiceId: z.string().min(1),
    status: z.enum(["EN_ATTENTE", "EN_RETARD"]),
  }),
  // Une facture se corrige TANT QU'ELLE N'EST PAS PAYÉE. Une fois réglée, c'est
  // une pièce comptable : on la rectifie par un avoir, pas en réécrivant le
  // montant. La référence, elle, ne bouge jamais — c'est par elle que le client
  // et la comptabilité la désignent.
  z.object({
    action: z.literal("update-invoice"),
    invoiceId: z.string().min(1),
    label: z.string().min(1).max(200),
    amount: z.number().positive(),
    dueAt: z.string().datetime().nullable(),
  }),
  z.object({ action: z.literal("delete-invoice"), invoiceId: z.string().min(1) }),
  // Rattacher une facture à une échéance du projet, ou l'en détacher (CC-350).
  // Permis sur une facture payée : ni le montant ni le libellé ne bougent, on
  // dit seulement quelle part du prix elle a réglée. C'est ce qui permet de
  // reprendre les factures émises avant l'échéancier.
  z.object({
    action: z.literal("set-invoice-milestone"),
    invoiceId: z.string().min(1),
    milestone: z.number().int().min(0).nullable(),
  }),
  // L'historique reste ouvert sur une facture payée : c'est souvent là qu'on
  // note comment et quand elle a été réglée.
  z.object({
    action: z.literal("add-invoice-comment"),
    invoiceId: z.string().min(1),
    body: z.string().trim().min(1),
  }),
]);

export const POST = adminRoute(["PM", "DIR"], async ({ user }, request) => {
  const parsed = bodySchema.safeParse(await jsonBody(request));
  if (!parsed.success) badRequest("Requête invalide");
  const body = parsed.data;

  if (body.action === "update-project-billing") {
    const plan = body.plan.split(",").map((p) => Number(p.trim()));
    if (!isValidPlan(plan)) {
      badRequest("Échéancier invalide : de 2 à 4 pourcentages entiers qui font 100 %");
    }
    await prisma.project.update({
      where: { id: body.projectId },
      data: { soldAmount: body.total, billingPlan: plan.join(",") },
    });
    return;
  }

  if (body.action === "create-milestone-invoice") {
    const project = await prisma.project.findUnique({
      where: { id: body.projectId },
      select: { soldAmount: true, billingPlan: true, invoices: { select: { milestone: true, amount: true } } },
    });
    if (!project) notFound("Projet introuvable");
    const next = nextMilestone(project.soldAmount, parsePlan(project.billingPlan), project.invoices);
    if (next.status === "no-total") badRequest("Renseignez d'abord le prix total du projet");
    if (next.status === "done") badRequest("Toutes les échéances de ce projet sont déjà facturées");
    // Le solde est ce qui reste à facturer : des échéances précédentes
    // corrigées à la hausse peuvent l'avoir déjà couvert.
    if (next.amount <= 0) {
      badRequest("Plus rien à facturer : les échéances précédentes couvrent déjà le prix total");
    }
    try {
      const invoice = await withUniqueRef(nextInvoiceRef, (ref) =>
        prisma.invoice.create({
          data: {
            ref,
            projectId: body.projectId,
            label: next.label,
            amount: next.amount,
            milestone: next.index,
            issuedAt: new Date(),
            dueAt: body.dueAt ? new Date(body.dueAt) : null,
            status: "EN_ATTENTE",
          },
          select: { ref: true },
        }),
      );
      return { ok: true, ref: invoice.ref, label: next.label, amount: next.amount };
    } catch (err) {
      // Deux créations simultanées de la même échéance — un double clic : la
      // seconde se heurte à l'index unique (projet, échéance).
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        String(err.meta?.target ?? "").includes("milestone")
      ) {
        badRequest("Cette échéance vient d'être facturée");
      }
      throw err;
    }
  }

  if (body.action === "create-invoice") {
    await withUniqueRef(nextInvoiceRef, (ref) =>
      prisma.invoice.create({
        data: {
          ref,
          projectId: body.projectId,
          label: body.label,
          amount: body.amount,
          issuedAt: new Date(),
          dueAt: body.dueAt ? new Date(body.dueAt) : null,
          status: "EN_ATTENTE",
        },
      }),
    );
    return;
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: body.invoiceId },
    select: { status: true, projectId: true, project: { select: { billingPlan: true } } },
  });
  if (!invoice) notFound("Facture introuvable");

  if (body.action === "set-invoice-milestone") {
    if (body.milestone !== null && body.milestone >= parsePlan(invoice.project.billingPlan).length) {
      badRequest("Cette échéance n'existe pas dans l'échéancier du projet");
    }
    try {
      await prisma.invoice.update({ where: { id: body.invoiceId }, data: { milestone: body.milestone } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        badRequest("Une autre facture règle déjà cette échéance");
      }
      throw err;
    }
    return;
  }

  if (body.action === "add-invoice-comment") {
    await prisma.invoiceComment.create({
      data: { invoiceId: body.invoiceId, authorId: user.id, body: body.body },
    });
    return;
  }

  if (body.action === "update-invoice" || body.action === "delete-invoice") {
    if (invoice.status === "PAYEE") {
      badRequest("Une facture payée ne se modifie plus : passez par un avoir");
    }
  }

  if (body.action === "set-invoice-status") {
    if (invoice.status === "PAYEE") badRequest("Une facture payée ne change plus de statut");
    await prisma.invoice.update({ where: { id: body.invoiceId }, data: { status: body.status } });
    return;
  }

  if (body.action === "update-invoice") {
    await prisma.invoice.update({
      where: { id: body.invoiceId },
      data: {
        label: body.label.trim(),
        amount: body.amount,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
      },
    });
    return;
  }

  if (body.action === "delete-invoice") {
    await prisma.invoice.delete({ where: { id: body.invoiceId } });
    return;
  }

  await prisma.invoice.update({
    where: { id: body.invoiceId },
    data: { status: "PAYEE", paidAt: new Date() },
  });
});
