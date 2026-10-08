import type { SessionStatus } from '@/lib/api';
import { cn } from '@/lib/utils';

const labels: Record<SessionStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  ENDED: 'Ended',
};

export function StatusBadge({ status }: { status: SessionStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        status === 'ACTIVE' &&
          'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
        status === 'DRAFT' && 'bg-secondary text-secondary-foreground',
        status === 'ENDED' && 'bg-muted text-muted-foreground',
      )}
    >
      {labels[status]}
    </span>
  );
}
