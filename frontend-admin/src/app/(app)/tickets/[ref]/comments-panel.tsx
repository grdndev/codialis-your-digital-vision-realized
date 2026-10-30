"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { ACCEPT_ATTRIBUTE, attachmentRefusal, withCaptureName } from "@/lib/attachments";
import { DropOverlay, useFileDrop } from "../../file-drop";

// Section « Commentaires » de la fiche ticket. Les pièces jointes y vivent
// aussi : un bouton « Joindre », et surtout le collage (Ctrl+V d'une capture
// d'écran) et le glisser-déposer d'un fichier, n'importe où sur la section.
// Le fichier part aussitôt, il n'attend pas l'envoi du commentaire : il est
// rattaché au ticket, et sa liste s'affiche en tête des commentaires.
//
// Les commentaires et la liste des pièces sont rendus par le serveur et
// arrivent en `children` et `files` ; ce composant n'apporte que ce qui ne
// peut pas l'être : les évènements du presse-papiers et du glisser-déposer.

type Upload = { key: number; name: string; error: string | null };

export function CommentsPanel({
  upload,
  comment,
  ticketId,
  ticketRef,
  files,
  children,
}: {
  // Actions serveur liées par l'écran (TRAP-026).
  upload: (formData: FormData) => Promise<{ error: string | null }>;
  comment: (formData: FormData) => void | Promise<void>;
  ticketId: string;
  ticketRef: string;
  files: ReactNode;
  children: ReactNode;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const nextKey = useRef(0);
  const [uploads, setUploads] = useState<Upload[]>([]);

  async function send(list: File[]) {
    for (const raw of list) {
      const file = withCaptureName(raw);
      const key = nextKey.current++;
      const refused = attachmentRefusal(file);
      setUploads((u) => [...u, { key, name: file.name, error: refused }]);
      if (refused) continue;
      const formData = new FormData();
      formData.append("fichier", file);
      let error: string | null;
      try {
        ({ error } = await upload(formData));
      } catch {
        error = "l'envoi a échoué";
      }
      setUploads((u) => (error ? u.map((x) => (x.key === key ? { ...x, error } : x)) : u.filter((x) => x.key !== key)));
    }
  }

  const drop = useFileDrop((files) => void send(files));

  return (
    <div className="relative rounded-xl border border-border bg-panel p-5" {...drop.handlers}>
      {drop.dragging ? <DropOverlay label="Déposez pour joindre au ticket" /> : null}

      <h2 className="text-sm font-semibold text-text">Commentaires</h2>

      {/* Les pièces jointes en tête : c'est ce qu'on cherche en ouvrant la
          discussion d'un bug, la capture qui le montre. */}
      <div className="mt-3 empty:hidden">{files}</div>

      {uploads.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1 text-xs" aria-live="polite">
          {uploads.map((u) => (
            <li key={u.key} className="flex items-center justify-between gap-3 rounded-lg bg-panel-2 px-3 py-1.5">
              <span className={u.error ? "text-red" : "text-muted"}>
                {u.error ? `${u.name} : ${u.error}` : `Envoi de ${u.name}…`}
              </span>
              {u.error ? (
                <button
                  type="button"
                  onClick={() => setUploads((list) => list.filter((x) => x.key !== u.key))}
                  className="shrink-0 text-muted hover:text-text"
                  aria-label="Masquer"
                >
                  ✕
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-col gap-3">{children}</div>

      <form action={comment} className="mt-4 flex items-end gap-2">
        <input type="hidden" name="ticketId" value={ticketId} />
        <input type="hidden" name="ref" value={ticketRef} />
        {/* Multiligne : Entrée passe à la ligne, l'envoi se fait au bouton. La
            hauteur suit le contenu, `rows` sert de repli aux navigateurs qui
            ignorent `field-sizing` (CC-345). Coller une image la joint au
            ticket ; coller du texte reste un collage ordinaire. */}
        <textarea
          name="body"
          required
          rows={3}
          placeholder="Ajouter un commentaire… (collez une capture ou glissez un fichier pour le joindre)"
          onPaste={(event) => {
            const pasted = [...event.clipboardData.files];
            if (!pasted.length) return;
            event.preventDefault();
            void send(pasted);
          }}
          className="field-sizing-content min-h-20 max-h-80 flex-1 resize-y rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-text"
        />
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => picker.current?.click()}
            className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted transition hover:border-mint/40 hover:text-text"
          >
            Joindre un fichier
          </button>
          <button type="submit" className="rounded-lg bg-mint px-3 py-2 text-xs font-semibold text-bg">
            Envoyer
          </button>
        </div>
      </form>
      {/* Hors du formulaire du commentaire : un fichier choisi part tout de
          suite, il ne doit pas voyager avec le texte. */}
      <input
        ref={picker}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        className="hidden"
        aria-label="Fichiers à joindre"
        onChange={(event) => {
          const chosen = [...(event.currentTarget.files ?? [])];
          event.currentTarget.value = "";
          void send(chosen);
        }}
      />
    </div>
  );
}
