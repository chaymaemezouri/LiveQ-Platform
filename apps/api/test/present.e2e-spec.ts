import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Projector countdown (e2e)', () => {
  let app: INestApplication;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

  it('closes voting when the question timer has passed and still hides the answer', async () => {
    const server = app.getHttpServer();
    const registered = await request(server)
      .post('/api/auth/register')
      .send({
        email: `present-${suffix}@university.edu`,
        displayName: 'Present Speaker',
        password: 'correct-password-123',
      })
      .expect(201);
    userIds.push(registered.body.user.id as string);
    const auth = { Authorization: `Bearer ${registered.body.accessToken as string}` };

    const created = await request(server)
      .post('/api/sessions')
      .set(auth)
      .send({ title: 'Projector hall' })
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
    const four = graded.body.options[1].id as string;

    await request(server)
      .post(`/api/sessions/${sessionId}/activate`)
      .set(auth)
      .expect(201);
    const ada = await request(server)
      .post('/api/join')
      .send({ code: created.body.joinCode, nickname: 'Ada' })
      .expect(201);

    await request(server)
      .post(`/api/sessions/${sessionId}/live/launch`)
      .set(auth)
      .send({ questionId: graded.body.id, timerSeconds: 4 })
      .expect(400);

    const opened = await request(server)
      .post(`/api/sessions/${sessionId}/live/launch`)
      .set(auth)
      .send({ questionId: graded.body.id, timerSeconds: 30 })
      .expect(201);

    expect(opened.body.phase).toBe('open');
    expect(opened.body.timerSeconds).toBe(30);
    expect(opened.body.closesAt).toEqual(expect.any(String));
    expect(opened.body).not.toHaveProperty('correctOptionId');

    expect(opened.body.question.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: four, label: '4' }),
      ]),
    );

    const prisma = app.get(PrismaService);
    await prisma.questionRun.updateMany({
      where: { sessionId, status: 'OPEN' },
      data: { closesAt: new Date(Date.now() - 1000) },
    });

    const closed = await request(server)
      .get(`/api/sessions/${sessionId}/live`)
      .set(auth)
      .expect(200);
    expect(closed.body.phase).toBe('closed');
    expect(closed.body.results).toBeNull();
    expect(closed.body).not.toHaveProperty('correctOptionId');

    await request(server)
      .post('/api/join/votes')
      .set('Authorization', `Bearer ${ada.body.accessToken}`)
      .send({ optionId: four })
      .expect(409);

    const participantState = await request(server)
      .get('/api/join/live')
      .set('Authorization', `Bearer ${ada.body.accessToken}`)
      .expect(200);
    expect(participantState.body.phase).toBe('closed');
    expect(participantState.body.results).toBeNull();
    expect(participantState.body).not.toHaveProperty('correctOptionId');

    const published = await request(server)
      .post(`/api/sessions/${sessionId}/live/publish`)
      .set(auth)
      .expect(201);
    expect(published.body.phase).toBe('published');
    expect(published.body.correctOptionId).toBe(four);
    expect(published.body.results).toEqual(expect.any(Array));
  });
});
