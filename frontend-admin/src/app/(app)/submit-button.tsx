"use client";

import { useFormStatus } from "react-dom";

// Bouton d'envoi inerte tant que son formulaire part : un double clic posait la
// même tâche interne deux fois (« Relancer NCD », « Relancer bruno mestre »,
// en double en production le 06/10).
export function SubmitButton({
  className,
  pendingLabel,
  children,
}: {
  className: string;
  pendingLabel?: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:cursor-wait disabled:opacity-60`}>
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
