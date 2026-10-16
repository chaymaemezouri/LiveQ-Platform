export interface ImportDraft {
  row: number;
  included: boolean;
  type: string;
  prompt: string;
  options: string[];
  correctAnswer: string;
  duration: string;
  errors: string[];
}

export interface QuestionImportPreview {
  fileError: string | null;
  rows: ImportDraft[];
}

const letters = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

export function assessImportDraft(draft: {
  row: number;
  type: string;
  prompt: string;
  options: string[];
  correctAnswer: string;
  duration: string;
}): string[] {
  const errors: string[] = [];
  const type = draft.type.trim().toUpperCase();
  const prompt = draft.prompt.trim();
  const options = letters.map((_, index) => (draft.options[index] ?? '').trim());
  const correct = draft.correctAnswer.trim().toUpperCase();
  const filled = options.filter(Boolean);
  const gap = options.findIndex((label, index) => !label && options.slice(index + 1).some(Boolean));

  if (type !== 'MCQ' && type !== 'POLL' && type !== 'TEXT') {
    errors.push(`Row ${draft.row}: Type must be MCQ, POLL, or TEXT.`);
  }
  if (!prompt) {
    errors.push(`Row ${draft.row}: Question text is required.`);
  } else if (prompt.length > 4000) {
    errors.push(`Row ${draft.row}: Question text must be 4000 characters or fewer.`);
  }
  if (gap >= 0) {
    errors.push(`Row ${draft.row}: Fill options from A without leaving a gap.`);
  }
  if (type === 'TEXT') {
    if (filled.length > 0) {
      errors.push(`Row ${draft.row}: A written question cannot have answer options.`);
    }
    if (correct) {
      errors.push(`Row ${draft.row}: A written question cannot have a correct answer.`);
    }
  }
  if (type === 'MCQ' || type === 'POLL') {
    if (filled.length < 2 || filled.length > 6) {
      errors.push(`Row ${draft.row}: A choice question needs 2 to 6 options.`);
    }
    if (filled.some((label) => label.length > 500)) {
      errors.push(`Row ${draft.row}: Each option must be 500 characters or fewer.`);
    }
  }
  if (type === 'POLL' && correct) {
    errors.push(`Row ${draft.row}: A poll cannot have a correct answer.`);
  }
  if (type === 'MCQ') {
    if (!correct) {
      errors.push(`Row ${draft.row}: An MCQ needs a correct answer from A to F.`);
    } else if (!letters.includes(correct as (typeof letters)[number])) {
      errors.push(`Row ${draft.row}: Correct Answer must be a letter from A to F.`);
    } else if (!options[correct.charCodeAt(0) - 65]) {
      errors.push(`Row ${draft.row}: Correct Answer ${correct} does not match an option.`);
    }
  }

  const duration = draft.duration.trim();
  if (duration && (!/^\d+$/.test(duration) || Number(duration) < 5 || Number(duration) > 600)) {
    errors.push(
      /^\d+$/.test(duration)
        ? `Row ${draft.row}: Duration must be from 5 to 600 seconds, or be left empty.`
        : `Row ${draft.row}: Duration must be a whole number of seconds, or be left empty.`,
    );
  }

  return errors;
}

export function refreshDraft(draft: ImportDraft): ImportDraft {
  const errors = assessImportDraft(draft);
  return { ...draft, errors, included: errors.length === 0 ? draft.included : false };
}
