require('@testing-library/jest-dom');

// Mock environment variables for tests
process.env.GEMINI_API_KEY = 'test-api-key';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// Mock crypto module for tests
jest.mock('crypto', () => {
  const actualCrypto = jest.requireActual('crypto');
  
  // Simple encryption/decryption for testing
  const encryptionMap = new Map();
  let encryptionCounter = 0;
  
  return {
    ...actualCrypto,
    createCipher: jest.fn((algorithm, key) => {
      const encryptionId = `enc_${encryptionCounter++}_${Date.now()}`;
      return {
        update: jest.fn((data, inputEncoding, outputEncoding) => {
          // Store the original data for decryption
          encryptionMap.set(encryptionId, { data, key: key.toString() });
          return encryptionId;
        }),
        final: jest.fn((outputEncoding) => '_final'),
      };
    }),
    createDecipher: jest.fn((algorithm, key) => ({
      update: jest.fn((encryptedData, inputEncoding, outputEncoding) => {
        // Find the original data by matching the encryption ID and key
        for (const [id, stored] of encryptionMap.entries()) {
          if (encryptedData.includes(id) && stored.key === key.toString()) {
            return stored.data;
          }
        }
        // If key doesn't match, throw error
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
