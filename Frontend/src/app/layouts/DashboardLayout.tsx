import { Outlet, Navigate, NavLink, useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { GlobalNotificationBell } from '../components/GlobalNotificationBell';
import { canAccessRoute, hasRole } from '../auth/permissions';
import {
  LayoutDashboard,
  MonitorPlay,
  AlertTriangle,
  FileBarChart,
  Camera,
  MapPin,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
  ChevronDown
} from 'lucide-react';
import { useState } from 'react';

export function DashboardLayout() {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();

  if (isLoading) {
    return <div className="min-h-screen bg-gray-950" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true, roles: ['admin', 'supervisor', 'inspector'] as const },
    { path: '/monitoring', icon: MonitorPlay, label: 'Monitoreo en Vivo', roles: ['admin', 'supervisor', 'inspector'] as const },
    { path: '/violations', icon: AlertTriangle, label: 'Infracciones', roles: ['admin', 'supervisor', 'inspector'] as const },
    { path: '/reports', icon: FileBarChart, label: 'Reportes', roles: ['admin', 'supervisor'] as const },
    { path: '/cameras', icon: Camera, label: 'Cámaras', roles: ['admin', 'supervisor'] as const },
    { path: '/areas', icon: MapPin, label: 'Áreas', roles: ['admin'] as const },
    { path: '/users', icon: Users, label: 'Usuarios', roles: ['admin'] as const },
    { path: '/settings', icon: Settings, label: 'Configuración', roles: ['admin'] as const },
  ].filter((item) => hasRole(user?.role, [...item.roles]));

  if (!canAccessRoute(user?.role, location.pathname)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Sidebar */}
      <aside className={`bg-gray-900 border-r border-gray-800 transition-all duration-300 ${
        sidebarOpen ? 'w-64' : 'w-20'
      } flex flex-col`}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-800">
          {sidebarOpen ? (
            <>
              <div className="flex items-center gap-2">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <span className="text-white font-bold">EPPs Monitor</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-400 hover:text-white mx-auto"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User Menu */}
        <div className="border-t border-gray-800 p-4">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-3 text-left hover:bg-gray-800 rounded-lg p-2 transition-colors"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                {user?.name.charAt(0)}
              </div>
              {sidebarOpen && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{user?.name}</p>
                    <p className="text-gray-400 text-xs truncate">{user?.role}</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${
                    userMenuOpen ? 'rotate-180' : ''
                  }`} />
                </>
              )}
            </button>

            {userMenuOpen && sidebarOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-800 rounded-lg shadow-xl border border-gray-700 overflow-hidden">
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-gray-700 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-gray-900 border-b border-gray-800 px-8 py-3 flex justify-end">
          <GlobalNotificationBell />
        </div>
        <Outlet />
      </div>
    </div>
  );
}
