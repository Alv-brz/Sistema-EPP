import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { loginRequest, meRequest } from '../services/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'supervisor' | 'inspector';
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('access_token');
    if (savedUser && savedToken) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('user');
        localStorage.removeItem('access_token');
        setIsLoading(false);
        return;
      }
      meRequest(savedToken)
        .catch(() => {
          localStorage.removeItem('user');
          localStorage.removeItem('access_token');
          setUser(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await loginRequest(email, password);
      const authenticatedUser: User = {
        id: response.user.id,
        name: response.user.name,
        email: response.user.email,
        role: response.user.role,
      };

      setUser(authenticatedUser);
      localStorage.setItem('user', JSON.stringify(authenticatedUser));
      localStorage.setItem('access_token', response.access_token);
      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
