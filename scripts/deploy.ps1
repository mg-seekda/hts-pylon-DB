# HTS Dashboard Deployment Script (PowerShell)
param(
    [switch]$SkipSSL,
    [switch]$Force
)

Write-Host "🚀 Starting HTS Dashboard deployment..." -ForegroundColor Green

# Check if Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Host "❌ Docker is not running. Please start Docker and try again." -ForegroundColor Red
    exit 1
}

# Check if required environment variables are set
if (-not $env:PYLON_API_URL -or -not $env:PYLON_API_TOKEN) {
    Write-Host "❌ Required environment variables not set:" -ForegroundColor Red
    Write-Host "   PYLON_API_URL and PYLON_API_TOKEN must be set" -ForegroundColor Red
    Write-Host "   Please set these variables and try again." -ForegroundColor Red
    exit 1
}

# Create necessary directories
Write-Host "📁 Creating necessary directories..." -ForegroundColor Blue
New-Item -ItemType Directory -Force -Path "logs\nginx" | Out-Null
New-Item -ItemType Directory -Force -Path "nginx\ssl" | Out-Null

# Check if SSL certificates exist
if (-not $SkipSSL) {
    if (-not (Test-Path "nginx\ssl\cert.pem") -or -not (Test-Path "nginx\ssl\key.pem")) {
        Write-Host "⚠️  SSL certificates not found in nginx\ssl\" -ForegroundColor Yellow
        Write-Host "   Please add your SSL certificates:" -ForegroundColor Yellow
        Write-Host "   - nginx\ssl\cert.pem" -ForegroundColor Yellow
        Write-Host "   - nginx\ssl\key.pem" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "   For development, you can generate self-signed certificates:" -ForegroundColor Yellow
        Write-Host "   openssl req -x509 -nodes -days 365 -newkey rsa:2048 \" -ForegroundColor Yellow
        Write-Host "     -keyout nginx\ssl\key.pem \" -ForegroundColor Yellow
        Write-Host "     -out nginx\ssl\cert.pem" -ForegroundColor Yellow
        exit 1
    }
}

# Build and start services
Write-Host "🔨 Building and starting services..." -ForegroundColor Blue
docker-compose down --remove-orphans
docker-compose build --no-cache
docker-compose up -d

# Wait for services to be healthy
Write-Host "⏳ Waiting for services to be healthy..." -ForegroundColor Blue
$timeout = 60
$counter = 0

while ($counter -lt $timeout) {
    $status = docker-compose ps
    if ($status -match "healthy") {
        Write-Host "✅ Services are healthy!" -ForegroundColor Green
        break
    }
    Write-Host "   Waiting for services... ($counter/$timeout)" -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    $counter += 2
}

if ($counter -ge $timeout) {
    Write-Host "❌ Services failed to become healthy within $timeout seconds" -ForegroundColor Red
    Write-Host "   Check logs with: docker-compose logs" -ForegroundColor Red
    exit 1
}

# Show service status
Write-Host "📊 Service Status:" -ForegroundColor Blue
docker-compose ps

Write-Host ""
Write-Host "🎉 Deployment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Access Information:" -ForegroundColor Blue
Write-Host "   - Dashboard: https://localhost (or your domain)" -ForegroundColor White
Write-Host "   - Health Check: https://localhost/health" -ForegroundColor White
Write-Host ""
Write-Host "📝 Useful Commands:" -ForegroundColor Blue
Write-Host "   - View logs: docker-compose logs -f" -ForegroundColor White
Write-Host "   - Stop services: docker-compose down" -ForegroundColor White
Write-Host "   - Restart services: docker-compose restart" -ForegroundColor White
Write-Host "   - Update services: docker-compose pull && docker-compose up -d" -ForegroundColor White
