import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <p className="text-muted-foreground text-sm font-medium tracking-[0.16em] uppercase">
        <span className="text-yellow-500">LiveQ</span>
      </p>
      <h1 className="text-foreground mt-3 text-4xl">This page is not available</h1>
      <p className="text-muted-foreground mt-3 text-base leading-7">
        The address does not match a LiveQ screen in this build.
      </p>
      <Link
        to="/"
        className="bg-primary text-primary-foreground mt-8 inline-flex h-9 w-fit items-center rounded-md px-4 text-sm font-medium shadow-sm"
      >
        Back home
      </Link>
    </main>
  );
}
