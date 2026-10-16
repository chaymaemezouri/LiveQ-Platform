import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import type { SessionRecord } from './session.presenter';
import { SessionsService } from './sessions.service';

const ownerId = '11111111-1111-4111-8111-111111111111';
const otherOwnerId = '22222222-2222-4222-8222-222222222222';
const sessionId = '33333333-3333-4333-8333-333333333333';

function record(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: sessionId,
    title: 'Morning lecture',
    description: null,
    joinCode: 'AB23CD45',
    status: 'DRAFT',
    scheduledStartAt: null,
    scheduledEndAt: null,
    startedAt: null,
    endedAt: null,
    createdAt: new Date('2026-10-08T08:00:00.000Z'),
    updatedAt: new Date('2026-10-08T08:00:00.000Z'),
    ...overrides,
  };
}

describe('SessionsService', () => {
  const findMany = vi.fn();
  const findFirst = vi.fn();
  const create = vi.fn();
  const updateMany = vi.fn();
  const deleteMany = vi.fn();
  const questionCreate = vi.fn();
  const optionCreate = vi.fn();
  const correctCreate = vi.fn();
  const prisma = {
    session: { findMany, findFirst, create, updateMany, deleteMany },
    question: { create: questionCreate },
    questionOption: { create: optionCreate },
    correctAnswer: { create: correctCreate },
    $transaction: (callback: (tx: unknown) => Promise<unknown>) => callback(prisma),
  } as unknown as PrismaService;
  const config = {
    getOrThrow: () => 'http://localhost:5173/',
  } as unknown as ConfigService;
  const live = { onSessionEnded: vi.fn() };
  const service = new SessionsService(prisma, config, live as never);

  beforeEach(() => {
    findMany.mockReset();
    findFirst.mockReset();
    create.mockReset();
    updateMany.mockReset();
    deleteMany.mockReset();
    questionCreate.mockReset();
    optionCreate.mockReset();
    correctCreate.mockReset();
  });

  it('creates a session for the authenticated owner and builds a public join URL', async () => {
    create.mockResolvedValue(record());

    const view = await service.create(ownerId, { title: 'Morning lecture' });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerId,
          title: 'Morning lecture',
          joinCode: expect.stringMatching(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/),
        }),
      }),
    );
    expect(view.joinUrl).toBe('http://localhost:5173/join/AB23CD45');
    expect(view).not.toHaveProperty('ownerId');
  });

  it('lists and reads only the authenticated speaker’s sessions', async () => {
    findMany.mockResolvedValue([record()]);
    findFirst.mockResolvedValue(null);

    await service.list(ownerId);
    await expect(service.get(otherOwnerId, sessionId)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId } }),
    );
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: sessionId, ownerId: otherOwnerId } }),
    );
  });

  it('deletes only when the session belongs to the authenticated speaker', async () => {
    deleteMany.mockResolvedValue({ count: 0 });

    await expect(service.remove(ownerId, sessionId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: sessionId, ownerId } });
  });

  it('refuses to activate a session that is not a draft', async () => {
    findFirst.mockResolvedValue(record({ status: 'ENDED' }));

    await expect(service.activate(ownerId, sessionId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('copies the questions into a new empty draft', async () => {
    findFirst
      .mockResolvedValueOnce({
        title: 'Morning lecture',
        description: 'Notes',
        questions: [
          {
            prompt: 'Which color?',
            kind: 'CHOICE',
            position: 1,
            options: [
              { id: 'old-a', label: 'Red', position: 1 },
              { id: 'old-b', label: 'Blue', position: 2 },
            ],
            correctAnswer: { optionId: 'old-b' },
          },
          {
            prompt: 'Write a word',
            kind: 'TEXT',
            position: 2,
            options: [],
            correctAnswer: null,
          },
        ],
      })
      .mockResolvedValueOnce(
        record({ id: 'new-id', title: 'Morning lecture (copy)', joinCode: 'NEWCODE1' }),
      );
    create.mockResolvedValue({ id: 'new-id' });
    questionCreate.mockResolvedValueOnce({ id: 'q1' }).mockResolvedValueOnce({ id: 'q2' });
    optionCreate.mockResolvedValueOnce({ id: 'opt-a' }).mockResolvedValueOnce({ id: 'opt-b' });

    const view = await service.duplicate(ownerId, sessionId);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerId,
          title: 'Morning lecture (copy)',
          description: 'Notes',
        }),
      }),
    );
    expect(create.mock.calls[0]?.[0].data).not.toHaveProperty('startedAt');
    expect(questionCreate).toHaveBeenNthCalledWith(1, {
      data: {
        sessionId: 'new-id',
        prompt: 'Which color?',
        kind: 'CHOICE',
        position: 1,
      },
      select: { id: true },
    });
    expect(correctCreate).toHaveBeenCalledWith({
      data: { questionId: 'q1', optionId: 'opt-b' },
    });
    expect(optionCreate).toHaveBeenCalledTimes(2);
    expect(view.id).toBe('new-id');
    expect(view.title).toBe('Morning lecture (copy)');
    expect(updateMany).not.toHaveBeenCalled();
  });
});
