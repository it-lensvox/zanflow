/**
 * Central auth utility — single source of truth for all token
 * operations and platform-specific auth logic.
 * Import from here; never call auth endpoints directly elsewhere.
 */

// ── Token payload shape (richer JWT from the Central Auth backend) ────────────
export interface TokenPayload {
  user_id: number;
  username: string;
  email: string;
  role: string;
  org_id: number;
  org_slug: string;
  org_name: string;
  platforms: string[];   // e.g. ["pm"] or ["pm", "hrms"]
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

/** Read role directly from the JWT — avoids a separate API call. */
export function getRoleFromToken(): string | null {
  const token = localStorage.getItem('access_token');
  if (!token) return null;
  return decodeTokenPayload(token)?.role ?? null;
}