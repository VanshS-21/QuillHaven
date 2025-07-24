# PowerShell script to run QuillHaven Docker container
# Usage: .\docker-run.ps1

Write-Host "🚀 Starting QuillHaven Docker Container..." -ForegroundColor Green

# Stop and remove existing container if it exists
docker stop quillhaven-app 2>$null
docker rm quillhaven-app 2>$null

# Run the container with environment variables
docker run -d `
  --name quillhaven-app `
  -p 3000:3000 `
  --env-file .env.docker `
  quillhaven

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Container started successfully!" -ForegroundColor Green
    Write-Host "🌐 Application available at: http://localhost:3000" -ForegroundColor Cyan
    Write-Host "📋 To view logs: docker logs -f quillhaven-app" -ForegroundColor Yellow
    Write-Host "🛑 To stop: docker stop quillhaven-app" -ForegroundColor Red
} else {
    Write-Host "❌ Failed to start container" -ForegroundColor Red
    exit 1
}