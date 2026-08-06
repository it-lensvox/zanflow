export const saveCredentials = (_username: string, _password: string) => {
};

export const getCredentials = (): null => null;

export const clearCredentials = () => {
  localStorage.removeItem('auth_credentials');
};
