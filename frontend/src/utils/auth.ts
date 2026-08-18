// ── Token payload shape 
export interface TokenPayload {
  user_id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  org_id: number;
  org_slug: string;
  org_name: string;
  platforms: string[];
  platform_roles: {
    all?: string;
    pm?: string;
    hrms?: string;
    [key: string]: string | undefined;
  };
  exp: number;
  iat: number;
}

/** Decode a JWT without verifying signature (verification is backend's job). */
export function decodeTokenPayload(token: string): TokenPayload | null {
  try {
    const base64 = token.split('.')[1];
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as TokenPayload;
  } catch {
    return null;
  }
}

/** Returns true only if the stored access token contains "pm" in platforms. */
export function hasPMAccess(): boolean {
  const token = localStorage.getItem('access_token');
  if (!token) return false;
  const payload = decodeTokenPayload(token);
  return Array.isArray(payload?.platforms) && payload.platforms.includes('pm');
}

/** Read org info directly from the JWT — avoids a separate API call. */
export function getOrgFromToken(): { id: number; slug: string; name: string } | null {
  const token = localStorage.getItem('access_token');
  if (!token) return null;
  const payload = decodeTokenPayload(token);
  if (!payload?.org_id) return null;
  return { id: payload.org_id, slug: payload.org_slug, name: payload.org_name };
}

/** Read PM workspace role from JWT platform_roles.pm */
export function getPMRoleFromToken(): string | null {
  const token = localStorage.getItem('access_token');
  if (!token) return null;
  return decodeTokenPayload(token)?.platform_roles?.pm ?? null;
}

/** Fetch project-level role from backend — call when entering any project view */
export async function getProjectRole(projectId: number): Promise<string | null> {
  const token = localStorage.getItem('access_token');
  if (!token) return null;
  const workspaceId = localStorage.getItem('active_workspace_id') || '1';
  try {
    const res = await fetch(`/api/v1/rbac/assignments/?project_id=${projectId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Workspace-ID': workspaceId,
      },
    });
    const data = await res.json();
    return data.role ?? null;
  } catch {
    return null;
  }
}