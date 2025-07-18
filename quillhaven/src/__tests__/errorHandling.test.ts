import { NextRequest, NextResponse } from 'next/server';
import { 
  AppError, 
  ValidationError, 
  AuthenticationError, 
  NotFoundError,
  withErrorHandler,
  handleDatabaseError,
  handleExternalServiceCall
} from '@/lib/errorHandler';
import { logger } from '@/lib/logger';

// Mock the logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Error Handling System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AppError Classes', () => {
    it('should create AppError with correct properties', () => {
      const error = new AppError('Test error', 400, true, { detail: 'test' });
      
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
      expect(error.details).toEqual({ detail: 'test' });
    });

    it('should create ValidationError with 400 status', () => {
      const error = new ValidationError('Invalid input');
      
      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
    });

    it('should create AuthenticationError with 401 status', () => {
      const error = new AuthenticationError();
      
      expect(error.message).toBe('Authentication required');
      expect(error.statusCode).toBe(401);
      expect(error.isOperational).toBe(true);
    });

    it('should create NotFoundError with 404 status', () => {
      const error = new NotFoundError();
      
      expect(error.message).toBe('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.isOperational).toBe(true);
    });
  });

  describe('withErrorHandler middleware', () => {
    it('should handle successful requests', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      );
      
      const wrappedHandler = withErrorHandler(mockHandler);
      const request = new NextRequest('http://localhost/test');
      
      const response = await wrappedHandler(request);
      const data = await response.json();
      
      expect(data).toEqual({ success: true });
      expect(mockHandler).toHaveBeenCalledWith(request);
      expect(logger.info).toHaveBeenCalledWith(
        'Incoming request',
        expect.objectContaining({
          method: 'GET',
          url: 'http://localhost/test',
        })
      );
    });

    it('should handle AppError correctly', async () => {
      const mockHandler = jest.fn().mockRejectedValue(
        new ValidationError('Invalid data', { field: 'email' })
      );
      
      const wrappedHandler = withErrorHandler(mockHandler);
      const request = new NextRequest('http://localhost/test');
      
      const response = await wrappedHandler(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data).toMatchObject({
        error: 'ValidationError',
        message: 'Invalid data',
        statusCode: 400,
        details: { field: 'email' },
      });
      expect(logger.warn).toHaveBeenCalledWith(
        'Operational error',
        expect.objectContaining({
          error: 'Invalid data',
          statusCode: 400,
        })
      );
    });

    it('should handle unexpected errors', async () => {
      const mockHandler = jest.fn().mockRejectedValue(
        new Error('Unexpected error')
      );
      
      const wrappedHandler = withErrorHandler(mockHandler);
      const request = new NextRequest('http://localhost/test');
      
      const response = await wrappedHandler(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data).toMatchObject({
        error: 'InternalServerError',
        message: 'An unexpected error occurred',
        statusCode: 500,
      });
      expect(logger.error).toHaveBeenCalledWith(
        'Unexpected error',
        expect.objectContaining({
          error: 'Unexpected error',
        })
      );
    });

    it('should add request ID to response headers', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      );
      
      const wrappedHandler = withErrorHandler(mockHandler);
      const request = new NextRequest('http://localhost/test');
      
      const response = await wrappedHandler(request);
      
      expect(response.headers.get('x-request-id')).toMatch(/^req_\d+_[a-z0-9]+$/);
    });
  });

  describe('handleDatabaseError', () => {
    it('should handle Prisma unique constraint error', () => {
      const prismaError = {
        code: 'P2002',
        message: 'Unique constraint failed',
      };
      
      const appError = handleDatabaseError(prismaError);
      
      expect(appError).toBeInstanceOf(AppError);
      expect(appError.statusCode).toBe(409);
      expect(appError.message).toBe('A record with this information already exists');
    });

    it('should handle Prisma record not found error', () => {
      const prismaError = {
        code: 'P2025',
        message: 'Record not found',
      };
      
      const appError = handleDatabaseError(prismaError);
      
      expect(appError).toBeInstanceOf(AppError);
      expect(appError.statusCode).toBe(404);
      expect(appError.message).toBe('The requested record was not found');
    });

    it('should handle unknown database errors', () => {
      const unknownError = new Error('Unknown database error');
      
      const appError = handleDatabaseError(unknownError);
      
      expect(appError).toBeInstanceOf(AppError);
      expect(appError.statusCode).toBe(500);
      expect(appError.message).toBe('Database operation failed');
      expect(appError.isOperational).toBe(false);
    });
  });

  describe('handleExternalServiceCall', () => {
    it('should succeed on first attempt', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      const result = await handleExternalServiceCall(
        'test-service',
        mockOperation,
        3,
        1000
      );
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValue('success');
      
      const result = await handleExternalServiceCall(
        'test-service',
        mockOperation,
        3,
        100 // Short delay for testing
      );
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
      expect(logger.warn).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith(
        'External service call succeeded after retries',
        expect.objectContaining({
          service: 'test-service',
          attempt: 3,
          maxRetries: 3,
        })
      );
    });

    it('should fail after max retries', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Persistent failure'));
      
      await expect(
        handleExternalServiceCall('test-service', mockOperation, 2, 100)
      ).rejects.toThrow('External service test-service is currently unavailable');
      
      expect(mockOperation).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenCalledWith(
        'External service call failed after all retries',
        expect.objectContaining({
          service: 'test-service',
          maxRetries: 2,
        })
      );
    });
  });
});

describe('Graceful Degradation', () => {
  // These tests would require mocking the graceful degradation system
  // For now, we'll add basic structure tests
  
  it('should be tested with proper mocking setup', () => {
    // TODO: Add comprehensive graceful degradation tests
    // This would require mocking Redis, external services, etc.
    expect(true).toBe(true);
  });
});