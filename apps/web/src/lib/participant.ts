import { ApiError, publicRequest } from '@/lib/http';

const codePattern = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

export interface ParticipantProfile {
  id: string;
  nickname: string | null;
}

export interface ParticipantSession {
  title: string;
  status: 'DRAFT' | 'ACTIVE' | 'ENDED';
  participantCount: number;
}

export interface ParticipantPresence {
  participant: ParticipantProfile;
  session: ParticipantSession;
}

export interface JoinResult extends ParticipantPresence {
  accessToken: string;
}

export function normalizeJoinCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isJoinCode(value: string): boolean {
  return codePattern.test(normalizeJoinCode(value));
}

function storageKey(code: string): string {
  return `liveq.participant.${normalizeJoinCode(code)}`;
}

export function readParticipantToken(code: string): string | null {
  if (!isJoinCode(code)) {
    return null;
  }
  return localStorage.getItem(storageKey(code));
}

export function writeParticipantToken(code: string, token: string): void {
  localStorage.setItem(storageKey(code), token);
}

export function clearParticipantToken(code: string): void {
  localStorage.removeItem(storageKey(code));
}

export function joinSession(input: {
  code: string;
  nickname: string;
}): Promise<JoinResult> {
  return publicRequest<JoinResult>('/api/join', {
    method: 'POST',
    body: JSON.stringify({
      code: normalizeJoinCode(input.code),
      nickname: input.nickname.trim() || null,
    }),
  });
}

export function fetchParticipantPresence(code: string): Promise<ParticipantPresence> {
  const token = readParticipantToken(code);
  if (!token) {
    return Promise.reject(new ApiError('Join this session again.', 401));
  }
  return publicRequest<ParticipantPresence>('/api/join/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}
