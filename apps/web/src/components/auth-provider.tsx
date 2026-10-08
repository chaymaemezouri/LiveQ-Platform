import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { AuthContext } from '@/components/auth-context';
import { fetchCurrentSpeaker, type AuthResult } from '@/lib/api';
import { clearToken, readToken, setUnauthorizedHandler, writeToken } from '@/lib/http';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => readToken());

  useEffect(() => {
    setUnauthorizedHandler(() => setToken(null));
  }, []);

  const profile = useQuery({
    queryKey: ['me', token],
    queryFn: fetchCurrentSpeaker,
    enabled: Boolean(token),
    retry: false,
  });

  useEffect(() => {
    if (profile.isError) {
      clearToken();
      setToken(null);
    }
  }, [profile.isError]);

  function signIn(result: AuthResult) {
    writeToken(result.accessToken);
    setToken(result.accessToken);
    queryClient.setQueryData(['me', result.accessToken], result.user);
  }

  function signOut() {
    clearToken();
    setToken(null);
    queryClient.removeQueries({ queryKey: ['me'] });
  }

  const isReady = !token || profile.isSuccess || profile.isError;

  return (
    <AuthContext.Provider
      value={{
        token,
        user: profile.data ?? null,
        isReady,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
