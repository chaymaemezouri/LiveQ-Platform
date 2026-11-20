import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { JoinSessionDto } from './dto/join-session.dto';
import type { JoinResult, ParticipantPresence } from './participant.presenter';
import { createParticipantToken, hashParticipantToken } from './participant-token';

const invalidCode = 'This joining code is not valid.';

@Injectable()
export class ParticipantsService {
  constructor(private readonly prisma: PrismaService) {}

  async join(dto: JoinSessionDto, ipAddress: string | null): Promise<JoinResult> {
    const session = await this.prisma.session.findUnique({
      where: { joinCode: dto.code },
      select: { id: true, title: true, status: true },
    });
    if (!session || session.status === 'DRAFT') {
      throw new NotFoundException(invalidCode);
    }
    if (session.status === 'ENDED') {
      throw new ConflictException('This session has ended.');
    }
    if (ipAddress) {
      const existing = await this.prisma.participant.findFirst({
        where: { sessionId: session.id, ipAddress },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException('This network already joined this session.');
      }
    }

    const accessToken = createParticipantToken();
    let participant: { id: string; nickname: string | null };
    try {
      participant = await this.prisma.participant.create({
        data: {
          sessionId: session.id,
          tokenHash: hashParticipantToken(accessToken),
          nickname: dto.nickname ?? null,
          ipAddress,
        },
        select: { id: true, nickname: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('This network already joined this session.');
      }
      throw error;
    }
    const participantCount = await this.prisma.participant.count({
      where: { sessionId: session.id },
    });

    return {
      accessToken,
      participant,
      session: {
        title: session.title,
        status: session.status,
        participantCount,
      },
    };
  }

  async reconnect(participantId: string): Promise<ParticipantPresence> {
    const participant = await this.prisma.participant.findUnique({
      where: { id: participantId },
      select: {
        id: true,
        nickname: true,
        session: { select: { id: true, title: true, status: true } },
      },
    });
    if (!participant) {
      throw new NotFoundException('This joining link is no longer valid.');
    }

    await this.prisma.participant.update({
      where: { id: participant.id },
      data: { lastSeenAt: new Date() },
    });
    const participantCount = await this.prisma.participant.count({
      where: { sessionId: participant.session.id },
    });

    return {
      participant: { id: participant.id, nickname: participant.nickname },
      session: {
        title: participant.session.title,
        status: participant.session.status,
        participantCount,
      },
    };
  }
}
