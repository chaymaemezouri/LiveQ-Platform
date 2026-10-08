export interface ParticipantIdentity {
  id: string;
  sessionId: string;
  nickname: string | null;
}

export interface ParticipantSessionView {
  title: string;
  status: 'DRAFT' | 'ACTIVE' | 'ENDED';
  participantCount: number;
}

export interface ParticipantProfile {
  id: string;
  nickname: string | null;
}

export interface ParticipantPresence {
  participant: ParticipantProfile;
  session: ParticipantSessionView;
}

export interface JoinResult extends ParticipantPresence {
  accessToken: string;
}

export function presentPresence(
  participant: ParticipantProfile,
  session: ParticipantSessionView,
): ParticipantPresence {
  return { participant, session };
}
