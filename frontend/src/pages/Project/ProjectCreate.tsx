import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, X, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
} from '@/components/common';
import { projectsApi, usersApi } from '@/services/api';
import type { User as AppUser, ProjectCreatePayload } from '@/types';
import { cn, getProjectTypeColor } from '@/lib/utils';

const TASK_TYPES = [
  { value: 'client', label: 'Client' },
  { value: 'internal', label: 'Internal' },
  { value: 'content_creation', label: 'Content Creation' },
  { value: 'ideas', label: 'Ideas' },
];

const PROJECT_ROLES = [
  { label: 'Manager', value: 'manager' },
  { label: 'Frontend Developer', value: 'frontend' },
  { label: 'Backend Developer', value: 'backend' },
  { label: 'Testing Engineer', value: 'tester' },
  { label: 'DevOps Engineer', value: 'devops' },
  { label: 'Social Media', value: 'social_media' }
];


export function ProjectCreate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    task_type: 'key_value',
  });
  const [assignedTo, setAssignedTo] = useState<{ userId: number; role: string }[]>([]);
  const [tempUser, setTempUser] = useState<number | null>(null);
  const [tempRole, setTempRole] = useState<string>('');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const taskTypeDropdownRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [taskTypeDropdownOpen, setTaskTypeDropdownOpen] = useState(false);
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
    mutationFn: (data: ProjectCreatePayload) => {
      return projectsApi.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'], exact: false });
      navigate('/projects');
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to create project');
    },
  });

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
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/projects"
          className="p-2 hover:bg-accent rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Create Project</h1>
          <p className="text-muted-foreground">
            Set up a new ground truth project
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

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
                required
              />
            </div>

            {/* Description Section */}
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe the project purpose and scope"
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Assigned To (Split UI) */}
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
                        ?.filter((user) => !assignedTo.some((a) => a.userId === user.value))
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

                {/* Right: Role Select + Add Button (50%) */}
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

              {/* Rendered List Below */}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Task Type*/}
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
                          setFormData(prev => ({ ...prev, task_type: type.value }));
                          setTaskTypeDropdownOpen(false);
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
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Project'}
              </Button>
              <Link to="/projects">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
