import { useQuery } from '@tanstack/react-query';
import { BarChart3, CalendarDays, MonitorPlay, Plus, Users } from 'lucide-react';
import { Link } from 'react-router';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { fetchSessions, type Session } from '@/lib/api';
import { formatDateTime } from '@/lib/dates';
import { ApiError } from '@/lib/http';
import { fetchReports } from '@/lib/reports';

export function OverviewPage() {
  const { user } = useAuth();
  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: fetchSessions,
    refetchInterval: 5000,
  });
  const reports = useQuery({
    queryKey: ['reports'],
    queryFn: fetchReports,
  });
  const list = sessions.data ?? [];
  const participants = list.reduce((sum, session) => sum + session.participantCount, 0);
  const engagement = averageEngagement(reports.data ?? []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div>
        <h1 className="text-3xl text-slate-900">
          Welcome back{user?.displayName ? `, ${user.displayName}` : ''}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Your interactive sessions, all in one place.
        </p>
      </div>

      {sessions.isPending ? (
        <p className="mt-8 text-sm text-slate-500">Loading sessions…</p>
      ) : null}
      {sessions.isError ? (
        <p className="mt-8 text-sm text-red-600" role="alert">
          {sessions.error instanceof ApiError
            ? sessions.error.message
            : 'Sessions could not be loaded.'}
        </p>
      ) : null}

      {sessions.data ? (
        <>
          <section className="mt-6 grid gap-3 sm:grid-cols-3">
            <Metric icon={CalendarDays} label="Sessions" value={String(list.length)} />
            <Metric icon={Users} label="Participants" value={String(participants)} />
            <Metric
              icon={BarChart3}
              label="Engagement"
              value={engagement === null ? '—' : `${engagement}%`}
            />
          </section>
          <section className="mt-8">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl text-slate-900">My sessions</h2>
              <Button asChild className="rounded-xl bg-blue-600 hover:bg-blue-700">
                <Link to="/app/sessions/new">
                  <Plus aria-hidden />
                  New session
                </Link>
              </Button>
            </div>
            {list.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                No sessions yet. Create one when the room is ready.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {list.slice(0, 6).map((session) => (
                  <SessionRow key={session.id} session={session} />
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-900 shadow-sm">
      <Icon className="size-5 text-blue-500" aria-hidden />
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
}

function SessionRow({ session }: { session: Session }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
        <MonitorPlay className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <Link to={`/app/sessions/${session.id}`} className="font-medium hover:underline">
          {session.title}
        </Link>
        <p className="truncate text-xs text-slate-500">{sessionLine(session)}</p>
      </div>
      <SessionMark session={session} />
    </li>
  );
}

function SessionMark({ session }: { session: Session }) {
  if (session.status === 'ACTIVE') {
    return (
      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        Live
      </span>
    );
  }
  if (session.status === 'ENDED') {
    return (
      <Link
        to={`/app/reports/${session.id}`}
        className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
      >
        Report
      </Link>
    );
  }
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
      Draft
    </span>
  );
}

function sessionLine(session: Session): string {
  if (session.status === 'ENDED') {
    const people = session.participantCount === 1 ? 'person' : 'people';
    return `Completed · ${session.participantCount} ${people}`;
  }
  if (session.status === 'ACTIVE') {
    return `Live now · ${session.participantCount} participants`;
  }
  return session.scheduledStartAt
    ? formatDateTime(session.scheduledStartAt)
    : 'Not scheduled yet';
}

function averageEngagement(
  reports: { participantCount: number; participationPercent: number }[],
): number | null {
  const used = reports.filter((report) => report.participantCount > 0);
  if (used.length === 0) {
    return null;
  }
  const total = used.reduce((sum, report) => sum + report.participationPercent, 0);
  return Math.round(total / used.length);
}
