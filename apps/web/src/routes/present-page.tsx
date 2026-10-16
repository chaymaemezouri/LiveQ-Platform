import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { CountdownRing } from '@/components/countdown-ring';
import { ReportDashboard } from '@/components/report-dashboard';
import logoUrl from '@/assets/liveq-logo.png';
import { fetchQuestions, fetchSession } from '@/lib/api';
import { ApiError } from '@/lib/http';
import { fetchLiveState, openLiveSocket, type LiveState } from '@/lib/live';
import {
  isPresentView,
  presentChannelName,
  readPresentView,
  type PresentMessage,
  type PresentView,
} from '@/lib/present-channel';
import { fetchReport } from '@/lib/reports';

export function PresentPage() {
  const { sessionId = '' } = useParams();
  const queryClient = useQueryClient();
  const [pinned, setPinned] = useState<PresentView | null>(() => readPresentView(sessionId));
  const session = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => fetchSession(sessionId),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });
  const sessionStatus = session.data?.status;
  const questions = useQuery({
    queryKey: ['questions', sessionId],
    queryFn: () => fetchQuestions(sessionId),
  });
  const live = useQuery({
    queryKey: ['live', sessionId],
    queryFn: () => fetchLiveState(sessionId),
    enabled: Boolean(session.data) && session.data?.status !== 'DRAFT',
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
  });
  const report = useQuery({
    queryKey: ['report', sessionId],
    queryFn: () => fetchReport(sessionId),
    enabled: Boolean(session.data) && session.data?.status !== 'DRAFT' && pinned === 'report',
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!sessionStatus || sessionStatus === 'DRAFT') {
      return;
    }
    const token = localStorage.getItem('liveq.accessToken');
    if (!token) {
      return;
    }
    const socket = openLiveSocket({ role: 'speaker', token, sessionId });
    socket.on('live:state', (state: LiveState) => {
      queryClient.setQueryData(['live', sessionId], state);
      if (state.phase === 'published') {
        void queryClient.invalidateQueries({ queryKey: ['report', sessionId] });
      }
    });
    socket.on('live:votes', (payload: { voteCount: number }) => {
      queryClient.setQueryData<LiveState>(['live', sessionId], (current) =>
        current ? { ...current, voteCount: payload.voteCount } : current,
      );
    });
    return () => {
      socket.disconnect();
    };
  }, [queryClient, sessionStatus, sessionId]);

  useEffect(() => {
    function refresh(view: PresentView, state?: LiveState) {
      setPinned(view);
      if (state) {
        queryClient.setQueryData(['live', sessionId], state);
      } else {
        void queryClient.invalidateQueries({ queryKey: ['live', sessionId] });
      }
      void queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
      void queryClient.invalidateQueries({ queryKey: ['questions', sessionId] });
      void queryClient.invalidateQueries({ queryKey: ['report', sessionId] });
    }
    function onStorage(event: StorageEvent) {
      if (event.key === presentChannelName(sessionId) && isPresentView(event.newValue)) {
        refresh(event.newValue);
      }
    }
    window.addEventListener('storage', onStorage);
    const channel = typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel(presentChannelName(sessionId))
      : null;
    if (channel) {
      channel.onmessage = (event: MessageEvent<PresentMessage>) => {
        if (isPresentView(event.data?.view)) {
          refresh(event.data.view, event.data.state);
        }
      };
    }
    return () => {
      window.removeEventListener('storage', onStorage);
      channel?.close();
    };
  }, [queryClient, sessionId]);

  const state = live.data;
  const showReport = pinned === 'report';
  const showQuestion =
    !showReport &&
    (pinned === 'question' ||
      (pinned !== 'code' && state?.question != null && state.phase !== 'idle'));

  const total = questions.data?.length ?? 0;
  const position = state?.question?.position ?? 0;
  const tones = [
    'bg-blue-500',
    'bg-rose-500',
    'bg-emerald-500',
    'bg-violet-500',
    'bg-amber-500',
  ];
  const washes = [
    'border-blue-200 bg-blue-50',
    'border-rose-200 bg-rose-50',
    'border-emerald-200 bg-emerald-50',
    'border-violet-200 bg-violet-50',
    'border-amber-200 bg-amber-50',
  ];

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#f4f7ff] px-6 py-8 text-slate-900 sm:px-12">
      <div className="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full bg-blue-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-0 size-80 rounded-full bg-amber-100/80 blur-3xl" />
      <header className="relative flex items-center justify-between gap-4">
        <p className="flex items-center gap-3 font-serif text-2xl sm:text-3xl">
          <span className="h-8 w-1.5 rounded-full bg-gradient-to-b from-blue-500 to-violet-500" />
          {session.data?.title ?? 'LiveQ'}
        </p>
        <p className="text-xs tracking-[0.35em] text-slate-400 uppercase">
          <img src={logoUrl} alt="LiveQ" className="h-8 w-auto" />
        </p>
      </header>

      {session.isError ? (
        <p className="text-destructive mt-16 text-center" role="alert">
          {session.error instanceof ApiError
            ? session.error.message
            : 'This conference could not be opened.'}
        </p>
      ) : null}

      {session.data && showReport ? (
        <section className="relative mx-auto w-full max-w-5xl flex-1 py-8">
          <p className="text-sm tracking-[0.22em] text-slate-400 uppercase">Session report</p>
          <h1 className="mt-3 font-serif text-4xl sm:text-5xl">{session.data.title}</h1>
          {report.isPending ? (
            <p className="mt-8 text-slate-500">Loading the session report…</p>
          ) : report.data ? (
            <div className="mt-8">
              <ReportDashboard report={report.data} />
            </div>
          ) : (
            <p className="mt-8 text-slate-500">The session report could not be opened.</p>
          )}
        </section>
      ) : null}

      {session.data && !showQuestion && !showReport ? (
        <section className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-muted-foreground text-sm tracking-[0.28em] uppercase">
            Join with this code
          </p>
          <p className="mt-8 font-serif text-6xl tracking-[0.18em] sm:text-8xl">
            {session.data.joinCode}
          </p>
          <p className="text-muted-foreground mt-8 max-w-md text-lg">
            {session.data.joinUrl}
          </p>
        </section>
      ) : null}

      {session.data && showQuestion && state?.question ? (
        <section className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center py-8">
          <div className="flex flex-col items-start gap-8 md:flex-row md:justify-between">
            <div className="min-w-0">
              <p className="text-sm tracking-[0.22em] text-slate-400 uppercase">
                Question {state.question.position}
                {state.phase === 'closed' ? ' · Voting closed' : ''}
                {state.phase === 'published' ? ' · Results' : ''}
              </p>
              <h1 className="mt-3 text-5xl leading-tight break-words sm:text-7xl">{state.question.prompt}</h1>
              {total > 0 ? (
                <p className="mt-4 flex items-center gap-2 text-sm text-slate-400">
                  {Array.from({ length: total }, (_, index) => (
                    <span
                      key={index}
                      className={`size-2.5 rounded-full ${index + 1 === position ? 'bg-blue-600' : 'bg-slate-200'}`}
                    />
                  ))}
                  <span className="ml-2">
                    {position}/{total}
                  </span>
                </p>
              ) : null}
            </div>
            {state.phase === 'open' && state.closesAt && state.timerSeconds ? (
              <CountdownRing closesAt={state.closesAt} totalSeconds={state.timerSeconds} large />
            ) : null}
          </div>
          {state.question.kind === 'TEXT' ? (
            <div className="mt-10 rounded-3xl border border-slate-200 bg-white/80 px-6 py-8 shadow-sm">
              <p className="text-sm tracking-[0.18em] text-slate-400 uppercase">Written answer</p>
              {state.phase === 'published' && state.responses ? (
                <ul className="mt-4 space-y-2">
                  {state.responses.length === 0 ? (
                    <li className="text-slate-500">No written answers.</li>
                  ) : (
                    state.responses.map((response, index) => (
                      <li key={index} className="rounded-xl bg-slate-50 px-4 py-3 text-xl">
                        {response}
                      </li>
                    ))
                  )}
                </ul>
              ) : (
                <p className="mt-3 text-2xl text-slate-700">
                  Type your answer on your own device.
                </p>
              )}
            </div>
          ) : state.phase === 'published' && state.results ? (
            <figure aria-label="Results" className="mt-10 space-y-5">
              {state.results.map((result, index) => {
                const correct = result.optionId === state.correctOptionId;
                const tone = correct ? 'bg-emerald-500' : (tones[index % tones.length] ?? 'bg-blue-500');
                return (
                  <div key={result.optionId}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-xl">
                      <span>
                        {String.fromCharCode(65 + index)} {result.label}
                        {correct ? (
                          <span className="ml-3 text-sm font-semibold tracking-wide text-emerald-700 uppercase">
                            Correct
                          </span>
                        ) : null}
                      </span>
                      <span className="text-slate-500">
                        {result.percent}% · {result.count}
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white/80">
                      <div className={`h-full rounded-full ${tone}`} style={{ width: `${result.percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </figure>
          ) : (
          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {state.question.options.map((option, index) => {
              const result = state.results?.find((item) => item.optionId === option.id);
              const correct = state.phase === 'published' && option.id === state.correctOptionId;
              return (
                <li
                  key={option.id}
                  className={`flex items-center gap-4 rounded-2xl border px-4 py-4 shadow-sm ${washes[index % washes.length]}`}
                >
                  <span
                    className={`grid size-12 shrink-0 place-items-center rounded-full text-lg font-semibold text-white ${tones[index % tones.length]}`}
                  >
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="min-w-0 flex-1 text-2xl">
                    {option.label}
                    {correct ? (
                      <span className="mt-1 block text-xs tracking-wide text-emerald-700 uppercase">
                        Correct
                      </span>
                    ) : null}
                  </span>
                  <span className="text-sm text-slate-500">
                    {state.phase === 'published' && result ? `${result.percent}%` : '›'}
                  </span>
                </li>
              );
            })}
          </ul>
          )}
          <p className="mt-8 text-sm text-slate-500">
            {session.data.participantCount} participating
          </p>
        </section>
      ) : null}

      {session.data && showQuestion && !state?.question ? (
        <section className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground text-2xl" role={live.isError ? 'alert' : 'status'}>
            {live.isError
              ? 'The live question could not be loaded. Retrying…'
              : live.isFetching
                ? 'Loading the live question…'
                : 'Launch a question from Live controls to display it here.'}
          </p>
        </section>
      ) : null}
    </main>
  );
}
