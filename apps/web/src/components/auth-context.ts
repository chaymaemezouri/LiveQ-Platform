import { createContext } from 'react';
import type { AuthResult, Speaker } from '@/lib/api';

export interface AuthContextValue {
  token: string | null;
  user: Speaker | null;
  isReady: boolean;
  signIn: (result: AuthResult) => void;
  signOut: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
