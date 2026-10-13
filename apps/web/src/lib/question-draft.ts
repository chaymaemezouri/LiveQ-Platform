export type QuestionKind = 'CHOICE' | 'TEXT';

export interface QuestionDraft {
  prompt: string;
  kind: QuestionKind;
  options: string[];
  ungraded: boolean;
  correctIndex: number | null;
}

export function validateQuestionDraft(draft: QuestionDraft): string | null {
  if (draft.prompt.trim().length === 0) {
    return 'Enter the question.';
  }
  if (draft.kind === 'TEXT') {
    return null;
  }
  if (draft.options.length < 2 || draft.options.length > 6) {
    return 'Add between 2 and 6 options.';
  }
  if (draft.options.some((label) => label.trim().length === 0)) {
    return 'Every option needs a label.';
  }
  if (
    !draft.ungraded &&
    (draft.correctIndex == null ||
      draft.correctIndex < 0 ||
      draft.correctIndex >= draft.options.length)
  ) {
    return 'Choose the correct option, or mark this as an opinion poll.';
  }
  return null;
}

export function emptyQuestionDraft(): QuestionDraft {
  return {
    prompt: '',
    kind: 'CHOICE',
    options: ['', ''],
    ungraded: false,
    correctIndex: null,
  };
}
