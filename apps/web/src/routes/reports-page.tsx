import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { StatusBadge } from '@/components/status-badge';
import { fetchReports, type ReportSummary } from '@/lib/reports';
import { formatDateTime } from '@/lib/dates';
import { ApiError } from '@/lib/http';

export function ReportsPage() {
  const reports = useQuery({
    queryKey: ['reports'],
    queryFn: fetchReports,
  });
  const previous = (reports.data ?? []).filter((report) => report.status === 'ENDED');
  const current = (reports.data ?? []).filter((report) => report.status !== 'ENDED');

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-3xl">Reports</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Participation, voting, and correct-answer rates for each conference.
      </p>

      {reports.isPending ? (
        <p className="text-muted-foreground mt-8 text-sm">Loading reports…</p>
      ) : null}
      {reports.isError ? (
        <p className="text-destructive mt-8 text-sm" role="alert">
          {reports.error instanceof ApiError
            ? reports.error.message
            : 'Reports could not be loaded.'}
        </p>
      ) : null}

      {reports.data ? (
        <>
          <ReportGroup
            title="Previous conferences"
            empty="Ended conferences appear here with their saved results."
            reports={previous}
          />
          <ReportGroup
            title="Current conferences"
            empty="Draft and active conferences appear here while the room is still open."
            reports={current}
          />
        </>
      ) : null}
    </main>
  );
}

function ReportGroup({
  title,
  empty,
  reports,
}: {
  title: string;
  empty: string;
  reports: ReportSummary[];
}) {
  return (
    <section className="mt-10">
      <h2 className="text-xl">{title}</h2>
      {reports.length === 0 ? (
        <p className="text-muted-foreground mt-3 text-sm">{empty}</p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {reports.map((report) => (
            <li key={report.sessionId}>
              <Link
                to={`/app/reports/${report.sessionId}`}
                className="border-border bg-card hover:bg-accent/40 block rounded-xl border px-5 py-4 shadow-sm transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg">{report.title}</h3>
                  <StatusBadge status={report.status} />
                </div>
                <p className="text-muted-foreground mt-2 text-sm">
                  {formatDateTime(report.endedAt ?? report.startedAt, 'Not started')} ·{' '}
                  {report.participantCount}{' '}
                  {report.participantCount === 1 ? 'participant' : 'participants'} ·
                  Participation {report.participationPercent}% · Voting{' '}
                  {report.votingPercent}% · Correct{' '}
                  {report.correctPercent === null ? '—' : `${report.correctPercent}%`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
