# Production Dockerfile for PayloadX Backend
# Uses the existing src/server.js directly — no TypeScript compilation needed

FROM node:20-alpine

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy only the src/ directory (source code)
# Models, routes, lib, etc are inside src/ — no root-level conflicts
COPY src/ ./src/

# Set production environment
ENV NODE_ENV=production
ENV PORT=3001

# Expose the port
EXPOSE 3001

# Start the server
CMD ["node", "src/server.js"]
