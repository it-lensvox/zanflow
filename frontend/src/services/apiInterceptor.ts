import './api';

// Helper to get active workspace ID
export const getActiveWorkspaceId = (): string | null => {
  return localStorage.getItem('active_workspace_id');
};

// Helper to set active workspace ID
export const setActiveWorkspaceId = (workspaceId: number | string): void => {
  localStorage.setItem('active_workspace_id', String(workspaceId));
};

// Interceptor to add X-Workspace-ID header to all requests
export const fetchWithWorkspace = async (
  url: string, 
  options: RequestInit = {}
): Promise<Response> => {
  const workspaceId = getActiveWorkspaceId();
  const token = localStorage.getItem('access_token');
  
  // Prepare headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Add existing headers from options
  if (options.headers) {
    const optionsHeaders = options.headers as Record<string, string>;
    Object.assign(headers, optionsHeaders);
  }
  
  // Add Authorization header
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // ✅ Add X-Workspace-ID header
  if (workspaceId) {
    headers['X-Workspace-ID'] = workspaceId;
  }

  // Make the request
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });
};