"use client";

import { useActionState } from "react";
import { forgotAction, type ForgotState } from "./actions";

const initial: ForgotState = {};

export function ForgotForm() {
  const [state, formAction, isPending] = useActionState(forgotAction, initial);

  // Le message de succès est volontairement identique que l'adresse existe ou
  // non : la page ne doit pas servir à savoir qui a un compte.
  if (state.sent) {
    return (
      <p className="text-sm text-text">
        Si un compte existe pour cette adresse, un lien de réinitialisation vient d’y
        être envoyé. Il est valable une heure.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-xs font-medium text-muted">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-text outline-none focus:border-mint"
        />
      </div>
      {state.error ? <p className="text-sm text-red">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="mt-1 rounded-lg bg-mint px-3 py-2 text-sm font-semibold text-bg transition hover:brightness-110 disabled:opacity-60"
      >
        {isPending ? "Envoi…" : "Recevoir un lien"}
      </button>
    </form>
  );
}
