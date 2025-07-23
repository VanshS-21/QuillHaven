import { render, screen } from '@testing-library/react'
import SignInPage from './page'

// Mock Clerk components
jest.mock('@clerk/nextjs', () => ({
  SignIn: ({ appearance }: { appearance: any }) => (
    <div
      data-testid="clerk-signin"
      data-appearance={JSON.stringify(appearance)}
    >
      Clerk SignIn Component
    </div>
  ),
}))

// Mock AuthLayout component
jest.mock('../../../components/auth/AuthLayout', () => ({
  AuthLayout: ({ title, subtitle, children }: any) => (
    <div data-testid="auth-layout">
      <h1>{title} QuillHaven</h1>
      <p>{subtitle}</p>
      {children}
    </div>
  ),
  clerkAppearance: { elements: { card: 'mocked-appearance' } },
}))

describe('SignInPage', () => {
  it('renders the sign in page with correct title and subtitle', () => {
    render(<SignInPage />)

    expect(screen.getByText('Welcome back to QuillHaven')).toBeInTheDocument()
    expect(
      screen.getByText('Continue your writing journey')
    ).toBeInTheDocument()
  })

  it('renders the Clerk SignIn component', () => {
    render(<SignInPage />)

    expect(screen.getByTestId('clerk-signin')).toBeInTheDocument()
    expect(screen.getByText('Clerk SignIn Component')).toBeInTheDocument()
  })

  it('uses the AuthLayout component', () => {
    render(<SignInPage />)

    expect(screen.getByTestId('auth-layout')).toBeInTheDocument()
  })

  it('passes appearance configuration to Clerk SignIn', () => {
    render(<SignInPage />)

    const clerkComponent = screen.getByTestId('clerk-signin')
    const appearanceData = clerkComponent.getAttribute('data-appearance')
    expect(appearanceData).toContain('mocked-appearance')
  })
})
