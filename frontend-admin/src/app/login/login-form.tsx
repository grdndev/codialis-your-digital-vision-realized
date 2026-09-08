"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

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
          placeholder="marion@codialis.fr"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-xs font-medium text-muted">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-text outline-none focus:border-mint"
          placeholder="••••••••"
        />
      </div>
      {state.error ? <p className="text-sm text-red">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="mt-2 rounded-lg bg-mint px-3 py-2 text-sm font-semibold text-bg transition hover:brightness-110 disabled:opacity-60"
      >
        {isPending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
