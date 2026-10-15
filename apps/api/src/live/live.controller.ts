import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentParticipant } from '../participants/current-participant.decorator';
import { ParticipantAuthGuard } from '../participants/participant-auth.guard';
import type { ParticipantIdentity } from '../participants/participant.presenter';
import { CastVoteDto } from './dto/cast-vote.dto';
import { LaunchQuestionDto } from './dto/launch-question.dto';
import { NextQuestionDto } from './dto/next-question.dto';
import { LiveService } from './live.service';

@Controller('sessions/:sessionId/live')
@UseGuards(JwtAuthGuard)
export class LiveController {
  constructor(private readonly liveService: LiveService) {}

  @Get()
  state(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.liveService.speakerState(user.id, sessionId);
  }

  @Post('launch')
  launch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: LaunchQuestionDto,
  ) {
    return this.liveService.launch(
      user.id,
      sessionId,
      dto.questionId,
      dto.timerSeconds ?? null,
    );
  }

  @Post('close')
  close(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.liveService.close(user.id, sessionId);
  }

  @Post('publish')
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.liveService.publish(user.id, sessionId);
  }

  @Post('next')
  next(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: NextQuestionDto,
  ) {
    return this.liveService.next(user.id, sessionId, dto.timerSeconds ?? null);
  }
}

@Controller('join')
@UseGuards(ParticipantAuthGuard)
export class ParticipantLiveController {
  constructor(private readonly liveService: LiveService) {}

  @Get('live')
  state(@CurrentParticipant() participant: ParticipantIdentity) {
    return this.liveService.participantState(participant.id, participant.sessionId);
  }

  @Get('review')
  review(@CurrentParticipant() participant: ParticipantIdentity) {
    return this.liveService.participantReview(participant.id, participant.sessionId);
  }

  @Post('votes')
  vote(
    @CurrentParticipant() participant: ParticipantIdentity,
    @Body() dto: CastVoteDto,
  ) {
    return this.liveService.cast(participant.id, participant.sessionId, dto);
  }
}
