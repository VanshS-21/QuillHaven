import { render, screen } from '@testing-library/react'
import { AuthHeader } from './AuthHeader'

// Mock Clerk components
jest.mock('@clerk/nextjs', () => ({
  SignedIn: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="signed-in">{children}</div>
  ),
  SignedOut: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="signed-out">{children}</div>
  ),
  UserButton: () => <div data-testid="user-button">UserButton</div>,
}))

// Mock Next.js Link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
})

describe('AuthHeader', () => {
  it('renders the QuillHaven logo', () => {
    render(<AuthHeader />)
    expect(screen.getByText('QuillHaven')).toBeInTheDocument()
  })

  it('renders signed out state with sign in and sign up links', () => {
    render(<AuthHeader />)

    const signedOut = screen.getByTestId('signed-out')
    expect(signedOut).toBeInTheDocument()

    // Check for sign in and sign up links within signed out section
    expect(signedOut).toHaveTextContent('Sign In')
    expect(signedOut).toHaveTextContent('Sign Up')
  })

  it('renders signed in state with dashboard link and user button', () => {
    render(<AuthHeader />)

    const signedIn = screen.getByTestId('signed-in')
    expect(signedIn).toBeInTheDocument()

    // Check for dashboard link and user button within signed in section
    expect(signedIn).toHaveTextContent('Dashboard')
    expect(screen.getByTestId('user-button')).toBeInTheDocument()
  })

  it('has proper navigation structure', () => {
    render(<AuthHeader />)

    const header = screen.getByRole('banner')
    expect(header).toBeInTheDocument()
    expect(header).toHaveClass(
      'border-b',
      'border-slate-200',
      'bg-white/80',
      'backdrop-blur-sm'
    )
  })
})
