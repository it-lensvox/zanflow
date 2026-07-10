import { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Plus, Users, Search, ChevronDown } from 'lucide-react';
import { workspaceApi, usersApi } from '@/services/api';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Modal, ModalHeader } from '@/components/common/Modal';
import { BLUE, LINE, MUTED, TEXT, BG, CARD_STYLE, INPUT_STYLE } from '@/pages/MyTask/pages/CreateTask/createTaskConstants';
import { getRoleConfig, ROLE_OPTIONS, type UserRole as MemberRole } from '@/config/roleConfig';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SelectedMember {
  user_id: number;
  username: string;
  full_name: string;
  role: MemberRole;
}


export function CreateWorkspaceModal({ isOpen, onClose }: CreateWorkspaceModalProps) {
  const { user: currentUser } = useAuth();
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceDescription, setWorkspaceDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<SelectedMember[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [showErrorBanner, setShowErrorBanner] = useState(false);
  const [skippedMembers, setSkippedMembers] = useState<{ user_id: number; reason: string }[]>([]);
  const queryClient = useQueryClient();

  // ── Portal dropdown refs
  const searchInputRef = useRef<HTMLDivElement>(null);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);
  const [openRoleUserId, setOpenRoleUserId] = useState<number | null>(null);
  const [roleDropdownRect, setRoleDropdownRect] = useState<DOMRect | null>(null);
  const roleBtnRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (showMemberDropdown && searchInputRef.current) {
      setDropdownRect(searchInputRef.current.getBoundingClientRect());
    }
  }, [showMemberDropdown]);

  const openRoleDropdown = (userId: number) => {
    const btn = roleBtnRefs.current[userId];
    if (btn) setRoleDropdownRect(btn.getBoundingClientRect());
    setOpenRoleUserId(userId);
  };

  // Fetch users list
  const { data: usersData } = useQuery({
    queryKey: ['users-for-workspace'],
    queryFn: () => usersApi.list(),
    enabled: isOpen,
  });

  if (!isOpen) return null;

  const allUsers = usersData?.results || [];

  // Filter out current user and already selected members
  const availableUsers = allUsers.filter((u: any) =>
    u.id !== currentUser?.id &&
    !selectedMembers.some((m) => m.user_id === u.id) &&
    (
      memberSearch === '' ||
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(memberSearch.toLowerCase()) ||
      u.username.toLowerCase().includes(memberSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(memberSearch.toLowerCase())
    )
  );

  const addMember = (user: any) => {
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
    setSelectedMembers((prev) => [
      ...prev,
      { user_id: user.id, username: user.username, full_name: fullName, role: 'viewer' },
    ]);
    setMemberSearch('');
    setShowMemberDropdown(false);
  };

  const removeMember = (userId: number) => {
    setSelectedMembers((prev) => prev.filter((m) => m.user_id !== userId));
  };

  const updateMemberRole = (userId: number, role: MemberRole) => {
    setSelectedMembers((prev) =>
      prev.map((m) => (m.user_id === userId ? { ...m, role } : m))
    );
  };

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!workspaceName.trim()) {
      setError('Workspace name is required');
      setShowErrorBanner(true);
      return;
    }

    setIsLoading(true);
    setError('');
    setShowErrorBanner(false);
    setShowSuccessBanner(false);
    setSkippedMembers([]);

    try {
      // Build payload with members
      const payload: any = {
        name: workspaceName.trim(),
        ...(workspaceDescription.trim() && { description: workspaceDescription.trim() }),
        ...(selectedMembers.length > 0 && {
          members: selectedMembers.map((m) => ({
            user_id: m.user_id,
            role: m.role,
          })),
        }),
      };

      const response = await workspaceApi.createWorkspace(
        payload.name,
        payload.description,
        payload.members,
      );

      // Show skipped members if any
      if (response.members_skipped?.length > 0) {
        setSkippedMembers(response.members_skipped);
      }

      setShowSuccessBanner(true);
      setShowErrorBanner(false);

      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });

      // Switch to the new workspace
      const newId = response.id || response.workspace?.id;
      if (newId) {
        localStorage.setItem('active_workspace_id', String(newId));
        await workspaceApi.switchWorkspace(newId);
      }

      // Close modal after 2 seconds and reload
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 2000);

    } catch (error: any) {
      console.error('Failed to create workspace:', error);

      let errorMessage = 'Failed to create workspace';
      if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.data) {
        const errorData = error.response.data;
        if (errorData.name && Array.isArray(errorData.name)) {
          errorMessage = errorData.name[0];
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (typeof errorData === 'string') {
          errorMessage = errorData;
        }
      }

      setError(errorMessage);
      setShowSuccessBanner(false);
      setShowErrorBanner(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setWorkspaceName('');
    setWorkspaceDescription('');
    setSelectedMembers([]);
    setMemberSearch('');
    setShowMemberDropdown(false);
    setError('');
    setShowSuccessBanner(false);
    setShowErrorBanner(false);
    setSkippedMembers([]);
    onClose();
  };

return ReactDOM.createPortal(
    <Modal isOpen={isOpen} onClose={handleClose} maxWidth="max-w-xl">
      <ModalHeader
        title="Create Workspace"
        subtitle="Add a new workspace and invite members"
        onClose={handleClose}
        actions={
          <button
            onClick={handleSubmit}
            disabled={isLoading || !workspaceName.trim()}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: isLoading || !workspaceName.trim() ? '#94a3b8' : BLUE, color: '#fff', fontSize: 13, fontWeight: 600, cursor: isLoading || !workspaceName.trim() ? 'not-allowed' : 'pointer', transition: 'background .15s', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {isLoading
              ? <><div style={{ width: 13, height: 13, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />Creating…</>
              : <><Plus size={13} />Create Workspace</>
            }
          </button>
        }
      />

      <form
        onSubmit={handleSubmit}
        style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, background: BG, fontFamily: '-apple-system,BlinkMacSystemFont,"Inter",system-ui,sans-serif' }}
      >
        {/* Error banner */}
        {showErrorBanner && error && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca' }}>
            <p style={{ fontSize: 13, color: '#b91c1c', margin: 0 }}>❌ {error}</p>
          </div>
        )}

        {/* Success banner */}
        {showSuccessBanner && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <p style={{ fontSize: 13, color: '#15803d', margin: 0 }}>✅ Workspace created! Redirecting…</p>
            {skippedMembers.length > 0 && (
              <p style={{ fontSize: 12, color: '#a16207', margin: '4px 0 0' }}>⚠️ {skippedMembers.length} member(s) could not be added.</p>
            )}
          </div>
        )}

        {/* ── Section 1: Core info ── */}
        <div style={{ ...CARD_STYLE, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Workspace Name */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: TEXT, marginBottom: 6 }}>
              Workspace Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={workspaceName}
              onChange={e => setWorkspaceName(e.target.value)}
              placeholder="e.g., Marketing Team, Engineering"
              required
              style={INPUT_STYLE}
              onFocus={e => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(22,99,246,.08)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = LINE; e.currentTarget.style.boxShadow = 'none'; }}
              disabled={isLoading}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: TEXT, marginBottom: 6 }}>
              Description <span style={{ fontSize: 11, fontWeight: 400, color: MUTED }}>(Optional)</span>
            </label>
            <textarea
              value={workspaceDescription}
              onChange={e => setWorkspaceDescription(e.target.value)}
              placeholder="Brief description of this workspace"
              rows={2}
              style={{ ...INPUT_STYLE, height: 'auto', padding: '10px 12px', resize: 'none' }}
              onFocus={e => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(22,99,246,.08)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = LINE; e.currentTarget.style.boxShadow = 'none'; }}
              disabled={isLoading}
            />
          </div>
        </div>

        {/* ── Section 2: Team Members ── */}
        <div style={{ ...CARD_STYLE, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: TEXT, margin: 0 }}>
            <Users size={13} />
            Add Members <span style={{ fontSize: 11, fontWeight: 400, color: MUTED }}>(Optional)</span>
          </label>

          {/* Search input — measured for portal */}
          <div ref={searchInputRef}>
            <div
              style={{ ...INPUT_STYLE, height: 38, display: 'flex', alignItems: 'center', gap: 8, cursor: 'text', padding: '0 12px' }}
              onClick={() => setShowMemberDropdown(true)}
            >
              <Search size={13} color={MUTED} />
              <input
                type="text"
                value={memberSearch}
                onChange={e => { setMemberSearch(e.target.value); setShowMemberDropdown(true); }}
                onFocus={() => {
                  setShowMemberDropdown(true);
                  if (searchInputRef.current) setDropdownRect(searchInputRef.current.getBoundingClientRect());
                }}
                placeholder="Search by name or email…"
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, color: TEXT, background: 'transparent', fontFamily: 'inherit' }}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Member search portal dropdown */}
          {showMemberDropdown && dropdownRect && ReactDOM.createPortal(
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 99998 }} onClick={() => setShowMemberDropdown(false)} />
              <div style={{ position: 'fixed', top: dropdownRect.bottom + 4, left: dropdownRect.left, width: dropdownRect.width, zIndex: 99999, background: 'hsl(var(--popover))', border: `1px solid ${LINE}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.18)', maxHeight: 220, overflowY: 'auto', padding: '4px 0' }}>
                {availableUsers.length === 0 ? (
                  <div style={{ padding: '12px 14px', fontSize: 13, color: MUTED, textAlign: 'center' }}>
                    {memberSearch ? 'No users found' : 'All users already added'}
                  </div>
                ) : availableUsers.map((user: any) => {
                  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
                  return (
                    <div key={user.id} onClick={() => addMember(user)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer', fontSize: 13 }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--accent))')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${BLUE}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: BLUE, flexShrink: 0 }}>
                        {getInitials(fullName)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT }}>{fullName}</p>
                        <p style={{ margin: 0, fontSize: 11, color: MUTED }}>{user.email}</p>
                      </div>
                      <span style={{ fontSize: 11, color: MUTED, textTransform: 'capitalize' }}>{user.role}</span>
                    </div>
                  );
                })}
              </div>
            </>,
            document.body
          )}

          {/* Selected members */}
          {selectedMembers.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {selectedMembers.map(member => {
                const roleConf = getRoleConfig(member.role);
                return (
                  <div key={member.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, border: `1px solid ${LINE}`, background: 'hsl(var(--card))' }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${BLUE}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: BLUE, flexShrink: 0 }}>
                      {getInitials(member.full_name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT }}>{member.full_name}</p>
                      <p style={{ margin: 0, fontSize: 11, color: MUTED }}>@{member.username}</p>
                    </div>

                    {/* Role badge button — opens portal dropdown */}
                    <button
                      type="button"
                      ref={el => { roleBtnRefs.current[member.user_id] = el; }}
                      onClick={() => openRoleDropdown(member.user_id)}
                      disabled={isLoading}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: roleConf.bg, color: roleConf.color, flexShrink: 0 }}
                    >
                      {roleConf.label}
                      <ChevronDown size={10} />
                    </button>

                    <button type="button" onClick={() => removeMember(member.user_id)} disabled={isLoading}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, padding: 4, display: 'flex', borderRadius: 4 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Role portal dropdown */}
          {openRoleUserId !== null && roleDropdownRect && ReactDOM.createPortal(
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 99998 }} onClick={() => setOpenRoleUserId(null)} />
              <div style={{ position: 'fixed', top: roleDropdownRect.bottom + 4, left: roleDropdownRect.left, minWidth: 140, zIndex: 99999, background: 'hsl(var(--popover))', border: `1px solid ${LINE}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.18)', overflow: 'hidden', padding: '4px 0' }}>
                {ROLE_OPTIONS.map(r => {
                  const rc = getRoleConfig(r.value as MemberRole);
                  const isActive = selectedMembers.find(m => m.user_id === openRoleUserId)?.role === r.value;
                  return (
                    <div key={r.value}
                      onClick={() => { updateMemberRole(openRoleUserId!, r.value as MemberRole); setOpenRoleUserId(null); }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', cursor: 'pointer', fontSize: 12, fontWeight: isActive ? 700 : 500, color: rc.color, background: isActive ? rc.bg : 'transparent' }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'hsl(var(--accent))'; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: rc.color, display: 'inline-block' }} />
                        {rc.label}
                      </span>
                      {isActive && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke={rc.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  );
                })}
              </div>
            </>,
            document.body
          )}

          {selectedMembers.length > 0 && (
            <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>
              {selectedMembers.length} member{selectedMembers.length > 1 ? 's' : ''} will be added
            </p>
          )}

          {/* Info note */}
          <div style={{ padding: '10px 14px', background: `${BLUE}0d`, border: `1px solid ${BLUE}30`, borderRadius: 8 }}>
            <p style={{ fontSize: 12, color: TEXT, margin: 0 }}>
              <strong>Note:</strong> You will automatically become the admin of this workspace. Members can be added or changed later from workspace settings.
            </p>
          </div>
        </div>
      </form>

     <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Modal>,
    document.body
  );
}