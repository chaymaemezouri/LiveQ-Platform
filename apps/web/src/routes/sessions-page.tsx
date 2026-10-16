import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { duplicateSession, fetchSessions } from '@/lib/api';
import { formatDateTime } from '@/lib/dates';
import { ApiError } from '@/lib/http';

export function SessionsPage() {
  const location = useLocation();
  const notice =
    location.state &&
    typeof location.state === 'object' &&
    'notice' in location.state &&
    typeof location.state.notice === 'string'
      ? location.state.notice
      : '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: fetchSessions,
    refetchInterval: 5000,
  });
  const duplicate = useMutation({
    mutationFn: duplicateSession,
    onSuccess: async (next) => {
      setError('');
      await queryClient.invalidateQueries({ queryKey: ['sessions'] });
      await navigate(`/app/sessions/${next.id}`);
    },
    onError: (caught) => {
      setError(caught instanceof ApiError ? caught.message : 'The session could not be duplicated.');
    },
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Sessions</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Each session has one joining code for the whole meeting.
          </p>
        </div>
        <Button asChild>
          <Link to="/app/sessions/new">New session</Link>
        </Button>
      </div>

      {notice ? (
        <p className="mt-6 text-sm" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="text-destructive mt-6 text-sm" role="alert">
          {error}
        </p>
      ) : null}
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
      {sessions.data?.length === 0 ? (
        <div className="border-border mt-8 rounded-xl border border-dashed px-6 py-12 text-center">
          <h2 className="text-xl">No sessions yet</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Create a draft, then share the QR code when the room is ready.
          </p>
          <Button asChild className="mt-6">
            <Link to="/app/sessions/new">Create a session</Link>
          </Button>
        </div>
      ) : null}
      {sessions.data && sessions.data.length > 0 ? (
        <ul className="mt-8 grid gap-3">
          {sessions.data.map((session) => {
            const copying = duplicate.isPending && duplicate.variables === session.id;
            return (
              <li
                key={session.id}
                className="border-border bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-4 shadow-sm"
              >
                <Link
                  to={`/app/sessions/${session.id}`}
                  className="hover:bg-accent/40 min-w-0 flex-1 rounded-lg transition-colors"
                >
                  <h2 className="text-lg">{session.title}</h2>
                  <p className="text-muted-foreground mt-2 text-sm">
                    {formatDateTime(session.scheduledStartAt)} · {session.participantCount}{' '}
                    {session.participantCount === 1 ? 'participant' : 'participants'} · Code{' '}
                    {session.joinCode}
                  </p>
                </Link>
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={copying}
                    onClick={() => duplicate.mutate(session.id)}
                  >
                    {copying ? 'Duplicating…' : 'Duplicate'}
                  </Button>
                  <StatusBadge status={session.status} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </main>
  );
}
