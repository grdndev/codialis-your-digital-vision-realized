"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ACCEPT_ATTRIBUTE,
  ACCEPTED_EXTENSIONS,
  DOCUMENT_EXTENSIONS,
  MAX_ATTACHMENT_BYTES,
  extensionOf,
} from "@/lib/attachments";

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

// Une capture collée s'appelle « image.png » : le nom ne dirait rien dans la
// liste. On la date, à l'heure de la personne qui colle.
function named(file: File): File {
  if (file.name && !/^image\.\w+$/i.test(file.name)) return file;
  const ext = extensionOf(file.name) || file.type.split("/")[1] || "png";
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}h${pad(now.getMinutes())}m${pad(now.getSeconds())}`;
  return new File([file], `capture-${stamp}.${ext}`, { type: file.type });
}

// Le stockage refuse de toute façon ; vérifier ici évite d'envoyer 20 Mo pour
// rien et répond tout de suite.
function refusal(file: File): string | null {
  if (file.size === 0) return "le fichier est vide";
  if (file.size > MAX_ATTACHMENT_BYTES) return "fichier trop lourd (25 Mo maximum)";
  if (!ACCEPTED_EXTENSIONS.includes(extensionOf(file.name))) {
    return `type refusé (acceptés : images, ${DOCUMENT_EXTENSIONS.join(", ")})`;
  }
  return null;
}

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
  // Compteur et non booléen : chaque élément survolé émet son entrée et sa
  // sortie, un booléen clignoterait d'un enfant à l'autre.
  const [dragDepth, setDragDepth] = useState(0);

  async function send(list: File[]) {
    for (const raw of list) {
      const file = named(raw);
      const key = nextKey.current++;
      const refused = refusal(file);
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

  const hasFiles = (event: React.DragEvent) => event.dataTransfer.types.includes("Files");

  return (
    <div
      className="relative rounded-xl border border-border bg-panel p-5"
      onDragEnter={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        setDragDepth((d) => d + 1);
      }}
      onDragOver={(event) => {
        if (hasFiles(event)) event.preventDefault();
      }}
      onDragLeave={(event) => {
        if (hasFiles(event)) setDragDepth((d) => Math.max(0, d - 1));
      }}
      onDrop={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        setDragDepth(0);
        void send([...event.dataTransfer.files]);
      }}
    >
      {dragDepth > 0 ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-mint bg-bg/80 text-sm font-medium text-mint">
          Déposez pour joindre au ticket
        </div>
      ) : null}

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
