# Use an official, lightweight Node.js image
FROM node:20-alpine

# Enable Corepack to install and use pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set the working directory inside the container
WORKDIR /app

# Copy only the package files first to leverage Docker cache
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of your application code
COPY . .

# Build the Nuxt application for production
RUN pnpm run build

# Expose the default Nuxt port
EXPOSE 3000

# Start the built application (Nuxt 3 default output path)
CMD ["node", ".output/server/index.mjs"]