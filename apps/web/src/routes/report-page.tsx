import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ReportDashboard } from '@/components/report-dashboard';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/dates';
import { ApiError } from '@/lib/http';
import { downloadReport, fetchReport } from '@/lib/reports';

export function ReportPage() {
  const { sessionId = '' } = useParams();
  const [error, setError] = useState('');
  const [pending, setPending] = useState<'pdf' | 'xlsx' | null>(null);
  const report = useQuery({
    queryKey: ['report', sessionId],
    queryFn: () => fetchReport(sessionId),
  });

  async function exportReport(format: 'pdf' | 'xlsx') {
    setPending(format);
    setError('');
    try {
      const file = await downloadReport(sessionId, format);
      const url = URL.createObjectURL(file.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'The report could not be exported.',
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <p className="text-muted-foreground text-sm">
        <Link to="/app/reports" className="hover:underline">
          Reports
        </Link>
      </p>

      {report.isPending ? (
        <p className="text-muted-foreground mt-8 text-sm">Loading statistics…</p>
      ) : null}
      {report.isError ? (
        <p className="text-destructive mt-8 text-sm" role="alert">
          {report.error instanceof ApiError
            ? report.error.message
            : 'Report not found.'}
        </p>
      ) : null}

      {report.data ? (
        <>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4 rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-violet-50 px-5 py-5 dark:border-border dark:from-card dark:via-card dark:to-violet-950/40">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl">{report.data.title}</h1>
                <StatusBadge status={report.data.status} />
              </div>
              <p className="text-muted-foreground mt-2 text-sm">
                Started {formatDateTime(report.data.startedAt, 'not yet')} · Ended{' '}
                {formatDateTime(report.data.endedAt, 'not yet')}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() => void exportReport('pdf')}
                disabled={pending !== null}
              >
                {pending === 'pdf' ? 'Preparing PDF…' : 'Download PDF'}
              </Button>
              <Button
                variant="outline"
                onClick={() => void exportReport('xlsx')}
                disabled={pending !== null}
              >
                {pending === 'xlsx' ? 'Preparing Excel…' : 'Download Excel'}
              </Button>
            </div>
          </div>
          {error ? (
            <p className="text-destructive mt-4 text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-8">
            <ReportDashboard report={report.data} />
          </div>
        </>
      ) : null}
    </main>
  );
}
