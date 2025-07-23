/**
 * Environment variable validation
 *
 * This file validates that all required environment variables are set
 * and provides typed access to them throughout the application.
 */

// Function to validate environment variables
function validateEnv() {
  const requiredEnvVars = [
    'NEXT_PUBLIC_APP_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'DATABASE_URL',
  ]

  const missingEnvVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  )

  if (missingEnvVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingEnvVars.join(', ')}`
    )
  }

  // Validate optional environment variables with warnings
  const optionalEnvVars = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'GEMINI_API_KEY',
    'CLAUDE_API_KEY',
  ]

  const missingOptionalEnvVars = optionalEnvVars.filter(
    (envVar) => !process.env[envVar]
  )

  if (
    missingOptionalEnvVars.length > 0 &&
    process.env.NODE_ENV === 'development'
  ) {
    console.warn(
      `Warning: Missing optional environment variables: ${missingOptionalEnvVars.join(
        ', '
      )}`
    )
  }
}

// Validate environment variables in development and production
// In production, this will run at build time
if (process.env.NODE_ENV !== 'test') {
  validateEnv()
}

// Export environment variables with types
export const env = {
  // Next.js
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL as string,

  // Feature flags
  NEXT_PUBLIC_FEATURE_COLLABORATION:
    process.env.NEXT_PUBLIC_FEATURE_COLLABORATION === 'true',
  NEXT_PUBLIC_FEATURE_AI_SUGGESTIONS:
    process.env.NEXT_PUBLIC_FEATURE_AI_SUGGESTIONS === 'true',

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env
    .NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY as string,

  // Database
  DATABASE_URL: process.env.DATABASE_URL as string,

  // AI Services
  GEMINI_API_KEY: process.env.GEMINI_API_KEY as string,
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY as string,

  // Environment
  NODE_ENV: process.env.NODE_ENV as 'development' | 'production' | 'test',
}
