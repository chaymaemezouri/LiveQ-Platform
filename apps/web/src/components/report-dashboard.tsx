import { useState } from 'react';
import type { ReportQuestion, SessionReport } from '@/lib/reports';

const bars = ['bg-blue-500', 'bg-violet-500', 'bg-cyan-500', 'bg-orange-500', 'bg-emerald-500'];

export function ReportDashboard({ report }: { report: SessionReport }) {
  const [index, setIndex] = useState(0);
  const question = report.questions[index] ?? report.questions[0];

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

      {report.questions.length === 0 || !question ? (
        <p className="text-muted-foreground mt-8 text-sm">
          This conference has no questions yet.
        </p>
      ) : (
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold tracking-[0.16em] text-slate-400 uppercase">
              Select question
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="h-9 rounded-xl border border-slate-200 px-3 text-sm font-medium disabled:opacity-40"
                disabled={index <= 0}
                onClick={() => setIndex((current) => Math.max(0, current - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="h-9 rounded-xl border border-slate-200 px-3 text-sm font-medium disabled:opacity-40"
                disabled={index >= report.questions.length - 1}
                onClick={() =>
                  setIndex((current) => Math.min(report.questions.length - 1, current + 1))
                }
              >
                Next
              </button>
            </div>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {report.questions.map((item, itemIndex) => (
              <button
                key={item.questionId}
                type="button"
                onClick={() => setIndex(itemIndex)}
                className={`min-w-16 rounded-2xl border px-3 py-2 text-left ${
                  itemIndex === index
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                <span className="block text-sm font-semibold">Q{item.position}</span>
                <span className={`block text-[11px] ${itemIndex === index ? 'text-blue-100' : 'text-slate-400'}`}>
                  {item.published ? 'Published' : 'Hidden'}
                </span>
              </button>
            ))}
          </div>
          <QuestionDetail question={question} total={report.questions.length} />
        </section>
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
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-900 shadow-sm">
      <span className={`absolute inset-y-0 left-0 w-1.5 ${tone}`} />
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 font-serif text-3xl">{value}</p>
      <p className="mt-2 text-xs text-slate-400">{hint}</p>
    </div>
  );
}

function QuestionDetail({ question, total }: { question: ReportQuestion; total: number }) {
  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide text-blue-600 uppercase">
          Question {question.position} of {total}
        </p>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
          {question.published ? 'Results published' : 'Results hidden'}
        </span>
      </div>
      <h2 className="mt-2 text-2xl leading-snug font-semibold">{question.prompt}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <p className="text-sm text-slate-500">Responses received</p>
          <p className="mt-1 text-3xl font-semibold text-blue-600">{question.voteCount}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <p className="text-sm text-slate-500">Question type</p>
          <p className="mt-2 text-base font-medium">
            {question.kind === 'TEXT' ? 'Written answer' : 'Multiple choice'}
          </p>
        </div>
      </div>
      {question.kind === 'TEXT' ? (
        question.published ? (
          <ul className="mt-5 space-y-2 text-sm">
            {(question.responses ?? []).length === 0 ? (
              <li className="text-slate-500">No written answers.</li>
            ) : (
              question.responses?.map((response, responseIndex) => (
                <li key={`${question.questionId}-${responseIndex}`} className="rounded-xl bg-slate-50 px-3 py-2">
                  {response}
                </li>
              ))
            )}
          </ul>
        ) : (
          <p className="mt-5 text-sm text-slate-500">
            Results are not published, so the answer split stays hidden.
          </p>
        )
      ) : question.published ? (
        <figure aria-label="Results" className="mt-5 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <p className="font-medium">Answer distribution</p>
            <p className="text-slate-400">Votes / percent</p>
          </div>
          {question.options.map((option, optionIndex) => {
            const correct = option.optionId === question.correctOptionId;
            const tone = correct ? 'bg-emerald-500' : (bars[optionIndex % bars.length] ?? 'bg-blue-500');
            return (
              <div key={option.optionId}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span>
                    {String.fromCharCode(65 + optionIndex)} {option.label}
                    {correct ? (
                      <span className="ml-2 text-xs font-semibold tracking-wide text-emerald-600 uppercase">
                        Correct
                      </span>
                    ) : null}
                  </span>
                  <span className="text-slate-500">
                    {option.percent}% · {option.count}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${tone}`} style={{ width: `${option.percent}%` }} />
                </div>
              </div>
            );
          })}
        </figure>
      ) : (
        <p className="mt-5 text-sm text-slate-500">
          Results are not published, so the answer split stays hidden.
        </p>
      )}
      {question.correctPercent !== null ? (
        <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {question.correctPercent}% correct answers
        </p>
      ) : null}
    </div>
  );
}
