"use client";

import Link from "next/link";
import { useActionState } from "react";
import { verifyAction, type VerifyState } from "./actions";

const initial: VerifyState = {};

export function VerifyForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(verifyAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <Field label="Mot de passe" name="password" />
      <Field label="Confirmer le mot de passe" name="confirm" />
      <p className="text-xs text-muted">
        8 caractères minimum, dont une majuscule et un caractère spécial.
      </p>
      {state.error ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-red">{state.error}</p>
          {/* Un lien déjà utilisé ou périmé n'a pas de rattrapage évident :
              sans cette porte de sortie, il faut redemander à la direction. */}
          <Link href="/reset" className="text-xs text-muted underline hover:text-text">
            Demander un nouveau lien
          </Link>
        </div>
      ) : null}
      <button
        type="submit"
        disabled={isPending}
        className="mt-1 rounded-lg bg-mint px-3 py-2 text-sm font-semibold text-bg transition hover:brightness-110 disabled:opacity-60"
      >
        {isPending ? "Enregistrement…" : "Activer mon compte"}
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
