# QuillHaven Deployment Guide

This document outlines the deployment process and infrastructure setup for QuillHaven.

## Overview

QuillHaven uses a modern CI/CD pipeline with the following components:

- **Hosting**: Vercel for application hosting and edge functions
- **Database**: Supabase PostgreSQL with automated backups
- **CI/CD**: GitHub Actions for automated testing and deployment
- **Environments**: Staging and Production with environment-specific configurations

## Environments

### Staging Environment

- **URL**: https://staging-quillhaven.vercel.app
- **Branch**: `develop`
- **Purpose**: Testing and validation before production
- **Features**: All features enabled for testing

### Production Environment

- **URL**: https://quillhaven.com
- **Branch**: `main` or `master`
- **Purpose**: Live user-facing application
- **Features**: Only stable, production-ready features

## Prerequisites

### Required Tools

- Node.js 20.x or later
- npm (comes with Node.js)
- Git
- Vercel CLI (optional, for manual deployments)

### Required Accounts

- GitHub account with repository access
- Vercel account linked to GitHub
- Supabase account with staging and production projects

### Environment Variables

#### Required for All Environments

```bash
# Application
ENVIRONMENT=staging|production
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Feature Flags
NEXT_PUBLIC_FEATURE_COLLABORATION=true|false
NEXT_PUBLIC_FEATURE_AI_SUGGESTIONS=true|false

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Database
DATABASE_URL=your-supabase-postgres-connection-string

# AI Services
GEMINI_API_KEY=your-gemini-api-key
CLAUDE_API_KEY=your-claude-api-key

# Monitoring
NEXT_PUBLIC_ANALYTICS_ENABLED=true|false
NEXT_PUBLIC_ERROR_REPORTING_ENABLED=true|false
NEXT_PUBLIC_SECURITY_LEVEL=staging|production
```

#### GitHub Secrets Required

```bash
# Vercel Integration
VERCEL_TOKEN=your-vercel-token
VERCEL_ORG_ID=your-vercel-org-id
VERCEL_PROJECT_ID=your-vercel-project-id

# All environment variables listed above
```

## Deployment Process

### Automatic Deployment (Recommended)

1. **Staging Deployment**
   - Push changes to `develop` branch
   - GitHub Actions automatically runs quality checks
   - If all checks pass, deploys to staging environment
   - Staging URL: https://staging-quillhaven.vercel.app

2. **Production Deployment**
   - Create pull request from `develop` to `main`
   - Review and merge pull request
   - GitHub Actions automatically runs quality checks
   - If all checks pass, deploys to production environment
   - Production URL: https://quillhaven.com

### Manual Deployment

#### Using Deployment Scripts

**Windows (PowerShell)**

```powershell
# Deploy to staging
.\scripts\deploy.ps1 staging

# Deploy to production
.\scripts\deploy.ps1 production
```

**Linux/macOS (Bash)**

```bash
# Deploy to staging
./scripts/deploy.sh staging

# Deploy to production
./scripts/deploy.sh production
```

#### Using Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to staging
vercel --env ENVIRONMENT=staging

# Deploy to production
vercel --prod --env ENVIRONMENT=production
```

## Quality Checks

All deployments must pass the following quality checks:

### Code Quality

- ✅ TypeScript type checking (`npm run type-check`)
- ✅ ESLint linting (`npm run lint`)
- ✅ Prettier formatting (`npm run format:check`)
- ✅ Unit tests with coverage (`npm run test:coverage`)
- ✅ Build verification (`npm run build`)

### Security Checks

- ✅ No console.log/debug statements in production code
- ✅ No hardcoded secrets or sensitive data
- ✅ Dependency security audit (`npm audit`)
- ✅ CodeQL security analysis (automated)

### Environment Validation

- ✅ All required environment variables present
- ✅ Database connectivity verified
- ✅ External service integrations tested

## Monitoring and Rollback

### Deployment Monitoring

- Monitor deployment status in Vercel dashboard
- Check application health after deployment
- Verify all features working correctly
- Monitor error rates and performance metrics

### Rollback Procedure

If issues are detected after deployment:

1. **Immediate Rollback**

   ```bash
   # Using Vercel CLI
   vercel rollback [deployment-url]
   ```

2. **Code Rollback**
   - Revert problematic commits
   - Push to trigger new deployment
   - Verify rollback successful

3. **Database Rollback**
   - If database migrations were applied, may need manual rollback
   - Contact database administrator if needed

## Troubleshooting

### Common Issues

#### Build Failures

- Check TypeScript errors: `npm run type-check`
- Check linting errors: `npm run lint`
- Check test failures: `npm run test`
- Verify all dependencies installed: `npm ci`

#### Environment Variable Issues

- Verify all required variables are set in Vercel dashboard
- Check variable names match exactly (case-sensitive)
- Ensure no trailing spaces or special characters

#### Database Connection Issues

- Verify DATABASE_URL is correct for environment
- Check Supabase project is active and accessible
- Verify database migrations are applied

#### Deployment Timeouts

- Check for long-running build processes
- Verify no infinite loops in build scripts
- Consider optimizing build performance

### Getting Help

1. Check GitHub Actions logs for detailed error information
2. Review Vercel deployment logs in dashboard
3. Check application logs for runtime errors
4. Contact development team for assistance

## Security Considerations

### Environment Separation

- Staging and production use completely separate databases
- Different API keys for each environment
- Separate Supabase projects for isolation

### Secret Management

- All secrets stored in GitHub Secrets and Vercel environment variables
- No secrets committed to repository
- Regular rotation of API keys and tokens

### Access Control

- Production deployments require code review
- Limited access to production environment variables
- Audit trail for all deployment activities

## Performance Optimization

### Build Optimization

- Next.js automatic code splitting
- Image optimization with Next.js Image component
- Static generation where possible
- Edge functions for improved performance

### Caching Strategy

- CDN caching through Vercel Edge Network
- Database query caching with Redis
- API response caching for frequently accessed data

### Monitoring

- Real-time performance monitoring
- Error tracking and alerting
- User experience metrics
- Resource utilization monitoring

## Maintenance

### Regular Tasks

- Weekly dependency updates
- Monthly security audits
- Quarterly performance reviews
- Annual disaster recovery testing

### Backup Strategy

- Automated database backups (Supabase)
- Code repository backups (GitHub)
- Environment configuration backups
- Disaster recovery procedures documented

---

For questions or issues with deployment, please contact the development team or create an issue in the GitHub repository.
