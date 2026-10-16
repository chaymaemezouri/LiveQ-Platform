import { useNow } from '@/hooks/use-now';
import { formatClock, remainingSeconds } from '@/lib/clock';

export function CountdownRing({
  closesAt,
  totalSeconds,
  large = false,
}: {
  closesAt: string;
  totalSeconds: number;
  large?: boolean;
}) {
  const now = useNow();
  const left = remainingSeconds(closesAt, now) ?? 0;
  const total = Math.max(totalSeconds, 1);
  const progress = Math.min(1, left / total);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const urgent = left <= 10;

  return (
    <div className="flex flex-col items-center" role="timer" aria-live="polite">
      <div className={large ? 'relative grid size-44 place-items-center rounded-full bg-white shadow-md' : 'relative grid size-28 place-items-center sm:size-36'}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={large ? '#e8eef8' : 'var(--border)'}
            strokeWidth="6"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={urgent ? 'var(--destructive)' : large ? '#3b82f6' : 'var(--primary)'}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            transform="rotate(-90 50 50)"
          />
        </svg>
        <p className="font-mono text-4xl tracking-wider tabular-nums sm:text-5xl">{formatClock(left)}</p>
      </div>
      <p className="text-muted-foreground mt-3 text-xs tracking-[0.2em] uppercase">
        {left === 0 ? 'Time is up' : 'Time left'}
      </p>
    </div>
  );
}
