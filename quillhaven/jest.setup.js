import '@testing-library/jest-dom';

// Mock environment variables for tests
process.env.GEMINI_API_KEY = 'test-api-key';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// Mock Prisma Client with jest-mock-extended
jest.mock('@prisma/client', () => ({
  PrismaClient: jest
    .fn()
    .mockImplementation(() => require('./__mocks__/prisma').prismaMock),
}));
