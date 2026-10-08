import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { logoutSpeaker } from '@/lib/api';

export function AccountPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  async function onLogout() {
    setPending(true);
    try {
      await logoutSpeaker();
    } catch {
      // The local token is discarded whether or not the API accepts the request.
    }
    signOut();
    await navigate('/login');
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-3xl">Account</h1>
      <dl className="border-border bg-card mt-8 space-y-4 rounded-xl border px-5 py-5 shadow-sm">
        <div>
          <dt className="text-muted-foreground text-xs tracking-wide uppercase">
            Name
          </dt>
          <dd className="mt-1 text-sm">{user?.displayName ?? 'Loading…'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs tracking-wide uppercase">
            Email
          </dt>
          <dd className="mt-1 text-sm">{user?.email ?? 'Loading…'}</dd>
        </div>
      </dl>
      <Button
        className="mt-6"
        variant="outline"
        onClick={() => void onLogout()}
        disabled={pending}
      >
        {pending ? 'Signing out…' : 'Sign out'}
      </Button>
    </main>
  );
}
