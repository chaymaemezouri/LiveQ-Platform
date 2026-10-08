import { INestApplication, ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Test } from '@nestjs/testing';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

function connected(socket: Socket): Promise<void> {
  if (socket.connected) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out connecting')), 8000);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function waitForVotes(socket: Socket, count: number): Promise<{ voteCount: number }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Timed out waiting for vote count')),
      8000,
    );
    const onVotes = (payload: { voteCount: number }) => {
      if (payload.voteCount < count) {
        return;
      }
      clearTimeout(timer);
      socket.off('live:votes', onVotes);
      resolve(payload);
    };
    socket.on('live:votes', onVotes);
  });
}

function waitForState(
  socket: Socket,
  phase: string,
): Promise<{ phase: string; voteCount: number; correctOptionId?: string | null }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ${phase}`)),
      8000,
    );
    const onState = (state: {
      phase: string;
      voteCount: number;
      correctOptionId?: string | null;
    }) => {
      if (state.phase !== phase) {
        return;
      }
      clearTimeout(timer);
      socket.off('live:state', onState);
      resolve(state);
    };
    socket.on('live:state', onState);
  });
}

describe('Live voting (e2e)', () => {
  let app: INestApplication;
  let baseUrl = '';
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const userIds: string[] = [];
  const sockets: Socket[] = [];

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
    app.useWebSocketAdapter(new IoAdapter(app));
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    for (const socket of sockets) {
      socket.disconnect();
    }
    const prisma = app.get(PrismaService);
    await prisma.session.deleteMany({ where: { ownerId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('runs one vote per participant and publishes results only when the speaker asks', async () => {
    const server = app.getHttpServer();
    const registered = await request(server)
      .post('/api/auth/register')
      .send({
        email: `vote-${suffix}@university.edu`,
        displayName: 'Vote Speaker',
        password: 'correct-password-123',
      })
      .expect(201);
    userIds.push(registered.body.user.id as string);
    const token = registered.body.accessToken as string;
    const auth = { Authorization: `Bearer ${token}` };

    const created = await request(server)
      .post('/api/sessions')
      .set(auth)
      .send({ title: 'Voting workshop' })
      .expect(201);
    const sessionId = created.body.id as string;

    const graded = await request(server)
      .post(`/api/sessions/${sessionId}/questions`)
      .set(auth)
      .send({
        prompt: 'What is 2 + 2?',
        options: [{ label: '3' }, { label: '4' }],
        correctOptionIndex: 1,
      })
      .expect(201);
    const poll = await request(server)
      .post(`/api/sessions/${sessionId}/questions`)
      .set(auth)
      .send({
        prompt: 'Which topic next?',
        options: [{ label: 'Graphs' }, { label: 'Proofs' }],
        correctOptionIndex: null,
      })
      .expect(201);
    const four = graded.body.options[1].id as string;
    const three = graded.body.options[0].id as string;

    await request(server)
      .post(`/api/sessions/${sessionId}/live/launch`)
      .set(auth)
      .send({ questionId: graded.body.id })
      .expect(409);

    await request(server)
      .post(`/api/sessions/${sessionId}/activate`)
      .set(auth)
      .expect(201);

    const ada = await request(server)
      .post('/api/join')
      .send({ code: created.body.joinCode, nickname: 'Ada' })
      .expect(201);
    const grace = await request(server)
      .post('/api/join')
      .send({ code: created.body.joinCode, nickname: 'Grace' })
      .expect(201);

    const participant = io(baseUrl, {
      auth: { role: 'participant', token: ada.body.accessToken },
    });
    const speaker = io(baseUrl, {
      auth: { role: 'speaker', token, sessionId },
    });
    sockets.push(participant, speaker);
    await connected(participant);
    await connected(speaker);
    const opened = waitForState(participant, 'open');
    const speakerOpened = waitForState(speaker, 'open');

    const hidden = await request(server)
      .get('/api/join/live')
      .set('Authorization', `Bearer ${ada.body.accessToken}`)
      .expect(200);
    expect(hidden.body.phase).toBe('idle');
    expect(hidden.body).not.toHaveProperty('correctOptionId');

    await request(server)
      .post(`/api/sessions/${sessionId}/live/launch`)
      .set(auth)
      .send({ questionId: graded.body.id })
      .expect(201);

    const liveQuestion = await opened;
    expect(liveQuestion).not.toHaveProperty('correctOptionId');
    await speakerOpened;

    await request(server)
      .post('/api/join/votes')
      .set('Authorization', `Bearer ${ada.body.accessToken}`)
      .send({ optionId: '99999999-9999-4999-8999-999999999999' })
      .expect(400);

    const counts = waitForVotes(speaker, 2);
    await request(server)
      .post('/api/join/votes')
      .set('Authorization', `Bearer ${ada.body.accessToken}`)
      .send({ optionId: four })
      .expect(201);
    await request(server)
      .post('/api/join/votes')
      .set('Authorization', `Bearer ${grace.body.accessToken}`)
      .send({ optionId: three })
      .expect(201);
    await request(server)
      .post('/api/join/votes')
      .set('Authorization', `Bearer ${ada.body.accessToken}`)
      .send({ optionId: three })
      .expect(409);

    expect((await counts).voteCount).toBe(2);

    const during = await request(server)
      .get('/api/join/live')
      .set('Authorization', `Bearer ${ada.body.accessToken}`)
      .expect(200);
    expect(during.body.voteCount).toBe(2);
    expect(during.body.myOptionId).toBe(four);
    expect(during.body.results).toBeNull();
    expect(during.body).not.toHaveProperty('correctOptionId');
    expect(JSON.stringify(during.body)).not.toContain('correctAnswer');

    const closed = waitForState(participant, 'closed');
    await request(server)
      .post(`/api/sessions/${sessionId}/live/close`)
      .set(auth)
      .expect(201);
    expect((await closed).phase).toBe('closed');
    await request(server)
      .post(`/api/sessions/${sessionId}/live/next`)
      .set(auth)
      .expect(409);

    const published = waitForState(participant, 'published');
    const results = await request(server)
      .post(`/api/sessions/${sessionId}/live/publish`)
      .set(auth)
      .expect(201);
    expect(results.body.correctOptionId).toBe(four);
    expect(results.body.results).toEqual([
      expect.objectContaining({ label: '3', count: 1, percent: 50 }),
      expect.objectContaining({ label: '4', count: 1, percent: 50 }),
    ]);
    const seen = await published;
    expect(seen).toHaveProperty('correctOptionId', four);

    const reconnect = io(baseUrl, {
      auth: { role: 'participant', token: grace.body.accessToken },
      autoConnect: false,
    });
    sockets.push(reconnect);
    const restoredPromise = waitForState(reconnect, 'published');
    reconnect.connect();
    const restored = await restoredPromise;
    expect(restored.voteCount).toBe(2);

    await request(server)
      .post(`/api/sessions/${sessionId}/live/next`)
      .set(auth)
      .expect(201);
    const second = await request(server)
      .get('/api/join/live')
      .set('Authorization', `Bearer ${ada.body.accessToken}`)
      .expect(200);
    expect(second.body.question.prompt).toBe('Which topic next?');
    expect(second.body).not.toHaveProperty('correctOptionId');
    expect(second.body.myOptionId).toBeNull();

    await request(server)
      .post('/api/join/votes')
      .set('Authorization', `Bearer ${ada.body.accessToken}`)
      .send({ optionId: poll.body.options[0].id })
      .expect(201);
    await request(server)
      .post('/api/join/votes')
      .set('Authorization', `Bearer ${grace.body.accessToken}`)
      .send({ optionId: poll.body.options[1].id })
      .expect(201);

    await request(server).post(`/api/sessions/${sessionId}/end`).set(auth).expect(201);
    const ended = await request(server)
      .get(`/api/sessions/${sessionId}/live`)
      .set(auth)
      .expect(200);
    expect(ended.body.sessionStatus).toBe('ENDED');
    expect(ended.body.phase).toBe('closed');
    expect(ended.body).not.toHaveProperty('correctOptionId');
    await request(server)
      .post('/api/join/votes')
      .set('Authorization', `Bearer ${ada.body.accessToken}`)
      .send({ optionId: poll.body.options[0].id })
      .expect(409);
  });
});
