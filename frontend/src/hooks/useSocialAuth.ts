// Handles all OAuth logic for both Google and Microsoft.

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { toast } from 'sonner';
import { socialAuthApi, authApi, setTokens, api, startProactiveRefresh } from '@/services/api';
import { msalLoginRequest } from '@/config/oauthConfig';
import type { SocialProvider } from '@/types';

// These are the error messages the backend sends
const BACKEND_ERROR_MESSAGES: Record<string, string> = {
  // Provider-level errors
  "provider must be 'google' or 'microsoft'": 'Invalid authentication provider.',
  'token is required': 'Authentication failed. Please try again.',
  // Company name errors — matches the exact string Django returns
  'An organisation with this name already exists.': 'A company with this name already exists. Please choose a different name.',
  'company_name already exists': 'A company with this name already exists. Please choose a different name.',
  // Email errors
  'email already has a Dyuksa account': 'An account with this email already exists. Please log in instead.',
  'A user with this email already exists.': 'An account with this email already exists. Please log in instead.',
  // Token errors
  'Invalid or expired Google token': 'Your Google session expired. Please try again.',
  'Invalid or expired Microsoft token': 'Your Microsoft session expired. Please try again.',
  // Account errors
  'Account has been deactivated': 'This account has been deactivated. Please contact your administrator.',
  'No Dyuksa account found for this email': 'No account found for this email. Please sign up or contact your admin.',
};

function getFriendlyError(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as any).response;
    const data = response?.data;

    if (!data) return 'Authentication failed. Please try again.';

    // 1. Standard flat error fields
    const flat = data.detail || data.message || data.error || data.non_field_errors?.[0] || '';
    if (flat) return BACKEND_ERROR_MESSAGES[flat] ?? flat;

    // 2. Django field-level errors 
    for (const fieldErrors of Object.values(data)) {
      if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
        const msg = String(fieldErrors[0]);
        return BACKEND_ERROR_MESSAGES[msg] ?? msg;
      }
    }
  }
  return 'Authentication failed. Please try again.';
}

interface UseSocialAuthOptions {
  mode: 'login' | 'signup';
  onTokenReceived?: (provider: SocialProvider, token: string) => void;
  loginWithUser: (user: import('@/types').User) => void;
}

interface UseSocialAuthReturn {
  isLoading: boolean;
  handleGoogleSuccess: (credential: string) => Promise<void>;
  handleGoogleError: () => void;
  handleMicrosoftLogin: () => Promise<void>;
  completeSocialSignup: (provider: SocialProvider, token: string, companyName: string) => Promise<string | null>;
}

export function useSocialAuth({ mode, onTokenReceived, loginWithUser }: UseSocialAuthOptions): UseSocialAuthReturn {
  const navigate = useNavigate();
  const { instance: msalInstance } = useMsal();
  const [isLoading, setIsLoading] = useState(false);

  // Internal: calls the backend and handles token storage + redirect
  const callBackend = useCallback(
    async (provider: SocialProvider, token: string, companyName?: string): Promise<string | null> => {
      setIsLoading(true);
      try {
        const payload = companyName
          ? { provider, token, company_name: companyName }
          : { provider, token };

        const response = await socialAuthApi.authenticate(payload);
        const { access, refresh } = response.tokens;

        setTokens({ access, refresh });
        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);

        // 3. Axios default header 
        api.defaults.headers.common['Authorization'] = `Bearer ${access}`;

        // 4. Start proactive refresh timer
        startProactiveRefresh();

        // 5. Fetch user and set auth state 
        const userData = await authApi.getMe();
        loginWithUser(userData);

        navigate('/dashboard', { replace: true });
        return null;
      } catch (error) {
        const msg = getFriendlyError(error);
        if (!companyName) {
          toast.error(msg);
        }
        return msg;
      } finally {
        setIsLoading(false);
      }
    },
    [navigate, loginWithUser]
  );

  const handleGoogleSuccess = useCallback(
    async (credential: string) => {
      if (mode === 'signup' && onTokenReceived) {
        onTokenReceived('google', credential);
      } else {
        await callBackend('google', credential);
      }
    },
    [mode, onTokenReceived, callBackend]
  );

  const handleGoogleError = useCallback(() => {
    toast.error('Google sign-in was cancelled or failed. Please try again.');
  }, []);

  const handleMicrosoftLogin = useCallback(async () => {
    try {
      const result = await msalInstance.loginPopup(msalLoginRequest);
      const accessToken = result.accessToken;

      if (mode === 'signup' && onTokenReceived) {
        onTokenReceived('microsoft', accessToken);
      } else {
        await callBackend('microsoft', accessToken);
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'BrowserAuthError') return;
      toast.error('Microsoft sign-in failed. Please try again.');
    }
  }, [msalInstance, mode, onTokenReceived, callBackend]);

  const completeSocialSignup = useCallback(
    async (provider: SocialProvider, token: string, companyName: string): Promise<string | null> => {
      return callBackend(provider, token, companyName);
    },
    [callBackend]
  );

  return {
    isLoading,
    handleGoogleSuccess,
    handleGoogleError,
    handleMicrosoftLogin,
    completeSocialSignup,
  };
}