import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
// Disable automatic refetch on window focus globally
focusManager.setEventListener(() => {
  return () => {};
});

// Disable online/offline tracking to prevent reconnect refetches
onlineManager.setEventListener(() => {
  return () => {};
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      gcTime: Infinity,              
      refetchOnWindowFocus: false,   
      refetchOnMount: false, 
      refetchOnReconnect: false,     
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);