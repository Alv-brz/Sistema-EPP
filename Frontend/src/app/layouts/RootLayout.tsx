import { Outlet } from 'react-router';
import { AuthProvider } from '../contexts/AuthContext';
import { AlertProvider } from '../contexts/AlertContext';
import { Toaster } from 'sonner';

export function RootLayout() {
  return (
    <AuthProvider>
      <AlertProvider>
        <Outlet />
      </AlertProvider>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}
