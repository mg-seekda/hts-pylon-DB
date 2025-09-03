#!/bin/bash

# HTS Dashboard Container Test Script
set -e

echo "🧪 Testing HTS Dashboard container..."

# Check if image exists
if ! docker images | grep -q "hts-dashboard.*latest"; then
    echo "❌ hts-dashboard:latest image not found. Please build it first:"
    echo "   docker build -t hts-dashboard:latest ."
    exit 1
fi

echo "✅ Image found: $(docker images hts-dashboard:latest --format 'table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}')"

# Test container startup
echo "🚀 Starting container for testing..."
CONTAINER_ID=$(docker run -d \
    -p 3001:3001 \
    -e PYLON_API_URL="https://test.example.com/api" \
    -e PYLON_API_TOKEN="test-token" \
    -e DEV_BYPASS_AUTH=true \
    -e NODE_ENV=development \
    hts-dashboard:latest)

echo "📦 Container started with ID: $CONTAINER_ID"

# Wait for container to be ready
echo "⏳ Waiting for container to be ready..."
sleep 10

# Test health endpoint
echo "🔍 Testing health endpoint..."
if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "✅ Health check passed!"
else
    echo "❌ Health check failed!"
    echo "📋 Container logs:"
    docker logs $CONTAINER_ID
    docker stop $CONTAINER_ID > /dev/null
    exit 1
fi

# Test main endpoint
echo "🔍 Testing main endpoint..."
if curl -f http://localhost:3001/ > /dev/null 2>&1; then
    echo "✅ Main endpoint accessible!"
else
    echo "❌ Main endpoint failed!"
fi

echo ""
echo "🎉 Container test completed successfully!"
echo ""
echo "📋 Test Results:"
echo "   - Container ID: $CONTAINER_ID"
echo "   - Health endpoint: http://localhost:3001/api/health"
echo "   - Main application: http://localhost:3001/"
echo ""
echo "📝 Useful commands:"
echo "   - View logs: docker logs $CONTAINER_ID"
echo "   - Stop container: docker stop $CONTAINER_ID"
echo "   - Access container: docker exec -it $CONTAINER_ID sh"
echo ""
echo "🛑 To stop the test container, run:"
echo "   docker stop $CONTAINER_ID"
