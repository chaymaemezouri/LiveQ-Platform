import { request, requestBlob } from '@/lib/http';
import type { ImportDraft, QuestionImportPreview } from '@/lib/question-import';

export interface HealthReport {
  status: 'ok';
  service: 'liveq-api';
  database: 'up';
  timestamp: string;
}

export interface Speaker {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthResult {
  accessToken: string;
  user: Speaker;
}

export type SessionStatus = 'DRAFT' | 'ACTIVE' | 'ENDED';

export interface Session {
  id: string;
  title: string;
  description: string | null;
  joinCode: string;
  joinUrl: string;
  status: SessionStatus;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  participantCount: number;
}

export interface SessionInput {
  title: string;
  description?: string | null;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
}

export function fetchHealth(): Promise<HealthReport> {
  return request<HealthReport>('/api/health');
}

export function registerSpeaker(input: {
  email: string;
  displayName: string;
  password: string;
}): Promise<AuthResult> {
  return request<AuthResult>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function loginSpeaker(input: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  return request<AuthResult>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function logoutSpeaker(): Promise<void> {
  return request<void>('/api/auth/logout', { method: 'POST' });
}

export function fetchCurrentSpeaker(): Promise<Speaker> {
  return request<Speaker>('/api/auth/me');
}

export function fetchSessions(): Promise<Session[]> {
  return request<Session[]>('/api/sessions');
}

export function fetchSession(id: string): Promise<Session> {
  return request<Session>(`/api/sessions/${id}`);
}

export function createSession(input: SessionInput): Promise<Session> {
  return request<Session>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function duplicateSession(id: string): Promise<Session> {
  return request<Session>(`/api/sessions/${id}/duplicate`, { method: 'POST' });
}

export function updateSession(id: string, input: SessionInput): Promise<Session> {
  return request<Session>(`/api/sessions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function activateSession(id: string): Promise<Session> {
  return request<Session>(`/api/sessions/${id}/activate`, { method: 'POST' });
}

export function endSession(id: string): Promise<Session> {
  return request<Session>(`/api/sessions/${id}/end`, { method: 'POST' });
}

export function deleteSession(id: string): Promise<void> {
  return request<void>(`/api/sessions/${id}`, { method: 'DELETE' });
}

export interface QuestionOption {
  id: string;
  label: string;
  position: number;
}

export interface Question {
  id: string;
  sessionId: string;
  prompt: string;
  kind: 'CHOICE' | 'TEXT';
  position: number;
  options: QuestionOption[];
  correctOptionId: string | null;
  hasVotingHistory: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionInput {
  prompt: string;
  kind: 'CHOICE' | 'TEXT';
  options?: { label: string }[];
  correctOptionIndex?: number | null;
}

export function fetchQuestions(sessionId: string): Promise<Question[]> {
  return request<Question[]>(`/api/sessions/${sessionId}/questions`);
}

export function fetchQuestion(
  sessionId: string,
  questionId: string,
): Promise<Question> {
  return request<Question>(`/api/sessions/${sessionId}/questions/${questionId}`);
}

export function createQuestion(
  sessionId: string,
  input: QuestionInput,
): Promise<Question> {
  return request<Question>(`/api/sessions/${sessionId}/questions`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateQuestion(
  sessionId: string,
  questionId: string,
  input: QuestionInput,
): Promise<Question> {
  return request<Question>(`/api/sessions/${sessionId}/questions/${questionId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteQuestion(sessionId: string, questionId: string): Promise<void> {
  return request<void>(`/api/sessions/${sessionId}/questions/${questionId}`, {
    method: 'DELETE',
  });
}

export function reorderQuestions(
  sessionId: string,
  questionIds: string[],
): Promise<Question[]> {
  return request<Question[]>(`/api/sessions/${sessionId}/questions/reorder`, {
    method: 'PATCH',
    body: JSON.stringify({ questionIds }),
  });
}

export function downloadQuestionTemplate(sessionId: string): Promise<{ blob: Blob; filename: string }> {
  return requestBlob(`/api/sessions/${sessionId}/questions/import/template`);
}

export function previewQuestionImport(
  sessionId: string,
  file: File,
): Promise<QuestionImportPreview> {
  const body = new FormData();
  body.set('file', file);
  return request<QuestionImportPreview>(`/api/sessions/${sessionId}/questions/import/preview`, {
    method: 'POST',
    body,
  });
}

export function importQuestions(
  sessionId: string,
  requestId: string,
  questions: Array<QuestionInput & { row: number }>,
): Promise<Question[]> {
  return request<Question[]>(`/api/sessions/${sessionId}/questions/import`, {
    method: 'POST',
    body: JSON.stringify({ requestId, questions }),
  });
}

export type { ImportDraft };
