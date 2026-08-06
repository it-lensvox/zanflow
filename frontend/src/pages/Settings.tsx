import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { workspaceApi } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import {
  Settings2, Palette, Plus, X, Check,
  Monitor, Cloud, Sun, Moon, LayoutGrid, Table2,
  Globe, Type, PanelLeft, BellRing, Mail, MessageSquare,
  ClipboardList, Volume2, Clock, Smartphone, Trash2, AlertTriangle,
} from 'lucide-react';
import { getRoleConfig } from '@/config/roleConfig';

// Design tokens — CSS variable references so they adapt to dark mode automatically
const PAGE_BG = 'hsl(var(--background))';
const CARD: React.CSSProperties = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(16,24,40,.05)',
};
const TEXT_PRIMARY = 'hsl(var(--foreground))';
const TEXT_SECONDARY = 'hsl(var(--muted-foreground))';
const TEXT_MUTED = 'hsl(var(--muted-foreground))';
const BORDER = 'hsl(var(--border))';
const BLUE = '#1663F6';

// ─── Reusable primitives ──────────────────────────────────────────────────────

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        position: 'relative', display: 'inline-flex', alignItems: 'center',
        width: 40, height: 22, borderRadius: 99, border: 'none', cursor: 'pointer',
        background: enabled ? BLUE : '#D1D5DB', transition: 'background .2s', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', width: 16, height: 16, borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,.15)',
        left: enabled ? 20 : 4, transition: 'left .2s',
      }} />
    </button>
  );
}

function SegmentedControl<T extends string>({
  options, value, onChange,
}: {
  options: { label: string; value: T; icon?: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{
      display: 'flex', background: 'hsl(var(--muted))', borderRadius: 8,
      padding: 3, gap: 2, flexShrink: 0, flexWrap: 'nowrap',
    }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 500, transition: 'all .15s',
            whiteSpace: 'nowrap', flexShrink: 0,
            background: value === opt.value ? 'hsl(var(--card))' : 'transparent',
            color: value === opt.value ? TEXT_PRIMARY : TEXT_SECONDARY,
            boxShadow: value === opt.value ? '0 1px 3px rgba(16,24,40,.08)' : 'none',
          }}
        >
          {opt.icon}{opt.label}
        </button>
      ))}
    </div>
  );
}

function SettingSelect({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const selectedLabel = options.find(o => o.value === value)?.label ?? value;

  const handleOpen = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (open) { setOpen(false); setAnchor(null); return; }
    const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
    setAnchor({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setOpen(true);
  };

  return (
    <>
      {/* Trigger button — styled like a pill select */}
      <button
        onClick={handleOpen}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          border: `1px solid ${BORDER}`, borderRadius: 6, background: 'hsl(var(--card))',
          padding: '5px 10px', fontSize: 14, color: TEXT_PRIMARY,
          cursor: 'pointer', outline: 'none', whiteSpace: 'nowrap',
        }}
      >
        {selectedLabel}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={TEXT_MUTED} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Portal dropdown — renders in document.body, escapes all overflow containers */}
     {open && anchor && createPortal(
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            onClick={() => { setOpen(false); setAnchor(null); }}
          />
          <div style={{
            position: 'fixed', top: anchor.top, right: anchor.right,
            zIndex: 9999, background: 'hsl(var(--popover))',
            border: `1px solid ${BORDER}`, borderRadius: 8,
            boxShadow: '0 4px 20px rgba(0,0,0,.18)',
            minWidth: 160, overflow: 'hidden',
          }}>
            {options.map((opt) => {
              const isActive = opt.value === value;
              return (
                <div
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); setAnchor(null); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 14px', cursor: 'pointer', fontSize: 14,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? BLUE : TEXT_PRIMARY,
                    background: isActive ? `${BLUE}18` : 'transparent',
                    transition: 'background .12s',
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = PAGE_BG; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                >
                  {opt.label}
                  {isActive && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        </>,
        document.body
      )}
    </>
  );
}


// Card with section header — mirrors dashboard card style
function SettingsCard({
  icon, title, accentColor = BLUE, children, style,
}: {
  icon?: React.ReactNode;
  title: string;
  accentColor?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ ...CARD, padding: '18px 20px', ...style }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
        paddingBottom: 12, borderBottom: `1px solid ${BORDER}`,
      }}>
        {icon && (
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: accentColor + '15',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {icon}
          </div>
        )}
        <span style={{ fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

// ─── Workspace Management (self-contained with all its state + queries) ───────

interface Workspace {
  id: number; name: string; slug: string; description?: string;
  is_default: boolean; is_active: boolean; member_count: number;
  role: 'admin' | 'manager' | 'viewer' | 'annotator' | 'developer';
  created_by?: number; created_at: string; updated_at: string;
}

function WorkspaceCard({ activeWorkspace, userRole }: { activeWorkspace: any; userRole: string }) {
  const queryClient = useQueryClient();
  const [isEditingName, setIsEditingName] = useState(false);
  const [workspaceName, setWorkspaceName] = useState(activeWorkspace?.name || '');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState('');
  const [nameSuccess, setNameSuccess] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedRole, setSelectedRole] = useState('workspace_member');
  const [isAdding, setIsAdding] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<number | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<number | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [toast, setToast] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: number; name: string } | null>(null);
  const [openRoleDropdownId, setOpenRoleDropdownId] = useState<number | null>(null);
  const [dropdownAnchor, setDropdownAnchor] = useState<{ top: number; right: number } | null>(null);

  const workspaceId = activeWorkspace?.id;
  const pmRole = (() => { try { const t = localStorage.getItem('access_token'); return t ? JSON.parse(atob(t.split('.')[1]))?.platform_roles?.pm : null; } catch { return null; } })();
  const isAdminOrManager = ['pm_admin', 'workspace_admin'].includes(pmRole || '') || ['admin', 'manager'].includes(activeWorkspace?.my_role || userRole);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const { data: wsDetails, isLoading: wsLoading, refetch: refetchWs } = useQuery({
    queryKey: ['workspace-details', workspaceId],
    queryFn: () => workspaceApi.getWorkspaceDetails(workspaceId),
    enabled: !!workspaceId, staleTime: 0,
  });

  const { data: availableData, isLoading: availLoading } = useQuery({
    queryKey: ['workspace-available-users', workspaceId, addSearch],
    queryFn: () => workspaceApi.getAvailableUsers(workspaceId, addSearch || undefined),
    enabled: !!workspaceId && showAddMember && isAdminOrManager, staleTime: 0,
  });

  const members = wsDetails?.members || [];
  const availableUsers = availableData?.users || [];
  const filteredMembers = members.filter((m: any) =>
    `${m.first_name} ${m.last_name} ${m.username} ${m.email}`
      .toLowerCase().includes(memberSearch.toLowerCase())
  );

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

  const handleAddMember = async () => {
    if (!selectedUser) return;
    setIsAdding(true);
    try {
      await workspaceApi.addMember(workspaceId, selectedUser.user_id, selectedRole);
      showToast(`✓ ${selectedUser.first_name || selectedUser.username} added to workspace`);
      setShowAddMember(false); setSelectedUser(null); setAddSearch('');
      refetchWs();
      queryClient.invalidateQueries({ queryKey: ['workspace-available-users', workspaceId] });
    } catch (e: any) {
      showToast(`✕ ${e.response?.data?.message || 'Failed to add member'}`);
    } finally { setIsAdding(false); }
  };

  const triggerRemoveConfirmation = (userId: number, userName: string) => {
    setUserToDelete({ id: userId, name: userName });
    setShowConfirmDelete(true);
  };

  const handleConfirmRemoveMember = async () => {
    if (!userToDelete) return;
    const { id: userId, name: userName } = userToDelete;
    setShowConfirmDelete(false); setUserToDelete(null);
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

  return (
    <>
      <div style={{ ...CARD, padding: '18px 20px' }}>
        {/* Card header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingBottom: 12, borderBottom: `1px solid ${BORDER}`, marginBottom: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7, background: BLUE + '15',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Settings2 size={14} color={BLUE} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY }}>
              Workspace Management
            </span>
          </div>
          {isAdminOrManager && (
            <button
              onClick={() => setShowAddMember(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', background: BLUE, color: '#fff',
                border: 'none', borderRadius: 7, fontSize: 14,
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Plus size={13} /> Add Member
            </button>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div style={{
            padding: '8px 12px', borderRadius: 8, marginBottom: 12,
            fontSize: 14, fontWeight: 500,
            background: toast.startsWith('✕') ? '#FEF2F2' : '#F0FDF4',
            border: `1px solid ${toast.startsWith('✕') ? '#FECACA' : '#BBF7D0'}`,
            color: toast.startsWith('✕') ? '#DC2626' : '#16A34A',
          }}>
            {toast}
          </div>
        )}

        {/* Workspace identity row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', background: PAGE_BG, borderRadius: 8, marginBottom: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9, background: BLUE,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: 18, flexShrink: 0,
            }}>
              {(wsDetails?.name || activeWorkspace?.name || 'W')[0].toUpperCase()}
            </div>
            <div>
              {isEditingName ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    value={workspaceName}
                    onChange={e => { setWorkspaceName(e.target.value); setNameError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setIsEditingName(false); }}
                    autoFocus
                    style={{
                      border: `1px solid ${BLUE}`, borderRadius: 6, padding: '3px 8px',
                      fontSize: 16, fontWeight: 600, color: TEXT_PRIMARY, outline: 'none',
                      background: 'hsl(var(--input))', width: 160,
                    }}
                  />
                  <button onClick={handleSaveName} disabled={isSavingName}
                    style={{ padding: '3px 8px', background: BLUE, color: '#fff', border: 'none', borderRadius: 5, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {isSavingName ? '...' : 'Save'}
                  </button>
                  <button onClick={() => { setIsEditingName(false); setWorkspaceName(activeWorkspace?.name || ''); }}
                    style={{ padding: '3px 8px', border: `1px solid ${BORDER}`, borderRadius: 5, fontSize: 13, color: TEXT_SECONDARY, background: 'hsl(var(--input))', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <p style={{ fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY, margin: 0 }}>
                  {wsDetails?.name || activeWorkspace?.name}
                </p>
              )}
              {nameError && <p style={{ fontSize: 13, color: '#DC2626', margin: '2px 0 0' }}>{nameError}</p>}
              {nameSuccess && <p style={{ fontSize: 13, color: '#16A34A', margin: '2px 0 0' }}>{nameSuccess}</p>}
              <p style={{ fontSize: 13, color: TEXT_MUTED, margin: '2px 0 0' }}>
                {activeWorkspace?.slug} · {wsDetails?.member_count || members.length} members
              </p>
            </div>
          </div>
          {isAdminOrManager && !isEditingName && (
            <button
              onClick={() => { setIsEditingName(true); setWorkspaceName(wsDetails?.name || activeWorkspace?.name || ''); }}
              style={{ fontSize: 13, color: BLUE, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              Edit Name
            </button>
          )}
        </div>

        {/* Members label + search */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY, margin: 0 }}>
            Members <span style={{ color: TEXT_MUTED, fontWeight: 400 }}>({members.length})</span>
          </p>
        </div>
        <div style={{ position: 'relative', marginBottom: 10 }}>
         <input
            value={memberSearch}
            onChange={e => setMemberSearch(e.target.value)}
            placeholder="Search members..."
            style={{
              width: '100%', padding: '7px 8px 7px 30px',
              border: `1px solid ${BORDER}`, borderRadius: 7,
              fontSize: 14, color: TEXT_PRIMARY, background: 'hsl(var(--input))',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
          <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }} width="13" height="13" fill="none" viewBox="0 0 24 24" stroke={TEXT_MUTED}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Member list */}
        {wsLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
            <div style={{ width: 20, height: 20, border: `2px solid ${BLUE}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 280, overflowY: 'auto' }}>
            {filteredMembers.map((member: any) => {
              const name = `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.username;
              const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
              const roleStyle = getRoleConfig(member.role);
              const isRemoving = removingUserId === member.user_id;
              const isUpdatingRole = updatingRoleId === member.user_id;
              return (
                <div key={member.user_id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 8px', borderRadius: 8,
                    transition: 'background .15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = PAGE_BG)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  className="group"
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, background: '#4169FF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0,
                  }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
                    <p style={{ fontSize: 13, color: TEXT_MUTED, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{member.email}</p>
                  </div>
                  {isAdminOrManager ? (
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      {/* Trigger badge */}
                      <button
                        onClick={(e) => {
                          if (isUpdatingRole) return;
                          if (openRoleDropdownId === member.user_id) {
                            setOpenRoleDropdownId(null);
                            setDropdownAnchor(null);
                          } else {
                            // getBoundingClientRect gives viewport-relative coords
                            // so the portal can position itself exactly under the button
                            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                            setDropdownAnchor({
                              top: rect.bottom + 4,
                              right: window.innerWidth - rect.right,
                            });
                            setOpenRoleDropdownId(member.user_id);
                          }
                        }}
                        disabled={isUpdatingRole}
                        style={{
                          fontSize: 10, fontWeight: 700, padding: '3px 8px',
                          borderRadius: 99, border: 'none',
                          cursor: isUpdatingRole ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', gap: 4,
                          ...roleStyle,
                        }}
                      >
                        {isUpdatingRole
                          ? <div style={{ width: 10, height: 10, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .6s linear infinite' }} />
                          : member.role?.toUpperCase()
                        }
                        {!isUpdatingRole && (
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        )}
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 99, ...roleStyle }}>
                      {member.role?.toUpperCase()}
                    </span>
                  )}
                  {isAdminOrManager && (
                    <button
                      onClick={() => triggerRemoveConfirmation(member.user_id, name)}
                      disabled={isRemoving}
                      style={{
                        padding: 5, border: 'none', background: 'transparent',
                        cursor: 'pointer', borderRadius: 5, color: TEXT_MUTED,
                        flexShrink: 0, display: 'flex', alignItems: 'center',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FEF2F2'; (e.currentTarget as HTMLButtonElement).style.color = '#EF4444'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = TEXT_MUTED; }}
                    >
                      {isRemoving
                        ? <div style={{ width: 12, height: 12, border: '2px solid #EF4444', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .6s linear infinite' }} />
                        : <Trash2 size={13} />}
                    </button>
                  )}
                </div>
              );
            })}
            {filteredMembers.length === 0 && (
              <p style={{ textAlign: 'center', color: TEXT_MUTED, fontSize: 14, padding: '20px 0' }}>No members found</p>
            )}
          </div>
        )}
      </div>

      {/* ── Add Member Modal ── */}
      {showAddMember && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(4px)' }} onClick={() => setShowAddMember(false)} />
          <div style={{ position: 'relative', background: 'hsl(var(--card))', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.25)', width: '100%', maxWidth: 420, margin: '0 16px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${BORDER}` }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: TEXT_PRIMARY, margin: 0 }}>Add Member</h3>
              <button onClick={() => { setShowAddMember(false); setSelectedUser(null); setAddSearch(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: TEXT_MUTED, display: 'flex' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ position: 'relative' }}>
                <input value={addSearch} onChange={e => setAddSearch(e.target.value)} placeholder="Search users to add..."
                  style={{ width: '100%', padding: '8px 10px 8px 32px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 16, color: TEXT_PRIMARY, outline: 'none', background: 'hsl(var(--input))', boxSizing: 'border-box' }} />
                <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={TEXT_MUTED}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto', border: `1px solid ${BORDER}`, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 0 }}>
                {availLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}><div style={{ width: 18, height: 18, border: `2px solid ${BLUE}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .6s linear infinite' }} /></div>
                ) : availableUsers.length === 0 ? (
                  <p style={{ textAlign: 'center', color: TEXT_MUTED, fontSize: 14, padding: '20px 0', margin: 0 }}>No users available to add</p>
                ) : availableUsers.map((u: any) => {
                  const uname = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;
                  const isSel = selectedUser?.user_id === u.user_id;
                  return (
                    <div key={u.user_id} onClick={() => setSelectedUser(isSel ? null : u)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: isSel ? `${BLUE}18` : 'transparent', transition: 'background .15s' }}
                      onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLDivElement).style.background = PAGE_BG; }}
                      onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                        {uname[0]?.toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 16, fontWeight: 600, color: TEXT_PRIMARY, margin: 0 }}>{uname}</p>
                        <p style={{ fontSize: 13, color: TEXT_MUTED, margin: 0 }}>{u.email}</p>
                      </div>
                      {isSel && <Check size={15} color={BLUE} />}
                    </div>
                  );
                })}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: TEXT_SECONDARY, marginBottom: 6 }}>Role</label>
                <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 16, color: TEXT_PRIMARY, outline: 'none', background: 'hsl(var(--input))' }}>
                  <option value="pm_admin">PM Admin</option>
                  <option value="workspace_admin">Workspace Admin</option>
                  <option value="workspace_member">Workspace Member</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '14px 20px', borderTop: `1px solid ${BORDER}` }}>
              <button onClick={() => { setShowAddMember(false); setSelectedUser(null); setAddSearch(''); }}
                style={{ flex: 1, padding: '9px 0', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 16, fontWeight: 500, color: TEXT_SECONDARY, background: '#fff', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleAddMember} disabled={!selectedUser || isAdding}
                style={{ flex: 1, padding: '9px 0', background: selectedUser && !isAdding ? BLUE : '#93C5FD', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 600, color: '#fff', cursor: selectedUser ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {isAdding ? <><div style={{ width: 14, height: 14, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .6s linear infinite' }} />Adding...</> : 'Add to Workspace'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal ── */}
     {showConfirmDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(4px)' }} onClick={() => { setShowConfirmDelete(false); setUserToDelete(null); }} />
          <div style={{ position: 'relative', background: 'hsl(var(--card))', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.25)', width: '100%', maxWidth: 380, margin: '0 16px', overflow: 'hidden' }}>
            <div style={{ padding: '20px 20px 14px' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: TEXT_PRIMARY, margin: '0 0 6px' }}>Remove Member</h3>
              <p style={{ fontSize: 16, color: TEXT_SECONDARY, margin: 0 }}>
                Are you sure you want to remove <strong style={{ color: TEXT_PRIMARY }}>{userToDelete?.name}</strong> from this workspace?
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '12px 20px 18px' }}>
              <button onClick={() => { setShowConfirmDelete(false); setUserToDelete(null); }}
                style={{ flex: 1, padding: '8px 0', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 16, fontWeight: 500, color: TEXT_SECONDARY, background: '#fff', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleConfirmRemoveMember}
                style={{ flex: 1, padding: '8px 0', background: '#DC2626', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
   {/* Role dropdown rendered in a portal — escapes overflow:auto scroll container */}
      {openRoleDropdownId !== null && dropdownAnchor && createPortal(
        <>
          {/* Full-screen backdrop catches outside clicks */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            onClick={() => { setOpenRoleDropdownId(null); setDropdownAnchor(null); }}
          />
          <div style={{
            position: 'fixed',
            top: dropdownAnchor.top,
            right: dropdownAnchor.right,
            zIndex: 9999,
            background: 'hsl(var(--popover))',
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            boxShadow: '0 4px 20px rgba(0,0,0,.20)',
            minWidth: 140,
            overflow: 'hidden',
          }}>
            {(['workspace_member', 'workspace_admin', 'pm_admin', 'project_member', 'project_manager', 'project_admin', 'project_viewer'] as const).map((role) => {
              const rs = getRoleConfig(role);
              const activeMember = filteredMembers.find((m: any) => m.user_id === openRoleDropdownId);
              const isActive = activeMember?.role === role;
              return (
                <div
                  key={role}
                  onClick={() => {
                    const m = filteredMembers.find((m: any) => m.user_id === openRoleDropdownId);
                    if (m) {
                      const mName = `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.username;
                      handleUpdateRole(openRoleDropdownId!, role, mName);
                    }
                    setOpenRoleDropdownId(null);
                    setDropdownAnchor(null);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 14px', cursor: 'pointer',
                    background: isActive ? rs.bg : 'transparent',
                    transition: 'background .12s',
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = PAGE_BG; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: rs.color }}>
                    {role.toUpperCase()}
                  </span>
                  {isActive && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={rs.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        </>,
        document.body
      )}
    </>
  );
}

// ─── Main Settings

export function Settings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { theme: resolvedTheme, setTheme: applyTheme } = useTheme();
  const [dataMode, setDataMode] = useState<'local' | 'cloud'>('cloud');
  const [defaultView, setDefaultView] = useState<'grid' | 'table'>('grid');
  const [language, setLanguage] = useState('en');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const theme = resolvedTheme === 'system' ? 'light' : resolvedTheme as 'light' | 'dark';
  const setTheme = (val: 'light' | 'dark') => applyTheme(val);
  const [fontSize, setFontSize] = useState<string>(
    () => localStorage.getItem('dyuksa_font_size') || 'medium'
  );

  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove('font-small', 'font-medium', 'font-large');
    html.classList.add(`font-${fontSize}`);
    localStorage.setItem('dyuksa_font_size', fontSize);
  }, [fontSize]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [desktopNotifs, setDesktopNotifs] = useState(true);
  const [emailNotifs, setEmailNotifs] = useState(false);
  const [chatMentions, setChatMentions] = useState(true);
  const [taskAssignments, setTaskAssignments] = useState(true);
  const [notifSound, setNotifSound] = useState(true);
  const [autoLogout, setAutoLogout] = useState('30');
  const [sessionAlerts, setSessionAlerts] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: workspaceData } = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspaceApi.getWorkspaces,
  });

  const workspaces = workspaceData?.workspaces || [];
  const activeWorkspaceId = workspaceData?.active_workspace_id || workspaceApi.getActiveWorkspaceId();
  const activeWorkspace = workspaces.find((w: Workspace) => w.id === activeWorkspaceId);

  const canDeleteWorkspace = (): boolean => {
    if (!activeWorkspace) return false;
    if (activeWorkspace.is_default) return false;
    if (activeWorkspace.created_by && user?.id) return activeWorkspace.created_by === user.id;
    return false;
  };

  const handleDeleteWorkspace = async () => {
    if (!activeWorkspace) return;
    setIsDeleting(true);
    try {
      await workspaceApi.deleteWorkspace(activeWorkspace.id);
      const defaultWorkspace = workspaces.find((w: Workspace) => w.is_default);
      if (defaultWorkspace) localStorage.setItem('active_workspace_id', String(defaultWorkspace.id));
      setShowDeleteModal(false);
      setDeleteConfirmText('');
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      window.location.href = '/';
    } catch (error: any) {
      console.error('Failed to delete workspace:', error);
      alert(error.message || 'Failed to delete workspace');
    } finally { setIsDeleting(false); }
  };

  // Last row in settings row items needs no bottom border
  const rowStyle = (last = false): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: '8px 4px',
    padding: '10px 0',
    borderBottom: last ? 'none' : `1px solid ${BORDER}`,
  });

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ width: '100%', background: PAGE_BG, minHeight: '100vh', fontFamily: '-apple-system,BlinkMacSystemFont,"Inter",system-ui,sans-serif' }}>

        {/* ── Sticky Header Bar ── */}
        <div
          className="px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-24"
          style={{
            position: 'sticky', top: 0, zIndex: 25,
            background: PAGE_BG, paddingTop: 16, paddingBottom: 16,
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: TEXT_PRIMARY, letterSpacing: '-0.02em' }}>
                Settings
              </div>
              <div style={{ fontSize: 16, color: TEXT_SECONDARY, marginTop: 4 }}>
                Manage your preferences and workspace configuration
              </div>
            </div>
          </div>
        </div>

        {/* ── Scrollable content ── */}
        <div
          className="px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-24 pt-6"
          style={{ paddingBottom: 40 }}
        >

          {/* ══ Row 1: Three quick-setting cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">

            {/* Appearance */}
            <SettingsCard
              icon={<Palette size={14} color="#8B5CF6" />}
              title="Appearance"
              accentColor="#8B5CF6"
            >
              <div style={rowStyle()}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <Sun size={14} color={TEXT_MUTED} style={{ marginTop: 1, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 500, color: TEXT_PRIMARY, margin: 0 }}>Theme</p>
                    <p style={{ fontSize: 13, color: TEXT_MUTED, margin: '2px 0 0' }}>Color scheme</p>
                  </div>
                </div>
                <SegmentedControl
                  options={[
                    { label: 'Light', value: 'light', icon: <Sun size={11} /> },
                    { label: 'Dark', value: 'dark', icon: <Moon size={11} /> },
                  ]}
                  value={theme}
                  onChange={setTheme}
                />
              </div>
              <div style={rowStyle()}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <Type size={14} color={TEXT_MUTED} style={{ marginTop: 1, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 500, color: TEXT_PRIMARY, margin: 0 }}>Font Size</p>
                    <p style={{ fontSize: 13, color: TEXT_MUTED, margin: '2px 0 0' }}>Text readability</p>
                  </div>
                </div>
                <SettingSelect value={fontSize} onChange={setFontSize}
                  options={[{ label: 'Small', value: 'small' }, { label: 'Medium', value: 'medium' }, { label: 'Large', value: 'large' }]} />
              </div>
              <div style={rowStyle(true)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <PanelLeft size={14} color={TEXT_MUTED} style={{ marginTop: 1, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 500, color: TEXT_PRIMARY, margin: 0 }}>Compact Sidebar</p>
                    <p style={{ fontSize: 13, color: TEXT_MUTED, margin: '2px 0 0' }}>Start minimized</p>
                  </div>
                </div>
                <Toggle enabled={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
              </div>
            </SettingsCard>

            {/* Configuration */}
            <SettingsCard
              icon={<Monitor size={14} color="#F59E0B" />}
              title="Configuration"
              accentColor="#F59E0B"
            >
              <div style={rowStyle()}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <Cloud size={14} color={TEXT_MUTED} style={{ marginTop: 1, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 500, color: TEXT_PRIMARY, margin: 0 }}>Data Mode</p>
                    <p style={{ fontSize: 13, color: TEXT_MUTED, margin: '2px 0 0' }}>Storage location</p>
                  </div>
                </div>
                <SegmentedControl
                  options={[
                    { label: 'Local', value: 'local', icon: <Monitor size={11} /> },
                    { label: 'Cloud', value: 'cloud', icon: <Cloud size={11} /> },
                  ]}
                  value={dataMode}
                  onChange={setDataMode}
                />
              </div>
              <div style={rowStyle()}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <LayoutGrid size={14} color={TEXT_MUTED} style={{ marginTop: 1, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 500, color: TEXT_PRIMARY, margin: 0 }}>Default View</p>
                    <p style={{ fontSize: 13, color: TEXT_MUTED, margin: '2px 0 0' }}>Projects display</p>
                  </div>
                </div>
                <SegmentedControl
                  options={[
                    { label: 'Grid', value: 'grid', icon: <LayoutGrid size={11} /> },
                    { label: 'Table', value: 'table', icon: <Table2 size={11} /> },
                  ]}
                  value={defaultView}
                  onChange={setDefaultView}
                />
              </div>
              <div style={rowStyle()}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <Globe size={14} color={TEXT_MUTED} style={{ marginTop: 1, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 500, color: TEXT_PRIMARY, margin: 0 }}>Language</p>
                  </div>
                </div>
                <SettingSelect value={language} onChange={setLanguage}
                  options={[{ label: 'English', value: 'en' }, { label: 'Hindi', value: 'hi' }, { label: 'Spanish', value: 'es' }, { label: 'French', value: 'fr' }]} />
              </div>
              <div style={rowStyle(true)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <Clock size={14} color={TEXT_MUTED} style={{ marginTop: 1, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 500, color: TEXT_PRIMARY, margin: 0 }}>Date Format</p>
                  </div>
                </div>
                <SettingSelect value={dateFormat} onChange={setDateFormat}
                  options={[{ label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' }, { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' }, { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' }]} />
              </div>
            </SettingsCard>

            {/* Security */}
            <SettingsCard
              icon={<Smartphone size={14} color="#22C55E" />}
              title="Security"
              accentColor="#22C55E"
            >
              <div style={rowStyle()}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <Clock size={14} color={TEXT_MUTED} style={{ marginTop: 1, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 500, color: TEXT_PRIMARY, margin: 0 }}>Auto-logout</p>
                    <p style={{ fontSize: 13, color: TEXT_MUTED, margin: '2px 0 0' }}>After inactivity</p>
                  </div>
                </div>
                <SettingSelect value={autoLogout} onChange={setAutoLogout}
                  options={[{ label: '15 min', value: '15' }, { label: '30 min', value: '30' }, { label: '1 hour', value: '60' }, { label: 'Never', value: '0' }]} />
              </div>
              <div style={rowStyle(true)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <Smartphone size={14} color={TEXT_MUTED} style={{ marginTop: 1, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 500, color: TEXT_PRIMARY, margin: 0 }}>Session Alerts</p>
                    <p style={{ fontSize: 13, color: TEXT_MUTED, margin: '2px 0 0' }}>New device login</p>
                  </div>
                </div>
                <Toggle enabled={sessionAlerts} onToggle={() => setSessionAlerts(!sessionAlerts)} />
              </div>

              {/* Danger zone inside Security card */}
              {activeWorkspace && canDeleteWorkspace() && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '2px solid #FEE2E2' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <AlertTriangle size={13} color="#DC2626" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Danger Zone</span>
                  </div>
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 12px' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#172033', margin: '0 0 3px' }}>Delete Workspace</p>
                    <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 8px' }}>
                      Permanently delete "{activeWorkspace.name}" and all its data
                    </p>
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: '#DC2626', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                    >
                      <Trash2 size={12} /> Delete Workspace
                    </button>
                  </div>
                </div>
              )}
            </SettingsCard>
          </div>

          {/* ══ Row 2: Workspace (wide) + Notifications ══ */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

            {/* Workspace — takes 3 of 5 columns */}
            <div className="lg:col-span-3">
              <WorkspaceCard
                activeWorkspace={activeWorkspace}
                userRole={user?.role || ''}
              />
            </div>

            {/* Notifications — takes 2 of 5 columns */}
            <div className="lg:col-span-2">
              <SettingsCard
                icon={<BellRing size={14} color="#EF4444" />}
                title="Notifications"
                accentColor="#EF4444"
              >
                <div style={rowStyle()}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <BellRing size={14} color={TEXT_MUTED} style={{ marginTop: 1, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 500, color: TEXT_PRIMARY, margin: 0 }}>Desktop Push</p>
                      <p style={{ fontSize: 13, color: TEXT_MUTED, margin: '2px 0 0' }}>Browser alerts</p>
                    </div>
                  </div>
                  <Toggle enabled={desktopNotifs} onToggle={() => setDesktopNotifs(!desktopNotifs)} />
                </div>
                <div style={rowStyle()}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <Mail size={14} color={TEXT_MUTED} style={{ marginTop: 1, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 500, color: TEXT_PRIMARY, margin: 0 }}>Email Updates</p>
                      <p style={{ fontSize: 13, color: TEXT_MUTED, margin: '2px 0 0' }}>To your inbox</p>
                    </div>
                  </div>
                  <Toggle enabled={emailNotifs} onToggle={() => setEmailNotifs(!emailNotifs)} />
                </div>
                <div style={rowStyle()}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <MessageSquare size={14} color={TEXT_MUTED} style={{ marginTop: 1, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 500, color: TEXT_PRIMARY, margin: 0 }}>Chat Mentions</p>
                      <p style={{ fontSize: 13, color: TEXT_MUTED, margin: '2px 0 0' }}>When @mentioned</p>
                    </div>
                  </div>
                  <Toggle enabled={chatMentions} onToggle={() => setChatMentions(!chatMentions)} />
                </div>
                <div style={rowStyle()}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <ClipboardList size={14} color={TEXT_MUTED} style={{ marginTop: 1, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 500, color: TEXT_PRIMARY, margin: 0 }}>Task Assignments</p>
                      <p style={{ fontSize: 13, color: TEXT_MUTED, margin: '2px 0 0' }}>When assigned to you</p>
                    </div>
                  </div>
                  <Toggle enabled={taskAssignments} onToggle={() => setTaskAssignments(!taskAssignments)} />
                </div>
                <div style={rowStyle(true)}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <Volume2 size={14} color={TEXT_MUTED} style={{ marginTop: 1, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 500, color: TEXT_PRIMARY, margin: 0 }}>Sound</p>
                      <p style={{ fontSize: 13, color: TEXT_MUTED, margin: '2px 0 0' }}>Notification audio</p>
                    </div>
                  </div>
                  <Toggle enabled={notifSound} onToggle={() => setNotifSound(!notifSound)} />
                </div>
              </SettingsCard>
            </div>

          </div>
        </div>
      </div>

      {/* ── Delete Workspace Confirmation Modal ── */}
      {showDeleteModal && activeWorkspace && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16 }}>
          <div style={{ background: 'hsl(var(--card))', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.3)', maxWidth: 440, width: '100%', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 20px 16px' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash2 size={20} color="#DC2626" />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY, margin: 0 }}>Delete Workspace?</h3>
                <p style={{ fontSize: 14, color: TEXT_MUTED, margin: '2px 0 0' }}>This action cannot be undone</p>
              </div>
            </div>
            <div style={{ margin: '0 20px 16px', padding: 14, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10 }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#991B1B', margin: '0 0 6px' }}>
                Permanently deleting "{activeWorkspace.name}"
              </p>
              <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {['All projects and tasks', 'All documents and files', 'All team chat rooms', 'All members lose access'].map(item => (
                  <li key={item} style={{ fontSize: 14, color: '#DC2626' }}>{item}</li>
                ))}
              </ul>
            </div>
            <div style={{ padding: '0 20px 16px' }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: TEXT_SECONDARY, marginBottom: 6 }}>
                Type <strong style={{ color: '#DC2626' }}>"{activeWorkspace.name}"</strong> to confirm:
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder={activeWorkspace.name}
                  autoFocus
                  style={{ width: '100%', padding: '9px 36px 9px 10px', border: `1px solid ${deleteConfirmText === activeWorkspace.name ? '#22C55E' : BORDER}`, borderRadius: 8, fontSize: 16, color: TEXT_PRIMARY, outline: 'none', boxSizing: 'border-box', transition: 'border-color .2s' }}
                />
                {deleteConfirmText.length > 0 && (
                  <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, borderRadius: '50%', background: deleteConfirmText === activeWorkspace.name ? '#22C55E' : '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {deleteConfirmText === activeWorkspace.name
                      ? <Check size={11} color="#fff" />
                      : <X size={11} color="#fff" />}
                  </div>
                )}
              </div>
              {deleteConfirmText.length > 0 && deleteConfirmText !== activeWorkspace.name && (
                <p style={{ fontSize: 13, color: '#DC2626', margin: '4px 0 0' }}>Workspace name does not match</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '12px 20px 20px' }}>
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}
                disabled={isDeleting}
                style={{ flex: 1, padding: '9px 0', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 16, fontWeight: 500, color: TEXT_SECONDARY, background: '#fff', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteWorkspace}
                disabled={isDeleting || deleteConfirmText !== activeWorkspace.name}
                style={{ flex: 1, padding: '9px 0', background: isDeleting || deleteConfirmText !== activeWorkspace.name ? '#FCA5A5' : '#DC2626', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 600, color: '#fff', cursor: deleteConfirmText === activeWorkspace.name ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'background .2s' }}
              >
                {isDeleting
                  ? <><div style={{ width: 14, height: 14, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .6s linear infinite' }} />Deleting...</>
                  : <><Trash2 size={13} />Delete Permanently</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}