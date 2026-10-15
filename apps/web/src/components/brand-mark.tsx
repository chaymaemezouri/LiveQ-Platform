import logoUrl from '@/assets/liveq-logo.png';
import { cn } from '@/lib/utils';

export function BrandMark({ className }: { className?: string }) {
  return <img src={logoUrl} alt="LiveQ" className={cn('h-12 w-auto', className)} />;
}
