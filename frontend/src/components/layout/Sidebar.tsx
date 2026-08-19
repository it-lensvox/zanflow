import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, FolderKanban, FileText, Settings, LogOut, Users, ChevronDown, ChevronUp, Plus, CheckSquare, CheckCircle, Clock, PlayCircle, Pause,
  TrendingUp, ListTodo, Calendar, Eye, MessageSquare, UserPlus, NotebookPen, Building2, Briefcase,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { getRoleConfig } from '@/config/roleConfig';
import { projectsApi, teamsApi, chatApi, workspaceApi } from '@/services/api';
import type { ChatRoomListItem } from '@/types';
import type { Project } from '@/types';
import { getProjectTypeColor } from '@/lib/utils';
import { useNotifications } from '@/hooks/useNotifications';
import { CreateWorkspaceModal } from '@/components/Modals/CreateWorkspaceModal';
import { WorkspaceSwitcher } from '@/components/Modals/WorkspaceSwitcher';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/common/diaog';

const ADMIN_ROLES = ['pm_admin', 'workspace_admin'];
interface _Workspace {
  id: number;
  name: string;
  slug: string;
  description?: string;
  is_default: boolean;
  is_active: boolean;
  member_count: number;
  role: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
}

// Favourite Projects within the accordion
const FavouriteProjectsAccordion = ({ projects }: { projects: Project[] }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const favProjects = useMemo(() => {
    return projects.filter(p =>
      p.is_favourite && p.members?.some(member => member.user.id === user?.id)
    );
  }, [projects, user?.id]);

  if (favProjects.length === 0) return null;

  return (
    <div className="ml-4 mt-1 space-y-1 border-l pl-2 animate-in slide-in-from-left-2">
      {favProjects.map((project) => (
        <NavLink
          key={project.id}
          to={`/projects/${project.id}`}
          className={({ isActive }) =>
            cn('flex items-center gap-3 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors group relative pr-8',
              isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground')
          }
        >
          <div className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] text-white font-bold uppercase", getProjectTypeColor(project.task_type))}>
            {project.name.charAt(0)}
          </div>
          <span className="truncate">{project.name}</span>

          <div
            role="button"
            className="absolute right-2 p-0.5 rounded-md hover:bg-background/50 hover:text-primary text-muted-foreground opacity-0 group-hover:opacity-100 transition-all"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigate('/taskboard/create', { state: { projectId: project.id } });
            }}
            title="Create Task"
          >
            <Plus className="h-3.5 w-3.5" />
          </div>
        </NavLink>
      ))}
    </div>
  );
};

export function Sidebar({ onMobileClose }: { onMobileClose?: () => void }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { chatUnreadCount } = useNotifications();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showCreateWorkspaceModal, setShowCreateWorkspaceModal] = useState(false);

  // Collapsible Logic
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const isExpanded = !isCollapsed || isHovered;

  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogoClick = useCallback(() => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      setIsCollapsed(prev => !prev);
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        navigate('/dashboard');
      }, 250);
    }
  }, [navigate]);

  // Accordion States
  const getInitialAccordion = () => {
    if (location.pathname.startsWith('/team-chat')) return 'chats';
    if (location.pathname.startsWith('/admin')) return 'admin';
    if (location.pathname.startsWith('/taskboard')) return 'tasks';
    if (location.pathname.startsWith('/projects')) return 'projects';
    return null;
  };
  const [activeAccordion, setActiveAccordion] = useState<string | null>(getInitialAccordion);
  const toggleAccordion = (name: string) =>
    setActiveAccordion(prev => (prev === name ? null : name));

  const isProjectsOpen = activeAccordion === 'projects';
  useEffect(() => {
    if (!location.pathname.startsWith('/projects')) {
      if (isProjectsOpen) toggleAccordion('projects');
    }
  }, [location.pathname]);
  const isTasksOpen = activeAccordion === 'tasks';

  useEffect(() => {
    if (!location.pathname.startsWith('/taskboard')) {
      if (isTasksOpen) toggleAccordion('tasks');
    }
  }, [location.pathname]);
  const isAdminOpen = activeAccordion === 'admin';

  const [isTeamsOpen, setIsTeamsOpen] = useState(location.pathname.startsWith('/admin/teams'));

  // Fetch workspaces
  useQuery({
    queryKey: ['workspaces'],
    queryFn: workspaceApi.getWorkspaces,
  });
  //  const _activeWorkspace = useMemo(() => {
  //   if (!workspacesData?.workspaces) return undefined;

  //   // Try 1: Find by active_workspace_id from response
  //   let workspace = workspacesData.workspaces.find(
  //     (w: Workspace) => w.id === workspacesData.active_workspace_id
  //   );

  //   // Try 2: Find by localStorage ID
  //   if (!workspace && storedWorkspaceId) {
  //     workspace = workspacesData.workspaces.find(
  //       (w: Workspace) => w.id === storedWorkspaceId
  //     );
  //   }

  //   // Try 3: Find default workspace
  //   if (!workspace) {
  //     workspace = workspacesData.workspaces.find((w: Workspace) => w.is_default);
  //   }

  //   // Try 4: Use first workspace
  //   if (!workspace) {
  //     workspace = workspacesData.workspaces[0];
  //   }

  //   // Update localStorage
  //   if (workspace && workspace.id !== storedWorkspaceId) {
  //     localStorage.setItem('active_workspace_id', String(workspace.id));
  //   }

  //   return workspace;
  // }, [workspacesData, storedWorkspaceId]);
  useQuery<ChatRoomListItem[]>({
    queryKey: ['sidebar-all-chat-rooms'],
    queryFn: () => chatApi.getAllRooms(),
    staleTime: 0,
    refetchOnMount: true,
    enabled: isExpanded,
  });

  // const _sidebarPrivateRooms = useMemo<ChatRoomListItem[]>(() =>
  //   (allRoomsData || []).filter(r => r.room_type === 'private'),
  //   [allRoomsData]
  // );
  // const _sidebarProjectRooms = useMemo<ChatRoomListItem[]>(() =>
  //   (allRoomsData || []).filter(r => r.room_type === 'project'),
  //   [allRoomsData]
  // );
  // const _sidebarTeamRooms = useMemo<ChatRoomListItem[]>(() =>
  //   (allRoomsData || []).filter(r => r.room_type === 'team'),
  //   [allRoomsData]
  // );
  // const _sidebarUnreadRooms = useMemo<ChatRoomListItem[]>(() =>
  //   (allRoomsData || []).filter(r => r.unread_count > 0 && r.room_type !== 'thread'),
  //   [allRoomsData]
  // );

  const { pmRole } = useAuth();
  const showAdmin = !!pmRole && ADMIN_ROLES.includes(pmRole);
  const isSuperuser = !!user?.is_superuser;

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
  });

  const { data: teamsData } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.list(),
  });

  const projects = useMemo(() => {
    if (!projectsData) return [];
    if (Array.isArray(projectsData)) return projectsData;
    if ('results' in projectsData && Array.isArray(projectsData.results)) return projectsData.results;
    return [];
  }, [projectsData]) as Project[];

  const teams = useMemo(() => {
    if (!teamsData) return [];
    if (Array.isArray(teamsData)) return teamsData;
    if ('results' in teamsData && Array.isArray(teamsData.results)) return teamsData.results;
    return [];
  }, [teamsData]);

  // Close mobile sidebar on navigation
  useEffect(() => {
    if (onMobileClose) onMobileClose();
  }, [location.pathname]);

  return (
    <div
      className={cn(
        "relative flex h-full flex-col border-r bg-card transition-all duration-300 ease-in-out z-50",
        "h-screen",
        isExpanded ? "w-64" : "w-20"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Logo */}
      <div className="flex h-16 items-center px-4 border-b">
        <button
          onClick={handleLogoClick}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-all",
            !isCollapsed
              ? "bg-indigo-300 text-white"
              : "bg-primary text-primary-foreground hover:opacity-90"
          )}
        >
          <span className="text-xl font-bold">D</span>
        </button>
        {isExpanded && (
          <span
            className="ml-3 text-xl font-bold text-primary animate-in fade-in duration-300 cursor-pointer select-none"
            onClick={handleLogoClick}
          >
            DYUKSA

            {isExpanded && (
              <div className="border-b px-0 py-0">
                <WorkspaceSwitcher onCreateWorkspace={() => setShowCreateWorkspaceModal(true)} />
              </div>
            )}
          </span>

        )}
      </div>



      <nav className="flex-1 space-y-2 px-3 py-4 overflow-y-auto overflow-x-hidden">
        {/* Dashboard */}
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              !isExpanded && "justify-center px-0")
          }
        >
          <LayoutDashboard className="h-5 w-5 shrink-0" />
          {isExpanded && <span>Dashboard</span>}
        </NavLink>

        {/* Projects Accordion */}
        <div className="space-y-1">
          <div
            className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
              location.pathname.startsWith('/projects') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent',
              !isExpanded && "justify-center px-0")}
            onClick={() => {
              navigate('/projects');
              toggleAccordion('projects');
            }}
          >
            <div className={cn("flex items-center gap-3", isExpanded && "flex-1")}>
              <FolderKanban className="h-5 w-5 shrink-0" />
              {isExpanded && <span className="flex-1">Projects</span>}
            </div>

            {isExpanded && (
              <div
                className="cursor-pointer p-0.5 hover:bg-primary/20 rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleAccordion('projects');
                }}
              >
                {isProjectsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            )}
          </div>
          {isExpanded && isProjectsOpen && <FavouriteProjectsAccordion projects={projects} />}
        </div>

        {/* Tasks Accordion */}
        <div className="space-y-1">
          <div
            className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
              location.pathname.startsWith('/taskboard') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent',
              !isExpanded && "justify-center px-0")}
            onClick={() => {
              navigate('/taskboard');
              toggleAccordion('tasks');
            }}
          >
            <div className={cn("flex items-center gap-3", isExpanded && "flex-1")}>
              <CheckSquare className="h-5 w-5 shrink-0" />
              {isExpanded && <span className="flex-1">My Tasks</span>}
            </div>
            {isExpanded && (
              <div
                className="cursor-pointer p-0.5 hover:bg-primary/20 rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleAccordion('tasks');
                }}
              >
                {isTasksOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            )}
          </div>
          {isExpanded && isTasksOpen && (
            <div className="ml-4 border-l pl-2 space-y-1 animate-in slide-in-from-left-2">
              {[
                { id: 'CREATE', name: 'Create Task', href: '/taskboard/create', icon: Plus },
                { id: 'ALL', name: 'All Tasks', href: '/taskboard', icon: CheckSquare },
                { id: 'COMPLETED', name: 'Completed Tasks', href: '/taskboard/completed', icon: CheckCircle },
                { id: 'PENDING', name: 'Pending Tasks', href: '/taskboard/pending', icon: Clock },
                { id: 'BACKLOG', name: 'Backlog Tasks', href: '/taskboard/backlog', icon: ListTodo },
                { id: 'IN_PROGRESS', name: 'In Progress Tasks', href: '/taskboard/in_progress', icon: PlayCircle },
                { id: 'DEPLOYED', name: 'Deployed Tasks', href: '/taskboard/deployed', icon: CheckSquare },
                { id: 'DEFERRED', name: 'Deferred Tasks', href: '/taskboard/deferred', icon: Pause },
                { id: 'REVIEW', name: 'Review Tasks', href: '/taskboard/review', icon: Eye },
              ].map((sub) => (
                <NavLink
                  key={sub.name}
                  to={sub.href}
                  end={sub.href === '/taskboard'}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-primary"
                    )
                  }
                >
                  <sub.icon className="h-3.5 w-3.5" /> {sub.name}
                </NavLink>
              ))}
            </div>
          )}
        </div>

        {/* Simple Nav Links */}
        {[
          { name: 'My Work', href: '/my-work', icon: Briefcase },
          { name: 'Documents', href: '/documents', icon: FileText },
          { name: 'Calendar', href: '/calendar', icon: Calendar },
          { name: 'Team Chat', href: '/team-chat', icon: MessageSquare, badge: chatUnreadCount },
          { name: 'Quick Notes', href: '/quick-notes', icon: NotebookPen },
        ].map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
                !isExpanded && "justify-center px-0")
            }
          >
            <div className="relative">
              <item.icon className="h-5 w-5 shrink-0" />
              {/* ✅ ONLY SHOW BADGE WHEN COUNT > 0 */}
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </div>
            {isExpanded && <span>{item.name}</span>}
          </NavLink>
        ))}

        {/* Team Management Accordion */}
        {(showAdmin || isSuperuser) && (
          <div className="space-y-1">
            <div
              className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
                location.pathname.startsWith('/admin') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent',
                !isExpanded && "justify-center px-0")}
              onClick={() => toggleAccordion('admin')}
            >
              <Users className="h-5 w-5 shrink-0" />
              {isExpanded && (
                <>
                  <span className="flex-1">Team Management</span>
                  {isAdminOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </>
              )}
            </div>

            {isExpanded && isAdminOpen && (
              <div className="ml-4 border-l pl-2 space-y-1 animate-in slide-in-from-left-2">
                {/* Teams Sub-Accordion */}
                <div className="space-y-1">
                  <div
                    className={cn("flex items-center justify-between rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer hover:bg-accent",
                      location.pathname === '/admin/teams' ? "text-primary" : "text-muted-foreground")}
                    onClick={() => navigate('/admin/teams')}
                  >
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5" /> Teams
                    </div>
                    <div onClick={(e) => { e.stopPropagation(); setIsTeamsOpen(!isTeamsOpen); }}>
                      {isTeamsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </div>
                  </div>

                  {isTeamsOpen && teams.filter((t: any) => t.is_favourite).map((team: any) => (
                    <div
                      key={team.id}
                      className="ml-6 flex items-center gap-2 rounded-lg px-3 py-1 text-[11px] text-muted-foreground hover:text-primary cursor-pointer"
                      onClick={() => navigate('/admin/teams')}
                    >
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: team.color || '#6366f1' }} />
                      <span className="truncate">{team.name}</span>
                    </div>
                  ))}
                </div>

                <NavLink
                  to="/admin/user-roles"
                  className={({ isActive }) => cn("flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-colors",
                    isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-primary")}
                >
                  <UserPlus className="h-3.5 w-3.5" /> Roles
                </NavLink>

                <NavLink
                  to="/admin/team-performance"
                  className={({ isActive }) => cn("flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-colors",
                    isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-primary")}
                >
                  <TrendingUp className="h-3.5 w-3.5" /> Performance
                </NavLink>

                {isSuperuser && (
                  <NavLink
                    to="/admin/workspace"
                    className={({ isActive }) => cn("flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-colors",
                      isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-primary")}
                  >
                    <Building2 className="h-3.5 w-3.5" /> Organizations
                  </NavLink>
                )}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Profile & Footer */}
      <div className="border-t p-4">
        <div className={cn("flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-accent cursor-pointer", !isExpanded && "justify-center px-0")} onClick={() => navigate('/profile')}>
          <div className="relative shrink-0 h-9 w-9">
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-full text-primary-foreground font-bold overflow-hidden",
              !isCollapsed
                ? "bg-indigo-300 text-white"
                : "bg-primary text-primary-foreground hover:opacity-90")}>
              {(user as any)?.avatar ? (
                <img
                  src={(user as any).avatar}
                  alt="Profile"
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                user?.username?.charAt(0).toUpperCase()
              )}
            </div>
            {user?.is_active && (
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-card" />
            )}
          </div>
          {isExpanded && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.first_name} {user?.last_name}</p>
              <p className="truncate text-xs text-muted-foreground capitalize">{getRoleConfig(pmRole ?? user?.role).label}</p>
            </div>
          )}
        </div>
        {isExpanded && (
          <div className="mt-4 space-y-2 animate-in fade-in slide-in-from-bottom-2">

            <div className="flex gap-2">
              <button
                onClick={() => navigate('/settings')}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border p-2 text-muted-foreground hover:bg-accent"
              >
                <Settings className="h-4 w-4" /> Settings
              </button>
              <button
                onClick={() => setShowLogoutDialog(true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border p-2 text-muted-foreground hover:bg-accent text-destructive"
              >
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Logout Dialog */}
      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 mx-auto mb-2">
              <LogOut className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-center text-lg">Log Out?</DialogTitle>
            <DialogDescription className="text-center text-sm text-muted-foreground">
              Are you sure you want to log out? You'll need to sign in again to access your workspace.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row gap-2 sm:flex-row mt-2">
            <button
              onClick={() => setShowLogoutDialog(false)}
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { setShowLogoutDialog(false); logout(); }}
              className="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive/90 transition-colors"
            >
              Yes, Log Out
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✅ Create Workspace Modal */}
      <CreateWorkspaceModal
        isOpen={showCreateWorkspaceModal}
        onClose={() => setShowCreateWorkspaceModal(false)}
      />
    </div>
  );
}