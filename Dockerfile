FROM node:23-alpine AS base

WORKDIR /app

RUN corepack enable

# allow native builds (IMPORTANT FIX)
ENV PNPM_IGNORE_SCRIPTS=0

FROM base AS deps

COPY package.json pnpm-lock.yaml ./

# FIX: allow build scripts in CI
RUN pnpm install --frozen-lockfile --ignore-scripts=false

FROM base AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm build

FROM node:23-alpine AS runner

WORKDIR /app

RUN corepack enable

COPY --from=build /app/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]