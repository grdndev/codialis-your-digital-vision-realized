import { ROLE_LABEL } from "@/lib/nav";
import { logoutAction } from "@/app/(app)/actions";
import type { SessionUser } from "@/lib/types";

export function Topbar({ user }: { user: SessionUser }) {
  return (
    <header className="flex items-center justify-end gap-3 border-b border-border bg-panel px-6 py-3">
      <div className="text-right">
        <p className="text-sm font-medium text-text">{user.name}</p>
        <p className="text-xs text-muted">{ROLE_LABEL[user.role]}</p>
      </div>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-mint/15 text-xs font-semibold text-mint">
        {user.initials}
      </div>
      <form action={logoutAction}>
        <button
          type="submit"
          className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition hover:border-red/50 hover:text-red"
        >
          Se déconnecter
        </button>
      </form>
    </header>
  );
}
