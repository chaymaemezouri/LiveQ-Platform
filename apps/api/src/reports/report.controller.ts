import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Readable } from 'node:stream';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportsService } from './report.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.list(user.id);
  }

  @Get(':sessionId/export.pdf')
  async pdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<StreamableFile> {
    const file = await this.reportsService.pdf(user.id, sessionId);
    return new StreamableFile(Readable.from(file.buffer), {
      type: 'application/pdf',
      disposition: `attachment; filename="${file.filename}"`,
    });
  }

  @Get(':sessionId/export.xlsx')
  async xlsx(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<StreamableFile> {
    const file = await this.reportsService.xlsx(user.id, sessionId);
    return new StreamableFile(Readable.from(file.buffer), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${file.filename}"`,
    });
  }

  @Get(':sessionId')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.reportsService.get(user.id, sessionId);
  }
}
