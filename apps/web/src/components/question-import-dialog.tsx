import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  downloadQuestionTemplate,
  importQuestions,
  previewQuestionImport,
  type QuestionInput,
} from '@/lib/api';
import { ApiError } from '@/lib/http';
import {
  refreshDraft,
  type ImportDraft,
} from '@/lib/question-import';

const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

export function QuestionImportButton({
  sessionId,
  disabled = false,
}: {
  sessionId: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (disabled) {
    return null;
  }
  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Import Excel
      </Button>
      {open ? <QuestionImportDialog sessionId={sessionId} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function QuestionImportDialog({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(crypto.randomUUID());
  const [rows, setRows] = useState<ImportDraft[]>([]);
  const [fileError, setFileError] = useState('');
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<{ imported: number; skipped: number; errors: number } | null>(
    null,
  );

  const preview = useMutation({
    mutationFn: (file: File) => previewQuestionImport(sessionId, file),
    onSuccess: (result) => {
      requestId.current = crypto.randomUUID();
      setSummary(null);
      setError('');
      setFileError(result.fileError ?? '');
      setRows(result.rows.map((row) => refreshDraft({ ...row, options: six(row.options) })));
    },
    onError: (caught) => setError(messageFrom(caught)),
  });

  const commit = useMutation({
    mutationFn: (questions: Array<QuestionInput & { row: number }>) =>
      importQuestions(sessionId, requestId.current, questions),
    onSuccess: async (created) => {
      const skipped = rows.filter((row) => !row.included && row.errors.length === 0).length;
      const errors = rows.filter((row) => row.errors.length > 0).length;
      setSummary({ imported: created.length, skipped, errors });
      setError('');
      await queryClient.invalidateQueries({ queryKey: ['questions', sessionId] });
    },
    onError: (caught) => setError(messageFrom(caught)),
  });

  const ready = rows.filter((row) => row.included && row.errors.length === 0);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !commit.isPending) {
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commit.isPending, onClose]);

  function update(index: number, patch: Partial<ImportDraft>) {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? refreshDraft({ ...row, ...patch }) : row)),
    );
    setSummary(null);
  }

  async function download() {
    setError('');
    try {
      const file = await downloadQuestionTemplate(sessionId);
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename || 'liveq-questions.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(messageFrom(caught));
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 id="import-title" className="text-lg font-semibold">
            Import questions
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Use MCQ for a graded choice, POLL for an ungraded choice, and TEXT for a written
            answer. Duration is checked here. The live countdown is still the timer you set when
            you launch.
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void download()}>
              Download template
            </Button>
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
              {preview.isPending ? 'Reading…' : 'Choose Excel file'}
            </Button>
            <input
              ref={fileRef}
              className="sr-only"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              aria-label="Excel file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) {
                  preview.mutate(file);
                }
              }}
            />
          </div>
          {fileError ? (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {fileError}
            </p>
          ) : null}
          {error ? (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          {summary ? (
            <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm" role="status">
              <p>
                Imported {summary.imported} {summary.imported === 1 ? 'question' : 'questions'}.
              </p>
              <p>
                Skipped {summary.skipped} {summary.skipped === 1 ? 'question' : 'questions'}.
              </p>
              {summary.errors > 0 ? (
                <p>
                  {summary.errors} {summary.errors === 1 ? 'row still has an error' : 'rows still have errors'} and{' '}
                  {summary.errors === 1 ? 'was' : 'were'} not imported.
                </p>
              ) : null}
            </div>
          ) : null}
          <ul className="mt-4 space-y-3">
            {rows.map((row, index) => (
              <li key={`${row.row}-${index}`} className="rounded-2xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={row.included}
                      disabled={row.errors.length > 0}
                      onChange={(event) => update(index, { included: event.target.checked })}
                    />
                    Row {row.row}
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
                      setSummary(null);
                    }}
                  >
                    Remove
                  </Button>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
                  <div>
                    <Label htmlFor={`import-type-${row.row}`}>Type</Label>
                    <select
                      id={`import-type-${row.row}`}
                      className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                      value={row.type}
                      onChange={(event) => {
                        const type = event.target.value;
                        update(index, {
                          type,
                          options: type === 'TEXT' ? letters.map(() => '') : row.options,
                          correctAnswer: type === 'MCQ' ? row.correctAnswer : '',
                        });
                      }}
                    >
                      <option value="">Choose</option>
                      <option value="MCQ">MCQ</option>
                      <option value="POLL">POLL</option>
                      <option value="TEXT">TEXT</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor={`import-prompt-${row.row}`}>Question</Label>
                    <Input
                      id={`import-prompt-${row.row}`}
                      className="mt-1 border-slate-200 bg-white"
                      value={row.prompt}
                      onChange={(event) => update(index, { prompt: event.target.value })}
                    />
                  </div>
                </div>
                {row.type !== 'TEXT' ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {letters.map((letter, optionIndex) => (
                      <div key={letter}>
                        <Label htmlFor={`import-${row.row}-${letter}`}>Option {letter}</Label>
                        <Input
                          id={`import-${row.row}-${letter}`}
                          className="mt-1 border-slate-200 bg-white"
                          value={row.options[optionIndex] ?? ''}
                          onChange={(event) => {
                            const options = six(row.options);
                            options[optionIndex] = event.target.value;
                            update(index, { options });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {row.type === 'MCQ' ? (
                    <div>
                      <Label htmlFor={`import-correct-${row.row}`}>Correct answer</Label>
                      <select
                        id={`import-correct-${row.row}`}
                        className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                        value={row.correctAnswer}
                        onChange={(event) => update(index, { correctAnswer: event.target.value })}
                      >
                        <option value="">Choose</option>
                        {letters.map((letter) => (
                          <option key={letter} value={letter}>
                            {letter}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  <div>
                    <Label htmlFor={`import-duration-${row.row}`}>Duration in seconds</Label>
                    <Input
                      id={`import-duration-${row.row}`}
                      className="mt-1 border-slate-200 bg-white"
                      inputMode="numeric"
                      value={row.duration}
                      onChange={(event) => update(index, { duration: event.target.value })}
                    />
                  </div>
                </div>
                {row.errors.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-sm text-red-700">
                    {row.errors.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            {summary ? 'Close' : 'Back'}
          </Button>
          {summary ? null : (
            <Button
              type="button"
              className="bg-blue-600 text-white hover:bg-blue-700"
              disabled={ready.length === 0 || commit.isPending}
              onClick={() => commit.mutate(ready.map(toPayload))}
            >
              {commit.isPending ? 'Importing…' : `Import ${ready.length}`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function six(options: string[]): string[] {
  return letters.map((_, index) => options[index] ?? '');
}

function toPayload(row: ImportDraft): QuestionInput & { row: number } {
  if (row.type === 'TEXT') {
    return { row: row.row, prompt: row.prompt.trim(), kind: 'TEXT' };
  }
  const options = six(row.options)
    .map((label) => label.trim())
    .filter(Boolean)
    .map((label) => ({ label }));
  return {
    row: row.row,
    prompt: row.prompt.trim(),
    kind: 'CHOICE',
    options,
    ...(row.type === 'MCQ'
      ? { correctOptionIndex: row.correctAnswer.toUpperCase().charCodeAt(0) - 65 }
      : {}),
  };
}

function messageFrom(caught: unknown): string {
  return caught instanceof ApiError ? caught.message : 'The questions could not be imported.';
}
