# API Route Error Handling Update Template

This template provides a standardized approach for updating all remaining API routes to use the advanced error handling system.

## Import Updates

Add these imports to the top of each route file:

```typescript
// Add these imports
import { withErrorHandler, ValidationError, NotFoundError, AuthenticationError, ConflictError, handleDatabaseError } from '@/lib/errorHandler';
import { logger, PerformanceLogger, BusinessLogger, SecurityLogger } from '@/lib/logger';
import { withGeminiDegradation, withRedisDegradation, withEmailDegradation } from '@/lib/gracefulDegradation';
```

## Handler Function Updates

### Before (Old Pattern):
```typescript
async function handleSomething(req: NextRequest) {
  try {
    const user = (req as AuthenticatedRequest).user;
    
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    if (!someId || typeof someId !== 'string') {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }
    
    const result = await someService.doSomething(someId, user.id);
    
    if (!result) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### After (New Pattern):
```typescript
async function handleSomething(req: NextRequest) {
  const user = (req as AuthenticatedRequest).user;
  
  if (!user) {
    throw new AuthenticationError();
  }
  
  if (!someId || typeof someId !== 'string') {
    throw new ValidationError('Invalid ID');
  }
  
  const result = await PerformanceLogger.measureAsync(
    'operation_name',
    async () => {
      try {
        return await someService.doSomething(someId, user.id);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, someId }
  );
  
  if (!result) {
    throw new NotFoundError('Resource not found');
  }
  
  // Log business event if applicable
  BusinessLogger.logUserAction('action_name', user.id, {
    resourceId: someId,
    // other relevant data
  });
  
  logger.info('Operation completed successfully', {
    userId: user.id,
    resourceId: someId,
    // other relevant data
  });
  
  return NextResponse.json({ success: true, data: result });
}
```

## Export Updates

### Before:
```typescript
export const GET = withAuth(handleGet);
export const POST = withRateLimit(config)(withAuth(handlePost));
```

### After:
```typescript
export const GET = withErrorHandler(withAuth(handleGet));
export const POST = withErrorHandler(withRateLimit(config)(withAuth(handlePost)));
```

## Specific Error Handling Patterns

### 1. Authentication Errors
```typescript
if (!user) {
  throw new AuthenticationError();
}
```

### 2. Validation Errors
```typescript
// For Zod validation
try {
  validatedData = schema.parse(body);
} catch (error) {
  if (error instanceof z.ZodError) {
    throw new ValidationError('Invalid data', error.issues);
  }
  throw error;
}

// For simple validation
if (!id || typeof id !== 'string') {
  throw new ValidationError('Invalid ID format');
}
```

### 3. Not Found Errors
```typescript
if (!resource) {
  throw new NotFoundError('Resource not found or access denied');
}
```

### 4. Database Errors
```typescript
try {
  return await databaseOperation();
} catch (error) {
  throw handleDatabaseError(error);
}
```

### 5. External Service Errors (AI, Email, etc.)
```typescript
// For AI services
const result = await withGeminiDegradation(
  async () => {
    return await aiService.generate(prompt);
  },
  async () => {
    throw new ExternalServiceError('Gemini AI', 'AI service temporarily unavailable');
  }
);

// For email services
await withEmailDegradation(
  async () => {
    return await emailService.send(email);
  },
  async () => {
    logger.warn('Email service unavailable', { userId, email: email.to });
    return { success: false, message: 'Email service temporarily unavailable' };
  }
);
```

## Logging Patterns

### 1. Performance Logging
```typescript
const result = await PerformanceLogger.measureAsync(
  'operation_name',
  async () => {
    return await someOperation();
  },
  { userId, resourceId, additionalContext }
);
```

### 2. Business Event Logging
```typescript
// User actions
BusinessLogger.logUserAction('resource_created', user.id, {
  resourceId,
  resourceType: 'chapter',
  additionalData,
});

// AI generation
BusinessLogger.logAIGeneration(
  user.id,
  projectId,
  chapterId,
  wordCount,
  duration,
  success
);

// Exports
BusinessLogger.logExport(
  user.id,
  projectId,
  format,
  chapterCount,
  wordCount,
  success
);
```

### 3. Security Event Logging
```typescript
// Authentication attempts
SecurityLogger.logAuthAttempt(success, email, clientIP, userAgent);

// Suspicious activity
SecurityLogger.logSuspiciousActivity('type', details, clientIP, userId);

// Data access
SecurityLogger.logDataAccess('resource', 'action', userId, success);
```

### 4. General Logging
```typescript
logger.info('Operation completed', {
  userId,
  resourceId,
  operation: 'create_chapter',
  duration: Date.now() - startTime,
});

logger.warn('Potential issue detected', {
  userId,
  issue: 'high_resource_usage',
  details,
});
```

## Route-Specific Patterns

### Auth Routes
- Use `SecurityLogger.logAuthAttempt()` for login attempts
- Log client IP and user agent
- Use appropriate error types (AuthenticationError, ValidationError)

### Chapter Routes
- Use `BusinessLogger.logAIGeneration()` for AI operations
- Use `withGeminiDegradation()` for AI service calls
- Log chapter metadata (word count, project ID)

### Project Routes
- Use `BusinessLogger.logUserAction()` for CRUD operations
- Log project statistics (chapter count, word count)
- Include project metadata in logs

### Export Routes
- Use `BusinessLogger.logExport()` for export operations
- Use `SecurityLogger.logDataAccess()` for data access
- Include export format and size in logs

### User Data Routes
- Use `SecurityLogger.logDataAccess()` for privacy operations
- Log data export/deletion requests
- Include client IP for audit trail

## Checklist for Each Route

- [ ] Add error handling imports
- [ ] Replace try-catch blocks with throw statements
- [ ] Add performance monitoring with `PerformanceLogger.measureAsync()`
- [ ] Add appropriate business/security logging
- [ ] Use graceful degradation for external services
- [ ] Wrap exports with `withErrorHandler()`
- [ ] Test error scenarios
- [ ] Update any related tests

## Common Mistakes to Avoid

1. **Don't mix old and new patterns** - Fully convert each route
2. **Don't forget to wrap exports** - Always use `withErrorHandler()`
3. **Don't skip logging** - Add appropriate logging for business events
4. **Don't ignore external services** - Use degradation wrappers
5. **Don't forget validation** - Convert Zod errors properly
6. **Don't skip performance monitoring** - Use `PerformanceLogger` for database operations

## Testing

After updating each route, test:
1. Success scenarios
2. Authentication failures
3. Validation errors
4. Not found scenarios
5. Database errors
6. External service failures
7. Rate limiting
8. Logging output

## Priority Order for Updates

1. **High Priority** (Core functionality):
   - Chapter generation (`/api/chapters/[id]/generate`)
   - Project CRUD (`/api/projects/[id]`)
   - Chapter CRUD (`/api/chapters/[id]`)
   - Auth routes (`/api/auth/*`)

2. **Medium Priority** (Important features):
   - Export routes (`/api/exports/*`)
   - User data routes (`/api/user/*`)
   - Project context routes (`/api/projects/[id]/context/*`)

3. **Lower Priority** (Supporting features):
   - Character management routes
   - Plot thread routes
   - World building routes
   - Timeline event routes

This systematic approach ensures consistency across all API routes while maintaining the advanced error handling, logging, and monitoring capabilities.