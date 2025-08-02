# Use Node.js 18 LTS as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Create data directory for storing JSON files
RUN mkdir -p /app/data

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install --only=production

# Copy application files
COPY simple-api.js ./
COPY server.js ./
COPY index.html ./
COPY app.js ./
COPY styles.css ./
COPY manifest.json ./
COPY sw.js ./
COPY icons/ ./icons/
COPY generate-icons.html ./
COPY create-icons.html ./

# Expose port
EXPOSE 8080

# Set environment variables
ENV NODE_ENV=production
ENV DATA_DIR=/app/data

# Create volume for persistent data
VOLUME ["/app/data"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1

# Start the application
CMD ["npm", "start"]