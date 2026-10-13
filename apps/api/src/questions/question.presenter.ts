export interface QuestionOptionView {
  id: string;
  label: string;
  position: number;
}

export interface QuestionRecord {
  id: string;
  sessionId: string;
  prompt: string;
  kind: 'CHOICE' | 'TEXT';
  position: number;
  createdAt: Date;
  updatedAt: Date;
  options: QuestionOptionView[];
  correctAnswer: { optionId: string } | null;
}

export interface QuestionView {
  id: string;
  sessionId: string;
  prompt: string;
  kind: 'CHOICE' | 'TEXT';
  position: number;
  options: QuestionOptionView[];
  correctOptionId: string | null;
  hasVotingHistory: boolean;
  createdAt: string;
  updatedAt: string;
}

export function presentQuestion(
  question: QuestionRecord,
  hasVotingHistory: boolean,
): QuestionView {
  const options = [...question.options].sort(
    (left, right) => left.position - right.position,
  );
  return {
    id: question.id,
    sessionId: question.sessionId,
    prompt: question.prompt,
    kind: question.kind,
    position: question.position,
    options: options.map((option) => ({
      id: option.id,
      label: option.label,
      position: option.position,
    })),
    correctOptionId: question.correctAnswer?.optionId ?? null,
    hasVotingHistory,
    createdAt: question.createdAt.toISOString(),
    updatedAt: question.updatedAt.toISOString(),
  };
}
