import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { LiveDesk } from '@/components/live-desk';
import { QuestionList } from '@/components/question-list';
import { QrCode } from '@/components/qr-code';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import {
  activateSession,
  deleteSession,
  endSession,
  fetchSession,
  type Session,
} from '@/lib/api';
import { formatDateTime } from '@/lib/dates';
import { ApiError } from '@/lib/http';

export function SessionDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const notice = readNotice(location.state);
  const [message, setMessage] = useState(notice);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  const session = useQuery({
    queryKey: ['session', id],
    queryFn: () => fetchSession(id),
    refetchInterval: 5000,
  });

  function remember(next: Session) {
    queryClient.setQueryData(['session', id], next);
    void queryClient.invalidateQueries({ queryKey: ['sessions'] });
  }

  const activate = useMutation({
    mutationFn: () => activateSession(id),
    onSuccess: (next) => {
      remember(next);
      setError('');
      setMessage('The session is active. Participants can use the joining address.');
    },
    onError: (caught) => setError(messageFrom(caught)),
  });

  const end = useMutation({
    mutationFn: () => endSession(id),
    onSuccess: (next) => {
      remember(next);
      setError('');
      setMessage('The session has ended.');
    },
    onError: (caught) => setError(messageFrom(caught)),
  });

  const remove = useMutation({
    mutationFn: () => deleteSession(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sessions'] });
      await navigate('/app/sessions', { state: { notice: 'Session deleted.' } });
    },
    onError: (caught) => setError(messageFrom(caught)),
  });

  async function copyJoinUrl(joinUrl: string) {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setError('');
    } catch {
      setCopied(false);
      setError(
        'The joining address could not be copied. Select it from the field below.',
      );
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <p className="text-muted-foreground text-sm">
        <Link to="/app/sessions" className="hover:underline">
          Sessions
        </Link>
      </p>

      {session.isPending ? (
        <p className="text-muted-foreground mt-8 text-sm">Loading the session…</p>
      ) : null}
      {session.isError ? (
        <p className="text-destructive mt-8 text-sm" role="alert">
          {session.error instanceof ApiError
            ? session.error.message
            : 'Session not found.'}
        </p>
      ) : null}

      {session.data ? (
        <>
          <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <section>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl">{session.data.title}</h1>
                <StatusBadge status={session.data.status} />
              </div>
              <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-6">
                {session.data.description || 'No description.'}
              </p>
              {message ? (
                <p className="text-foreground mt-4 text-sm" role="status">
                  {message}
                </p>
              ) : null}
              {error ? (
                <p className="text-destructive mt-4 text-sm" role="alert">
                  {error}
                </p>
              ) : null}

              <dl className="mt-8 grid gap-4 sm:grid-cols-2">
                <Detail
                  label="Scheduled start"
                  value={formatDateTime(session.data.scheduledStartAt)}
                />
                <Detail
                  label="Scheduled end"
                  value={formatDateTime(session.data.scheduledEndAt)}
                />
                <Detail
                  label="Activated"
                  value={formatDateTime(session.data.startedAt, 'Not yet')}
                />
                <Detail
                  label="Ended"
                  value={formatDateTime(session.data.endedAt, 'Not yet')}
                />
                <Detail
                  label="Participants"
                  value={String(session.data.participantCount)}
                />
              </dl>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button variant="outline" asChild>
                  <Link to={`/app/reports/${session.data.id}`}>Statistics</Link>
                </Button>
                {session.data.status !== 'ENDED' ? (
                  <Button variant="outline" asChild>
                    <Link to={`/app/sessions/${session.data.id}/edit`}>Edit</Link>
                  </Button>
                ) : null}
                {session.data.status === 'DRAFT' ? (
                  <Button
                    onClick={() => activate.mutate()}
                    disabled={activate.isPending}
                  >
                    {activate.isPending ? 'Activating…' : 'Activate'}
                  </Button>
                ) : null}
                {session.data.status === 'ACTIVE' ? (
                  <Button onClick={() => end.mutate()} disabled={end.isPending}>
                    {end.isPending ? 'Ending…' : 'End session'}
                  </Button>
                ) : null}
                {confirmDelete ? (
                  <>
                    <Button
                      variant="destructive"
                      onClick={() => remove.mutate()}
                      disabled={remove.isPending}
                    >
                      {remove.isPending ? 'Deleting…' : 'Confirm delete'}
                    </Button>
                    <Button variant="outline" onClick={() => setConfirmDelete(false)}>
                      Keep session
                    </Button>
                  </>
                ) : (
                  <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                    Delete
                  </Button>
                )}
              </div>
            </section>

            <aside className="border-border bg-card rounded-xl border p-4 shadow-sm">
              <h2 className="text-lg">Joining code</h2>
              <p className="mt-1 font-mono text-2xl tracking-[0.2em]">
                {session.data.joinCode}
              </p>
              <p className="text-muted-foreground mt-3 text-sm break-all">
                {session.data.joinUrl}
              </p>
              <div className="mt-4 max-w-60">
                <QrCode value={session.data.joinUrl} />
              </div>
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => void copyJoinUrl(session.data.joinUrl)}
              >
                {copied ? 'Copied' : 'Copy joining address'}
              </Button>
            </aside>
          </div>
          <LiveDesk sessionId={session.data.id} sessionStatus={session.data.status} />
          <QuestionList sessionId={session.data.id} />
        </>
      ) : null}
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs tracking-wide uppercase">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  );
}

function messageFrom(caught: unknown): string {
  return caught instanceof ApiError
    ? caught.message
    : 'The session could not be updated.';
}

function readNotice(state: unknown): string {
  if (!state || typeof state !== 'object' || !('notice' in state)) {
    return '';
  }
  const notice = (state as { notice?: unknown }).notice;
  return typeof notice === 'string' ? notice : '';
}
