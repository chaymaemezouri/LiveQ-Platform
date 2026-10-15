import { useQuery } from '@tanstack/react-query';
import { BrandMark } from '@/components/brand-mark';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { fetchHealth } from '@/lib/api';

const foundationItems = [
  'npm workspaces for the API and web app',
  'PostgreSQL started with Docker Compose',
  'Prisma schema, client, and initial migration',
  'Validated environment configuration',
];

export function StatusPage() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
  });

  return (
    <div className="min-h-screen">
      <header className="border-border border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <BrandMark className="h-11" />
            <p className="text-muted-foreground mt-1 text-sm">
              Conference and training platform
            </p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-8 px-6 py-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)] lg:py-16">
        <section>
          <p className="text-muted-foreground text-sm font-medium tracking-[0.16em] uppercase">
            Operations
          </p>
          <h1 className="text-foreground mt-3 text-4xl leading-tight sm:text-5xl">
            Foundation is ready
          </h1>
          <p className="text-muted-foreground mt-4 max-w-xl text-base leading-7">
            This screen confirms that the web app can reach the API and PostgreSQL.
            Speaker sessions are managed from the dashboard.
          </p>
          <ul className="text-foreground mt-8 space-y-3 text-sm">
            {foundationItems.map((item) => (
              <li key={item} className="flex gap-3">
                <span
                  className="bg-primary mt-2 size-1.5 shrink-0 rounded-full"
                  aria-hidden
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Service status</CardTitle>
            <CardDescription>
              Live check against the NestJS health endpoint.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <dl className="space-y-4" aria-live="polite">
              <StatusRow
                label="API"
                value={apiLabel(health.status)}
                tone={health.status}
              />
              <StatusRow
                label="Database"
                value={databaseLabel(health.status, health.data?.database)}
                tone={health.status}
              />
              <StatusRow
                label="Checked"
                value={
                  health.data
                    ? new Date(health.data.timestamp).toLocaleString()
                    : 'Waiting for a response'
                }
                tone="idle"
              />
            </dl>
            {health.isError ? (
              <p className="text-destructive mt-6 text-sm" role="alert">
                The API did not respond. Start PostgreSQL, apply the migration, then
                start the API.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function StatusRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'pending' | 'error' | 'success' | 'idle';
}) {
  return (
    <div className="border-border flex items-center justify-between gap-4 border-b pb-4 last:border-b-0 last:pb-0">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-foreground flex items-center gap-2 text-sm font-medium">
        <span
          className={
            tone === 'success'
              ? 'size-2 rounded-full bg-emerald-600'
              : tone === 'error'
                ? 'bg-destructive size-2 rounded-full'
                : tone === 'pending'
                  ? 'size-2 rounded-full bg-amber-500'
                  : 'bg-border size-2 rounded-full'
          }
          aria-hidden
        />
        {value}
      </dd>
    </div>
  );
}

function apiLabel(status: 'pending' | 'error' | 'success'): string {
  if (status === 'pending') return 'Checking';
  if (status === 'error') return 'Unavailable';
  return 'Reachable';
}

function databaseLabel(
  status: 'pending' | 'error' | 'success',
  database: string | undefined,
): string {
  if (status === 'pending') return 'Checking';
  if (status === 'error' || database !== 'up') return 'Unavailable';
  return 'Connected';
}
