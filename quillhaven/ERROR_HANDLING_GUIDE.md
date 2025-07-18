# Error Handling and Monitoring System

This document describes the comprehensive error handling and monitoring system implemented for QuillHaven.

## Overview

The error handling system provides:
- Global error handling middleware for API routes
- Frontend error boundaries and user notifications
- Structured logging with performance monitoring
- Health check endpoints for system monitoring
- Graceful degradation for external service failures

## Backend Error Handling

### Error Classes

The system defines several error classes for different scenarios:

```typescript
// Base error class
class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  details?: unknown;
}

// Specific error types
class ValidationError extends AppError // 400
class AuthenticationError extends AppError // 401
class AuthorizationError extends AppError // 403
class NotFoundError extends AppError // 404
class ConflictError extends AppError // 409
class RateLimitError extends AppError // 429
class ExternalServiceError extends AppError // 503
```

### Global Error Handler Middleware

Use the `withErrorHandler` middleware to wrap API routes:

```typescript
import { withErrorHandler, ValidationError } from '@/lib/errorHandler';

async function handleRequest(req: NextRequest): Promise<NextResponse> {
  // Your route logic here
  if (invalidInput) {
    throw new ValidationError('Invalid input data');
  }
  
  return NextResponse.json({ success: true });
}

export const POST = withErrorHandler(handleRequest);
```

### Database Error Handling

Convert database errors to appropriate application errors:

```typescript
import { handleDatabaseError } from '@/lib/errorHandler';

try {
  await prisma.user.create(userData);
} catch (error) {
  throw handleDatabaseError(error);
}
```

### External Service Error Handling

Handle external service calls with retry logic:

```typescript
import { handleExternalServiceCall } from '@/lib/errorHandler';

const result = await handleExternalServiceCall(
  'gemini-ai',
  () => callGeminiAPI(),
  3, // max retries
  1000 // retry delay
);
```

## Frontend Error Handling

### Error Boundaries

Wrap components with error boundaries to catch React errors:

```typescript
import { ErrorBoundary, ChapterErrorBoundary } from '@/components/ui/ErrorBoundary';

// Global error boundary (already in layout.tsx)
<ErrorBoundary showDetails={isDevelopment}>
  <App />
</ErrorBoundary>

// Specific error boundaries
<ChapterErrorBoundary>
  <ChapterEditor />
</ChapterErrorBoundary>
```

### Notification System

Use the notification system for user feedback:

```typescript
import { useNotifications } from '@/components/ui/NotificationSystem';

const { notifyError, notifySuccess, notifyWarning } = useNotifications();

// Show different types of notifications
notifySuccess('Chapter saved successfully');
notifyError('Failed to save chapter', 'Please try again');
notifyWarning('Connection unstable', 'Some features may be limited');
```

### Error Handling Hook

Use the error handling hook for API calls:

```typescript
import { useErrorHandling } from '@/hooks/useErrorHandling';

const { withApiErrorHandling } = useErrorHandling();

const saveChapter = withApiErrorHandling(
  async (chapterData) => {
    return fetch('/api/chapters', {
      method: 'POST',
      body: JSON.stringify(chapterData),
    });
  },
  'saving chapter'
);
```

## Logging System

### Structured Logging

The logging system provides structured logging with different levels:

```typescript
import { logger, PerformanceLogger, SecurityLogger } from '@/lib/logger';

// Basic logging
logger.info('User action completed', { userId, action: 'create_project' });
logger.warn('Rate limit approaching', { userId, requestCount });
logger.error('Database connection failed', { error: error.message });

// Performance logging
await PerformanceLogger.measureAsync('database_query', async () => {
  return await prisma.user.findMany();
});

// Security logging
SecurityLogger.logAuthAttempt(true, email, clientIP);
SecurityLogger.logSuspiciousActivity('multiple_failed_logins', { attempts: 5 }, clientIP);
```

### Log Levels

- `DEBUG`: Detailed information for debugging
- `INFO`: General information about application flow
- `WARN`: Warning messages for potential issues
- `ERROR`: Error messages for failures

## Health Check Endpoints

### Basic Health Check

```
GET /api/health
```

Returns basic system health status:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "service": "QuillHaven API",
  "version": "1.0.0",
  "uptime": 3600000,
  "checks": {
    "database": { "status": "healthy", "responseTime": 45 },
    "redis": { "status": "healthy", "responseTime": 12 },
    "memory": { "status": "healthy", "usagePercent": 65 }
  }
}
```

### Detailed Health Check

```
GET /api/health/detailed
```

Requires authentication. Returns detailed system information including:
- System metrics (memory, CPU)
- Database statistics
- Redis information
- External service status

### Service Status

```
GET /api/health/services
POST /api/health/services
```

Monitor and manage service degradation status.

## Graceful Degradation

The system automatically handles external service failures:

### Service Configuration

```typescript
import { gracefulDegradation } from '@/lib/gracefulDegradation';

// Services are automatically configured with:
// - Maximum failure thresholds
// - Retry delays with exponential backoff
// - Health check intervals
```

### Using Degradation Wrappers

```typescript
import { withGeminiDegradation } from '@/lib/gracefulDegradation';

const result = await withGeminiDegradation(
  () => generateChapter(prompt),
  () => showManualWritingMode() // fallback
);
```

### Service Status Monitoring

Services are automatically monitored and marked as unavailable when they fail repeatedly. Health checks run periodically to detect when services recover.

## Error Reporting

### Client-Side Error Reporting

Frontend errors are automatically reported to the backend:

```
POST /api/errors
```

Error reports include:
- Error message and stack trace
- Component stack (React)
- User agent and URL
- Timestamp and error ID

### Error Tracking

In production, consider integrating with external error tracking services:
- Sentry
- Bugsnag
- LogRocket
- DataDog

## Best Practices

### Backend

1. **Use Specific Error Types**: Throw appropriate error classes instead of generic errors
2. **Add Context**: Include relevant details in error objects
3. **Log Appropriately**: Use correct log levels and include structured data
4. **Handle Database Errors**: Convert database errors to application errors
5. **Implement Fallbacks**: Provide fallback behavior for external service failures

### Frontend

1. **Use Error Boundaries**: Wrap components to prevent crashes
2. **Provide User Feedback**: Show meaningful error messages to users
3. **Handle Network Errors**: Detect and handle connection issues
4. **Implement Retry Logic**: Allow users to retry failed operations
5. **Report Errors**: Send error reports for debugging

### Monitoring

1. **Set Up Alerts**: Monitor error rates and system health
2. **Track Performance**: Monitor response times and resource usage
3. **Review Logs**: Regularly review error logs and patterns
4. **Test Error Scenarios**: Include error handling in your tests
5. **Document Errors**: Maintain documentation of common errors and solutions

## Configuration

### Environment Variables

```bash
# Logging
LOG_LEVEL=INFO
NODE_ENV=production

# Error Tracking (optional)
SENTRY_DSN=your_sentry_dsn
ERROR_REPORTING_ENDPOINT=your_endpoint

# Health Checks
HEALTH_CHECK_TIMEOUT=5000
```

### Development vs Production

- **Development**: Show detailed error information, enable debug logging
- **Production**: Hide sensitive information, enable error reporting, set up monitoring

## Testing Error Handling

The system includes comprehensive tests for error handling:

```bash
npm test -- src/__tests__/errorHandling.test.ts
```

Test coverage includes:
- Error class creation
- Middleware error handling
- Database error conversion
- External service retry logic
- Frontend error boundaries

## Troubleshooting

### Common Issues

1. **Errors Not Being Caught**: Ensure `withErrorHandler` is applied to API routes
2. **Frontend Crashes**: Check that error boundaries are properly placed
3. **Missing Notifications**: Verify `NotificationProvider` is in the component tree
4. **Service Degradation**: Check service status endpoints and logs
5. **Performance Issues**: Review performance logs and metrics

### Debug Mode

Enable debug logging in development:

```bash
LOG_LEVEL=DEBUG npm run dev
```

This will show detailed information about:
- Request/response cycles
- Error handling flow
- Service health checks
- Performance metrics