import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { ParticipantIdentity } from './participant.presenter';

export const CurrentParticipant = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ParticipantIdentity => {
    const request = context
      .switchToHttp()
      .getRequest<Request & { participant?: ParticipantIdentity }>();
    if (!request.participant) {
      throw new UnauthorizedException();
    }
    return request.participant;
  },
);
