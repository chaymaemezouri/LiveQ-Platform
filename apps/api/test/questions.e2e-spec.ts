import { createHash, randomBytes } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Questions (e2e)', () => {
  let app: INestApplication;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const speaker = {
    email: `questions-${suffix}@university.edu`,
    displayName: 'Question Speaker',
    password: 'correct-password-123',
  };
  const other = {
    email: `questions-other-${suffix}@university.edu`,
    displayName: 'Other Speaker',
    password: 'another-password-123',
  };
  const userIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    const prisma = app.get(PrismaService);
    await prisma.session.deleteMany({ where: { ownerId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('manages questions for the session owner only', async () => {
    const server = app.getHttpServer();
    const prisma = app.get(PrismaService);
    const token = await register(server, speaker, userIds);
    const otherToken = await register(server, other, userIds);

    const session = await request(server)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Question workshop' })
      .expect(201);
    const sessionId = session.body.id as string;

    await request(server).get(`/api/sessions/${sessionId}/questions`).expect(401);
    await request(server)
      .get(`/api/sessions/${sessionId}/questions`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
    await request(server)
      .post(`/api/sessions/${sessionId}/questions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        prompt: 'Too few',
        options: [{ label: 'Only one' }],
        correctOptionIndex: 0,
      })
      .expect(400);
    await request(server)
      .post(`/api/sessions/${sessionId}/questions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        prompt: 'Out of range',
        options: [{ label: 'A' }, { label: 'B' }],
        correctOptionIndex: 4,
      })
      .expect(400);
    await request(server)
      .post(`/api/sessions/${sessionId}/questions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        prompt: 'Owned by the token',
        options: [{ label: 'A' }, { label: 'B' }],
        correctOptionIndex: 0,
        ownerId: other.email,
      })
      .expect(400);

    const graded = await request(server)
      .post(`/api/sessions/${sessionId}/questions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        prompt: 'What is 2 + 2?',
        options: [{ label: '3' }, { label: '4' }, { label: '5' }],
        correctOptionIndex: 1,
      })
      .expect(201);
    expect(graded.body.position).toBe(1);
    expect(graded.body.correctOptionId).toBe(graded.body.options[1].id);
    expect(graded.body.hasVotingHistory).toBe(false);

    const poll = await request(server)
      .post(`/api/sessions/${sessionId}/questions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        prompt: 'Which topic next?',
        options: [{ label: 'Graphs' }, { label: 'Proofs' }],
        correctOptionIndex: null,
      })
      .expect(201);
    expect(poll.body.correctOptionId).toBeNull();
    expect(poll.body.position).toBe(2);

    const third = await request(server)
      .post(`/api/sessions/${sessionId}/questions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        prompt: 'A short check',
        options: [{ label: 'Yes' }, { label: 'No' }],
        correctOptionIndex: 0,
      })
      .expect(201);

    const updated = await request(server)
      .patch(`/api/sessions/${sessionId}/questions/${graded.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        prompt: 'What is 2 + 2?',
        options: [{ label: 'Four' }, { label: 'Five' }],
        correctOptionIndex: 0,
      })
      .expect(200);
    expect(updated.body.prompt).toBe('What is 2 + 2?');
    expect(updated.body.options).toHaveLength(2);
    expect(updated.body.correctOptionId).toBe(updated.body.options[0].id);

    const reordered = await request(server)
      .patch(`/api/sessions/${sessionId}/questions/reorder`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        questionIds: [poll.body.id, third.body.id, graded.body.id],
      })
      .expect(200);
    expect(reordered.body.map((question: { id: string }) => question.id)).toEqual([
      poll.body.id,
      third.body.id,
      graded.body.id,
    ]);
    expect(
      reordered.body.map((question: { position: number }) => question.position),
    ).toEqual([1, 2, 3]);
    expect(
      new Set(reordered.body.map((question: { position: number }) => question.position))
        .size,
    ).toBe(3);

    await request(server)
      .patch(`/api/sessions/${sessionId}/questions/reorder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ questionIds: [poll.body.id] })
      .expect(400);

    await request(server)
      .delete(`/api/sessions/${sessionId}/questions/${third.body.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
    await request(server)
      .delete(`/api/sessions/${sessionId}/questions/${third.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    const afterDelete = await request(server)
      .get(`/api/sessions/${sessionId}/questions`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      afterDelete.body.map((question: { position: number }) => question.position),
    ).toEqual([1, 2]);

    const locked = afterDelete.body.find(
      (question: { id: string }) => question.id === graded.body.id,
    );
    const participant = await prisma.participant.create({
      data: {
        sessionId,
        tokenHash: createHash('sha256').update(randomBytes(32)).digest('hex'),
      },
    });
    const run = await prisma.questionRun.create({
      data: {
        questionId: locked.id,
        sessionId,
        status: 'CLOSED',
        closedAt: new Date(),
      },
    });
    await prisma.vote.create({
      data: {
        questionRunId: run.id,
        questionId: locked.id,
        sessionId,
        participantId: participant.id,
        optionId: locked.options[0].id,
      },
    });

    const stillVisible = await request(server)
      .get(`/api/sessions/${sessionId}/questions/${locked.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(stillVisible.body.hasVotingHistory).toBe(true);
    expect(stillVisible.body.correctOptionId).toBe(locked.correctOptionId);

    await request(server)
      .patch(`/api/sessions/${sessionId}/questions/${locked.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        prompt: 'Changed after votes',
        options: [{ label: 'A' }, { label: 'B' }],
        correctOptionIndex: 0,
      })
      .expect(409);
    await request(server)
      .delete(`/api/sessions/${sessionId}/questions/${locked.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
  });
});

async function register(
  server: Parameters<typeof request>[0],
  account: { email: string; displayName: string; password: string },
  userIds: string[],
): Promise<string> {
  const response = await request(server)
    .post('/api/auth/register')
    .send(account)
    .expect(201);
  userIds.push(response.body.user.id as string);
  return response.body.accessToken as string;
}
