export type ReportSessionStatus = 'DRAFT' | 'ACTIVE' | 'ENDED';

export interface ReportOption {
  optionId: string;
  label: string;
  count: number;
  percent: number;
}

export interface ReportQuestion {
  questionId: string;
  position: number;
  prompt: string;
  published: boolean;
  graded: boolean;
  voteCount: number;
  votingPercent: number;
  correctCount: number | null;
  correctPercent: number | null;
  correctOptionId: string | null;
  options: ReportOption[];
}

export interface SessionReport {
  sessionId: string;
  title: string;
  status: ReportSessionStatus;
  startedAt: string | null;
  endedAt: string | null;
  participantCount: number;
  questionCount: number;
  askedQuestionCount: number;
  publishedQuestionCount: number;
  voteCount: number;
  participationPercent: number;
  votingPercent: number;
  correctPercent: number | null;
  questions: ReportQuestion[];
}

export interface ReportSummary {
  sessionId: string;
  title: string;
  status: ReportSessionStatus;
  startedAt: string | null;
  endedAt: string | null;
  participantCount: number;
  questionCount: number;
  publishedQuestionCount: number;
  participationPercent: number;
  votingPercent: number;
  correctPercent: number | null;
}

export interface ReportQuestionSource {
  id: string;
  prompt: string;
  position: number;
  options: { id: string; label: string; position: number }[];
  correctOptionId: string | null;
  run: {
    published: boolean;
    votes: { optionId: string; participantId: string }[];
  } | null;
}

export interface ReportSource {
  id: string;
  title: string;
  status: ReportSessionStatus;
  startedAt: string | null;
  endedAt: string | null;
  participantCount: number;
  questions: ReportQuestionSource[];
}
