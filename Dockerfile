# Bumped to Node 22 to satisfy modern dependencies
FROM node:22-alpine

# Ditch corepack and forcefully install pnpm v10 directly
RUN npm install -g pnpm@10.32.0

# Set the working directory inside the container
WORKDIR /app

# Copy only the package files first to leverage Docker cache
COPY package.json pnpm-lock.yaml ./

# Install dependencies (v10 will correctly read your package.json whitelist)
RUN pnpm install --frozen-lockfile

# Copy the rest of your application code
COPY . .

# Build the Nuxt application for production
RUN pnpm run build

# Expose the default Nuxt port
EXPOSE 3000

# Start the built application
CMD ["node", ".output/server/index.mjs"]