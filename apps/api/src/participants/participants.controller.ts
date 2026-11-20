import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { clientAddress } from '../common/client-address';
import { CurrentParticipant } from './current-participant.decorator';
import { JoinSessionDto } from './dto/join-session.dto';
import { ParticipantAuthGuard } from './participant-auth.guard';
import type { ParticipantIdentity } from './participant.presenter';
import { ParticipantsService } from './participants.service';

@Controller('join')
export class ParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  @Post()
  join(@Body() dto: JoinSessionDto, @Req() request: Request) {
    return this.participantsService.join(dto, clientAddress(request));
  }

  @Get('me')
  @UseGuards(ParticipantAuthGuard)
  me(@CurrentParticipant() participant: ParticipantIdentity) {
    return this.participantsService.reconnect(participant.id);
  }
}
