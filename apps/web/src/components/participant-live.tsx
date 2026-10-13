import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNow } from '@/hooks/use-now';
import { ResultChart } from '@/components/result-chart';
import { formatClock, remainingSeconds } from '@/lib/clock';
import { ApiError } from '@/lib/http';
import {
  castVote,
  fetchParticipantLive,
  openLiveSocket,
  submitWrittenAnswer,
  type ParticipantLiveState,
} from '@/lib/live';
import { Textarea } from '@/components/ui/textarea';
import { readParticipantToken } from '@/lib/participant';

export function ParticipantLive({ code }: { code: string }) {
  const queryClient = useQueryClient();
  const now = useNow();
  const [connected, setConnected] = useState(true);
  const [error, setError] = useState('');
  const [answer, setAnswer] = useState('');
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
          return { ...state, myOptionId, myText: current?.myText ?? null };
        },
      );
    });
    socket.on('live:ballot', (ballot: { optionId: string | null; textResponse?: string | null }) => {
      merge({ myOptionId: ballot.optionId, myText: ballot.textResponse ?? null });
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

  const written = useMutation({
    mutationFn: () => submitWrittenAnswer(code, answer.trim()),
    onSuccess: (result) => {
      queryClient.setQueryData<ParticipantLiveState>(
        ['participant-live', code],
        (current) =>
          current
            ? {
                ...current,
                myText: result.textResponse,
                voteCount: result.voteCount,
              }
            : current,
      );
      setAnswer('');
      setError('');
    },
    onError: (caught) =>
      setError(
        caught instanceof ApiError ? caught.message : 'Your answer could not be sent.',
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
  const optionTones = ['bg-blue-500', 'bg-rose-500', 'bg-emerald-500', 'bg-violet-500'];
  const optionWashes = [
    'border-blue-200 bg-blue-50',
    'border-rose-200 bg-rose-50',
    'border-emerald-200 bg-emerald-50',
    'border-violet-200 bg-violet-50',
  ];

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
      {state.phase === 'open' && state.closesAt ? (
        <p className="mt-3 font-serif text-3xl" role="timer">
          {formatClock(remainingSeconds(state.closesAt, now) ?? 0)}
        </p>
      ) : null}
      {error ? (
        <p className="text-destructive mt-4 text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {state.question.kind === 'TEXT' ? (
        <div className="mt-5 space-y-3">
          {state.phase === 'published' && state.responses ? (
            <ul className="space-y-2">
              {state.responses.length === 0 ? (
                <li className="text-muted-foreground text-sm">No written answers.</li>
              ) : (
                state.responses.map((response, index) => (
                  <li key={index} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                    {response}
                  </li>
                ))
              )}
            </ul>
          ) : (
            <>
              <Textarea
                aria-label="Your answer"
                value={state.myText ?? answer}
                onChange={(event) => setAnswer(event.target.value)}
                maxLength={500}
                disabled={!votingOpen || written.isPending || state.myText != null}
                placeholder="Type your answer"
              />
              <button
                type="button"
                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={
                  !votingOpen ||
                  written.isPending ||
                  state.myText != null ||
                  answer.trim().length === 0
                }
                onClick={() => written.mutate()}
              >
                {written.isPending ? 'Sending…' : 'Send answer'}
              </button>
              {state.myText ? (
                <p className="text-muted-foreground text-sm" role="status">
                  Your answer is in.
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : state.phase === 'published' && state.results ? (
        <ResultChart results={state.results} correctOptionId={state.correctOptionId} />
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {state.question.options.map((option, index) => {
            const selected = state.myOptionId === option.id;
            return (
              <button
                key={option.id}
                type="button"
                className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 disabled:hover:translate-y-0 ${optionWashes[index % optionWashes.length]} ${selected ? 'ring-2 ring-blue-500' : ''}`}
                disabled={!votingOpen || vote.isPending || state.myOptionId != null}
                onClick={() => vote.mutate(option.id)}
              >
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-white ${optionTones[index % optionTones.length]}`}
                >
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="min-w-0 flex-1 text-base">
                  {option.label}
                  {selected ? (
                    <span className="mt-0.5 block text-xs text-blue-700">Your vote</span>
                  ) : null}
                </span>
              </button>
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
