import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, FolderKanban, AlertCircle, Tag, Users } from 'lucide-react';
import { projectsApi, usersApi } from '@/services/api';
import type { User as AppUser, ProjectCreatePayload, ProjectStatus } from '@/types';
import { PROJECT_TYPE_OPTIONS as TASK_TYPES } from '@/config/projectTypeConfig';
import { Modal, ModalHeader } from '@/components/common/Modal';
import { FormField } from '@/pages/MyTask/pages/CreateTask/components/FormField';
import { BLUE, LINE, MUTED, TEXT, BG, INPUT_STYLE, CARD_STYLE } from '@/pages/MyTask/pages/CreateTask/createTaskConstants';
import { STATUS_MAP } from '@/pages/Project/projectConstants';
import { PROJECT_ROLES, DropdownTrigger, DropdownList, DropdownItem } from '@/pages/Project/components/ProjectDropdowns';

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    navigateOnSuccess?: boolean;
}

export function CreateProjectModal({ isOpen, onClose, navigateOnSuccess = false }: CreateProjectModalProps) {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        task_type: 'client',
        status: 'active' as ProjectStatus,
    });
    const [assignedTo, setAssignedTo] = useState<{ userId: number; role: string }[]>([]);
    const [tempUser, setTempUser] = useState<number | null>(null);
    const [tempRole, setTempRole] = useState<string>('');
    const [userDropdownOpen, setUserDropdownOpen] = useState(false);
    const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
    const [taskTypeDropdownOpen, setTaskTypeDropdownOpen] = useState(false);
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
    const userDropdownRef = useRef<HTMLDivElement>(null);
    const roleDropdownRef = useRef<HTMLDivElement>(null);
    const taskTypeDropdownRef = useRef<HTMLDivElement>(null);
    const statusDropdownRef = useRef<HTMLDivElement>(null);
    const taskTypeTriggerRef = useRef<HTMLDivElement>(null);
    const statusTriggerRef = useRef<HTMLDivElement>(null);
    const userTriggerRef = useRef<HTMLDivElement>(null);
    const roleTriggerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState('');

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

    const createMutation = useMutation({
        mutationFn: (data: ProjectCreatePayload) => projectsApi.create(data),
        onSuccess: (newProject) => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            queryClient.invalidateQueries({ queryKey: ['project-chat-rooms'] });
            queryClient.invalidateQueries({ queryKey: ['sidebar-all-chat-rooms'] });
            queryClient.setQueryData(['project', String(newProject.id)], newProject);

            onClose();
        },
        onError: (error) => {
            console.error("Failed to create project:", error);
        }
    });

    const handleClose = () => {
        setFormData({ name: '', description: '', task_type: 'client', status: 'active' });
        setAssignedTo([]);
        setTempUser(null);
        setTempRole('');
        setError('');
        setUserDropdownOpen(false);
        setRoleDropdownOpen(false);
        setTaskTypeDropdownOpen(false);
        setStatusDropdownOpen(false);
        onClose();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!formData.name.trim()) {
            setError('Project name is required');
            return;
        }
        const assigned_members = assignedTo.map(assignment => ({
            user_id: assignment.userId,
            role: assignment.role || 'member'
        }));

        createMutation.mutate({
            ...formData,
            assigned_members,
            project_settings: { priority: "high" }
        });
    };

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        setFormData((prev) => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    const handleDescriptionChange = (html: string) => {
        setFormData((prev) => ({
            ...prev,
            description: html,
        }));
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;
            if (target.closest?.('[data-project-dropdown-portal]')) return;

            if (userDropdownRef.current && !userDropdownRef.current.contains(target)) setUserDropdownOpen(false);
            if (roleDropdownRef.current && !roleDropdownRef.current.contains(target)) setRoleDropdownOpen(false);
            if (taskTypeDropdownRef.current && !taskTypeDropdownRef.current.contains(target)) setTaskTypeDropdownOpen(false);
            if (statusDropdownRef.current && !statusDropdownRef.current.contains(target)) setStatusDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleAddMember = () => {
        if (tempUser && tempRole) {
            if (assignedTo.some(a => a.userId === tempUser)) {
                setTempUser(null);
                setTempRole('');
                return;
            }
            setAssignedTo([...assignedTo, { userId: tempUser, role: tempRole }]);
            setTempUser(null);
            setTempRole('');
        }
    };

    // Close modal on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                handleClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const selectedTypeConfig = TASK_TYPES.find(t => t.value === formData.task_type);
    const selectedStatusConfig = STATUS_MAP[formData.status];

    return (
        <Modal isOpen={isOpen} onClose={handleClose} maxWidth="max-w-2xl">
            <ModalHeader
                title="Create Project"
                subtitle="Fill in the details below to create a new project"
                onClose={handleClose}
                actions={
                    <button
                        type="submit"
                        form="create-project-form"
                        disabled={createMutation.isPending}
                        style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: createMutation.isPending ? '#94a3b8' : BLUE, color: '#fff', fontSize: 13, fontWeight: 600, cursor: createMutation.isPending ? 'not-allowed' : 'pointer', transition: 'background .15s', whiteSpace: 'nowrap' }}
                    >
                        {createMutation.isPending ? 'Creating…' : 'Create Project'}
                    </button>
                }
            />

            <form
                id="create-project-form"
                onSubmit={handleSubmit}
                style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, background: 'hsl(var(--background))', fontFamily: '-apple-system,BlinkMacSystemFont,"Inter",system-ui,sans-serif' }}
            >
                {/* Error banner */}
                {error && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca' }}>
                        <AlertCircle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                        <p style={{ fontSize: 13, color: '#b91c1c', margin: 0 }}>{error}</p>
                    </div>
                )}

                {/* ── Section 1: Core Info ── */}
                <div style={{ ...CARD_STYLE, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* Project Name */}
                    <FormField label="Project Name" icon={<FolderKanban size={13} />} required>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={e => {
                                const raw = e.target.value;
                                const titled = raw.split(' ').map(w => w.length > 0 ? w[0].toLocaleUpperCase() + w.slice(1) : '').join(' ');
                                setFormData(prev => ({ ...prev, name: titled }));
                            }}
                            placeholder="Enter project name…"
                            required
                            style={INPUT_STYLE}
                            onFocus={e => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(22,99,246,.08)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = LINE; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                    </FormField>

                    {/* Project Type + Status — side by side */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

                        {/* Project Type */}
                        <div ref={taskTypeDropdownRef}>
                            <FormField label="Project Type" icon={<Tag size={13} />} required>
                                <DropdownTrigger
                                    label={selectedTypeConfig ? selectedTypeConfig.label : undefined}
                                    placeholder="Select type…"
                                    onClick={() => { setTaskTypeDropdownOpen(v => !v); setStatusDropdownOpen(false); }}
                                    open={taskTypeDropdownOpen}
                                    dotColor={selectedTypeConfig?.hex}
                                    triggerRef={taskTypeTriggerRef}
                                />
                                {taskTypeDropdownOpen && (
                                    <DropdownList triggerRef={taskTypeTriggerRef}>
                                        {TASK_TYPES.map(type => (
                                            <DropdownItem
                                                key={type.value}
                                                label={type.label}
                                                selected={formData.task_type === type.value}
                                                onClick={() => { setFormData(prev => ({ ...prev, task_type: type.value })); setTaskTypeDropdownOpen(false); }}
                                                icon={<span style={{ width: 8, height: 8, borderRadius: '50%', background: type.hex, flexShrink: 0, display: 'inline-block' }} />}
                                            />
                                        ))}
                                    </DropdownList>
                                )}
                            </FormField>
                        </div>

                        {/* Status */}
                        <div ref={statusDropdownRef}>
                            <FormField label="Status">
                                <DropdownTrigger
                                    label={selectedStatusConfig ? selectedStatusConfig.label : undefined}
                                    placeholder="Select status…"
                                    onClick={() => { setStatusDropdownOpen(v => !v); setTaskTypeDropdownOpen(false); }}
                                    open={statusDropdownOpen}
                                    dotColor={selectedStatusConfig?.color}
                                    triggerRef={statusTriggerRef}
                                />
                                {statusDropdownOpen && (
                                    <DropdownList triggerRef={statusTriggerRef}>
                                        {Object.entries(STATUS_MAP).map(([value, cfg]) => (
                                            <DropdownItem
                                                key={value}
                                                label={cfg.label}
                                                selected={formData.status === value}
                                                onClick={() => { setFormData(prev => ({ ...prev, status: value as ProjectStatus })); setStatusDropdownOpen(false); }}
                                                icon={<span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, flexShrink: 0, display: 'inline-block' }} />}
                                            />
                                        ))}
                                    </DropdownList>
                                )}
                            </FormField>
                        </div>
                    </div>
                </div>

                {/* ── Section 2: Team Members ── */}
                <div style={{ ...CARD_STYLE, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <FormField label="Team Members" icon={<Users size={13} />}>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {/* User dropdown */}
                            <div style={{ flex: 1 }} ref={userDropdownRef}>
                                <DropdownTrigger
                                    label={tempUser ? usersData?.find(u => u.value === tempUser)?.label : undefined}
                                    placeholder="Select member…"
                                    onClick={() => setUserDropdownOpen(v => !v)}
                                    open={userDropdownOpen}
                                    triggerRef={userTriggerRef}
                                />
                                {userDropdownOpen && (
                                    <DropdownList triggerRef={userTriggerRef}>
                                        {usersData?.filter(u => !assignedTo.some(a => a.userId === u.value)).map(user => (
                                            <DropdownItem key={user.value} label={user.label} onClick={() => { setTempUser(user.value); setUserDropdownOpen(false); }} />
                                        ))}
                                    </DropdownList>
                                )}
                            </div>

                          {/* Role dropdown */}
                            <div style={{ flex: 1 }} ref={roleDropdownRef}>
                                <DropdownTrigger
                                    label={tempRole ? PROJECT_ROLES.find(r => r.value === tempRole)?.label : undefined}
                                    placeholder="Select role…"
                                    onClick={() => setRoleDropdownOpen(v => !v)}
                                    open={roleDropdownOpen}
                                    triggerRef={roleTriggerRef}
                                />
                                {roleDropdownOpen && (
                                    <DropdownList triggerRef={roleTriggerRef}>
                                        {PROJECT_ROLES.map(role => (
                                            <DropdownItem key={role.value} label={role.label} selected={tempRole === role.value} onClick={() => { setTempRole(role.value); setRoleDropdownOpen(false); }} />
                                        ))}
                                    </DropdownList>
                                )}
                            </div>

                            {/* Add button */}
                            <button
                                type="button"
                                onClick={handleAddMember}
                                disabled={!tempUser || !tempRole}
                                style={{ height: 38, width: 44, borderRadius: 8, border: `1px solid hsl(var(--border))`, background: (!tempUser || !tempRole) ? 'hsl(var(--muted))' : BLUE, color: (!tempUser || !tempRole) ? 'hsl(var(--muted-foreground))' : '#fff', cursor: (!tempUser || !tempRole) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' }}
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    </FormField>

                    {/* Member list */}
                    {assignedTo.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {assignedTo.map(assignment => {
                                const user = usersData?.find(u => u.value === assignment.userId);
                                const roleLabel = PROJECT_ROLES.find(r => r.value === assignment.role)?.label;
                                if (!user) return null;
                                return (
                                    <div key={assignment.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, border: `1px solid hsl(var(--border))`, background: 'hsl(var(--muted))' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${BLUE}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: BLUE }}>{user.label.charAt(0)}</div>
                                            <div>
                                                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT }}>{user.label}</p>
                                                <p style={{ margin: 0, fontSize: 11, color: MUTED }}>{roleLabel}</p>
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => setAssignedTo(assignedTo.filter(a => a.userId !== assignment.userId))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, padding: 4, borderRadius: 4, display: 'flex' }}
                                            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                            onMouseLeave={e => e.currentTarget.style.color = MUTED}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </form>
        </Modal>
    );
}