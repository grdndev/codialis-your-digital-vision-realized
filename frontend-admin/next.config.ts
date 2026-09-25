import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // « Mon mot de passe » est devenu « Paramètres » : les favoris pointant sur
  // l'ancienne adresse doivent retomber sur la nouvelle plutôt que sur un 404.
  // Redirection permanente, c'est un renommage définitif.
  async redirects() {
    return [{ source: "/mot-de-passe", destination: "/parametres", permanent: true }];
  },

  experimental: {
    // Une pièce jointe passe par une action serveur, dont le corps est limité à
    // 1 Mo par défaut : toute capture d'écran un peu grande serait refusée avec
    // « Body exceeded 1 MB limit », côté serveur, sans rien afficher d'utile.
    // On s'aligne sur la limite du stockage, qui est le vrai juge (25 Mo).
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
