import type {
  LoginFormData,
  RegisterFormData,
  AuthResponse,
  AuthUser,
} from '@/types/auth';

const API_BASE = '/api/auth';

class AuthService {
  async login(data: LoginFormData): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.message || 'Login failed');
    }

    const result = await response.json();

    // Store token in localStorage
    if (result.token) {
      localStorage.setItem('auth_token', result.token);
    }

    return result;
  }

  async register(data: RegisterFormData): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.message || 'Registration failed');
    }

    const result = await response.json();

    // Store token in localStorage
    if (result.token) {
      localStorage.setItem('auth_token', result.token);
    }

    return result;
  }

  async resetPassword(email: string): Promise<void> {
    const response = await fetch(`${API_BASE}/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.message || 'Password reset failed');
    }
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const token = localStorage.getItem('auth_token');
    if (!token) return null;

    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        this.logout();
        return null;
      }

      return await response.json();
    } catch {
      this.logout();
      return null;
    }
  }

  logout(): void {
    localStorage.removeItem('auth_token');
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }
}

export const authService = new AuthService();
