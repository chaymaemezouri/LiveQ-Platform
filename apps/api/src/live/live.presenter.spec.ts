import { presentLiveState, resultBars } from './live.presenter';
import type { LiveRunSource } from './live.types';

const correctOptionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherOptionId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function run(overrides: Partial<LiveRunSource> = {}): LiveRunSource {
  return {
    id: 'run-1',
    status: 'OPEN',
    timerSeconds: null,
    closesAt: null,
    resultsPublishedAt: null,
    question: {
      id: 'question-1',
      prompt: 'What is 2 + 2?',
      position: 1,
      options: [
        { id: correctOptionId, label: '4', position: 2 },
        { id: otherOptionId, label: '3', position: 1 },
      ],
      correctAnswer: { optionId: correctOptionId },
    },
    votes: [{ optionId: correctOptionId, participantId: 'p1' }],
    ...overrides,
  };
}

describe('live presentation', () => {
  it('hides the correct answer and the vote split while voting is open', () => {
    const state = presentLiveState({
      sessionStatus: 'ACTIVE',
      askedQuestionIds: ['question-1'],
      run: run(),
    });

    expect(state.phase).toBe('open');
    expect(state.voteCount).toBe(1);
    expect(state.results).toBeNull();
    expect(state).not.toHaveProperty('correctOptionId');
    expect(state.question?.options.map((option) => option.label)).toEqual(['3', '4']);
  });

  it('shares the countdown without the correct answer', () => {
    const closesAt = new Date('2026-11-01T09:00:30.000Z');
    const state = presentLiveState({
      sessionStatus: 'ACTIVE',
      askedQuestionIds: ['question-1'],
      run: run({ timerSeconds: 30, closesAt }),
    });

    expect(state.timerSeconds).toBe(30);
    expect(state.closesAt).toBe('2026-11-01T09:00:30.000Z');
    expect(state).not.toHaveProperty('correctOptionId');
    expect(state.results).toBeNull();
  });

  it('keeps results hidden after voting closes', () => {
    const state = presentLiveState({
      sessionStatus: 'ACTIVE',
      askedQuestionIds: ['question-1'],
      run: run({ status: 'CLOSED' }),
    });

    expect(state.phase).toBe('closed');
    expect(state.results).toBeNull();
    expect(state).not.toHaveProperty('correctOptionId');
  });

  it('publishes percentages and the correct option together', () => {
    const state = presentLiveState({
      sessionStatus: 'ACTIVE',
      askedQuestionIds: ['question-1'],
      run: run({
        status: 'CLOSED',
        resultsPublishedAt: new Date('2026-10-08T12:00:00.000Z'),
        votes: [
          { optionId: correctOptionId, participantId: 'p1' },
          { optionId: otherOptionId, participantId: 'p2' },
        ],
      }),
    });

    expect(state.phase).toBe('published');
    expect(state.correctOptionId).toBe(correctOptionId);
    expect(state.results).toEqual([
      { optionId: otherOptionId, label: '3', count: 1, percent: 50 },
      { optionId: correctOptionId, label: '4', count: 1, percent: 50 },
    ]);
  });

  it('publishes an opinion poll with no correct option', () => {
    const source = run({
      status: 'CLOSED',
      resultsPublishedAt: new Date('2026-10-08T12:00:00.000Z'),
    });
    source.question.correctAnswer = null;

    const state = presentLiveState({
      sessionStatus: 'ACTIVE',
      askedQuestionIds: ['question-1'],
      run: source,
    });

    expect(state.correctOptionId).toBeNull();
  });

  it('hides written answers until results are published', () => {
    const hidden = presentLiveState({
      sessionStatus: 'ACTIVE',
      askedQuestionIds: ['question-1'],
      run: run({
        question: {
          id: 'question-1',
          prompt: 'Name a color',
          position: 1,
          kind: 'TEXT',
          options: [],
          correctAnswer: null,
        },
        votes: [{ optionId: null, participantId: 'p1', textResponse: 'blue' }],
      }),
    });

    expect(hidden.responses).toBeNull();
    expect(JSON.stringify(hidden)).not.toContain('blue');

    const shown = presentLiveState({
      sessionStatus: 'ACTIVE',
      askedQuestionIds: ['question-1'],
      run: run({
        status: 'CLOSED',
        resultsPublishedAt: new Date('2026-10-08T12:00:00.000Z'),
        question: {
          id: 'question-1',
          prompt: 'Name a color',
          position: 1,
          kind: 'TEXT',
          options: [],
          correctAnswer: null,
        },
        votes: [{ optionId: null, participantId: 'p1', textResponse: 'blue' }],
      }),
    });

    expect(shown.responses).toEqual(['blue']);
    expect(shown.results).toBeNull();
    expect(shown.correctOptionId).toBeNull();
  });

  it('rounds an empty tally to zero percent', () => {
    expect(resultBars([{ id: otherOptionId, label: '3', position: 1 }], [])).toEqual([
      { optionId: otherOptionId, label: '3', count: 0, percent: 0 },
    ]);
  });
});
