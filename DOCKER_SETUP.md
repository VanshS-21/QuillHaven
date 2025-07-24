# Docker Setup Guide for QuillHaven

## 🎉 Success! Docker Build Complete

Your QuillHaven application has been successfully built as a Docker image. This completely bypasses the Windows permission issues you were experiencing with the native build process.

## 🚀 Quick Start

### 1. Set Up Environment Variables

First, create your environment file:

```powershell
# Copy the template
Copy-Item .env.docker .env.local

# Edit with your actual Clerk credentials
notepad .env.local
```

### 2. Run the Application

#### Option A: Simple Docker Run
```powershell
# Run the container
docker run -p 3000:3000 --env-file .env.local quillhaven
```

#### Option B: Use the PowerShell Script
```powershell
# Make sure .env.docker has your credentials, then run:
.\docker-run.ps1
```

#### Option C: Development with Database
```powershell
# Start full development environment with PostgreSQL
.\docker-dev.ps1
```

## 🔧 Available Docker Commands

```powershell
# Build the image
npm run docker:build

# Run production container
npm run docker:run

# Start development environment
npm run docker:dev

# Start production with database
npm run docker:prod

# Stop all containers
npm run docker:down

# Clean up containers and volumes
npm run docker:clean
```

## 🌐 Environment Configuration

### Required Environment Variables

```env
# Clerk Authentication (Required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here

# Database (Optional - uses Docker PostgreSQL if not provided)
DATABASE_URL=postgresql://postgres:postgres@db:5432/quillhaven

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

## 🐛 Troubleshooting

### Clerk Middleware Error
If you see "Clerk can't detect usage of clerkMiddleware()", it means:

1. **Missing Environment Variables**: Make sure your Clerk keys are set
2. **Wrong Environment File**: Ensure you're using the correct .env file
3. **Middleware Path**: The middleware.ts file should be in the root directory

### Database Connection Issues
```powershell
# Start just the database
docker-compose up db

# Check database logs
docker-compose logs db
```

### Container Management
```powershell
# View running containers
docker ps

# View all containers
docker ps -a

# View container logs
docker logs <container_id>

# Stop all containers
docker stop $(docker ps -q)

# Remove all containers
docker rm $(docker ps -aq)
```

## 📁 Docker Files Overview

- `Dockerfile` - Production build configuration
- `Dockerfile.dev` - Development build configuration  
- `docker-compose.yml` - Multi-service orchestration
- `.dockerignore` - Files to exclude from Docker build
- `docker-run.ps1` - PowerShell script for easy container management
- `docker-dev.ps1` - Development environment startup script

## 🎯 Benefits of Docker Approach

✅ **No Windows Permission Issues**: Builds in isolated Linux container
✅ **Consistent Environment**: Same environment across all machines
✅ **Easy Deployment**: Container can run anywhere Docker is supported
✅ **Database Included**: PostgreSQL automatically configured
✅ **Production Ready**: Optimized multi-stage build
✅ **Development Friendly**: Hot reload support in dev mode

## 🚀 Next Steps

1. **Set up Clerk**: Get your API keys from [Clerk Dashboard](https://dashboard.clerk.com)
2. **Configure Environment**: Update `.env.local` with your credentials
3. **Run Application**: Use `.\docker-run.ps1` or `docker-compose up`
4. **Access Application**: Open http://localhost:3000

## 🔒 Security Features Included

All the security features from Task 2.4 are included:
- Two-factor authentication
- Role-based access control
- Session management
- Security monitoring
- Profile synchronization
- Comprehensive logging

The Docker build successfully compiled all security features without any Windows-specific issues!