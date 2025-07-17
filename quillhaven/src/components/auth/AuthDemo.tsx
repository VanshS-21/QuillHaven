'use client';

import { useState } from 'react';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { PasswordReset } from './PasswordReset';

type AuthMode = 'login' | 'register' | 'reset';

export function AuthDemo() {
  const [mode, setMode] = useState<AuthMode>('login');

  const renderForm = () => {
    switch (mode) {
      case 'login':
        return (
          <LoginForm
            onSwitchToRegister={() => setMode('register')}
            onSwitchToReset={() => setMode('reset')}
          />
        );
      case 'register':
        return <RegisterForm onSwitchToLogin={() => setMode('login')} />;
      case 'reset':
        return <PasswordReset onSwitchToLogin={() => setMode('login')} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">{renderForm()}</div>
    </div>
  );
}
