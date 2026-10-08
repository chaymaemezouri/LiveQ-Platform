import { Navigate, Outlet } from 'react-router';
import { useAuth } from '@/hooks/use-auth';

export function ProtectedRoute() {
  const { token, isReady } = useAuth();

  if (!isReady) {
    return (
      <p className="text-muted-foreground px-6 py-16 text-sm" role="status">
        Checking your account…
      </p>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
