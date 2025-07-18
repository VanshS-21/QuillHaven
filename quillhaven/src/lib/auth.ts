import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from './prisma';
import type { User } from '@prisma/client';

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-development';
const JWT_EXPIRES_IN = '24h';

// Password configuration
const SALT_ROUNDS = 12;

// Token expiration times
const PASSWORD_RESET_EXPIRES = 60 * 60 * 1000; // 1 hour

export interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface AuthResult {
  success: boolean;
  user?: Omit<User, 'passwordHash'>;
  token?: string;
  message?: string;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against its hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(user: User): string {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Generate a secure random token for email verification or password reset
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a 6-digit verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Register a new user
 */
export async function registerUser(
  email: string,
  password: string,
  firstName?: string,
  lastName?: string
): Promise<AuthResult> {
  try {
    console.log(`[AUTH] Registration attempt for email: ${email}`);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      console.log(`[AUTH] User already exists for email: ${email}`);
      return {
        success: false,
        message: 'User with this email already exists',
      };
    }

    console.log(`[AUTH] Creating new user for email: ${email}`);

    // Hash password
    const passwordHash = await hashPassword(password);

    // Generate email verification code (6-digit)
    const emailVerificationToken = generateVerificationCode();

    console.log(
      `[AUTH] Generated verification token: ${emailVerificationToken}`
    );

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        emailVerificationToken,
      },
    });

    console.log(`[AUTH] User created successfully: ${user.id}`);

    // Remove password hash from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _, ...userWithoutPassword } = user;

    return {
      success: true,
      user: userWithoutPassword,
      message: 'User registered successfully. Please verify your email.',
    };
  } catch (error) {
    console.error('Registration error:', error);
    return {
      success: false,
      message: 'Registration failed. Please try again.',
    };
  }
}

/**
 * Authenticate user login
 */
export async function loginUser(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    console.log(`[AUTH] Login attempt for email: ${email}`);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      console.log(`[AUTH] User not found for email: ${email}`);
      return {
        success: false,
        message: 'Invalid email or password',
      };
    }

    console.log(
      `[AUTH] User found: ${user.id}, email verified: ${user.emailVerified ? 'yes' : 'no'}`
    );

    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      console.log(`[AUTH] Invalid password for user: ${user.id}`);
      return {
        success: false,
        message: 'Invalid email or password',
      };
    }

    console.log(`[AUTH] Password valid for user: ${user.id}`);

    // Generate JWT token
    const token = generateToken(user);

    // Create session record
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    console.log(`[AUTH] Session created for user: ${user.id}`);

    // Remove password hash from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _, ...userWithoutPassword } = user;

    return {
      success: true,
      user: userWithoutPassword,
      token,
      message: 'Login successful',
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      message: 'Login failed. Please try again.',
    };
  }
}

/**
 * Verify email with token
 */
export async function verifyEmail(token: string): Promise<AuthResult> {
  try {
    const user = await prisma.user.findFirst({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      return {
        success: false,
        message: 'Invalid verification token',
      };
    }

    // Update user as verified
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        emailVerificationToken: null,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _, ...userWithoutPassword } = updatedUser;

    return {
      success: true,
      user: userWithoutPassword,
      message: 'Email verified successfully',
    };
  } catch (error) {
    console.error('Email verification error:', error);
    return {
      success: false,
      message: 'Email verification failed',
    };
  }
}

/**
 * Initiate password reset
 */
export async function initiatePasswordReset(
  email: string
): Promise<AuthResult> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal if email exists or not
      return {
        success: true,
        message:
          'If an account with this email exists, you will receive a password reset link.',
      };
    }

    // Generate reset token
    const resetToken = generateSecureToken();
    const resetExpires = new Date(Date.now() + PASSWORD_RESET_EXPIRES);

    // Update user with reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    return {
      success: true,
      message:
        'If an account with this email exists, you will receive a password reset link.',
    };
  } catch (error) {
    console.error('Password reset initiation error:', error);
    return {
      success: false,
      message: 'Password reset failed. Please try again.',
    };
  }
}

/**
 * Reset password with token
 */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<AuthResult> {
  try {
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return {
        success: false,
        message: 'Invalid or expired reset token',
      };
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update user password and clear reset token
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    // Invalidate all existing sessions
    await prisma.session.deleteMany({
      where: { userId: user.id },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _, ...userWithoutPassword } = updatedUser;

    return {
      success: true,
      user: userWithoutPassword,
      message: 'Password reset successfully',
    };
  } catch (error) {
    console.error('Password reset error:', error);
    return {
      success: false,
      message: 'Password reset failed. Please try again.',
    };
  }
}

/**
 * Logout user by invalidating session
 */
export async function logoutUser(token: string): Promise<AuthResult> {
  try {
    await prisma.session.delete({
      where: { token },
    });

    return {
      success: true,
      message: 'Logged out successfully',
    };
  } catch {
    // Session might not exist, which is fine
    return {
      success: true,
      message: 'Logged out successfully',
    };
  }
}

/**
 * Get user from token
 */
export async function getUserFromToken(token: string): Promise<User | null> {
  try {
    // Verify JWT token
    const payload = verifyToken(token);
    if (!payload) {
      return null;
    }

    // Check if session exists and is valid
    const session = await prisma.session.findUnique({
      where: {
        token,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: { user: true },
    });

    return session?.user || null;
  } catch (error) {
    console.error('Get user from token error:', error);
    return null;
  }
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<void> {
  try {
    await prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  } catch (error) {
    console.error('Session cleanup error:', error);
  }
}
