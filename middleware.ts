import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { securityHeaders, getSecurityLevel } from './src/lib/config/security'

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/health',
  '/api/webhooks(.*)',
])

// Define admin routes that require admin role
const isAdminRoute = createRouteMatcher([
  '/admin(.*)',
  '/api/admin(.*)',
  '/api/auth/roles',
])

export default clerkMiddleware(async (auth, req) => {
  // Get security level
  const securityLevel = getSecurityLevel()

  // Apply security headers for staging and production
  const response = NextResponse.next()

  if (securityLevel !== 'development') {
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
  }

  // Handle authentication
  if (!isPublicRoute(req)) {
    const { userId, sessionId } = await auth.protect()

    // Add user context to headers for downstream services
    if (userId) {
      response.headers.set('X-User-ID', userId)
    }
    if (sessionId) {
      response.headers.set('X-Session-ID', sessionId)
    }

    // Check for admin routes
    if (isAdminRoute(req)) {
      // Admin role check will be handled by the API route itself
      // This is just to ensure authentication is required
      if (!userId) {
        return NextResponse.redirect(new URL('/sign-in', req.url))
      }
    }
  }

  // Rate limiting headers (basic implementation)
  const clientIP =
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    'unknown'

  response.headers.set('X-RateLimit-Limit', '100')
  response.headers.set('X-RateLimit-Remaining', '99') // Simplified for now
  response.headers.set('X-Client-IP', clientIP)

  return response
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
