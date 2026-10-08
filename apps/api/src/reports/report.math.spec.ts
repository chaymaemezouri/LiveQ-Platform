import { buildReport } from './report.math';
import type { ReportSource } from './report.types';

const correctOptionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherOptionId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function source(overrides: Partial<ReportSource> = {}): ReportSource {
  return {
    id: 'session-1',
    title: 'Opening lecture',
    status: 'ACTIVE',
    startedAt: '2026-11-01T09:00:00.000Z',
    endedAt: null,
    participantCount: 2,
    questions: [
      {
        id: 'question-1',
        prompt: 'What is 2 + 2?',
        position: 1,
        options: [
          { id: otherOptionId, label: '3', position: 1 },
          { id: correctOptionId, label: '4', position: 2 },
        ],
        correctOptionId,
        run: {
          published: false,
          votes: [
            { optionId: correctOptionId, participantId: 'ada' },
            { optionId: otherOptionId, participantId: 'grace' },
          ],
        },
      },
    ],
    ...overrides,
  };
}

describe('conference reports', () => {
  it('counts participation before publish and hides the answer split', () => {
    const report = buildReport(source());

    expect(report.participationPercent).toBe(100);
    expect(report.votingPercent).toBe(100);
    expect(report.correctPercent).toBeNull();
    expect(report.questions[0]).toMatchObject({
      voteCount: 2,
      votingPercent: 100,
      published: false,
      graded: true,
      correctOptionId: null,
      options: [],
    });
    expect(JSON.stringify(report)).not.toContain(correctOptionId);
  });

  it('publishes percentages and the correct option only after results are published', () => {
    const report = buildReport(
      source({
        status: 'ENDED',
        endedAt: '2026-11-01T10:30:00.000Z',
        questions: [
          {
            id: 'question-1',
            prompt: 'What is 2 + 2?',
            position: 1,
            options: [
              { id: otherOptionId, label: '3', position: 1 },
              { id: correctOptionId, label: '4', position: 2 },
            ],
            correctOptionId,
            run: {
              published: true,
              votes: [
                { optionId: correctOptionId, participantId: 'ada' },
                { optionId: otherOptionId, participantId: 'grace' },
              ],
            },
          },
          {
            id: 'question-2',
            prompt: 'Which topic next?',
            position: 2,
            options: [
              { id: 'graphs', label: 'Graphs', position: 1 },
              { id: 'proofs', label: 'Proofs', position: 2 },
            ],
            correctOptionId: null,
            run: {
              published: true,
              votes: [
                { optionId: 'graphs', participantId: 'ada' },
                { optionId: 'proofs', participantId: 'grace' },
              ],
            },
          },
        ],
      }),
    );

    expect(report.participationPercent).toBe(100);
    expect(report.votingPercent).toBe(100);
    expect(report.correctPercent).toBe(50);
    expect(report.questions[0]?.correctOptionId).toBe(correctOptionId);
    expect(report.questions[0]?.options).toEqual([
      { optionId: otherOptionId, label: '3', count: 1, percent: 50 },
      { optionId: correctOptionId, label: '4', count: 1, percent: 50 },
    ]);
    expect(report.questions[1]).toMatchObject({
      graded: false,
      correctOptionId: null,
      correctPercent: null,
    });
  });

  it('ignores people who never voted when measuring participation', () => {
    const report = buildReport(
      source({
        participantCount: 4,
        questions: [
          {
            id: 'question-1',
            prompt: 'What is 2 + 2?',
            position: 1,
            options: [
              { id: otherOptionId, label: '3', position: 1 },
              { id: correctOptionId, label: '4', position: 2 },
            ],
            correctOptionId,
            run: {
              published: true,
              votes: [{ optionId: correctOptionId, participantId: 'ada' }],
            },
          },
        ],
      }),
    );

    expect(report.participationPercent).toBe(25);
    expect(report.votingPercent).toBe(25);
    expect(report.correctPercent).toBe(100);
  });

  it('returns empty rates for a draft with no audience', () => {
    const report = buildReport(
      source({
        status: 'DRAFT',
        startedAt: null,
        participantCount: 0,
        questions: [],
      }),
    );

    expect(report).toMatchObject({
      voteCount: 0,
      participationPercent: 0,
      votingPercent: 0,
      correctPercent: null,
      askedQuestionCount: 0,
    });
  });
});
