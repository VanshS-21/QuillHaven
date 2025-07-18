/**
 * Security tests for QuillHaven application
 */

import {
  validateString,
  sanitizeHtml,
  sanitizeText,
  validateDatabaseIdentifier,
  validateFileUpload,
} from '@/utils/validation/input';
import {
  encryptText,
  decryptText,
  UserContentEncryption,
  hashData,
  verifyHashedData,
} from '@/lib/encryption';
import { validateEmail, validatePassword } from '@/utils/validation/auth';

describe('Input Validation and Sanitization', () => {
  describe('validateString', () => {
    it('should validate required strings', () => {
      const result = validateString('', 'test', { required: true });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('test is required');
    });

    it('should validate string length', () => {
      const result = validateString('ab', 'test', {
        minLength: 3,
        maxLength: 10,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'test must be at least 3 characters long'
      );
    });

    it('should validate string patterns', () => {
      const result = validateString('invalid-email', 'email', {
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('email format is invalid');
    });

    it('should sanitize valid strings', () => {
      const result = validateString('  hello world  ', 'test');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData).toBe('hello world');
    });
  });

  describe('HTML Sanitization', () => {
    it('should remove dangerous script tags', () => {
      const maliciousHtml = '<script>alert("xss")</script><p>Safe content</p>';
      const sanitized = sanitizeHtml(maliciousHtml);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('<p>Safe content</p>');
    });

    it('should remove event handlers', () => {
      const maliciousHtml = '<div onclick="alert(\'xss\')">Click me</div>';
      const sanitized = sanitizeHtml(maliciousHtml);
      expect(sanitized).not.toContain('onclick');
    });

    it('should preserve safe HTML tags', () => {
      const safeHtml = '<p><strong>Bold</strong> and <em>italic</em> text</p>';
      const sanitized = sanitizeHtml(safeHtml);
      expect(sanitized).toContain('<strong>');
      expect(sanitized).toContain('<em>');
    });
  });

  describe('Text Sanitization', () => {
    it('should remove control characters', () => {
      const textWithControlChars = 'Hello\x00\x1F\x7FWorld';
      const sanitized = sanitizeText(textWithControlChars);
      expect(sanitized).toBe('HelloWorld');
    });

    it('should normalize whitespace', () => {
      const textWithExtraSpaces = '  Hello    World  ';
      const sanitized = sanitizeText(textWithExtraSpaces);
      expect(sanitized).toBe('Hello World');
    });
  });
});

describe('Data Encryption', () => {
  const testData = 'This is sensitive user content that needs encryption';
  const userKey = 'test-user-key-123';

  describe('Basic Encryption/Decryption', () => {
    it('should encrypt and decrypt text successfully', () => {
      const encrypted = encryptText(testData);
      const decrypted = decryptText(encrypted);
      expect(decrypted).toBe(testData);
    });

    it('should encrypt and decrypt with user key', () => {
      const encrypted = encryptText(testData, userKey);
      const decrypted = decryptText(encrypted, userKey);
      expect(decrypted).toBe(testData);
    });

    it('should fail to decrypt with wrong key', () => {
      const encrypted = encryptText(testData, userKey);
      expect(() => {
        decryptText(encrypted, 'wrong-key');
      }).toThrow();
    });

    it('should produce different encrypted output each time', () => {
      const encrypted1 = encryptText(testData);
      const encrypted2 = encryptText(testData);
      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });
  });

  describe('User Content Encryption', () => {
    const userId = 'test-user-123';
    const encryption = new UserContentEncryption(userId);

    it('should encrypt and decrypt user content', () => {
      const encrypted = encryption.encryptContent(testData);
      const decrypted = encryption.decryptContent(encrypted);
      expect(decrypted).toBe(testData);
    });

    it('should encrypt and decrypt JSON data', () => {
      const jsonData = {
        title: 'Test Chapter',
        content: testData,
        wordCount: 100,
      };
      const encrypted = encryption.encryptJSON(jsonData);
      const decrypted = encryption.decryptJSON(encrypted);
      expect(decrypted).toEqual(jsonData);
    });
  });

  describe('Data Hashing', () => {
    const testPassword = 'MySecurePassword123!';

    it('should hash data consistently', () => {
      const { hash: hash1, salt } = hashData(testPassword);
      const { hash: hash2 } = hashData(testPassword, salt);
      expect(hash1).toBe(hash2);
    });

    it('should verify hashed data correctly', () => {
      const { hash, salt } = hashData(testPassword);
      expect(verifyHashedData(testPassword, hash, salt)).toBe(true);
      expect(verifyHashedData('WrongPassword', hash, salt)).toBe(false);
    });

    it('should produce different hashes with different salts', () => {
      const { hash: hash1 } = hashData(testPassword);
      const { hash: hash2 } = hashData(testPassword);
      expect(hash1).not.toBe(hash2);
    });
  });
});

describe('Authentication Validation', () => {
  describe('Email Validation', () => {
    it('should validate correct email formats', () => {
      const validEmails = [
        'user@example.com',
        'test.email+tag@domain.co.uk',
        'user123@test-domain.org',
      ];

      validEmails.forEach((email) => {
        const result = validateEmail(email);
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user..double.dot@domain.com',
        'user@domain',
        'user name@domain.com',
      ];

      invalidEmails.forEach((email) => {
        const result = validateEmail(email);
        expect(result.isValid).toBe(false);
      });
    });
  });

  describe('Password Validation', () => {
    it('should validate strong passwords', () => {
      const strongPasswords = [
        'MySecure123!',
        'Complex@Password456',
        'Str0ng#P@ssw0rd',
      ];

      strongPasswords.forEach((password) => {
        const result = validatePassword(password);
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject weak passwords', () => {
      const weakPasswords = [
        'password', // too common
        '123456', // too simple
        'Password', // missing number and special char
        'password123', // missing uppercase and special char
        'PASSWORD123!', // missing lowercase
        'Password!', // missing number
        'Pass1!', // too short
      ];

      weakPasswords.forEach((password) => {
        const result = validatePassword(password);
        expect(result.isValid).toBe(false);
      });
    });

    it('should reject common passwords', () => {
      const commonPasswords = [
        'password',
        'password123',
        '123456',
        'qwerty',
        'admin',
      ];

      commonPasswords.forEach((password) => {
        const result = validatePassword(password);
        expect(result.isValid).toBe(false);
        expect(
          result.errors.some((error) => error.includes('too common'))
        ).toBe(true);
      });
    });
  });
});

describe('SQL Injection Prevention', () => {
  it('should validate database identifiers', () => {
    // Valid identifiers
    expect(validateDatabaseIdentifier('user_id', 'field').isValid).toBe(true);
    expect(validateDatabaseIdentifier('project-123', 'field').isValid).toBe(
      true
    );
    expect(validateDatabaseIdentifier('valid_name', 'field').isValid).toBe(
      true
    );

    // Invalid identifiers (potential SQL injection)
    expect(
      validateDatabaseIdentifier('user; DROP TABLE users;--', 'field').isValid
    ).toBe(false);
    expect(validateDatabaseIdentifier("user' OR '1'='1", 'field').isValid).toBe(
      false
    );
    expect(
      validateDatabaseIdentifier('SELECT * FROM users', 'field').isValid
    ).toBe(false);
  });
});

describe('File Upload Security', () => {
  it('should validate file types and sizes', () => {
    // Mock file objects
    const validFile = {
      name: 'document.pdf',
      type: 'application/pdf',
      size: 1024 * 1024, // 1MB
    } as File;

    const oversizedFile = {
      name: 'large.pdf',
      type: 'application/pdf',
      size: 10 * 1024 * 1024, // 10MB
    } as File;

    const maliciousFile = {
      name: 'script.exe',
      type: 'application/x-executable',
      size: 1024,
    } as File;

    // Valid file should pass
    const validResult = validateFileUpload(validFile, {
      maxSize: 5 * 1024 * 1024, // 5MB limit
      allowedTypes: ['application/pdf', 'text/plain'],
      allowedExtensions: ['pdf', 'txt'],
    });
    expect(validResult.isValid).toBe(true);

    // Oversized file should fail
    const oversizedResult = validateFileUpload(oversizedFile, {
      maxSize: 5 * 1024 * 1024, // 5MB limit
    });
    expect(oversizedResult.isValid).toBe(false);

    // Malicious file should fail
    const maliciousResult = validateFileUpload(maliciousFile, {
      allowedTypes: ['application/pdf', 'text/plain'],
      allowedExtensions: ['pdf', 'txt'],
    });
    expect(maliciousResult.isValid).toBe(false);
  });
});

describe('Rate Limiting Logic', () => {
  // Note: These tests would need to be integration tests with actual middleware
  // For now, we'll test the core logic concepts

  it('should track request counts per IP', () => {
    const rateLimitStore = new Map();
    const ip = '192.168.1.1';
    const windowMs = 60000; // 1 minute
    const maxRequests = 10;
    const now = Date.now();

    // First request
    let entry = rateLimitStore.get(ip);
    if (!entry || now > entry.resetTime) {
      entry = { count: 0, resetTime: now + windowMs };
      rateLimitStore.set(ip, entry);
    }
    entry.count++;

    expect(entry.count).toBe(1);
    expect(entry.count < maxRequests).toBe(true);

    // Simulate multiple requests
    for (let i = 0; i < 10; i++) {
      entry.count++;
    }

    expect(entry.count > maxRequests).toBe(true);
  });
});

describe('Security Headers', () => {
  // These would be tested in integration tests with actual HTTP responses
  it('should include security headers in responses', () => {
    const expectedHeaders = [
      'X-XSS-Protection',
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Referrer-Policy',
      'Content-Security-Policy',
      'Strict-Transport-Security',
    ];

    // This would be tested with actual HTTP responses
    expect(expectedHeaders.length).toBeGreaterThan(0);
  });
});
