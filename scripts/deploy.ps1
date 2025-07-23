# QuillHaven Deployment Script (PowerShell)
# Usage: .\scripts\deploy.ps1 [staging|production]

param(
    [Parameter(Position=0)]
    [ValidateSet("staging", "production")]
    [string]$Environment = "staging"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting deployment to $Environment environment..." -ForegroundColor Green

# Change to project root
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

# Pre-deployment checks
Write-Host "🔍 Running pre-deployment checks..." -ForegroundColor Yellow

# Type checking
Write-Host "📝 Type checking..." -ForegroundColor Cyan
npm run type-check
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Linting
Write-Host "🔧 Running ESLint..." -ForegroundColor Cyan
npm run lint:fix
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Formatting
Write-Host "💅 Formatting code..." -ForegroundColor Cyan
npm run format
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Tests
Write-Host "🧪 Running tests..." -ForegroundColor Cyan
npm run test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Build verification
Write-Host "🏗️ Building application..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Check for console.log statements
Write-Host "🔍 Checking for console.log statements..." -ForegroundColor Cyan
$consoleStatements = Select-String -Path "src\**\*.ts", "src\**\*.tsx", "src\**\*.js", "src\**\*.jsx" -Pattern "console\.(log|debug|info|warn)" -ErrorAction SilentlyContinue
if ($consoleStatements) {
    Write-Host "❌ Found console.log/debug statements in production code:" -ForegroundColor Red
    $consoleStatements | ForEach-Object { Write-Host $_.Line -ForegroundColor Red }
    Write-Host "Please remove them before deploying" -ForegroundColor Red
    exit 1
} else {
    Write-Host "✅ No console.log/debug statements found" -ForegroundColor Green
}

# Check for TODO/FIXME comments
Write-Host "📋 Checking for TODO/FIXME comments..." -ForegroundColor Cyan
$todoComments = Select-String -Path "src\**\*.ts", "src\**\*.tsx", "src\**\*.js", "src\**\*.jsx" -Pattern "(TODO|FIXME)" -ErrorAction SilentlyContinue
if ($todoComments) {
    Write-Host "⚠️ Found $($todoComments.Count) TODO/FIXME comments:" -ForegroundColor Yellow
    $todoComments | ForEach-Object { Write-Host "$($_.Filename):$($_.LineNumber): $($_.Line.Trim())" -ForegroundColor Yellow }
    Write-Host "📋 Please document these in your project management system" -ForegroundColor Yellow
}

# Environment variable validation
Write-Host "🔧 Validating environment variables..." -ForegroundColor Cyan
$envFile = if ($Environment -eq "production") { ".env.production" } else { ".env.staging" }

if (-not (Test-Path $envFile)) {
    Write-Host "❌ Environment file $envFile not found" -ForegroundColor Red
    exit 1
}

# Check required environment variables
$requiredVars = @(
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_SUPABASE_URL", 
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "DATABASE_URL",
    "GEMINI_API_KEY"
)

$envContent = Get-Content $envFile
foreach ($var in $requiredVars) {
    if (-not ($envContent | Where-Object { $_ -match "^$var=" })) {
        Write-Host "❌ Required environment variable $var not found in $envFile" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ All environment variables validated" -ForegroundColor Green

# Database migration check
Write-Host "🗄️ Checking database migrations..." -ForegroundColor Cyan
if (Get-Command npx -ErrorAction SilentlyContinue) {
    Write-Host "📊 Generating Prisma client..." -ForegroundColor Cyan
    npm run db:generate
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    
    if ($Environment -eq "production") {
        Write-Host "⚠️ Production deployment detected. Please ensure database migrations are applied manually." -ForegroundColor Yellow
        Write-Host "Run: npm run db:migrate" -ForegroundColor Yellow
        $response = Read-Host "Have you applied all necessary database migrations? (y/N)"
        if ($response -notmatch "^[Yy]$") {
            Write-Host "❌ Deployment cancelled. Please apply database migrations first." -ForegroundColor Red
            exit 1
        }
    }
}

# Final confirmation for production
if ($Environment -eq "production") {
    Write-Host "🚨 PRODUCTION DEPLOYMENT" -ForegroundColor Red
    Write-Host "This will deploy to the live production environment." -ForegroundColor Red
    $response = Read-Host "Are you sure you want to continue? (y/N)"
    if ($response -notmatch "^[Yy]$") {
        Write-Host "❌ Deployment cancelled" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ All pre-deployment checks passed!" -ForegroundColor Green
Write-Host "🚀 Ready for deployment to $Environment" -ForegroundColor Green

# Instructions for manual Vercel deployment
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Ensure your Vercel project is configured with the correct environment variables"
Write-Host "2. Deploy using: vercel --prod (for production) or vercel (for staging)"
Write-Host "3. Or push to the appropriate branch to trigger automatic deployment"

if ($Environment -eq "production") {
    Write-Host "4. Monitor deployment at: https://vercel.com/dashboard"
    Write-Host "5. Verify deployment at: https://quillhaven.com"
} else {
    Write-Host "4. Monitor deployment at: https://vercel.com/dashboard"
    Write-Host "5. Verify deployment at: https://staging-quillhaven.vercel.app"
}

Write-Host ""
Write-Host "🎉 Deployment preparation complete!" -ForegroundColor Green