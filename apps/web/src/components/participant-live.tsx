import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ResultChart } from '@/components/result-chart';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/http';
import {
  castVote,
  fetchParticipantLive,
  openLiveSocket,
  type ParticipantLiveState,
} from '@/lib/live';
import { readParticipantToken } from '@/lib/participant';

export function ParticipantLive({ code }: { code: string }) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(true);
  const [error, setError] = useState('');
  const live = useQuery({
    queryKey: ['participant-live', code],
    queryFn: () => fetchParticipantLive(code),
    retry: false,
  });

  useEffect(() => {
    const token = readParticipantToken(code);
    if (!token) {
      return;
    }
    const socket = openLiveSocket({ role: 'participant', token });
    const merge = (patch: Partial<ParticipantLiveState>) => {
      queryClient.setQueryData<ParticipantLiveState>(
        ['participant-live', code],
        (current) => (current ? { ...current, ...patch } : current),
      );
    };
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('live:state', (state: ParticipantLiveState) => {
      queryClient.setQueryData<ParticipantLiveState>(
        ['participant-live', code],
        (current) => {
          const optionIds = new Set(
            state.question?.options.map((option) => option.id) ?? [],
          );
          const myOptionId =
            current?.myOptionId && optionIds.has(current.myOptionId)
              ? current.myOptionId
              : null;
          return { ...state, myOptionId };
        },
      );
    });
    socket.on('live:ballot', (ballot: { optionId: string | null }) => {
      merge({ myOptionId: ballot.optionId });
    });
    socket.on('live:votes', (payload: { voteCount: number }) => {
      merge({ voteCount: payload.voteCount });
    });
    socket.on('live:error', () => setConnected(false));
    return () => {
      socket.disconnect();
    };
  }, [code, queryClient]);

  const vote = useMutation({
    mutationFn: (optionId: string) => castVote(code, optionId),
    onSuccess: (result) => {
      queryClient.setQueryData<ParticipantLiveState>(
        ['participant-live', code],
        (current) =>
          current
            ? { ...current, myOptionId: result.myOptionId, voteCount: result.voteCount }
            : current,
      );
      setError('');
    },
    onError: (caught) =>
      setError(
        caught instanceof ApiError ? caught.message : 'Your vote could not be sent.',
      ),
  });

  if (live.isPending) {
    return (
      <p className="text-muted-foreground mt-6 text-sm">Waiting for the speaker…</p>
    );
  }
  if (live.isError || !live.data) {
    return (
      <p className="text-destructive mt-6 text-sm" role="alert">
        The live session could not be loaded. Your place on this device is still saved.
      </p>
    );
  }

  const state = live.data;
  if (state.sessionStatus === 'ENDED' && (state.phase === 'idle' || !state.question)) {
    return null;
  }
  if (state.phase === 'idle' || !state.question) {
    return (
      <p className="text-muted-foreground mt-6 text-base leading-7">
        You are connected. The speaker will open the next step from here.
      </p>
    );
  }

  const votingOpen = state.phase === 'open' && state.sessionStatus === 'ACTIVE';

  return (
    <div className="mt-6">
      {!connected ? (
        <p className="text-muted-foreground mb-4 text-sm" role="status">
          Reconnecting to the live session…
        </p>
      ) : null}
      <p className="text-muted-foreground text-sm font-medium tracking-[0.16em] uppercase">
        {state.phase === 'published'
          ? 'Results'
          : state.phase === 'closed'
            ? 'Voting closed'
            : 'Vote now'}
      </p>
      <p className="mt-3 text-2xl leading-snug">{state.question.prompt}</p>
      {error ? (
        <p className="text-destructive mt-4 text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {state.phase === 'published' && state.results ? (
        <ResultChart results={state.results} correctOptionId={state.correctOptionId} />
      ) : (
        <div className="mt-5 space-y-3">
          {state.question.options.map((option) => {
            const selected = state.myOptionId === option.id;
            return (
              <Button
                key={option.id}
                type="button"
                variant={selected ? 'default' : 'outline'}
                className="h-12 w-full justify-start"
                disabled={!votingOpen || vote.isPending || state.myOptionId != null}
                onClick={() => vote.mutate(option.id)}
              >
                {option.label}
                {selected ? ' · Your vote' : ''}
              </Button>
            );
          })}
        </div>
      )}
      {state.myOptionId && state.phase === 'open' ? (
        <p className="text-muted-foreground mt-4 text-sm" role="status">
          Your vote is in.
        </p>
      ) : null}
    </div>
  );
}
