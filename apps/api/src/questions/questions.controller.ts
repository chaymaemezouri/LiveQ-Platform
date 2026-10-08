import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QuestionContentDto } from './dto/question-content.dto';
import { ReorderQuestionsDto } from './dto/reorder-questions.dto';
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
}
