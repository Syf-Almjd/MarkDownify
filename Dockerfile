FROM node:20-alpine

WORKDIR /app

# enable pnpm
RUN corepack enable

# IMPORTANT: disable pnpm build approval system
ENV PNPM_ENABLE_PRE_POST_SCRIPTS=true
ENV PNPM_IGNORE_SCRIPTS=false

COPY package.json pnpm-lock.yaml ./

# CRITICAL FIX: auto-approve all builds
RUN pnpm config set enable-pre-post-scripts true
RUN pnpm config set ignore-scripts false
RUN pnpm config set auto-install-peers true
RUN pnpm config set strict-peer-dependencies false

RUN pnpm install

COPY . .

RUN pnpm build

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]