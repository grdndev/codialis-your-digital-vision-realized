import { z } from "zod";
import { adminRoute, badRequest, notFound } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import {
  TAILLE_MAX_OCTETS,
  envoyerImage,
  extensionAcceptee,
  extensionDe,
  filesConfigured,
  supprimerFichier,
  urlPublique,
} from "@/lib/files";

export const dynamic = "force-dynamic";

// Pièces jointes des tickets et des tâches.
//
// Route à part des mutations d'écran (CONV `mutations_api`) parce qu'elle ne
// transporte pas du JSON : le corps est le FICHIER lui-même, brut. Le nom et la
// cible passent donc en paramètres d'adresse.
//
//   POST   /api/admin/attachments?kind=ticket&id=…&filename=capture.png
//   DELETE /api/admin/attachments?attachmentId=…
//
// Le fichier part vers codialis.files, dont seul le backend connaît le port
// privé et le jeton ; la base ne garde que l'identifiant rendu.

const cibleSchema = z.object({
  kind: z.enum(["ticket", "task"]),
  id: z.string().min(1),
  filename: z.string().min(1).max(255),
});

// Un octet reste un octet : on affiche des kilo-octets, pas des kibi-octets,
// parce que c'est ce que montre l'explorateur de fichiers de la personne.
function libelleTaille(octets: number): string {
  if (octets < 1000) return `${octets} o`;
  if (octets < 1000 * 1000) return `${Math.round(octets / 1000)} Ko`;
  return `${(octets / (1000 * 1000)).toFixed(1).replace(".", ",")} Mo`;
}

export const POST = adminRoute(["DEV", "PM", "DIR"], async (_ctx, request) => {
  if (!filesConfigured()) badRequest("Le stockage de fichiers n'est pas configuré");

  const params = request.nextUrl.searchParams;
  const parsed = cibleSchema.safeParse({
    kind: params.get("kind"),
    id: params.get("id"),
    filename: params.get("filename"),
  });
  if (!parsed.success) badRequest("Destination ou nom de fichier manquant");
  const { kind, id, filename } = parsed.data;

  const extension = extensionDe(filename);
  if (!extensionAcceptee(extension)) {
    badRequest("Seules les images sont acceptées (png, jpg, webp, gif, avif)");
  }

  // La cible est vérifiée AVANT d'envoyer le fichier : sinon un mauvais
  // identifiant laisserait un fichier stocké que plus rien ne référence.
  const cibleExiste =
    kind === "ticket"
      ? await prisma.ticket.findUnique({ where: { id }, select: { id: true } })
      : await prisma.task.findUnique({ where: { id }, select: { id: true } });
  if (!cibleExiste) notFound(kind === "ticket" ? "Ticket introuvable" : "Tâche introuvable");

  const contenu = await request.arrayBuffer();
  if (contenu.byteLength === 0) badRequest("Le fichier est vide");
  if (contenu.byteLength > TAILLE_MAX_OCTETS) badRequest("Fichier trop lourd (25 Mo maximum)");

  let fileId: string;
  try {
    fileId = await envoyerImage(extension, contenu);
  } catch (err) {
    console.error("Envoi vers codialis.files en échec:", err);
    badRequest(err instanceof Error ? err.message : "Le stockage du fichier a échoué");
  }

  const donnees = { filename, fileId, meta: libelleTaille(contenu.byteLength) };
  try {
    const cree =
      kind === "ticket"
        ? await prisma.ticketAttachment.create({ data: { ticketId: id, ...donnees } })
        : await prisma.taskAttachment.create({ data: { taskId: id, ...donnees } });
    return { id: cree.id, fileId, filename, meta: donnees.meta, url: urlPublique(fileId) };
  } catch (err) {
    // La ligne n'a pas pu être écrite : on reprend le fichier, sinon il reste
    // dans le volume sans que rien ne pointe dessus.
    await supprimerFichier(fileId);
    throw err;
  }
});

const suppressionSchema = z.object({ attachmentId: z.string().min(1) });

export const DELETE = adminRoute(["DEV", "PM", "DIR"], async (_ctx, request) => {
  const parsed = suppressionSchema.safeParse({
    attachmentId: request.nextUrl.searchParams.get("attachmentId"),
  });
  if (!parsed.success) badRequest("Pièce jointe non désignée");
  const { attachmentId } = parsed.data;

  // On ne sait pas de quel côté elle vit : on cherche des deux.
  const surTicket = await prisma.ticketAttachment.findUnique({ where: { id: attachmentId } });
  const surTache = surTicket
    ? null
    : await prisma.taskAttachment.findUnique({ where: { id: attachmentId } });
  const piece = surTicket ?? surTache;
  if (!piece) notFound("Pièce jointe introuvable");

  if (surTicket) await prisma.ticketAttachment.delete({ where: { id: attachmentId } });
  else await prisma.taskAttachment.delete({ where: { id: attachmentId } });

  // Après la base, jamais avant : un fichier effacé alors que la ligne reste
  // laisserait une pièce jointe morte à l'écran.
  if (piece.fileId) await supprimerFichier(piece.fileId);

  return;
});
