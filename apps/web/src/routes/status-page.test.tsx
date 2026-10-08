import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/components/theme-provider';
import { StatusPage } from '@/routes/status-page';

function renderStatusPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <StatusPage />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('StatusPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a reachable API and database after a successful health check', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'ok',
          service: 'liveq-api',
          database: 'up',
          timestamp: '2026-10-08T02:00:00.000Z',
        }),
      }),
    );

    renderStatusPage();

    expect(
      screen.getByRole('heading', { name: 'Foundation is ready' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Reachable')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('explains that the API is unavailable when the health check fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
      }),
    );

    renderStatusPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(/did not respond/i);
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0);
  });
});
