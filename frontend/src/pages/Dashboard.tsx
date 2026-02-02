import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import React from 'react';
import {
  FolderKanban,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Plus,
  ArrowRight,
  TrendingUp,
  Filter,
  ChevronDown,
  Calendar,
  Users,
  Bell
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
} from '@/components/common';
import { projectsApi, documentsApi, taskApi, notificationsApi, } from '@/services/api';
import { formatRelativeTime, getStatusColor } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import type { Project, Document } from '@/types';
import { getStatusConfig } from '@/components/layout/DualView/taskConfig';
import { NotificationsPage } from './NotificationsPage';
import { ProjectGridCard } from '@/components/layout/DualView/projectsConfig';
import { useOutletContext } from 'react-router-dom';

// Type Definitions
type TaskStatus = 'pending' | 'backlog' | 'in_progress' | 'completed' | 'deployed' | 'deferred' | 'review';

interface Task {
  id: number;
  heading: string;
  description: string;
  start_date: string;
  end_date: string;
  priority: string;
  project_name: string | null;
  assigned_to: number[];
  assigned_to_user_details: Array<{
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
  }>;
  status: TaskStatus;
}

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isActivityOpen, setIsActivityOpen } = useOutletContext<{
  isActivityOpen: boolean;
  setIsActivityOpen: (open: boolean) => void;
}>();


  // State Management
  const [selectedTaskStatus, setSelectedTaskStatus] = React.useState<TaskStatus>('in_progress');
  const [showStatusFilter, setShowStatusFilter] = React.useState(false);
  const [updatingTaskId, setUpdatingTaskId] = React.useState<number | null>(null);
  const [updatingDocId, setUpdatingDocId] = React.useState<string | null>(null);
  const queryClient = useQueryClient();
  const [openTaskDropdownId, setOpenTaskDropdownId] = React.useState<number | null>(null);
  const [dropdownPos, setDropdownPos] = React.useState<{ top: number; left: number } | null>(null);
  const [openDocDropdownId, setOpenDocDropdownId] = React.useState<string | null>(null);
  const [docDropdownPos, setDocDropdownPos] = React.useState<{ top: number; left: number } | null>(null);

  // Data Fetching
  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
  });

  const { data: documentsData, isLoading: docsLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => documentsApi.list(),
  });

  const { data: tasksResponse } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => taskApi.list(),
  });

  // Data Processing
  const projects = (projectsData?.results || []) as Project[];
  const documents = (documentsData?.results || []) as Document[];

  const allTasks: Task[] = React.useMemo(() => {
    if (!tasksResponse) {
      return [];
    }

    let tasks: Task[] = [];
    if (Array.isArray(tasksResponse.tasks)) {
      tasks = tasksResponse.tasks;
    } else if (Array.isArray(tasksResponse.results)) {
      tasks = tasksResponse.results;
    } else if (Array.isArray(tasksResponse)) {
      tasks = tasksResponse;
    }
    if (tasks.length > 0) {
    }

    return tasks;
  }, [tasksResponse]);

  const myAssignedTasks = React.useMemo(() => {
    return allTasks;
  }, [allTasks]);

  const filteredTasks = React.useMemo(() => {
    const normalizeStatus = (status: string) => {
      return status.toLowerCase().replace(/[_\s-]/g, '');
    };

    const filtered = myAssignedTasks.filter(task => {
      const taskStatus = normalizeStatus(task.status);
      const selectedStatus = normalizeStatus(selectedTaskStatus);
      const matches = taskStatus === selectedStatus;
      return matches;
    });
    return filtered;
  }, [myAssignedTasks, selectedTaskStatus]);

  const handleStatusUpdate = async (taskId: number, newStatus: TaskStatus, e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    setUpdatingTaskId(taskId);
    try {
      await taskApi.update(taskId, { status: newStatus });

      queryClient.setQueryData(['tasks'], (old: any) => {
        if (!old) return old;
        const update = (list: any[]) => list.map(t => t.id === taskId ? { ...t, status: newStatus } : t);
        if (Array.isArray(old.tasks)) return { ...old, tasks: update(old.tasks) };
        if (Array.isArray(old.results)) return { ...old, results: update(old.results) };
        if (Array.isArray(old)) return update(old);
        return old;
      });

      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleDocStatusUpdate = async (docId: string, newStatus: string, e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    setUpdatingDocId(docId);
    try {
      await documentsApi.update(docId, { status: newStatus } as any);

      // Instant cache update for documents
      queryClient.setQueryData(['documents'], (old: any) => {
        if (!old) return old;
        const update = (list: any[]) => list.map(d => d.id === docId ? { ...d, status: newStatus } : d);
        if (Array.isArray(old.results)) return { ...old, results: update(old.results) };
        if (Array.isArray(old)) return update(old);
        return old;
      });

      queryClient.invalidateQueries({ queryKey: ['documents'] });
    } catch (error) {
      console.error("Failed to update document status:", error);
    } finally {
      setUpdatingDocId(null);
    }
  };

  // Status Options Configuration
  const statusOptions: Array<{ value: TaskStatus; label: string; color: string }> = [
    { value: 'pending', label: 'Pending', color: 'text-yellow-600' },
    { value: 'backlog', label: 'Backlog', color: 'text-orange-600' },
    { value: 'in_progress', label: 'In Progress', color: 'text-blue-600' },
    { value: 'completed', label: 'Completed', color: 'text-green-600' },
    { value: 'deployed', label: 'Deployed', color: 'text-purple-600' },
    { value: 'deferred', label: 'Deferred', color: 'text-gray-600' },
    { value: 'review', label: 'Review', color: 'text-indigo-600' },
  ];


  const recentProjects = Array.isArray(projects)
    ? projects.filter(p =>
      p.is_favourite &&
      p.members?.some(member => member.user.id === user?.id)
    ).slice(0, 5)
    : [];
  const recentDocuments = Array.isArray(documents) ? documents.slice(0, 5) : [];

  // Fetch unread count for the badge
  const { data: summary } = useQuery({
    queryKey: ['notifications-summary'],
    queryFn: () => notificationsApi.getSummary(),
    refetchInterval: 30000,
  });

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short'
      });
    } catch {
      return dateString;
    }
  };

  const toggleFavorite = async (e: React.MouseEvent, project: any) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await projectsApi.update(project.id, {
        is_favourite: !project.is_favourite,
      });
      // Invalidate both lists to ensure UI sync
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Welcome Header */}
      <div className={`flex-1 overflow-y-auto w-full p-8 space-y-8 transition-all duration-300 ${isActivityOpen ? 'mr-0' : ''}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              Welcome back{user?.first_name ? `, ${user.first_name}` : ''}!
            </h1>
            <p className="text-muted-foreground">
              Here’s a quick overview of your workspace.
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/taskboard/create">
              <Button>
                Create Task
              </Button>
            </Link>

            <Link to="/projects/new">
              <Button>
                New Project
              </Button>
            </Link>
            <Button
              className="relative"
              onClick={() => setIsActivityOpen(!isActivityOpen)}
            >
              <Bell className="h-5 w-5" />
              {(summary?.unread ?? 0) > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {summary?.unread}
                </span>
              )}
            </Button>
          </div>
        </div>


        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Compact List */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-3">
                <div className="relative">
                  {/* Clickable Status Header */}
                  <div
                    onClick={() => setShowStatusFilter(!showStatusFilter)}
                    className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity select-none"
                  >
                    <h2 className="text-xl font-bold">
                      {statusOptions.find((s) => s.value === selectedTaskStatus)?.label}
                    </h2>
                    <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${showStatusFilter ? 'rotate-180' : ''}`} />
                  </div>

                  {showStatusFilter && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowStatusFilter(false)}
                      />
                      <div className="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-20 py-1">
                        {statusOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => {
                              setSelectedTaskStatus(option.value);
                              setShowStatusFilter(false);
                            }}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center justify-between ${selectedTaskStatus === option.value ? 'bg-gray-100' : ''
                              }`}
                          >
                            <span className={option.color}>{option.label}</span>
                            {selectedTaskStatus === option.value && (
                              <CheckCircle className="h-4 w-4 text-primary" />
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredTasks.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-2">
                    No {selectedTaskStatus} tasks assigned to you
                  </p>
                  <p className="text-xs text-gray-400">
                    {myAssignedTasks.length > 0
                      ? `You have ${myAssignedTasks.length} total assigned task(s) in other statuses`
                      : 'No tasks are currently assigned to you'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {filteredTasks.map((task) => {
                    const statusConfig = getStatusConfig(task.status as any);
                    return (
                      <div
                        key={task.id}
                        onClick={() => navigate(`/taskboard/${task.status.toLowerCase()}`)}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer border border-gray-100"
                      >
                        {/* Left Section: Task Info */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{task.heading}</div>
                            <div className="text-sm text-muted-foreground truncate">
                              {task.description?.replace(/<[^>]*>/g, ' ')}
                            </div>
                          </div>
                        </div>

                        {/* Right Section: Metadata */}
                        <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                          {/* Project Name */}
                          {task.project_name && (
                            <span className="text-xs text-muted-foreground hidden md:block">
                              {task.project_name}
                            </span>
                          )}

                          {/* Assignees Count */}
                          <div className="flex items-center gap-1 text-xs text-muted-foreground hidden sm:flex">
                            <Users className="h-3 w-3" />
                            <span>{task.assigned_to.length}</span>
                          </div>

                          {/* Due Date */}
                          <div className="flex items-center gap-1 text-xs text-muted-foreground hidden lg:flex">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(task.end_date)}</span>
                          </div>

                          {/* Status Badge */}
                          <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              disabled={updatingTaskId === task.id}
                              onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setDropdownPos({
                                  top: rect.bottom + 4,
                                  left: rect.right - 192
                                });
                                setOpenTaskDropdownId(openTaskDropdownId === task.id ? null : task.id);
                              }}
                              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer border-none focus:ring-2 focus:ring-primary/20 transition-all ${statusConfig.bg} ${statusConfig.text} ${updatingTaskId === task.id ? 'opacity-50' : 'hover:brightness-95'}`}
                            >
                              <span>{statusOptions.find(opt => opt.value === task.status)?.label.toUpperCase()}</span>
                              <ChevronDown className="h-3 w-3 opacity-70" />
                            </button>

                            {openTaskDropdownId === task.id && dropdownPos && (
                              <>
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={() => setOpenTaskDropdownId(null)}
                                />
                                <div
                                  style={{ top: dropdownPos.top, left: dropdownPos.left }}
                                  className="fixed w-48 bg-white rounded-lg shadow-xl border border-gray-100 z-50 py-1 animate-in fade-in zoom-in-95 duration-100"
                                >
                                  {statusOptions.map((opt) => (
                                    <button
                                      key={opt.value}
                                      onClick={(e) => {
                                        handleStatusUpdate(task.id, opt.value, e as any);
                                        setOpenTaskDropdownId(null);
                                      }}
                                      className={`w-full px-4 py-2.5 text-left text-xs font-medium hover:bg-gray-50 transition-colors flex items-center justify-between gap-2 ${task.status === opt.value ? 'bg-gray-50' : ''}`}
                                    >
                                      <span className={opt.color}>{opt.label}</span>
                                      {task.status === opt.value && (
                                        <CheckCircle className="h-3 w-3 text-primary" />
                                      )}
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}

                            {updatingTaskId === task.id && (
                              <div className="absolute inset-0 flex items-center justify-center bg-white/10 rounded-full pointer-events-none">
                                <div className="h-2 w-2 animate-ping bg-current rounded-full" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Documents */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-3">
                <h2 className="text-xl font-bold">Recent Documents</h2>
              </CardTitle>
              <Link to="/documents">
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentDocuments.length === 0 ? (
                <div className="text-center py-10">
                  <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-2">No documents yet</p>
                  <Link to="/projects">
                    {/* <Button variant="outline" size="sm" className="mt-2">
                      Create Document
                    </Button> */}
                  </Link>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {recentDocuments.map((doc: Document) => {
                    const statusColorClass = getStatusColor(doc.status);

                    return (
                      <Link
                        key={doc.id}
                        to={`/documents/${doc.id}`}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer border border-gray-100"
                      >
                        {/* Left Section: Document Info */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{doc.name}</div>
                            <div className="text-sm text-muted-foreground truncate">
                              {doc.project_name || `Project ${doc.project}`}
                            </div>
                          </div>
                        </div>

                        {/* Right Section: Metadata */}
                        <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground hidden lg:flex">
                            <Clock className="h-3 w-3" />
                            <span>{formatRelativeTime(doc.updated_at)}</span>
                          </div>
                          <div
                            className="relative"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                            }}
                          >
                            <button
                              type="button"
                              disabled={updatingDocId === doc.id}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                setDocDropdownPos({
                                  top: rect.bottom + 4,
                                  left: rect.right - 144
                                });
                                setOpenDocDropdownId(openDocDropdownId === doc.id ? null : doc.id);
                              }}
                              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer border-none focus:ring-2 focus:ring-primary/20 transition-all ${statusColorClass} ${updatingDocId === doc.id ? 'opacity-50' : 'hover:brightness-95'}`}
                            >
                              <span>{doc.status.replace('_', ' ').toUpperCase()}</span>
                              <ChevronDown className="h-3 w-3 opacity-70" />
                            </button>

                            {openDocDropdownId === doc.id && docDropdownPos && (
                              <>
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setOpenDocDropdownId(null);
                                  }}
                                />
                                <div
                                  style={{ top: docDropdownPos.top, left: docDropdownPos.left }}
                                  className="fixed w-36 bg-white rounded-lg shadow-xl border border-gray-100 z-50 py-1 animate-in fade-in zoom-in-95 duration-100"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                >
                                  {['draft', 'in_review', 'approved', 'archived'].map((status) => (
                                    <button
                                      key={status}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        handleDocStatusUpdate(doc.id, status, e as any);
                                        setOpenDocDropdownId(null);
                                      }}
                                      className={`w-full px-4 py-2 text-left text-xs font-medium hover:bg-gray-50 transition-colors flex items-center justify-between gap-2 ${doc.status === status ? 'bg-gray-50' : ''}`}
                                    >
                                      <span className={
                                        status === 'approved' ? 'text-green-600' :
                                          status === 'in_review' ? 'text-yellow-600' :
                                            status === 'archived' ? 'text-gray-500' : 'text-gray-600'
                                      }>
                                        {status.replace('_', ' ').toUpperCase()}
                                      </span>
                                      {doc.status === status && (
                                        <CheckCircle className="h-3 w-3 text-primary" />
                                      )}
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}

                            {updatingDocId === doc.id && (
                              <div className="absolute inset-0 flex items-center justify-center bg-white/10 rounded-full pointer-events-none">
                                <div className="h-2 w-2 animate-ping bg-current rounded-full" />
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Projects */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <h2 className="text-xl font-bold">Recent Projects</h2>
            </CardTitle>
            <Link to="/projects">
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentProjects.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {recentProjects.map((project: Project) => (
                  <ProjectGridCard
                    key={project.id}
                    project={project}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FolderKanban className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No projects yet</p>
                <Link to="/projects/new">
                  {/* <Button variant="outline" size="sm" className="mt-2">
                    Create Project
                  </Button> */}
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <h2 className="text-xl font-bold">Quick Actions</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <Link to="/projects/new">
                <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                  <FolderKanban className="h-6 w-6" />
                  <span>New Project</span>
                </Button>
              </Link>
              <Link to="/documents">
                <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                  <FileText className="h-6 w-6" />
                  <span>Browse Documents</span>
                </Button>
              </Link>
              <Link to="/documents?status=in_review">
                <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                  <Clock className="h-6 w-6" />
                  <span>Review Queue</span>
                </Button>
              </Link>
              <Link to="/documents?status=approved">
                <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                  <CheckCircle className="h-6 w-6" />
                  <span>Approved Docs</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}