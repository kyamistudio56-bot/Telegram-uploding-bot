# ==========================================
# Stage 1: Build
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
# npm install is used because the repository
# does not currently contain package-lock.json
RUN npm install

# Copy project source
COPY . .

# Build frontend + backend
RUN npm run build


# ==========================================
# Stage 2: Production
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy compiled application
COPY --from=builder /app/dist ./dist

# Copy data directory if it exists
COPY --from=builder /app/data ./data

# Render uses this port
EXPOSE 3000

# Data directory
VOLUME ["/app/data"]

# Start application
CMD ["node", "dist/server.cjs"]
