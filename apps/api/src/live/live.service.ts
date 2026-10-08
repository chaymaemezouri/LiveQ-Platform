import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '../generated/prisma/client';
import { hashParticipantToken } from '../participants/participant-token';
import { PrismaService } from '../prisma/prisma.service';
import type { CastVoteDto } from './dto/cast-vote.dto';
import { presentLiveState } from './live.presenter';
import type {
  LiveBroadcast,
  LiveIdentity,
  LivePublicState,
  LiveRunSource,
  ParticipantLiveState,
} from './live.types';

const runInclude = {
  question: {
    include: {
      options: { orderBy: { position: 'asc' as const } },
      correctAnswer: { select: { optionId: true } },
    },
  },
  votes: { select: { optionId: true, participantId: true } },
} satisfies Prisma.QuestionRunInclude;

@Injectable()
export class LiveService {
  private broadcast: LiveBroadcast = {
    state: () => undefined,
    votes: () => undefined,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  attach(broadcast: LiveBroadcast): void {
    this.broadcast = broadcast;
  }

  async authenticate(auth: Record<string, unknown> | undefined): Promise<LiveIdentity> {
    const token = typeof auth?.token === 'string' ? auth.token.trim() : '';
    if (!token) {
      throw new UnauthorizedException();
    }

    if (auth?.role === 'speaker') {
      const sessionId = typeof auth.sessionId === 'string' ? auth.sessionId : '';
      let userId = '';
      try {
        const payload = await this.jwtService.verifyAsync<{ sub?: string }>(token);
        userId = payload.sub ?? '';
      } catch {
        throw new UnauthorizedException();
      }
      if (!userId || !sessionId) {
        throw new UnauthorizedException();
      }
      const session = await this.prisma.session.findFirst({
        where: { id: sessionId, ownerId: userId },
        select: { id: true },
      });
      if (!session) {
        throw new UnauthorizedException();
      }
      return { role: 'speaker', sessionId, userId };
    }

    if (auth?.role === 'participant') {
      const participant = await this.prisma.participant.findUnique({
        where: { tokenHash: hashParticipantToken(token) },
        select: { id: true, sessionId: true },
      });
      if (!participant) {
        throw new UnauthorizedException();
      }
      return {
        role: 'participant',
        sessionId: participant.sessionId,
        participantId: participant.id,
      };
    }

    throw new UnauthorizedException();
  }

  snapshot(sessionId: string): Promise<LivePublicState> {
    return this.publicState(sessionId);
  }

  async speakerState(ownerId: string, sessionId: string): Promise<LivePublicState> {
    await this.requireOwned(ownerId, sessionId);
    return this.publicState(sessionId);
  }

  async participantState(
    participantId: string,
    sessionId: string,
  ): Promise<ParticipantLiveState> {
    await this.touch(participantId);
    const state = await this.publicState(sessionId);
    return { ...state, myOptionId: await this.myOptionId(participantId, state) };
  }

  async launch(
    ownerId: string,
    sessionId: string,
    questionId: string,
  ): Promise<LivePublicState> {
    await this.requireActive(ownerId, sessionId);
    const latest = await this.latestRun(sessionId);
    if (latest?.status === 'OPEN') {
      throw new ConflictException('Close the open question before asking another.');
    }
    if (latest && !latest.resultsPublishedAt) {
      throw new ConflictException(
        'Publish the results before opening the next question.',
      );
    }
    const question = await this.prisma.question.findFirst({
      where: { id: questionId, sessionId },
      select: { id: true },
    });
    if (!question) {
      throw new NotFoundException('Question not found.');
    }
    const asked = await this.prisma.questionRun.findFirst({
      where: { questionId },
      select: { id: true },
    });
    if (asked) {
      throw new ConflictException('This question has already been asked.');
    }

    try {
      await this.prisma.questionRun.create({
        data: {
          questionId,
          sessionId,
          status: 'OPEN',
          openSessionId: sessionId,
        },
      });
    } catch (error) {
      if (this.isKnown(error, 'P2002')) {
        throw new ConflictException('Close the open question before asking another.');
      }
      throw error;
    }

    return this.publishState(sessionId);
  }

  async close(ownerId: string, sessionId: string): Promise<LivePublicState> {
    await this.requireActive(ownerId, sessionId);
    const updated = await this.prisma.questionRun.updateMany({
      where: { sessionId, status: 'OPEN' },
      data: { status: 'CLOSED', openSessionId: null, closedAt: new Date() },
    });
    if (updated.count !== 1) {
      throw new ConflictException('No question is open for voting.');
    }
    return this.publishState(sessionId);
  }

  async publish(ownerId: string, sessionId: string): Promise<LivePublicState> {
    await this.requireActive(ownerId, sessionId);
    const run = await this.latestRun(sessionId);
    if (!run) {
      throw new NotFoundException('No question has been asked.');
    }
    if (run.status === 'OPEN') {
      throw new ConflictException('Close voting before publishing results.');
    }
    if (run.resultsPublishedAt) {
      throw new ConflictException('Results are already published.');
    }

    await this.prisma.questionRun.update({
      where: { id: run.id },
      data: { resultsPublishedAt: new Date() },
    });
    return this.publishState(sessionId);
  }

  async next(ownerId: string, sessionId: string): Promise<LivePublicState> {
    await this.requireActive(ownerId, sessionId);
    const run = await this.latestRun(sessionId);
    if (run?.status === 'OPEN') {
      throw new ConflictException('Close voting before opening the next question.');
    }
    if (run && !run.resultsPublishedAt) {
      throw new ConflictException(
        'Publish the results before opening the next question.',
      );
    }

    const position = run?.question.position ?? -1;
    const question = await this.prisma.question.findFirst({
      where: {
        sessionId,
        position: { gt: position },
        runs: { none: {} },
      },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    if (!question) {
      throw new NotFoundException('There is no further question.');
    }
    return this.launch(ownerId, sessionId, question.id);
  }

  async cast(
    participantId: string,
    sessionId: string,
    dto: CastVoteDto,
  ): Promise<{ myOptionId: string; voteCount: number }> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { status: true },
    });
    if (!session || session.status !== 'ACTIVE') {
      throw new ConflictException('This session is not accepting votes.');
    }

    const run = await this.prisma.questionRun.findFirst({
      where: { sessionId, status: 'OPEN' },
      select: { id: true, questionId: true },
    });
    if (!run) {
      throw new ConflictException('Voting is not open.');
    }

    const already = await this.prisma.vote.findFirst({
      where: { participantId, questionId: run.questionId },
      select: { id: true },
    });
    if (already) {
      throw new ConflictException('You already voted on this question.');
    }

    const option = await this.prisma.questionOption.findFirst({
      where: { id: dto.optionId, questionId: run.questionId },
      select: { id: true },
    });
    if (!option) {
      throw new BadRequestException('Choose one of the options for this question.');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const open = await tx.questionRun.findFirst({
          where: { id: run.id, status: 'OPEN' },
          select: { id: true },
        });
        if (!open) {
          throw new ConflictException('Voting is not open.');
        }
        await tx.vote.create({
          data: {
            questionRunId: run.id,
            questionId: run.questionId,
            sessionId,
            participantId,
            optionId: dto.optionId,
          },
        });
        const stillOpen = await tx.questionRun.findFirst({
          where: { id: run.id, status: 'OPEN' },
          select: { id: true },
        });
        if (!stillOpen) {
          throw new ConflictException('Voting is not open.');
        }
      });
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      if (this.isKnown(error, 'P2002')) {
        throw new ConflictException('You already voted on this question.');
      }
      if (this.isKnown(error, 'P2003')) {
        throw new BadRequestException('Choose one of the options for this question.');
      }
      throw error;
    }

    await this.touch(participantId);
    const voteCount = await this.prisma.vote.count({
      where: { questionRunId: run.id },
    });
    this.broadcast.votes(sessionId, voteCount);
    return { myOptionId: dto.optionId, voteCount };
  }

  async onSessionEnded(sessionId: string): Promise<void> {
    await this.prisma.questionRun.updateMany({
      where: { sessionId, status: 'OPEN' },
      data: { status: 'CLOSED', openSessionId: null, closedAt: new Date() },
    });
    await this.publishState(sessionId);
  }

  async touch(participantId: string): Promise<void> {
    await this.prisma.participant.update({
      where: { id: participantId },
      data: { lastSeenAt: new Date() },
    });
  }

  async myBallot(
    participantId: string,
    sessionId: string,
  ): Promise<{ optionId: string | null }> {
    const state = await this.publicState(sessionId);
    return { optionId: await this.myOptionId(participantId, state) };
  }

  private async publishState(sessionId: string): Promise<LivePublicState> {
    const state = await this.publicState(sessionId);
    this.broadcast.state(sessionId, state);
    return state;
  }

  private async publicState(sessionId: string): Promise<LivePublicState> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { status: true },
    });
    if (!session) {
      throw new NotFoundException('Session not found.');
    }
    const [run, asked] = await Promise.all([
      this.latestRun(sessionId),
      this.prisma.questionRun.findMany({
        where: { sessionId },
        select: { questionId: true },
      }),
    ]);
    return presentLiveState({
      sessionStatus: session.status,
      askedQuestionIds: asked.map((item) => item.questionId),
      run,
    });
  }

  private async latestRun(sessionId: string): Promise<LiveRunSource | null> {
    return this.prisma.questionRun.findFirst({
      where: { sessionId },
      orderBy: { openedAt: 'desc' },
      include: runInclude,
    });
  }

  private async myOptionId(
    participantId: string,
    state: LivePublicState,
  ): Promise<string | null> {
    if (!state.question) {
      return null;
    }
    const vote = await this.prisma.vote.findFirst({
      where: { participantId, questionId: state.question.questionId },
      select: { optionId: true },
    });
    return vote?.optionId ?? null;
  }

  private async requireOwned(ownerId: string, sessionId: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, ownerId },
      select: { id: true, status: true },
    });
    if (!session) {
      throw new NotFoundException('Session not found.');
    }
    return session;
  }

  private async requireActive(ownerId: string, sessionId: string) {
    const session = await this.requireOwned(ownerId, sessionId);
    if (session.status === 'DRAFT') {
      throw new ConflictException('Activate the session before opening voting.');
    }
    if (session.status === 'ENDED') {
      throw new ConflictException('This session has ended.');
    }
    return session;
  }

  private isKnown(error: unknown, code: string): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
  }
}
