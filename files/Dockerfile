# Service de stockage de fichiers — Node nu, aucune dépendance à installer.
FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json ./
COPY src ./src
COPY bin ./bin

# `upload` disponible comme commande, pour que l'appel documenté fonctionne tel
# quel : `docker compose exec -T codialis.files upload png < photo.png`.
# Le lien pointe sur le fichier .js : Node résout le lien avant de chercher le
# package.json qui déclare `"type": "module"`.
RUN chmod +x /app/bin/upload.js && ln -s /app/bin/upload.js /usr/local/bin/upload

# Créé ici pour que le service démarre même sans volume monté (le volume, lui,
# recouvre ce dossier et garde les fichiers entre deux `docker compose down`).
RUN mkdir -p /app/public

ENV NODE_ENV=production

# 3003 public (relayé par Traefik), 3004 privé (jamais exposé).
EXPOSE 3003
CMD ["node", "src/serveur.js"]
