'use client';

import { useState } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { PasswordReset } from '@/components/auth/PasswordReset';

type AuthMode = 'login' | 'register' | 'reset';

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {mode === 'login' && (
          <LoginForm
            onSwitchToRegister={() => setMode('register')}
            onSwitchToReset={() => setMode('reset')}
          />
        )}
        
        {mode === 'register' && (
          <RegisterForm
            onSwitchToLogin={() => setMode('login')}
          />
        )}
        
        {mode === 'reset' && (
          <PasswordReset
            onSwitchToLogin={() => setMode('login')}
          />
        )}
      </div>
    </div>
  );
}