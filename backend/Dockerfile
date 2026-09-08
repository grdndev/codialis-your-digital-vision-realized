# API Codialis — Next.js en route handlers uniquement (aucune page).
FROM node:22-bookworm-slim

WORKDIR /app

# Dépendances d'abord : la couche est réutilisée tant que package*.json ne bouge pas.
COPY package*.json ./
RUN npm ci

# Le schéma avant le reste : `prisma generate` ne dépend que de lui.
COPY prisma ./prisma
RUN npx prisma generate

COPY . .

# Toutes les routes sont `force-dynamic` : la compilation n'ouvre aucune
# connexion à la base, une URL factice suffit pour satisfaire le datasource.
ENV DATABASE_URL="mysql://build:build@localhost:3306/build"
ENV AUTH_SECRET="build-only-not-used-at-runtime"
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3001
CMD ["npx", "next", "start", "-p", "3001"]
