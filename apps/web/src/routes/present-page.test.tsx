import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveDesk } from '@/components/live-desk';
import { fetchQuestions, fetchSession, type Question, type Session } from '@/lib/api';
import { fetchLiveState, launchQuestion, type LiveState } from '@/lib/live';
import {
  postPresentView,
  presentChannelName,
  type PresentMessage,
} from '@/lib/present-channel';
import { fetchReport } from '@/lib/reports';
import { PresentPage } from './present-page';

vi.mock('@/lib/api', () => ({ fetchSession: vi.fn(), fetchQuestions: vi.fn() }));
vi.mock('@/lib/reports', () => ({ fetchReport: vi.fn() }));
vi.mock('@/lib/live', () => ({
  fetchLiveState: vi.fn(),
  launchQuestion: vi.fn(),
  closeVoting: vi.fn(),
  publishResults: vi.fn(),
  openLiveSocket: () => ({ on: vi.fn(), disconnect: vi.fn() }),
}));

class TestChannel {
  static channels = new Set<TestChannel>();
  static messages: PresentMessage[] = [];
  onmessage: ((event: MessageEvent<PresentMessage>) => void) | null = null;
  name: string;

  constructor(name: string) {
    this.name = name;
    TestChannel.channels.add(this);
  }

  postMessage(message: PresentMessage) {
    TestChannel.messages.push(message);
    for (const channel of TestChannel.channels) {
      if (channel !== this && channel.name === this.name) {
        channel.onmessage?.(new MessageEvent('message', { data: message }));
      }
    }
  }

  close() {
    TestChannel.channels.delete(this);
  }
}

const session: Session = {
  id: 'session-1',
  title: 'Projector hall',
  description: null,
  joinCode: 'ABCD1234',
  joinUrl: 'http://localhost/join/ABCD1234',
  status: 'ACTIVE',
  scheduledStartAt: null,
  scheduledEndAt: null,
  startedAt: null,
  endedAt: null,
  createdAt: '',
  updatedAt: '',
  participantCount: 2,
};
const question: Question = {
  id: 'question-1',
  sessionId: session.id,
  prompt: 'What is 2 + 2?',
  kind: 'CHOICE',
  position: 1,
  correctOptionId: 'four',
  hasVotingHistory: false,
  createdAt: '',
  updatedAt: '',
  options: [
    { id: 'three', label: '3', position: 1 },
    { id: 'four', label: '4', position: 2 },
  ],
};
const idle: LiveState = {
  sessionStatus: 'ACTIVE',
  phase: 'idle',
  voteCount: 0,
  askedQuestionIds: [],
  question: null,
  results: null,
  timerSeconds: null,
  closesAt: null,
};
const opened: LiveState = {
  ...idle,
  phase: 'open',
  askedQuestionIds: [question.id],
  question: {
    runId: 'run-1',
    questionId: question.id,
    prompt: question.prompt,
    position: 1,
    kind: 'CHOICE',
    options: question.options,
  },
};
const published: LiveState = {
  ...opened,
  phase: 'published',
  correctOptionId: 'four',
  voteCount: 2,
  results: [
    { optionId: 'three', label: '3', count: 1, percent: 50 },
    { optionId: 'four', label: '4', count: 1, percent: 50 },
  ],
};
const clients: QueryClient[] = [];

function client() {
  const next = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(next);
  return next;
}

function renderProjector() {
  return render(
    <QueryClientProvider client={client()}>
      <MemoryRouter initialEntries={['/app/present/session-1']}>
        <Routes>
          <Route path="/app/present/:sessionId" element={<PresentPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  TestChannel.messages = [];
  TestChannel.channels.clear();
  vi.stubGlobal('BroadcastChannel', TestChannel);
  vi.mocked(fetchSession).mockResolvedValue(session);
  vi.mocked(fetchQuestions).mockResolvedValue([question]);
  vi.mocked(fetchLiveState).mockResolvedValue(idle);
  vi.mocked(fetchReport).mockResolvedValue({
    sessionId: session.id,
    title: session.title,
    status: 'ACTIVE',
    startedAt: null,
    endedAt: null,
    participantCount: 2,
    questionCount: 1,
    askedQuestionCount: 0,
    publishedQuestionCount: 0,
    voteCount: 0,
    participationPercent: 0,
    votingPercent: 0,
    correctPercent: null,
    questions: [],
  });
});

afterEach(() => {
  clients.splice(0).forEach((queryClient) => queryClient.clear());
  vi.unstubAllGlobals();
});

describe('Projector synchronization', () => {
  it('recovers questions and results without socket events', async () => {
    postPresentView(session.id, 'question');
    renderProjector();
    await screen.findByText('Launch a question from Live controls to display it here.');

    vi.mocked(fetchLiveState).mockResolvedValue(opened);
    await screen.findByRole('heading', { name: question.prompt }, { timeout: 4000 });
    expect(screen.queryByText('Correct')).not.toBeInTheDocument();

    vi.mocked(fetchLiveState).mockResolvedValue(published);
    await screen.findByRole('figure', { name: 'Results' }, { timeout: 4000 });
    expect(screen.getByText('Correct')).toBeInTheDocument();
  }, 10000);

  it('uses the successful launch and publish snapshots from the controls', async () => {
    renderProjector();
    await screen.findByText(session.joinCode);

    act(() => postPresentView(session.id, 'question', opened));
    expect(screen.getByRole('heading', { name: question.prompt })).toBeInTheDocument();
    expect(screen.queryByRole('figure', { name: 'Results' })).not.toBeInTheDocument();

    act(() => postPresentView(session.id, 'question', published));
    expect(screen.getByRole('figure', { name: 'Results' })).toBeInTheDocument();
    expect(screen.getByText('Correct')).toBeInTheDocument();
  });

  it('restores the selected display when the projector is opened later', async () => {
    vi.mocked(fetchLiveState).mockResolvedValue(opened);
    postPresentView(session.id, 'code');
    renderProjector();

    await screen.findByText(session.joinCode);
    await waitFor(() => expect(fetchLiveState).toHaveBeenCalled());
    expect(
      screen.queryByRole('heading', { name: question.prompt }),
    ).not.toBeInTheDocument();
  });

  it('refreshes on a display command even when BroadcastChannel is unavailable', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    renderProjector();
    await screen.findByText(session.joinCode);
    vi.mocked(fetchLiveState).mockResolvedValue(published);

    act(() =>
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: presentChannelName(session.id),
          newValue: 'question',
        }),
      ),
    );

    await screen.findByRole('figure', { name: 'Results' });
    expect(screen.getByText('Correct')).toBeInTheDocument();
  });

  it('shows a live loading error instead of silently waiting for a question', async () => {
    postPresentView(session.id, 'question');
    vi.mocked(fetchLiveState).mockRejectedValue(new Error('Network unavailable'));
    renderProjector();

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
  });

  it('sends the projector its question only after launch succeeds', async () => {
    let finishLaunch!: (state: LiveState) => void;
    vi.mocked(launchQuestion).mockReturnValue(
      new Promise((resolve) => {
        finishLaunch = resolve;
      }),
    );
    render(
      <QueryClientProvider client={client()}>
        <LiveDesk
          sessionId={session.id}
          sessionStatus="ACTIVE"
          title={session.title}
          participantCount={2}
          joinCode={session.joinCode}
          joinUrl={session.joinUrl}
        />
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /Upcoming.*What is 2/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Show question' }));
    expect(TestChannel.messages).toHaveLength(0);

    await act(async () => finishLaunch(opened));
    await waitFor(() =>
      expect(TestChannel.messages).toContainEqual({ view: 'question', state: opened }),
    );
  });
});
