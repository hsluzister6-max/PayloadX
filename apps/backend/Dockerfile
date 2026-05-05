# Production Dockerfile for PayloadX Backend
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy source code and dependencies
# We need src, models, and lib as they are referenced relatively in the code
COPY src/ ./src/
COPY models/ ./models/
COPY lib/ ./lib/

# Set production environment
ENV NODE_ENV=production
ENV PORT=3001

# Use non-root user for security
USER node

# Expose the port
EXPOSE 3001

# Start the server
CMD ["node", "src/server.js"]
