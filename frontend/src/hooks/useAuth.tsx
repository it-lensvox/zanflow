import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, getTokens, clearTokens } from '@/services/api';
import { saveCredentials, clearCredentials } from '@/services/authStorage';

import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (role: User['role']) => boolean;
  isAllowed: (roles: User['role'][]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const initAuth = async () => {
      const tokens = getTokens();

      if (tokens?.access) {
        try {
          const userData = await authApi.getMe();
          setUser(userData);
        } catch (error: any) {
          if (error.response?.status !== 401 && error.response?.status !== 403) {
            setUser(null);
          }
          setUser(null);
        }
      } else {
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  // Listen for token expiry events from API interceptor
  useEffect(() => {
    const handleTokenExpired = () => {
      setUser(null);
      navigate('/login');
    };
    window.addEventListener('auth:token-expired', handleTokenExpired);
    return () => {
      window.removeEventListener('auth:token-expired', handleTokenExpired);
    };
  }, [navigate]);

  const login = async (username: string, password: string) => {
    await authApi.login(username, password);
    saveCredentials(username, password);

    const userData = await authApi.getMe();
    setUser(userData);
    navigate('/');
  };
  const logout = () => {
    authApi.logout();
    clearCredentials();
    setUser(null);
    navigate('/login');
  };



  const hasRole = (role: User['role']) => {
    const result = user?.role === role;
    return result;
  };

  // Check if user role is in the allowed roles
  const isAllowed = (roles: User['role'][]) => {
    const userRole = user?.role;
    const result = !!userRole && roles.includes(userRole);
    return result;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        hasRole,
        isAllowed,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}