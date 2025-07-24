// Mock implementation of Clerk for testing

export const auth = jest.fn(() =>
  Promise.resolve({
    userId: 'test_user_123',
    sessionId: 'test_session_123',
    protect: jest.fn(),
  })
)

export const currentUser = jest.fn(() =>
  Promise.resolve({
    id: 'test_user_123',
    emailAddresses: [{ emailAddress: 'test@example.com' }],
    firstName: 'Test',
    lastName: 'User',
    imageUrl: 'https://example.com/avatar.jpg',
    twoFactorEnabled: false,
  })
)

export const clerkClient = jest.fn(() =>
  Promise.resolve({
    users: {
      getUser: jest.fn(() =>
        Promise.resolve({
          id: 'test_user_123',
          emailAddresses: [{ emailAddress: 'test@example.com' }],
          firstName: 'Test',
          lastName: 'User',
          imageUrl: 'https://example.com/avatar.jpg',
          twoFactorEnabled: false,
        })
      ),
      updateUser: jest.fn(() => Promise.resolve({})),
      updateUserMetadata: jest.fn(() => Promise.resolve({})),
    },
    sessions: {
      getSessionList: jest.fn(() =>
        Promise.resolve({
          data: [
            {
              id: 'test_session_123',
              userId: 'test_user_123',
              status: 'active',
              lastActiveAt: Date.now(),
              createdAt: Date.now() - 3600000,
              expireAt: Date.now() + 3600000,
            },
          ],
        })
      ),
      getSession: jest.fn(() =>
        Promise.resolve({
          id: 'test_session_123',
          userId: 'test_user_123',
          status: 'active',
        })
      ),
      revokeSession: jest.fn(() => Promise.resolve({})),
    },
  })
)

export const verifyWebhook = jest.fn(() => {
  // Mock webhook verification
  return Promise.resolve({
    type: 'user.created',
    data: {
      id: 'user_123',
      email_addresses: [{ email_address: 'test@example.com' }],
      first_name: 'Test',
      last_name: 'User',
      created_at: Date.now(),
      updated_at: Date.now(),
    },
  })
})

// Mock User type
export interface User {
  id: string
  emailAddresses: Array<{ emailAddress: string }>
  firstName: string | null
  lastName: string | null
  imageUrl: string
  twoFactorEnabled: boolean
}

// Mock WebhookEvent type
export interface WebhookEvent {
  type: string
  data: Record<string, unknown>
}
