import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSessionDto } from './dto/create-session.dto';
import type { UpdateSessionDto } from './dto/update-session.dto';
import { LiveService } from '../live/live.service';
import { createJoinCode } from './join-code';
import {
  presentSession,
  type SessionRecord,
  type SessionView,
} from './session.presenter';

const sessionSelect = {
  id: true,
  title: true,
  description: true,
  joinCode: true,
  status: true,
  scheduledStartAt: true,
  scheduledEndAt: true,
  startedAt: true,
  endedAt: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { participants: true } },
} satisfies Prisma.SessionSelect;

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly liveService: LiveService,
  ) {}

  async list(ownerId: string): Promise<SessionView[]> {
    const sessions = await this.prisma.session.findMany({
      where: { ownerId },
      select: sessionSelect,
      orderBy: { updatedAt: 'desc' },
    });
    return sessions.map((session) => this.present(session));
  }

  async get(ownerId: string, sessionId: string): Promise<SessionView> {
    return this.present(await this.requireOwned(ownerId, sessionId));
  }

  async create(ownerId: string, dto: CreateSessionDto): Promise<SessionView> {
    const scheduledStartAt = this.parseOptionalDate(dto.scheduledStartAt);
    const scheduledEndAt = this.parseOptionalDate(dto.scheduledEndAt);
    this.assertDateOrder(scheduledStartAt, scheduledEndAt);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const session = await this.prisma.session.create({
          data: {
            ownerId,
            title: dto.title,
            description: this.blankToNull(dto.description),
            joinCode: createJoinCode(),
            scheduledStartAt,
            scheduledEndAt,
          },
          select: sessionSelect,
        });
        return this.present(session);
      } catch (error) {
        if (this.isJoinCodeConflict(error) && attempt < 4) {
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException('A participation code could not be reserved.');
  }

  async update(
    ownerId: string,
    sessionId: string,
    dto: UpdateSessionDto,
  ): Promise<SessionView> {
    const current = await this.requireOwned(ownerId, sessionId);
    if (current.status === 'ENDED') {
      throw new ConflictException('Ended sessions cannot be edited.');
    }

    const scheduledStartAt = this.resolveDate(
      dto.scheduledStartAt,
      current.scheduledStartAt,
    );
    const scheduledEndAt = this.resolveDate(dto.scheduledEndAt, current.scheduledEndAt);
    this.assertDateOrder(scheduledStartAt, scheduledEndAt);

    const updated = await this.prisma.session.updateMany({
      where: { id: sessionId, ownerId, status: { not: 'ENDED' } },
      data: {
        title: dto.title,
        description:
          dto.description === undefined ? undefined : this.blankToNull(dto.description),
        scheduledStartAt:
          dto.scheduledStartAt === undefined ? undefined : scheduledStartAt,
        scheduledEndAt: dto.scheduledEndAt === undefined ? undefined : scheduledEndAt,
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException('Ended sessions cannot be edited.');
    }
    return this.get(ownerId, sessionId);
  }

  async activate(ownerId: string, sessionId: string): Promise<SessionView> {
    const current = await this.requireOwned(ownerId, sessionId);
    if (current.status !== 'DRAFT') {
      throw new ConflictException('Only a draft session can be activated.');
    }

    const updated = await this.prisma.session.updateMany({
      where: { id: sessionId, ownerId, status: 'DRAFT' },
      data: { status: 'ACTIVE', startedAt: new Date() },
    });
    if (updated.count !== 1) {
      throw new ConflictException('Only a draft session can be activated.');
    }
    return this.get(ownerId, sessionId);
  }

  async end(ownerId: string, sessionId: string): Promise<SessionView> {
    const current = await this.requireOwned(ownerId, sessionId);
    if (current.status !== 'ACTIVE') {
      throw new ConflictException('Only an active session can be ended.');
    }

    const updated = await this.prisma.session.updateMany({
      where: { id: sessionId, ownerId, status: 'ACTIVE' },
      data: { status: 'ENDED', endedAt: new Date() },
    });
    if (updated.count !== 1) {
      throw new ConflictException('Only an active session can be ended.');
    }
    await this.liveService.onSessionEnded(sessionId);
    return this.get(ownerId, sessionId);
  }

  async remove(ownerId: string, sessionId: string): Promise<void> {
    const result = await this.prisma.session.deleteMany({
      where: { id: sessionId, ownerId },
    });
    if (result.count === 0) {
      throw new NotFoundException('Session not found.');
    }
  }

  private async requireOwned(
    ownerId: string,
    sessionId: string,
  ): Promise<SessionRecord> {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, ownerId },
      select: sessionSelect,
    });
    if (!session) {
      throw new NotFoundException('Session not found.');
    }
    return session;
  }

  private present(
    session: SessionRecord & { _count?: { participants: number } },
  ): SessionView {
    return presentSession(
      session,
      this.config.getOrThrow<string>('WEB_ORIGIN'),
      session._count?.participants ?? 0,
    );
  }

  private parseOptionalDate(value: string | null | undefined): Date | null {
    if (value == null || value === '') {
      return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Enter a valid date.');
    }
    return date;
  }

  private resolveDate(
    next: string | null | undefined,
    current: Date | null,
  ): Date | null {
    if (next === undefined) {
      return current;
    }
    return this.parseOptionalDate(next);
  }

  private assertDateOrder(start: Date | null, end: Date | null): void {
    if (start && end && end.getTime() <= start.getTime()) {
      throw new BadRequestException('The end time must be after the start time.');
    }
  }

  private blankToNull(value: string | null | undefined): string | null {
    if (value == null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private isJoinCodeConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
    );
  }
}
