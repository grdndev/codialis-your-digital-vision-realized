# Back-office Codialis — les 25 écrans. Ne parle à la base qu'à travers l'API.
FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# `BACKEND_URL` n'est lu qu'à l'exécution (il n'est pas préfixé NEXT_PUBLIC_,
# donc jamais inliné dans le bundle) : la compilation n'a pas besoin de l'API.
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3002
CMD ["npx", "next", "start", "-p", "3002"]
