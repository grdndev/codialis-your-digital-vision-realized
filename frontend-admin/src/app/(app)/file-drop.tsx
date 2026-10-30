"use client";

import { useState } from "react";

// Glisser-déposer de fichiers sur une zone entière (section Commentaires de la
// fiche ticket, formulaire « Nouveau ticket ») : les quatre évènements à poser
// sur l'élément, et de quoi afficher le voile pendant le survol.
//
// Seuls les glisser de FICHIERS sont pris : un texte sélectionné qu'on déplace
// d'un champ à l'autre doit rester un glisser ordinaire.

const hasFiles = (event: React.DragEvent) => event.dataTransfer.types.includes("Files");

export function useFileDrop(onFiles: (files: File[]) => void) {
  // Compteur et non booléen : chaque élément survolé émet son entrée et sa
  // sortie, un booléen clignoterait d'un enfant à l'autre.
  const [depth, setDepth] = useState(0);

  const handlers = {
    onDragEnter(event: React.DragEvent) {
      if (!hasFiles(event)) return;
      event.preventDefault();
      setDepth((d) => d + 1);
    },
    onDragOver(event: React.DragEvent) {
      if (hasFiles(event)) event.preventDefault();
    },
    onDragLeave(event: React.DragEvent) {
      if (hasFiles(event)) setDepth((d) => Math.max(0, d - 1));
    },
    onDrop(event: React.DragEvent) {
      if (!hasFiles(event)) return;
      event.preventDefault();
      setDepth(0);
      onFiles([...event.dataTransfer.files]);
    },
  };

  return { dragging: depth > 0, handlers };
}

// Le voile posé sur la zone pendant le survol ; la zone doit être `relative`.
export function DropOverlay({ label }: { label: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-mint bg-bg/80 text-sm font-medium text-mint">
      {label}
    </div>
  );
}
