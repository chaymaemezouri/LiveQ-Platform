import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  createQuestion,
  fetchQuestion,
  updateQuestion,
  type Question,
} from '@/lib/api';
import { ApiError } from '@/lib/http';
import {
  emptyQuestionDraft,
  validateQuestionDraft,
  type QuestionDraft,
} from '@/lib/question-draft';

export function QuestionEditorPage() {
  const { id: sessionId = '', questionId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const existing = useQuery({
    queryKey: ['question', sessionId, questionId],
    queryFn: () => fetchQuestion(sessionId, questionId ?? ''),
    enabled: Boolean(questionId),
  });
  const [draft, setDraft] = useState<QuestionDraft>(emptyQuestionDraft);
  const [loaded, setLoaded] = useState(!questionId);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!existing.data || loaded) {
      return;
    }
    setDraft(draftFromQuestion(existing.data));
    setLoaded(true);
  }, [existing.data, loaded]);

  const save = useMutation({
    mutationFn: () => {
      const input =
        draft.kind === 'TEXT'
          ? { prompt: draft.prompt.trim(), kind: 'TEXT' as const }
          : {
              prompt: draft.prompt.trim(),
              kind: 'CHOICE' as const,
              options: draft.options.map((label) => ({ label: label.trim() })),
              correctOptionIndex: draft.ungraded ? null : draft.correctIndex,
            };
      return questionId
        ? updateQuestion(sessionId, questionId, input)
        : createQuestion(sessionId, input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['questions', sessionId] });
      await navigate(`/app/sessions/${sessionId}`, {
        state: { notice: questionId ? 'Question saved.' : 'Question added.' },
      });
    },
    onError: (caught) => {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'The question could not be saved.',
      );
    },
  });

  const locked = existing.data?.hasVotingHistory === true;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateQuestionDraft(draft);
    setError(validationError ?? '');
    if (validationError || locked) {
      return;
    }
    save.mutate();
  }

  function updateOption(index: number, label: string) {
    setDraft((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) =>
        optionIndex === index ? label : option,
      ),
    }));
  }

  function removeOption(index: number) {
    setDraft((current) => ({
      ...current,
      options: current.options.filter((_, optionIndex) => optionIndex !== index),
      correctIndex:
        current.correctIndex == null
          ? null
          : current.correctIndex === index
            ? null
            : current.correctIndex > index
              ? current.correctIndex - 1
              : current.correctIndex,
    }));
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <p className="text-muted-foreground text-sm">
        <Link to={`/app/sessions/${sessionId}`} className="hover:underline">
          Session
        </Link>
      </p>
      <h1 className="mt-2 text-3xl">{questionId ? 'Edit question' : 'New question'}</h1>
      <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
        Choice questions use two to six options. A written question asks each
        participant to type an answer.
      </p>

      {questionId && existing.isPending ? (
        <p className="text-muted-foreground mt-8 text-sm">Loading the question…</p>
      ) : null}
      {questionId && existing.isError ? (
        <p className="text-destructive mt-8 text-sm" role="alert">
          {existing.error instanceof ApiError
            ? existing.error.message
            : 'Question not found.'}
        </p>
      ) : null}

      {!questionId || existing.data ? (
        <form
          className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]"
          onSubmit={onSubmit}
        >
          <div className="space-y-5">
            {locked ? (
              <p className="text-sm" role="status">
                This question already has votes. Its wording and options stay as they
                were.
              </p>
            ) : null}
            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}
            <fieldset className="space-y-2" disabled={locked}>
              <legend className="text-sm font-medium">Answer type</legend>
              <div className="flex flex-wrap gap-2">
                <label className="border-border has-checked:border-primary has-checked:bg-primary/5 flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm">
                  <input
                    type="radio"
                    name="answer-type"
                    className="accent-primary size-4"
                    checked={draft.kind === 'CHOICE'}
                    onChange={() =>
                      setDraft((current) => ({ ...current, kind: 'CHOICE' }))
                    }
                  />
                  Choices
                </label>
                <label className="border-border has-checked:border-primary has-checked:bg-primary/5 flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm">
                  <input
                    type="radio"
                    name="answer-type"
                    className="accent-primary size-4"
                    checked={draft.kind === 'TEXT'}
                    onChange={() =>
                      setDraft((current) => ({
                        ...current,
                        kind: 'TEXT',
                        ungraded: true,
                        correctIndex: null,
                      }))
                    }
                  />
                  Written answer
                </label>
              </div>
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor="prompt">Question</Label>
              <Textarea
                id="prompt"
                value={draft.prompt}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, prompt: event.target.value }))
                }
                maxLength={4000}
                disabled={locked}
                required
              />
            </div>
            {draft.kind === 'TEXT' ? null : (
            <>
            <fieldset className="space-y-3" disabled={locked}>
              <legend className="text-sm font-medium">Options</legend>
              {draft.options.map((label, index) => (
                <div key={index} className="flex items-center gap-3">
                  {draft.ungraded ? (
                    <span className="text-muted-foreground w-16 shrink-0 text-xs">
                      Option {index + 1}
                    </span>
                  ) : (
                    <label className="flex w-28 shrink-0 items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="correct-option"
                        className="accent-primary size-4"
                        checked={draft.correctIndex === index}
                        onChange={() =>
                          setDraft((current) => ({ ...current, correctIndex: index }))
                        }
                      />
                      Correct
                    </label>
                  )}
                  <Input
                    aria-label={`Option ${index + 1}`}
                    value={label}
                    onChange={(event) => updateOption(index, event.target.value)}
                    maxLength={500}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => removeOption(index)}
                    disabled={draft.options.length <= 2}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                disabled={draft.options.length >= 6}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    options: [...current.options, ''],
                  }))
                }
              >
                Add option
              </Button>
            </fieldset>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-primary size-4"
                checked={draft.ungraded}
                disabled={locked}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    ungraded: event.target.checked,
                    correctIndex: event.target.checked ? null : current.correctIndex,
                  }))
                }
              />
              Ungraded opinion poll
            </label>
            </>
            )}
            {locked ? null : (
              <div className="flex flex-wrap gap-3">
                <Button
                  type="submit"
                  disabled={save.isPending || (Boolean(questionId) && !loaded)}
                >
                  {save.isPending
                    ? 'Saving…'
                    : questionId
                      ? 'Save question'
                      : 'Add question'}
                </Button>
                <Button variant="outline" asChild>
                  <Link to={`/app/sessions/${sessionId}`}>Cancel</Link>
                </Button>
              </div>
            )}
          </div>
          <QuestionPreview draft={draft} />
        </form>
      ) : null}
    </main>
  );
}

function QuestionPreview({ draft }: { draft: QuestionDraft }) {
  return (
    <aside className="border-border bg-card h-fit rounded-xl border p-4 shadow-sm">
      <h2 className="text-lg">Preview</h2>
      <p className="mt-3 text-sm leading-6">
        {draft.prompt.trim() || 'The question will appear here.'}
      </p>
      {draft.kind === 'TEXT' ? (
        <p className="text-muted-foreground mt-4 text-sm">
          Participants type their own answer.
        </p>
      ) : (
      <ul className="mt-4 space-y-2">
        {draft.options.map((label, index) => {
          const selected = !draft.ungraded && draft.correctIndex === index;
          return (
            <li
              key={index}
              className="border-border flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
            >
              <span>{label.trim() || `Option ${index + 1}`}</span>
              {selected ? <span className="text-xs font-medium">Correct</span> : null}
            </li>
          );
        })}
      </ul>
      )}
      <p className="text-muted-foreground mt-4 text-xs">
        {draft.kind === 'TEXT'
          ? 'Written answers stay hidden until you publish the results.'
          : draft.ungraded
            ? 'Opinion poll. No answer is marked correct.'
            : 'Participants will not see which option is correct.'}
      </p>
    </aside>
  );
}

function draftFromQuestion(question: Question): QuestionDraft {
  const correctIndex = question.options.findIndex(
    (option) => option.id === question.correctOptionId,
  );
  return {
    prompt: question.prompt,
    kind: question.kind === 'TEXT' ? 'TEXT' : 'CHOICE',
    options: question.options.map((option) => option.label),
    ungraded: question.correctOptionId == null,
    correctIndex: correctIndex >= 0 ? correctIndex : null,
  };
}
