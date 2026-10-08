import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ParticipantsModule } from '../participants/participants.module';
import { LiveController, ParticipantLiveController } from './live.controller';
import { LiveGateway } from './live.gateway';
import { LiveService } from './live.service';

@Module({
  imports: [AuthModule, ParticipantsModule],
  controllers: [LiveController, ParticipantLiveController],
  providers: [LiveService, LiveGateway],
  exports: [LiveService],
})
export class LiveModule {}
