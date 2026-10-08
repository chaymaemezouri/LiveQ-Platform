import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReportsController } from './report.controller';
import { ReportsService } from './report.service';

@Module({
  imports: [AuthModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
