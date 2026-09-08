import { adminRoute } from "@/lib/admin-api";

export const dynamic = "force-dynamic";

// GET /api/admin/me — identité de la session, pour le bandeau et les gardes de
// rôle du frontend. Aucun rôle exigé : toute session valide peut se décrire.
// Ni le hash du mot de passe ni les relations ne sortent.
export const GET = adminRoute([], async ({ user }) => ({
  user: {
    id: user.id,
    email: user.email,
    name: user.name,
    initials: user.initials,
    role: user.role,
    clientId: user.clientId,
  },
}));
