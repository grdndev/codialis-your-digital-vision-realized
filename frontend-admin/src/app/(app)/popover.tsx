"use client";

import { useEffect, useRef } from "react";

// Fenêtre flottante ouverte par un bouton : un `<details>`, qui s'ouvre et se
// ferme sans JavaScript, plus ce que `<details>` ne sait pas faire seul — se
// refermer quand on clique ailleurs ou qu'on appuie sur Échap, et après l'envoi
// de son formulaire (un export qui télécharge laisse la page en place, la
// fenêtre restait ouverte par-dessus).
//
// Le contenu reste rendu côté serveur : formulaires et actions serveur passent
// en `children` sans changer de nature.
export function Popover({
  summary,
  summaryClassName,
  className = "relative",
  children,
}: {
  summary: React.ReactNode;
  summaryClassName: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const details = ref.current;
    if (!details) return;
    const close = () => {
      details.open = false;
    };
    const onPointerDown = (event: PointerEvent) => {
      if (details.open && !details.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (details.open && event.key === "Escape") close();
    };
    // Après l'envoi seulement : fermer pendant l'évènement couperait l'envoi
    // du formulaire que la fenêtre contient.
    const onSubmit = () => setTimeout(close, 0);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    details.addEventListener("submit", onSubmit);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      details.removeEventListener("submit", onSubmit);
    };
  }, []);

  return (
    <details ref={ref} className={className}>
      <summary className={summaryClassName}>{summary}</summary>
      {children}
    </details>
  );
}
