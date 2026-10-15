import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { LiveDesk } from '@/components/live-desk';
import { QuestionList } from '@/components/question-list';
import { Button } from '@/components/ui/button';
import {
  activateSession,
  deleteSession,
  endSession,
  fetchSession,
  type Session,
} from '@/lib/api';
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-5">
      {session.isPending ? (
        <p className="mt-6 text-sm text-slate-500">Loading the session…</p>
      ) : null}
      {session.isError ? (
        <p className="mt-6 text-sm text-red-600" role="alert">
          {session.error instanceof ApiError ? session.error.message : 'Session not found.'}
        </p>
      ) : null}

      {session.data ? (
        <>
          {message ? (
            <p className="mb-3 text-sm text-slate-700" role="status">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="mb-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          {session.data.description ? (
            <p className="mb-3 max-w-3xl text-xs leading-5 text-slate-500">
              {session.data.description}
            </p>
          ) : null}
          <LiveDesk
            sessionId={session.data.id}
            sessionStatus={session.data.status}
            title={session.data.title}
            participantCount={session.data.participantCount}
            joinCode={session.data.joinCode}
            joinUrl={session.data.joinUrl}
            actions={
              <>
                <Button size="sm" asChild>
                  <a href={`/app/present/${session.data.id}`} target="_blank" rel="noreferrer">
                    Present
                  </a>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/app/reports/${session.data.id}`}>Statistics</Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/app/sessions/${session.data.id}/questions/new`}>Add question</Link>
                </Button>
                {session.data.status !== 'ENDED' ? (
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/app/sessions/${session.data.id}/edit`}>Edit</Link>
                  </Button>
                ) : null}
                {session.data.status === 'DRAFT' ? (
                  <Button size="sm" onClick={() => activate.mutate()} disabled={activate.isPending}>
                    {activate.isPending ? 'Activating…' : 'Activate'}
                  </Button>
                ) : null}
                {session.data.status === 'ACTIVE' ? (
                  <Button size="sm" onClick={() => end.mutate()} disabled={end.isPending}>
                    {end.isPending ? 'Ending…' : 'End session'}
                  </Button>
                ) : null}
                {confirmDelete ? (
                  <>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => remove.mutate()}
                      disabled={remove.isPending}
                    >
                      {remove.isPending ? 'Deleting…' : 'Confirm delete'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>
                      Keep session
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
                    Delete
                  </Button>
                )}
              </>
            }
          />
          <QuestionList sessionId={session.data.id} />
        </>
      ) : null}
    </main>
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
