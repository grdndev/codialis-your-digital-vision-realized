"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";

// Sélection de tickets pour le traitement en masse.
//
// Le comptage se fait en lisant les cases du formulaire plutôt qu'en tenant un
// état par ticket : les lignes sont rendues par le serveur, elles n'ont pas
// besoin de devenir interactives pour autant. Un seul `onChange` sur le
// formulaire suffit, les évènements des cases y remontent.

export function TicketSelection({
  action,
  bar,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  bar: ReactNode;
  children: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [count, setCount] = useState(0);

  function recount() {
    const boxes = formRef.current?.querySelectorAll<HTMLInputElement>(
      'input[name="ticketIds"]',
    );
    setCount(boxes ? [...boxes].filter((b) => b.checked).length : 0);
  }

  return (
    <form ref={formRef} action={action} onChange={recount} className="flex flex-col gap-3">
      {/* Le bandeau n'apparaît qu'une fois quelque chose de coché : tant qu'il
          n'y a rien à traiter, il n'a rien à dire. */}
      {count > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-mint/30 bg-mint/5 px-4 py-3 text-xs">
          <span className="font-medium text-text">
            {count} ticket{count > 1 ? "s" : ""} sélectionné{count > 1 ? "s" : ""}
          </span>
          {bar}
        </div>
      ) : null}
      {children}
    </form>
  );
}

// Case du bandeau d'en-tête. Cocher ou décocher entraîne toutes les lignes ;
// l'évènement est réémis depuis une case pour que le formulaire recompte —
// une modification faite en JavaScript n'en déclenche pas de lui-même.
export function SelectAllTickets() {
  return (
    <input
      type="checkbox"
      aria-label="Tout sélectionner"
      className="accent-mint"
      onChange={(event) => {
        const form = event.currentTarget.closest("form");
        const boxes = form?.querySelectorAll<HTMLInputElement>('input[name="ticketIds"]');
        if (!boxes?.length) return;
        for (const box of boxes) box.checked = event.currentTarget.checked;
        boxes[0].dispatchEvent(new Event("change", { bubbles: true }));
      }}
    />
  );
}
