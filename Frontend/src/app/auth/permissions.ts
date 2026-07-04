export type UserRole = 'admin' | 'supervisor' | 'inspector';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  inspector: 'Inspector',
};

export const ROUTE_ROLES: Record<string, UserRole[]> = {
  '/': ['admin', 'supervisor', 'inspector'],
  '/monitoring': ['admin', 'supervisor', 'inspector'],
  '/violations': ['admin', 'supervisor', 'inspector'],
  '/reports': ['admin', 'supervisor'],
  '/cameras': ['admin', 'supervisor'],
  '/areas': ['admin'],
  '/users': ['admin'],
  '/settings': ['admin'],
};

export function hasRole(role: UserRole | undefined | null, allowedRoles: UserRole[]): boolean {
  return Boolean(role && allowedRoles.includes(role));
}

export function canAccessRoute(role: UserRole | undefined | null, pathname: string): boolean {
  const normalizedPath = pathname === '/' ? '/' : `/${pathname.split('/').filter(Boolean)[0] ?? ''}`;
  return hasRole(role, ROUTE_ROLES[normalizedPath] ?? []);
}

export function canManageCameras(role: UserRole | undefined | null): boolean {
  return role === 'admin';
}

export function canControlCameras(role: UserRole | undefined | null): boolean {
  return role === 'admin' || role === 'supervisor';
}

export function canExportData(role: UserRole | undefined | null): boolean {
  return role === 'admin' || role === 'supervisor';
}

