import { Outlet } from 'react-router';
import { AuthProvider } from '../contexts/AuthContext';
import { Toaster } from 'sonner';

export function RootLayout() {
  return (
    <AuthProvider>
      <Outlet />
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}
