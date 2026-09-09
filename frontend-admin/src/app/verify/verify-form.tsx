"use client";

import Link from "next/link";
import { useActionState } from "react";
import { verifyAction, type VerifyState } from "./actions";

const initial: VerifyState = {};

export function VerifyForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(verifyAction, initial);

  if (state.done) {
    return (
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-text">
          Adresse confirmée. Vos identifiants viennent de vous être envoyés
          {state.email ? ` à ${state.email}` : ""}.
        </p>
        <p className="text-xs text-muted">
          Le mot de passe reçu devra être changé à la première connexion.
        </p>
        <Link
          href="/login"
          className="mt-1 self-start rounded-lg bg-mint px-3 py-2 text-sm font-semibold text-bg"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <p className="text-sm text-muted">
        Confirmez que cette adresse est bien la vôtre. Vos identifiants vous seront
        envoyés juste après — ils n’apparaîtront pas à l’écran.
      </p>
      {state.error ? <p className="text-sm text-red">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-mint px-3 py-2 text-sm font-semibold text-bg transition hover:brightness-110 disabled:opacity-60"
      >
        {isPending ? "Confirmation…" : "Confirmer mon compte"}
      </button>
    </form>
  );
}
