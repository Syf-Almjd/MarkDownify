FROM node:23-alpine

WORKDIR /app

# Enable pnpm via corepack (stable & standard)
RUN corepack enable

# Copy dependency files first (for caching)
COPY package.json pnpm-lock.yaml ./

# 🔥 IMPORTANT: bypass pnpm strict CI build approval issues
RUN pnpm install --no-frozen-lockfile

# Copy full project
COPY . .

# Build Nuxt
RUN pnpm build

# Expose Nuxt port
EXPOSE 3000

# Start Nuxt server
CMD ["node", ".output/server/index.mjs"]