import { ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LiveService } from './live.service';

const ownerId = '11111111-1111-4111-8111-111111111111';
const sessionId = '33333333-3333-4333-8333-333333333333';
const participantId = '44444444-4444-4444-8444-444444444444';
const questionId = '55555555-5555-4555-8555-555555555555';
const runId = '66666666-6666-4666-8666-666666666666';

describe('LiveService', () => {
  const sessionFindFirst = vi.fn();
  const sessionFindUnique = vi.fn();
  const questionFindFirst = vi.fn();
  const runFindFirst = vi.fn();
  const runCreate = vi.fn();
  const runUpdateMany = vi.fn();
  const voteFindFirst = vi.fn();
  const transaction = vi.fn();
  const prisma = {
    session: { findFirst: sessionFindFirst, findUnique: sessionFindUnique },
    question: { findFirst: questionFindFirst },
    questionRun: {
      findFirst: runFindFirst,
      create: runCreate,
      updateMany: runUpdateMany,
    },
    vote: { findFirst: voteFindFirst },
    $transaction: transaction,
  } as unknown as PrismaService;
  const service = new LiveService(prisma, {} as JwtService);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refuses to open voting on a draft session', async () => {
    sessionFindFirst.mockResolvedValue({ id: sessionId, status: 'DRAFT' });

    await expect(service.launch(ownerId, sessionId, questionId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(runCreate).not.toHaveBeenCalled();
  });

  it('refuses a second vote from the same participant', async () => {
    sessionFindUnique.mockResolvedValue({ status: 'ACTIVE' });
    runFindFirst.mockResolvedValue({ id: runId, questionId });
    voteFindFirst.mockResolvedValue({ id: 'vote-1' });

    await expect(
      service.cast(participantId, sessionId, {
        optionId: '77777777-7777-4777-8777-777777777777',
      }),
    ).rejects.toThrow('You already voted on this question.');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('refuses to close voting when nothing is open', async () => {
    sessionFindFirst.mockResolvedValue({ id: sessionId, status: 'ACTIVE' });
    runUpdateMany.mockResolvedValue({ count: 0 });

    await expect(service.close(ownerId, sessionId)).rejects.toThrow(
      'No question is open for voting.',
    );
  });
});
