import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // « Mon mot de passe » est devenu « Paramètres » : les favoris pointant sur
  // l'ancienne adresse doivent retomber sur la nouvelle plutôt que sur un 404.
  // Redirection permanente, c'est un renommage définitif.
  async redirects() {
    return [{ source: "/mot-de-passe", destination: "/parametres", permanent: true }];
  },
};

export default nextConfig;
