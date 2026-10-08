import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResultChart } from '@/components/result-chart';

describe('ResultChart', () => {
  it('shows percentages and the correct option after results are published', () => {
    render(
      <ResultChart
        correctOptionId="option-4"
        results={[
          { optionId: 'option-3', label: '3', count: 1, percent: 50 },
          { optionId: 'option-4', label: '4', count: 1, percent: 50 },
        ]}
      />,
    );

    expect(screen.getByRole('figure', { name: 'Results' })).toBeInTheDocument();
    expect(screen.getAllByText(/50%/).length).toBeGreaterThan(0);
    expect(screen.getByText('Correct')).toBeInTheDocument();
  });
});
