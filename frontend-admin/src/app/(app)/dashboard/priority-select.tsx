"use client";

import { PRIORITY_LABEL } from "@/lib/format";
import type { InternalTaskPriority } from "@/lib/types";

// Priorité d'une tâche confiée, modifiable sur place : choisir une valeur
// l'enregistre, sans bouton à viser à côté d'une liste déjà chargée.
export function PrioritySelect({
  action,
  value,
  label,
}: {
  action: (formData: FormData) => void | Promise<void>;
  value: InternalTaskPriority;
  label: string;
}) {
  return (
    <form action={action}>
      {/* La clé suit la valeur enregistrée : après l'envoi, React remet le
          formulaire à zéro, et un `<select>` déjà monté garde sa valeur
          d'origine — il réaffichait l'ancienne priorité alors que la nouvelle
          était enregistrée. Une nouvelle valeur, un nouveau menu. */}
      <select
        key={value}
        name="priority"
        defaultValue={value}
        aria-label={label}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="input h-8 w-auto py-0 text-xs"
      >
        {(Object.keys(PRIORITY_LABEL) as InternalTaskPriority[]).map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABEL[p]}
          </option>
        ))}
      </select>
    </form>
  );
}
