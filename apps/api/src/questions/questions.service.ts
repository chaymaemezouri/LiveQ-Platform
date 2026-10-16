import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ImportQuestionItemDto } from './dto/import-questions.dto';
import type { QuestionContentDto } from './dto/question-content.dto';
import {
  presentQuestion,
  type QuestionRecord,
  type QuestionView,
} from './question.presenter';

const questionInclude = {
  options: { orderBy: { position: 'asc' as const } },
  correctAnswer: { select: { optionId: true } },
} satisfies Prisma.QuestionInclude;

type QuestionDb = Prisma.TransactionClient | PrismaService;

const lockedMessage = 'This question already has votes and cannot be changed.';

@Injectable()
export class QuestionsService {
  private readonly runningImports = new Set<string>();
  private readonly completedImports = new Map<string, QuestionView[]>();

  constructor(private readonly prisma: PrismaService) {}

  async list(ownerId: string, sessionId: string): Promise<QuestionView[]> {
    await this.requireSession(this.prisma, ownerId, sessionId);
    const questions = await this.prisma.question.findMany({
      where: { sessionId },
      include: questionInclude,
      orderBy: { position: 'asc' },
    });
    const votedIds = await this.votedQuestionIds(
      this.prisma,
      sessionId,
      questions.map((question) => question.id),
    );
    return questions.map((question) =>
      presentQuestion(question, votedIds.has(question.id)),
    );
  }

  async get(
    ownerId: string,
    sessionId: string,
    questionId: string,
  ): Promise<QuestionView> {
    return this.load(this.prisma, ownerId, sessionId, questionId);
  }

  async create(
    ownerId: string,
    sessionId: string,
    dto: QuestionContentDto,
  ): Promise<QuestionView> {
    const content = this.assertContent(dto);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction((tx) =>
          this.insert(tx, ownerId, sessionId, dto, content),
        );
      } catch (error) {
        if (this.isPositionConflict(error) && attempt < 2) {
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException('The question could not be placed in order.');
  }

  async update(
    ownerId: string,
    sessionId: string,
    questionId: string,
    dto: QuestionContentDto,
  ): Promise<QuestionView> {
    const content = this.assertContent(dto);

    return this.prisma.$transaction(async (tx) => {
      await this.requireEditable(tx, ownerId, sessionId, questionId);
      await tx.correctAnswer.deleteMany({ where: { questionId } });
      await tx.questionOption.deleteMany({ where: { questionId } });
      await tx.question.update({
        where: { id: questionId },
        data: { prompt: dto.prompt, kind: content.kind },
      });
      if (content.kind === 'CHOICE') {
        await this.createOptions(tx, questionId, dto.options ?? [], content.correctIndex);
      }
      return this.load(tx, ownerId, sessionId, questionId);
    });
  }

  async reorder(
    ownerId: string,
    sessionId: string,
    questionIds: string[],
  ): Promise<QuestionView[]> {
    await this.prisma.$transaction(async (tx) => {
      await this.requireSession(tx, ownerId, sessionId);
      const existing = await tx.question.findMany({
        where: { sessionId },
        select: { id: true, position: true },
        orderBy: { position: 'asc' },
      });
      if (
        !isPermutation(
          existing.map((question) => question.id),
          questionIds,
        )
      ) {
        throw new BadRequestException(
          'The order must include every question in the session once.',
        );
      }

      for (const question of existing) {
        await tx.question.update({
          where: { id: question.id },
          data: { position: -question.position },
        });
      }
      for (let index = 0; index < questionIds.length; index += 1) {
        await tx.question.update({
          where: { id: questionIds[index] },
          data: { position: index + 1 },
        });
      }
    });

    return this.list(ownerId, sessionId);
  }

  async remove(ownerId: string, sessionId: string, questionId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.requireEditable(tx, ownerId, sessionId, questionId);
      await tx.question.delete({ where: { id: questionId } });
      const remaining = await tx.question.findMany({
        where: { sessionId },
        select: { id: true, position: true },
        orderBy: { position: 'asc' },
      });
      for (let index = 0; index < remaining.length; index += 1) {
        const question = remaining[index];
        const position = index + 1;
        if (question && question.position !== position) {
          await tx.question.update({
            where: { id: question.id },
            data: { position },
          });
        }
      }
    });
  }

  async getImportAccess(ownerId: string, sessionId: string): Promise<void> {
    await this.requireMutableSession(this.prisma, ownerId, sessionId);
  }

  async importQuestions(
    ownerId: string,
    sessionId: string,
    requestId: string,
    questions: ImportQuestionItemDto[],
  ): Promise<QuestionView[]> {
    const cached = this.completedImports.get(this.importKey(sessionId, requestId));
    if (cached) {
      return cached;
    }
    if (this.runningImports.has(sessionId)) {
      throw new ConflictException('An import is already running for this session.');
    }

    for (const question of questions) {
      question.prompt = question.prompt.trim();
      question.options = question.options?.map((option) => ({
        label: option.label.trim(),
      }));
    }
    const errors = questions.flatMap((question) => this.importError(question));
    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }

    this.runningImports.add(sessionId);
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        await this.requireMutableSession(tx, ownerId, sessionId);
        const saved: QuestionView[] = [];
        for (const question of questions) {
          const content = this.assertContent(question);
          saved.push(await this.insert(tx, ownerId, sessionId, question, content));
        }
        return saved;
      });
      this.completedImports.set(this.importKey(sessionId, requestId), created);
      return created;
    } finally {
      this.runningImports.delete(sessionId);
    }
  }

  private async insert(
    tx: Prisma.TransactionClient,
    ownerId: string,
    sessionId: string,
    dto: QuestionContentDto,
    content: { kind: 'CHOICE' | 'TEXT'; correctIndex: number | null },
  ): Promise<QuestionView> {
    await this.requireSession(tx, ownerId, sessionId);
    const maxPosition = await tx.question.aggregate({
      where: { sessionId },
      _max: { position: true },
    });
    const created = await tx.question.create({
      data: {
        sessionId,
        prompt: dto.prompt,
        kind: content.kind,
        position: (maxPosition._max.position ?? 0) + 1,
      },
      select: { id: true },
    });
    if (content.kind === 'CHOICE') {
      await this.createOptions(tx, created.id, dto.options ?? [], content.correctIndex);
    }
    return this.load(tx, ownerId, sessionId, created.id);
  }

  private async createOptions(
    tx: Prisma.TransactionClient,
    questionId: string,
    options: { label: string }[],
    correctIndex: number | null,
  ): Promise<void> {
    const optionIds: string[] = [];
    for (const [index, optionInput] of options.entries()) {
      const option = await tx.questionOption.create({
        data: {
          questionId,
          label: optionInput.label,
          position: index + 1,
        },
        select: { id: true },
      });
      optionIds.push(option.id);
    }

    const correctOptionId = correctIndex == null ? null : optionIds[correctIndex];
    if (correctOptionId) {
      await tx.correctAnswer.create({
        data: { questionId, optionId: correctOptionId },
      });
    }
  }

  private async requireEditable(
    tx: Prisma.TransactionClient,
    ownerId: string,
    sessionId: string,
    questionId: string,
  ): Promise<void> {
    await this.requireSession(tx, ownerId, sessionId);
    const question = await tx.question.findFirst({
      where: { id: questionId, sessionId },
      select: { id: true },
    });
    if (!question) {
      throw new NotFoundException('Question not found.');
    }
    const votes = await tx.vote.count({ where: { questionId, sessionId } });
    if (votes > 0) {
      throw new ConflictException(lockedMessage);
    }
  }

  private async load(
    db: QuestionDb,
    ownerId: string,
    sessionId: string,
    questionId: string,
  ): Promise<QuestionView> {
    await this.requireSession(db, ownerId, sessionId);
    const question = await db.question.findFirst({
      where: { id: questionId, sessionId },
      include: questionInclude,
    });
    if (!question) {
      throw new NotFoundException('Question not found.');
    }
    const votes = await db.vote.count({ where: { questionId, sessionId } });
    return presentQuestion(question as QuestionRecord, votes > 0);
  }

  private async requireSession(
    db: QuestionDb,
    ownerId: string,
    sessionId: string,
  ): Promise<void> {
    const session = await db.session.findFirst({
      where: { id: sessionId, ownerId },
      select: { id: true },
    });
    if (!session) {
      throw new NotFoundException('Session not found.');
    }
  }

  private async requireMutableSession(
    db: QuestionDb,
    ownerId: string,
    sessionId: string,
  ): Promise<void> {
    const session = await db.session.findFirst({
      where: { id: sessionId, ownerId },
      select: { id: true, status: true },
    });
    if (!session) {
      throw new NotFoundException('Session not found.');
    }
    if (session.status === 'ENDED') {
      throw new ConflictException('Ended sessions cannot be edited.');
    }
  }

  private importKey(sessionId: string, requestId: string): string {
    return `${sessionId}:${requestId}`;
  }

  private importError(question: ImportQuestionItemDto): string[] {
    if (!question.prompt.trim()) {
      return [`Row ${question.row}: Question text is required.`];
    }
    try {
      this.assertContent(question);
      return [];
    } catch (error) {
      if (error instanceof BadRequestException) {
        const response = error.getResponse();
        const message =
          typeof response === 'string'
            ? response
            : typeof response === 'object' &&
                response &&
                'message' in response &&
                typeof response.message === 'string'
              ? response.message
              : 'This question is not valid.';
        return [`Row ${question.row}: ${message}`];
      }
      throw error;
    }
  }

  private async votedQuestionIds(
    db: QuestionDb,
    sessionId: string,
    questionIds: string[],
  ): Promise<Set<string>> {
    if (questionIds.length === 0) {
      return new Set();
    }
    const rows = await db.vote.groupBy({
      by: ['questionId'],
      where: { sessionId, questionId: { in: questionIds } },
    });
    return new Set(rows.map((row) => row.questionId));
  }

  private assertContent(dto: QuestionContentDto): {
    kind: 'CHOICE' | 'TEXT';
    correctIndex: number | null;
  } {
    if (dto.kind === 'TEXT') {
      if ((dto.options?.length ?? 0) > 0 || dto.correctOptionIndex != null) {
        throw new BadRequestException('A written question does not use options.');
      }
      return { kind: 'TEXT', correctIndex: null };
    }
    return {
      kind: 'CHOICE',
      correctIndex: this.assertCorrectIndex(dto.correctOptionIndex, dto.options?.length ?? 0),
    };
  }

  private assertCorrectIndex(
    index: number | null | undefined,
    optionCount: number,
  ): number | null {
    if (index == null) {
      return null;
    }
    if (!Number.isInteger(index) || index < 0 || index >= optionCount) {
      throw new BadRequestException('The correct option must be one of the answers.');
    }
    return index;
  }

  private isPositionConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
    );
  }
}

function isPermutation(existing: string[], requested: string[]): boolean {
  if (existing.length !== requested.length) {
    return false;
  }
  const remaining = new Map<string, number>();
  for (const id of existing) {
    remaining.set(id, (remaining.get(id) ?? 0) + 1);
  }
  for (const id of requested) {
    const count = remaining.get(id) ?? 0;
    if (count === 0) {
      return false;
    }
    remaining.set(id, count - 1);
  }
  return true;
}
