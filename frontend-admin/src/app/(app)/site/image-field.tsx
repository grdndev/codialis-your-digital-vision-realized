"use client";

import { useRef, useState } from "react";

// Champ image d'un contenu du site.
//
// Le site public rend ces images en `background-image: url(...)`, ce qui accepte
// aussi bien un chemin (`/assets/logo.png`) qu'une data URL base64. On offre
// donc les deux : coller une URL, ou déposer un fichier converti en data URL —
// c'est ce que faisait l'ancien back-office, et cela évite d'avoir à héberger
// un service de fichiers.
//
// La conversion est nécessairement côté navigateur (FileReader), d'où ce
// composant client au milieu d'un formulaire par ailleurs entièrement serveur :
// la valeur finale part dans un input caché, comme n'importe quel champ.

// Au-delà, la data URL devient trop lourde pour une ligne JSON confortable
// (~1,33× la taille du fichier après encodage base64).
const MAX_BYTES = 1_500_000;

export function ImageField({
  name,
  defaultValue = "",
  label = "Image",
}: {
  name: string;
  defaultValue?: string;
  label?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function onFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError(`Fichier trop lourd (${Math.round(file.size / 1024)} ko, maximum 1500 ko).`);
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setValue(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => setError("Lecture du fichier impossible.");
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted">{label}</label>
      {/* La valeur réellement soumise, quelle que soit la façon de la fournir. */}
      <input type="hidden" name={name} value={value} />
      <div className="flex items-start gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt=""
            className="h-16 w-24 shrink-0 rounded-lg border border-border object-cover"
          />
        ) : (
          <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-[10px] text-muted">
            aucune
          </div>
        )}
        <div className="flex flex-1 flex-col gap-1.5">
          <input
            value={value.startsWith("data:") ? "" : value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="/assets/mon-image.png ou https://…"
            className="input"
          />
          <div className="flex items-center gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              onChange={(e) => onFile(e.target.files?.[0])}
              className="text-xs text-muted"
            />
            {value ? (
              <button
                type="button"
                onClick={() => {
                  setValue("");
                  setError(null);
                  if (fileInput.current) fileInput.current.value = "";
                }}
                className="rounded-lg border border-border px-2 py-1 text-xs text-muted hover:text-red"
              >
                Retirer
              </button>
            ) : null}
          </div>
          {value.startsWith("data:") ? (
            <p className="text-[11px] text-muted">
              Fichier intégré ({Math.round(value.length / 1024)} ko encodés).
            </p>
          ) : null}
          {error ? <p className="text-[11px] text-red">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
