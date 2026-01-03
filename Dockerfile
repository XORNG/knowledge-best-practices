FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy built files
COPY dist/ ./dist/

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
