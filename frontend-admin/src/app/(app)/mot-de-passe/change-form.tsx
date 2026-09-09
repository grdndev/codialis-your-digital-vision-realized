"use client";

import { useActionState } from "react";
import { changePasswordAction, type ChangeState } from "./actions";

const initial: ChangeState = {};

export function ChangePasswordForm() {
  const [state, formAction, isPending] = useActionState(changePasswordAction, initial);

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4">
      <Field label="Mot de passe actuel" name="currentPassword" autoComplete="current-password" />
      <Field label="Nouveau mot de passe" name="newPassword" autoComplete="new-password" />
      <Field label="Confirmer le nouveau" name="confirm" autoComplete="new-password" />
      <p className="text-xs text-muted">
        8 caractères minimum, dont une majuscule et un caractère spécial.
      </p>
      {state.error ? <p className="text-sm text-red">{state.error}</p> : null}
      {state.done ? <p className="text-sm text-mint">Mot de passe modifié.</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="mt-1 self-start rounded-lg bg-mint px-4 py-2 text-xs font-semibold text-bg transition hover:brightness-110 disabled:opacity-60"
      >
        {isPending ? "Enregistrement…" : "Changer mon mot de passe"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  autoComplete,
}: {
  label: string;
  name: string;
  autoComplete: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-xs font-medium text-muted">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="password"
        autoComplete={autoComplete}
        required
        className="input"
      />
    </div>
  );
}
