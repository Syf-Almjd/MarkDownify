FROM node:20-alpine

WORKDIR /app

# enable corepack (pnpm comes from here)
RUN corepack enable

# install dependencies first (cached layer)
COPY package.json pnpm-lock.yaml ./

# IMPORTANT: avoid pnpm 11 breaking changes
RUN corepack prepare pnpm@9.12.0 --activate
RUN pnpm install --frozen-lockfile=false

# copy project
COPY . .

# build Nuxt
RUN pnpm build

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]