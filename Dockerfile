# Multi-stage production Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build Vite frontend and bundled CommonJS server
RUN npm run build

# Production runner stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled build artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data

# Expose production port
EXPOSE 3000

# Persistent volume for JSON database
VOLUME ["/app/data"]

# Start production server
CMD ["node", "dist/server.cjs"]
