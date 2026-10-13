import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  renderReportPdf,
  renderReportWorkbook,
  reportFilename,
} from './report.documents';
import { buildReport, summarizeReport } from './report.math';
import type { ReportSource, ReportSummary, SessionReport } from './report.types';

const reportSelect = {
  id: true,
  title: true,
  status: true,
  startedAt: true,
  endedAt: true,
  updatedAt: true,
  _count: { select: { participants: true } },
  questions: {
    select: {
      id: true,
      prompt: true,
      kind: true,
      position: true,
      options: { select: { id: true, label: true, position: true } },
      correctAnswer: { select: { optionId: true } },
      runs: {
        select: {
          openedAt: true,
          resultsPublishedAt: true,
          votes: { select: { optionId: true, textResponse: true, participantId: true } },
        },
      },
    },
  },
} satisfies Prisma.SessionSelect;

type ReportRecord = Prisma.SessionGetPayload<{ select: typeof reportSelect }>;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(ownerId: string): Promise<ReportSummary[]> {
    const sessions = await this.prisma.session.findMany({
      where: { ownerId },
      select: reportSelect,
      orderBy: { updatedAt: 'desc' },
    });
    return sessions.map((session) => summarizeReport(buildReport(toSource(session))));
  }

  async get(ownerId: string, sessionId: string): Promise<SessionReport> {
    return buildReport(toSource(await this.requireOwned(ownerId, sessionId)));
  }

  async pdf(
    ownerId: string,
    sessionId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const report = await this.get(ownerId, sessionId);
    return {
      buffer: await renderReportPdf(report),
      filename: reportFilename(report.title, 'pdf'),
    };
  }

  async xlsx(
    ownerId: string,
    sessionId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const report = await this.get(ownerId, sessionId);
    return {
      buffer: await renderReportWorkbook(report),
      filename: reportFilename(report.title, 'xlsx'),
    };
  }

  private async requireOwned(
    ownerId: string,
    sessionId: string,
  ): Promise<ReportRecord> {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, ownerId },
      select: reportSelect,
    });
    if (!session) {
      throw new NotFoundException('Session not found.');
    }
    return session;
  }
}

function toSource(session: ReportRecord): ReportSource {
  return {
    id: session.id,
    title: session.title,
    status: session.status,
    startedAt: session.startedAt?.toISOString() ?? null,
    endedAt: session.endedAt?.toISOString() ?? null,
    participantCount: session._count.participants,
    questions: [...session.questions]
      .sort((left, right) => left.position - right.position)
      .map((question) => {
        const latest = [...question.runs].sort(
          (left, right) => right.openedAt.getTime() - left.openedAt.getTime(),
        )[0];
        return {
          id: question.id,
          prompt: question.prompt,
          kind: question.kind,
          position: question.position,
          options: [...question.options]
            .sort((left, right) => left.position - right.position)
            .map((option) => ({
              id: option.id,
              label: option.label,
              position: option.position,
            })),
          correctOptionId: question.correctAnswer?.optionId ?? null,
          run: latest
            ? {
                published: latest.resultsPublishedAt !== null,
                votes: latest.votes,
              }
            : null,
        };
      }),
  };
}
