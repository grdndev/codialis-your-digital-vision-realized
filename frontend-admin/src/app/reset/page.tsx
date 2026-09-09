import Link from "next/link";
import { ForgotForm } from "./forgot-form";
import { ResetForm } from "./reset-form";

// Une seule page pour les deux temps du parcours : sans jeton, on demande le
// lien ; avec, on choisit le nouveau mot de passe. C'est le même endroit, et le
// lien reçu par e-mail y ramène.
export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-mint/15 text-xl font-semibold text-mint">
            C
          </div>
          <h1 className="text-xl font-semibold text-text">
            {token ? "Nouveau mot de passe" : "Mot de passe oublié"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {token
              ? "Choisissez un mot de passe pour votre compte."
              : "Indiquez votre adresse, nous vous envoyons un lien."}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-panel p-6 shadow-2xl">
          {token ? <ResetForm token={token} /> : <ForgotForm />}
        </div>
        <p className="mt-6 text-center text-xs text-muted">
          <Link href="/login" className="hover:text-text">
            Retour à la connexion
          </Link>
        </p>
      </div>
    </main>
  );
}
