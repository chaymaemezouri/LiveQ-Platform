import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ThemeToggle } from '@/components/theme-toggle';

export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-md items-center justify-between px-6 py-4">
        <Link to="/" className="font-serif text-2xl text-yellow-500">
          LiveQ
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-md px-6 py-8">
        <h1 className="text-3xl">{title}</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-6">{description}</p>
        <div className="mt-8">{children}</div>
        <p className="text-muted-foreground mt-6 text-sm">{footer}</p>
      </main>
    </div>
  );
}
