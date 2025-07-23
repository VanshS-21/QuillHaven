/**
 * Supabase Client Tests
 *
 * This file contains tests for the Supabase client configuration.
 */

// import { createClient } from '@supabase/supabase-js'

// Mock the createClient function
const mockCreateClient = jest.fn().mockImplementation(() => ({
  auth: {
    getSession: jest.fn(),
  },
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}))

describe('Supabase Client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
  })

  it('should create clients with correct configuration', async () => {
    // Import after mocking to ensure the mock is used
    const { supabaseClient, supabaseAdmin, createServerSupabaseClient } =
      await import('./supabase')

    // Test that clients were created
    expect(mockCreateClient).toHaveBeenCalledTimes(2)

    // Test server client creation
    const testToken = 'test-auth-token'
    createServerSupabaseClient(testToken)

    expect(mockCreateClient).toHaveBeenCalledTimes(3)
    expect(mockCreateClient).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        global: expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${testToken}`,
          }),
        }),
        auth: expect.objectContaining({
          persistSession: false,
          autoRefreshToken: false,
        }),
      })
    )
  })

  it('should export supabase clients', async () => {
    const { supabaseClient, supabaseAdmin } = await import('./supabase')

    expect(supabaseClient).toBeDefined()
    expect(supabaseAdmin).toBeDefined()
    expect(typeof supabaseClient.auth.getSession).toBe('function')
    expect(typeof supabaseAdmin.auth.getSession).toBe('function')
  })
})
