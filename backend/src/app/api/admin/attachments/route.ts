import { z } from "zod";
import { adminRoute, badRequest, notFound, parseQuery } from "@/lib/admin-api";
import { TICKET_ID_DESCRIPTION, ticketIdOf } from "@/lib/ticket-ref";
import { prisma } from "@/lib/prisma";
import {
  TAILLE_MAX_OCTETS,
  envoyerFichier,
  extensionAcceptee,
  extensionDe,
  filesConfigured,
  supprimerFichier,
  urlPublique,
} from "@/lib/files";

export const dynamic = "force-dynamic";

// Pièces jointes des tickets.
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

// `kind` ne vaut plus que `ticket` : les tâches sont devenues des tickets
// (CC-365). Il reste dans l'adresse pour qu'une autre cible puisse s'ajouter
// sans changer le contrat.
const cibleSchema = z.object({
  kind: z.enum(["ticket"]).default("ticket"),
  id: z.string().min(1).describe(TICKET_ID_DESCRIPTION),
  filename: z
    .string()
    .min(1)
    .max(255)
    .describe("Nom affiché ; son extension décide du type accepté (images, pdf, txt, csv, docx, xlsx, pptx, odt, ods, zip)"),
});

// Un octet reste un octet : on affiche des kilo-octets, pas des kibi-octets,
// parce que c'est ce que montre l'explorateur de fichiers de la personne.
function libelleTaille(octets: number): string {
  if (octets < 1000) return `${octets} o`;
  if (octets < 1000 * 1000) return `${Math.round(octets / 1000)} Ko`;
  return `${(octets / (1000 * 1000)).toFixed(1).replace(".", ",")} Mo`;
}

export const POST = adminRoute(["DEV", "PM", "DIR"], async ({ user }, request) => {
  if (!filesConfigured()) badRequest("Le stockage de fichiers n'est pas configuré");

  const cible = parseQuery(cibleSchema, request, "Destination ou nom de fichier manquant");
  const { filename } = cible;

  const extension = extensionDe(filename);
  if (!extensionAcceptee(extension)) {
    badRequest(
      `Type « ${extension || "sans extension"} » refusé. Acceptés : images (png, jpg, webp, gif, avif), pdf, txt, csv, docx, xlsx, pptx, odt, ods, zip`,
    );
  }

  // La cible est vérifiée AVANT d'envoyer le fichier : sinon un mauvais
  // identifiant laisserait un fichier stocké que plus rien ne référence.
  const id = await ticketIdOf(cible.id);
  const cibleExiste = await prisma.ticket.findUnique({ where: { id }, select: { id: true } });
  if (!cibleExiste) notFound("Ticket introuvable");

  const contenu = await request.arrayBuffer();
  if (contenu.byteLength === 0) badRequest("Le fichier est vide");
  if (contenu.byteLength > TAILLE_MAX_OCTETS) badRequest("Fichier trop lourd (25 Mo maximum)");

  let fileId: string;
  try {
    fileId = await envoyerFichier(extension, contenu);
  } catch (err) {
    console.error("Envoi vers codialis.files en échec:", err);
    badRequest(err instanceof Error ? err.message : "Le stockage du fichier a échoué");
  }

  // L'auteur fait apparaître la pièce dans le fil des commentaires, à son nom
  // (CC-373) ; un jeton d'API joint au nom de son propriétaire.
  const donnees = { filename, fileId, meta: libelleTaille(contenu.byteLength), uploadedById: user.id };
  try {
    const cree = await prisma.ticketAttachment.create({ data: { ticketId: id, ...donnees } });
    return { id: cree.id, fileId, filename, meta: donnees.meta, url: urlPublique(fileId) };
  } catch (err) {
    // La ligne n'a pas pu être écrite : on reprend le fichier, sinon il reste
    // dans le volume sans que rien ne pointe dessus.
    await supprimerFichier(fileId);
    throw err;
  }
}, {
  summary:
    "Joint un fichier à un ticket. Le corps est le FICHIER BRUT (`Content-Type: application/octet-stream`, 25 Mo au plus), la destination et le nom passent dans l'adresse. Renvoie l'identifiant de la pièce et son `url` publique.",
  query: cibleSchema,
  rawBody: true,
});

const suppressionSchema = z.object({ attachmentId: z.string().min(1) });

export const DELETE = adminRoute(["DEV", "PM", "DIR"], async (_ctx, request) => {
  const { attachmentId } = parseQuery(suppressionSchema, request, "Pièce jointe non désignée");

  const piece = await prisma.ticketAttachment.findUnique({ where: { id: attachmentId } });
  if (!piece) notFound("Pièce jointe introuvable");
  await prisma.ticketAttachment.delete({ where: { id: attachmentId } });

  // Après la base, jamais avant : un fichier effacé alors que la ligne reste
  // laisserait une pièce jointe morte à l'écran.
  if (piece.fileId) await supprimerFichier(piece.fileId);

  return;
}, {
  summary: "Retire une pièce jointe d'un ticket et efface le fichier stocké.",
  query: suppressionSchema,
});
