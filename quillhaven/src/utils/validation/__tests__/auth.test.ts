import {
  validateEmail,
  validatePassword,
  validateName,
  validateRegistration,
  validateLogin,
  validatePasswordResetRequest,
  validatePasswordReset,
  sanitizeEmail,
  sanitizeName,
} from '../auth';

describe('Auth Validation', () => {
  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'user123@test-domain.com',
      ];

      validEmails.forEach((email) => {
        const result = validateEmail(email);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user@.com',
        'user..name@example.com',
        'user name@example.com',
      ];

      invalidEmails.forEach((email) => {
        const result = validateEmail(email);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it('should reject specific invalid emails individually', () => {
      expect(validateEmail('invalid-email').isValid).toBe(false);
      expect(validateEmail('@example.com').isValid).toBe(false);
      expect(validateEmail('user@').isValid).toBe(false);
      expect(validateEmail('user@.com').isValid).toBe(false);
      expect(validateEmail('user..name@example.com').isValid).toBe(false);
      expect(validateEmail('user name@example.com').isValid).toBe(false);
    });

    it('should reject empty email', () => {
      const result = validateEmail('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email is required');
    });

    it('should reject overly long email', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      const result = validateEmail(longEmail);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email address is too long');
    });
  });

  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      const strongPasswords = [
        'Password123!',
        'MyStr0ng@Pass',
        'C0mplex#Password',
        'Secure$Pass1',
      ];

      strongPasswords.forEach((password) => {
        const result = validatePassword(password);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject weak passwords', () => {
      const weakPasswords = [
        '',
        'short',
        'password', // too common
        'PASSWORD123', // no lowercase
        'password123', // no uppercase
        'Password!', // no number
        'Password123', // no special character
        '123456', // too common
      ];

      weakPasswords.forEach((password) => {
        const result = validatePassword(password);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it('should require minimum length', () => {
      const result = validatePassword('Sh0rt!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must be at least 8 characters long'
      );
    });

    it('should reject overly long passwords', () => {
      const longPassword = 'A'.repeat(130) + '1!';
      const result = validatePassword(longPassword);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password is too long (maximum 128 characters)'
      );
    });

    it('should require lowercase letter', () => {
      const result = validatePassword('PASSWORD123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one lowercase letter'
      );
    });

    it('should require uppercase letter', () => {
      const result = validatePassword('password123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one uppercase letter'
      );
    });

    it('should require number', () => {
      const result = validatePassword('Password!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one number'
      );
    });

    it('should require special character', () => {
      const result = validatePassword('Password123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one special character'
      );
    });

    it('should reject common passwords', () => {
      const result = validatePassword('password123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password is too common. Please choose a stronger password'
      );
    });
  });

  describe('validateName', () => {
    it('should validate correct names', () => {
      const validNames = [
        'John',
        'Mary-Jane',
        "O'Connor",
        'Jean-Pierre',
        'Anna Maria',
      ];

      validNames.forEach((name) => {
        const result = validateName(name);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should allow empty names (optional field)', () => {
      const result = validateName('');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid names', () => {
      const invalidNames = ['John123', 'Mary@Jane', 'User#1', 'Test$Name'];

      invalidNames.forEach((name) => {
        const result = validateName(name);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it('should reject overly long names', () => {
      const longName = 'A'.repeat(51);
      const result = validateName(longName);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Name is too long (maximum 50 characters)'
      );
    });

    it('should use custom field name in error messages', () => {
      const result = validateName('Invalid123', 'First name');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('First name');
    });
  });

  describe('validateRegistration', () => {
    it('should validate correct registration data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = validateRegistration(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate registration without optional names', () => {
      const validData = {
        email: 'test@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      };

      const result = validateRegistration(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject mismatched passwords', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'Password123!',
        confirmPassword: 'DifferentPassword123!',
      };

      const result = validateRegistration(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Passwords do not match');
    });

    it('should require password confirmation', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'Password123!',
        confirmPassword: '',
      };

      const result = validateRegistration(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password confirmation is required');
    });

    it('should validate all fields and accumulate errors', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'weak',
        confirmPassword: 'different',
        firstName: 'Invalid123',
        lastName: 'Name@#$',
      };

      const result = validateRegistration(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(5); // Multiple validation errors
    });
  });

  describe('validateLogin', () => {
    it('should validate correct login data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const result = validateLogin(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require email', () => {
      const invalidData = {
        email: '',
        password: 'Password123!',
      };

      const result = validateLogin(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email is required');
    });

    it('should require password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: '',
      };

      const result = validateLogin(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is required');
    });
  });

  describe('validatePasswordResetRequest', () => {
    it('should validate correct email', () => {
      const result = validatePasswordResetRequest('test@example.com');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid email', () => {
      const result = validatePasswordResetRequest('invalid-email');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validatePasswordReset', () => {
    it('should validate correct password reset data', () => {
      const validData = {
        token: 'valid-reset-token',
        password: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      };

      const result = validatePasswordReset(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require reset token', () => {
      const invalidData = {
        token: '',
        password: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      };

      const result = validatePasswordReset(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Reset token is required');
    });

    it('should validate password strength', () => {
      const invalidData = {
        token: 'valid-token',
        password: 'weak',
        confirmPassword: 'weak',
      };

      const result = validatePasswordReset(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should require matching passwords', () => {
      const invalidData = {
        token: 'valid-token',
        password: 'Password123!',
        confirmPassword: 'DifferentPassword123!',
      };

      const result = validatePasswordReset(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Passwords do not match');
    });
  });

  describe('sanitizeEmail', () => {
    it('should trim and lowercase email', () => {
      expect(sanitizeEmail('  TEST@EXAMPLE.COM  ')).toBe('test@example.com');
      expect(sanitizeEmail('User@Domain.Com')).toBe('user@domain.com');
    });
  });

  describe('sanitizeName', () => {
    it('should trim and normalize whitespace', () => {
      expect(sanitizeName('  John   Doe  ')).toBe('John Doe');
      expect(sanitizeName('Mary\t\tJane')).toBe('Mary Jane');
      expect(sanitizeName('  Single  ')).toBe('Single');
    });
  });
});
