import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const create = vi.fn();
  const findUnique = vi.fn();
  const update = vi.fn();
  const signAsync = vi.fn().mockResolvedValue('signed-token');
  const prisma = { user: { create, findUnique, update } } as unknown as PrismaService;
  const jwtService = { signAsync } as unknown as JwtService;
  const service = new AuthService(prisma, jwtService);

  beforeEach(() => {
    create.mockReset();
    findUnique.mockReset();
    update.mockReset();
    signAsync.mockClear();
  });

  it('stores an Argon2 hash and returns no password material', async () => {
    create.mockResolvedValue({
      id: 'user-1',
      email: 'ada@university.edu',
      displayName: 'Ada Lovelace',
    });

    const result = await service.register({
      email: 'Ada@University.edu',
      displayName: 'Ada Lovelace',
      password: 'correct-password-123',
    });

    expect(result.accessToken).toBe('signed-token');
    expect(result.user).toEqual({
      id: 'user-1',
      email: 'ada@university.edu',
      displayName: 'Ada Lovelace',
    });
    expect(result).not.toHaveProperty('passwordHash');
    const savedHash = create.mock.calls[0]?.[0].data.passwordHash as string;
    expect(savedHash.startsWith('$argon2')).toBe(true);
    expect(savedHash).not.toContain('correct-password-123');
    expect(create.mock.calls[0]?.[0].data.email).toBe('ada@university.edu');
  });

  it('rejects a duplicate email', async () => {
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.register({
        email: 'ada@university.edu',
        displayName: 'Ada',
        password: 'correct-password-123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects an incorrect password without returning the stored hash', async () => {
    const passwordHash = await hash('correct-password-123');
    findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'ada@university.edu',
      displayName: 'Ada',
      passwordHash,
    });

    await expect(
      service.login({ email: 'ada@university.edu', password: 'wrong-password-123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(signAsync).not.toHaveBeenCalled();
  });

  it('issues a token for a matching password', async () => {
    const passwordHash = await hash('correct-password-123');
    findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'ada@university.edu',
      displayName: 'Ada',
      passwordHash,
    });

    const result = await service.login({
      email: 'ada@university.edu',
      password: 'correct-password-123',
    });

    expect(result.user).toEqual({
      id: 'user-1',
      email: 'ada@university.edu',
      displayName: 'Ada',
    });
    expect(JSON.stringify(result)).not.toContain(passwordHash);
    expect(signAsync).toHaveBeenCalledWith(
      { sub: 'user-1' },
      { expiresIn: 60 * 60 * 12 },
    );
  });

  it('replaces the password only when the email belongs to an account', async () => {
    findUnique.mockResolvedValueOnce(null);
    await expect(
      service.resetPassword({
        email: 'missing@university.edu',
        password: 'new-password-123',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(update).not.toHaveBeenCalled();

    findUnique.mockResolvedValueOnce({ id: 'user-1' });
    update.mockResolvedValue({ id: 'user-1' });

    await expect(
      service.resetPassword({
        email: 'Ada@University.edu',
        password: 'new-password-123',
      }),
    ).resolves.toEqual({ reset: true });

    const savedHash = update.mock.calls[0]?.[0].data.passwordHash as string;
    expect(update.mock.calls[0]?.[0].where).toEqual({ id: 'user-1' });
    expect(savedHash.startsWith('$argon2')).toBe(true);
    expect(await verify(savedHash, 'new-password-123')).toBe(true);
    expect(savedHash).not.toContain('new-password-123');
  });
});
