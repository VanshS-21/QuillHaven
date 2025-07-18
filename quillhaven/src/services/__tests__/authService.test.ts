import { AuthService } from '../authService';
import { prismaMock } from '../../../__mocks__/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '@prisma/client';

// Mock bcrypt
jest.mock('bcryptjs');
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

// Mock jwt
jest.mock('jsonwebtoken');
const mockJwt = jwt as jest.Mocked<typeof jwt>;

// Mock email service
jest.mock('@/lib/email', () => ({
  sendVerificationEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  describe('register', () => {
    const mockUserData = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
    };

    it('should register a new user successfully', async () => {
      const hashedPassword = 'hashedPassword123';
      const mockUser: User = {
        id: '1',
        email: mockUserData.email,
        passwordHash: hashedPassword,
        firstName: mockUserData.firstName,
        lastName: mockUserData.lastName,
        isEmailVerified: false,
        emailVerificationToken: 'verification-token',
        subscriptionTier: 'free',
        writingPreferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        passwordResetToken: null,
        passwordResetExpires: null,
      };

      mockBcrypt.hash.mockResolvedValue(hashedPassword);
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue(mockUser);

      const result = await authService.register(mockUserData);

      expect(result).toEqual({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          isEmailVerified: mockUser.isEmailVerified,
          subscriptionTier: mockUser.subscriptionTier,
        },
        message: 'Registration successful. Please check your email for verification.',
      });

      expect(mockBcrypt.hash).toHaveBeenCalledWith(mockUserData.password, 12);
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: {
          email: mockUserData.email,
          passwordHash: hashedPassword,
          firstName: mockUserData.firstName,
          lastName: mockUserData.lastName,
          emailVerificationToken: expect.any(String),
          writingPreferences: {},
        },
      });
    });

    it('should throw error if user already exists', async () => {
      const existingUser: User = {
        id: '1',
        email: mockUserData.email,
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

      await expect(authService.register(mockUserData)).rejects.toThrow(
        'User with this email already exists'
      );
    });

    it('should validate email format', async () => {
      const invalidEmailData = {
        ...mockUserData,
        email: 'invalid-email',
      };

      await expect(authService.register(invalidEmailData)).rejects.toThrow(
        'Invalid email format'
      );
    });

    it('should validate password strength', async () => {
      const weakPasswordData = {
        ...mockUserData,
        password: '123',
      };

      await expect(authService.register(weakPasswordData)).rejects.toThrow(
        'Password must be at least 8 characters long'
      );
    });
  });

  describe('login', () => {
    const loginData = {
      email: 'test@example.com',
      password: 'password123',
    };

    const mockUser: User = {
      id: '1',
      email: loginData.email,
      passwordHash: 'hashedPassword',
      firstName: 'John',
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

    it('should login successfully with valid credentials', async () => {
      const mockToken = 'jwt-token';

      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign.mockReturnValue(mockToken);

      const result = await authService.login(loginData);

      expect(result).toEqual({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          isEmailVerified: mockUser.isEmailVerified,
          subscriptionTier: mockUser.subscriptionTier,
        },
        token: mockToken,
      });

      expect(mockBcrypt.compare).toHaveBeenCalledWith(
        loginData.password,
        mockUser.passwordHash
      );
      expect(mockJwt.sign).toHaveBeenCalledWith(
        { userId: mockUser.id, email: mockUser.email },
        expect.any(String),
        { expiresIn: '24h' }
      );
    });

    it('should throw error for non-existent user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(authService.login(loginData)).rejects.toThrow(
        'Invalid email or password'
      );
    });

    it('should throw error for incorrect password', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false);

      await expect(authService.login(loginData)).rejects.toThrow(
        'Invalid email or password'
      );
    });

    it('should throw error for unverified email', async () => {
      const unverifiedUser = { ...mockUser, isEmailVerified: false };
      prismaMock.user.findUnique.mockResolvedValue(unverifiedUser);
      mockBcrypt.compare.mockResolvedValue(true);

      await expect(authService.login(loginData)).rejects.toThrow(
        'Please verify your email before logging in'
      );
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      const token = 'verification-token';
      const mockUser: User = {
        id: '1',
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

      const updatedUser = { ...mockUser, isEmailVerified: true, emailVerificationToken: null };

      prismaMock.user.findFirst.mockResolvedValue(mockUser);
      prismaMock.user.update.mockResolvedValue(updatedUser);

      const result = await authService.verifyEmail(token);

      expect(result).toEqual({
        message: 'Email verified successfully',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          isEmailVerified: updatedUser.isEmailVerified,
          subscriptionTier: updatedUser.subscriptionTier,
        },
      });

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          isEmailVerified: true,
          emailVerificationToken: null,
        },
      });
    });

    it('should throw error for invalid token', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(authService.verifyEmail('invalid-token')).rejects.toThrow(
        'Invalid or expired verification token'
      );
    });
  });

  describe('requestPasswordReset', () => {
    it('should generate password reset token', async () => {
      const email = 'test@example.com';
      const mockUser: User = {
        id: '1',
        email,
        passwordHash: 'hash',
        firstName: 'John',
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

      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.user.update.mockResolvedValue({
        ...mockUser,
        passwordResetToken: 'reset-token',
        passwordResetExpires: new Date(Date.now() + 3600000),
      });

      const result = await authService.requestPasswordReset(email);

      expect(result).toEqual({
        message: 'Password reset email sent',
      });

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { email },
        data: {
          passwordResetToken: expect.any(String),
          passwordResetExpires: expect.any(Date),
        },
      });
    });

    it('should not reveal if user does not exist', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const result = await authService.requestPasswordReset('nonexistent@example.com');

      expect(result).toEqual({
        message: 'Password reset email sent',
      });
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      const token = 'reset-token';
      const newPassword = 'newPassword123';
      const hashedPassword = 'hashedNewPassword';

      const mockUser: User = {
        id: '1',
        email: 'test@example.com',
        passwordHash: 'oldHash',
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
      mockBcrypt.hash.mockResolvedValue(hashedPassword);
      prismaMock.user.update.mockResolvedValue({
        ...mockUser,
        passwordHash: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      });

      const result = await authService.resetPassword(token, newPassword);

      expect(result).toEqual({
        message: 'Password reset successfully',
      });

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          passwordHash: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      });
    });

    it('should throw error for expired token', async () => {
      const token = 'expired-token';
      const mockUser: User = {
        id: '1',
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

      await expect(authService.resetPassword(token, 'newPassword')).rejects.toThrow(
        'Invalid or expired reset token'
      );
    });
  });

  describe('validateToken', () => {
    it('should validate valid token', async () => {
      const token = 'valid-token';
      const payload = { userId: '1', email: 'test@example.com' };

      mockJwt.verify.mockReturnValue(payload);

      const result = await authService.validateToken(token);

      expect(result).toEqual(payload);
      expect(mockJwt.verify).toHaveBeenCalledWith(token, expect.any(String));
    });

    it('should throw error for invalid token', async () => {
      const token = 'invalid-token';

      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.validateToken(token)).rejects.toThrow('Invalid token');
    });
  });

  describe('refreshToken', () => {
    it('should refresh valid token', async () => {
      const oldToken = 'old-token';
      const newToken = 'new-token';
      const payload = { userId: '1', email: 'test@example.com' };

      mockJwt.verify.mockReturnValue(payload);
      mockJwt.sign.mockReturnValue(newToken);

      const result = await authService.refreshToken(oldToken);

      expect(result).toEqual({ token: newToken });
      expect(mockJwt.sign).toHaveBeenCalledWith(
        { userId: payload.userId, email: payload.email },
        expect.any(String),
        { expiresIn: '24h' }
      );
    });
  });
});