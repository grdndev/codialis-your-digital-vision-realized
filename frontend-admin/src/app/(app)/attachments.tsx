// Pièces jointes de la fiche ticket, listées en tête des commentaires. La fiche
// tâche, qui avait son propre bloc, n'existe plus (CC-365).
//
// Les fichiers sont servis par codialis.files sur son propre domaine, donc
// directement par le navigateur : ils ne transitent pas par ce serveur. Une
// image s'ouvre dans la visionneuse, qui passe d'une image à l'autre de la même
// fiche ; un document s'ouvre (PDF) ou se télécharge (le reste) depuis le
// stockage.

import { extensionOf, isImageUrl } from "@/lib/attachments";
import { Lightbox, LightboxTrigger } from "./lightbox";

type Piece = {
  id: string;
  filename: string;
  url: string | null;
  meta: string;
};

// Actions serveur LIÉES, fournies par l'écran : lui seul sait à quoi rattacher
// le fichier et quelle page réactualiser. Ce doivent être des actions (`.bind`
// sur une fonction « use server »), jamais une closure écrite ici : une
// fonction ordinaire ne traverse pas la frontière serveur/client, et
// `<form action={…}>` la refuse à l'exécution — sans que TypeScript n'y voie
// quoi que ce soit (TRAP-026).
type RemoveAction = (attachmentId: string) => Promise<void>;

export function AttachmentList({ pieces, onRemove }: { pieces: Piece[]; onRemove: RemoveAction }) {
  // Les anciennes pièces n'étaient qu'un nom, sans fichier : elles restent
  // listées avec les documents, sans lien.
  const images = pieces.filter((f) => f.url && isImageUrl(f.url));
  const documents = pieces.filter((f) => !f.url || !isImageUrl(f.url));
  const slides = images.map((f) => ({ url: f.url!, title: f.filename }));

  if (pieces.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {images.length > 0 ? (
        <Lightbox images={slides}>
          <div className="flex flex-wrap gap-2">
            {images.map((f, i) => (
              <div key={f.id} className="group relative">
                <LightboxTrigger
                  index={i}
                  label={`Agrandir ${f.filename}`}
                  className="block cursor-zoom-in overflow-hidden rounded-lg border border-border transition hover:ring-2 hover:ring-mint/50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- domaine externe, pas d'optimisation Next */}
                  <img src={f.url!} alt={f.filename} title={`${f.filename} · ${f.meta}`} className="h-20 w-28 object-cover" />
                </LightboxTrigger>
                <RemoveButton
                  action={onRemove.bind(null, f.id)}
                  label={`Retirer ${f.filename}`}
                  className="absolute right-1 top-1 hidden rounded bg-bg/80 px-1.5 text-xs text-muted hover:text-red group-hover:block group-focus-within:block"
                >
                  ✕
                </RemoveButton>
              </div>
            ))}
          </div>
        </Lightbox>
      ) : null}

      {documents.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {documents.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm"
            >
              <span className="flex h-8 w-10 shrink-0 items-center justify-center rounded bg-white/5 text-[10px] font-semibold uppercase text-muted">
                {extensionOf(f.filename) || "—"}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {f.url ? (
                  <a href={f.url} target="_blank" rel="noreferrer" className="text-text hover:text-mint">
                    {f.filename}
                  </a>
                ) : (
                  <span className="text-muted">{f.filename}</span>
                )}
              </span>
              <span className="shrink-0 text-xs text-muted">{f.meta}</span>
              <RemoveButton
                action={onRemove.bind(null, f.id)}
                label={`Retirer ${f.filename}`}
                className="shrink-0 rounded-lg border border-border px-2 py-1 text-xs text-muted hover:border-red/50 hover:text-red"
              >
                Retirer
              </RemoveButton>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RemoveButton({
  action,
  label,
  className,
  children,
}: {
  action: () => Promise<void>;
  label: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <form action={action} className="contents">
      <button type="submit" aria-label={label} title={label} className={className}>
        {children}
      </button>
    </form>
  );
}
