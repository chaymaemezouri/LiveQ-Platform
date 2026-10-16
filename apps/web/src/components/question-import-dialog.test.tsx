import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QuestionImportButton } from '@/components/question-import-dialog';

describe('QuestionImportButton', () => {
  it('opens the light import dialog beside Add question', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <QuestionImportButton sessionId="33333333-3333-4333-8333-333333333333" />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Import Excel' }));

    expect(screen.getByRole('dialog', { name: 'Import questions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download template' })).toBeInTheDocument();
    expect(screen.getByLabelText('Excel file')).toBeInTheDocument();
  });
});
