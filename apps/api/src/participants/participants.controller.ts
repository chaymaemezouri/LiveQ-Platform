import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentParticipant } from './current-participant.decorator';
import { JoinSessionDto } from './dto/join-session.dto';
import { ParticipantAuthGuard } from './participant-auth.guard';
import type { ParticipantIdentity } from './participant.presenter';
import { ParticipantsService } from './participants.service';

@Controller('join')
export class ParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  @Post()
  join(@Body() dto: JoinSessionDto) {
    return this.participantsService.join(dto);
  }

  @Get('me')
  @UseGuards(ParticipantAuthGuard)
  me(@CurrentParticipant() participant: ParticipantIdentity) {
    return this.participantsService.reconnect(participant.id);
  }
}
