# Multi-stage build for Python and Node.js application
FROM python:3.11-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    nodejs \
    npm \
    gdal-bin \
    libgdal-dev \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy Python requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy package.json for Node dependencies
COPY web/package.json ./web/
WORKDIR /app/web
RUN npm install --production

# Copy application code
WORKDIR /app
COPY . .

# Create necessary directories
RUN mkdir -p data output uploads

# Expose the web server port
EXPOSE 4011

# Set environment variables
ENV NODE_ENV=production
ENV PORT=4011

# Start the web server
CMD ["node", "web/server.js"]