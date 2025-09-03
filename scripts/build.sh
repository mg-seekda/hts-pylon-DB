#!/bin/bash

# HTS Dashboard Build Script
set -e

echo "🔨 Building HTS Dashboard..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Build the Docker image
echo "📦 Building Docker image..."
docker build -t hts-dashboard:latest .

echo "✅ Build completed successfully!"
echo ""
echo "📋 Next steps:"
echo "   - Test locally: docker run -p 3001:3001 hts-dashboard:latest"
echo "   - Deploy: ./scripts/deploy.sh"
echo "   - View image: docker images hts-dashboard"
