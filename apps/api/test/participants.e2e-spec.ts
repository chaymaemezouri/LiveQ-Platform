import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Participant joining (e2e)', () => {
  let app: INestApplication;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const speaker = {
    email: `join-${suffix}@university.edu`,
    displayName: 'Join Speaker',
    password: 'correct-password-123',
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

  it('lets a participant join an active session and reconnect', async () => {
    const server = app.getHttpServer();
    const prisma = app.get(PrismaService);
    const registered = await request(server)
      .post('/api/auth/register')
      .send(speaker)
      .expect(201);
    userIds.push(registered.body.user.id as string);
    const token = registered.body.accessToken as string;

    const created = await request(server)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Live workshop' })
      .expect(201);
    const sessionId = created.body.id as string;
    const code = created.body.joinCode as string;

    await request(server).post('/api/join').send({ code }).expect(404);
    await request(server).post('/api/join').send({ code: 'NOPE' }).expect(400);
    await request(server).get('/api/join/me').expect(401);

    await request(server)
      .post(`/api/sessions/${sessionId}/activate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const anonymous = await request(server)
      .post('/api/join')
      .send({ code: code.toLowerCase() })
      .expect(201);
    expect(anonymous.body.accessToken).toEqual(expect.any(String));
    expect(anonymous.body.participant.nickname).toBeNull();
    expect(anonymous.body.session).toEqual({
      title: 'Live workshop',
      status: 'ACTIVE',
      participantCount: 1,
    });
    expect(JSON.stringify(anonymous.body)).not.toContain('tokenHash');
    expect(anonymous.body).not.toHaveProperty('questions');

    await request(server)
      .post('/api/join')
      .send({ code, nickname: 'Ada', ownerId: 'ignored' })
      .expect(400);

    const withName = await request(server)
      .post('/api/join')
      .send({ code, nickname: '  Ada  ' })
      .expect(201);
    expect(withName.body.participant.nickname).toBe('Ada');
    expect(withName.body.session.participantCount).toBe(2);

    const stored = await prisma.participant.findUnique({
      where: { id: anonymous.body.participant.id as string },
      select: { tokenHash: true },
    });
    expect(stored?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored?.tokenHash).not.toBe(anonymous.body.accessToken);

    const reconnected = await request(server)
      .get('/api/join/me')
      .set('Authorization', `Bearer ${anonymous.body.accessToken}`)
      .expect(200);
    expect(reconnected.body.participant.id).toBe(anonymous.body.participant.id);
    expect(reconnected.body).not.toHaveProperty('accessToken');
    expect(reconnected.body.session.participantCount).toBe(2);

    const speakerView = await request(server)
      .get(`/api/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(speakerView.body.participantCount).toBe(2);

    await request(server)
      .post(`/api/sessions/${sessionId}/end`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    await request(server).post('/api/join').send({ code }).expect(409);
    const afterEnd = await request(server)
      .get('/api/join/me')
      .set('Authorization', `Bearer ${anonymous.body.accessToken}`)
      .expect(200);
    expect(afterEnd.body.session.status).toBe('ENDED');

    await request(server).post('/api/join').send({ code: 'ZZZZZZZZ' }).expect(404);
  });
});
