/**
 * Environment Variable Validation Tests
 *
 * This file contains tests for the environment variable validation.
 */

// Store the original environment variables
const originalEnv = process.env

// Mock console.warn to test warnings
const mockConsoleWarn = jest.fn()
console.warn = mockConsoleWarn

describe('Environment Variable Validation', () => {
  beforeEach(() => {
    jest.resetModules()
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      NEXT_PUBLIC_SUPABASE_URL: 'https://test-project.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      DATABASE_URL: 'postgresql://user:password@localhost:5432/db',
    }
    mockConsoleWarn.mockClear()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should not throw an error when all required environment variables are set', () => {
    expect(() => {
      require('./env')
    }).not.toThrow()
  })

  it('should throw an error when a required environment variable is missing', () => {
    delete process.env.DATABASE_URL

    expect(() => {
      jest.resetModules()
      require('./env')
    }).toThrow(/Missing required environment variables/)
  })

  it('should warn when optional environment variables are missing in development', () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      writable: true,
      configurable: true,
    })
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.GEMINI_API_KEY

    jest.resetModules()
    require('./env')

    expect(mockConsoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('Missing optional environment variables')
    )
  })

  it('should not warn when optional environment variables are missing in production', () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'production',
      writable: true,
      configurable: true,
    })
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.GEMINI_API_KEY

    jest.resetModules()
    require('./env')

    expect(mockConsoleWarn).not.toHaveBeenCalled()
  })

  it('should correctly parse boolean feature flags', () => {
    process.env.NEXT_PUBLIC_FEATURE_COLLABORATION = 'true'
    process.env.NEXT_PUBLIC_FEATURE_AI_SUGGESTIONS = 'false'

    jest.resetModules()
    const { env } = require('./env')

    expect(env.NEXT_PUBLIC_FEATURE_COLLABORATION).toBe(true)
    expect(env.NEXT_PUBLIC_FEATURE_AI_SUGGESTIONS).toBe(false)
  })

  it('should export all environment variables with correct types', () => {
    jest.resetModules()
    const { env } = require('./env')

    expect(env.NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000')
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe(
      'https://test-project.supabase.co'
    )
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('test-anon-key')
    expect(env.DATABASE_URL).toBe(
      'postgresql://user:password@localhost:5432/db'
    )
    expect(env.NODE_ENV).toBe('development')
  })
})
