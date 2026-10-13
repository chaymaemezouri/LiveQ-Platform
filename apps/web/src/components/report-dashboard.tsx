import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { ReportQuestion, SessionReport } from '@/lib/reports';

const accents = [
  'bg-blue-500',
  'bg-rose-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-amber-500',
];

export function ReportDashboard({ report }: { report: SessionReport }) {
  const [openId, setOpenId] = useState<string | null>(report.questions[0]?.questionId ?? null);

  return (
    <div>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Participants" value={String(report.participantCount)} hint="People who joined" tone="bg-blue-500" />
        <Stat label="Participation" value={`${report.participationPercent}%`} hint="Joined and submitted a vote" tone="bg-emerald-500" />
        <Stat label="Voting" value={`${report.votingPercent}%`} hint="Possible votes that were cast" tone="bg-amber-500" />
        <Stat label="Correct answers" value={report.correctPercent === null ? '—' : `${report.correctPercent}%`} hint="Published graded questions" tone="bg-violet-500" />
      </section>

      <p className="text-muted-foreground mt-4 text-sm">
        {report.publishedQuestionCount} of {report.questionCount} questions published ·{' '}
        {report.voteCount} {report.voteCount === 1 ? 'vote' : 'votes'} submitted
      </p>

      {report.questions.length === 0 ? (
        <p className="text-muted-foreground mt-8 text-sm">
          This conference has no questions yet.
        </p>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {report.questions.map((question) => (
            <QuestionCard
              key={question.questionId}
              question={question}
              open={openId === question.questionId}
              onToggle={() =>
                setOpenId((current) =>
                  current === question.questionId ? null : question.questionId,
                )
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: string;
}) {
  return (
    <div className="border-border bg-card relative overflow-hidden rounded-2xl border px-4 py-4 shadow-sm">
      <span className={`absolute inset-y-0 left-0 w-1.5 ${tone}`} />
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-1 font-serif text-3xl">{value}</p>
      <p className="text-muted-foreground mt-2 text-xs">{hint}</p>
    </div>
  );
}

function QuestionCard({
  question,
  open,
  onToggle,
}: {
  question: ReportQuestion;
  open: boolean;
  onToggle: () => void;
}) {
  const tone = accents[(question.position - 1) % accents.length] ?? 'bg-blue-500';
  return (
    <li className="border-border bg-card overflow-hidden rounded-2xl border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-3 px-4 py-4 text-left">
        <span className={`mt-1 size-2.5 shrink-0 rounded-full ${tone}`} />
        <span className="min-w-0 flex-1">
          <span className="text-muted-foreground block text-xs tracking-wide uppercase">
            Question {question.position}
            {question.graded ? ' · Graded' : ' · Opinion poll'}
          </span>
          <span className="mt-1 block text-lg leading-snug">{question.prompt}</span>
          <span className="text-muted-foreground mt-1 block text-sm">
            {question.votingPercent}% voted · {question.voteCount}{' '}
            {question.voteCount === 1 ? 'vote' : 'votes'}
            {question.correctPercent !== null ? ` · ${question.correctPercent}% correct` : ''}
          </span>
        </span>
        <ChevronDown className={`text-muted-foreground size-4 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {question.kind === 'TEXT' ? (
        question.published ? (
          <ul className="space-y-2 px-4 pb-4 text-sm">
            {(question.responses ?? []).length === 0 ? (
              <li className="text-muted-foreground">No written answers.</li>
            ) : (
              question.responses?.map((response, index) => (
                <li key={`${question.questionId}-${index}`} className="bg-muted/60 rounded-lg px-3 py-2">
                  {response}
                </li>
              ))
            )}
          </ul>
        ) : (
          <p className="text-muted-foreground px-4 pb-4 text-sm">
            Results are not published, so the answer split stays hidden.
          </p>
        )
      ) : question.published ? (
        <figure aria-label="Results" className="space-y-2 px-4 pb-4">
          {(open ? question.options : question.options.slice(0, 2)).map((option, index) => {
            const bar = accents[index % accents.length] ?? 'bg-blue-500';
            const correct = option.optionId === question.correctOptionId;
            return (
              <div key={option.optionId}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span>
                    {option.label}
                    {correct ? (
                      <span className="ml-2 tracking-wide uppercase">Correct</span>
                    ) : null}
                  </span>
                  <span>
                    {option.percent}% · {option.count}
                  </span>
                </div>
                <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                  <div className={`h-full rounded-full ${bar}`} style={{ width: `${option.percent}%` }} />
                </div>
              </div>
            );
          })}
        </figure>
      ) : (
        <p className="text-muted-foreground px-4 pb-4 text-sm">
          Results are not published, so the answer split stays hidden.
        </p>
      )}
    </li>
  );
}
