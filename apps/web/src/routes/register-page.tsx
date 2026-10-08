import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { registerSpeaker } from '@/lib/api';
import { ApiError } from '@/lib/http';
import { AuthLayout } from '@/routes/auth-layout';

export function RegisterPage() {
  const { token, isReady, signIn } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  if (isReady && token) {
    return <Navigate to="/app" replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (displayName.trim().length === 0 || !email.trim() || password.length < 8) {
      setError('Enter your name, email, and a password of at least 8 characters.');
      return;
    }
    setPending(true);
    try {
      signIn(
        await registerSpeaker({
          displayName: displayName.trim(),
          email: email.trim(),
          password,
        }),
      );
      await navigate('/app');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Registration failed.');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout
      title="Create a speaker account"
      description="This account manages sessions. Participants do not register."
      footer={
        <>
          Already registered?{' '}
          <Link
            to="/login"
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="displayName">Name</Label>
          <Input
            id="displayName"
            autoComplete="name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            maxLength={80}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
          />
        </div>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
}
