import { Link, Navigate } from 'react-router';
import { useAuth } from '@/hooks/use-auth';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';

export function WelcomePage() {
  const { token, isReady } = useAuth();

  if (isReady && token) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <p className="font-serif text-2xl text-red-600">LiveQ</p>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" asChild>
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-muted-foreground text-sm font-medium tracking-[0.16em] uppercase">
          Conferences and training
        </p>
        <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">
          Run a live session from one calm control room.
        </h1>
        <p className="text-muted-foreground mt-4 max-w-xl text-base leading-7">
          Create a session, share its joining code, and keep the room ready for
          questions. Participants join with the code. Only speakers need an account.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/register">Create a speaker account</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/join">Join with a code</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/status">Platform status</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
