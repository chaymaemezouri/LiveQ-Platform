import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReportDashboard } from '@/components/report-dashboard';
import type { SessionReport } from '@/lib/reports';

function report(overrides: Partial<SessionReport> = {}): SessionReport {
  return {
    sessionId: 'session-1',
    title: 'Opening lecture',
    status: 'ENDED',
    startedAt: '2026-11-01T09:00:00.000Z',
    endedAt: '2026-11-01T10:30:00.000Z',
    participantCount: 2,
    questionCount: 1,
    askedQuestionCount: 1,
    publishedQuestionCount: 1,
    voteCount: 2,
    participationPercent: 100,
    votingPercent: 100,
    correctPercent: 50,
    questions: [
      {
        questionId: 'question-1',
        position: 1,
        prompt: 'What is 2 + 2?',
        published: true,
        graded: true,
        voteCount: 2,
        votingPercent: 100,
        correctCount: 1,
        correctPercent: 50,
        correctOptionId: 'four',
        options: [
          { optionId: 'three', label: '3', count: 1, percent: 50 },
          { optionId: 'four', label: '4', count: 1, percent: 50 },
        ],
      },
    ],
    ...overrides,
  };
}

describe('ReportDashboard', () => {
  it('shows conference rates and the published chart', () => {
    render(<ReportDashboard report={report()} />);

    expect(screen.getByText('Participation')).toBeInTheDocument();
    expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
    expect(screen.getByText('Correct answers')).toBeInTheDocument();
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0);
    expect(screen.getByText('Correct')).toBeInTheDocument();
    expect(screen.getByRole('figure', { name: 'Results' })).toBeInTheDocument();
  });

  it('hides the answer split until results are published', () => {
    render(
      <ReportDashboard
        report={report({
          publishedQuestionCount: 0,
          correctPercent: null,
          questions: [
            {
              questionId: 'question-1',
              position: 1,
              prompt: 'What is 2 + 2?',
              published: false,
              graded: true,
              voteCount: 2,
              votingPercent: 100,
              correctCount: null,
              correctPercent: null,
              correctOptionId: null,
              options: [],
            },
          ],
        })}
      />,
    );

    expect(
      screen.getByText('Results are not published, so the answer split stays hidden.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Correct')).not.toBeInTheDocument();
    expect(screen.queryByRole('figure', { name: 'Results' })).not.toBeInTheDocument();
  });
});
