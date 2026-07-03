// ─── Role Config ──────────────────────────────────────────────────────────────
// Single source of truth for user role colors and options.
// Replaces: ROLE_BADGE (Settings), ROLE_COLORS (CreateWorkspaceModal — had admin=red bug),
//           getRoleColorConfig (userManagementConfig).

import type { User } from '@/types';

export type UserRole = User['role'];

export interface RoleConfig {
  value: UserRole;
  label: string;
  /** Badge background */
  bg: string;
  /** Badge text color */
  color: string;
  /** Tailwind bg class */
  twBg: string;
  /** Tailwind text class */
  twText: string;
  /** Uppercase display label for compact badges */
  badgeLabel: string;
}

export const ROLE_CONFIG: Record<UserRole, RoleConfig> = {
  admin: {
    value: 'admin', label: 'Admin', badgeLabel: 'ADMIN',
    bg: '#dcfce7', color: '#16a34a',
    twBg: 'bg-green-50', twText: 'text-green-800',
  },
  manager: {
    value: 'manager', label: 'Manager', badgeLabel: 'MANAGER',
    bg: '#dbeafe', color: '#2563eb',
    twBg: 'bg-blue-50', twText: 'text-blue-800',
  },
  developer: {
    value: 'developer', label: 'Developer', badgeLabel: 'DEVELOPER',
    bg: '#f3e8ff', color: '#7c3aed',
    twBg: 'bg-purple-50', twText: 'text-purple-800',
  },
  annotator: {
    value: 'annotator', label: 'Annotator', badgeLabel: 'ANNOTATOR',
    bg: '#fef9c3', color: '#ca8a04',
    twBg: 'bg-yellow-50', twText: 'text-yellow-800',
  },
  viewer: {
    value: 'viewer', label: 'Viewer', badgeLabel: 'VIEWER',
    bg: '#f3f4f6', color: '#6b7280',
    twBg: 'bg-gray-50', twText: 'text-gray-800',
  },
};

/** Ordered list for role dropdowns */
export const ROLE_OPTIONS: RoleConfig[] = [
  ROLE_CONFIG.admin,
  ROLE_CONFIG.manager,
  ROLE_CONFIG.developer,
  ROLE_CONFIG.annotator,
  ROLE_CONFIG.viewer,
];

const _DEFAULT_ROLE = ROLE_CONFIG.viewer;

/** Returns full config for a role. Falls back to viewer. */
export function getRoleConfig(role?: string): RoleConfig {
  const key = (role || '').toLowerCase() as UserRole;
  return ROLE_CONFIG[key] ?? _DEFAULT_ROLE;
}