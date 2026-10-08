import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useAuth } from '@/hooks/use-auth';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { fetchSessions, type SessionStatus } from '@/lib/api';
import { formatDateTime } from '@/lib/dates';
import { ApiError } from '@/lib/http';

export function OverviewPage() {
  const { user } = useAuth();
  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: fetchSessions,
    refetchInterval: 5000,
  });
  const counts = countByStatus(sessions.data ?? []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm">Speaker dashboard</p>
          <h1 className="mt-1 text-3xl">Hello, {user?.displayName ?? 'speaker'}</h1>
        </div>
        <Button asChild>
          <Link to="/app/sessions/new">New session</Link>
        </Button>
      </div>

      {sessions.isPending ? (
        <p className="text-muted-foreground mt-8 text-sm">Loading sessions…</p>
      ) : null}
      {sessions.isError ? (
        <p className="text-destructive mt-8 text-sm" role="alert">
          {sessions.error instanceof ApiError
            ? sessions.error.message
            : 'Sessions could not be loaded.'}
        </p>
      ) : null}

      {sessions.data ? (
        <>
          <section className="mt-8 grid gap-3 sm:grid-cols-3">
            <CountCard label="Draft" value={counts.DRAFT} />
            <CountCard label="Active" value={counts.ACTIVE} />
            <CountCard label="Ended" value={counts.ENDED} />
          </section>
          <section className="mt-10">
            <h2 className="text-xl">Recent sessions</h2>
            {sessions.data.length === 0 ? (
              <p className="text-muted-foreground mt-3 text-sm">
                No sessions yet. Create one when the room is ready.
              </p>
            ) : (
              <ul className="divide-border border-border bg-card mt-4 divide-y rounded-xl border">
                {sessions.data.slice(0, 5).map((session) => (
                  <li
                    key={session.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div>
                      <Link
                        to={`/app/sessions/${session.id}`}
                        className="font-medium hover:underline"
                      >
                        {session.title}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {formatDateTime(session.scheduledStartAt)} ·{' '}
                        {session.participantCount}{' '}
                        {session.participantCount === 1
                          ? 'participant'
                          : 'participants'}
                      </p>
                    </div>
                    <StatusBadge status={session.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-border bg-card rounded-xl border px-4 py-4 shadow-sm">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-1 font-serif text-3xl">{value}</p>
    </div>
  );
}

function countByStatus(sessions: { status: SessionStatus }[]) {
  return sessions.reduce(
    (counts, session) => {
      counts[session.status] += 1;
      return counts;
    },
    { DRAFT: 0, ACTIVE: 0, ENDED: 0 },
  );
}
