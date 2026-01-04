FROM node:20-alpine AS builder

WORKDIR /workspace

# Copy entire workspace for monorepo dependency resolution
COPY . .

# Build the template dependencies first
WORKDIR /workspace/template-base
RUN npm ci && npm run build

WORKDIR /workspace/template-knowledge
RUN npm ci && npm run build

# Build this service
WORKDIR /workspace/knowledge-best-practices
RUN npm ci && npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY --from=builder /workspace/knowledge-best-practices/package*.json ./

# Copy built template dependencies into node_modules
COPY --from=builder /workspace/template-base /app/node_modules/@xorng/template-base
COPY --from=builder /workspace/template-knowledge /app/node_modules/@xorng/template-knowledge

# Install only external production dependencies
RUN npm ci --omit=dev --ignore-scripts 2>/dev/null || npm install --omit=dev --ignore-scripts 2>/dev/null || true

# Copy built files
COPY --from=builder /workspace/knowledge-best-practices/dist ./dist/

# Create practices directory
RUN mkdir -p /practices

# Security: run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app /practices

USER nodejs

# Environment variables
ENV PRACTICES_PATH=/practices
ENV LOG_LEVEL=info

# MCP server uses stdio
CMD ["node", "dist/index.js"]
