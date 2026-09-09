import Link from "next/link";
import { VerifyForm } from "./verify-form";

export default async function VerifyPage({
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
          <h1 className="text-xl font-semibold text-text">Confirmer votre compte</h1>
        </div>
        <div className="rounded-2xl border border-border bg-panel p-6 shadow-2xl">
          {token ? (
            <VerifyForm token={token} />
          ) : (
            <p className="text-sm text-muted">
              Ce lien est incomplet. Ouvrez-le directement depuis l’e-mail reçu.
            </p>
          )}
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
