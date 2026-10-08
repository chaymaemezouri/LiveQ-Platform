import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Conference reports (e2e)', () => {
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

  it('keeps unpublished answers hidden, then exports the finished conference', async () => {
    const server = app.getHttpServer();
    const registered = await request(server)
      .post('/api/auth/register')
      .send({
        email: `report-${suffix}@university.edu`,
        displayName: 'Report Speaker',
        password: 'correct-password-123',
      })
      .expect(201);
    userIds.push(registered.body.user.id as string);
    const auth = { Authorization: `Bearer ${registered.body.accessToken as string}` };

    const other = await request(server)
      .post('/api/auth/register')
      .send({
        email: `other-${suffix}@university.edu`,
        displayName: 'Other Speaker',
        password: 'correct-password-123',
      })
      .expect(201);
    userIds.push(other.body.user.id as string);
    const otherAuth = { Authorization: `Bearer ${other.body.accessToken as string}` };

    const created = await request(server)
      .post('/api/sessions')
      .set(auth)
      .send({ title: 'Analytics workshop' })
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

    await request(server)
      .post(`/api/sessions/${sessionId}/live/launch`)
      .set(auth)
      .send({ questionId: graded.body.id })
      .expect(201);
    await request(server)
      .post('/api/join/votes')
      .set('Authorization', `Bearer ${ada.body.accessToken}`)
      .send({ optionId: four })
      .expect(201);
    await request(server)
      .post('/api/join/votes')
      .set('Authorization', `Bearer ${grace.body.accessToken}`)
      .send({ optionId: graded.body.options[0].id })
      .expect(201);

    const hidden = await request(server)
      .get(`/api/reports/${sessionId}`)
      .set(auth)
      .expect(200);
    expect(hidden.body.participationPercent).toBe(100);
    expect(hidden.body.votingPercent).toBe(100);
    expect(hidden.body.correctPercent).toBeNull();
    expect(hidden.body.questions[0].options).toEqual([]);
    expect(hidden.body.questions[0].correctOptionId).toBeNull();
    expect(JSON.stringify(hidden.body)).not.toContain(four);

    await request(server).get(`/api/reports/${sessionId}`).set(otherAuth).expect(404);
    await request(server).get(`/api/reports/${sessionId}/export.pdf`).expect(401);

    await request(server)
      .post(`/api/sessions/${sessionId}/live/close`)
      .set(auth)
      .expect(201);
    await request(server)
      .post(`/api/sessions/${sessionId}/live/publish`)
      .set(auth)
      .expect(201);
    await request(server)
      .post(`/api/sessions/${sessionId}/live/next`)
      .set(auth)
      .expect(201);
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
    await request(server)
      .post(`/api/sessions/${sessionId}/live/close`)
      .set(auth)
      .expect(201);
    await request(server)
      .post(`/api/sessions/${sessionId}/live/publish`)
      .set(auth)
      .expect(201);
    await request(server).post(`/api/sessions/${sessionId}/end`).set(auth).expect(201);

    const published = await request(server)
      .get(`/api/reports/${sessionId}`)
      .set(auth)
      .expect(200);
    expect(published.body.status).toBe('ENDED');
    expect(published.body.correctPercent).toBe(50);
    expect(published.body.questions[0].correctOptionId).toBe(four);
    expect(published.body.questions[0].options).toEqual([
      expect.objectContaining({ label: '3', count: 1, percent: 50 }),
      expect.objectContaining({ label: '4', count: 1, percent: 50 }),
    ]);
    expect(published.body.questions[1].correctOptionId).toBeNull();
    expect(published.body.questions[1].correctPercent).toBeNull();

    const listed = await request(server).get('/api/reports').set(auth).expect(200);
    expect(listed.body).toEqual([
      expect.objectContaining({
        sessionId,
        title: 'Analytics workshop',
        status: 'ENDED',
        participationPercent: 100,
        votingPercent: 100,
        correctPercent: 50,
      }),
    ]);
    const empty = await request(server).get('/api/reports').set(otherAuth).expect(200);
    expect(empty.body).toEqual([]);

    const pdf = await request(server)
      .get(`/api/reports/${sessionId}/export.pdf`)
      .set(auth)
      .expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.headers['content-disposition']).toContain(
      'liveq-analytics-workshop.pdf',
    );
    expect(pdf.body.subarray(0, 5).toString('ascii')).toBe('%PDF-');

    const workbook = await request(server)
      .get(`/api/reports/${sessionId}/export.xlsx`)
      .set(auth)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(workbook.headers['content-type']).toContain('spreadsheetml.sheet');
    expect(workbook.body.subarray(0, 2).toString('ascii')).toBe('PK');
  });
});
