"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// Visionneuse d'images : un clic sur une vignette ouvre l'image en grand
// par-dessus la page, au lieu d'un nouvel onglet dont il fallait revenir.
//
// `<dialog>` ouvert en modal fait l'essentiel : il passe au-dessus de tout,
// garde le focus, et se ferme sur Échap. On y ajoute la fermeture au clic sur
// le fond, et le passage d'une image à l'autre (flèches, ou ← →) entre les
// images d'un même bloc.

type LightboxImage = { url: string; title: string };

const LightboxContext = createContext<(index: number) => void>(() => {});

export function Lightbox({ images, children }: { images: LightboxImage[]; children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const count = images.length;

  const open = useCallback((i: number) => {
    setIndex(i);
    dialog.current?.showModal();
  }, []);
  const step = useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const onKey = (event: KeyboardEvent) => {
      if (!d.open || count < 2) return;
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    d.addEventListener("keydown", onKey);
    return () => d.removeEventListener("keydown", onKey);
  }, [count, step]);

  const image = images[index];
  return (
    <LightboxContext.Provider value={open}>
      {children}
      <dialog
        ref={dialog}
        aria-label={image?.title ?? "Image"}
        // Le dialogue occupe tout l'écran : un clic qui tombe sur lui-même,
        // et non sur l'image ou la barre, est un clic sur le fond.
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
        className="m-0 h-screen max-h-none w-screen max-w-none bg-transparent p-0 text-text backdrop:bg-black/85"
      >
        {image ? (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-3 p-6"
            onClick={(event) => {
              if (event.target === event.currentTarget) dialog.current?.close();
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- domaine externe, pas d'optimisation Next */}
            <img
              src={image.url}
              alt={image.title}
              // Damier derrière l'image : un logo transparent, sombre ou clair,
              // disparaissait sur le fond noir de la visionneuse.
              style={{ background: "repeating-conic-gradient(#d9dde3 0% 25%, #ffffff 0% 50%) 50% / 16px 16px" }}
              className="max-h-[82vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            />
            <div className="flex max-w-[90vw] items-center gap-3 rounded-lg bg-panel/90 px-4 py-2 text-xs">
              {count > 1 ? (
                <button type="button" onClick={() => step(-1)} className="rounded border border-border px-2 py-1 text-muted hover:text-text" aria-label="Image précédente">
                  ‹
                </button>
              ) : null}
              <span className="min-w-0 truncate text-text">{image.title}</span>
              {count > 1 ? <span className="shrink-0 text-muted">{index + 1} / {count}</span> : null}
              {count > 1 ? (
                <button type="button" onClick={() => step(1)} className="rounded border border-border px-2 py-1 text-muted hover:text-text" aria-label="Image suivante">
                  ›
                </button>
              ) : null}
              <a href={image.url} target="_blank" rel="noreferrer" className="shrink-0 text-mint hover:underline">
                Ouvrir l’original ↗
              </a>
              <button
                type="button"
                onClick={() => dialog.current?.close()}
                className="shrink-0 rounded border border-border px-2 py-1 text-muted hover:text-text"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </LightboxContext.Provider>
  );
}

export function LightboxTrigger({
  index,
  className,
  label,
  children,
}: {
  index: number;
  className?: string;
  label: string;
  children: React.ReactNode;
}) {
  const open = useContext(LightboxContext);
  return (
    <button type="button" onClick={() => open(index)} className={className} aria-label={label}>
      {children}
    </button>
  );
}
