const CREDENTIALS_KEY = 'auth_credentials';

export const saveCredentials = (username: string, password: string) => {
  console.log('[AuthStorage] Saving credentials:', {
    username,
    password,
  });

  localStorage.setItem(
    CREDENTIALS_KEY,
    JSON.stringify({ username, password })
  );
};

export const getCredentials = (): {
  username: string;
  password: string;
} | null => {
  const data = localStorage.getItem(CREDENTIALS_KEY);
  return data ? JSON.parse(data) : null;
};

export const clearCredentials = () => {
  localStorage.removeItem(CREDENTIALS_KEY);
};
