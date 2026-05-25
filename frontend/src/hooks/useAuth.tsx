import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { authApi, getTokens, setTokens, API_URL } from '@/services/api';
import { saveCredentials, clearCredentials } from '@/services/authStorage';   

import type { User, AuthTokens } from '@/types';

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
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleTokenRefresh = useCallback(() => {
    // Clear any existing timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    const tokens = getTokens();
    if (!tokens?.access) return;

    try {
      // Decode JWT payload to get expiry time
      const payloadBase64 = tokens.access.split('.')[1];
      const payload = JSON.parse(atob(payloadBase64));
      const expiresAtMs = payload.exp * 1000;
      const now = Date.now();

      // Refresh 5 minutes before expiry
      const REFRESH_BUFFER_MS = 5 * 60 * 1000;
      const delay = expiresAtMs - now - REFRESH_BUFFER_MS;

      if (delay <= 0) {
        performTokenRefresh();
        return;
      }

      // Don't capture refresh token in closure — read fresh from localStorage when timer fires
      refreshTimerRef.current = setTimeout(() => {
        performTokenRefresh();
      }, delay);
    } catch {
      // If JWT decoding fails, don't schedule (interceptor will handle it)
    }
  }, []);

  const performTokenRefresh = useCallback(async () => {
    // Always read the LATEST tokens from localStorage to avoid using a stale/blacklisted refresh token
    const currentTokens = getTokens();
    if (!currentTokens?.refresh) return;

    try {
      const response = await axios.post<AuthTokens>(`${API_URL}/auth/refresh/`, {
        refresh: currentTokens.refresh,
      });
      const newTokens = response.data;
      setTokens(newTokens);

      // Schedule the next refresh for the new token
      scheduleTokenRefresh();
    } catch {
      // Refresh failed silently - the response interceptor will handle it
      // on the next API call
    }
  }, [scheduleTokenRefresh]);

  // // Schedule refresh whenever the user changes (login/logout)
  // useEffect(() => {
  //   if (user) {
  //     scheduleTokenRefresh();
  //   }

  //   return () => {
  //     if (refreshTimerRef.current) {
  //       clearTimeout(refreshTimerRef.current);
  //       refreshTimerRef.current = null;
  //     }
  //   };
  // }, [user, scheduleTokenRefresh]);

  // Schedule refresh whenever the user changes (login/logout)
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);


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