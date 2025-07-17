import nodemailer from 'nodemailer';

// Email configuration
const EMAIL_CONFIG = {
  host: process.env.EMAIL_SERVER_HOST || 'localhost',
  port: parseInt(process.env.EMAIL_SERVER_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
};

const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@quillhaven.com';
const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

// Create transporter
const transporter = nodemailer.createTransport(EMAIL_CONFIG);

export interface EmailResult {
  success: boolean;
  message?: string;
}

/**
 * Send email verification
 */
export async function sendVerificationEmail(
  email: string,
  token: string,
  firstName?: string
): Promise<EmailResult> {
  try {
    const verificationUrl = `${BASE_URL}/auth/verify-email?token=${token}`;

    const mailOptions = {
      from: FROM_EMAIL,
      to: email,
      subject: 'Verify your QuillHaven account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to QuillHaven${firstName ? `, ${firstName}` : ''}!</h2>
          
          <p>Thank you for signing up for QuillHaven, your AI-powered writing companion.</p>
          
          <p>To complete your registration and start your writing journey, please verify your email address by clicking the button below:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          
          <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
          
          <p>This verification link will expire in 24 hours.</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #666; font-size: 14px;">
            If you didn't create an account with QuillHaven, you can safely ignore this email.
          </p>
          
          <p style="color: #666; font-size: 14px;">
            Happy writing!<br>
            The QuillHaven Team
          </p>
        </div>
      `,
      text: `
        Welcome to QuillHaven${firstName ? `, ${firstName}` : ''}!
        
        Thank you for signing up for QuillHaven, your AI-powered writing companion.
        
        To complete your registration, please verify your email address by visiting:
        ${verificationUrl}
        
        This verification link will expire in 24 hours.
        
        If you didn't create an account with QuillHaven, you can safely ignore this email.
        
        Happy writing!
        The QuillHaven Team
      `,
    };

    await transporter.sendMail(mailOptions);

    return {
      success: true,
      message: 'Verification email sent successfully',
    };
  } catch (error) {
    console.error('Send verification email error:', error);
    return {
      success: false,
      message: 'Failed to send verification email',
    };
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  token: string,
  firstName?: string
): Promise<EmailResult> {
  try {
    const resetUrl = `${BASE_URL}/auth/reset-password?token=${token}`;

    const mailOptions = {
      from: FROM_EMAIL,
      to: email,
      subject: 'Reset your QuillHaven password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          
          <p>Hello${firstName ? ` ${firstName}` : ''},</p>
          
          <p>We received a request to reset the password for your QuillHaven account.</p>
          
          <p>To reset your password, click the button below:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </div>
          
          <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>
          
          <p><strong>This password reset link will expire in 1 hour.</strong></p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #666; font-size: 14px;">
            If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
          </p>
          
          <p style="color: #666; font-size: 14px;">
            For security reasons, this link can only be used once.
          </p>
          
          <p style="color: #666; font-size: 14px;">
            Best regards,<br>
            The QuillHaven Team
          </p>
        </div>
      `,
      text: `
        Password Reset Request
        
        Hello${firstName ? ` ${firstName}` : ''},
        
        We received a request to reset the password for your QuillHaven account.
        
        To reset your password, visit:
        ${resetUrl}
        
        This password reset link will expire in 1 hour.
        
        If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
        
        For security reasons, this link can only be used once.
        
        Best regards,
        The QuillHaven Team
      `,
    };

    await transporter.sendMail(mailOptions);

    return {
      success: true,
      message: 'Password reset email sent successfully',
    };
  } catch (error) {
    console.error('Send password reset email error:', error);
    return {
      success: false,
      message: 'Failed to send password reset email',
    };
  }
}

/**
 * Test email configuration
 */
export async function testEmailConnection(): Promise<EmailResult> {
  try {
    await transporter.verify();
    return {
      success: true,
      message: 'Email configuration is valid',
    };
  } catch (error) {
    console.error('Email connection test error:', error);
    return {
      success: false,
      message: 'Email configuration is invalid',
    };
  }
}
