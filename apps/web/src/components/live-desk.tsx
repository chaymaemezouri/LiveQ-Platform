import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CountdownRing } from '@/components/countdown-ring';
import { QrCode } from '@/components/qr-code';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNow } from '@/hooks/use-now';
import { fetchQuestions, type Question } from '@/lib/api';
import { formatClock, remainingSeconds } from '@/lib/clock';
import { ApiError } from '@/lib/http';
import { postPresentView } from '@/lib/present-channel';
import { fetchReport } from '@/lib/reports';
import {
  closeVoting,
  fetchLiveState,
  launchQuestion,
  openLiveSocket,
  publishResults,
  type LiveState,
} from '@/lib/live';

export function LiveDesk({
  sessionId,
  sessionStatus,
  title,
  participantCount,
  joinCode,
  joinUrl,
  actions,
}: {
  sessionId: string;
  sessionStatus: 'DRAFT' | 'ACTIVE' | 'ENDED';
  title: string;
  participantCount: number;
  joinCode: string;
  joinUrl: string;
  actions?: ReactNode;
}) {
  const queryClient = useQueryClient();
  const now = useNow();
  const [connected, setConnected] = useState(true);
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState('30');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(true);
  const [qrOpen, setQrOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const live = useQuery({
    queryKey: ['live', sessionId],
    queryFn: () => fetchLiveState(sessionId),
    enabled: sessionStatus !== 'DRAFT',
  });
  const questions = useQuery({
    queryKey: ['questions', sessionId],
    queryFn: () => fetchQuestions(sessionId),
  });
  const report = useQuery({
    queryKey: ['report', sessionId],
    queryFn: () => fetchReport(sessionId),
    enabled: sessionStatus !== 'DRAFT',
  });

  useEffect(() => {
    if (sessionStatus === 'DRAFT') {
      return;
    }
    const token = localStorage.getItem('liveq.accessToken');
    if (!token) {
      return;
    }
    const socket = openLiveSocket({ role: 'speaker', token, sessionId });
    const remember = (state: LiveState) => {
      queryClient.setQueryData(['live', sessionId], state);
    };
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('live:state', (next: LiveState) => {
      remember(next);
      if (next.phase === 'published') {
        void queryClient.invalidateQueries({ queryKey: ['report', sessionId] });
      }
    });
    socket.on('live:votes', (payload: { voteCount: number }) => {
      queryClient.setQueryData<LiveState>(['live', sessionId], (current) =>
        current ? { ...current, voteCount: payload.voteCount } : current,
      );
      void queryClient.invalidateQueries({ queryKey: ['questions', sessionId] });
    });
    return () => {
      socket.disconnect();
    };
  }, [queryClient, sessionId, sessionStatus]);

  useEffect(() => {
    if (!qrOpen) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setQrOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [qrOpen]);

  const run = useMutation({
    mutationFn: (action: () => Promise<LiveState>) => action(),
    onSuccess: (state) => {
      queryClient.setQueryData(['live', sessionId], state);
      setSelectedId(state.question?.questionId ?? null);
      setShowResults(state.phase === 'published');
      setError('');
      void queryClient.invalidateQueries({ queryKey: ['questions', sessionId] });
      void queryClient.invalidateQueries({ queryKey: ['report', sessionId] });
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : 'The live update failed.'),
  });

  function readTimer(): number | null | 'invalid' {
    if (!seconds.trim()) {
      return null;
    }
    const value = Number(seconds);
    if (!Number.isInteger(value) || value < 5 || value > 600) {
      return 'invalid';
    }
    return value;
  }

  function launch(questionId: string) {
    const timer = readTimer();
    if (timer === 'invalid') {
      setError('Use a time from 5 to 600 seconds, or leave it empty.');
      return;
    }
    postPresentView(sessionId, 'question');
    run.mutate(() => launchQuestion(sessionId, questionId, timer));
  }

  const revealed = useRef<string | null>(null);

  const state = live.data;
  const ordered = [...(questions.data ?? [])].sort((left, right) => left.position - right.position);
  const asked = new Set(state?.askedQuestionIds ?? []);
  const currentId = state?.question?.questionId ?? null;
  const viewingId = selectedId ?? currentId;
  const viewing = ordered.find((question) => question.id === viewingId) ?? null;
  const viewingIndex = ordered.findIndex((question) => question.id === viewingId);
  const viewingCurrent = viewing != null && viewing.id === currentId;
  const saved = report.data?.questions.find((question) => question.questionId === viewing?.id);
  const published = viewingCurrent ? state?.phase === 'published' : Boolean(saved?.published);
  const canOpen =
    sessionStatus === 'ACTIVE' && (state?.phase === 'idle' || state?.phase === 'published');
  const upcoming = ordered.filter((question) => !asked.has(question.id));
  const selectedUpcoming = viewing && !asked.has(viewing.id) ? viewing : null;
  const laterUpcoming =
    upcoming.find(
      (question) => state?.question == null || question.position > state.question.position,
    ) ?? null;
  const remaining = state?.phase === 'open' ? remainingSeconds(state.closesAt, now) : null;
  const responded =
    participantCount === 0
      ? 0
      : Math.min(100, Math.round(((state?.voteCount ?? 0) / participantCount) * 100));
  const total = ordered.length;
  const liveKey = `${currentId ?? ''}:${state?.phase ?? ''}`;

  useEffect(() => {
    if (state?.phase !== 'published' || !currentId || revealed.current === liveKey) {
      revealed.current = liveKey;
      return;
    }
    revealed.current = liveKey;
    setSelectedId(currentId);
    setShowResults(true);
  }, [currentId, liveKey, state?.phase]);

  useEffect(() => {
    if (!viewingId) {
      return;
    }
    const node = document.getElementById(`studio-question-${viewingId}`);
    const list = node?.closest('ul');
    if (!node || !(list instanceof HTMLElement)) {
      return;
    }
    const top = node.getBoundingClientRect().top - list.getBoundingClientRect().top;
    if (top < 0 || top + node.getBoundingClientRect().height > list.clientHeight) {
      list.scrollTop += top - 8;
    }
  }, [viewingId]);

  return (
    <section className="text-slate-900">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-slate-400">Sessions / {title}</p>
          <h2 className="mt-1 text-xl font-semibold">Live Session Studio</h2>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
          <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
          {sessionStatus === 'ACTIVE' ? 'Live' : sessionStatus === 'ENDED' ? 'Ended' : 'Draft'}
        </span>
      </div>
      {actions ? <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div> : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Participants" value={String(participantCount)} />
        <Metric
          label="Question"
          value={
            viewing
              ? `${String(viewing.position).padStart(2, '0')}/${String(total).padStart(2, '0')}`
              : `—/${String(total).padStart(2, '0')}`
          }
        />
        <Metric
          label="Responses"
          value={
            viewingCurrent
              ? String(state?.voteCount ?? 0)
              : saved
                ? String(saved.voteCount)
                : '—'
          }
        />
        <Metric label="Timer" value={remaining === null ? '—' : formatClock(remaining)} live={remaining !== null} />
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {sessionStatus !== 'DRAFT' && !connected ? (
        <p className="mt-3 text-sm text-slate-500" role="status">
          Reconnecting to the live session…
        </p>
      ) : null}

      <div className="mt-4 grid items-start gap-3 lg:grid-cols-[16rem_minmax(0,1fr)_17rem]">
        <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold">Questions</h3>
          {questions.isPending ? (
            <p className="mt-3 text-sm text-slate-500">Loading questions…</p>
          ) : ordered.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Add a question before the room opens.</p>
          ) : (
            <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
              {ordered.map((question) => {
                const tone = questionTone(question, currentId, state?.phase, asked);
                const selected = question.id === viewingId;
                return (
                  <li key={question.id}>
                    <button
                      type="button"
                      id={`studio-question-${question.id}`}
                      onClick={() => {
                        setSelectedId(question.id);
                        setShowResults(asked.has(question.id));
                      }}
                      className={`w-full rounded-2xl px-3 py-2 text-left ${
                        selected ? 'bg-blue-50 ring-2 ring-blue-500' : 'bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <span className={`block text-xs font-medium ${tone.className}`}>
                        {tone.label}
                      </span>
                      <span className="mt-0.5 block text-sm font-medium">{question.prompt}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          {sessionStatus === 'DRAFT' ? (
            <p className="text-sm text-slate-500">Activate the session before opening a question.</p>
          ) : live.isPending ? (
            <p className="text-sm text-slate-500">Loading the live room…</p>
          ) : !viewing ? (
            <p className="text-sm text-slate-500">Open a question when the room is ready to vote.</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase">
                  Question {String(viewing.position).padStart(2, '0')}
                </p>
                <PhaseBadge
                  phase={
                    viewingCurrent
                      ? (state?.phase ?? 'idle')
                      : published
                        ? 'published'
                        : 'idle'
                  }
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  disabled={viewingIndex <= 0}
                  onClick={() => {
                    const previous = ordered[viewingIndex - 1];
                    if (!previous) return;
                    setSelectedId(previous.id);
                    setShowResults(asked.has(previous.id));
                  }}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={viewingIndex < 0 || viewingIndex >= ordered.length - 1}
                  onClick={() => {
                    const next = ordered[viewingIndex + 1];
                    if (!next) return;
                    setSelectedId(next.id);
                    setShowResults(asked.has(next.id));
                  }}
                >
                  Next
                </Button>
              </div>
              <p className="mt-3 text-lg leading-snug font-semibold">{viewing.prompt}</p>
              {published && showResults ? (
                <PublishedAnswers
                  kind={viewing.kind}
                  options={
                    viewingCurrent && state?.results
                      ? state.results.map((result) => ({
                          optionId: result.optionId,
                          label: result.label,
                          percent: result.percent,
                          correct: result.optionId === state.correctOptionId,
                        }))
                      : (saved?.options ?? []).map((option) => ({
                          optionId: option.optionId,
                          label: option.label,
                          percent: option.percent,
                          correct: option.optionId === saved?.correctOptionId,
                        }))
                  }
                  responses={
                    viewingCurrent && state?.responses
                      ? state.responses
                      : (saved?.responses ?? [])
                  }
                />
              ) : viewing.kind === 'TEXT' ? (
                <p className="mt-4 text-sm text-slate-500">
                  {published
                    ? 'Written answers stay on the results view.'
                    : 'Written answers stay hidden until you publish the results.'}
                </p>
              ) : (
                <ol className="mt-4 space-y-2">
                  {viewing.options.map((option, index) => (
                    <li key={option.id} className="text-sm text-slate-700">
                      <span className="mr-2 font-semibold text-slate-400">
                        {String.fromCharCode(65 + index)}
                      </span>
                      {option.label}
                    </li>
                  ))}
                </ol>
              )}
              {viewingCurrent && state?.phase === 'open' && state.closesAt && state.timerSeconds ? (
                <div className="mt-5 flex justify-center">
                  <CountdownRing
                    closesAt={state.closesAt}
                    totalSeconds={state.timerSeconds}
                    large
                  />
                </div>
              ) : null}
              {viewingCurrent && state?.phase === 'open' ? (
                <>
                  <p className="mt-5 text-sm text-slate-500" role="status">
                    {state.voteCount} of {participantCount} participants responded
                  </p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${responded}%` }} />
                  </div>
                </>
              ) : !asked.has(viewing.id) ? (
                <p className="mt-5 text-sm text-slate-500">This question has not been opened yet.</p>
              ) : null}
              {!viewingCurrent && (state?.phase === 'open' || state?.phase === 'closed') ? (
                <Button
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={() => {
                    setSelectedId(currentId);
                    setShowResults(false);
                  }}
                >
                  Back to live question
                </Button>
              ) : null}
              {sessionStatus === 'ACTIVE' ? (
                <div className="mt-5">
                  <Label htmlFor="question-seconds">Timer</Label>
                  <Input
                    id="question-seconds"
                    className="mt-2"
                    inputMode="numeric"
                    value={seconds}
                    onChange={(event) => setSeconds(event.target.value)}
                    placeholder="Empty for no timer"
                    disabled={viewingCurrent && state?.phase === 'open'}
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Set this, then press Launch question. The countdown stays on this screen.
                    When it ends, the results open.
                  </p>
                  {viewingCurrent && state?.phase === 'open' && remaining === 0 ? (
                    <p className="mt-2 text-sm font-semibold text-blue-700" role="status">
                      Opening results…
                    </p>
                  ) : null}
                </div>
              ) : null}
              {published ? (
                <Button
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={() => setShowResults((current) => !current)}
                >
                  {showResults ? 'Back to question' : 'Show results'}
                </Button>
              ) : null}
              {sessionStatus === 'ACTIVE' && viewingCurrent && state?.phase === 'open' ? (
                <Button
                  className="mt-4 h-11 w-full rounded-xl"
                  onClick={() => run.mutate(() => closeVoting(sessionId))}
                  disabled={run.isPending}
                >
                  Close voting
                </Button>
              ) : null}
              {sessionStatus === 'ACTIVE' && viewingCurrent && state?.phase === 'closed' ? (
                <Button
                  className="mt-4 h-11 w-full rounded-xl"
                  onClick={() => run.mutate(() => publishResults(sessionId))}
                  disabled={run.isPending}
                >
                  Publish results
                </Button>
              ) : null}
              {canOpen && selectedUpcoming ? (
                <Button
                  className="mt-4 h-11 w-full rounded-xl"
                  onClick={() => launch(selectedUpcoming.id)}
                  disabled={run.isPending}
                >
                  Launch question
                </Button>
              ) : null}
              {canOpen && !selectedUpcoming && laterUpcoming ? (
                <Button
                  className="mt-4 h-11 w-full rounded-xl"
                  onClick={() => launch(laterUpcoming.id)}
                  disabled={run.isPending}
                >
                  Launch question {String(laterUpcoming.position).padStart(2, '0')}
                </Button>
              ) : null}
              {sessionStatus === 'ACTIVE' && canOpen && !selectedUpcoming && !laterUpcoming ? (
                <p className="mt-4 text-sm text-slate-500">
                  These questions were already asked. Add a question, then press Launch question.
                </p>
              ) : null}
            </>
          )}
        </div>

        <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold">Live controls</h3>
          {state?.phase === 'open' && state.closesAt && state.timerSeconds ? (
            <div className="mt-4">
              <CountdownRing closesAt={state.closesAt} totalSeconds={state.timerSeconds} />
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-400">
              The countdown appears here when you launch a question.
            </p>
          )}
          <div className="mt-3 rounded-2xl bg-blue-50 px-3 py-2">
            <p className="text-xs text-slate-500">Join code</p>
            <p className="mt-1 font-serif text-base tracking-[0.12em] text-blue-700">{joinCode}</p>
          </div>
          <div className="mt-3 space-y-2">
            <Button variant="outline" className="w-full" onClick={() => setQrOpen(true)}>
              Display QR code
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <a href={`/app/present/${sessionId}`} target="_blank" rel="noreferrer">
                Projector preview
              </a>
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => postPresentView(sessionId, 'code')}
            >
              Show join code
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                if (canOpen && viewing && !asked.has(viewing.id)) {
                  launch(viewing.id);
                  return;
                }
                postPresentView(sessionId, 'question');
              }}
            >
              Show question
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => postPresentView(sessionId, 'report')}
            >
              Show session report
            </Button>
          </div>
        </aside>
      </div>
      {qrOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/80 p-4">
          <div
            className="w-[80vw] max-w-md rounded-3xl bg-white p-5 text-slate-900 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Joining QR code"
          >
            <p className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase">
              Joining code
            </p>
            <p className="mt-1 font-serif text-2xl tracking-[0.14em] text-blue-700">{joinCode}</p>
            <div className="mt-4">
              <QrCode value={joinUrl} />
            </div>
            <p className="mt-2 text-center text-xs break-all text-slate-400">{joinUrl}</p>
            <div className="mt-4 grid grid-cols-5 gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(joinUrl).then(
                    () => setCopied(true),
                    () => setCopied(false),
                  );
                }}
              >
                {copied ? 'Copied' : 'Copy link'}
              </Button>
              <Button className="col-span-4" onClick={() => setQrOpen(false)}>
                Back
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PublishedAnswers({
  kind,
  options,
  responses,
}: {
  kind: 'CHOICE' | 'TEXT';
  options: { optionId: string; label: string; percent: number; correct: boolean }[];
  responses: string[];
}) {
  if (kind === 'TEXT') {
    return (
      <ul className="mt-4 space-y-2">
        {responses.length === 0 ? (
          <li className="text-sm text-slate-500">No written answers.</li>
        ) : (
          responses.map((response, index) => (
            <li key={index} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
              {response}
            </li>
          ))
        )}
      </ul>
    );
  }
  return (
    <ul className="mt-4 space-y-2">
      {options.map((option) => (
        <li key={option.optionId}>
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>
              {option.label}
              {option.correct ? ' · Correct' : ''}
            </span>
            <span>{option.percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-blue-500" style={{ width: `${option.percent}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Metric({ label, value, live = false }: { label: string; value: string; live?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <p className={`font-semibold tracking-tight ${live ? 'text-2xl text-blue-700' : 'text-lg'}`}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function PhaseBadge({ phase }: { phase: LiveState['phase'] }) {
  const label =
    phase === 'open'
      ? 'Voting open'
      : phase === 'closed'
        ? 'Voting closed'
        : phase === 'published'
          ? 'Results published'
          : 'Ready';
  const tone =
    phase === 'open'
      ? 'bg-emerald-50 text-emerald-700'
      : phase === 'closed'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-slate-100 text-slate-600';
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

function questionTone(
  question: Question,
  currentId: string | null,
  phase: LiveState['phase'] | undefined,
  asked: Set<string>,
): { label: string; className: string } {
  if (question.id === currentId && phase === 'open') {
    return { label: `Q${question.position} · Current`, className: 'text-blue-700' };
  }
  if (question.id === currentId && phase === 'closed') {
    return { label: `Q${question.position} · Closed`, className: 'text-amber-700' };
  }
  if (question.id === currentId && phase === 'published') {
    return { label: `Q${question.position} · Results`, className: 'text-emerald-700' };
  }
  if (asked.has(question.id)) {
    return { label: `Q${question.position} · Published`, className: 'text-slate-500' };
  }
  return { label: `Q${question.position} · Upcoming`, className: 'text-slate-400' };
}
