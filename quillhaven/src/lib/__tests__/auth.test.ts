import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  generateSecureToken,
  registerUser,
  loginUser,
  verifyEmail,
  initiatePasswordReset,
  resetPassword,
  logoutUser,
  getUserFromToken,
} from '../auth';
import type { User } from '@prisma/client';

// Mock Prisma
jest.mock('../prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    session: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

import { prisma } from '../prisma';

// Type the mocked prisma properly
const mockPrisma = {
  user: {
    findUnique: prisma.user.findUnique as jest.MockedFunction<
      typeof prisma.user.findUnique
    >,
    findFirst: prisma.user.findFirst as jest.MockedFunction<
      typeof prisma.user.findFirst
    >,
    create: prisma.user.create as jest.MockedFunction<
      typeof prisma.user.create
    >,
    update: prisma.user.update as jest.MockedFunction<
      typeof prisma.user.update
    >,
  },
  session: {
    create: prisma.session.create as jest.MockedFunction<
      typeof prisma.session.create
    >,
    findUnique: prisma.session.findUnique as jest.MockedFunction<
      typeof prisma.session.findUnique
    >,
    delete: prisma.session.delete as jest.MockedFunction<
      typeof prisma.session.delete
    >,
    deleteMany: prisma.session.deleteMany as jest.MockedFunction<
      typeof prisma.session.deleteMany
    >,
  },
};

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Password utilities', () => {
    describe('hashPassword', () => {
      it('should hash a password', async () => {
        const password = 'testPassword123!';
        const hash = await hashPassword(password);

        expect(hash).toBeDefined();
        expect(hash).not.toBe(password);
        expect(hash.length).toBeGreaterThan(50);
      });

      it('should generate different hashes for the same password', async () => {
        const password = 'testPassword123!';
        const hash1 = await hashPassword(password);
        const hash2 = await hashPassword(password);

        expect(hash1).not.toBe(hash2);
      });
    });

    describe('verifyPassword', () => {
      it('should verify correct password', async () => {
        const password = 'testPassword123!';
        const hash = await hashPassword(password);

        const isValid = await verifyPassword(password, hash);
        expect(isValid).toBe(true);
      });

      it('should reject incorrect password', async () => {
        const password = 'testPassword123!';
        const wrongPassword = 'wrongPassword123!';
        const hash = await hashPassword(password);

        const isValid = await verifyPassword(wrongPassword, hash);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('Token utilities', () => {
    const mockUser: User = {
      id: 'user-123',
      email: 'test@example.com',
      passwordHash: 'hashed-password',
      firstName: 'Test',
      lastName: 'User',
      subscriptionTier: 'FREE',
      writingPreferences: null,
      emailVerified: new Date(),
      emailVerificationToken: null,
      passwordResetToken: null,
      passwordResetExpires: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    describe('generateToken', () => {
      it('should generate a JWT token', () => {
        const token = generateToken(mockUser);

        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
      });
    });

    describe('verifyToken', () => {
      it('should verify valid token', () => {
        const token = generateToken(mockUser);
        const payload = verifyToken(token);

        expect(payload).toBeDefined();
        expect(payload?.userId).toBe(mockUser.id);
        expect(payload?.email).toBe(mockUser.email);
      });

      it('should reject invalid token', () => {
        const invalidToken = 'invalid.token.here';
        const payload = verifyToken(invalidToken);

        expect(payload).toBeNull();
      });
    });

    describe('generateSecureToken', () => {
      it('should generate a secure random token', () => {
        const token = generateSecureToken();

        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        expect(token.length).toBe(64); // 32 bytes = 64 hex characters
      });

      it('should generate different tokens', () => {
        const token1 = generateSecureToken();
        const token2 = generateSecureToken();

        expect(token1).not.toBe(token2);
      });
    });
  });

  describe('User registration', () => {
    describe('registerUser', () => {
      it('should register a new user successfully', async () => {
        const mockCreatedUser = {
          id: 'user-123',
          email: 'test@example.com',
          passwordHash: 'hashed-password',
          firstName: 'Test',
          lastName: 'User',
          emailVerificationToken: 'verification-token',
          subscriptionTier: 'FREE' as const,
          writingPreferences: null,
          emailVerified: null,
          passwordResetToken: null,
          passwordResetExpires: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockPrisma.user.findUnique.mockResolvedValue(null); // User doesn't exist
        mockPrisma.user.create.mockResolvedValue(mockCreatedUser);

        const result = await registerUser(
          'test@example.com',
          'Password123!',
          'Test',
          'User'
        );

        expect(result.success).toBe(true);
        expect(result.user).toBeDefined();
        expect(result.user?.email).toBe('test@example.com');
        expect(result.user?.firstName).toBe('Test');
        expect(result.message).toContain('registered successfully');
      });

      it('should reject registration for existing user', async () => {
        const existingUser = {
          id: 'user-123',
          email: 'test@example.com',
          passwordHash: 'hashed-password',
        };

        mockPrisma.user.findUnique.mockResolvedValue(existingUser as any);

        const result = await registerUser('test@example.com', 'Password123!');

        expect(result.success).toBe(false);
        expect(result.message).toContain('already exists');
        expect(mockPrisma.user.create).not.toHaveBeenCalled();
      });

      it('should handle registration errors', async () => {
        mockPrisma.user.findUnique.mockResolvedValue(null);
        mockPrisma.user.create.mockRejectedValue(new Error('Database error'));

        const result = await registerUser('test@example.com', 'Password123!');

        expect(result.success).toBe(false);
        expect(result.message).toContain('Registration failed');
      });
    });
  });

  describe('User login', () => {
    describe('loginUser', () => {
      it('should login user with valid credentials', async () => {
        const password = 'Password123!';
        const hashedPassword = await hashPassword(password);

        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          passwordHash: hashedPassword,
          firstName: 'Test',
          lastName: 'User',
          subscriptionTier: 'FREE',
          writingPreferences: null,
          emailVerified: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
        mockPrisma.session.create.mockResolvedValue({} as any);

        const result = await loginUser('test@example.com', password);

        expect(result.success).toBe(true);
        expect(result.token).toBeDefined();
        expect(result.user?.email).toBe('test@example.com');
        expect(mockPrisma.session.create).toHaveBeenCalled();
      });

      it('should reject login for non-existent user', async () => {
        mockPrisma.user.findUnique.mockResolvedValue(null);

        const result = await loginUser(
          'nonexistent@example.com',
          'Password123!'
        );

        expect(result.success).toBe(false);
        expect(result.message).toContain('Invalid email or password');
        expect(mockPrisma.session.create).not.toHaveBeenCalled();
      });

      it('should reject login with wrong password', async () => {
        const correctPassword = 'Password123!';
        const wrongPassword = 'WrongPassword123!';
        const hashedPassword = await hashPassword(correctPassword);

        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          passwordHash: hashedPassword,
        };

        mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);

        const result = await loginUser('test@example.com', wrongPassword);

        expect(result.success).toBe(false);
        expect(result.message).toContain('Invalid email or password');
        expect(mockPrisma.session.create).not.toHaveBeenCalled();
      });
    });
  });

  describe('Email verification', () => {
    describe('verifyEmail', () => {
      it('should verify email with valid token', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          emailVerificationToken: 'valid-token',
        };

        const mockUpdatedUser = {
          ...mockUser,
          emailVerified: new Date(),
          emailVerificationToken: null,
        };

        mockPrisma.user.findFirst.mockResolvedValue(mockUser as any);
        mockPrisma.user.update.mockResolvedValue(mockUpdatedUser as any);

        const result = await verifyEmail('valid-token');

        expect(result.success).toBe(true);
        expect(result.user?.emailVerified).toBeDefined();
        expect(mockPrisma.user.update).toHaveBeenCalledWith({
          where: { id: 'user-123' },
          data: {
            emailVerified: expect.any(Date),
            emailVerificationToken: null,
          },
        });
      });

      it('should reject invalid verification token', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(null);

        const result = await verifyEmail('invalid-token');

        expect(result.success).toBe(false);
        expect(result.message).toContain('Invalid verification token');
        expect(mockPrisma.user.update).not.toHaveBeenCalled();
      });
    });
  });

  describe('Password reset', () => {
    describe('initiatePasswordReset', () => {
      it('should initiate password reset for existing user', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
        };

        mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
        mockPrisma.user.update.mockResolvedValue({} as any);

        const result = await initiatePasswordReset('test@example.com');

        expect(result.success).toBe(true);
        expect(result.message).toContain('password reset link');
        expect(mockPrisma.user.update).toHaveBeenCalledWith({
          where: { id: 'user-123' },
          data: {
            passwordResetToken: expect.any(String),
            passwordResetExpires: expect.any(Date),
          },
        });
      });

      it('should return success even for non-existent user (security)', async () => {
        mockPrisma.user.findUnique.mockResolvedValue(null);

        const result = await initiatePasswordReset('nonexistent@example.com');

        expect(result.success).toBe(true);
        expect(result.message).toContain('password reset link');
        expect(mockPrisma.user.update).not.toHaveBeenCalled();
      });
    });

    describe('resetPassword', () => {
      it('should reset password with valid token', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          passwordResetToken: 'valid-reset-token',
          passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        };

        const mockUpdatedUser = {
          ...mockUser,
          passwordHash: 'new-hashed-password',
          passwordResetToken: null,
          passwordResetExpires: null,
        };

        mockPrisma.user.findFirst.mockResolvedValue(mockUser as any);
        mockPrisma.user.update.mockResolvedValue(mockUpdatedUser as any);
        mockPrisma.session.deleteMany.mockResolvedValue({} as any);

        const result = await resetPassword(
          'valid-reset-token',
          'NewPassword123!'
        );

        expect(result.success).toBe(true);
        expect(result.message).toContain('reset successfully');
        expect(mockPrisma.user.update).toHaveBeenCalled();
        expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
          where: { userId: 'user-123' },
        });
      });

      it('should reject expired reset token', async () => {
        const mockUser = {
          id: 'user-123',
          passwordResetToken: 'expired-token',
          passwordResetExpires: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        };

        mockPrisma.user.findFirst.mockResolvedValue(null); // Expired token won't be found

        const result = await resetPassword('expired-token', 'NewPassword123!');

        expect(result.success).toBe(false);
        expect(result.message).toContain('Invalid or expired');
        expect(mockPrisma.user.update).not.toHaveBeenCalled();
      });
    });
  });

  describe('Session management', () => {
    describe('logoutUser', () => {
      it('should logout user successfully', async () => {
        mockPrisma.session.delete.mockResolvedValue({} as any);

        const result = await logoutUser('valid-token');

        expect(result.success).toBe(true);
        expect(result.message).toContain('Logged out successfully');
        expect(mockPrisma.session.delete).toHaveBeenCalledWith({
          where: { token: 'valid-token' },
        });
      });

      it('should handle non-existent session gracefully', async () => {
        mockPrisma.session.delete.mockRejectedValue(
          new Error('Session not found')
        );

        const result = await logoutUser('non-existent-token');

        expect(result.success).toBe(true);
        expect(result.message).toContain('Logged out successfully');
      });
    });

    describe('getUserFromToken', () => {
      it('should get user from valid token', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
        };

        const token = generateToken(mockUser as any);

        const mockSession = {
          token,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          user: mockUser,
        };

        mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);

        const result = await getUserFromToken(token);

        expect(result).toBeDefined();
        expect(result?.id).toBe('user-123');
        expect(result?.email).toBe('test@example.com');
      });

      it('should return null for invalid token', async () => {
        const result = await getUserFromToken('invalid-token');

        expect(result).toBeNull();
      });

      it('should return null for expired session', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
        };

        const token = generateToken(mockUser as any);
        mockPrisma.session.findUnique.mockResolvedValue(null); // Expired session not found

        const result = await getUserFromToken(token);

        expect(result).toBeNull();
      });
    });
  });
});
