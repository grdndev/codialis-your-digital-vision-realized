import { z } from "zod";
import { adminRoute, badRequest, jsonBody, notFound } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { maxSuffix, withUniqueRef } from "@/lib/refs";

export const dynamic = "force-dynamic";

// Écran « Facturation & rentabilité ».
//
// `activeProjects` ne garde que les projets dont le montant vendu ET le coût
// sont renseignés : l'écran calcule une marge dessus, un null y produirait NaN.

export const GET = adminRoute(["PM", "DIR"], async () => {
  const [invoices, activeProjects, projects] = await Promise.all([
    prisma.invoice.findMany({
      include: { project: { include: { client: true } } },
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
  return { invoices, activeProjects, projects };
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create-invoice"),
    projectId: z.string().min(1),
    label: z.string().min(1),
    amount: z.number().positive(),
    dueAt: z.string().datetime().nullable(),
  }),
  z.object({
    action: z.literal("mark-paid"),
    invoiceId: z.string().min(1),
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
]);

export const POST = adminRoute(["PM", "DIR"], async (_ctx, request) => {
  const parsed = bodySchema.safeParse(await jsonBody(request));
  if (!parsed.success) badRequest("Requête invalide");
  const body = parsed.data;

  if (body.action === "create-invoice") {
    // La référence reprend au-delà du plus grand numéro déjà attribué.
    const nextRef = async () => {
      const refs = await prisma.invoice.findMany({ select: { ref: true } });
      const max = maxSuffix(
        refs.map((r) => r.ref),
        "F-",
      );
      return `F-${(max ?? 2600) + 1}`;
    };
    await withUniqueRef(nextRef, (ref) =>
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
    select: { status: true },
  });
  if (!invoice) notFound("Facture introuvable");

  if (body.action === "update-invoice" || body.action === "delete-invoice") {
    if (invoice.status === "PAYEE") {
      badRequest("Une facture payée ne se modifie plus : passez par un avoir");
    }
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
