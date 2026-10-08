import type {
  LivePublicState,
  LiveResultView,
  LiveRunSource,
  LiveSessionStatus,
} from './live.types';

export function resultBars(
  options: { id: string; label: string; position: number }[],
  votes: { optionId: string }[],
): LiveResultView[] {
  const total = votes.length;
  const counts = new Map<string, number>();
  for (const vote of votes) {
    counts.set(vote.optionId, (counts.get(vote.optionId) ?? 0) + 1);
  }
  return [...options]
    .sort((left, right) => left.position - right.position)
    .map((option) => {
      const count = counts.get(option.id) ?? 0;
      return {
        optionId: option.id,
        label: option.label,
        count,
        percent: total === 0 ? 0 : Math.round((count / total) * 100),
      };
    });
}

export function presentLiveState(input: {
  sessionStatus: LiveSessionStatus;
  askedQuestionIds: string[];
  run: LiveRunSource | null;
}): LivePublicState {
  const base = {
    sessionStatus: input.sessionStatus,
    voteCount: input.run?.votes.length ?? 0,
    askedQuestionIds: input.askedQuestionIds,
    question: null,
    results: null,
  };

  if (!input.run) {
    return { ...base, phase: 'idle' };
  }

  const question = {
    runId: input.run.id,
    questionId: input.run.question.id,
    prompt: input.run.question.prompt,
    position: input.run.question.position,
    options: [...input.run.question.options]
      .sort((left, right) => left.position - right.position)
      .map((option) => ({
        id: option.id,
        label: option.label,
        position: option.position,
      })),
  };

  if (input.run.status === 'OPEN') {
    return { ...base, phase: 'open', question };
  }

  if (!input.run.resultsPublishedAt) {
    return { ...base, phase: 'closed', question };
  }

  return {
    ...base,
    phase: 'published',
    question,
    results: resultBars(question.options, input.run.votes),
    correctOptionId: input.run.question.correctAnswer?.optionId ?? null,
  };
}
