FROM node:22-slim

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --production

# Copy source
COPY packages/ ./packages/
COPY bin/ ./bin/
COPY vite.config.ts tsconfig.json ./

# Build frontend
RUN npx vite build

# Expose port
EXPOSE 8648

# Start
ENV AUTH_DISABLED=0
CMD ["node", "bin/claude-code-web-ui.mjs", "start"]
