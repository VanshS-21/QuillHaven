import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/health',
  '/api/webhooks(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  // For development with placeholder keys, allow all routes
  if (process.env.CLERK_SECRET_KEY === 'placeholder') {
    return NextResponse.next()
  }

  // Normal authentication flow for production
  if (!isPublicRoute(req)) {
    try {
      await auth.protect()
    } catch (error) {
      // If auth fails, redirect to sign-in
      return NextResponse.redirect(new URL('/sign-in', req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}