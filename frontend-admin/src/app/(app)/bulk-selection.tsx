"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { Popover } from "./popover";

// Sélection de lignes pour le traitement en masse : tickets de l'écran Tickets
// et de la fiche projet, ceux d'un épic comme ceux hors épic (CC-358).
//
// Le comptage se fait en lisant les cases du formulaire plutôt qu'en tenant un
// état par ligne : les lignes sont rendues par le serveur, elles n'ont pas
// besoin de devenir interactives pour autant. Un seul `onChange` sur le
// formulaire suffit, les évènements des cases y remontent.

// Le nom des cases cochées, tel que l'action serveur le relit, et de quoi
// accorder le bandeau : un ticket sélectionné, deux tickets sélectionnés.
const NOUNS = {
  ticketIds: ["ticket", "tickets", "sélectionné", "sélectionnés"],
} as const;
type Field = keyof typeof NOUNS;

export function BulkSelection({
  action,
  deleteAction,
  field,
  bar,
  className = "flex flex-col gap-3",
  barClassName = "",
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  // « Supprimer les tickets » (CC-375), passé seulement à la chefferie et à la
  // direction : la même sélection, envoyée à une autre action après
  // confirmation.
  deleteAction?: (formData: FormData) => void | Promise<void>;
  field: Field;
  bar: ReactNode;
  className?: string;
  barClassName?: string;
  children: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [count, setCount] = useState(0);

  function recount() {
    const boxes = formRef.current?.querySelectorAll<HTMLInputElement>(`input[name="${field}"]`);
    setCount(boxes ? [...boxes].filter((b) => b.checked).length : 0);
  }

  const [one, many, chosen, chosenMany] = NOUNS[field];
  // Après l'envoi, React vide le formulaire par un `reset`, qui décoche les
  // cases sans émettre de `change` : sans ce second écouteur, le compteur
  // gardait l'ancienne sélection et le bandeau restait affiché sur rien (CC-352).
  return (
    <form ref={formRef} action={action} onChange={recount} onReset={() => setCount(0)} className={className}>
      {/* Le bandeau n'apparaît qu'une fois quelque chose de coché : tant qu'il
          n'y a rien à traiter, il n'a rien à dire. */}
      {count > 0 ? (
        <div
          className={`flex flex-wrap items-center gap-2 rounded-xl border border-mint/30 bg-mint/5 px-4 py-3 text-xs ${barClassName}`}
        >
          <span className="font-medium text-text">
            {count} {count > 1 ? many : one} {count > 1 ? chosenMany : chosen}
          </span>
          {bar}
          {/* Le bouton de confirmation envoie le MÊME formulaire, cases
              cochées comprises, à l'action de suppression (`formAction`) :
              pas de second formulaire à tenir en phase avec le premier. */}
          {deleteAction ? (
            <Popover
              className="relative ml-auto"
              summary={`Supprimer les ${many}`}
              summaryClassName="cursor-pointer list-none rounded-lg border border-red/40 px-3 py-1.5 font-medium text-red transition hover:bg-red/10"
            >
              <div className="absolute right-0 z-10 mt-2 flex w-72 flex-col gap-2 rounded-xl border border-border bg-panel p-3 shadow-2xl">
                <p className="text-text">
                  Supprimer {count} {count > 1 ? many : one} ?
                </p>
                <p className="text-muted">
                  Critères, commentaires, pièces jointes et temps mesuré partent avec{" "}
                  {count > 1 ? "eux" : "lui"}. Les saisies de temps restent au projet. C’est définitif.
                </p>
                <button
                  type="submit"
                  formAction={deleteAction}
                  className="rounded-lg bg-red/90 px-3 py-1.5 font-semibold text-bg hover:bg-red"
                >
                  Confirmer la suppression
                </button>
              </div>
            </Popover>
          ) : null}
        </div>
      ) : null}
      {children}
    </form>
  );
}

// Case du bandeau d'en-tête. Cocher ou décocher entraîne toutes les lignes du
// même formulaire ; l'évènement est réémis depuis une case pour que le
// formulaire recompte — une modification faite en JavaScript n'en déclenche
// pas de lui-même (TRAP-016).
export function SelectAll({ field }: { field: Field }) {
  return (
    <input
      type="checkbox"
      aria-label="Tout sélectionner"
      className="accent-mint"
      onChange={(event) => {
        const form = event.currentTarget.closest("form");
        const boxes = form?.querySelectorAll<HTMLInputElement>(`input[name="${field}"]`);
        if (!boxes?.length) return;
        for (const box of boxes) box.checked = event.currentTarget.checked;
        boxes[0].dispatchEvent(new Event("change", { bubbles: true }));
      }}
    />
  );
}
