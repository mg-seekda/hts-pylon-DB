#!/bin/bash

# HTS Dashboard Development Setup Script

set -e

echo "🚀 Setting up HTS Dashboard for development..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install server dependencies
echo "📦 Installing server dependencies..."
cd server
npm install
cd ..

# Install client dependencies
echo "📦 Installing client dependencies..."
cd client
npm install
cd ..

# Create environment file if it doesn't exist
if [ ! -f "server/.env" ]; then
    echo "📝 Creating environment file..."
    cp server/env.example server/.env
    echo "⚠️  Please edit server/.env with your Pylon API credentials"
fi

# Create logs directory
mkdir -p logs

echo "✅ Development setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit server/.env with your Pylon API credentials"
echo "2. Run 'npm run dev' to start development servers"
echo "3. Open http://localhost:3000 in your browser"
echo ""
echo "Available commands:"
echo "  npm run dev          - Start both frontend and backend"
echo "  npm run server:dev   - Start only backend"
echo "  npm run client:dev   - Start only frontend"
echo "  npm run build        - Build for production"
echo "  npm start            - Start production server"
