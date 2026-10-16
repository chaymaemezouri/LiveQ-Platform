import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QuestionsService } from './questions.service';

const ownerId = '11111111-1111-4111-8111-111111111111';
const sessionId = '33333333-3333-4333-8333-333333333333';
const requestId = '22222222-2222-4222-8222-222222222222';

function stored(id: string, prompt: string, position: number) {
  return {
    id,
    sessionId,
    prompt,
    kind: 'CHOICE',
    position,
    createdAt: new Date('2026-10-15T12:00:00.000Z'),
    updatedAt: new Date('2026-10-15T12:00:00.000Z'),
    options: [
      { id: `${id}-a`, label: 'Yes', position: 1 },
      { id: `${id}-b`, label: 'No', position: 2 },
    ],
    correctAnswer: null,
  };
}

describe('QuestionsService import', () => {
  const sessionFindFirst = vi.fn();
  const questionAggregate = vi.fn();
  const questionCreate = vi.fn();
  const questionFindFirst = vi.fn();
  const optionCreate = vi.fn();
  const correctCreate = vi.fn();
  const voteCount = vi.fn();
  const db = {
    session: { findFirst: sessionFindFirst },
    question: {
      aggregate: questionAggregate,
      create: questionCreate,
      findFirst: questionFindFirst,
    },
    questionOption: { create: optionCreate },
    correctAnswer: { create: correctCreate },
    vote: { count: voteCount },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  };
  let service: QuestionsService;

  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction = (fn: (tx: unknown) => Promise<unknown>) => fn(db);
    service = new QuestionsService(db as unknown as PrismaService);
    sessionFindFirst.mockResolvedValue({ id: sessionId, status: 'DRAFT' });
    voteCount.mockResolvedValue(0);
    questionAggregate.mockResolvedValue({ _max: { position: 2 } });
    questionCreate
      .mockResolvedValueOnce({ id: 'q-poll' })
      .mockResolvedValueOnce({ id: 'q-text' });
    optionCreate.mockResolvedValueOnce({ id: 'opt-a' }).mockResolvedValueOnce({ id: 'opt-b' });
    questionFindFirst
      .mockResolvedValueOnce(stored('q-poll', 'Which topic next?', 3))
      .mockResolvedValueOnce({
        ...stored('q-text', 'What will you try first?', 4),
        kind: 'TEXT',
        options: [],
      });
  });

  it('adds the selected questions in order inside one transaction', async () => {
    const created = await service.importQuestions(ownerId, sessionId, requestId, [
      {
        row: 3,
        prompt: 'Which topic next?',
        kind: 'CHOICE',
        options: [{ label: 'Routing' }, { label: 'Security' }],
      },
      { row: 4, prompt: 'What will you try first?', kind: 'TEXT' },
    ]);

    expect(created.map((question) => question.prompt)).toEqual([
      'Which topic next?',
      'What will you try first?',
    ]);
    expect(questionCreate).toHaveBeenCalledTimes(2);
    expect(optionCreate).toHaveBeenCalledTimes(2);
    expect(correctCreate).not.toHaveBeenCalled();
    expect(questionAggregate).toHaveBeenNthCalledWith(1, { where: { sessionId }, _max: { position: true } });
  });

  it('does not insert the same request twice', async () => {
    const questions = [{ row: 2, prompt: 'A written note', kind: 'TEXT' as const }];
    questionAggregate.mockResolvedValue({ _max: { position: 0 } });
    questionCreate.mockReset();
    questionCreate.mockResolvedValue({ id: 'q-text' });
    questionFindFirst.mockReset();
    questionFindFirst.mockResolvedValue({
      ...stored('q-text', 'A written note', 1),
      kind: 'TEXT',
      options: [],
    });

    const first = await service.importQuestions(ownerId, sessionId, requestId, questions);
    const second = await service.importQuestions(ownerId, sessionId, requestId, questions);

    expect(second).toEqual(first);
    expect(questionCreate).toHaveBeenCalledTimes(1);
  });

  it('rejects a second import while the first is still running', async () => {
    let release: (() => void) | undefined;
    db.$transaction = (fn: (tx: unknown) => Promise<unknown>) =>
      new Promise((resolve, reject) => {
        release = () => {
          void fn(db).then(resolve, reject);
        };
      });
    questionAggregate.mockResolvedValue({ _max: { position: 0 } });
    questionCreate.mockReset();
    questionCreate.mockResolvedValue({ id: 'q-text' });
    questionFindFirst.mockReset();
    questionFindFirst.mockResolvedValue({
      ...stored('q-text', 'A written note', 1),
      kind: 'TEXT',
      options: [],
    });

    const first = service.importQuestions(ownerId, sessionId, requestId, [
      { row: 2, prompt: 'A written note', kind: 'TEXT' },
    ]);
    await expect(
      service.importQuestions(ownerId, sessionId, '44444444-4444-4444-8444-444444444444', [
        { row: 3, prompt: 'Another note', kind: 'TEXT' },
      ]),
    ).rejects.toBeInstanceOf(ConflictException);
    release?.();
    await first;
  });

  it('blocks an ended session and a written question that still has options', async () => {
    sessionFindFirst.mockResolvedValue({ id: sessionId, status: 'ENDED' });
    await expect(
      service.importQuestions(ownerId, sessionId, requestId, [
        { row: 2, prompt: 'A written note', kind: 'TEXT' },
      ]),
    ).rejects.toBeInstanceOf(ConflictException);

    sessionFindFirst.mockResolvedValue({ id: sessionId, status: 'ACTIVE' });
    await expect(
      service.importQuestions(ownerId, sessionId, '55555555-5555-4555-8555-555555555555', [
        {
          row: 6,
          prompt: 'Notes',
          kind: 'TEXT',
          options: [{ label: 'Should not be here' }],
        },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(questionCreate).not.toHaveBeenCalled();
  });
});
