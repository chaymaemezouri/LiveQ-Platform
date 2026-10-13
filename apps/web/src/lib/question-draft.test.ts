import { describe, expect, it } from 'vitest';
import { validateQuestionDraft } from '@/lib/question-draft';

const valid = {
  prompt: 'What is 2 + 2?',
  kind: 'CHOICE' as const,
  options: ['3', '4'],
  ungraded: false,
  correctIndex: 1,
};

describe('validateQuestionDraft', () => {
  it('accepts a graded question and an opinion poll', () => {
    expect(validateQuestionDraft(valid)).toBeNull();
    expect(
      validateQuestionDraft({ ...valid, ungraded: true, correctIndex: null }),
    ).toBeNull();
  });

  it('requires a prompt, two labeled options, and a correct answer when graded', () => {
    expect(validateQuestionDraft({ ...valid, prompt: '  ' })).toMatch(/question/i);
    expect(validateQuestionDraft({ ...valid, options: ['Only one'] })).toMatch(
      /2 and 6/,
    );
    expect(validateQuestionDraft({ ...valid, options: ['4', ' '] })).toMatch(/label/i);
    expect(validateQuestionDraft({ ...valid, correctIndex: null })).toMatch(
      /correct option/i,
    );
  });

  it('accepts a written question with only a prompt', () => {
    expect(
      validateQuestionDraft({
        prompt: 'Name a color',
        kind: 'TEXT',
        options: [],
        ungraded: true,
        correctIndex: null,
      }),
    ).toBeNull();
  });
});
