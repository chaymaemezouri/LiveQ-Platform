import { describe, expect, it } from 'vitest';
import { assessImportDraft } from '@/lib/question-import';

describe('question import checks', () => {
  it('accepts a graded choice, an ungraded poll, and a written question', () => {
    expect(
      assessImportDraft({
        row: 2,
        type: 'MCQ',
        prompt: 'Which planet is closest to the sun?',
        options: ['Mercury', 'Venus', '', '', '', ''],
        correctAnswer: 'A',
        duration: '30',
      }),
    ).toEqual([]);
    expect(
      assessImportDraft({
        row: 3,
        type: 'POLL',
        prompt: 'Which topic next?',
        options: ['Routing', 'Security', '', '', '', ''],
        correctAnswer: '',
        duration: '',
      }),
    ).toEqual([]);
    expect(
      assessImportDraft({
        row: 4,
        type: 'TEXT',
        prompt: 'What will you try first?',
        options: ['', '', '', '', '', ''],
        correctAnswer: '',
        duration: '',
      }),
    ).toEqual([]);
  });

  it('names the Excel row when a question is not valid', () => {
    const errors = assessImportDraft({
      row: 8,
      type: 'TEXT',
      prompt: '',
      options: ['Notes', '', '', '', '', ''],
      correctAnswer: 'A',
      duration: '2',
    });
    expect(errors.join(' ')).toMatch(/Row 8: Question text is required/);
    expect(errors.join(' ')).toMatch(/Row 8: A written question cannot have answer options/);
    expect(errors.join(' ')).toMatch(/Row 8: A written question cannot have a correct answer/);
    expect(errors.join(' ')).toMatch(/Row 8: Duration must be from 5 to 600/);
  });
});
