import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
  usePathname: () => '/',
}))

// Mock Clerk
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(() =>
    Promise.resolve({ userId: 'test-user-id', sessionId: 'test-session-id' })
  ),
  clerkClient: jest.fn(() =>
    Promise.resolve({
      users: {
        getUser: jest.fn(),
        createTOTP: jest.fn(),
        deleteTOTP: jest.fn(),
        verifyTOTP: jest.fn(),
        updateUser: jest.fn(),
        updateUserMetadata: jest.fn(),
      },
      sessions: {
        getSessionList: jest.fn(),
        getSession: jest.fn(),
        revokeSession: jest.fn(),
      },
    })
  ),
  currentUser: jest.fn(() =>
    Promise.resolve({
      id: 'test-user-id',
      emailAddresses: [{ emailAddress: 'test@example.com' }],
    })
  ),
}))

jest.mock('@clerk/nextjs', () => ({
  useUser: () => ({
    user: {
      id: 'test-user-id',
      emailAddresses: [{ emailAddress: 'test@example.com' }],
    },
    isLoaded: true,
    isSignedIn: true,
  }),
  useAuth: () => ({
    userId: 'test-user-id',
    sessionId: 'test-session-id',
    isLoaded: true,
    isSignedIn: true,
  }),
  SignIn: () => 'Sign In',
  SignUp: () => 'Sign Up',
  UserButton: () => 'User Button',
}))

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
