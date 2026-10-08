import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/components/theme-provider';
import { QuestionEditorPage } from '@/routes/question-editor-page';

function renderEditor() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ path: '/app/sessions/:id/questions/new', Component: QuestionEditorPage }],
    { initialEntries: ['/app/sessions/session-1/questions/new'] },
  );

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('QuestionEditorPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requires a question and labeled options before calling the API', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderEditor();

    expect(screen.getByRole('heading', { name: 'New question' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Preview' })).toBeInTheDocument();
    const form = screen.getByRole('button', { name: 'Add question' }).closest('form');
    if (!form) {
      throw new Error('Question form was not rendered');
    }
    fireEvent.submit(form);
    expect(screen.getByRole('alert')).toHaveTextContent(/enter the question/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
