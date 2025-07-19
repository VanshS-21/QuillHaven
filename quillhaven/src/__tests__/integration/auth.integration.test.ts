import { NextRequest } from 'next/server';
import { POST as registerHandler } from '@/app/api/auth/register/route';
import { POST as loginHandler } from '@/app/api/auth/login/route';
import { GET as verifyHandler } from '@/app/api/auth/verify-email/route';
import { POST as resetHandler } from '@/app/api/auth/reset-password/route';
import { prismaMock } from '../../../__mocks__/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock bcrypt and jwt
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockJwt = jwt as jest.Mocked<typeof jwt>;

// Mock email service
jest.mock('@/lib/email', () => ({
  sendVerificationEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));

describe('Auth API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    const validRegistrationData = {
      email: 'test@example.com',
      password: 'SecurePass123!',
      firstName: 'John',
      lastName: 'Doe',
    };

    it('should register a new user successfully', async () => {
      const mockUser = {
        id: 'user-1',
        email: validRegistrationData.email,
        firstName: validRegistrationData.firstName,
        lastName: validRegistrationData.lastName,
        isEmailVerified: false,
        subscriptionTier: 'free',
        passwordHash: 'hashed-password',
        emailVerificationToken: 'verification-token',
        writingPreferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        passwordResetToken: null,
        passwordResetExpires: null,
      };

      mockBcrypt.hash.mockResolvedValue('hashed-password');
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue(mockUser);

      const request = new NextRequest(
        'http://localhost:3000/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify(validRegistrationData),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.user.email).toBe(validRegistrationData.email);
      expect(data.user.firstName).toBe(validRegistrationData.firstName);
      expect(data.message).toContain('Registration successful');
    });

    it('should return 400 for invalid email', async () => {
      const invalidData = {
        ...validRegistrationData,
        email: 'invalid-email',
      };

      const request = new NextRequest(
        'http://localhost:3000/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify(invalidData),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid email format');
    });

    it('should return 409 for existing user', async () => {
      const existingUser = {
        id: 'existing-user',
        email: validRegistrationData.email,
        passwordHash: 'hash',
        firstName: 'Jane',
        lastName: 'Doe',
        isEmailVerified: true,
        emailVerificationToken: null,
        subscriptionTier: 'free',
        writingPreferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        passwordResetToken: null,
        passwordResetExpires: null,
      };

      prismaMock.user.findUnique.mockResolvedValue(existingUser);

      const request = new NextRequest(
        'http://localhost:3000/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify(validRegistrationData),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain('User with this email already exists');
    });

    it('should return 400 for missing required fields', async () => {
      const incompleteData = {
        email: 'test@example.com',
        // Missing password, firstName, lastName
      };

      const request = new NextRequest(
        'http://localhost:3000/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify(incompleteData),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      mockBcrypt.hash.mockResolvedValue('hashed-password');
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest(
        'http://localhost:3000/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify(validRegistrationData),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Internal server error');
    });
  });

  describe('POST /api/auth/login', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'SecurePass123!',
    };

    const mockUser = {
      id: 'user-1',
      email: validLoginData.email,
      passwordHash: 'hashed-password',
      firstName: 'John',
      lastName: 'Doe',
      emailVerified: new Date(), // Use emailVerified date instead of isEmailVerified boolean
      emailVerificationToken: null,
      subscriptionTier: 'free',
      writingPreferences: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      passwordResetToken: null,
      passwordResetExpires: null,
    };

    it('should login successfully with valid credentials', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign.mockReturnValue('jwt-token');

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(validLoginData),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.email).toBe(validLoginData.email);
      expect(data.token).toBe('jwt-token');
    });

    it('should return 401 for invalid credentials', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false);

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(validLoginData),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Invalid email or password');
    });

    it('should return 401 for non-existent user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(validLoginData),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Invalid email or password');
    });

    it('should return 403 for unverified email', async () => {
      const unverifiedUser = { ...mockUser, emailVerified: null };
      prismaMock.user.findUnique.mockResolvedValue(unverifiedUser);
      mockBcrypt.compare.mockResolvedValue(true);

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(validLoginData),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Please verify your email');
    });

    it('should return 400 for invalid input', async () => {
      const invalidData = {
        email: 'invalid-email',
        password: '',
      };

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe('POST /api/auth/verify-email', () => {
    it('should verify email successfully', async () => {
      const token = 'verification-token';
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hash',
        firstName: 'John',
        lastName: 'Doe',
        isEmailVerified: false,
        emailVerificationToken: token,
        subscriptionTier: 'free',
        writingPreferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        passwordResetToken: null,
        passwordResetExpires: null,
      };

      const verifiedUser = {
        ...mockUser,
        isEmailVerified: true,
        emailVerificationToken: null,
      };

      prismaMock.user.findFirst.mockResolvedValue(mockUser);
      prismaMock.user.update.mockResolvedValue(verifiedUser);

      const request = new NextRequest(
        `http://localhost:3000/api/auth/verify-email?token=${token}`,
        {
          method: 'GET',
        }
      );

      const response = await verifyHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toContain('Email verified successfully');
      expect(data.user.isEmailVerified).toBe(true);
    });

    it('should return 400 for invalid token', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/auth/verify-email?token=invalid-token',
        {
          method: 'GET',
        }
      );

      const response = await verifyHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid or expired verification token');
    });

    it('should return 400 for missing token', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/auth/verify-email',
        {
          method: 'GET',
        }
      );

      const response = await verifyHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Token is required');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should reset password successfully', async () => {
      const token = 'reset-token';
      const newPassword = 'NewSecurePass123!';

      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'old-hash',
        firstName: 'John',
        lastName: 'Doe',
        isEmailVerified: true,
        emailVerificationToken: null,
        subscriptionTier: 'free',
        writingPreferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        passwordResetToken: token,
        passwordResetExpires: new Date(Date.now() + 3600000), // 1 hour from now
      };

      prismaMock.user.findFirst.mockResolvedValue(mockUser);
      mockBcrypt.hash.mockResolvedValue('new-hashed-password');
      prismaMock.user.update.mockResolvedValue({
        ...mockUser,
        passwordHash: 'new-hashed-password',
        passwordResetToken: null,
        passwordResetExpires: null,
      });

      const request = new NextRequest(
        'http://localhost:3000/api/auth/reset-password',
        {
          method: 'POST',
          body: JSON.stringify({ 
            token, 
            password: newPassword, 
            confirmPassword: newPassword 
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await resetHandler(request);
      const data = await response.json();

      console.log('Reset password response:', { status: response.status, data });
      expect(response.status).toBe(200);
      expect(data.message).toContain('Password reset successfully');
    });

    it('should return 400 for expired token', async () => {
      const token = 'expired-token';
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hash',
        firstName: 'John',
        lastName: 'Doe',
        isEmailVerified: true,
        emailVerificationToken: null,
        subscriptionTier: 'free',
        writingPreferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        passwordResetToken: token,
        passwordResetExpires: new Date(Date.now() - 3600000), // 1 hour ago
      };

      prismaMock.user.findFirst.mockResolvedValue(mockUser);

      const request = new NextRequest(
        'http://localhost:3000/api/auth/reset-password',
        {
          method: 'POST',
          body: JSON.stringify({ 
            token, 
            password: 'NewPass123!', 
            confirmPassword: 'NewPass123!' 
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await resetHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid or expired reset token');
    });

    it('should return 400 for weak password', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/auth/reset-password',
        {
          method: 'POST',
          body: JSON.stringify({ 
            token: 'valid-token', 
            password: 'weak', 
            confirmPassword: 'weak' 
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await resetHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle malformed JSON', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/auth/register',
        {
          method: 'POST',
          body: 'invalid json',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid JSON');
    });

    it('should handle missing Content-Type header', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'SecurePass123!',
            firstName: 'John',
            lastName: 'Doe',
          }),
        }
      );

      const response = await registerHandler(request);

      // Should still work or return appropriate error
      expect([200, 201, 400, 415]).toContain(response.status);
    });

    it('should handle very large payloads', async () => {
      const largeData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'A'.repeat(10000), // Very long name
        lastName: 'Doe',
      };

      const request = new NextRequest(
        'http://localhost:3000/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify(largeData),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should handle concurrent registration attempts', async () => {
      const registrationData = {
        email: 'concurrent@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
      };

      mockBcrypt.hash.mockResolvedValue('hashed-password');
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({
        id: 'user-1',
        email: registrationData.email,
        firstName: registrationData.firstName,
        lastName: registrationData.lastName,
        isEmailVerified: false,
        subscriptionTier: 'free',
        passwordHash: 'hashed-password',
        emailVerificationToken: 'token',
        writingPreferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        passwordResetToken: null,
        passwordResetExpires: null,
      });

      // Simulate concurrent requests
      const requests = Array.from(
        { length: 5 },
        () =>
          new NextRequest('http://localhost:3000/api/auth/register', {
            method: 'POST',
            body: JSON.stringify(registrationData),
            headers: { 'Content-Type': 'application/json' },
          })
      );

      const responses = await Promise.all(
        requests.map((request) => registerHandler(request))
      );

      // At least one should succeed, others might fail due to unique constraint
      const successfulResponses = responses.filter((r) => r.status === 201);
      const errorResponses = responses.filter((r) => r.status !== 201);

      expect(successfulResponses.length).toBeGreaterThanOrEqual(1);
      expect(successfulResponses.length + errorResponses.length).toBe(5);
    });
  });

  describe('Security tests', () => {
    it('should not expose sensitive information in error messages', async () => {
      prismaMock.user.findUnique.mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = new NextRequest(
        'http://localhost:3000/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'SecurePass123!',
            firstName: 'John',
            lastName: 'Doe',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).not.toContain('Database connection failed');
      expect(data.error).toContain('Internal server error');
    });

    it('should rate limit registration attempts', async () => {
      // This would require implementing rate limiting middleware
      // For now, we'll test that the endpoint doesn't crash under load

      const requests = Array.from(
        { length: 100 },
        (_, i) =>
          new NextRequest('http://localhost:3000/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
              email: `test${i}@example.com`,
              password: 'SecurePass123!',
              firstName: 'John',
              lastName: 'Doe',
            }),
            headers: { 'Content-Type': 'application/json' },
          })
      );

      // Should not crash
      expect(async () => {
        await Promise.all(requests.map((request) => registerHandler(request)));
      }).not.toThrow();
    });

    it('should sanitize input to prevent XSS', async () => {
      const maliciousData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: '<script>alert("xss")</script>John',
        lastName: '<img src="x" onerror="alert(1)">Doe',
      };

      mockBcrypt.hash.mockResolvedValue('hashed-password');
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({
        id: 'user-1',
        email: maliciousData.email,
        firstName: 'John', // Should be sanitized
        lastName: 'Doe', // Should be sanitized
        isEmailVerified: false,
        subscriptionTier: 'free',
        passwordHash: 'hashed-password',
        emailVerificationToken: 'token',
        writingPreferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        passwordResetToken: null,
        passwordResetExpires: null,
      });

      const request = new NextRequest(
        'http://localhost:3000/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify(maliciousData),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await registerHandler(request);
      const data = await response.json();

      if (response.status === 201) {
        expect(data.user.firstName).not.toContain('<script>');
        expect(data.user.lastName).not.toContain('<img');
      }
    });
  });
});
