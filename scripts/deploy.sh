#!/bin/bash

# HTS Dashboard Deployment Script
set -e

echo "🚀 Starting HTS Dashboard deployment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if required environment variables are set
if [ -z "$PYLON_API_URL" ] || [ -z "$PYLON_API_TOKEN" ]; then
    echo "❌ Required environment variables not set:"
    echo "   PYLON_API_URL and PYLON_API_TOKEN must be set"
    echo "   Please set these variables and try again."
    exit 1
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p logs/nginx
mkdir -p nginx/ssl

# Check if SSL certificates exist
if [ ! -f "nginx/ssl/cert.pem" ] || [ ! -f "nginx/ssl/key.pem" ]; then
    echo "⚠️  SSL certificates not found in nginx/ssl/"
    echo "   Please add your SSL certificates:"
    echo "   - nginx/ssl/cert.pem"
    echo "   - nginx/ssl/key.pem"
    echo ""
    echo "   For development, you can generate self-signed certificates:"
    echo "   openssl req -x509 -nodes -days 365 -newkey rsa:2048 \\"
    echo "     -keyout nginx/ssl/key.pem \\"
    echo "     -out nginx/ssl/cert.pem"
    exit 1
fi

# Build and start services
echo "🔨 Building and starting services..."
docker-compose down --remove-orphans
docker-compose build --no-cache
docker-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
timeout=60
counter=0

while [ $counter -lt $timeout ]; do
    if docker-compose ps | grep -q "healthy"; then
        echo "✅ Services are healthy!"
        break
    fi
    echo "   Waiting for services... ($counter/$timeout)"
    sleep 2
    counter=$((counter + 2))
done

if [ $counter -ge $timeout ]; then
    echo "❌ Services failed to become healthy within $timeout seconds"
    echo "   Check logs with: docker-compose logs"
    exit 1
fi

# Show service status
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📋 Access Information:"
echo "   - Dashboard: https://localhost (or your domain)"
echo "   - Health Check: https://localhost/health"
echo ""
echo "📝 Useful Commands:"
echo "   - View logs: docker-compose logs -f"
echo "   - Stop services: docker-compose down"
echo "   - Restart services: docker-compose restart"
echo "   - Update services: docker-compose pull && docker-compose up -d"
