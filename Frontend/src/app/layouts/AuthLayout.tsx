import { Outlet, Navigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';

export function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen bg-gray-950" />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-blue-950 to-gray-950">
      <Outlet />
    </div>
  );
}
