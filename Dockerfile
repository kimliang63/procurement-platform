# ── Stage 1: Build frontend ──────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app
COPY web/package*.json web/
RUN cd web && npm ci

COPY web/ web/
RUN cd web && DOCKER=true npm run build

# ── Stage 2: Production runtime ──────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# Install server dependencies (layer cached unless package.json changes)
COPY server/package*.json server/
RUN cd server && npm ci --omit=dev

# Copy server source
COPY server/src/ server/src/

# Copy frontend build from stage 1
COPY --from=builder /app/web/dist/ web/dist/

# Expose port (informational, actual port from PORT env var)
ARG PORT=3000
EXPOSE ${PORT}

# Start (directly from server/src/index.js, same as Railway)
CMD ["node", "server/src/index.js"]
