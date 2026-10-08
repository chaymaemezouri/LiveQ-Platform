import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { hashParticipantToken } from './participant-token';
import type { ParticipantIdentity } from './participant.presenter';

@Injectable()
export class ParticipantAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { participant?: ParticipantIdentity }>();
    const token = readBearerToken(request);
    if (!token) {
      throw new UnauthorizedException();
    }

    const participant = await this.prisma.participant.findUnique({
      where: { tokenHash: hashParticipantToken(token) },
      select: { id: true, sessionId: true, nickname: true },
    });
    if (!participant) {
      throw new UnauthorizedException();
    }

    request.participant = participant;
    return true;
  }
}

function readBearerToken(request: Request): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}
