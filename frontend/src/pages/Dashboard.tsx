import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import React, { useEffect } from 'react';
import { useState } from 'react';
import {
  FolderKanban, FileText, CheckCircle, Clock, ArrowRight, ChevronDown, Calendar, Users, Bell, Settings2, Eye, EyeOff, LayoutGrid
} from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/common';
import { projectsApi, documentsApi, taskApi } from '@/services/api';
import { formatRelativeTime, getStatusColor } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import type { Project, Document } from '@/types';
import { getStatusConfig } from '@/components/layout/DualView/taskConfig';
import { NotificationsPage } from './NotificationsPage';
import { ProjectGridCard } from '@/components/layout/DualView/projectsConfig';
import { useOutletContext } from 'react-router-dom';
import { CreateProjectModal } from '@/pages/Project/CreateProjectModal';
import { useNotifications } from '@/hooks/useNotifications';
import { DocumentPreview } from '@/components/common/DocumentPreview';

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

interface WidgetConfig {
  id: string;
  title: string;
  visible: boolean;
}

const DEFAULT_LAYOUT: WidgetConfig[] = [
  { id: 'tasks', title: 'Tasks Overview', visible: true },
  { id: 'documents', title: 'Recent Documents', visible: true },
  { id: 'projects', title: 'Favourite Projects', visible: true },
  { id: 'actions', title: 'Quick Actions', visible: true },
];

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { unreadCount } = useNotifications();
  const { isActivityOpen, setIsActivityOpen } = useOutletContext<{
    isActivityOpen: boolean;
    setIsActivityOpen: (open: boolean) => void;
  }>();

  // --- Customization State ---
  const [isEditMode, setIsEditMode] = useState(false);
  const [layout, setLayout] = useState<WidgetConfig[]>(() => {
    const saved = localStorage.getItem('dyuksa_dashboard_layout');
    return saved ? JSON.parse(saved) : DEFAULT_LAYOUT;
  });

  // --- Dashboard Logic States ---
  const [selectedTaskStatus, setSelectedTaskStatus] = useState<TaskStatus>('in_progress');
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);
  const [updatingDocId, setUpdatingDocId] = useState<string | null>(null);
  const [openTaskDropdownId, setOpenTaskDropdownId] = useState<number | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const [openDocDropdownId, setOpenDocDropdownId] = useState<string | null>(null);
  const [docDropdownPos, setDocDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; fileName: string; fileType: string } | null>(null);

  // Persist layout changes
  useEffect(() => {
    localStorage.setItem('dyuksa_dashboard_layout', JSON.stringify(layout));
  }, [layout]);

  const toggleWidgetVisibility = (id: string) => {
    setLayout(prev => prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w));
  };

  // --- Data Fetching ---
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
  });

  const { data: documentsData } = useQuery({
    queryKey: ['documents'],
    queryFn: () => documentsApi.list(),
  });

  const { data: tasksResponse } = useQuery({
    queryKey: ['tasks-dashboard'],
    queryFn: () => taskApi.list(),
  });

  // --- Helpers & Handlers ---
  const handleDocumentClick = async (doc: Document) => {
    try {
      const response = await documentsApi.getDownloadUrl(doc.project, { document_id: doc.id });
      setPreviewDoc({
        url: response.url,
        fileName: doc.original_file_name || doc.name,
        fileType: doc.file_type,
      });
    } catch (error) { console.error(error); }
  };

  const handleStatusUpdate = async (taskId: number, newStatus: TaskStatus, e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    setUpdatingTaskId(taskId);
    try {
      await taskApi.update(taskId, { status: newStatus });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-dashboard'] });
    } finally { setUpdatingTaskId(null); }
  };

  const handleDocStatusUpdate = async (docId: string, newStatus: string, e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    setUpdatingDocId(docId);
    try {
      await documentsApi.update(docId, { status: newStatus } as any);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    } finally { setUpdatingDocId(null); }
  };

  const toggleFavorite = async (e: React.MouseEvent, project: any) => {
    e.preventDefault(); e.stopPropagation();
    try {
      await projectsApi.update(project.id, { is_favourite: !project.is_favourite });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (error) { console.error(error); }
  };

  // --- Process Data ---
  const projects = (Array.isArray(projectsData) ? projectsData : projectsData?.results || []) as Project[];
  const documents = (documentsData?.results || []) as Document[];
  const allTasks: Task[] = tasksResponse?.tasks || tasksResponse?.results || (Array.isArray(tasksResponse) ? tasksResponse : []);

  const filteredTasks = allTasks.filter(task =>
    task.status.toLowerCase().replace(/[_\s-]/g, '') === selectedTaskStatus.toLowerCase().replace(/[_\s-]/g, '')
  );

  const recentProjects = projects.filter(p => p.is_favourite).slice(0, 6);
  const recentDocuments = documents.slice(0, 5);

  const statusOptions: Array<{ value: TaskStatus; label: string; color: string }> = [
    { value: 'pending', label: 'Pending', color: 'text-yellow-600' },
    { value: 'backlog', label: 'Backlog', color: 'text-orange-600' },
    { value: 'in_progress', label: 'In Progress', color: 'text-blue-600' },
    { value: 'completed', label: 'Completed', color: 'text-green-600' },
    { value: 'deployed', label: 'Deployed', color: 'text-purple-600' },
    { value: 'deferred', label: 'Deferred', color: 'text-gray-600' },
    { value: 'review', label: 'Review', color: 'text-indigo-600' },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className={`flex-1 overflow-y-auto w-full p-8 space-y-8 transition-all duration-300`}>

        {/* Welcome Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              Welcome back{user?.first_name ? `, ${user.first_name}` : ''}!
            </h1>
            <p className="text-muted-foreground">Here’s a quick overview of your workspace.</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className={!isEditMode ? "bg-black text-white hover:bg-gray-800 hover:text-white" : "bg-primary text-white"}
              onClick={() => setIsEditMode(!isEditMode)}
            >
              <Settings2 className="mr-2 h-4 w-4" />
              {isEditMode ? "Finish Customizing" : "Edit Layout"}
            </Button>

            <Link to="/taskboard/create"><Button>Create Task</Button></Link>
            <Button onClick={() => setIsCreateProjectModalOpen(true)}>New Project</Button>

            <Button className="relative" onClick={() => setIsActivityOpen(!isActivityOpen)}>
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Customization Toolbar */}
        {isEditMode && (
          <div className="p-4 bg-muted/50 border border-dashed border-primary/50 rounded-xl flex flex-wrap gap-3 items-center animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary mr-4">
              <LayoutGrid size={18} />
              Customize Visibility:
            </div>
            {layout.map(w => (
              <Button
                key={w.id}
                variant={w.visible ? "default" : "outline"}
                size="sm"
                className="rounded-full"
                onClick={() => toggleWidgetVisibility(w.id)}
              >
                {w.visible ? <Eye size={14} className="mr-2" /> : <EyeOff size={14} className="mr-2" />}
                {w.title}
              </Button>
            ))}
          </div>
        )}

        {/* Main Content Grid - Responsive & Dynamic */}
        <div className="grid gap-6">

          {/* Top Row: Tasks & Documents */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* TASKS WIDGET */}
            {layout.find(w => w.id === 'tasks')?.visible && (
              <Card className={isEditMode ? "ring-2 ring-primary/20" : ""}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="relative">
                    <div onClick={() => setShowStatusFilter(!showStatusFilter)} className="flex items-center gap-2 cursor-pointer hover:opacity-70 select-none">
                      <h2 className="text-xl font-bold">{statusOptions.find((s) => s.value === selectedTaskStatus)?.label}</h2>
                      <ChevronDown className={`h-5 w-5 transition-transform ${showStatusFilter ? 'rotate-180' : ''}`} />
                    </div>
                    {showStatusFilter && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowStatusFilter(false)} />
                        <div className="absolute left-0 mt-2 w-48 bg-popover rounded-lg shadow-lg border border-border z-20 py-1">
                          {statusOptions.map((option) => (
                            <button key={option.value} onClick={() => { setSelectedTaskStatus(option.value); setShowStatusFilter(false); }} className={`w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center justify-between ${selectedTaskStatus === option.value ? 'bg-accent' : ''}`}>
                              <span className={option.color}>{option.label}</span>
                              {selectedTaskStatus === option.value && <CheckCircle className="h-4 w-4 text-primary" />}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {filteredTasks.length === 0 ? (
                    <div className="text-center py-12">
                      <Clock className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No {selectedTaskStatus} tasks assigned to you</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                      {filteredTasks.map((task) => {
                        const config = getStatusConfig(task.status as any);
                        return (
                          <div key={task.id} onClick={() => navigate(`/taskboard/${task.status.toLowerCase()}`)} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted cursor-pointer border border-border transition-all">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{task.heading}</div>
                              <div className="text-sm text-muted-foreground truncate">{task.description?.replace(/<[^>]*>/g, ' ')}</div>
                            </div>
                            <div className="flex items-center gap-3 ml-4 flex-shrink-0 text-xs text-muted-foreground">
                              <span className="hidden md:block">{task.project_name}</span>
                              <div className="relative" onClick={e => e.stopPropagation()}>
                                <Button size="sm" variant="ghost" onClick={e => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setDropdownPos({ top: rect.bottom + 4, left: rect.right - 192 });
                                  setOpenTaskDropdownId(openTaskDropdownId === task.id ? null : task.id);
                                }} className={`rounded-full h-7 ${config.bg} ${config.text}`}>
                                  {task.status.toUpperCase()}
                                </Button>
                                {openTaskDropdownId === task.id && dropdownPos && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setOpenTaskDropdownId(null)} />
                                    <div style={{ top: dropdownPos.top, left: dropdownPos.left }} className="fixed w-48 bg-popover rounded-lg shadow-xl border z-50 py-1">
                                      {statusOptions.map(opt => (
                                        <button key={opt.value} onClick={e => { handleStatusUpdate(task.id, opt.value, e as any); setOpenTaskDropdownId(null); }} className="w-full px-4 py-2 text-left text-xs hover:bg-accent flex justify-between items-center">
                                          <span className={opt.color}>{opt.label}</span>
                                          {task.status === opt.value && <CheckCircle size={12} />}
                                        </button>
                                      ))}
                                    </div>
                                  </>
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
            )}

            {/* DOCUMENTS WIDGET */}
            {layout.find(w => w.id === 'documents')?.visible && (
              <Card className={isEditMode ? "ring-2 ring-primary/20" : ""}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-xl font-bold">Recent Documents</CardTitle>
                  <Link to="/documents"><Button variant="ghost" size="sm">View All <ArrowRight className="h-4 w-4 ml-1" /></Button></Link>
                </CardHeader>
                <CardContent>
                  {recentDocuments.length === 0 ? (
                    <div className="text-center py-10"><FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground">No documents yet</p></div>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                      {recentDocuments.map((doc: Document) => {
                        const statusColor = getStatusColor(doc.status);
                        return (
                          <div key={doc.id} onClick={() => handleDocumentClick(doc)} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted cursor-pointer border border-border">
                            <div className="font-medium truncate flex-1">{doc.name}</div>
                            <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                              <span className="text-[10px] text-muted-foreground hidden lg:block">{formatRelativeTime(doc.updated_at)}</span>
                              <div className="relative" onClick={e => e.stopPropagation()}>
                                <Button size="sm" variant="ghost" onClick={e => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setDocDropdownPos({ top: rect.bottom + 4, left: rect.right - 144 });
                                  setOpenDocDropdownId(openDocDropdownId === doc.id ? null : doc.id);
                                }} className={`rounded-full h-7 ${statusColor}`}>
                                  {doc.status.toUpperCase()}
                                </Button>
                                {openDocDropdownId === doc.id && docDropdownPos && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setOpenDocDropdownId(null)} />
                                    <div style={{ top: docDropdownPos.top, left: docDropdownPos.left }} className="fixed w-36 bg-popover rounded-lg shadow-xl border z-50 py-1">
                                      {['draft', 'in_review', 'approved', 'archived'].map(s => (
                                        <button key={s} onClick={e => { handleDocStatusUpdate(doc.id, s, e as any); setOpenDocDropdownId(null); }} className="w-full px-4 py-2 text-left text-xs hover:bg-accent flex justify-between">
                                          <span>{s.toUpperCase()}</span>
                                          {doc.status === s && <CheckCircle size={12} />}
                                        </button>
                                      ))}
                                    </div>
                                  </>
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
            )}
          </div>

          {/* FAVOURITE PROJECTS WIDGET */}
          {layout.find(w => w.id === 'projects')?.visible && (
            <Card className={isEditMode ? "ring-2 ring-primary/20" : ""}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-xl font-bold">Favourite Projects</CardTitle>
                <Link to="/projects"><Button variant="ghost" size="sm">View All <ArrowRight className="h-4 w-4 ml-1" /></Button></Link>
              </CardHeader>
              <CardContent>
                {recentProjects.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {recentProjects.map((p) => <ProjectGridCard key={p.id} project={p} onToggleFavorite={toggleFavorite} />)}
                  </div>
                ) : (
                  <div className="text-center py-8"><FolderKanban className="h-10 w-10 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">No projects yet</p></div>
                )}
              </CardContent>
            </Card>
          )}

          {/* QUICK ACTIONS WIDGET */}
          {layout.find(w => w.id === 'actions')?.visible && (
            <Card className={isEditMode ? "ring-2 ring-primary/20" : ""}>
              <CardHeader><CardTitle className="text-xl font-bold">Quick Actions</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => setIsCreateProjectModalOpen(true)}>
                    <FolderKanban className="h-6 w-6 text-blue-500" /><span>New Project</span>
                  </Button>
                  <Link to="/documents"><Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2"><FileText className="h-6 w-6 text-orange-500" /><span>Documents</span></Button></Link>
                  <Link to="/documents?status=in_review"><Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2"><Clock className="h-6 w-6 text-yellow-500" /><span>Review Doc</span></Button></Link>
                  <Link to="/documents?status=approved"><Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2"><CheckCircle className="h-6 w-6 text-green-500" /><span>Approved Doc</span></Button></Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Modals & Overlays */}
      {isActivityOpen && <NotificationsPage onClose={() => setIsActivityOpen(false)} defaultFilter="unread" />}
      <CreateProjectModal isOpen={isCreateProjectModalOpen} onClose={() => setIsCreateProjectModalOpen(false)} navigateOnSuccess={true} />
      {previewDoc && <DocumentPreview url={previewDoc.url} fileName={previewDoc.fileName} fileType={previewDoc.fileType} onClose={() => setPreviewDoc(null)} />}
    </div>
  );
}