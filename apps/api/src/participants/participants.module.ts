import { Module } from '@nestjs/common';
import { ParticipantAuthGuard } from './participant-auth.guard';
import { ParticipantsController } from './participants.controller';
import { ParticipantsService } from './participants.service';

@Module({
  controllers: [ParticipantsController],
  providers: [ParticipantsService, ParticipantAuthGuard],
  exports: [ParticipantAuthGuard],
})
export class ParticipantsModule {}
