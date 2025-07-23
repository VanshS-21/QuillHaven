import { render, screen } from '@testing-library/react'
import { AuthLayout } from './AuthLayout'

describe('AuthLayout', () => {
  const mockProps = {
    title: 'Welcome to',
    subtitle: 'Continue your journey',
    children: <div data-testid="auth-form">Auth Form</div>,
  }

  it('renders the title with QuillHaven branding', () => {
    render(<AuthLayout {...mockProps} />)

    expect(screen.getByText('Welcome to')).toBeInTheDocument()
    expect(screen.getByText('QuillHaven')).toBeInTheDocument()
  })

  it('renders the subtitle', () => {
    render(<AuthLayout {...mockProps} />)

    expect(screen.getByText('Continue your journey')).toBeInTheDocument()
  })

  it('renders children content', () => {
    render(<AuthLayout {...mockProps} />)

    expect(screen.getByTestId('auth-form')).toBeInTheDocument()
    expect(screen.getByText('Auth Form')).toBeInTheDocument()
  })

  it('has proper layout structure and styling', () => {
    render(<AuthLayout {...mockProps} />)

    // Check for main container with proper classes
    const container = screen.getByText('Welcome to').closest('div')
    expect(container?.parentElement?.parentElement).toHaveClass(
      'flex',
      'min-h-screen',
      'items-center',
      'justify-center'
    )
  })

  it('applies responsive design classes', () => {
    render(<AuthLayout {...mockProps} />)

    const mainContainer = screen
      .getByText('Welcome to')
      .closest('div')?.parentElement
    expect(mainContainer).toHaveClass('w-full', 'max-w-md')
  })
})
