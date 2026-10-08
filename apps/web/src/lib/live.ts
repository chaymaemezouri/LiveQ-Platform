import { io, type Socket } from 'socket.io-client';
import { publicRequest, request } from '@/lib/http';
import { readParticipantToken } from '@/lib/participant';

export type LivePhase = 'idle' | 'open' | 'closed' | 'published';

export interface LiveOption {
  id: string;
  label: string;
  position: number;
}

export interface LiveResult {
  optionId: string;
  label: string;
  count: number;
  percent: number;
}

export interface LiveQuestion {
  runId: string;
  questionId: string;
  prompt: string;
  position: number;
  options: LiveOption[];
}

export interface LiveState {
  sessionStatus: 'DRAFT' | 'ACTIVE' | 'ENDED';
  phase: LivePhase;
  voteCount: number;
  askedQuestionIds: string[];
  question: LiveQuestion | null;
  results: LiveResult[] | null;
  correctOptionId?: string | null;
}

export interface ParticipantLiveState extends LiveState {
  myOptionId: string | null;
}

export function fetchLiveState(sessionId: string): Promise<LiveState> {
  return request<LiveState>(`/api/sessions/${sessionId}/live`);
}

export function launchQuestion(
  sessionId: string,
  questionId: string,
): Promise<LiveState> {
  return request<LiveState>(`/api/sessions/${sessionId}/live/launch`, {
    method: 'POST',
    body: JSON.stringify({ questionId }),
  });
}

export function closeVoting(sessionId: string): Promise<LiveState> {
  return request<LiveState>(`/api/sessions/${sessionId}/live/close`, {
    method: 'POST',
  });
}

export function publishResults(sessionId: string): Promise<LiveState> {
  return request<LiveState>(`/api/sessions/${sessionId}/live/publish`, {
    method: 'POST',
  });
}

export function nextQuestion(sessionId: string): Promise<LiveState> {
  return request<LiveState>(`/api/sessions/${sessionId}/live/next`, { method: 'POST' });
}

export function fetchParticipantLive(code: string): Promise<ParticipantLiveState> {
  return publicRequest<ParticipantLiveState>('/api/join/live', {
    headers: participantAuth(code),
  });
}

export function castVote(
  code: string,
  optionId: string,
): Promise<{ myOptionId: string; voteCount: number }> {
  return publicRequest('/api/join/votes', {
    method: 'POST',
    headers: participantAuth(code),
    body: JSON.stringify({ optionId }),
  });
}

export function openLiveSocket(auth: {
  role: 'speaker' | 'participant';
  token: string;
  sessionId?: string;
}): Socket {
  const configured = import.meta.env.VITE_API_BASE_URL;
  return io(configured || window.location.origin, {
    path: '/socket.io',
    auth,
    reconnection: true,
    timeout: 10000,
  });
}

function participantAuth(code: string): HeadersInit {
  const token = readParticipantToken(code);
  return token ? { Authorization: `Bearer ${token}` } : {};
}
