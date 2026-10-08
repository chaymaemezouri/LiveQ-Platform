import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AuthProvider } from '@/components/auth-provider';
import { DashboardShell } from '@/components/dashboard-shell';
import { ProtectedRoute } from '@/components/protected-route';
import { ThemeProvider } from '@/components/theme-provider';
import { AccountPage } from '@/routes/account-page';
import { JoinPage } from '@/routes/join-page';
import { LoginPage } from '@/routes/login-page';
import { NotFoundPage } from '@/routes/not-found-page';
import { OverviewPage } from '@/routes/overview-page';
import { QuestionEditorPage } from '@/routes/question-editor-page';
import { RegisterPage } from '@/routes/register-page';
import { SessionDetailPage } from '@/routes/session-detail-page';
import { SessionFormPage } from '@/routes/session-form-page';
import { SessionsPage } from '@/routes/sessions-page';
import { StatusPage } from '@/routes/status-page';
import { WelcomePage } from '@/routes/welcome-page';
import '@/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const router = createBrowserRouter([
  { path: '/', Component: WelcomePage },
  { path: '/login', Component: LoginPage },
  { path: '/register', Component: RegisterPage },
  { path: '/status', Component: StatusPage },
  { path: '/join', Component: JoinPage },
  { path: '/join/:code', Component: JoinPage },
  {
    path: '/app',
    Component: ProtectedRoute,
    children: [
      {
        Component: DashboardShell,
        children: [
          { index: true, Component: OverviewPage },
          { path: 'sessions', Component: SessionsPage },
          { path: 'sessions/new', Component: SessionFormPage },
          { path: 'sessions/:id', Component: SessionDetailPage },
          { path: 'sessions/:id/edit', Component: SessionFormPage },
          { path: 'sessions/:id/questions/new', Component: QuestionEditorPage },
          { path: 'sessions/:id/questions/:questionId', Component: QuestionEditorPage },
          { path: 'account', Component: AccountPage },
        ],
      },
    ],
  },
  { path: '*', Component: NotFoundPage },
]);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element was not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
