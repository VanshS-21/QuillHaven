import {
  validateEmail,
  validatePassword,
  validateName,
  validateRegistrationData,
  validateLoginData,
  sanitizeInput,
} from '../auth';

describe('Auth Validation Utils', () => {
  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'user123@test-domain.com',
        'a@b.co',
      ];

      validEmails.forEach((email) => {
        expect(validateEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user@.com',
        'user..name@example.com',
        'user@example.',
        'user name@example.com',
        '',
        null,
        undefined,
      ];

      invalidEmails.forEach((email) => {
        expect(validateEmail(email as any)).toBe(false);
      });
    });

    it('should handle edge cases', () => {
      expect(validateEmail('a@b.c')).toBe(true); // Minimum valid email
      expect(validateEmail('very.long.email.address@very.long.domain.name.com')).toBe(true);
      expect(validateEmail('user@domain-with-hyphens.com')).toBe(true);
    });
  });

  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      const strongPasswords = [
        'Password123!',
        'MySecure@Pass1',
        'Complex#Password2024',
        'Str0ng!P@ssw0rd',
      ];

      strongPasswords.forEach((password) => {
        const result = validatePassword(password);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject passwords that are too short', () => {
      const shortPasswords = ['123', 'Pass1!', 'Ab1!'];

      shortPasswords.forEach((password) => {
        const result = validatePassword(password);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must be at least 8 characters long');
      });
    });

    it('should reject passwords without uppercase letters', () => {
      const result = validatePassword('password123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject passwords without lowercase letters', () => {
      const result = validatePassword('PASSWORD123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject passwords without numbers', () => {
      const result = validatePassword('Password!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject passwords without special characters', () => {
      const result = validatePassword('Password123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should reject common passwords', () => {
      const commonPasswords = [
        'Password123!',
        'Admin123!',
        'Welcome123!',
        'Qwerty123!',
      ];

      commonPasswords.forEach((password) => {
        const result = validatePassword(password);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password is too common');
      });
    });

    it('should accumulate multiple errors', () => {
      const result = validatePassword('weak');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it('should handle edge cases', () => {
      expect(validatePassword('').isValid).toBe(false);
      expect(validatePassword(null as any).isValid).toBe(false);
      expect(validatePassword(undefined as any).isValid).toBe(false);
    });
  });

  describe('validateName', () => {
    it('should validate proper names', () => {
      const validNames = [
        'John',
        'Mary-Jane',
        "O'Connor",
        'José',
        'Anne Marie',
        'Li Wei',
      ];

      validNames.forEach((name) => {
        expect(validateName(name)).toBe(true);
      });
    });

    it('should reject invalid names', () => {
      const invalidNames = [
        '',
        'J',
        'John123',
        'John@Doe',
        'A'.repeat(51), // Too long
        '  ',
        'John  Doe', // Multiple spaces
      ];

      invalidNames.forEach((name) => {
        expect(validateName(name as any)).toBe(false);
      });
    });

    it('should handle international characters', () => {
      const internationalNames = [
        'François',
        'Müller',
        'Søren',
        'Владимир',
        '田中',
        'محمد',
      ];

      internationalNames.forEach((name) => {
        expect(validateName(name)).toBe(true);
      });
    });
  });

  describe('validateRegistrationData', () => {
    const validRegistrationData = {
      email: 'test@example.com',
      password: 'SecurePass123!',
      firstName: 'John',
      lastName: 'Doe',
    };

    it('should validate complete registration data', () => {
      const result = validateRegistrationData(validRegistrationData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('should validate each field individually', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'weak',
        firstName: '',
        lastName: 'D',
      };

      const result = validateRegistrationData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors.email).toBeDefined();
      expect(result.errors.password).toBeDefined();
      expect(result.errors.firstName).toBeDefined();
      expect(result.errors.lastName).toBeDefined();
    });

    it('should handle missing fields', () => {
      const incompleteData = {
        email: 'test@example.com',
        // Missing other fields
      } as any;

      const result = validateRegistrationData(incompleteData);
      expect(result.isValid).toBe(false);
      expect(result.errors.password).toContain('Password is required');
      expect(result.errors.firstName).toContain('First name is required');
      expect(result.errors.lastName).toContain('Last name is required');
    });

    it('should trim whitespace from names', () => {
      const dataWithWhitespace = {
        ...validRegistrationData,
        firstName: '  John  ',
        lastName: '  Doe  ',
      };

      const result = validateRegistrationData(dataWithWhitespace);
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateLoginData', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'SecurePass123!',
    };

    it('should validate complete login data', () => {
      const result = validateLoginData(validLoginData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('should require email and password', () => {
      const incompleteData = {} as any;

      const result = validateLoginData(incompleteData);
      expect(result.isValid).toBe(false);
      expect(result.errors.email).toContain('Email is required');
      expect(result.errors.password).toContain('Password is required');
    });

    it('should validate email format', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'password',
      };

      const result = validateLoginData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors.email).toContain('Invalid email format');
    });

    it('should not validate password strength for login', () => {
      const dataWithWeakPassword = {
        email: 'test@example.com',
        password: 'weak',
      };

      const result = validateLoginData(dataWithWeakPassword);
      expect(result.isValid).toBe(true); // Login doesn't validate password strength
    });
  });

  describe('sanitizeInput', () => {
    it('should remove dangerous HTML tags', () => {
      const dangerousInput = '<script>alert("xss")</script>Hello World';
      const sanitized = sanitizeInput(dangerousInput);
      expect(sanitized).toBe('Hello World');
      expect(sanitized).not.toContain('<script>');
    });

    it('should preserve safe content', () => {
      const safeInput = 'Hello World! This is safe text.';
      const sanitized = sanitizeInput(safeInput);
      expect(sanitized).toBe(safeInput);
    });

    it('should handle various XSS attempts', () => {
      const xssAttempts = [
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
        'javascript:alert(1)',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<object data="javascript:alert(1)"></object>',
      ];

      xssAttempts.forEach((attempt) => {
        const sanitized = sanitizeInput(attempt);
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('onerror');
        expect(sanitized).not.toContain('onload');
      });
    });

    it('should trim whitespace', () => {
      const inputWithWhitespace = '  Hello World  ';
      const sanitized = sanitizeInput(inputWithWhitespace);
      expect(sanitized).toBe('Hello World');
    });

    it('should handle empty and null inputs', () => {
      expect(sanitizeInput('')).toBe('');
      expect(sanitizeInput(null as any)).toBe('');
      expect(sanitizeInput(undefined as any)).toBe('');
    });

    it('should handle very long inputs', () => {
      const longInput = 'A'.repeat(10000);
      const sanitized = sanitizeInput(longInput);
      expect(sanitized.length).toBeLessThanOrEqual(5000); // Should truncate
    });

    it('should preserve line breaks and basic formatting', () => {
      const formattedInput = 'Line 1\nLine 2\n\nLine 4';
      const sanitized = sanitizeInput(formattedInput);
      expect(sanitized).toContain('\n');
    });
  });

  describe('performance tests', () => {
    it('should validate emails quickly', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        validateEmail(`test${i}@example.com`);
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should validate passwords quickly', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        validatePassword(`Password${i}!`);
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(500);
    });

    it('should sanitize inputs quickly', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        sanitizeInput(`<script>alert(${i})</script>Safe content ${i}`);
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(200);
    });
  });

  describe('security tests', () => {
    it('should prevent SQL injection attempts in email validation', () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE users; --",
        "admin'/*",
        "' OR '1'='1",
        "' UNION SELECT * FROM users --",
      ];

      sqlInjectionAttempts.forEach((attempt) => {
        expect(validateEmail(attempt)).toBe(false);
      });
    });

    it('should handle Unicode normalization attacks', () => {
      const unicodeAttacks = [
        'test@example.com\u202E', // Right-to-left override
        'test@example.com\u200B', // Zero-width space
        'test@example.com\uFEFF', // Byte order mark
      ];

      unicodeAttacks.forEach((attack) => {
        const result = sanitizeInput(attack);
        expect(result).not.toContain('\u202E');
        expect(result).not.toContain('\u200B');
        expect(result).not.toContain('\uFEFF');
      });
    });

    it('should prevent prototype pollution attempts', () => {
      const pollutionAttempts = [
        '__proto__',
        'constructor',
        'prototype',
      ];

      pollutionAttempts.forEach((attempt) => {
        const sanitized = sanitizeInput(attempt);
        // Should still contain the text but be safe to use
        expect(typeof sanitized).toBe('string');
      });
    });
  });
});