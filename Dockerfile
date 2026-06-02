# Bumped to Node 22 to satisfy pnpm@latest requirements
FROM node:22-alpine

# Enable Corepack to install and use pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set the working directory inside the container
WORKDIR /app

# Copy only the package files first to leverage Docker cache
COPY package.json pnpm-lock.yaml ./

# Install dependencies normally (it will read your new package.json whitelist)
RUN pnpm install --frozen-lockfile

# Copy the rest of your application code
COPY . .

# Build the Nuxt application for production
RUN pnpm run build

# Expose the default Nuxt port
EXPOSE 3000

# Start the built application
CMD ["node", ".output/server/index.mjs"]