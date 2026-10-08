import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ParticipantsService } from './participants.service';

const sessionId = '33333333-3333-4333-8333-333333333333';

describe('ParticipantsService', () => {
  const sessionFindUnique = vi.fn();
  const participantCreate = vi.fn();
  const participantCount = vi.fn();
  const participantFindUnique = vi.fn();
  const participantUpdate = vi.fn();
  const prisma = {
    session: { findUnique: sessionFindUnique },
    participant: {
      create: participantCreate,
      count: participantCount,
      findUnique: participantFindUnique,
      update: participantUpdate,
    },
  } as unknown as PrismaService;
  const service = new ParticipantsService(prisma);

  beforeEach(() => {
    vi.clearAllMocks();
    participantCount.mockResolvedValue(1);
    participantCreate.mockResolvedValue({ id: 'participant-1', nickname: null });
  });

  it('refuses a draft or unknown code without creating a participant', async () => {
    sessionFindUnique.mockResolvedValueOnce({
      id: sessionId,
      title: 'Hidden',
      status: 'DRAFT',
    });
    await expect(service.join({ code: 'AB23CD45' })).rejects.toBeInstanceOf(
      NotFoundException,
    );

    sessionFindUnique.mockResolvedValueOnce(null);
    await expect(service.join({ code: 'AB23CD45' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(participantCreate).not.toHaveBeenCalled();
  });

  it('refuses a session that has ended', async () => {
    sessionFindUnique.mockResolvedValue({
      id: sessionId,
      title: 'Done',
      status: 'ENDED',
    });

    await expect(service.join({ code: 'AB23CD45' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(participantCreate).not.toHaveBeenCalled();
  });

  it('returns a reconnect token and stores only its hash', async () => {
    sessionFindUnique.mockResolvedValue({
      id: sessionId,
      title: 'Opening lecture',
      status: 'ACTIVE',
    });

    const result = await service.join({ code: 'ab23cd45', nickname: null });

    const savedHash = participantCreate.mock.calls[0]?.[0].data.tokenHash as string;
    expect(savedHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.accessToken).not.toBe(savedHash);
    expect(JSON.stringify(result)).not.toContain(savedHash);
    expect(result.participant).toEqual({ id: 'participant-1', nickname: null });
    expect(result.session).toEqual({
      title: 'Opening lecture',
      status: 'ACTIVE',
      participantCount: 1,
    });
    expect(result).not.toHaveProperty('tokenHash');
  });

  it('reconnects the same participant and refreshes last seen', async () => {
    participantFindUnique.mockResolvedValue({
      id: 'participant-1',
      nickname: 'Ada',
      session: { id: sessionId, title: 'Opening lecture', status: 'ACTIVE' },
    });
    participantCount.mockResolvedValue(4);

    const presence = await service.reconnect('participant-1');

    expect(participantUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'participant-1' },
        data: { lastSeenAt: expect.any(Date) },
      }),
    );
    expect(presence.participant.id).toBe('participant-1');
    expect(presence.session.participantCount).toBe(4);
    expect(presence).not.toHaveProperty('accessToken');
  });
});
