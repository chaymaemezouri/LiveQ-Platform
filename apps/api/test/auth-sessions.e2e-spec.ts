import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Authentication and sessions (e2e)', () => {
  let app: INestApplication;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const speaker = {
    email: `speaker-${suffix}@university.edu`,
    displayName: 'Speaker One',
    password: 'correct-password-123',
  };
  const other = {
    email: `other-${suffix}@university.edu`,
    displayName: 'Speaker Two',
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

  it('registers, signs in, and keeps another speaker out of the session', async () => {
    const server = app.getHttpServer();

    const registered = await request(server)
      .post('/api/auth/register')
      .send(speaker)
      .expect(201);
    expect(registered.body.user.email).toBe(speaker.email);
    expect(registered.body.accessToken).toEqual(expect.any(String));
    expect(JSON.stringify(registered.body)).not.toContain('passwordHash');
    expect(JSON.stringify(registered.body)).not.toContain(speaker.password);
    userIds.push(registered.body.user.id as string);

    await request(server)
      .post('/api/auth/register')
      .send({ ...speaker, displayName: 'Duplicate' })
      .expect(409);

    await request(server)
      .post('/api/auth/login')
      .send({ email: speaker.email, password: 'wrong-password-123' })
      .expect(401);

    const signedIn = await request(server)
      .post('/api/auth/login')
      .send({ email: speaker.email.toUpperCase(), password: speaker.password })
      .expect(200);
    const token = signedIn.body.accessToken as string;

    const me = await request(server)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.body).toEqual({
      id: registered.body.user.id,
      email: speaker.email,
      displayName: speaker.displayName,
    });

    await request(server).get('/api/sessions').expect(401);
    await request(server)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Lecture', ownerId: other.email })
      .expect(400);

    const created = await request(server)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Quantum lecture',
        description: 'Opening session',
        scheduledStartAt: '2026-11-01T09:00:00.000Z',
        scheduledEndAt: '2026-11-01T10:00:00.000Z',
      })
      .expect(201);
    expect(created.body.status).toBe('DRAFT');
    expect(created.body.joinCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    const webOrigin = (process.env.WEB_ORIGIN ?? 'http://localhost:5173').replace(
      /\/$/,
      '',
    );
    expect(created.body.joinUrl).toBe(`${webOrigin}/join/${created.body.joinCode}`);
    expect(created.body).not.toHaveProperty('ownerId');

    const otherAccount = await request(server)
      .post('/api/auth/register')
      .send(other)
      .expect(201);
    userIds.push(otherAccount.body.user.id as string);
    const otherToken = otherAccount.body.accessToken as string;

    await request(server)
      .get(`/api/sessions/${created.body.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);

    const ownList = await request(server)
      .get('/api/sessions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const otherList = await request(server)
      .get('/api/sessions')
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);
    expect(ownList.body).toHaveLength(1);
    expect(otherList.body).toHaveLength(0);

    const activated = await request(server)
      .post(`/api/sessions/${created.body.id}/activate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(activated.body.status).toBe('ACTIVE');

    const ended = await request(server)
      .post(`/api/sessions/${created.body.id}/end`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(ended.body.status).toBe('ENDED');

    await request(server)
      .delete(`/api/sessions/${created.body.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);

    await request(server)
      .delete(`/api/sessions/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
  });
});
