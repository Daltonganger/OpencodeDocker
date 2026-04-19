FROM node:22-alpine AS builder
WORKDIR /app

# Copy root and workspace package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/

# Install all dependencies (monorepo)
RUN npm ci

# Copy source for both workspaces
COPY apps/api ./apps/api
COPY apps/web ./apps/web

# Build web first, then API
RUN npm run build -w apps/web
RUN npm run build -w apps/api

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache docker-cli docker-cli-compose

# Copy built API
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./

# Copy built web app
COPY --from=builder /app/apps/web/dist ./web-dist

# Install production dependencies for API only
RUN npm install --omit=dev

EXPOSE 3001
CMD ["node", "dist/index.js"]
