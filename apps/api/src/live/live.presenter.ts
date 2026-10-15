import type {
  LivePublicState,
  LiveResultView,
  LiveRunSource,
  LiveSessionStatus,
  ParticipantReview,
} from './live.types';

export function resultBars(
  options: { id: string; label: string; position: number }[],
  votes: { optionId: string | null }[],
): LiveResultView[] {
  const counted = votes.filter((vote) => vote.optionId);
  const total = counted.length;
  const counts = new Map<string, number>();
  for (const vote of counted) {
    if (!vote.optionId) {
      continue;
    }
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
    responses: null,
    timerSeconds: input.run?.timerSeconds ?? null,
    closesAt: input.run?.closesAt?.toISOString() ?? null,
  };

  if (!input.run) {
    return { ...base, phase: 'idle' };
  }

  const kind = input.run.question.kind ?? 'CHOICE';
  const question = {
    runId: input.run.id,
    questionId: input.run.question.id,
    prompt: input.run.question.prompt,
    position: input.run.question.position,
    kind,
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
    results: kind === 'TEXT' ? null : resultBars(question.options, input.run.votes),
    responses:
      kind === 'TEXT'
        ? input.run.votes.flatMap((vote) =>
            vote.textResponse?.trim() ? [vote.textResponse.trim()] : [],
          )
        : null,
    correctOptionId:
      kind === 'TEXT' ? null : (input.run.question.correctAnswer?.optionId ?? null),
  };
}

export function presentParticipantReview(input: {
  questionCount: number;
  runs: LiveRunSource[];
  votes: { questionId: string; optionId: string | null; textResponse: string | null }[];
}): ParticipantReview {
  const mine = new Map(input.votes.map((vote) => [vote.questionId, vote]));
  const items = input.runs.flatMap((run) => {
    const state = presentLiveState({
      sessionStatus: 'ACTIVE',
      askedQuestionIds: [],
      run,
    });
    if (!state.question || state.phase === 'idle') {
      return [];
    }
    const vote = mine.get(state.question.questionId);
    return [
      {
        runId: state.question.runId,
        questionId: state.question.questionId,
        prompt: state.question.prompt,
        position: state.question.position,
        kind: state.question.kind,
        phase: state.phase,
        options: state.question.options,
        myOptionId: vote?.optionId ?? null,
        myText: vote?.textResponse?.trim() ? vote.textResponse.trim() : null,
        results: state.results,
        responses: state.responses,
        correctOptionId: state.correctOptionId ?? null,
      },
    ];
  });
  return { questionCount: input.questionCount, items };
}
