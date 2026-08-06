export type UserRole = string;

export interface RoleConfig {
  value: string;
  label: string;
  bg: string;
  color: string;
  twBg: string;
  twText: string;
  badgeLabel: string;
}

export const ROLE_CONFIG: Record<string, RoleConfig> = {
  // New PM roles
  pm_admin: {
    value: 'pm_admin', label: 'PM Admin', badgeLabel: 'PM ADMIN',
    bg: '#dcfce7', color: '#16a34a',
    twBg: 'bg-green-50', twText: 'text-green-800',
  },
  workspace_admin: {
    value: 'workspace_admin', label: 'Workspace Admin', badgeLabel: 'WS ADMIN',
    bg: '#dbeafe', color: '#2563eb',
    twBg: 'bg-blue-50', twText: 'text-blue-800',
  },
  workspace_member: {
    value: 'workspace_member', label: 'Workspace Member', badgeLabel: 'WS MEMBER',
    bg: '#f3f4f6', color: '#6b7280',
    twBg: 'bg-gray-50', twText: 'text-gray-800',
  },
  project_admin: {
    value: 'project_admin', label: 'Project Admin', badgeLabel: 'PROJ ADMIN',
    bg: '#f3e8ff', color: '#7c3aed',
    twBg: 'bg-purple-50', twText: 'text-purple-800',
  },
  project_manager: {
    value: 'project_manager', label: 'Project Manager', badgeLabel: 'PROJ MGR',
    bg: '#dbeafe', color: '#2563eb',
    twBg: 'bg-blue-50', twText: 'text-blue-800',
  },
  project_member: {
    value: 'project_member', label: 'Project Member', badgeLabel: 'PROJ MEMBER',
    bg: '#fef9c3', color: '#ca8a04',
    twBg: 'bg-yellow-50', twText: 'text-yellow-800',
  },
  project_viewer: {
    value: 'project_viewer', label: 'Project Viewer', badgeLabel: 'VIEWER',
    bg: '#f3f4f6', color: '#6b7280',
    twBg: 'bg-gray-50', twText: 'text-gray-800',
  },
  // Legacy roles (kept for backward compat during migration)
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

/** Ordered list for workspace-level role dropdowns */
export const ROLE_OPTIONS: RoleConfig[] = [
  ROLE_CONFIG.pm_admin,
  ROLE_CONFIG.workspace_admin,
  ROLE_CONFIG.workspace_member,
];

/** Ordered list for project-level role dropdowns */
export const PROJECT_ROLE_OPTIONS: RoleConfig[] = [
  ROLE_CONFIG.project_admin,
  ROLE_CONFIG.project_manager,
  ROLE_CONFIG.project_member,
  ROLE_CONFIG.project_viewer,
];

const _DEFAULT_ROLE = ROLE_CONFIG.workspace_member;

/** Returns full config for a role. Falls back to workspace_member. */
export function getRoleConfig(role?: string): RoleConfig {
  const key = (role || '').toLowerCase();
  return ROLE_CONFIG[key] ?? _DEFAULT_ROLE;
}