import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Radio, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CountdownRing } from '@/components/countdown-ring';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/http';
import {
  castVote,
  fetchParticipantLive,
  fetchParticipantReview,
  openLiveSocket,
  submitWrittenAnswer,
  type LiveOption,
  type LivePhase,
  type LiveResult,
  type ParticipantLiveState,
} from '@/lib/live';
import { readParticipantToken } from '@/lib/participant';

const optionStyles = [
  { wash: 'border-blue-100 bg-blue-50', chip: 'bg-blue-500', bar: 'bg-blue-500' },
  { wash: 'border-violet-100 bg-violet-50', chip: 'bg-violet-500', bar: 'bg-violet-500' },
  { wash: 'border-cyan-100 bg-cyan-50', chip: 'bg-cyan-500', bar: 'bg-cyan-500' },
  { wash: 'border-orange-100 bg-orange-50', chip: 'bg-orange-500', bar: 'bg-orange-500' },
];

export function ParticipantLive({ code }: { code: string }) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(true);
  const [error, setError] = useState('');
  const [answer, setAnswer] = useState('');
  const [choice, setChoice] = useState<string | null>(null);
  const [cursor, setCursor] = useState(Number.MAX_SAFE_INTEGER);
  const live = useQuery({
    queryKey: ['participant-live', code],
    queryFn: () => fetchParticipantLive(code),
    retry: false,
  });
  const review = useQuery({
    queryKey: ['participant-review', code],
    queryFn: () => fetchParticipantReview(code),
    retry: false,
    refetchInterval: 4000,
  });
  const items = review.data?.items ?? [];
  const lastRunId = items.at(-1)?.runId ?? '';

  useEffect(() => {
    if (items.length > 0) {
      setCursor(items.length - 1);
    }
  }, [items.length, lastRunId]);

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
      void queryClient.invalidateQueries({ queryKey: ['participant-review', code] });
    });
    socket.on(
      'live:ballot',
      (ballot: { optionId: string | null; textResponse?: string | null }) => {
        merge({ myOptionId: ballot.optionId, myText: ballot.textResponse ?? null });
        void queryClient.invalidateQueries({ queryKey: ['participant-review', code] });
      },
    );
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
      setChoice(null);
      setError('');
      void queryClient.invalidateQueries({ queryKey: ['participant-review', code] });
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
      void queryClient.invalidateQueries({ queryKey: ['participant-review', code] });
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
  const safeCursor = items.length === 0 ? 0 : Math.min(cursor, items.length - 1);
  const viewing = items[safeCursor];
  const currentRunId = state.question?.runId;
  const reviewHasCurrent =
    !currentRunId || items.some((item) => item.runId === currentRunId);
  const onCurrent = !viewing || !reviewHasCurrent || viewing.runId === currentRunId;
  const total = Math.max(review.data?.questionCount ?? 0, items.length);
  const position = onCurrent ? (state.question?.position ?? viewing?.position ?? 0) : viewing.position;

  if (state.sessionStatus === 'ENDED' && items.length === 0 && (state.phase === 'idle' || !state.question)) {
    return null;
  }
  if ((state.phase === 'idle' || !state.question) && items.length === 0) {
    return (
      <p className="text-muted-foreground mt-6 text-base leading-7">
        You are connected. The speaker will open the next step from here.
      </p>
    );
  }

  const card = onCurrent && state.question
    ? {
        prompt: state.question.prompt,
        kind: state.question.kind ?? 'CHOICE',
        phase: state.phase,
        options: state.question.options,
        myOptionId: state.myOptionId,
        myText: state.myText,
        results: state.results ?? null,
        responses: state.responses ?? null,
        correctOptionId: state.correctOptionId ?? null,
        closesAt: state.closesAt,
        timerSeconds: state.timerSeconds,
        interactive: true,
      }
    : viewing
      ? {
          prompt: viewing.prompt,
          kind: viewing.kind,
          phase: viewing.phase as LivePhase,
          options: viewing.options,
          myOptionId: viewing.myOptionId,
          myText: viewing.myText,
          results: viewing.results,
          responses: viewing.responses,
          correctOptionId: viewing.correctOptionId,
          closesAt: null,
          timerSeconds: null,
          interactive: false,
        }
      : null;

  if (!card) {
    return null;
  }

  const votingOpen =
    card.interactive && card.phase === 'open' && state.sessionStatus === 'ACTIVE';

  return (
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white">
          <Radio className="size-4" aria-hidden />
          Live
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${connected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
        >
          <Wifi className="size-3.5" aria-hidden />
          {connected ? 'Connected' : 'Reconnecting'}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-sm">
        <p>
          <span className="font-semibold text-blue-600">
            Question {String(position).padStart(2, '0')}
          </span>
          {total > 0 ? <span className="text-slate-400"> / {String(total).padStart(2, '0')}</span> : null}
        </p>
        <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
          {card.phase === 'published'
            ? 'Results'
            : card.phase === 'closed'
              ? 'Voting closed'
              : card.phase === 'open'
                ? 'Voting open'
                : 'Waiting'}
        </p>
      </div>
      {total > 0 ? (
        <div className="mt-2 flex gap-1" aria-hidden>
          {Array.from({ length: total }, (_, index) => (
            <span
              key={index}
              className={`h-1.5 flex-1 rounded-full ${index < position ? 'bg-blue-600' : 'bg-slate-200'}`}
            />
          ))}
        </div>
      ) : null}

      {card.phase === 'open' && card.closesAt && card.timerSeconds ? (
        <div className="mt-5 flex justify-center">
          <CountdownRing closesAt={card.closesAt} totalSeconds={card.timerSeconds} large />
        </div>
      ) : null}

      <h2 className="mt-4 text-2xl leading-snug font-semibold text-slate-900">{card.prompt}</h2>
      <p className="mt-1 text-sm text-slate-500">
        {card.kind === 'TEXT'
          ? 'Type your answer below.'
          : card.phase === 'published'
            ? 'Published results for this question.'
            : 'Choose the correct answer below.'}
      </p>

      {!connected ? (
        <p className="mt-3 text-sm text-slate-500" role="status">
          Reconnecting to the live session…
        </p>
      ) : null}
      {error && card.interactive ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {card.kind === 'TEXT' ? (
        <WrittenPane
          card={card}
          answer={answer}
          votingOpen={votingOpen}
          pending={written.isPending}
          onAnswer={setAnswer}
          onSubmit={() => written.mutate()}
        />
      ) : card.phase === 'published' && card.results ? (
        <ResultBars results={card.results} correctOptionId={card.correctOptionId} />
      ) : (
        <ChoicePane
          options={card.options}
          selectedId={card.myOptionId ?? (card.interactive ? choice : null)}
          locked={card.myOptionId != null || !votingOpen}
          onSelect={setChoice}
        />
      )}

      {card.kind !== 'TEXT' && card.interactive && card.phase !== 'published' ? (
        <>
          <button
            type="button"
            className="mt-4 h-12 w-full rounded-2xl bg-blue-500 text-sm font-semibold text-white disabled:opacity-50"
            disabled={!votingOpen || vote.isPending || card.myOptionId != null || !choice}
            onClick={() => choice && vote.mutate(choice)}
          >
            {vote.isPending ? 'Sending…' : 'Submit answer'}
          </button>
          <p className="mt-3 text-center text-xs text-slate-400">
            Your answer is final once submitted.
          </p>
        </>
      ) : null}
      {card.kind !== 'TEXT' && card.phase !== 'published' && card.phase !== 'open' ? (
        <p className="mt-3 text-center text-sm text-slate-500">
          Results stay hidden until the speaker publishes them.
        </p>
      ) : null}
      {card.myOptionId && card.phase === 'open' ? (
        <p className="mt-2 text-center text-sm text-blue-700" role="status">
          Your answer is in.
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="h-10 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 disabled:opacity-40"
            disabled={safeCursor <= 0}
            onClick={() => setCursor((current) => Math.max(0, current - 1))}
          >
            Previous
          </button>
          <button
            type="button"
            className="h-10 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 disabled:opacity-40"
            disabled={safeCursor >= items.length - 1}
            onClick={() => setCursor((current) => Math.min(items.length - 1, current + 1))}
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}

function ChoicePane({
  options,
  selectedId,
  locked,
  onSelect,
}: {
  options: LiveOption[];
  selectedId: string | null;
  locked: boolean;
  onSelect: (optionId: string) => void;
}) {
  return (
    <div className="mt-4 space-y-2">
      {options.map((option, index) => {
        const style = optionStyles[index % optionStyles.length] ?? optionStyles[0];
        const selected = selectedId === option.id;
        return (
          <button
            key={option.id}
            type="button"
            className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left ${style?.wash ?? ''} ${selected ? 'ring-2 ring-blue-500' : ''}`}
            disabled={locked}
            onClick={() => onSelect(option.id)}
          >
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-xl text-sm font-semibold text-white ${style?.chip ?? 'bg-blue-500'}`}
            >
              {String.fromCharCode(65 + index)}
            </span>
            <span className="min-w-0 flex-1 text-sm font-medium text-slate-800">{option.label}</span>
            <span
              className={`size-4 shrink-0 rounded-full border ${selected ? 'border-blue-500 bg-blue-500' : 'border-slate-300 bg-white'}`}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}

function WrittenPane({
  card,
  answer,
  votingOpen,
  pending,
  onAnswer,
  onSubmit,
}: {
  card: {
    phase: LivePhase;
    myText: string | null;
    responses: string[] | null;
    interactive: boolean;
  };
  answer: string;
  votingOpen: boolean;
  pending: boolean;
  onAnswer: (value: string) => void;
  onSubmit: () => void;
}) {
  if (card.phase === 'published') {
    return (
      <ul className="mt-4 space-y-2">
        {(card.responses ?? []).length === 0 ? (
          <li className="text-sm text-slate-500">No written answers.</li>
        ) : (
          card.responses?.map((response, index) => (
            <li key={index} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              {response}
            </li>
          ))
        )}
      </ul>
    );
  }
  return (
    <div className="mt-4 space-y-3">
      <Textarea
        aria-label="Your answer"
        value={card.myText ?? answer}
        onChange={(event) => onAnswer(event.target.value)}
        maxLength={500}
        disabled={!votingOpen || pending || card.myText != null}
        placeholder="Type your answer"
      />
      <button
        type="button"
        className="h-12 w-full rounded-2xl bg-blue-500 text-sm font-semibold text-white disabled:opacity-50"
        disabled={!votingOpen || pending || card.myText != null || answer.trim().length === 0}
        onClick={onSubmit}
      >
        {pending ? 'Sending…' : 'Submit answer'}
      </button>
      <p className="text-center text-xs text-slate-400">Your answer is final once submitted.</p>
      {card.myText ? (
        <p className="text-center text-sm text-blue-700" role="status">
          Your answer is in.
        </p>
      ) : card.phase !== 'open' ? (
        <p className="text-center text-sm text-slate-500">
          Results stay hidden until the speaker publishes them.
        </p>
      ) : null}
    </div>
  );
}

function ResultBars({
  results,
  correctOptionId,
}: {
  results: LiveResult[];
  correctOptionId: string | null;
}) {
  return (
    <figure aria-label="Results" className="mt-4 space-y-3">
      {results.map((result, index) => {
        const style = optionStyles[index % optionStyles.length] ?? optionStyles[0];
        const correct = result.optionId === correctOptionId;
        return (
          <div key={result.optionId}>
            <div className="mb-1 flex items-center justify-between gap-2 text-sm">
              <span>
                {String.fromCharCode(65 + index)} {result.label}
                {correct ? <span className="ml-2 text-xs font-semibold tracking-wide text-emerald-600 uppercase">Correct</span> : null}
              </span>
              <span className="text-slate-500">{result.percent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${correct ? 'bg-emerald-500' : (style?.bar ?? 'bg-blue-500')}`}
                style={{ width: `${result.percent}%` }}
              />
            </div>
          </div>
        );
      })}
    </figure>
  );
}
