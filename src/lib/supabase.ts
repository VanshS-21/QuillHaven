/**
 * Supabase client configuration
 *
 * This file sets up the Supabase client for use throughout the application.
 * It provides both the public client for client-side operations and
 * the admin client for server-side operations that require elevated privileges.
 */

import { createClient } from '@supabase/supabase-js'

// Environment variables are validated at build time in src/env.ts
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Supabase client with anonymous key for client-side operations
 * This client has limited permissions based on Row Level Security (RLS) policies
 */
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

/**
 * Supabase admin client with service role key for server-side operations
 * This client bypasses RLS and should ONLY be used in server-side code
 * NEVER expose this client to the client-side
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

/**
 * Create a Supabase client with custom authentication
 * Useful for server components that need to act on behalf of a user
 */
export const createServerSupabaseClient = (accessToken: string) => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
