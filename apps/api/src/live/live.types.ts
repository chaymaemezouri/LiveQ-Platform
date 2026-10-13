export type LiveSessionStatus = 'DRAFT' | 'ACTIVE' | 'ENDED';
export type LivePhase = 'idle' | 'open' | 'closed' | 'published';

export interface LiveOptionView {
  id: string;
  label: string;
  position: number;
}

export interface LiveResultView {
  optionId: string;
  label: string;
  count: number;
  percent: number;
}

export interface LiveQuestionView {
  runId: string;
  questionId: string;
  prompt: string;
  position: number;
  kind: 'CHOICE' | 'TEXT';
  options: LiveOptionView[];
}

export interface LivePublicState {
  sessionStatus: LiveSessionStatus;
  phase: LivePhase;
  voteCount: number;
  askedQuestionIds: string[];
  question: LiveQuestionView | null;
  results: LiveResultView[] | null;
  responses: string[] | null;
  timerSeconds: number | null;
  closesAt: string | null;
  correctOptionId?: string | null;
}

export interface ParticipantLiveState extends LivePublicState {
  myOptionId: string | null;
  myText: string | null;
}

export interface LiveIdentity {
  role: 'speaker' | 'participant';
  sessionId: string;
  userId?: string;
  participantId?: string;
}

export interface LiveBroadcast {
  state(sessionId: string, snapshot: LivePublicState): void;
  votes(sessionId: string, voteCount: number): void;
}

export interface LiveRunSource {
  id: string;
  status: 'OPEN' | 'CLOSED';
  timerSeconds: number | null;
  closesAt: Date | null;
  resultsPublishedAt: Date | null;
  question: {
    id: string;
    prompt: string;
    position: number;
    kind?: 'CHOICE' | 'TEXT';
    options: LiveOptionView[];
    correctAnswer: { optionId: string } | null;
  };
  votes: { optionId: string | null; participantId: string; textResponse?: string | null }[];
}
