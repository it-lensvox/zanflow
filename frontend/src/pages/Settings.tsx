import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { workspaceApi, api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import {
  Settings2,
  Palette,
  Plus,
  X,
  Check,
  Bell,
  Shield,
  Monitor,
  Cloud,
  Sun,
  Moon,
  LayoutGrid,
  Table2,
  Globe,
  Type,
  PanelLeft,
  BellRing,
  Mail,
  MessageSquare,
  ClipboardList,
  Volume2,
  Clock,
  Smartphone,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common';

// Toggle Switch
function Toggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? 'bg-primary' : 'bg-muted'
        }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
      />
    </button>
  );
}

// Segmented Control 
function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T; icon?: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-border bg-muted/40 p-1 gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${value === opt.value
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// Select Dropdown 
function SettingSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// Row
function SettingRow({
  icon,
  label,
  description,
  control,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-border last:border-0">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-muted-foreground">{icon}</span>
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <div className="ml-6 shrink-0">{control}</div>
    </div>
  );
}

// Section Card
function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="mt-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

// ✅ Workspace interface
interface Workspace {
  id: number;
  name: string;
  slug: string;
  description?: string;
  is_default: boolean;
  is_active: boolean;
  member_count: number;
  role: 'admin' | 'manager' | 'viewer' | 'annotator' | 'developer';
  created_by?: number;
  created_at: string;
  updated_at: string;
}

// ─── Workspace Management Section ────────────────────────────────────────────


function WorkspaceSection({ activeWorkspace, userRole }: { activeWorkspace: any; userRole: string }) {
  const queryClient = useQueryClient();
  const [isEditingName, setIsEditingName] = useState(false);
  const [workspaceName, setWorkspaceName] = useState(activeWorkspace?.name || '');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState('');
  const [nameSuccess, setNameSuccess] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedRole, setSelectedRole] = useState('viewer');
  const [isAdding, setIsAdding] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<number | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<number | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [toast, setToast] = useState('');

  // ── New confirmation states ──
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: number; name: string } | null>(null);

  const workspaceId = activeWorkspace?.id;
  const isAdminOrManager = ['admin', 'manager'].includes(activeWorkspace?.my_role || userRole);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  // ✅ Fetch workspace details (includes members)
  const { data: wsDetails, isLoading: wsLoading, refetch: refetchWs } = useQuery({
    queryKey: ['workspace-details', workspaceId],
    queryFn: () => workspaceApi.getWorkspaceDetails(workspaceId),
    enabled: !!workspaceId,
    staleTime: 0,
  });

  // ✅ Fetch available users when add modal opens
  const { data: availableData, isLoading: availLoading } = useQuery({
    queryKey: ['workspace-available-users', workspaceId, addSearch],
    queryFn: () => workspaceApi.getAvailableUsers(workspaceId, addSearch || undefined),
    enabled: !!workspaceId && showAddMember && isAdminOrManager,
    staleTime: 0,
  });

  const members = wsDetails?.members || [];
  const availableUsers = availableData?.users || [];

  const filteredMembers = members.filter((m: any) =>
    `${m.first_name} ${m.last_name} ${m.username} ${m.email}`.toLowerCase().includes(memberSearch.toLowerCase())
  );

  // ✅ Save workspace name
  const handleSaveName = async () => {
    if (!workspaceName.trim()) { setNameError('Name cannot be empty'); return; }
    setIsSavingName(true); setNameError('');
    try {
      await workspaceApi.updateWorkspace(workspaceId, { name: workspaceName.trim() });
      setNameSuccess('Workspace name updated!');
      setIsEditingName(false);
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-details', workspaceId] });
      setTimeout(() => setNameSuccess(''), 3000);
    } catch (e: any) {
      setNameError(e.response?.data?.detail || 'Failed to update name');
    } finally { setIsSavingName(false); }
  };

  // ✅ Add member
  const handleAddMember = async () => {
    if (!selectedUser) return;
    setIsAdding(true);
    try {
      await workspaceApi.addMember(workspaceId, selectedUser.user_id, selectedRole);
      showToast(`✓ ${selectedUser.first_name || selectedUser.username} added to workspace`);
      setShowAddMember(false);
      setSelectedUser(null);
      setAddSearch('');
      refetchWs();
      queryClient.invalidateQueries({ queryKey: ['workspace-available-users', workspaceId] });
    } catch (e: any) {
      showToast(`✕ ${e.response?.data?.message || 'Failed to add member'}`);
    } finally { setIsAdding(false); }
  };

  // ⚡ Updated Trigger Method: Instead of calling confirm(), setup state first
  const triggerRemoveConfirmation = (userId: number, userName: string) => {
    setUserToDelete({ id: userId, name: userName });
    setShowConfirmDelete(true);
  };

  // ✅ Confirmed removal execution handler
  const handleConfirmRemoveMember = async () => {
    if (!userToDelete) return;
    const { id: userId, name: userName } = userToDelete;
    
    setShowConfirmDelete(false);
    setUserToDelete(null);
    setRemovingUserId(userId);
    
    try {
      await workspaceApi.removeMember(workspaceId, userId);
      showToast(`✓ ${userName} removed from workspace`);
      refetchWs();
    } catch (e: any) {
      showToast(`✕ ${e.response?.data?.message || 'Failed to remove member'}`);
    } finally { setRemovingUserId(null); }
  };

  const handleUpdateRole = async (userId: number, newRole: string, userName: string) => {
    setUpdatingRoleId(userId);
    try {
      await workspaceApi.updateMemberRole(workspaceId, userId, newRole);
      showToast(`✓ ${userName}'s role updated to ${newRole}`);
      refetchWs();
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      queryClient.refetchQueries({ queryKey: ['workspaces'] });
    } catch (e: any) {
      showToast(`✕ ${e.response?.data?.message || 'Failed to update role'}`);
    } finally { setUpdatingRoleId(null); }
  };

  const roleColors: Record<string, { bg: string; color: string }> = {
    admin:     { bg: '#dcfce7', color: '#16a34a' },
    manager:   { bg: '#dbeafe', color: '#2563eb' },
    developer: { bg: '#f3e8ff', color: '#7c3aed' },
    viewer:    { bg: '#f3f4f6', color: '#6b7280' },
    annotator: { bg: '#fef9c3', color: '#ca8a04' },
  };

  return (
    <Card className="mt-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          Workspace Management
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">

        {/* ── Toast ── */}
        {toast && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13, fontWeight: 500,
            background: toast.startsWith('✕') ? '#FEF2F2' : '#F0FDF4',
            border: `1px solid ${toast.startsWith('✕') ? '#FECACA' : '#BBF7D0'}`,
            color: toast.startsWith('✕') ? '#DC2626' : '#16A34A',
          }}>
            {toast}
          </div>
        )}

        {/* ── Workspace Name ── */}
        <div className="py-4 border-b border-border">
          <p className="text-sm font-medium text-foreground mb-3">Workspace Name</p>
          {isEditingName ? (
            <div className="flex gap-2 items-start">
              <div className="flex-1">
                <input value={workspaceName} onChange={e => { setWorkspaceName(e.target.value); setNameError(''); }}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Workspace name" autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setIsEditingName(false); }}
                />
                {nameError && <p className="text-xs text-red-500 mt-1">{nameError}</p>}
                {nameSuccess && <p className="text-xs text-green-600 mt-1">{nameSuccess}</p>}
              </div>
              <button onClick={handleSaveName} disabled={isSavingName}
                className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {isSavingName ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => { setIsEditingName(false); setWorkspaceName(activeWorkspace?.name || ''); setNameError(''); }}
                className="px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted">
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                  {(wsDetails?.name || activeWorkspace?.name || 'W')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{wsDetails?.name || activeWorkspace?.name}</p>
                  <p className="text-xs text-muted-foreground">{activeWorkspace?.slug} · {wsDetails?.member_count || members.length} members</p>
                </div>
              </div>
              {isAdminOrManager && (
                <button onClick={() => { setIsEditingName(true); setWorkspaceName(wsDetails?.name || activeWorkspace?.name || ''); }}
                  className="text-xs text-primary hover:underline font-medium">Edit Name</button>
              )}
            </div>
          )}
        </div>

        {/* ── Members ── */}
        <div className="py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-foreground">
              Members <span className="text-muted-foreground font-normal">({members.length})</span>
            </p>
            {isAdminOrManager && (
              <button onClick={() => setShowAddMember(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90">
                <Plus className="h-3.5 w-3.5" /> Add Member
              </button>
            )}
          </div>

          {/* ── Add Member Modal ── */}
          {showAddMember && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddMember(false)} />
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <h3 className="text-base font-semibold text-gray-900">Add Member</h3>
                  <button onClick={() => { setShowAddMember(false); setSelectedUser(null); setAddSearch(''); }}
                    className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                  {/* Search */}
                  <div className="relative">
                    <input value={addSearch} onChange={e => setAddSearch(e.target.value)}
                      placeholder="Search users to add..."
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                  {/* Available users list */}
                  <div className="max-h-52 overflow-y-auto space-y-1 border border-gray-100 rounded-lg">
                    {availLoading ? (
                      <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
                    ) : availableUsers.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">No users available to add</p>
                    ) : availableUsers.map((u: any) => {
                      const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;
                      const isSelected = selectedUser?.user_id === u.user_id;
                      return (
                        <div key={u.user_id} onClick={() => setSelectedUser(isSelected ? null : u)}
                          className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
                          style={{ background: isSelected ? '#EEF2FF' : '' }}>
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {name[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                            <p className="text-xs text-gray-400 truncate">{u.email}</p>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                  {/* Role selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                    <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="developer">Developer</option>
                      <option value="annotator">Annotator</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                </div>
                {/* Footer */}
                <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
                  <button onClick={() => { setShowAddMember(false); setSelectedUser(null); setAddSearch(''); }}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Cancel
                  </button>
                  <button onClick={handleAddMember} disabled={!selectedUser || isAdding}
                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                    {isAdding ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Adding...</> : 'Add to Workspace'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── New Custom Confirmation Modal for Removing Members ── */}
          {showConfirmDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowConfirmDelete(false); setUserToDelete(null); }} />
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
                <div className="px-6 pt-6 pb-4">
                  <h3 className="text-base font-semibold text-gray-900 mb-2">Remove Workspace Member</h3>
                  <p className="text-sm text-gray-500">
                    Are you sure you want to remove <span className="font-semibold text-gray-800">{userToDelete?.name}</span> from this workspace?
                  </p>
                </div>
                <div className="flex gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
                  <button onClick={() => { setShowConfirmDelete(false); setUserToDelete(null); }}
                    className="flex-1 px-4 py-2 border border-gray-200 bg-white rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleConfirmRemoveMember}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
                    Remove
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Member search */}
          <div className="relative mb-3">
            <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
              placeholder="Search members..."
              className="w-full pl-8 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>

          {/* Member list */}
          {wsLoading ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {filteredMembers.map((member: any) => {
                const name = `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.username;
                const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                const roleStyle = roleColors[member.role] ?? roleColors.viewer;
                const isRemoving = removingUserId === member.user_id;
                const isUpdatingRole = updatingRoleId === member.user_id;
                return (
                  <div key={member.user_id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: '#4169FF' }}>
                      {initials}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{name}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                    {/* Role dropdown */}
                    {isAdminOrManager ? (
                      <div className="relative">
                        <select
                          value={member.role}
                          onChange={e => handleUpdateRole(member.user_id, e.target.value, name)}
                          disabled={isUpdatingRole}
                          className="text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
                          style={{ background: roleStyle.bg, color: roleStyle.color }}
                        >
                          <option value="viewer">VIEWER</option>
                          <option value="annotator">ANNOTATOR</option>
                          <option value="developer">DEVELOPER</option>
                          <option value="manager">MANAGER</option>
                          <option value="admin">ADMIN</option>
                        </select>
                        {isUpdatingRole && <div className="absolute inset-0 flex items-center justify-center"><div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}
                      </div>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: roleStyle.bg, color: roleStyle.color }}>
                        {member.role?.toUpperCase()}
                      </span>
                    )}
                    {/* Remove button — calls triggerRemoveConfirmation state handler now */}
                    {isAdminOrManager && (
                      <button onClick={() => triggerRemoveConfirmation(member.user_id, name)} disabled={isRemoving}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-all disabled:opacity-50 flex-shrink-0">
                        {isRemoving
                          ? <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                );
              })}
              {filteredMembers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No members found</p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Main Settings Page 
export function Settings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Configuration
  const [dataMode, setDataMode] = useState<'local' | 'cloud'>('cloud');
  const [defaultView, setDefaultView] = useState<'grid' | 'table'>('grid');
  const [language, setLanguage] = useState('en');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');

  // Appearance
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [fontSize, setFontSize] = useState('medium');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Notifications
  const [desktopNotifs, setDesktopNotifs] = useState(true);
  const [emailNotifs, setEmailNotifs] = useState(false);
  const [chatMentions, setChatMentions] = useState(true);
  const [taskAssignments, setTaskAssignments] = useState(true);
  const [notifSound, setNotifSound] = useState(true);

  // Security
  const [autoLogout, setAutoLogout] = useState('30');
  const [sessionAlerts, setSessionAlerts] = useState(true);

  // ✅ Delete Workspace State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // ✅ Fetch workspace data
  const { data: workspaceData } = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspaceApi.getWorkspaces,
  });

  const workspaces = workspaceData?.workspaces || [];
  const activeWorkspaceId = workspaceData?.active_workspace_id || workspaceApi.getActiveWorkspaceId();
  const activeWorkspace = workspaces.find((w: Workspace) => w.id === activeWorkspaceId);

  // ✅ Check if user can delete current workspace
  const canDeleteWorkspace = (): boolean => {
    if (!activeWorkspace) return false;
    if (activeWorkspace.is_default) return false;
    if (activeWorkspace.created_by && user?.id) {
      return activeWorkspace.created_by === user.id;
    }
    return false;
  };

  // ✅ Handle Delete Workspace
  const handleDeleteWorkspace = async () => {
    if (!activeWorkspace) return;

    setIsDeleting(true);

    try {
      await workspaceApi.deleteWorkspace(activeWorkspace.id);

      // Switch to default workspace
      const defaultWorkspace = workspaces.find((w: Workspace) => w.is_default);
      if (defaultWorkspace) {
        localStorage.setItem('active_workspace_id', String(defaultWorkspace.id));
      }

      setShowDeleteModal(false);
      setDeleteConfirmText('');

      // Refetch and reload
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      window.location.href = '/';
    } catch (error: any) {
      console.error('Failed to delete workspace:', error);
      alert(error.message || 'Failed to delete workspace');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold text-foreground">Settings</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage your preferences and account configuration
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {/* ── Configuration ── */}
          <SectionCard title="Configuration">
            <SettingRow
              icon={<Monitor className="h-4 w-4" />}
              label="Data Mode"
              description="Choose where your data is stored and synced"
              control={
                <SegmentedControl
                  options={[
                    { label: 'Local', value: 'local', icon: <Monitor className="h-3.5 w-3.5" /> },
                    { label: 'Cloud', value: 'cloud', icon: <Cloud className="h-3.5 w-3.5" /> },
                  ]}
                  value={dataMode}
                  onChange={setDataMode}
                />
              }
            />
            <SettingRow
              icon={<LayoutGrid className="h-4 w-4" />}
              label="Default Project View"
              description="How projects and tasks are displayed by default"
              control={
                <SegmentedControl
                  options={[
                    { label: 'Grid', value: 'grid', icon: <LayoutGrid className="h-3.5 w-3.5" /> },
                    { label: 'Table', value: 'table', icon: <Table2 className="h-3.5 w-3.5" /> },
                  ]}
                  value={defaultView}
                  onChange={setDefaultView}
                />
              }
            />
            <SettingRow
              icon={<Globe className="h-4 w-4" />}
              label="Language"
              description="Interface display language"
              control={
                <SettingSelect
                  value={language}
                  onChange={setLanguage}
                  options={[
                    { label: 'English', value: 'en' },
                    { label: 'Hindi', value: 'hi' },
                    { label: 'Spanish', value: 'es' },
                    { label: 'French', value: 'fr' },
                  ]}
                />
              }
            />
            <SettingRow
              icon={<Clock className="h-4 w-4" />}
              label="Date Format"
              description="How dates appear across the app"
              control={
                <SettingSelect
                  value={dateFormat}
                  onChange={setDateFormat}
                  options={[
                    { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
                    { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
                    { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
                  ]}
                />
              }
            />
          </SectionCard>

          {/* ── Appearance ── */}
          <SectionCard title="Appearance">
            <SettingRow
              icon={<Palette className="h-4 w-4" />}
              label="Theme"
              description="Choose your preferred color scheme"
              control={
                <SegmentedControl
                  options={[
                    { label: 'Light', value: 'light', icon: <Sun className="h-3.5 w-3.5" /> },
                    { label: 'Dark', value: 'dark', icon: <Moon className="h-3.5 w-3.5" /> },
                  ]}
                  value={theme}
                  onChange={setTheme}
                />
              }
            />
            <SettingRow
              icon={<Type className="h-4 w-4" />}
              label="Font Size"
              description="Adjust text size for readability"
              control={
                <SettingSelect
                  value={fontSize}
                  onChange={setFontSize}
                  options={[
                    { label: 'Small', value: 'small' },
                    { label: 'Medium', value: 'medium' },
                    { label: 'Large', value: 'large' },
                  ]}
                />
              }
            />
            <SettingRow
              icon={<PanelLeft className="h-4 w-4" />}
              label="Collapsed Sidebar by Default"
              description="Start with the sidebar minimized on load"
              control={
                <Toggle enabled={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
              }
            />
          </SectionCard>

          {/* ── Notifications ── */}
          <SectionCard title="Notifications">
            <SettingRow
              icon={<BellRing className="h-4 w-4" />}
              label="Desktop Notifications"
              description="Push alerts in your browser"
              control={
                <Toggle enabled={desktopNotifs} onToggle={() => setDesktopNotifs(!desktopNotifs)} />
              }
            />
            <SettingRow
              icon={<Mail className="h-4 w-4" />}
              label="Email Notifications"
              description="Receive updates to your inbox"
              control={
                <Toggle enabled={emailNotifs} onToggle={() => setEmailNotifs(!emailNotifs)} />
              }
            />
            <SettingRow
              icon={<MessageSquare className="h-4 w-4" />}
              label="Chat Mention Alerts"
              description="Notify when someone @mentions you in chat"
              control={
                <Toggle enabled={chatMentions} onToggle={() => setChatMentions(!chatMentions)} />
              }
            />
            <SettingRow
              icon={<ClipboardList className="h-4 w-4" />}
              label="Task Assignment Alerts"
              description="Notify when a task is assigned to you"
              control={
                <Toggle enabled={taskAssignments} onToggle={() => setTaskAssignments(!taskAssignments)} />
              }
            />
            <SettingRow
              icon={<Volume2 className="h-4 w-4" />}
              label="Notification Sound"
              description="Play a sound for incoming notifications"
              control={
                <Toggle enabled={notifSound} onToggle={() => setNotifSound(!notifSound)} />
              }
            />
          </SectionCard>

          {/* ── Workspace Management ── */}
          <WorkspaceSection
            activeWorkspace={activeWorkspace}
            userRole={user?.role || ''}
          />

          {/* ── Security ── */}
          <SectionCard title="Security">
            <SettingRow
              icon={<Clock className="h-4 w-4" />}
              label="Auto-logout Timeout"
              description="Sign out automatically after inactivity"
              control={
                <SettingSelect
                  value={autoLogout}
                  onChange={setAutoLogout}
                  options={[
                    { label: '15 minutes', value: '15' },
                    { label: '30 minutes', value: '30' },
                    { label: '1 hour', value: '60' },
                    { label: 'Never', value: '0' },
                  ]}
                />
              }
            />
            <SettingRow
              icon={<Smartphone className="h-4 w-4" />}
              label="Active Session Alerts"
              description="Get notified when a new device logs into your account"
              control={
                <Toggle enabled={sessionAlerts} onToggle={() => setSessionAlerts(!sessionAlerts)} />
              }
            />

            {/* ✅ DANGER ZONE - Delete Workspace */}
            {activeWorkspace && canDeleteWorkspace() && (
              <>
                <div className="pt-6 mt-4 border-t-2 border-red-200">
                  <div className="flex items-start gap-3 mb-4">
                    <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-semibold text-red-600 mb-1">
                        Danger Zone
                      </h3>
                      <p className="text-xs text-gray-600">
                        Irreversible and destructive actions
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-gray-900 mb-1">
                          Delete Workspace
                        </h4>
                        <p className="text-xs text-gray-600 mb-2">
                          Permanently delete "{activeWorkspace.name}" and all its data
                        </p>
                        <ul className="text-xs text-gray-600 space-y-0.5 list-disc list-inside">
                          <li>All projects and tasks will be deleted</li>
                          <li>All documents and files will be removed</li>
                          <li>All members will lose access</li>
                          <li>This action cannot be undone</li>
                        </ul>
                      </div>
                      <button
                        onClick={() => setShowDeleteModal(true)}
                        className="ml-4 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Workspace
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </SectionCard>
        </div>
      </div>

      {/* ✅ Delete Confirmation Modal */}
      {showDeleteModal && activeWorkspace && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Workspace?</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>

            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 font-medium mb-2">
                You are about to permanently delete "{activeWorkspace.name}"
              </p>
              <p className="text-xs text-red-700">
                This will permanently delete:
              </p>
              <ul className="text-xs text-red-700 list-disc list-inside mt-1 space-y-0.5">
                <li>All projects in this workspace</li>
                <li>All tasks and documents</li>
                <li>All team data and chat rooms</li>
                <li>All workspace members will lose access</li>
              </ul>
            </div>

            {/* Confirmation Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type <span className="font-semibold text-red-600">"{activeWorkspace.name}"</span> to confirm:
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={activeWorkspace.name}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                  autoFocus
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {deleteConfirmText.length > 0 && (
                    <>
                      {deleteConfirmText === activeWorkspace.name ? (
                        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              {deleteConfirmText.length > 0 && deleteConfirmText !== activeWorkspace.name && (
                <p className="mt-1 text-xs text-red-600">
                  Workspace name does not match
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                }}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteWorkspace}
                disabled={isDeleting || deleteConfirmText !== activeWorkspace.name}
                className="flex-1 px-4 py-2 bg-red-600 rounded-lg text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Permanently
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}