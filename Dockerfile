FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN echo "ignore-scripts=false" > .npmrc && \
    echo 'allow-build[]=@parcel/watcher' >> .npmrc && \
    echo 'allow-build[]=canvas' >> .npmrc && \
    echo 'allow-build[]=esbuild' >> .npmrc && \
    echo 'allow-build[]=tesseract.js' >> .npmrc && \
    echo 'allow-build[]=unrs-resolver' >> .npmrc && \
    echo 'allow-build[]=vue-demi' >> .npmrc && \
    pnpm install --frozen-lockfile

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Production
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
COPY --from=builder /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]