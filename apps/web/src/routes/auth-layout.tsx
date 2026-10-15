import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { BrandMark } from '@/components/brand-mark';
import { ThemeToggle } from '@/components/theme-toggle';

const points = [
  'Create a session and share one join code.',
  'Launch a question, then publish the results.',
  'Keep the projector ready for the room.',
];

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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-6xl lg:grid-cols-2">
        <aside className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-violet-100" />
          <div className="relative px-12 py-10">
            <Link to="/" aria-label="LiveQ">
              <BrandMark className="h-14" />
            </Link>
            <p className="mt-12 text-xs font-medium tracking-[0.16em] text-blue-700 uppercase">
              Conferences and training
            </p>
            <h2 className="mt-3 max-w-sm text-3xl leading-tight text-slate-900">
              Run a live session from one calm control room.
            </h2>
            <ul className="mt-8 space-y-3">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-slate-700">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-violet-500" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <p className="relative px-12 pb-10 text-xs text-slate-500">
            Participants join with the code. Only speakers need an account.
          </p>
        </aside>
        <main className="flex flex-col px-6 py-6 sm:px-10">
          <div className="flex items-center justify-between">
            <Link to="/" aria-label="LiveQ" className="lg:hidden">
              <BrandMark className="h-11" />
            </Link>
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </div>
          <div className="flex flex-1 items-center justify-center py-8">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h1 className="text-2xl text-slate-900">{title}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
              <div className="mt-6">{children}</div>
              <p className="mt-6 border-t border-slate-100 pt-5 text-sm text-slate-500">{footer}</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
