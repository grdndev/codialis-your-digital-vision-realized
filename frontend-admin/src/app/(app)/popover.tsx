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
//
// Un lien suivi depuis la fenêtre la ferme aussi : la navigation côté client
// garde la barre du haut montée, la liste de la cloche (CC-366) restait
// ouverte par-dessus le ticket qu'elle venait d'ouvrir.
export function Popover({
  summary,
  summaryClassName,
  className = "relative",
  onOpen,
  children,
}: {
  summary: React.ReactNode;
  summaryClassName: string;
  className?: string;
  // Appelée à chaque ouverture : la cloche y relit sa liste.
  onOpen?: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const onOpenRef = useRef(onOpen);

  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

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
    // du formulaire que la fenêtre contient. Même raison pour un lien.
    const onSubmit = () => setTimeout(close, 0);
    const onClick = (event: MouseEvent) => {
      if ((event.target as Element).closest?.("a[href]")) setTimeout(close, 0);
    };
    const onToggle = () => {
      if (details.open) onOpenRef.current?.();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    details.addEventListener("submit", onSubmit);
    details.addEventListener("click", onClick);
    details.addEventListener("toggle", onToggle);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      details.removeEventListener("submit", onSubmit);
      details.removeEventListener("click", onClick);
      details.removeEventListener("toggle", onToggle);
    };
  }, []);

  return (
    <details ref={ref} className={className}>
      <summary className={summaryClassName}>{summary}</summary>
      {children}
    </details>
  );
}
