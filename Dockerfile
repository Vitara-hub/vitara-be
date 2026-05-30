# syntax=docker/dockerfile:1

# ── Stage 1: Install dependencies ───────────────────
FROM oven/bun:1.2.21-slim AS deps
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
FROM oven/bun:1.2.21-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

# Pull latest security patches from Debian repository at build time.
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

# Install production deps only
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --ignore-scripts && \
    rm -rf /tmp/* /root/.bun/install/cache

# Copy compiled output
COPY --from=build /app/dist ./dist

EXPOSE 3000

# Health check — Docker will auto-restart unhealthy containers with restart policy
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/health').then((r) => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1))"

# Run as non-root
USER bun

CMD ["bun", "run", "start"]
