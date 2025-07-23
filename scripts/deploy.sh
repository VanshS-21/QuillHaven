#!/bin/bash

# QuillHaven Deployment Script
# Usage: ./scripts/deploy.sh [staging|production]

set -e

ENVIRONMENT=${1:-staging}
PROJECT_ROOT=$(dirname "$(dirname "$(realpath "$0")")")

echo "🚀 Starting deployment to $ENVIRONMENT environment..."

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo "❌ Invalid environment. Use 'staging' or 'production'"
    exit 1
fi

# Change to project directory
cd "$PROJECT_ROOT"

# Pre-deployment checks
echo "🔍 Running pre-deployment checks..."

# Type checking
echo "📝 Type checking..."
npm run type-check

# Linting
echo "🔧 Running ESLint..."
npm run lint:fix

# Formatting
echo "💅 Formatting code..."
npm run format

# Tests
echo "🧪 Running tests..."
npm run test

# Build verification
echo "🏗️ Building application..."
npm run build

# Check for console.log statements
echo "🔍 Checking for console.log statements..."
if grep -r "console\.\(log\|debug\|info\|warn\)" src/ --exclude-dir=node_modules --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null; then
    echo "❌ Found console.log/debug statements in production code"
    echo "Please remove them before deploying"
    exit 1
else
    echo "✅ No console.log/debug statements found"
fi

# Check for TODO/FIXME comments
echo "📋 Checking for TODO/FIXME comments..."
TODO_COUNT=$(grep -r "TODO\|FIXME" src/ --exclude-dir=node_modules --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | wc -l || echo "0")
if [ "$TODO_COUNT" -gt 0 ]; then
    echo "⚠️ Found $TODO_COUNT TODO/FIXME comments:"
    grep -r "TODO\|FIXME" src/ --exclude-dir=node_modules --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null || true
    echo "📋 Please document these in your project management system"
fi

# Environment variable validation
echo "🔧 Validating environment variables..."
if [[ "$ENVIRONMENT" == "production" ]]; then
    ENV_FILE=".env.production"
else
    ENV_FILE=".env.staging"
fi

if [[ ! -f "$ENV_FILE" ]]; then
    echo "❌ Environment file $ENV_FILE not found"
    exit 1
fi

# Check required environment variables
REQUIRED_VARS=(
    "NEXT_PUBLIC_APP_URL"
    "NEXT_PUBLIC_SUPABASE_URL"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    "SUPABASE_SERVICE_ROLE_KEY"
    "DATABASE_URL"
    "GEMINI_API_KEY"
)

for var in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^$var=" "$ENV_FILE"; then
        echo "❌ Required environment variable $var not found in $ENV_FILE"
        exit 1
    fi
done

echo "✅ All environment variables validated"

# Database migration check
echo "🗄️ Checking database migrations..."
if command -v npx >/dev/null 2>&1; then
    echo "📊 Generating Prisma client..."
    npm run db:generate
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        echo "⚠️ Production deployment detected. Please ensure database migrations are applied manually."
        echo "Run: npm run db:migrate"
        read -p "Have you applied all necessary database migrations? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "❌ Deployment cancelled. Please apply database migrations first."
            exit 1
        fi
    fi
fi

# Final confirmation for production
if [[ "$ENVIRONMENT" == "production" ]]; then
    echo "🚨 PRODUCTION DEPLOYMENT"
    echo "This will deploy to the live production environment."
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Deployment cancelled"
        exit 1
    fi
fi

echo "✅ All pre-deployment checks passed!"
echo "🚀 Ready for deployment to $ENVIRONMENT"

# Instructions for manual Vercel deployment
echo ""
echo "📋 Next steps:"
echo "1. Ensure your Vercel project is configured with the correct environment variables"
echo "2. Deploy using: vercel --prod (for production) or vercel (for staging)"
echo "3. Or push to the appropriate branch to trigger automatic deployment"

if [[ "$ENVIRONMENT" == "production" ]]; then
    echo "4. Monitor deployment at: https://vercel.com/dashboard"
    echo "5. Verify deployment at: https://quillhaven.com"
else
    echo "4. Monitor deployment at: https://vercel.com/dashboard"
    echo "5. Verify deployment at: https://staging-quillhaven.vercel.app"
fi

echo ""
echo "🎉 Deployment preparation complete!"