import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Trash2, Plus, X, Users, Tags, Settings, AlertTriangle, } from 'lucide-react';
import {
  Button, Input, Card, CardHeader, CardTitle, CardContent, Badge,
} from '@/components/common';
import { projectsApi, usersApi } from '@/services/api';
import { cn, getProjectTypeColor } from '@/lib/utils';
import type { Project, Label, TaskType, User as AppUser } from '@/types';

const TASK_TYPES = [
  { value: 'client', label: 'Client' },
  { value: 'internal', label: 'Internal' },
  { value: 'content_creation', label: 'Content Creation' },
  { value: 'ideas', label: 'Ideas' },
];

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
];

const PROJECT_ROLES = [
  { label: 'Manager', value: 'manager' },
  { label: 'Frontend Developer', value: 'frontend' },
  { label: 'Backend Developer', value: 'backend' },
  { label: 'Testing Engineer', value: 'tester' },
  { label: 'DevOps Engineer', value: 'devops' },
  { label: 'Social Media', value: 'social_media' }
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
  }>({
    name: '',
    description: '',
    task_type: 'key_value' as TaskType,
  });
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
  const [newLabel, setNewLabel] = useState({ name: '', color: '#3b82f6' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
    setFormData({
      name: project.name,
      description: project.description || '',
      task_type: project.task_type,
    });
    setIsProjectDataLoaded(true);
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target as Node)) {
        setRoleDropdownOpen(false);
      }
      if (taskTypeDropdownRef.current && !taskTypeDropdownRef.current.contains(event.target as Node)) {
        setTaskTypeDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Project>) => projectsApi.update(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
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

    // Navigate back to projects
    navigate('/projects');
  };

  const handleCreateLabel = () => {
    if (newLabel.name.trim()) {
      createLabelMutation.mutate(newLabel);
    }
  };

  const handleDeleteProject = () => {
    deleteMutation.mutate();
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
        <h2 className="text-xl font-semibold">Project not found</h2>
        <Link to="/projects" className="text-primary hover:underline">
          Back to projects
        </Link>
      </div>
    );
  }

  const labels = project.labels || [];

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          to={`/projects/${id}`}
          className="p-3 bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] hover:bg-slate-50 hover:shadow-md hover:-translate-x-0.5 transition-all duration-200 text-black flex items-center justify-center"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-[1.3rem] font-bold text-black leading-tight tracking-tight">
            Project Settings
          </h1>
          <p className="text-base text-slate-500 mt-0.5">
            {project?.name}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'general'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          <Settings className="h-4 w-4 inline mr-2" />
          General
        </button>
        <button
          onClick={() => setActiveTab('labels')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'labels'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          <Tags className="h-4 w-4 inline mr-2" />
          Labels ({labels.length})
        </button>
        <button
          onClick={() => setActiveTab('danger')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'danger'
            ? 'border-red-500 text-red-500'
            : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          <AlertTriangle className="h-4 w-4 inline mr-2" />
          Danger Zone
        </button>
      </div>

      {/* General Tab */}
      {activeTab === 'general' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-[1.3rem] font-bold text-black leading-tight tracking-tight">
              Project Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Project Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter project name"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Members
                </label>
                <div className="min-h-[40px] w-full rounded-md border border-input bg-muted/20 px-3 py-2">
                  {project.members && project.members.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {project.members.map((member: any) => {
                        // Fallback logic: Try direct full_name, then nested user.full_name, then username
                        const displayName =
                          member.full_name ||
                          member.user?.full_name ||
                          member.user?.username ||
                          member.user?.first_name + ' ' + member.user?.last_name;

                        return (
                          <Badge
                            key={member.id}
                            variant="secondary"
                            className="font-normal"
                          >
                            {displayName}
                          </Badge>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground h-full flex items-center">
                      No members assigned
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe the project"
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            {/* Assigned To (Reused from ProjectCreate) */}
            <div className="space-y-3">
              <label className="text-sm font-medium">
                Assigned To <span className="text-destructive">*</span>
              </label>

              <div className="flex gap-3">
                {/* Left: User Select (50%) */}
                <div className="relative flex-1" ref={userDropdownRef}>
                  <div
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  >
                    <span className={tempUser ? "text-foreground" : "text-muted-foreground"}>
                      {tempUser ? usersData?.find(u => u.value === tempUser)?.label : "Select User"}
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><path d="m6 9 6 6 6-6" /></svg>
                  </div>

                  {userDropdownOpen && (
                    <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
                      {usersData
                        ?.filter((user) =>
                          !assignedTo.some((a) => a.userId === user.value) &&
                          !project.members?.some((m: any) => m.user.id === user.value)
                        )
                        .map((user) => (
                          <div
                            key={user.value}
                            className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                            onClick={() => {
                              setTempUser(user.value);
                              setUserDropdownOpen(false);
                            }}
                          >
                            {user.label}
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Right: Role Select + Add Button */}
                <div className="flex flex-1 gap-2">
                  <div className="relative flex-1" ref={roleDropdownRef}>
                    <div
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                      onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                    >
                      <span className={tempRole ? "text-foreground" : "text-muted-foreground"}>
                        {PROJECT_ROLES.find(r => r.value === tempRole)?.label || "Select Role"}
                      </span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><path d="m6 9 6 6 6-6" /></svg>
                    </div>

                    {roleDropdownOpen && (
                      <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
                        {PROJECT_ROLES.map((role) => (
                          <div
                            key={role.value}
                            className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                            onClick={() => {
                              setTempRole(role.value);
                              setRoleDropdownOpen(false);
                            }}
                          >
                            {role.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-10 w-12 bg-muted/50 hover:bg-muted shrink-0"
                    onClick={handleAddMember}
                    disabled={!tempUser || !tempRole}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Rendered List  */}
              {assignedTo.length > 0 && (
                <div className="space-y-2 mt-2 max-w-md">
                  {assignedTo.map((assignment) => {
                    const user = usersData?.find((u) => u.value === assignment.userId);
                    const roleLabel = PROJECT_ROLES.find((r) => r.value === assignment.role)?.label;
                    if (!user) return null;

                    return (
                      <div key={assignment.userId} className="flex items-center justify-between p-2 rounded-md border bg-card">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                            {user.label.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{user.label}</span>
                            <span className="text-xs text-muted-foreground">{roleLabel}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive p-1"
                          onClick={() => setAssignedTo(assignedTo.filter((a) => a.userId !== assignment.userId))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Task Type - Reused from ProjectCreate */}
            <div className="relative space-y-2" ref={taskTypeDropdownRef}>
              <label className="text-sm font-medium">
                Task Type <span className="text-destructive">*</span>
              </label>

              <div
                className="w-full p-3 rounded-lg border border-input bg-background cursor-pointer flex items-center justify-between min-h-[50px] text-sm"
                onClick={() => setTaskTypeDropdownOpen(!taskTypeDropdownOpen)}
              >
                <span className={formData.task_type ? "text-foreground" : "text-muted-foreground"}>
                  {TASK_TYPES.find(t => t.value === formData.task_type)?.label || "Select Task Type..."}
                </span>
                <svg
                  className={`h-4 w-4 text-muted-foreground transition-transform ${taskTypeDropdownOpen ? 'rotate-180' : ''}`}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {taskTypeDropdownOpen && (
                <div className="absolute z-30 mt-1 w-full bg-popover border rounded-lg shadow-lg max-h-56 overflow-y-auto">
                  {TASK_TYPES.map((type) => (
                    <div
                      key={type.value}
                      className={`px-4 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground flex justify-between ${formData.task_type === type.value ? "bg-accent/50" : ""
                        }`}
                      onClick={() => {
                        setFormData(prev => ({ ...prev, task_type: type.value as TaskType }));
                        setTaskTypeDropdownOpen(false);
                        setIsFormDirty(true);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {/* Color Circle */}
                        <div className={cn("h-3 w-3 rounded-full", getProjectTypeColor(type.value))} />
                        <span>{type.label}</span>
                      </div>
                      {formData.task_type === type.value && <span className="text-primary font-bold">✓</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button
                onClick={handleSave}
                disabled={!isFormDirty || updateMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
              {isFormDirty && (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (project) {
                      setFormData({
                        name: project.name,
                        description: project.description || '',
                        task_type: project.task_type,
                      });
                    }
                    setIsFormDirty(false);
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Labels Tab */}
      {activeTab === 'labels' && (
        <div className="space-y-6">
          {/* Create Label */}
          <Card>
            <CardHeader>
              <CardTitle>Create New Label</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-end">
                <div className="flex-1 space-y-2">
                  <label className="text-sm font-medium">Label Name</label>
                  <Input
                    value={newLabel.name}
                    onChange={(e) => setNewLabel((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., High Priority, Needs Review"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Color</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={newLabel.color}
                      onChange={(e) => setNewLabel((prev) => ({ ...prev, color: e.target.value }))}
                      className="w-10 h-10 rounded border cursor-pointer"
                    />
                    <div className="flex gap-1 flex-wrap max-w-48">
                      {PRESET_COLORS.slice(0, 8).map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewLabel((prev) => ({ ...prev, color }))}
                          className={`w-5 h-5 rounded ${newLabel.color === color ? 'ring-2 ring-offset-1 ring-primary' : ''}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <Button
                  onClick={handleCreateLabel}
                  disabled={!newLabel.name.trim() || createLabelMutation.isPending}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Existing Labels */}
          <Card>
            <CardHeader>
              <CardTitle>Project Labels</CardTitle>
            </CardHeader>
            <CardContent>
              {labels.length > 0 ? (
                <div className="space-y-2">
                  {labels.map((label: Label) => (
                    <div
                      key={label.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: label.color }}
                        />
                        <span className="font-medium">{label.name}</span>
                        {label.description && (
                          <span className="text-sm text-muted-foreground">
                            {label.description}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteLabelMutation.mutate(label.id)}
                        disabled={deleteLabelMutation.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Tags className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No labels created yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Danger Zone Tab */}
      {activeTab === 'danger' && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 border border-red-200 rounded-lg bg-red-50">
              <h4 className="font-medium text-red-800 mb-2">Delete Project</h4>
              <p className="text-sm text-red-600 mb-4">
                This will permanently delete the project, all documents, ground truth versions,
                and associated data. This action cannot be undone.
              </p>

              {!showDeleteConfirm ? (
                <Button
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-100"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Project
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-red-800">
                    Are you sure? Type "{project.name}" to confirm.
                  </p>
                  <div className="flex gap-3">
                    <Input
                      placeholder="Type project name to confirm"
                      id="confirm-delete"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                    />
                    <Button
                      variant="destructive"
                      onClick={handleDeleteProject}
                      disabled={deleteMutation.isPending || deleteConfirmText !== project.name}
                    >
                      {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmText('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      {/* Error Popup Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
          <div className="bg-background border rounded-lg shadow-xl max-w-md w-full p-6 space-y-4 mx-4">
            <div className="flex items-center gap-3 text-destructive">
              <div className="p-2 bg-destructive/10 rounded-full">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">Action Failed</h3>
            </div>

            <p className="text-muted-foreground text-sm leading-relaxed">
              {errorMessage}
            </p>

            <div className="flex justify-end pt-2">
              <Button
                onClick={() => setShowErrorModal(false)}
                className="min-w-[100px]"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}