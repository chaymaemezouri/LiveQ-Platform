import { cn } from '@/lib/utils';

export function BrandMark({ className }: { className?: string }) {
  return (
    <img src="/liveq-logo.png" alt="LiveQ" className={cn('h-12 w-auto', className)} />
  );
}
