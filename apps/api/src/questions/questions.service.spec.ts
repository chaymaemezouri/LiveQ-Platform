import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QuestionsService } from './questions.service';

const ownerId = '11111111-1111-4111-8111-111111111111';
const sessionId = '33333333-3333-4333-8333-333333333333';

function storedQuestion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    sessionId,
    prompt: 'What is 2 + 2?',
    kind: 'CHOICE',
    position: 1,
    createdAt: new Date('2026-10-08T08:00:00.000Z'),
    updatedAt: new Date('2026-10-08T08:00:00.000Z'),
    options: [
      { id: 'opt-1', label: '3', position: 1 },
      { id: 'opt-2', label: '4', position: 2 },
    ],
    correctAnswer: { optionId: 'opt-2' },
    ...overrides,
  };
}

describe('QuestionsService', () => {
  const sessionFindFirst = vi.fn();
  const questionAggregate = vi.fn();
  const questionCreate = vi.fn();
  const questionFindFirst = vi.fn();
  const questionFindMany = vi.fn();
  const questionUpdate = vi.fn();
  const optionCreate = vi.fn();
  const optionDeleteMany = vi.fn();
  const correctCreate = vi.fn();
  const voteCount = vi.fn();
  const voteGroupBy = vi.fn();
  const db = {
    session: { findFirst: sessionFindFirst },
    question: {
      aggregate: questionAggregate,
      create: questionCreate,
      findFirst: questionFindFirst,
      findMany: questionFindMany,
      update: questionUpdate,
    },
    questionOption: { create: optionCreate, deleteMany: optionDeleteMany },
    correctAnswer: { create: correctCreate, deleteMany: vi.fn() },
    vote: { count: voteCount, groupBy: voteGroupBy },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  };
  const service = new QuestionsService(db as unknown as PrismaService);
  const content = {
    prompt: 'What is 2 + 2?',
    options: [{ label: '3' }, { label: '4' }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sessionFindFirst.mockResolvedValue({ id: sessionId });
    voteCount.mockResolvedValue(0);
    voteGroupBy.mockResolvedValue([]);
  });

  it('stores the selected option as the only correct answer', async () => {
    questionAggregate.mockResolvedValue({ _max: { position: null } });
    questionCreate.mockResolvedValue({ id: 'q1' });
    optionCreate
      .mockResolvedValueOnce({ id: 'opt-1' })
      .mockResolvedValueOnce({ id: 'opt-2' });
    questionFindFirst.mockResolvedValue(storedQuestion({ id: 'q1' }));

    const view = await service.create(ownerId, sessionId, {
      ...content,
      correctOptionIndex: 1,
    });

    expect(questionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sessionId, position: 1 }),
      }),
    );
    expect(correctCreate).toHaveBeenCalledWith({
      data: { questionId: 'q1', optionId: 'opt-2' },
    });
    expect(view.correctOptionId).toBe('opt-2');
    expect(view.hasVotingHistory).toBe(false);
  });

  it('leaves an opinion poll without a correct answer', async () => {
    questionAggregate.mockResolvedValue({ _max: { position: 2 } });
    questionCreate.mockResolvedValue({ id: 'q1' });
    optionCreate.mockResolvedValue({ id: 'opt-1' });
    questionFindFirst.mockResolvedValue(
      storedQuestion({ correctAnswer: null, position: 3 }),
    );

    const view = await service.create(ownerId, sessionId, {
      ...content,
      correctOptionIndex: null,
    });

    expect(questionCreate.mock.calls[0]?.[0].data.position).toBe(3);
    expect(correctCreate).not.toHaveBeenCalled();
    expect(view.correctOptionId).toBeNull();
  });

  it('stores a written question without options', async () => {
    questionAggregate.mockResolvedValue({ _max: { position: null } });
    questionCreate.mockResolvedValue({ id: 'q1' });
    questionFindFirst.mockResolvedValue(
      storedQuestion({ id: 'q1', kind: 'TEXT', options: [], correctAnswer: null }),
    );

    const view = await service.create(ownerId, sessionId, {
      prompt: 'Name a color',
      kind: 'TEXT',
    });

    expect(optionCreate).not.toHaveBeenCalled();
    expect(correctCreate).not.toHaveBeenCalled();
    expect(questionCreate.mock.calls[0]?.[0].data.kind).toBe('TEXT');
    expect(view.kind).toBe('TEXT');
  });

  it('rejects a correct option that is outside the answer list', async () => {
    await expect(
      service.create(ownerId, sessionId, { ...content, correctOptionIndex: 4 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(questionCreate).not.toHaveBeenCalled();
  });

  it('hides another speaker’s session', async () => {
    sessionFindFirst.mockResolvedValue(null);

    await expect(service.get(ownerId, sessionId, 'q1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(questionFindFirst).not.toHaveBeenCalled();
  });

  it('refuses to rewrite a question that already has votes', async () => {
    questionFindFirst.mockResolvedValue({ id: 'q1' });
    voteCount.mockResolvedValue(2);

    await expect(
      service.update(ownerId, sessionId, 'q1', { ...content, correctOptionIndex: 0 }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(optionDeleteMany).not.toHaveBeenCalled();
  });

  it('rejects a reorder that omits a question', async () => {
    questionFindMany.mockResolvedValue([
      { id: 'a', position: 1 },
      { id: 'b', position: 2 },
    ]);

    await expect(service.reorder(ownerId, sessionId, ['a'])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(questionUpdate).not.toHaveBeenCalled();
  });

  it('parks positions before applying a new order', async () => {
    questionFindMany
      .mockResolvedValueOnce([
        { id: 'a', position: 1 },
        { id: 'b', position: 2 },
      ])
      .mockResolvedValueOnce([
        storedQuestion({ id: 'b', position: 1 }),
        storedQuestion({ id: 'a', position: 2 }),
      ]);

    await service.reorder(ownerId, sessionId, ['b', 'a']);

    expect(questionUpdate.mock.calls.map((call) => call[0])).toEqual([
      { where: { id: 'a' }, data: { position: -1 } },
      { where: { id: 'b' }, data: { position: -2 } },
      { where: { id: 'b' }, data: { position: 1 } },
      { where: { id: 'a' }, data: { position: 2 } },
    ]);
  });
});
