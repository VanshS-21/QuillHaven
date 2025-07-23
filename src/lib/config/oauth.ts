/**
 * OAuth provider configuration for Clerk
 * Defines available OAuth providers and their settings
 */

export interface OAuthProvider {
  id: string
  name: string
  enabled: boolean
  scopes?: string[]
  additionalParams?: Record<string, string>
}

/**
 * OAuth provider configurations
 * These can be enabled/disabled via environment variables
 */
export const oauthProviders: OAuthProvider[] = [
  {
    id: 'google',
    name: 'Google',
    enabled: process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED === 'true',
    scopes: ['email', 'profile'],
  },
  {
    id: 'github',
    name: 'GitHub',
    enabled: process.env.NEXT_PUBLIC_OAUTH_GITHUB_ENABLED === 'true',
    scopes: ['user:email'],
  },
  {
    id: 'discord',
    name: 'Discord',
    enabled: process.env.NEXT_PUBLIC_OAUTH_DISCORD_ENABLED === 'true',
    scopes: ['identify', 'email'],
  },
  {
    id: 'apple',
    name: 'Apple',
    enabled: process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED === 'true',
    scopes: ['name', 'email'],
  },
]

/**
 * Get enabled OAuth providers
 * @returns Array of enabled OAuth providers
 */
export function getEnabledOAuthProviders(): OAuthProvider[] {
  return oauthProviders.filter((provider) => provider.enabled)
}

/**
 * Check if a specific OAuth provider is enabled
 * @param providerId - The OAuth provider ID
 * @returns True if the provider is enabled
 */
export function isOAuthProviderEnabled(providerId: string): boolean {
  const provider = oauthProviders.find((p) => p.id === providerId)
  return provider?.enabled ?? false
}

/**
 * OAuth configuration for Clerk
 */
export const clerkOAuthConfig = {
  // Redirect URLs after OAuth authentication
  afterSignInUrl:
    process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL || '/dashboard',
  afterSignUpUrl:
    process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL || '/dashboard',

  // OAuth provider settings
  providers: getEnabledOAuthProviders(),

  // Additional OAuth settings
  allowedRedirectOrigins: [
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    ...(process.env.NEXT_PUBLIC_ALLOWED_REDIRECT_ORIGINS?.split(',') || []),
  ],
}
