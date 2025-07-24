# PowerShell script to run QuillHaven in development mode with Docker Compose
# Usage: .\docker-dev.ps1

Write-Host "🚀 Starting QuillHaven Development Environment..." -ForegroundColor Green

# Check if .env.local exists
if (-not (Test-Path ".env.local")) {
    Write-Host "⚠️  .env.local not found. Creating from template..." -ForegroundColor Yellow
    Copy-Item ".env.docker" ".env.local"
    Write-Host "📝 Please edit .env.local with your actual Clerk credentials" -ForegroundColor Cyan
}

# Start development environment
docker-compose --profile dev up --build

Write-Host "🛑 Development environment stopped" -ForegroundColor Red