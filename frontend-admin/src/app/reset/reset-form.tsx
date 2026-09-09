"use client";

import { useActionState } from "react";
import { resetAction, type ResetState } from "./actions";

const initial: ResetState = {};

export function ResetForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(resetAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <Field label="Nouveau mot de passe" name="password" />
      <Field label="Confirmer le mot de passe" name="confirm" />
      <p className="text-xs text-muted">
        8 caractères minimum, dont une majuscule et un caractère spécial.
      </p>
      {state.error ? <p className="text-sm text-red">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="mt-1 rounded-lg bg-mint px-3 py-2 text-sm font-semibold text-bg transition hover:brightness-110 disabled:opacity-60"
      >
        {isPending ? "Enregistrement…" : "Choisir ce mot de passe"}
      </button>
    </form>
  );
}

function Field({ label, name }: { label: string; name: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-xs font-medium text-muted">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="password"
        autoComplete="new-password"
        required
        className="rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-text outline-none focus:border-mint"
      />
    </div>
  );
}
