import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { defaultPathFor } from "@/lib/nav";
import { LoginForm } from "./login-form";

// Une session valide n'a rien à faire sur le formulaire : on renvoie vers la
// page par défaut du rôle. Le test se fait ici plutôt que dans le proxy, qui ne
// voit que la présence du cookie et ne saurait pas distinguer un jeton périmé.
export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(defaultPathFor(user.role));

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-mint/15 text-xl font-semibold text-mint">
            C
          </div>
          <h1 className="text-xl font-semibold text-text">Codialis CRM</h1>
          <p className="mt-1 text-sm text-muted">Gestion de projet &amp; suivi client</p>
        </div>
        <div className="rounded-2xl border border-border bg-panel p-6 shadow-2xl">
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-xs">
          <Link href="/reset" className="text-muted hover:text-text">
            Mot de passe oublié ?
          </Link>
        </p>
        <p className="mt-6 text-center text-xs text-muted">
          Comptes de démonstration (mot de passe : <span className="text-text">codialis2026</span>)
          <br />
          claire@codialis.fr · marion@codialis.fr · lea@codialis.fr · karim@codialis.fr
        </p>
      </div>
    </main>
  );
}
