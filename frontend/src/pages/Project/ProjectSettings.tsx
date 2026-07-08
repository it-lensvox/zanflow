import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Trash2, Plus, X, Tags, Settings, AlertTriangle, FolderKanban, Users, Tag } from 'lucide-react';
import { Button, Input } from '@/components/common';
import { projectsApi, usersApi } from '@/services/api';
import DeleteModal from '@/components/common/Deletemodal';
import { useAuth } from '@/hooks/useAuth';
import { PROJECT_TYPE_OPTIONS as TASK_TYPES } from '@/config/projectTypeConfig';
import type { Project, Label, TaskType, User as AppUser, ProjectStatus } from '@/types';
import { Modal, ModalHeader } from '@/components/common/Modal';
import { FormField } from '@/pages/MyTask/pages/CreateTask/components/FormField';
import { BLUE, LINE, MUTED, TEXT, BG, INPUT_STYLE, CARD_STYLE } from '@/pages/MyTask/pages/CreateTask/createTaskConstants';
import { STATUS_MAP } from '@/pages/Project/projectConstants';
import { PROJECT_ROLES, DropdownTrigger, DropdownList, DropdownItem } from '@/pages/Project/components/ProjectDropdowns';

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
];


export function ProjectSettings() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'general' | 'labels' | 'danger'>('general');
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    task_type: TaskType;
    status: ProjectStatus;
  }>({
    name: '',
    description: '',
    task_type: 'client' as TaskType,
    status: 'active',
  });
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [assignedTo, setAssignedTo] = useState<{ userId: number; role: string }[]>([]);
  const [tempUser, setTempUser] = useState<number | null>(null);
  const [tempRole, setTempRole] = useState<string>('');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [taskTypeDropdownOpen, setTaskTypeDropdownOpen] = useState(false);
 const userDropdownRef = useRef<HTMLDivElement>(null);
  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const taskTypeDropdownRef = useRef<HTMLDivElement>(null);
  const taskTypeTriggerRef = useRef<HTMLDivElement>(null);
  const statusTriggerRef = useRef<HTMLDivElement>(null);
  const userTriggerRef = useRef<HTMLDivElement>(null);
  const roleTriggerRef = useRef<HTMLDivElement>(null);
  const [newLabel, setNewLabel] = useState({ name: '', color: '#3b82f6' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteModalType, setDeleteModalType] = useState<'confirm' | 'denied'>('confirm');
  const [memberToDelete, setMemberToDelete] = useState<{ id: number; name: string } | null>(null);
  const { user: currentUser } = useAuth();

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(Number(id)),
    enabled: !!id,
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['allUsers'],
    queryFn: usersApi.listAll,
    select: (data: AppUser[]) =>
      data.map((user) => ({
        value: user.id,
        label: user.first_name && user.last_name
          ? `${user.first_name} ${user.last_name}`
          : user.username,
      })),
  });

  const [isProjectDataLoaded, setIsProjectDataLoaded] = useState(false);

  if (project && !isProjectDataLoaded) {
    const rawDescription = project.description || '';
    const strippedDescription = rawDescription.replace(/<[^>]*>/g, '').trim();
    setFormData({
      name: project.name,
      description: strippedDescription,
      task_type: project.task_type,
      status: (project.status || 'active') as ProjectStatus,
    });
    setIsProjectDataLoaded(true);
  }
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) setUserDropdownOpen(false);
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target as Node)) setRoleDropdownOpen(false);
      if (taskTypeDropdownRef.current && !taskTypeDropdownRef.current.contains(event.target as Node)) setTaskTypeDropdownOpen(false);
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) setStatusDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Project>) => projectsApi.update(Number(id), data),
    onSuccess: () => {
      // Invalidate project specific data
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      
      // --- NEW: Invalidate chat rooms to sync the updated project name instantly ---
      queryClient.invalidateQueries({ queryKey: ['project-chat-rooms'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-all-chat-rooms'] });
      
      setIsFormDirty(false);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => projectsApi.delete(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate('/projects');
    },
  });

  const createLabelMutation = useMutation({
    mutationFn: (data: { name: string; color: string }) =>
      projectsApi.createLabel(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setNewLabel({ name: '', color: '#3b82f6' });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: (data: { user_id: number; role: string }) =>
      projectsApi.addMember(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setTempUser(null);
      setTempRole('');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: number) => projectsApi.removeMember(Number(id), userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    },
    onError: () => {
      setErrorMessage('Failed to remove member from the project.');
      setShowErrorModal(true);
    }
  });

  const deleteLabelMutation = useMutation({
    mutationFn: (labelId: number) => projectsApi.deleteLabel(Number(id), labelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    },
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setIsFormDirty(true);
  };

  const handleAddMember = () => {
    if (tempUser && tempRole) {
      const isPending = assignedTo.some(a => a.userId === tempUser);
      const isExisting = project?.members?.some((m: any) => m.user.id === tempUser);

      if (isPending || isExisting) {
        setErrorMessage('This user is already added to the project.');
        setShowErrorModal(true);
        return;
      }

      setAssignedTo([...assignedTo, { userId: tempUser, role: tempRole }]);
      setTempUser(null);
      setTempRole('');
      setIsFormDirty(true);
    }
  };

  const handleSave = async () => {
    await updateMutation.mutateAsync(formData);
    // Add new members
    for (const assignment of assignedTo) {
      await addMemberMutation.mutateAsync({
        user_id: assignment.userId,
        role: assignment.role,
      });
    }

    // Clear assignedTo after saving
    setAssignedTo([]);
    setIsFormDirty(false);

    // Close the modal and return to the project the user came from
    navigate(`/projects/${id}`);
  };

  const handleCreateLabel = () => {
    if (newLabel.name.trim()) {
      createLabelMutation.mutate(newLabel);
    }
  };

  const handleDeleteProject = () => {
    deleteMutation.mutate();
  };

  const handleDeleteClick = () => {
    const isCreator = project?.created_by?.id === currentUser?.id
      || project?.created_by === currentUser?.id;
    if (isCreator) {
      setDeleteModalType('confirm');
    } else {
      setDeleteModalType('denied');
    }
    setDeleteModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
      </div>
    );
  }

  const labels = project.labels || [];

  // Determine if the current user has owner privileges
  const isOwner = project?.created_by?.id === currentUser?.id || 
                  project?.created_by === currentUser?.id || 
                  project?.members?.some((m: any) => m.user?.id === currentUser?.id && m.role === 'owner');

  const selectedTypeConfig = TASK_TYPES.find(t => t.value === formData.task_type);
  const selectedStatusConfig = STATUS_MAP[formData.status];

  return (
    <Modal isOpen onClose={() => navigate(`/projects/${id}`)} maxWidth="max-w-3xl">
      <ModalHeader
        title="Project Settings"
        subtitle={project?.name}
        onClose={() => navigate(`/projects/${id}`)}
        actions={
          activeTab === 'general' ? (
            <button
              onClick={handleSave}
              disabled={!isFormDirty || updateMutation.isPending}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, border: 'none', background: (!isFormDirty || updateMutation.isPending) ? '#94a3b8' : BLUE, color: '#fff', fontSize: 13, fontWeight: 600, cursor: (!isFormDirty || updateMutation.isPending) ? 'not-allowed' : 'pointer', transition: 'background .15s', whiteSpace: 'nowrap' }}
            >
              <Save size={13} />
              {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          ) : null
        }
      />

      {/* Tabs — single set, inline style system matching the rest of the modal */}
      <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${LINE}`, padding: '0 24px', background: '#fff' }}>
        {([
          { key: 'general', label: 'General',              icon: <Settings size={13} /> },
          { key: 'labels',  label: `Labels (${labels.length})`, icon: <Tags size={13} /> },
          { key: 'danger',  label: 'Danger Zone',          icon: <AlertTriangle size={13} /> },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '14px 12px', fontSize: 13, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', color: activeTab === tab.key ? (tab.key === 'danger' ? '#ef4444' : BLUE) : MUTED, borderBottom: `2px solid ${activeTab === tab.key ? (tab.key === 'danger' ? '#ef4444' : BLUE) : 'transparent'}`, transition: 'all .15s', marginBottom: -1 }}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 24, background: BG, display: 'flex', flexDirection: 'column', gap: 20, fontFamily: '-apple-system,BlinkMacSystemFont,"Inter",system-ui,sans-serif' }}>

     {/* ── General Tab ── */}
        {activeTab === 'general' && (
          <>
            {/* Core Details card */}
            <div style={{ ...CARD_STYLE, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Name + Created By */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="Project Name" icon={<FolderKanban size={13} />} required>
                  <input
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={e => { handleChange(e); }}
                    placeholder="Enter project name"
                    style={INPUT_STYLE}
                    onFocus={e => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(22,99,246,.08)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = LINE; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </FormField>
                <FormField label="Created By">
                  <div style={{ ...INPUT_STYLE, height: 38, display: 'flex', alignItems: 'center', background: '#f9fafb', cursor: 'default' }}>
                    <span style={{ fontSize: 13, color: TEXT }}>{project.created_by?.full_name || project.created_by?.username || '—'}</span>
                  </div>
                </FormField>
              </div>

              {/* Project Type + Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div ref={taskTypeDropdownRef}>
                  <FormField label="Project Type" icon={<Tag size={13} />} required>
                    <DropdownTrigger
                      label={selectedTypeConfig?.label}
                      placeholder="Select type…"
                      onClick={() => { setTaskTypeDropdownOpen(v => !v); setStatusDropdownOpen(false); }}
                      open={taskTypeDropdownOpen}
                      dotColor={selectedTypeConfig?.hex}
                      triggerRef={taskTypeTriggerRef}
                    />
                    {taskTypeDropdownOpen && (
                      <DropdownList triggerRef={taskTypeTriggerRef}>
                        {TASK_TYPES.map(type => (
                          <DropdownItem key={type.value} label={type.label} selected={formData.task_type === type.value}
                            onClick={() => { setFormData(prev => ({ ...prev, task_type: type.value as TaskType })); setTaskTypeDropdownOpen(false); setIsFormDirty(true); }}
                            icon={<span style={{ width: 8, height: 8, borderRadius: '50%', background: type.hex, flexShrink: 0, display: 'inline-block' }} />}
                          />
                        ))}
                      </DropdownList>
                    )}
                  </FormField>
                </div>

              <div ref={statusDropdownRef}>
                  <FormField label="Status">
                    <DropdownTrigger
                      label={selectedStatusConfig?.label}
                      placeholder="Select status…"
                      onClick={() => { setStatusDropdownOpen(v => !v); setTaskTypeDropdownOpen(false); }}
                      open={statusDropdownOpen}
                      dotColor={selectedStatusConfig?.color}
                      triggerRef={statusTriggerRef}
                    />
                    {statusDropdownOpen && (
                      <DropdownList triggerRef={statusTriggerRef}>
                        {Object.entries(STATUS_MAP).map(([value, cfg]) => (
                          <DropdownItem key={value} label={cfg.label} selected={formData.status === value}
                            onClick={() => { setFormData(prev => ({ ...prev, status: value as ProjectStatus })); setStatusDropdownOpen(false); setIsFormDirty(true); }}
                            icon={<span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, flexShrink: 0, display: 'inline-block' }} />}
                          />
                        ))}
                      </DropdownList>
                    )}
                  </FormField>
                </div>
              </div>

              {/* Description */}
              <FormField label="Description">
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Describe the project…"
                  rows={3}
                  style={{ ...INPUT_STYLE, height: 'auto', padding: '10px 12px', resize: 'vertical' }}
                  onFocus={e => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(22,99,246,.08)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = LINE; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </FormField>
            </div>

            {/* Team Members card */}
            <div style={{ ...CARD_STYLE, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FormField label="Team Members" icon={<Users size={13} />}>
                {/* Existing members */}
                {project.members && project.members.length > 0 && (
                  <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
                    {project.members.map((member: any, index: number) => {
                      const displayName = member.full_name || member.user?.full_name || (member.user?.first_name && member.user?.last_name ? `${member.user.first_name} ${member.user.last_name}` : member.user?.username) || '—';
                      const roleLabel = PROJECT_ROLES.find(r => r.value === member.role)?.label || member.role || '—';
                      return (
                        <div key={member.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: index !== project.members.length - 1 ? `1px solid ${LINE}` : 'none', background: '#fff' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#EEF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: BLUE }}>{displayName.charAt(0)}</div>
                            <div>
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT }}>{displayName}</p>
                              <p style={{ margin: 0, fontSize: 11, color: MUTED }}>{roleLabel}</p>
                            </div>
                          </div>
                          {isOwner && (
                            <button type="button" onClick={() => setMemberToDelete({ id: member.user.id, name: displayName })} disabled={removeMemberMutation.isPending}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, padding: 4, borderRadius: 4, display: 'flex' }}
                              onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                              onMouseLeave={e => e.currentTarget.style.color = MUTED}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add new member row */}
                <div style={{ display: 'flex', gap: 8 }}>
                 <div style={{ flex: 1 }} ref={userDropdownRef}>
                    <DropdownTrigger label={tempUser ? usersData?.find(u => u.value === tempUser)?.label : undefined} placeholder="Select member…" onClick={() => setUserDropdownOpen(v => !v)} open={userDropdownOpen} triggerRef={userTriggerRef} />
                    {userDropdownOpen && (
                      <DropdownList triggerRef={userTriggerRef}>
                        {usersData?.filter(u => !assignedTo.some(a => a.userId === u.value) && !project.members?.some((m: any) => m.user.id === u.value)).map(user => (
                          <DropdownItem key={user.value} label={user.label} onClick={() => { setTempUser(user.value); setUserDropdownOpen(false); }} />
                        ))}
                      </DropdownList>
                    )}
                  </div>
                  <div style={{ flex: 1 }} ref={roleDropdownRef}>
                    <DropdownTrigger label={tempRole ? PROJECT_ROLES.find(r => r.value === tempRole)?.label : undefined} placeholder="Select role…" onClick={() => setRoleDropdownOpen(v => !v)} open={roleDropdownOpen} triggerRef={roleTriggerRef} />
                    {roleDropdownOpen && (
                      <DropdownList triggerRef={roleTriggerRef}>
                        {PROJECT_ROLES.map(role => (
                          <DropdownItem key={role.value} label={role.label} selected={tempRole === role.value} onClick={() => { setTempRole(role.value); setRoleDropdownOpen(false); }} />
                        ))}
                      </DropdownList>
                    )}
                  </div>
                  <button type="button" onClick={handleAddMember} disabled={!tempUser || !tempRole}
                    style={{ height: 38, width: 44, borderRadius: 8, border: `1px solid ${LINE}`, background: (!tempUser || !tempRole) ? '#f3f4f6' : BLUE, color: (!tempUser || !tempRole) ? MUTED : '#fff', cursor: (!tempUser || !tempRole) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' }}>
                    <Plus size={16} />
                  </button>
                </div>

                {/* Pending new members */}
                {assignedTo.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                    {assignedTo.map(assignment => {
                      const user = usersData?.find(u => u.value === assignment.userId);
                      const roleLabel = PROJECT_ROLES.find(r => r.value === assignment.role)?.label;
                      if (!user) return null;
                      return (
                        <div key={assignment.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#EEF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: BLUE }}>{user.label.charAt(0)}</div>
                            <div>
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT }}>{user.label}</p>
                              <p style={{ margin: 0, fontSize: 11, color: MUTED }}>{roleLabel} · pending</p>
                            </div>
                          </div>
                          <button type="button" onClick={() => setAssignedTo(assignedTo.filter(a => a.userId !== assignment.userId))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, padding: 4, borderRadius: 4, display: 'flex' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                            onMouseLeave={e => e.currentTarget.style.color = MUTED}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </FormField>
            </div>

            {/* Discard row — only shown when dirty */}
            {isFormDirty && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button"
                  onClick={() => { if (project) { setFormData({ name: project.name, description: project.description || '', task_type: project.task_type, status: (project.status || 'active') as ProjectStatus }); } setIsFormDirty(false); }}
                  style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', fontSize: 13, fontWeight: 500, color: MUTED, cursor: 'pointer' }}>
                  Discard Changes
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Labels Tab ── */}
        {activeTab === 'labels' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ ...CARD_STYLE, padding: 20 }}>
              <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: TEXT }}>Create New Label</p>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <Input value={newLabel.name} onChange={e => setNewLabel(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g., High Priority, Needs Review" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="color" value={newLabel.color} onChange={e => setNewLabel(prev => ({ ...prev, color: e.target.value }))} style={{ width: 36, height: 36, borderRadius: 6, border: `1px solid ${LINE}`, cursor: 'pointer' }} />
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 140 }}>
                    {PRESET_COLORS.slice(0, 8).map(color => (
                      <button key={color} type="button" onClick={() => setNewLabel(prev => ({ ...prev, color }))}
                        style={{ width: 18, height: 18, borderRadius: 4, background: color, border: newLabel.color === color ? `2px solid ${BLUE}` : '2px solid transparent', cursor: 'pointer' }} />
                    ))}
                  </div>
                </div>
                <Button onClick={handleCreateLabel} disabled={!newLabel.name.trim() || createLabelMutation.isPending}>
                  <Plus className="h-4 w-4 mr-1" />Add
                </Button>
              </div>
            </div>
            <div style={{ ...CARD_STYLE, padding: 20 }}>
              <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: TEXT }}>Project Labels</p>
              {labels.length > 0 ? labels.map((label: Label) => (
                <div key={label.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${LINE}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 14, height: 14, borderRadius: '50%', background: label.color, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{label.name}</span>
                    {label.description && <span style={{ fontSize: 12, color: MUTED }}>{label.description}</span>}
                  </div>
                  <button type="button" onClick={() => deleteLabelMutation.mutate(label.id)} disabled={deleteLabelMutation.isPending}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, padding: 4, display: 'flex' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = MUTED}>
                    <X size={14} />
                  </button>
                </div>
              )) : (
                <div style={{ textAlign: 'center', padding: '32px 0', color: MUTED }}>
                  <Tags size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                  <p style={{ margin: 0, fontSize: 13 }}>No labels created yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Danger Zone Tab ── */}
        {activeTab === 'danger' && (
          <div style={{ ...CARD_STYLE, padding: 20, border: '1px solid #fecaca', background: '#fff' }}>
            <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: '#dc2626' }}>Delete Project</p>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#b91c1c' }}>
              This will permanently delete the project, all documents, tasks and associated data. This action cannot be undone.
            </p>
            <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-100" onClick={handleDeleteClick}>
              <Trash2 className="h-4 w-4 mr-2" />Delete Project
            </Button>
          </div>
        )}

      </div>{/* end scrollable body */}

      <DeleteModal
        isOpen={deleteModalOpen}
        type={deleteModalType}
        itemType="project"
        itemName={deleteModalType === 'confirm' ? project?.name : undefined}
        onConfirm={() => {
          setDeleteModalOpen(false);
          handleDeleteProject();
        }}
        onCancel={() => setDeleteModalOpen(false)}
        isDeleting={deleteMutation.isPending}
      />

      {/* New Modal for Removing Members */}
      <DeleteModal
        isOpen={!!memberToDelete}
        type="confirm"
        itemType="member"
        itemName={memberToDelete?.name}
        onConfirm={() => {
          if (memberToDelete) {
            removeMemberMutation.mutate(memberToDelete.id, {
              onSettled: () => setMemberToDelete(null) // Close the modal when the request finishes
            });
          }
        }}
        onCancel={() => setMemberToDelete(null)}
        isDeleting={removeMemberMutation.isPending}
      />

     {showErrorModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
          <div className="bg-background border rounded-lg shadow-xl max-w-md w-full p-6 space-y-4 mx-4">
            <div className="flex items-center gap-3 text-destructive">
              <div className="p-2 bg-destructive/10 rounded-full">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">Action Failed</h3>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">{errorMessage}</p>
            <div className="flex justify-end pt-2">
              <Button onClick={() => setShowErrorModal(false)} className="min-w-[100px]">Close</Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}