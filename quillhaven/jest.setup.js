require('@testing-library/jest-dom');

// Mock environment variables for tests
process.env.GEMINI_API_KEY = 'test-api-key';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// Mock crypto module for tests
jest.mock('crypto', () => {
  const actualCrypto = jest.requireActual('crypto');

  // Simple encryption/decryption for testing
  const encryptionMap = new Map();
  let encryptionCounter = 0;

  return {
    ...actualCrypto,
    createCipheriv: jest.fn((algorithm, key, iv) => {
      const encryptionId = `enc_${encryptionCounter++}_${Date.now()}`;
      const keyString = Buffer.isBuffer(key)
        ? key.toString('hex')
        : key.toString();
      const ivString = Buffer.isBuffer(iv) ? iv.toString('hex') : iv.toString();

      return {
        update: jest.fn((data, inputEncoding, outputEncoding) => {
          // Store the original data for decryption
          encryptionMap.set(encryptionId, {
            data,
            key: keyString,
            iv: ivString,
          });
          return encryptionId;
        }),
        final: jest.fn((outputEncoding) => '_final'),
      };
    }),
    createDecipheriv: jest.fn((algorithm, key, iv) => {
      const keyString = Buffer.isBuffer(key)
        ? key.toString('hex')
        : key.toString();
      const ivString = Buffer.isBuffer(iv) ? iv.toString('hex') : iv.toString();

      return {
        update: jest.fn((encryptedData, inputEncoding, outputEncoding) => {
          // Find the original data by matching the encryption ID, key, and IV
          for (const [id, stored] of encryptionMap.entries()) {
            if (
              encryptedData.includes(id) &&
              stored.key === keyString &&
              stored.iv === ivString
            ) {
              return stored.data;
            }
          }
          // If key/IV doesn't match, throw error
          throw new Error('Invalid key or corrupted data');
        }),
        final: jest.fn((outputEncoding) => ''),
      };
    }),
    // Keep the old methods for backward compatibility
    createCipher: jest.fn((algorithm, key) => {
      const encryptionId = `enc_${encryptionCounter++}_${Date.now()}`;
      return {
        update: jest.fn((data, inputEncoding, outputEncoding) => {
          encryptionMap.set(encryptionId, { data, key: key.toString() });
          return encryptionId;
        }),
        final: jest.fn((outputEncoding) => '_final'),
      };
    }),
    createDecipher: jest.fn((algorithm, key) => ({
      update: jest.fn((encryptedData, inputEncoding, outputEncoding) => {
        for (const [id, stored] of encryptionMap.entries()) {
          if (encryptedData.includes(id) && stored.key === key.toString()) {
            return stored.data;
          }
        }
        throw new Error('Invalid key or corrupted data');
      }),
      final: jest.fn((outputEncoding) => ''),
    })),
  };
});

// Mock Prisma Client with jest-mock-extended
jest.mock('@prisma/client', () => ({
  PrismaClient: jest
    .fn()
    .mockImplementation(() => require('./__mocks__/prisma').prismaMock),
}));

// Mock Redis client
jest.mock('@/lib/redis', () => ({
  default: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    ttl: jest.fn().mockResolvedValue(-1),
    flushall: jest.fn().mockResolvedValue('OK'),
    quit: jest.fn().mockResolvedValue('OK'),
  },
}));

// Global test cleanup
afterAll(async () => {
  // Clean up any open handles
  await new Promise((resolve) => setTimeout(resolve, 100));
});
