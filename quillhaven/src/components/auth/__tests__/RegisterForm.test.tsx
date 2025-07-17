import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RegisterForm } from '../RegisterForm';
import { AuthProvider } from '../AuthContext';

// Mock the auth service
jest.mock('@/services/authService', () => ({
  authService: {
    register: jest.fn(),
    getCurrentUser: jest.fn().mockResolvedValue(null),
  },
}));

const MockedAuthProvider = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('RegisterForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders register form correctly', async () => {
    render(
      <MockedAuthProvider>
        <RegisterForm />
      </MockedAuthProvider>
    );

    expect(screen.getByText('Create account')).toBeInTheDocument();
    expect(
      screen.getByText('Join QuillHaven and start your writing journey')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('First Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Last Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();

    // Wait for auth initialization to complete
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Create account' })
      ).toBeInTheDocument();
    });
  });

  it('validates password confirmation', async () => {
    render(
      <MockedAuthProvider>
        <RegisterForm />
      </MockedAuthProvider>
    );

    const passwordInput = screen.getByLabelText('Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');

    // Wait for auth initialization to complete
    const submitButton = await screen.findByRole('button', {
      name: 'Create account',
    });

    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, {
      target: { value: 'different123' },
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
    });
  });

  it('calls switch to login function when provided', () => {
    const mockSwitchToLogin = jest.fn();

    render(
      <MockedAuthProvider>
        <RegisterForm onSwitchToLogin={mockSwitchToLogin} />
      </MockedAuthProvider>
    );

    fireEvent.click(screen.getByText('Sign in'));
    expect(mockSwitchToLogin).toHaveBeenCalled();
  });
});
