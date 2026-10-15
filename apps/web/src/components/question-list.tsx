import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { deleteQuestion, fetchQuestions, reorderQuestions } from '@/lib/api';
import { ApiError } from '@/lib/http';

export function QuestionList({ sessionId }: { sessionId: string }) {
  const queryClient = useQueryClient();
  const questions = useQuery({
    queryKey: ['questions', sessionId],
    queryFn: () => fetchQuestions(sessionId),
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const reorder = useMutation({
    mutationFn: (questionIds: string[]) => reorderQuestions(sessionId, questionIds),
    onSuccess: (next) => {
      queryClient.setQueryData(['questions', sessionId], next);
      setError('');
      setMessage('Question order saved.');
    },
    onError: (caught) => setError(messageFrom(caught)),
  });

  const remove = useMutation({
    mutationFn: (questionId: string) => deleteQuestion(sessionId, questionId),
    onSuccess: async () => {
      setConfirmingId(null);
      setError('');
      setMessage('Question deleted.');
      await queryClient.invalidateQueries({ queryKey: ['questions', sessionId] });
    },
    onError: (caught) => setError(messageFrom(caught)),
  });

  function move(index: number, direction: -1 | 1) {
    if (!questions.data) {
      return;
    }
    const next = questions.data.slice();
    const target = index + direction;
    const current = next[index];
    const neighbor = next[target];
    if (!current || !neighbor) {
      return;
    }
    next[index] = neighbor;
    next[target] = current;
    reorder.mutate(next.map((question) => question.id));
  }

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Questions</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Prepare the order before the room opens. Correct answers stay with this speaker account.
          </p>
        </div>
        <Button size="sm" asChild>
          <Link to={`/app/sessions/${sessionId}/questions/new`}>Add question</Link>
        </Button>
      </div>

      {message ? (
        <p className="mt-4 text-sm" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-destructive mt-4 text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {questions.isPending ? (
        <p className="text-muted-foreground mt-6 text-sm">Loading questions…</p>
      ) : null}
      {questions.isError ? (
        <p className="text-destructive mt-6 text-sm" role="alert">
          {questions.error instanceof ApiError
            ? questions.error.message
            : 'Questions could not be loaded.'}
        </p>
      ) : null}
      {questions.data?.length === 0 ? (
        <div className="border-border mt-6 rounded-xl border border-dashed px-6 py-12 text-center">
          <h3 className="text-sm font-semibold">No questions yet</h3>
          <p className="text-muted-foreground mt-2 text-sm">
            Add a graded question or an opinion poll.
          </p>
          <Button asChild className="mt-6">
            <Link to={`/app/sessions/${sessionId}/questions/new`}>
              Create the first question
            </Link>
          </Button>
        </div>
      ) : null}
      {questions.data && questions.data.length > 0 ? (
        <ol className="mt-6 grid gap-3">
          {questions.data.map((question, index) => (
            <li
              key={question.id}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs tracking-wide uppercase">
                    Question {question.position}
                    {question.kind === 'TEXT'
                      ? ' · Written answer'
                      : question.correctOptionId
                        ? ' · Graded'
                        : ' · Opinion poll'}
                    {question.hasVotingHistory ? ' · Has votes' : ''}
                  </p>
                  <h3 className="mt-1 text-sm font-medium">{question.prompt}</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {question.kind === 'TEXT'
                      ? 'Participants type an answer'
                      : `${question.options.length} options`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={`Move question ${question.position} up`}
                    disabled={index === 0 || reorder.isPending}
                    onClick={() => move(index, -1)}
                  >
                    <ChevronUp />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={`Move question ${question.position} down`}
                    disabled={
                      index === (questions.data?.length ?? 0) - 1 || reorder.isPending
                    }
                    onClick={() => move(index, 1)}
                  >
                    <ChevronDown />
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to={`/app/sessions/${sessionId}/questions/${question.id}`}>
                      {question.hasVotingHistory ? 'View' : 'Edit'}
                    </Link>
                  </Button>
                  {question.hasVotingHistory ? null : confirmingId === question.id ? (
                    <>
                      <Button
                        variant="destructive"
                        onClick={() => remove.mutate(question.id)}
                        disabled={remove.isPending}
                      >
                        {remove.isPending ? 'Deleting…' : 'Confirm delete'}
                      </Button>
                      <Button variant="outline" onClick={() => setConfirmingId(null)}>
                        Keep
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="destructive"
                      onClick={() => setConfirmingId(question.id)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function messageFrom(caught: unknown): string {
  return caught instanceof ApiError
    ? caught.message
    : 'The question could not be updated.';
}
