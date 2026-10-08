import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LiveModule } from '../live/live.module';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  imports: [AuthModule, LiveModule],
  controllers: [SessionsController],
  providers: [SessionsService],
})
export class SessionsModule {}
