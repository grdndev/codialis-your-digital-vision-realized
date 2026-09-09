import { requireUser } from "@/lib/auth";
import { ChangePasswordForm } from "./change-form";

export default async function PasswordPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Mon mot de passe</h1>
        <p className="mt-1 text-sm text-muted">{user.email}</p>
      </div>
      <div className="rounded-xl border border-border bg-panel p-5">
        <ChangePasswordForm />
        <p className="mt-4 max-w-sm text-xs text-muted">
          Le mot de passe actuel est exigé même connecté : une session volée ne doit pas
          suffire à verrouiller le compte de son propriétaire.
        </p>
      </div>
    </div>
  );
}
