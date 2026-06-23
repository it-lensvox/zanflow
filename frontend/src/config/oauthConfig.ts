// Central config for all OAuth providers.

export const GOOGLE_CLIENT_ID = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID as string;
export const AZURE_CLIENT_ID = (import.meta as any).env.VITE_AZURE_CLIENT_ID as string;

export const msalConfig = {
  auth: {
    clientId: AZURE_CLIENT_ID,
    // 'common' allows both personal Microsoft accounts and work/school accounts
    authority: 'https://login.microsoftonline.com/common',
    // Must match exactly what is registered in Azure portal
    redirectUri: window.location.origin,
  },
  cache: {
    // sessionStorage is safer than localStorage for OAuth state
    cacheLocation: 'sessionStorage' as const,
    storeAuthStateInCookie: false,
  },
};

// Minimum Microsoft scopes needed — User.Read lets backend call /me
export const msalLoginRequest = {
  scopes: ['User.Read'],
};