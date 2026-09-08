# Build context = repo root (see docker-compose). Keeps container layout
# identical to the repo so express paths (../../frontend from src) resolve right.
FROM node:20-bookworm-slim

WORKDIR /repo/backend

# Install deps first for layer caching.
COPY backend/package*.json ./
RUN npm install

# Rest of the repo copied at build; also bind-mounted at runtime.
COPY . /repo

CMD ["npm", "run", "dev"]
