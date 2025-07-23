import { render, screen } from '@testing-library/react'
import SignUpPage from './page'

// Mock Clerk components
jest.mock('@clerk/nextjs', () => ({
  SignUp: ({ appearance }: { appearance: any }) => (
    <div
      data-testid="clerk-signup"
      data-appearance={JSON.stringify(appearance)}
    >
      Clerk SignUp Component
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

describe('SignUpPage', () => {
  it('renders the sign up page with correct title and subtitle', () => {
    render(<SignUpPage />)

    expect(screen.getByText('Join QuillHaven')).toBeInTheDocument()
    expect(
      screen.getByText('Start your AI-powered writing journey')
    ).toBeInTheDocument()
  })

  it('renders the Clerk SignUp component', () => {
    render(<SignUpPage />)

    expect(screen.getByTestId('clerk-signup')).toBeInTheDocument()
    expect(screen.getByText('Clerk SignUp Component')).toBeInTheDocument()
  })

  it('uses the AuthLayout component', () => {
    render(<SignUpPage />)

    expect(screen.getByTestId('auth-layout')).toBeInTheDocument()
  })

  it('passes appearance configuration to Clerk SignUp', () => {
    render(<SignUpPage />)

    const clerkComponent = screen.getByTestId('clerk-signup')
    const appearanceData = clerkComponent.getAttribute('data-appearance')
    expect(appearanceData).toContain('mocked-appearance')
  })
})
