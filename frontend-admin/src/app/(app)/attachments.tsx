// Bloc « Pièces jointes », partagé par la fiche ticket et la fiche tâche : les
// deux écrans affichent exactement la même chose, et la moindre divergence
// (vignette d'un côté, lien de l'autre) se verrait tout de suite.
//
// Les images sont servies par codialis.files sur son propre domaine, donc
// directement par le navigateur : elles ne transitent pas par ce serveur. Un
// clic sur la vignette ou le nom ouvre la visionneuse, qui passe d'une image à
// l'autre de la même fiche.

import { Lightbox, LightboxTrigger } from "./lightbox";

type Piece = {
  id: string;
  filename: string;
  url: string | null;
  meta: string;
};

export function Attachments({
  pieces,
  onAdd,
  onRemove,
}: {
  pieces: Piece[];
  // Actions serveur LIÉES, fournies par l'écran : lui seul sait à quoi
  // rattacher le fichier et quelle page réactualiser. Ce doivent être des
  // actions (`.bind` sur une fonction « use server »), jamais une closure
  // écrite ici : une fonction ordinaire ne traverse pas la frontière
  // serveur/client, et `<form action={…}>` la refuse à l'exécution — sans que
  // TypeScript n'y voie quoi que ce soit.
  onAdd: (formData: FormData) => Promise<void>;
  onRemove: (attachmentId: string) => Promise<void>;
}) {
  // Seules les pièces qui ont un fichier s'affichent : les anciennes n'étaient
  // qu'un nom. Le rang dans la visionneuse se compte parmi elles.
  const images = pieces.filter((f) => f.url).map((f) => ({ id: f.id, url: f.url!, title: f.filename }));
  const rank = new Map(images.map((img, i) => [img.id, i]));

  return (
    <div className="rounded-xl border border-border bg-panel p-5">
      <h2 className="text-sm font-semibold text-text">Pièces jointes</h2>

      {pieces.length > 0 ? (
        <Lightbox images={images}>
        <div className="mt-3 flex flex-col gap-2">
          {pieces.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm"
            >
              {f.url ? (
                <LightboxTrigger
                  index={rank.get(f.id) ?? 0}
                  label={`Agrandir ${f.filename}`}
                  className="shrink-0 cursor-zoom-in rounded transition hover:ring-2 hover:ring-mint/50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- domaine externe, pas d'optimisation Next */}
                  <img src={f.url} alt={f.filename} className="h-10 w-10 rounded object-cover" />
                </LightboxTrigger>
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-white/5 text-xs text-muted">
                  —
                </span>
              )}

              <span className="min-w-0 flex-1 truncate text-text">
                {f.url ? (
                  <LightboxTrigger index={rank.get(f.id) ?? 0} label={`Agrandir ${f.filename}`} className="max-w-full truncate text-left hover:text-mint">
                    {f.filename}
                  </LightboxTrigger>
                ) : (
                  f.filename
                )}
              </span>

              <span className="shrink-0 text-xs text-muted">{f.meta}</span>

              <form action={onRemove.bind(null, f.id)}>
                <button
                  type="submit"
                  className="shrink-0 rounded-lg border border-border px-2 py-1 text-xs text-muted hover:border-red/50 hover:text-red"
                >
                  Retirer
                </button>
              </form>
            </div>
          ))}
        </div>
        </Lightbox>
      ) : (
        <p className="mt-3 text-sm text-muted">Aucune pièce jointe.</p>
      )}

      <form action={onAdd} className="mt-4 flex items-center gap-2">
        {/* Images seulement : le stockage refuse le reste, et vérifie en plus
            que le contenu est bien celui qu'annonce l'extension. */}
        <input
          type="file"
          name="fichier"
          required
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          className="flex-1 text-xs text-muted file:mr-3 file:rounded-lg file:border file:border-border file:bg-panel-2 file:px-3 file:py-1.5 file:text-xs file:text-text"
        />
        <button type="submit" className="rounded-lg bg-mint px-3 py-2 text-xs font-semibold text-bg">
          Joindre
        </button>
      </form>
    </div>
  );
}
