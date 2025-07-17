import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '../LoginForm';
import { useAuth } from '../AuthContext';

// Mock the useAuth hook
jest.mock('../AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      resetPassword: jest.fn(),
    });
  });

  it('renders login form correctly', async () => {
    render(<LoginForm />);

    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    expect(
      screen.getByText('Sign in to your QuillHaven account')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('validates email field', async () => {
    const mockLogin = jest.fn();
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      login: mockLogin,
      register: jest.fn(),
      logout: jest.fn(),
      resetPassword: jest.fn(),
    });

    render(<LoginForm />);

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Sign in' });

    // Test with empty email field
    fireEvent.change(emailInput, { target: { value: '' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    // Submit the form
    fireEvent.click(submitButton);

    // Wait for validation error to appear
    await waitFor(
      () => {
        expect(
          screen.getByText('Please enter a valid email address')
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // The login function should NOT be called if validation fails
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('validates password field', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Sign in' });

    // Enter valid email but invalid password
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, '123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText('Password must be at least 6 characters')
      ).toBeInTheDocument();
    });
  });

  it('calls switch functions when provided', async () => {
    const user = userEvent.setup();
    const mockSwitchToRegister = jest.fn();
    const mockSwitchToReset = jest.fn();

    render(
      <LoginForm
        onSwitchToRegister={mockSwitchToRegister}
        onSwitchToReset={mockSwitchToReset}
      />
    );

    await user.click(screen.getByText('Sign up'));
    expect(mockSwitchToRegister).toHaveBeenCalled();

    await user.click(screen.getByText('Forgot your password?'));
    expect(mockSwitchToReset).toHaveBeenCalled();
  });
});
