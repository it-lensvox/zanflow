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

// Instantiated once at module level
const msalInstance = new PublicClientApplication(msalConfig);

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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <MsalProvider instance={msalInstance}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </MsalProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);