FROM node:22-alpine

WORKDIR /app

# Enable corepack (pnpm manager)
RUN corepack enable

# Lock pnpm version (prevents random upgrades)
RUN corepack prepare pnpm@9.12.0 --activate
RUN corepack use pnpm@9.12.0

# Copy dependency files first (better caching)
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile=false

# Copy project
COPY . .

# Build Nuxt app
RUN pnpm build

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]