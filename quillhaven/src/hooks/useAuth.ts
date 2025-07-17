'use client';

import { useAuth as useAuthContext } from '@/components/auth/AuthContext';

// Re-export the useAuth hook for easier imports
export const useAuth = useAuthContext;
