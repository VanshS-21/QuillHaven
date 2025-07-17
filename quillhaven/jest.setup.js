// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

import '@testing-library/jest-dom';

// Mock environment variables for testing
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-purposes-only';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.EMAIL_SERVER_HOST = 'localhost';
process.env.EMAIL_SERVER_PORT = '587';
process.env.EMAIL_SERVER_USER = 'test@example.com';
process.env.EMAIL_SERVER_PASSWORD = 'test-password';
process.env.EMAIL_FROM = 'noreply@test.com';
process.env.NEXTAUTH_URL = 'http://localhost:3000';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to ignore specific log levels
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  error: jest.fn(),
};
