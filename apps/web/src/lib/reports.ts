import { request, requestBlob } from '@/lib/http';
import type { SessionStatus } from '@/lib/api';

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
  status: SessionStatus;
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
  status: SessionStatus;
  startedAt: string | null;
  endedAt: string | null;
  participantCount: number;
  questionCount: number;
  publishedQuestionCount: number;
  participationPercent: number;
  votingPercent: number;
  correctPercent: number | null;
}

export function fetchReports(): Promise<ReportSummary[]> {
  return request<ReportSummary[]>('/api/reports');
}

export function fetchReport(sessionId: string): Promise<SessionReport> {
  return request<SessionReport>(`/api/reports/${sessionId}`);
}

export function downloadReport(
  sessionId: string,
  format: 'pdf' | 'xlsx',
): Promise<{ blob: Blob; filename: string }> {
  return requestBlob(`/api/reports/${sessionId}/export.${format}`);
}
