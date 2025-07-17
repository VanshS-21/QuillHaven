import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '../AuthGuard';
import { useAuth } from '../AuthContext';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock the useAuth hook
jest.mock('../AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockPush = jest.fn();
(useRouter as jest.Mock).mockReturnValue({
  push: mockPush,
});

const mockUseAuth = useAuth as jest.Mock;

describe('AuthGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state when authentication is loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      resetPassword: jest.fn(),
    });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders children when user is authenticated and auth is required', () => {
    const mockUser = { id: '1', email: 'test@example.com' };

    mockUseAuth.mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      resetPassword: jest.fn(),
    });

    render(
      <AuthGuard requireAuth={true}>
        <div>Protected Content</div>
      </AuthGuard>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('renders children when user is not authenticated and auth is not required', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      resetPassword: jest.fn(),
    });

    render(
      <AuthGuard requireAuth={false}>
        <div>Public Content</div>
      </AuthGuard>
    );

    expect(screen.getByText('Public Content')).toBeInTheDocument();
  });
});
