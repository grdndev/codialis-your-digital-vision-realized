import { extensionOf, isImageUrl } from "@/lib/attachments";
import type { UserRef } from "@/lib/dto";
import { authorInitials, authorName, fmtDate } from "@/lib/format";
import { Lightbox, LightboxTrigger } from "../../lightbox";
import type { TicketCommentRow, TicketDetailAttachmentRow } from "../types";

// Fil de la section « Commentaires » de la fiche ticket : les commentaires ET
// les pièces jointes, chacun à sa place dans le temps (CC-373). Les pièces
// restent aussi listées en tête de la section ; dans le fil, on voit quand et
// par qui elles ont été jointes, à côté de ce qu'on en a dit.

type Entry =
  | { kind: "comment"; comment: TicketCommentRow }
  | { kind: "files"; uploadedById: string | null; uploadedBy: UserRef | null; pieces: TicketDetailAttachmentRow[] };

// Plusieurs fichiers joints d'un coup (une sélection, un glisser-déposer, la
// création du ticket) font une seule entrée : même auteur, aucun commentaire
// entre eux, moins de dix minutes de l'un à l'autre. Au-delà, c'est un autre
// moment de la discussion.
const GROUP_WINDOW_MS = 10 * 60 * 1000;

function timeline(comments: TicketCommentRow[], attachments: TicketDetailAttachmentRow[]): Entry[] {
  const items = [
    ...comments.map((comment) => ({ at: comment.createdAt.getTime(), comment, piece: null })),
    ...attachments.map((piece) => ({ at: piece.createdAt.getTime(), comment: null, piece })),
  ].sort((a, b) => a.at - b.at);

  const entries: Entry[] = [];
  for (const { comment, piece } of items) {
    if (comment) {
      entries.push({ kind: "comment", comment });
      continue;
    }
    const last = entries.at(-1);
    if (
      last?.kind === "files" &&
      last.uploadedById === piece!.uploadedById &&
      piece!.createdAt.getTime() - last.pieces.at(-1)!.createdAt.getTime() < GROUP_WINDOW_MS
    ) {
      last.pieces.push(piece!);
      continue;
    }
    entries.push({ kind: "files", uploadedById: piece!.uploadedById, uploadedBy: piece!.uploadedBy, pieces: [piece!] });
  }
  return entries;
}

export function Thread({
  comments,
  attachments,
}: {
  comments: TicketCommentRow[];
  attachments: TicketDetailAttachmentRow[];
}) {
  const entries = timeline(comments, attachments);
  if (entries.length === 0) return <p className="text-sm text-muted">Aucun commentaire pour l’instant.</p>;

  // La visionneuse passe d'une image à l'autre de tout le ticket, dans l'ordre
  // où elles ont été jointes, comme celle de la liste en tête.
  const images = attachments.filter((f) => f.url && isImageUrl(f.url));
  const slideOf = new Map(images.map((f, i) => [f.id, i]));

  return (
    <Lightbox images={images.map((f) => ({ url: f.url!, title: f.filename }))}>
      {entries.map((entry) =>
        entry.kind === "comment" ? (
          <div key={entry.comment.id} className="flex gap-3">
            <Avatar>{authorInitials(entry.comment.author)}</Avatar>
            <div className="min-w-0">
              <p className="text-xs text-muted">
                <span className="font-medium text-text">{authorName(entry.comment.author)}</span> ·{" "}
                {fmtDate(entry.comment.createdAt)}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-text">{entry.comment.body}</p>
            </div>
          </div>
        ) : (
          <div key={entry.pieces[0].id} className="flex gap-3">
            {/* Sans auteur : une pièce d'avant CC-373, dont on ne sait pas
                qui l'a jointe, ou celle d'un compte supprimé. */}
            <Avatar>
              {entry.uploadedById ? (
                authorInitials(entry.uploadedBy)
              ) : (
                // Un trombone dessiné : un emoji manque à certaines polices.
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Pièce jointe">
                  <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              )}
            </Avatar>
            <div className="min-w-0">
              <p className="text-xs text-muted">
                {entry.uploadedById ? (
                  <>
                    <span className="font-medium text-text">{authorName(entry.uploadedBy)}</span> a joint{" "}
                    {entry.pieces.length > 1 ? `${entry.pieces.length} fichiers` : "un fichier"}
                  </>
                ) : entry.pieces.length > 1 ? (
                  `${entry.pieces.length} fichiers joints`
                ) : (
                  "Fichier joint"
                )}{" "}
                · {fmtDate(entry.pieces[0].createdAt)}
              </p>
              <div className="mt-1.5 flex flex-wrap items-start gap-2">
                {entry.pieces.map((f) =>
                  f.url && isImageUrl(f.url) ? (
                    <LightboxTrigger
                      key={f.id}
                      index={slideOf.get(f.id)!}
                      label={`Agrandir ${f.filename}`}
                      className="block cursor-zoom-in overflow-hidden rounded-lg border border-border transition hover:ring-2 hover:ring-mint/50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- domaine externe, pas d'optimisation Next */}
                      <img src={f.url} alt={f.filename} title={`${f.filename} · ${f.meta}`} className="h-16 w-24 object-cover" />
                    </LightboxTrigger>
                  ) : (
                    <div
                      key={f.id}
                      className="flex max-w-full items-center gap-2 rounded-lg border border-border bg-panel-2 px-2.5 py-1.5 text-sm"
                    >
                      <span className="flex h-6 w-8 shrink-0 items-center justify-center rounded bg-white/5 text-[10px] font-semibold uppercase text-muted">
                        {extensionOf(f.filename) || "—"}
                      </span>
                      {f.url ? (
                        <a href={f.url} target="_blank" rel="noreferrer" className="min-w-0 truncate text-text hover:text-mint">
                          {f.filename}
                        </a>
                      ) : (
                        <span className="min-w-0 truncate text-muted">{f.filename}</span>
                      )}
                      <span className="shrink-0 text-xs text-muted">{f.meta}</span>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        ),
      )}
    </Lightbox>
  );
}

function Avatar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mint/15 text-xs font-medium text-mint">
      {children}
    </div>
  );
}
