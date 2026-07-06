import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { GOOGLE_CLIENT_ID, msalConfig } from '@/config/oauthConfig';
import App from './App';
import './index.css';

// MSAL requires crypto.subtle which is only available on secure origins
// (https or localhost). On HTTP + IP (used by backend team for dev),
// we skip MSAL initialization to prevent a blank screen crash.
const isSecureOrigin =
  window.location.protocol === 'https:' ||
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';

const msalInstance = isSecureOrigin
  ? new PublicClientApplication(msalConfig)
  : null;

// Disable automatic refetch on window focus globally
focusManager.setEventListener(() => {
  return () => { };
});

// Disable online/offline tracking to prevent reconnect refetches
onlineManager.setEventListener(() => {
  return () => { };
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      gcTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

const AppWithProviders = () => (
  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    {msalInstance ? (
      <MsalProvider instance={msalInstance}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </MsalProvider>
    ) : (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    )}
  </GoogleOAuthProvider>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppWithProviders />
  </React.StrictMode>
);