import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  createSession,
  fetchSession,
  updateSession,
  type SessionInput,
} from '@/lib/api';
import { fromDateTimeLocal, toDateTimeLocal } from '@/lib/dates';
import { ApiError } from '@/lib/http';

export function SessionFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const existing = useQuery({
    queryKey: ['session', id],
    queryFn: () => fetchSession(id ?? ''),
    enabled: Boolean(id),
  });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledStartAt, setScheduledStartAt] = useState('');
  const [scheduledEndAt, setScheduledEndAt] = useState('');
  const [loaded, setLoaded] = useState(!id);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!existing.data || loaded) {
      return;
    }
    setTitle(existing.data.title);
    setDescription(existing.data.description ?? '');
    setScheduledStartAt(toDateTimeLocal(existing.data.scheduledStartAt));
    setScheduledEndAt(toDateTimeLocal(existing.data.scheduledEndAt));
    setLoaded(true);
  }, [existing.data, loaded]);

  const save = useMutation({
    mutationFn: (input: SessionInput) =>
      id ? updateSession(id, input) : createSession(input),
    onSuccess: async (session) => {
      queryClient.setQueryData(['session', session.id], session);
      await queryClient.invalidateQueries({ queryKey: ['sessions'] });
      await navigate(`/app/sessions/${session.id}`, {
        state: { notice: id ? 'Session saved.' : 'Session created.' },
      });
    },
    onError: (caught) => {
      setError(
        caught instanceof ApiError ? caught.message : 'The session could not be saved.',
      );
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const start = fromDateTimeLocal(scheduledStartAt);
    const end = fromDateTimeLocal(scheduledEndAt);
    if (title.trim().length === 0) {
      setError('Enter a session title.');
      return;
    }
    if (start && end && new Date(end).getTime() <= new Date(start).getTime()) {
      setError('The end time must be after the start time.');
      return;
    }
    save.mutate({
      title: title.trim(),
      description: description.trim() || null,
      scheduledStartAt: start,
      scheduledEndAt: end,
    });
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <p className="text-muted-foreground text-sm">
        <Link to="/app/sessions" className="hover:underline">
          Sessions
        </Link>
      </p>
      <h1 className="mt-2 text-3xl">{id ? 'Edit session' : 'New session'}</h1>
      <p className="text-muted-foreground mt-2 text-sm leading-6">
        A participation code is created with the session. You can share it after the
        draft looks right.
      </p>

      {id && existing.isPending ? (
        <p className="text-muted-foreground mt-8 text-sm">Loading the session…</p>
      ) : null}
      {id && existing.isError ? (
        <p className="text-destructive mt-8 text-sm" role="alert">
          {existing.error instanceof ApiError
            ? existing.error.message
            : 'Session not found.'}
        </p>
      ) : null}

      {!id || existing.data ? (
        <form className="mt-8 space-y-5" onSubmit={onSubmit} noValidate>
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={160}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={4000}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="scheduledStartAt">Starts</Label>
              <Input
                id="scheduledStartAt"
                type="datetime-local"
                value={scheduledStartAt}
                onChange={(event) => setScheduledStartAt(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduledEndAt">Ends</Label>
              <Input
                id="scheduledEndAt"
                type="datetime-local"
                value={scheduledEndAt}
                onChange={(event) => setScheduledEndAt(event.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={save.isPending || (Boolean(id) && !loaded)}>
              {save.isPending ? 'Saving…' : id ? 'Save changes' : 'Create session'}
            </Button>
            <Button variant="outline" asChild>
              <Link to={id ? `/app/sessions/${id}` : '/app/sessions'}>Cancel</Link>
            </Button>
          </div>
        </form>
      ) : null}
    </main>
  );
}
