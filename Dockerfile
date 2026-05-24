# syntax=docker/dockerfile:1

# ── Stage 1: Install dependencies ───────────────────
FROM oven/bun:1.2.15-alpine AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ── Stage 2: Build TypeScript ───────────────────────
FROM deps AS build
WORKDIR /app

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN bun run build

# ── Stage 3: Production runtime ─────────────────────
FROM oven/bun:1.2.15-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# Install production deps only
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production && \
    rm -rf /tmp/* /root/.bun/install/cache

# Copy compiled output
COPY --from=build /app/dist ./dist

EXPOSE 3000

# Health check — Docker will auto-restart unhealthy containers with restart policy
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Run as non-root
USER bun

CMD ["bun", "run", "start"]
