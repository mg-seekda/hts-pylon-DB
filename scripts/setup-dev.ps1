# HTS Dashboard Development Setup Script for Windows

Write-Host "🚀 Setting up HTS Dashboard for development..." -ForegroundColor Green

# Check if Node.js is installed
try {
    $nodeVersion = node -v
    Write-Host "✅ Node.js $nodeVersion detected" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed. Please install Node.js 18+ first." -ForegroundColor Red
    exit 1
}

# Check Node.js version
$versionNumber = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
if ($versionNumber -lt 18) {
    Write-Host "❌ Node.js version 18+ is required. Current version: $nodeVersion" -ForegroundColor Red
    exit 1
}

# Install root dependencies
Write-Host "📦 Installing root dependencies..." -ForegroundColor Yellow
npm install

# Install server dependencies
Write-Host "📦 Installing server dependencies..." -ForegroundColor Yellow
Set-Location server
npm install
Set-Location ..

# Install client dependencies
Write-Host "📦 Installing client dependencies..." -ForegroundColor Yellow
Set-Location client
npm install
Set-Location ..

# Create environment file if it doesn't exist
if (-not (Test-Path "server\.env")) {
    Write-Host "📝 Creating environment file..." -ForegroundColor Yellow
    Copy-Item "server\env.example" "server\.env"
    Write-Host "⚠️  Please edit server\.env with your Pylon API credentials" -ForegroundColor Yellow
}

# Create logs directory
if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs"
}

Write-Host "✅ Development setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Edit server\.env with your Pylon API credentials" -ForegroundColor White
Write-Host "2. Run 'npm run dev' to start development servers" -ForegroundColor White
Write-Host "3. Open http://localhost:3000 in your browser" -ForegroundColor White
Write-Host ""
Write-Host "Available commands:" -ForegroundColor Cyan
Write-Host "  npm run dev          - Start both frontend and backend" -ForegroundColor White
Write-Host "  npm run server:dev   - Start only backend" -ForegroundColor White
Write-Host "  npm run client:dev   - Start only frontend" -ForegroundColor White
Write-Host "  npm run build        - Build for production" -ForegroundColor White
Write-Host "  npm start            - Start production server" -ForegroundColor White
