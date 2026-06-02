# ---- Base image ----
FROM node:23-alpine AS base

WORKDIR /app

# ---- Enable pnpm via corepack (IMPORTANT) ----
RUN corepack enable

# ---- Install dependencies layer (cached) ----
FROM base AS deps

# Copy only dependency files first (better caching)
COPY package.json pnpm-lock.yaml ./

# Install deps (strict + reproducible)
RUN pnpm install --frozen-lockfile

# ---- Build stage ----
FROM base AS build

WORKDIR /app

# Bring installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy full project
COPY . .

# Build Nuxt app
RUN pnpm build

# ---- Production stage ----
FROM node:23-alpine AS runner

WORKDIR /app

RUN corepack enable

ENV NODE_ENV=production

# Copy only necessary build output
COPY --from=build /app/.output ./.output
COPY package.json ./

# If Nuxt needs runtime deps, install production only
RUN pnpm install --prod --frozen-lockfile

EXPOSE 3000

# Start Nuxt
CMD ["node", ".output/server/index.mjs"]