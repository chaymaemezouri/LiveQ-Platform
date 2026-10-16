import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ImportQuestionsDto } from './dto/import-questions.dto';
import { QuestionContentDto } from './dto/question-content.dto';
import { ReorderQuestionsDto } from './dto/reorder-questions.dto';
import { buildQuestionTemplate, previewQuestionWorkbook } from './question-import';
import { QuestionsService } from './questions.service';

@Controller('sessions/:sessionId/questions')
@UseGuards(JwtAuthGuard)
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.questionsService.list(user.id, sessionId);
  }

  @Get('import/template')
  async template(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<StreamableFile> {
    await this.questionsService.getImportAccess(user.id, sessionId);
    const file = await buildQuestionTemplate();
    return new StreamableFile(file, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="liveq-questions.xlsx"',
    });
  }

  @Post('import/preview')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @UploadedFile() file?: { buffer: Buffer; originalname?: string },
  ) {
    return this.previewFile(user.id, sessionId, file);
  }

  @Post('import')
  importQuestions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: ImportQuestionsDto,
  ) {
    return this.questionsService.importQuestions(
      user.id,
      sessionId,
      dto.requestId,
      dto.questions,
    );
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: QuestionContentDto,
  ) {
    return this.questionsService.create(user.id, sessionId, dto);
  }

  @Patch('reorder')
  reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: ReorderQuestionsDto,
  ) {
    return this.questionsService.reorder(user.id, sessionId, dto.questionIds);
  }

  @Get(':questionId')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
  ) {
    return this.questionsService.get(user.id, sessionId, questionId);
  }

  @Patch(':questionId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: QuestionContentDto,
  ) {
    return this.questionsService.update(user.id, sessionId, questionId, dto);
  }

  @Delete(':questionId')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
  ) {
    return this.questionsService.remove(user.id, sessionId, questionId);
  }

  private async previewFile(
    ownerId: string,
    sessionId: string,
    file?: { buffer: Buffer; originalname?: string },
  ) {
    await this.questionsService.getImportAccess(ownerId, sessionId);
    const name = file?.originalname?.toLowerCase() ?? '';
    if (!file?.buffer?.length || !name.endsWith('.xlsx')) {
      throw new BadRequestException('Choose an Excel .xlsx file.');
    }
    return previewQuestionWorkbook(file.buffer);
  }
}
