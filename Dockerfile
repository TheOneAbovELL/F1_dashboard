# A single image that serves the API, the Socket.IO stream and the built dashboard.
# Build from the repository root: docker build -t f1-visualizer .

# ── frontend build ─────────────────────────────────────────
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/tsconfig.json frontend/vite.config.ts frontend/postcss.config.js frontend/index.html ./
COPY frontend/src ./src
RUN npm run build

# ── backend build ──────────────────────────────────────────
FROM node:22-alpine AS backend
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# ── runtime ────────────────────────────────────────────────
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
# Stated outright rather than relying on a path relative to the compiled server, whose
# depth differs between this image and a source checkout.
ENV FRONTEND_DIST_DIR=/app/public
WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=backend /app/backend/dist ./dist
COPY --from=frontend /app/frontend/dist ./public

# The OpenF1 cache lives on a volume so a restart does not refetch the race.
RUN mkdir -p /app/.cache && chown -R node:node /app
USER node
VOLUME ["/app/.cache"]

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=4s --start-period=120s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
