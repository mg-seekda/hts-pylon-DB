# HTS Dashboard Container Test Script (PowerShell)
param(
    [switch]$KeepRunning
)

Write-Host "🧪 Testing HTS Dashboard container..." -ForegroundColor Blue

# Check if image exists
$imageExists = docker images | Select-String "hts-dashboard.*latest"
if (-not $imageExists) {
    Write-Host "❌ hts-dashboard:latest image not found. Please build it first:" -ForegroundColor Red
    Write-Host "   docker build -t hts-dashboard:latest ." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Image found:" -ForegroundColor Green
docker images hts-dashboard:latest --format "table {{.Repository}}:{{.Tag}}`t{{.Size}}`t{{.CreatedAt}}"

# Test container startup
Write-Host "🚀 Starting container for testing..." -ForegroundColor Blue
$containerId = docker run -d `
    -p 3001:3001 `
    -e PYLON_API_URL="https://test.example.com/api" `
    -e PYLON_API_TOKEN="test-token" `
    -e DEV_BYPASS_AUTH=true `
    -e NODE_ENV=development `
    hts-dashboard:latest

Write-Host "📦 Container started with ID: $containerId" -ForegroundColor Green

# Wait for container to be ready
Write-Host "⏳ Waiting for container to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Test health endpoint
Write-Host "🔍 Testing health endpoint..." -ForegroundColor Blue
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Health check passed!" -ForegroundColor Green
    } else {
        throw "Health check failed with status: $($response.StatusCode)"
    }
} catch {
    Write-Host "❌ Health check failed!" -ForegroundColor Red
    Write-Host "📋 Container logs:" -ForegroundColor Yellow
    docker logs $containerId
    docker stop $containerId | Out-Null
    exit 1
}

# Test main endpoint
Write-Host "🔍 Testing main endpoint..." -ForegroundColor Blue
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Main endpoint accessible!" -ForegroundColor Green
    } else {
        throw "Main endpoint failed with status: $($response.StatusCode)"
    }
} catch {
    Write-Host "❌ Main endpoint failed!" -ForegroundColor Red
}

Write-Host ""
Write-Host "🎉 Container test completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Test Results:" -ForegroundColor Blue
Write-Host "   - Container ID: $containerId" -ForegroundColor White
Write-Host "   - Health endpoint: http://localhost:3001/api/health" -ForegroundColor White
Write-Host "   - Main application: http://localhost:3001/" -ForegroundColor White
Write-Host ""
Write-Host "📝 Useful commands:" -ForegroundColor Blue
Write-Host "   - View logs: docker logs $containerId" -ForegroundColor White
Write-Host "   - Stop container: docker stop $containerId" -ForegroundColor White
Write-Host "   - Access container: docker exec -it $containerId sh" -ForegroundColor White
Write-Host ""

if (-not $KeepRunning) {
    Write-Host "🛑 Stopping test container..." -ForegroundColor Yellow
    docker stop $containerId | Out-Null
    Write-Host "✅ Container stopped." -ForegroundColor Green
} else {
    Write-Host "🛑 To stop the test container, run:" -ForegroundColor Yellow
    Write-Host "   docker stop $containerId" -ForegroundColor White
}
