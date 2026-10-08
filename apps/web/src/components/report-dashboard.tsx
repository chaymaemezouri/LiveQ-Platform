import { ResultChart } from '@/components/result-chart';
import type { SessionReport } from '@/lib/reports';

export function ReportDashboard({ report }: { report: SessionReport }) {
  return (
    <div>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Participants"
          value={String(report.participantCount)}
          hint="People who joined"
        />
        <Stat
          label="Participation"
          value={`${report.participationPercent}%`}
          hint="Joined and submitted a vote"
        />
        <Stat
          label="Voting"
          value={`${report.votingPercent}%`}
          hint="Possible votes that were cast"
        />
        <Stat
          label="Correct answers"
          value={report.correctPercent === null ? '—' : `${report.correctPercent}%`}
          hint="Published graded questions"
        />
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
        <ul className="mt-8 grid gap-4">
          {report.questions.map((question) => (
            <li
              key={question.questionId}
              className="border-border bg-card rounded-xl border px-5 py-5 shadow-sm"
            >
              <p className="text-muted-foreground text-xs tracking-wide uppercase">
                Question {question.position}
                {question.graded ? ' · Graded' : ' · Opinion poll'}
              </p>
              <h2 className="mt-2 text-xl">{question.prompt}</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                Voting {question.votingPercent}% · {question.voteCount}{' '}
                {question.voteCount === 1 ? 'vote' : 'votes'}
                {question.correctPercent !== null
                  ? ` · ${question.correctPercent}% correct`
                  : ''}
              </p>
              {question.published ? (
                <ResultChart
                  results={question.options}
                  correctOptionId={question.correctOptionId}
                />
              ) : (
                <p className="text-muted-foreground mt-4 text-sm">
                  Results are not published, so the answer split stays hidden.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="border-border bg-card rounded-xl border px-4 py-4 shadow-sm">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-1 font-serif text-3xl">{value}</p>
      <p className="text-muted-foreground mt-2 text-xs">{hint}</p>
    </div>
  );
}
