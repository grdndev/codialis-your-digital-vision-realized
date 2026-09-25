// Bloc « Pièces jointes », partagé par la fiche ticket et la fiche tâche : les
// deux écrans affichent exactement la même chose, et la moindre divergence
// (vignette d'un côté, lien de l'autre) se verrait tout de suite.
//
// Les images sont servies par codialis.files sur son propre domaine, donc
// directement par le navigateur : elles ne transitent pas par ce serveur.

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
  return (
    <div className="rounded-xl border border-border bg-panel p-5">
      <h2 className="text-sm font-semibold text-text">Pièces jointes</h2>

      {pieces.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2">
          {pieces.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm"
            >
              {f.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- domaine externe, pas d'optimisation Next
                <img
                  src={f.url}
                  alt={f.filename}
                  className="h-10 w-10 shrink-0 rounded object-cover"
                />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-white/5 text-xs text-muted">
                  —
                </span>
              )}

              <span className="min-w-0 flex-1 truncate text-text">
                {f.url ? (
                  <a href={f.url} target="_blank" rel="noreferrer" className="hover:text-mint">
                    {f.filename}
                  </a>
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
