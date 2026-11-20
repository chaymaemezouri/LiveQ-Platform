import { useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Link, Navigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import { resetSpeakerPassword } from '@/lib/api';
import { ApiError } from '@/lib/http';
import { AuthLayout } from '@/routes/auth-layout';

export function ForgotPasswordPage() {
  const { token, isReady } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (isReady && token) {
    return <Navigate to="/app" replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!email.trim() || password.length < 8) {
      setError('Enter the account email and a new password of at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setPending(true);
    try {
      await resetSpeakerPassword({ email: email.trim(), password });
      setDone(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The password could not be reset.');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout
      title="Reset password"
      description="Choose a new password for a speaker account that already exists."
      footer={
        <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
          Back to sign in
        </Link>
      }
    >
      {done ? (
        <div className="space-y-4">
          <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
            The password is updated. Sign in with the new one.
          </p>
          <Button asChild className="h-11 w-full rounded-xl bg-blue-600 text-white hover:bg-blue-700">
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          {error ? (
            <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="reset-email" className="text-slate-700">
              Email
            </Label>
            <Input
              id="reset-email"
              type="email"
              autoComplete="email"
              placeholder="you@conference.org"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="h-11 rounded-xl border-slate-200 bg-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reset-password" className="text-slate-700">
              New password
            </Label>
            <div className="relative">
              <Input
                id="reset-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                className="h-11 rounded-xl border-slate-200 bg-white pr-11"
              />
              <button
                type="button"
                className="absolute top-1/2 right-2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reset-confirm" className="text-slate-700">
              Confirm password
            </Label>
            <Input
              id="reset-confirm"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
              minLength={8}
              className="h-11 rounded-xl border-slate-200 bg-white"
            />
          </div>
          <Button
            type="submit"
            disabled={pending}
            className="h-11 w-full rounded-xl bg-blue-600 text-white hover:bg-blue-700"
          >
            {pending ? 'Saving…' : 'Save new password'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
