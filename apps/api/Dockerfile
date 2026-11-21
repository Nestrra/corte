# syntax=docker/dockerfile:1
# Production image for the Corte API (spec 000 US5, research.md R6).
# Build from the repo root:  docker build -f apps/api/Dockerfile --build-arg GIT_SHA=$(git rev-parse HEAD) -t corte-api .
# All runtime configuration comes from environment variables (constitution, principle VII).

FROM node:24-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

FROM base AS build
# Download every package from the lockfile first (cached while the lockfile does not change).
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm fetch
COPY . .
# Install only the API and its workspace dependencies, from the local store.
RUN pnpm install --frozen-lockfile --offline --ignore-scripts --filter "api..."
# Generate the Prisma client (compiled into dist) and build domain + API.
RUN pnpm --filter @corte/domain build \
 && pnpm --filter api build
# Production-only node_modules; no lifecycle scripts (the Prisma CLI is a dev dependency).
RUN pnpm --filter api deploy --prod --ignore-scripts /out
# Trim files never loaded at runtime to stay under the 300 MB target (research.md R6):
# - Prisma query compilers for databases other than PostgreSQL (one WASM per provider),
# - source maps of dependencies (the app's own dist/*.map are kept for stack traces),
# - type-only @types packages.
RUN find /out/node_modules/.pnpm -path '*/@prisma/client/runtime/query_compiler_*' \
      \( -name '*cockroachdb*' -o -name '*mysql*' -o -name '*sqlite*' -o -name '*sqlserver*' \) -delete \
 && find /out/node_modules/.pnpm -name '*.map' -delete \
 && rm -rf /out/node_modules/.pnpm/@types+*

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
# Identifies the build; can be overridden at runtime with -e GIT_SHA=... Empty → "unknown".
ARG GIT_SHA=""
ENV GIT_SHA=$GIT_SHA
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
