import { resultBars } from '../live/live.presenter';
import type {
  ReportQuestion,
  ReportSource,
  ReportSummary,
  SessionReport,
} from './report.types';

export function percent(part: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.round((part / total) * 100);
}

export function buildReport(source: ReportSource): SessionReport {
  const questions = source.questions.map((question) =>
    presentQuestion(question, source.participantCount),
  );
  const asked = source.questions.filter((question) => question.run);
  const voters = new Set<string>();
  for (const question of asked) {
    for (const vote of question.run?.votes ?? []) {
      voters.add(vote.participantId);
    }
  }

  const voteCount = questions.reduce((sum, question) => sum + question.voteCount, 0);
  const published = questions.filter((question) => question.published);
  let gradedVotes = 0;
  let correctVotes = 0;
  for (const question of published) {
    if (question.correctCount === null) {
      continue;
    }
    gradedVotes += question.voteCount;
    correctVotes += question.correctCount;
  }

  return {
    sessionId: source.id,
    title: source.title,
    status: source.status,
    startedAt: source.startedAt,
    endedAt: source.endedAt,
    participantCount: source.participantCount,
    questionCount: questions.length,
    askedQuestionCount: asked.length,
    publishedQuestionCount: published.length,
    voteCount,
    participationPercent: percent(voters.size, source.participantCount),
    votingPercent: percent(voteCount, source.participantCount * asked.length),
    correctPercent: gradedVotes === 0 ? null : percent(correctVotes, gradedVotes),
    questions,
  };
}

export function summarizeReport(report: SessionReport): ReportSummary {
  return {
    sessionId: report.sessionId,
    title: report.title,
    status: report.status,
    startedAt: report.startedAt,
    endedAt: report.endedAt,
    participantCount: report.participantCount,
    questionCount: report.questionCount,
    publishedQuestionCount: report.publishedQuestionCount,
    participationPercent: report.participationPercent,
    votingPercent: report.votingPercent,
    correctPercent: report.correctPercent,
  };
}

function presentQuestion(
  question: ReportSource['questions'][number],
  participantCount: number,
): ReportQuestion {
  const votes = question.run?.votes ?? [];
  const published = question.run?.published ?? false;
  const graded = question.correctOptionId !== null;
  const voteCount = votes.length;
  const base = {
    questionId: question.id,
    position: question.position,
    prompt: question.prompt,
    published,
    graded,
    voteCount,
    votingPercent: percent(voteCount, participantCount),
  };

  if (!published) {
    return {
      ...base,
      correctCount: null,
      correctPercent: null,
      correctOptionId: null,
      options: [],
    };
  }

  const correctCount = graded
    ? votes.filter((vote) => vote.optionId === question.correctOptionId).length
    : null;

  return {
    ...base,
    correctCount,
    correctPercent:
      correctCount === null || voteCount === 0
        ? null
        : percent(correctCount, voteCount),
    correctOptionId: question.correctOptionId,
    options: resultBars(question.options, votes),
  };
}
