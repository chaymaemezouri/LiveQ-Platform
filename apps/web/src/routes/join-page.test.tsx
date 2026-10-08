import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/components/theme-provider';
import { JoinPage } from '@/routes/join-page';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function renderJoin(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: '/join', Component: JoinPage },
      { path: '/join/:code', Component: JoinPage },
    ],
    { initialEntries: [path] },
  );

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('JoinPage', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('shows the code from the invitation and joins into the waiting room', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, {
        accessToken: 'raw-token',
        participant: { id: 'participant-1', nickname: 'Ada' },
        session: { title: 'Opening lecture', status: 'ACTIVE', participantCount: 1 },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderJoin('/join/ab23cd45');

    expect(screen.getByLabelText('Joining code')).toHaveValue('AB23CD45');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    const form = screen.getByRole('button', { name: 'Join session' }).closest('form');
    if (!form) {
      throw new Error('Join form was not rendered');
    }
    fireEvent.submit(form);

    expect(
      await screen.findByRole('heading', { name: 'Opening lecture' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Joined as Ada');
    expect(localStorage.getItem('liveq.participant.AB23CD45')).toBe('raw-token');
    expect(localStorage.getItem('liveq.accessToken')).toBeNull();
  });

  it('explains an invalid joining code', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(404, { message: 'This joining code is not valid.' }),
      );
    vi.stubGlobal('fetch', fetchMock);
    renderJoin('/join/AB23CD45');

    const form = screen.getByRole('button', { name: 'Join session' }).closest('form');
    if (!form) {
      throw new Error('Join form was not rendered');
    }
    fireEvent.submit(form);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This joining code is not valid.',
    );
  });

  it('reconnects from the token saved on this device', async () => {
    localStorage.setItem('liveq.accessToken', 'speaker-token');
    localStorage.setItem('liveq.participant.AB23CD45', 'saved-token');
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        participant: { id: 'participant-1', nickname: null },
        session: { title: 'Opening lecture', status: 'ACTIVE', participantCount: 3 },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderJoin('/join/AB23CD45');

    expect(
      await screen.findByRole('heading', { name: 'Opening lecture' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Joined anonymously');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/join/me');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer saved-token');
    expect(localStorage.getItem('liveq.accessToken')).toBe('speaker-token');
  });

  it('drops only the participant token when reconnect is rejected', async () => {
    localStorage.setItem('liveq.accessToken', 'speaker-token');
    localStorage.setItem('liveq.participant.AB23CD45', 'stale-token');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(401, { message: 'Unauthorized' })),
    );
    renderJoin('/join/AB23CD45');

    expect(
      await screen.findByRole('heading', { name: 'Join a session' }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(localStorage.getItem('liveq.participant.AB23CD45')).toBeNull();
    });
    expect(localStorage.getItem('liveq.accessToken')).toBe('speaker-token');
  });
});
