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
  const participants = source.participants ?? [];
  const questions = source.questions.map((question) =>
    presentQuestion(question, source.participantCount, participants),
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
  participants: { id: string; nickname: string | null }[],
): ReportQuestion {
  const votes = question.run?.votes ?? [];
  const published = question.run?.published ?? false;
  const kind = question.kind ?? 'CHOICE';
  const graded = kind === 'CHOICE' && question.correctOptionId !== null;
  const voteCount = votes.length;
  const responses =
    kind === 'TEXT' && published
      ? votes.flatMap((vote) =>
          vote.textResponse?.trim() ? [vote.textResponse.trim()] : [],
        )
      : [];
  const base = {
    questionId: question.id,
    position: question.position,
    prompt: question.prompt,
    kind,
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
      responses: [],
      answers: [],
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
    correctOptionId: graded ? question.correctOptionId : null,
    options: kind === 'TEXT' ? [] : resultBars(question.options, votes),
    responses,
    answers: participantAnswers(question, participants, votes),
  };
}

function participantAnswers(
  question: ReportSource['questions'][number],
  participants: { id: string; nickname: string | null }[],
  votes: { optionId: string | null; participantId: string; textResponse?: string | null }[],
): { name: string; answer: string }[] {
  const kind = question.kind ?? 'CHOICE';
  return participants
    .map((participant) => {
      const vote = votes.find((item) => item.participantId === participant.id);
      return {
        name: participant.nickname?.trim() || 'Guest',
        answer: vote ? answerText(question, kind, vote) : 'No answer',
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function answerText(
  question: ReportSource['questions'][number],
  kind: 'CHOICE' | 'TEXT',
  vote: { optionId: string | null; textResponse?: string | null },
): string {
  if (kind === 'TEXT') {
    return vote.textResponse?.trim() || 'No answer';
  }
  const index = question.options.findIndex((option) => option.id === vote.optionId);
  const option = index >= 0 ? question.options[index] : undefined;
  if (!option) {
    return 'No answer';
  }
  return `${String.fromCharCode(65 + index)} ${option.label}`;
}
