# syntax=docker/dockerfile:1

FROM oven/bun:1.2.15-alpine AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM deps AS build
WORKDIR /app

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN bun run build

FROM oven/bun:1.2.15-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY --from=build /app/dist ./dist

EXPOSE 3000
USER bun

CMD ["bun", "run", "start"]
