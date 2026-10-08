export type SessionStatusName = 'DRAFT' | 'ACTIVE' | 'ENDED';

export interface SessionRecord {
  id: string;
  title: string;
  description: string | null;
  joinCode: string;
  status: SessionStatusName;
  scheduledStartAt: Date | null;
  scheduledEndAt: Date | null;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionView {
  id: string;
  title: string;
  description: string | null;
  joinCode: string;
  joinUrl: string;
  status: SessionStatusName;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  participantCount: number;
}

export function presentSession(
  session: SessionRecord,
  webOrigin: string,
  participantCount = 0,
): SessionView {
  const origin = webOrigin.replace(/\/$/, '');
  return {
    id: session.id,
    title: session.title,
    description: session.description,
    joinCode: session.joinCode,
    joinUrl: `${origin}/join/${session.joinCode}`,
    status: session.status,
    scheduledStartAt: session.scheduledStartAt?.toISOString() ?? null,
    scheduledEndAt: session.scheduledEndAt?.toISOString() ?? null,
    startedAt: session.startedAt?.toISOString() ?? null,
    endedAt: session.endedAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    participantCount,
  };
}
