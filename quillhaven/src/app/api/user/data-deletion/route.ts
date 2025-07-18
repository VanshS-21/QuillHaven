/**
 * User Data Deletion API - GDPR Article 17 Compliance (Right to be forgotten)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withRateLimit } from '@/lib/middleware';
import { DataPrivacyService } from '@/services/dataPrivacyService';
import { validateString } from '@/utils/validation/input';

interface DeletionRequestData {
  confirmationToken?: string;
  action: 'request' | 'confirm';
}

async function handleDataDeletion(req: NextRequest) {
  try {
    const user = (req as any).user;
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    let requestData: DeletionRequestData;
    try {
      requestData = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Validate action
    const actionValidation = validateString(requestData.action, 'action', {
      required: true,
      pattern: /^(request|confirm)$/,
    });

    if (!actionValidation.isValid) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "request" or "confirm"' },
        { status: 400 }
      );
    }

    const action = actionValidation.sanitizedData as string;
    const dataPrivacyService = new DataPrivacyService(user.id);

    if (action === 'request') {
      // Request data deletion (sends confirmation email)
      const result = await dataPrivacyService.requestDataDeletion(user.id);
      
      return NextResponse.json({
        success: result.success,
        message: result.message,
      }, {
        status: result.success ? 200 : 400,
      });

    } else if (action === 'confirm') {
      // Confirm and execute data deletion
      if (!requestData.confirmationToken) {
        return NextResponse.json(
          { error: 'Confirmation token is required' },
          { status: 400 }
        );
      }

      // Validate confirmation token
      const tokenValidation = validateString(requestData.confirmationToken, 'confirmationToken', {
        required: true,
        minLength: 32,
        maxLength: 128,
      });

      if (!tokenValidation.isValid) {
        return NextResponse.json(
          { error: 'Invalid confirmation token' },
          { status: 400 }
        );
      }

      const confirmationToken = tokenValidation.sanitizedData as string;

      // Execute data deletion
      const deletionResult = await dataPrivacyService.deleteUserData(user.id, confirmationToken);

      if (!deletionResult.success) {
        return NextResponse.json({
          success: false,
          message: 'Failed to delete user data',
          errors: deletionResult.errors,
        }, {
          status: 400,
        });
      }

      return NextResponse.json({
        success: true,
        message: 'User data has been successfully deleted',
        deletedItems: deletionResult.deletedItems,
      }, {
        status: 200,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Data deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to process deletion request. Please try again later.' },
      { status: 500 }
    );
  }
}

// Apply middleware with very strict rate limiting for data deletion
const handler = withAuth(
  withRateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    maxRequests: 5, // Only 5 deletion requests per day
    message: 'Too many deletion requests. Please try again tomorrow.',
  })(handleDataDeletion)
);

export { handler as POST };