import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from './authenticated-user';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60 * 12;

export interface AuthResult {
  accessToken: string;
  user: AuthenticatedUser;
}

@Injectable()
export class AuthService {
  private dummyPasswordHash: Promise<string> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const email = dto.email.toLowerCase();
    const passwordHash = await hash(dto.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          displayName: dto.displayName,
          passwordHash,
        },
        select: { id: true, email: true, displayName: true },
      });
      return this.issue(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('An account with this email already exists.');
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, displayName: true, passwordHash: true },
    });

    const passwordHash = user?.passwordHash ?? (await this.placeholderHash());
    const passwordMatches = await verify(passwordHash, dto.password);
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Email or password is incorrect.');
    }

    return this.issue({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    });
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ reset: true }> {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('No speaker account uses this email.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hash(dto.password) },
    });
    return { reset: true };
  }

  private issue(user: AuthenticatedUser): Promise<AuthResult> {
    return this.jwtService
      .signAsync({ sub: user.id }, { expiresIn: ACCESS_TOKEN_TTL_SECONDS })
      .then((accessToken) => ({ accessToken, user }));
  }

  private placeholderHash(): Promise<string> {
    this.dummyPasswordHash ??= hash('liveq-timing-placeholder');
    return this.dummyPasswordHash;
  }
}
