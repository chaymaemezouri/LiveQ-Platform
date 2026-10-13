import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ResultChart } from '@/components/result-chart';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchQuestions } from '@/lib/api';
import { ApiError } from '@/lib/http';
import { postPresentView } from '@/lib/present-channel';
import {
  closeVoting,
  fetchLiveState,
  launchQuestion,
  nextQuestion,
  openLiveSocket,
  publishResults,
  type LiveState,
} from '@/lib/live';

export function LiveDesk({
  sessionId,
  sessionStatus,
}: {
  sessionId: string;
  sessionStatus: 'DRAFT' | 'ACTIVE' | 'ENDED';
}) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(true);
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState('30');
  const live = useQuery({
    queryKey: ['live', sessionId],
    queryFn: () => fetchLiveState(sessionId),
    enabled: sessionStatus !== 'DRAFT',
  });
  const questions = useQuery({
    queryKey: ['questions', sessionId],
    queryFn: () => fetchQuestions(sessionId),
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
    socket.on('live:state', remember);
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

  const run = useMutation({
    mutationFn: (action: () => Promise<LiveState>) => action(),
    onSuccess: (state) => {
      queryClient.setQueryData(['live', sessionId], state);
      setError('');
      void queryClient.invalidateQueries({ queryKey: ['questions', sessionId] });
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

  const state = live.data;
  const asked = new Set(state?.askedQuestionIds ?? []);
  const upcoming = (questions.data ?? []).filter((question) => !asked.has(question.id));
  const hasLater = upcoming.some(
    (question) =>
      state?.question != null && question.position > state.question.position,
  );

  return (
    <section className="border-border bg-card mt-10 rounded-xl border p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl">Live voting</h2>
        {sessionStatus !== 'DRAFT' && !connected ? (
          <p className="text-muted-foreground text-sm" role="status">
            Reconnecting to the live session…
          </p>
        ) : null}
      </div>
      {error ? (
        <p className="text-destructive mt-3 text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {sessionStatus === 'DRAFT' ? (
        <p className="text-muted-foreground mt-3 text-sm">
          Activate the session before opening a question.
        </p>
      ) : null}
      {live.isPending && sessionStatus !== 'DRAFT' ? (
        <p className="text-muted-foreground mt-3 text-sm">Loading the live room…</p>
      ) : null}
      {state?.phase === 'idle' ? (
        <p className="text-muted-foreground mt-3 text-sm">
          Open a question when the room is ready to vote.
        </p>
      ) : null}
      {state?.question && state.phase !== 'idle' ? (
        <div className="mt-4">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            Question {state.question.position}
          </p>
          <p className="mt-2 text-xl">{state.question.prompt}</p>
          <p className="mt-3 text-sm" role="status">
            {state.voteCount} {state.voteCount === 1 ? 'vote' : 'votes'} submitted
          </p>
          {state.question.kind === 'TEXT' ? (
            state.phase === 'published' && state.responses ? (
              <ul className="mt-4 space-y-2">
                {state.responses.length === 0 ? (
                  <li className="text-muted-foreground text-sm">No written answers.</li>
                ) : (
                  state.responses.map((response, index) => (
                    <li key={index} className="border-border rounded-md border px-3 py-2 text-sm">
                      {response}
                    </li>
                  ))
                )}
              </ul>
            ) : (
              <p className="text-muted-foreground mt-4 text-sm">
                Written answers stay hidden until you publish the results.
              </p>
            )
          ) : state.phase === 'published' && state.results ? (
            <ResultChart
              results={state.results}
              correctOptionId={state.correctOptionId}
            />
          ) : (
            <ul className="mt-4 space-y-2">
              {state.question.options.map((option) => (
                <li
                  key={option.id}
                  className="border-border rounded-md border px-3 py-2 text-sm"
                >
                  {option.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      {sessionStatus === 'ACTIVE' ? (
        <div className="mt-5 space-y-4">
          <div className="flex max-w-xs flex-col gap-2">
            <Label htmlFor="question-seconds">Seconds for this question</Label>
            <Input
              id="question-seconds"
              inputMode="numeric"
              value={seconds}
              onChange={(event) => setSeconds(event.target.value)}
              placeholder="Empty for no timer"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" asChild>
              <a href={`/app/present/${sessionId}`} target="_blank" rel="noreferrer">
                Open projector
              </a>
            </Button>
            <Button
              variant="outline"
              onClick={() => postPresentView(sessionId, 'code')}
            >
              Show join code
            </Button>
            <Button
              variant="outline"
              onClick={() => postPresentView(sessionId, 'question')}
            >
              Show question
            </Button>
          </div>
          <div className="flex flex-wrap gap-3">
            {state?.phase === 'open' ? (
              <Button
                onClick={() => run.mutate(() => closeVoting(sessionId))}
                disabled={run.isPending}
              >
                Close voting
              </Button>
            ) : null}
            {state?.phase === 'closed' ? (
              <Button
                onClick={() => run.mutate(() => publishResults(sessionId))}
                disabled={run.isPending}
              >
                Publish results
              </Button>
            ) : null}
            {state?.phase === 'published' && hasLater ? (
              <Button
                onClick={() => {
                  const timer = readTimer();
                  if (timer === 'invalid') {
                    setError('Use a time from 5 to 600 seconds, or leave it empty.');
                    return;
                  }
                  run.mutate(() => nextQuestion(sessionId, timer));
                }}
                disabled={run.isPending}
              >
                Next question
              </Button>
            ) : null}
            {state && (state.phase === 'idle' || state.phase === 'published')
              ? upcoming.map((question) => (
                  <Button
                    key={question.id}
                    variant="outline"
                    onClick={() => {
                      const timer = readTimer();
                      if (timer === 'invalid') {
                        setError(
                          'Use a time from 5 to 600 seconds, or leave it empty.',
                        );
                        return;
                      }
                      run.mutate(() => launchQuestion(sessionId, question.id, timer));
                    }}
                    disabled={run.isPending}
                  >
                    Open “{question.prompt}”
                  </Button>
                ))
              : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
