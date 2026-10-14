import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ParticipantLive } from '@/components/participant-live';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/http';
import {
  clearParticipantToken,
  fetchParticipantPresence,
  isJoinCode,
  joinSession,
  normalizeJoinCode,
  readParticipantToken,
  writeParticipantToken,
  type ParticipantPresence,
} from '@/lib/participant';

export function JoinPage() {
  const params = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const routeCode = normalizeJoinCode(params.code ?? '');
  const [code, setCode] = useState(routeCode);
  const [nickname, setNickname] = useState('');
  const [token, setToken] = useState<string | null>(() =>
    routeCode ? readParticipantToken(routeCode) : null,
  );
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setCode(routeCode);
    setToken(routeCode ? readParticipantToken(routeCode) : null);
  }, [routeCode]);

  const presence = useQuery({
    queryKey: ['participant', routeCode, token],
    queryFn: () => fetchParticipantPresence(routeCode),
    enabled: Boolean(routeCode && token),
    retry: false,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (
      presence.error instanceof ApiError &&
      presence.error.status === 401 &&
      routeCode
    ) {
      clearParticipantToken(routeCode);
      setToken(null);
    }
  }, [presence.error, routeCode]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!isJoinCode(code)) {
      setError('Enter the 8-character joining code.');
      return;
    }
    const normalized = normalizeJoinCode(code);
    setPending(true);
    try {
      const result = await joinSession({ code: normalized, nickname });
      writeParticipantToken(normalized, result.accessToken);
      queryClient.setQueryData(['participant', normalized, result.accessToken], {
        participant: result.participant,
        session: result.session,
      });
      setToken(result.accessToken);
      if (routeCode !== normalized) {
        await navigate(`/join/${normalized}`, { replace: true });
      }
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setPending(false);
    }
  }

  if (token && presence.isPending) {
    return (
      <JoinShell>
        <p className="text-muted-foreground text-sm" role="status">
          Reconnecting…
        </p>
      </JoinShell>
    );
  }

  if (token && presence.isError && !presence.data) {
    return (
      <JoinShell>
        <h1 className="text-4xl">Waiting room</h1>
        <p className="text-destructive mt-4 text-sm" role="alert">
          LiveQ could not be reached. Your place in the session is still saved on this
          device.
        </p>
        <Button
          type="button"
          className="mt-6"
          variant="outline"
          onClick={() => void presence.refetch()}
        >
          Try again
        </Button>
      </JoinShell>
    );
  }

  if (token && presence.data) {
    return (
      <WaitingRoom
        code={routeCode}
        presence={presence.data}
        failed={
          presence.isError &&
          !(presence.error instanceof ApiError && presence.error.status === 401)
        }
        onRetry={() => void presence.refetch()}
        onForget={() => {
          if (routeCode) {
            clearParticipantToken(routeCode);
          }
          setToken(null);
        }}
      />
    );
  }

  return (
    <JoinShell>
      <h1 className="text-4xl">Join a session</h1>
      <p className="text-muted-foreground mt-3 text-base leading-7">
        Use the code or QR invitation from the speaker. A name is optional, and no
        account is required.
      </p>
      <form className="mt-8 space-y-4" onSubmit={onSubmit} noValidate>
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="code">Joining code</Label>
          <Input
            id="code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={8}
            className="h-12 font-mono text-lg tracking-[0.2em]"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nickname">Name</Label>
          <Input
            id="nickname"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            maxLength={40}
            placeholder="Optional"
            className="h-12"
          />
        </div>
        <Button type="submit" className="h-12 w-full" disabled={pending}>
          {pending ? 'Joining…' : 'Join session'}
        </Button>
      </form>
    </JoinShell>
  );
}

function WaitingRoom({
  code,
  presence,
  failed,
  onRetry,
  onForget,
}: {
  code: string;
  presence: ParticipantPresence;
  failed: boolean;
  onRetry: () => void;
  onForget: () => void;
}) {
  const ended = presence.session.status === 'ENDED';
  const people =
    presence.session.participantCount === 1
      ? '1 person is here'
      : `${presence.session.participantCount} people are here`;

  return (
    <JoinShell>
      <p className="text-muted-foreground text-sm font-medium tracking-[0.16em] uppercase">
        {ended ? 'Session ended' : 'Waiting room'}
      </p>
      <h1 className="mt-3 text-4xl">{presence.session.title}</h1>
      {ended ? (
        <p className="text-muted-foreground mt-3 text-base leading-7">
          The speaker has ended this session.
        </p>
      ) : null}
      <ParticipantLive code={code} />
      <p className="mt-6 text-sm" role="status">
        {presence.participant.nickname
          ? `Joined as ${presence.participant.nickname}. `
          : 'Joined anonymously. '}
        {people}.
      </p>
      {failed ? (
        <div className="mt-6 space-y-3">
          <p className="text-destructive text-sm" role="alert">
            The connection dropped. Your place in the session is still saved on this
            device.
          </p>
          <Button type="button" variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}
      <Button type="button" variant="outline" className="mt-8" onClick={onForget}>
        Join with a different name
      </Button>
    </JoinShell>
  );
}

function JoinShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-md items-center justify-between px-6 py-4">
        <Link to="/" className="font-serif text-2xl text-yellow-500">
          LiveQ
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto flex max-w-md flex-col px-6 py-8">{children}</main>
    </div>
  );
}

function messageFrom(caught: unknown): string {
  if (caught instanceof ApiError) {
    return caught.message;
  }
  return 'LiveQ could not be reached. Check your connection and try again.';
}
