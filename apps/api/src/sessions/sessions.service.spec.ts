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
  const prisma = {
    session: { findMany, findFirst, create, updateMany, deleteMany },
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
});
