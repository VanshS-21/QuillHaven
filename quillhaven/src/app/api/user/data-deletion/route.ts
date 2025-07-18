/**
 * User Data Deletion API - GDPR Article 17 Compliance (Right to be forgotten)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  withAuth,
  withRateLimit,
  AuthenticatedRequest,
} from '@/lib/middleware';
import { DataPrivacyService } from '@/services/dataPrivacyService';
import { validateString } from '@/utils/validation/input';
import {
  withErrorHandler,
  ValidationError,
  AuthenticationError,
} from '@/lib/errorHandler';
import {
  logger,
  PerformanceLogger,
  SecurityLogger,
  BusinessLogger,
} from '@/lib/logger';

interface DeletionRequestData {
  confirmationToken?: string;
  action: 'request' | 'confirm';
}

async function handleDataDeletion(req: NextRequest) {
  const user = (req as AuthenticatedRequest).user;
  const clientIP =
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  if (!user) {
    throw new AuthenticationError();
  }

  // Parse request body
  let requestData: DeletionRequestData;
  try {
    requestData = await req.json();
  } catch {
    throw new ValidationError('Invalid request body');
  }

  // Validate action
  const actionValidation = validateString(requestData.action, 'action', {
    required: true,
    pattern: /^(request|confirm)$/,
  });

  if (!actionValidation.isValid) {
    throw new ValidationError('Invalid action. Must be "request" or "confirm"');
  }

  const action = actionValidation.sanitizedData as string;
  const dataPrivacyService = new DataPrivacyService(user.id);

  if (action === 'request') {
    // Request data deletion (sends confirmation email)
    const result = await PerformanceLogger.measureAsync(
      'data_deletion_request',
      async () => {
        return await dataPrivacyService.requestDataDeletion(user.id);
      },
      { userId: user.id, clientIP }
    );

    // Log security event for data deletion request
    SecurityLogger.logDataAccess(
      'user_data',
      'deletion_request',
      user.id,
      result.success
    );

    BusinessLogger.logUserAction('data_deletion_request', user.id, {
      clientIP,
      userAgent,
      success: result.success,
      timestamp: new Date().toISOString(),
    });

    logger.info('Data deletion request processed', {
      userId: user.id,
      success: result.success,
      clientIP,
      userAgent,
    });

    return NextResponse.json(
      {
        success: result.success,
        message: result.message,
      },
      {
        status: result.success ? 200 : 400,
      }
    );
  } else if (action === 'confirm') {
    // Confirm and execute data deletion
    if (!requestData.confirmationToken) {
      throw new ValidationError('Confirmation token is required');
    }

    // Validate confirmation token
    const tokenValidation = validateString(
      requestData.confirmationToken,
      'confirmationToken',
      {
        required: true,
        minLength: 32,
        maxLength: 128,
      }
    );

    if (!tokenValidation.isValid) {
      throw new ValidationError('Invalid confirmation token');
    }

    const confirmationToken = tokenValidation.sanitizedData as string;

    // Execute data deletion with performance monitoring
    const deletionResult = await PerformanceLogger.measureAsync(
      'data_deletion_execution',
      async () => {
        return await dataPrivacyService.deleteUserData(
          user.id,
          confirmationToken
        );
      },
      { userId: user.id, clientIP }
    );

    if (!deletionResult.success) {
      // Log failed deletion attempt
      SecurityLogger.logDataAccess(
        'user_data',
        'deletion_failed',
        user.id,
        false
      );

      logger.warn('Data deletion failed', {
        userId: user.id,
        errors: deletionResult.errors,
        clientIP,
        userAgent,
      });

      return NextResponse.json(
        {
          success: false,
          message: 'Failed to delete user data',
          errors: deletionResult.errors,
        },
        {
          status: 400,
        }
      );
    }

    // Log successful data deletion
    SecurityLogger.logDataAccess(
      'user_data',
      'deletion_completed',
      user.id,
      true
    );

    BusinessLogger.logUserAction('data_deletion_completed', user.id, {
      deletedItems: deletionResult.deletedItems,
      clientIP,
      userAgent,
      timestamp: new Date().toISOString(),
    });

    logger.info('User data deletion completed', {
      userId: user.id,
      deletedItems: deletionResult.deletedItems,
      clientIP,
      userAgent,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'User data has been successfully deleted',
        deletedItems: deletionResult.deletedItems,
      },
      {
        status: 200,
      }
    );
  }

  throw new ValidationError('Invalid action');
}

// Apply middleware with very strict rate limiting for data deletion
const handler = withErrorHandler(
  withAuth(
    withRateLimit({
      windowMs: 24 * 60 * 60 * 1000, // 24 hours
      maxRequests: 5, // Only 5 deletion requests per day
      message: 'Too many deletion requests. Please try again tomorrow.',
    })(handleDataDeletion)
  )
);

export { handler as POST };
