"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ACCEPT_ATTRIBUTE, attachmentRefusal, extensionOf, isImageUrl, withCaptureName } from "@/lib/attachments";
import { withParam } from "@/lib/ticket-return";
import { createTicketAction, uploadTicketAttachmentAction } from "../actions";
import { DropOverlay, useFileDrop } from "../../file-drop";
import { SubmitButton } from "../../submit-button";

type Project = { id: string; label: string; epics: { id: string; title: string }[] };

// Un fichier en attente de la création du ticket (CC-373). `preview` est une
// adresse locale (blob:) pour la vignette d'une image ; un fichier refusé reste
// affiché avec son motif, mais ne part pas.
type Pending = { key: number; file: File; preview: string | null; error: string | null };

export function NewTicketForm({
  projects,
  team,
  initialProjectId,
  fromProjectId,
}: {
  projects: Project[];
  team: { id: string; name: string }[];
  initialProjectId?: string;
  // Renseigné quand le formulaire est ouvert depuis une fiche projet : on y
  // revient après la création plutôt que de partir sur le ticket créé.
  fromProjectId?: string;
}) {
  const [type, setType] = useState<"BUG" | "DEV">("BUG");
  // Un projet passé en paramètre n'est retenu que s'il existe vraiment dans la
  // liste : une URL bricolée ne doit pas laisser le sélecteur vide.
  const [projectId, setProjectId] = useState(
    projects.some((p) => p.id === initialProjectId) ? initialProjectId! : (projects[0]?.id ?? ""),
  );
  const project = projects.find((p) => p.id === projectId);
  const router = useRouter();

  // Fichiers joints avant même que le ticket existe (CC-373) : ils attendent
  // ici, dans l'ordre où on les a ajoutés, et partent un par un dans cet ordre
  // une fois le ticket créé — c'est l'ordre dans lequel la fiche les montrera.
  const [pending, setPending] = useState<Pending[]>([]);
  const [sending, setSending] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const nextKey = useRef(0);

  // Les vignettes sont des `blob:` qui retiennent le fichier en mémoire tant
  // qu'on ne les libère pas : au retrait, après l'envoi, et en quittant.
  const previews = useRef(new Set<string>());
  useEffect(() => {
    const live = previews.current;
    return () => live.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  function release(list: Pending[]) {
    for (const p of list) {
      if (!p.preview) continue;
      URL.revokeObjectURL(p.preview);
      previews.current.delete(p.preview);
    }
  }

  function add(files: File[]) {
    const added = files.map((raw): Pending => {
      const file = withCaptureName(raw);
      const error = attachmentRefusal(file);
      // Le nom porte l'extension, comme l'adresse d'un fichier stocké.
      const preview = !error && isImageUrl(file.name) ? URL.createObjectURL(file) : null;
      if (preview) previews.current.add(preview);
      return { key: nextKey.current++, file, preview, error };
    });
    setPending((list) => [...list, ...added]);
  }

  function remove(key: number) {
    release(pending.filter((p) => p.key === key));
    setPending((list) => list.filter((p) => p.key !== key));
  }

  const drop = useFileDrop(add);

  // Le ticket d'abord, les fichiers ensuite : une pièce jointe se rattache à
  // un ticket qui existe. Un envoi qui échoue n'annule pas le ticket ; il est
  // nommé dans le bandeau de la page d'arrivée, d'où on peut le rejoindre.
  async function submit(formData: FormData) {
    const created = await createTicketAction(formData);
    if (!created) return;

    const failures: string[] = [];
    for (const p of pending.filter((x) => !x.error)) {
      setSending(p.file.name);
      const body = new FormData();
      body.append("fichier", p.file);
      let error: string | null;
      try {
        ({ error } = await uploadTicketAttachmentAction(created.ref, created.ref, body));
      } catch {
        error = "l'envoi a échoué";
      }
      if (error) failures.push(`${p.file.name} (${error})`);
    }

    // Venu d'un projet, le même formulaire se rouvre pour le ticket suivant :
    // il ne doit pas garder les fichiers de celui-ci.
    release(pending);
    setPending([]);
    setSending(null);
    router.push(
      failures.length
        ? withParam(
            created.destination,
            "error",
            `Ticket ${created.ref} créé, mais ${failures.length > 1 ? "ces fichiers n'ont pas pu être joints" : "ce fichier n'a pas pu être joint"} : ${failures.join(", ")}. Joignez-les depuis la fiche du ticket.`,
          )
        : created.destination,
    );
  }

  // Coller une capture dans un champ la joint ; coller du texte reste un
  // collage ordinaire.
  function onPaste(event: React.ClipboardEvent) {
    const pasted = [...event.clipboardData.files];
    if (!pasted.length) return;
    event.preventDefault();
    add(pasted);
  }

  return (
    <form
      action={submit}
      {...drop.handlers}
      className="relative flex max-w-2xl flex-col gap-4 rounded-xl border border-border bg-panel p-6"
    >
      {drop.dragging ? <DropOverlay label="Déposez pour joindre au ticket" /> : null}
      {fromProjectId ? <input type="hidden" name="fromProject" value={fromProjectId} /> : null}
      <div className="flex gap-2">
        {(["BUG", "DEV"] as const).map((t) => (
          <label
            key={t}
            className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-sm ${
              type === t ? "border-mint/40 bg-mint/10 text-text" : "border-border text-muted"
            }`}
          >
            <input
              type="radio"
              name="type"
              value={t}
              checked={type === t}
              onChange={() => setType(t)}
              className="sr-only"
            />
            {t === "BUG" ? "Ticket de bug" : "Ticket de développement"}
          </label>
        ))}
      </div>

      <Field label="Titre">
        <input name="title" required className="w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-text outline-none focus:border-mint" />
      </Field>

      <Field label={type === "BUG" ? "Description du bug" : "Description de la fonctionnalité"}>
        <textarea name="description" rows={3} onPaste={onPaste} className="w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-text outline-none focus:border-mint" />
      </Field>

      <Field label={type === "BUG" ? "Étapes de reproduction" : "Travail à réaliser"}>
        <textarea name="steps" rows={3} placeholder="une par ligne" onPaste={onPaste} className="w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-text outline-none focus:border-mint" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Projet">
          <select
            name="projectId"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-text outline-none focus:border-mint"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Épic">
          <select name="epicId" className="w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-text outline-none focus:border-mint" disabled={!project?.epics.length}>
            <option value="">Aucun</option>
            {project?.epics.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {type === "BUG" ? (
          <Field label="Gravité">
            <select name="severity" className="w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-text outline-none focus:border-mint">
              <option value="MINEUR">Mineur</option>
              <option value="MAJEUR">Majeur</option>
              <option value="BLOQUANT">Bloquant</option>
            </select>
          </Field>
        ) : (
          <Field label="Nature">
            <select name="devNature" className="w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-text outline-none focus:border-mint">
              <option value="FRONT">Front</option>
              <option value="BACK">Back</option>
              <option value="API">API</option>
              <option value="DESIGN">Design</option>
            </select>
          </Field>
        )}
        <Field label="Estimation (h)">
          <input name="estHours" type="text" placeholder="2" className="w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-text outline-none focus:border-mint" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Assigné">
          <select name="assigneeId" className="w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-text outline-none focus:border-mint">
            <option value="">Non assigné</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        {/* Dès la création (CC-366) : c'est l'échéance qui fait sonner la
            cloche, et elle ne se posait qu'en modifiant le ticket ensuite. */}
        <Field label="Échéance">
          <input name="dueAt" type="date" className="w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-text outline-none focus:border-mint" />
        </Field>
      </div>

      <div className="flex flex-col gap-1.5 text-xs text-muted">
        Pièces jointes
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border px-3 py-3">
          {pending
            .filter((p) => !p.error)
            .map((p) => (
              <div key={p.key} className="group relative">
                {p.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element -- adresse blob: locale, rien à optimiser
                  <img src={p.preview} alt={p.file.name} title={p.file.name} className="h-20 w-28 rounded-lg border border-border object-cover" />
                ) : (
                  <div title={p.file.name} className="flex h-20 w-28 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-panel-2 px-2">
                    <span className="text-[10px] font-semibold uppercase text-muted">{extensionOf(p.file.name) || "—"}</span>
                    <span className="w-full truncate text-center text-[11px] text-text">{p.file.name}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => remove(p.key)}
                  aria-label={`Retirer ${p.file.name}`}
                  title={`Retirer ${p.file.name}`}
                  className="absolute right-1 top-1 rounded bg-bg/80 px-1.5 text-xs text-muted hover:text-red"
                >
                  ✕
                </button>
              </div>
            ))}
          <button
            type="button"
            onClick={() => picker.current?.click()}
            className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted transition hover:border-mint/40 hover:text-text"
          >
            Joindre un fichier
          </button>
          <span>ou glissez des fichiers ici, ou collez une capture dans la description</span>
        </div>
        {pending.some((p) => p.error) ? (
          <ul className="flex flex-col gap-1" aria-live="polite">
            {pending
              .filter((p) => p.error)
              .map((p) => (
                <li key={p.key} className="flex items-center justify-between gap-3 rounded-lg bg-panel-2 px-3 py-1.5">
                  <span className="text-red">{`${p.file.name} : ${p.error}`}</span>
                  <button
                    type="button"
                    onClick={() => remove(p.key)}
                    className="shrink-0 text-muted hover:text-text"
                    aria-label="Masquer"
                  >
                    ✕
                  </button>
                </li>
              ))}
          </ul>
        ) : null}
        {/* Sans `name` : le fichier ne voyage pas avec le formulaire, il
            rejoint la liste et part après la création du ticket. */}
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
            add(chosen);
          }}
        />
      </div>

      {/* Inerte pendant l'envoi : un double clic créerait deux tickets. */}
      <SubmitButton
        className="mt-2 rounded-lg bg-mint px-4 py-2 text-sm font-semibold text-bg"
        pendingLabel={sending ? `Envoi de ${sending}…` : "Création…"}
      >
        Créer le ticket
      </SubmitButton>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs text-muted">
      {label}
      {children}
    </label>
  );
}
