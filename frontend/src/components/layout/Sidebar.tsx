import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, FolderKanban, FileText, TestTube2, Settings, LogOut,
  Users, ChevronDown, ChevronUp, Plus, CheckSquare, CheckCircle,
  Clock, PlayCircle, Pause, Crown, TrendingUp, ListTodo, Calendar, Bell, Eye, MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { projectsApi } from '@/services/api';
import type { Project } from '@/types';
import { getProjectTypeColor } from '@/lib/utils';
import { notificationsApi } from '@/services/api';

const ADMIN_ROLES = ['admin', 'manager', 'annotator'];

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
            cn('flex items-center gap-3 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors group relative pr-8', // Added group, relative, and padding-right
              isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground')
          }
        >
          <div className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] text-white font-bold uppercase", getProjectTypeColor(project.task_type))}>
            {project.name.charAt(0)}
          </div>
          <span className="truncate">{project.name}</span>

          {/* Create Task Shortcut Icon */}
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

export function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Collapsible Logic
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const isExpanded = !isCollapsed || isHovered;

  // Accordion States 
  const [isProjectsOpen, setIsProjectsOpen] = useState(location.pathname.startsWith('/projects'));
  const [isTasksOpen, setIsTasksOpen] = useState(location.pathname.startsWith('/taskboard'));
  const [isAdminOpen, setIsAdminOpen] = useState(location.pathname.startsWith('/admin'));

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
  });

  // Fetching notification
  const { data: notifySummary } = useQuery({
    queryKey: ['notifications-summary'],
    queryFn: () => notificationsApi.getSummary(),
    refetchInterval: 30000,
  });

  const projects = useMemo(() => {
    if (!projectsData) return [];
    if (Array.isArray(projectsData)) return projectsData;
    if ('results' in projectsData && Array.isArray(projectsData.results)) return projectsData.results;
    return [];
  }, [projectsData]) as Project[];

  const showAdmin = user?.role && ADMIN_ROLES.includes(user.role);

  return (
    <div
      className={cn(
        "relative flex h-full flex-col border-r bg-card transition-all duration-300 ease-in-out z-50",
        isExpanded ? "w-64" : "w-20"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* "Z" Toggle Button */}
      <div className="flex h-16 items-center px-4 border-b">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-all",
            !isCollapsed
              ? "bg-indigo-300 text-white"
              : "bg-primary text-primary-foreground hover:opacity-90"
          )}
        >
          <span className="text-xl font-bold">Z</span>
        </button>
        {isExpanded && (
          <span className="ml-3 text-xl font-bold text-primary animate-in fade-in duration-300">
            ZanFlow
          </span>
        )}
      </div>

      <nav className="flex-1 space-y-2 px-3 py-4 overflow-y-auto overflow-x-hidden">
        {/* Dashboard */}
        <NavLink
          to="/"
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
              setIsProjectsOpen(prev => !prev);
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
                  setIsProjectsOpen(!isProjectsOpen);
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
              setIsTasksOpen(prev => !prev);
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
                  setIsTasksOpen(!isTasksOpen);
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
          { name: 'Documents', href: '/documents', icon: FileText },
          { name: 'Calendar', href: '/calendar', icon: Calendar },
          // { name: 'Test Runs', href: '/test-runs', icon: TestTube2 },
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
              {item.name === 'Activity' && (notifySummary?.unread ?? 0) > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#ee6b6e] text-[10px] font-bold text-white">
                  {notifySummary?.unread}
                </span>
              )}
            </div>
            {isExpanded && <span>{item.name}</span>}
          </NavLink>
        ))}

        {/* Team Management Accordion */}
        {showAdmin && (
          <div className="space-y-1">
            <div
              onClick={() => setIsAdminOpen(!isAdminOpen)}
              className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm. font-medium cursor-pointer transition-colors',
                location.pathname.startsWith('/admin') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent',
                !isExpanded && "justify-center px-0")}
            >
              <Crown className="h-5 w-5 shrink-0" />
              {isExpanded && (
                <>
                  <span className="flex-1">Team Management</span>
                  {isAdminOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </>
              )}
            </div>
            {isExpanded && isAdminOpen && (
              <div className="ml-4 border-l pl-2 space-y-1 animate-in slide-in-from-left-2">
                <NavLink to="/admin/user-roles" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-primary">
                  <Users className="h-3.5 w-3.5" /> Roles
                </NavLink>
                <NavLink to="/admin/team-performance" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-primary">
                  <TrendingUp className="h-3.5 w-3.5" /> Performance
                </NavLink>
              </div>
            )}
          </div>
        )}
        {/* Team Chat */}
        <NavLink
          to="/team-chat"
          className={({ isActive }) =>
            cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              !isExpanded && "justify-center px-0")
          }
        >
          <MessageSquare className="h-5 w-5 shrink-0" />
          {isExpanded && <span>Team Chat</span>}
        </NavLink>
      </nav>

      {/* Profile & Footer */}
      <div className="border-t p-4">
        <div className={cn("flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-accent cursor-pointer", !isExpanded && "justify-center px-0")} onClick={() => navigate('/profile')}>
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-primary-foreground font-bold",
            !isCollapsed
              ? "bg-indigo-300 text-white"
              : "bg-primary text-primary-foreground hover:opacity-90")}>
            {user?.username?.charAt(0).toUpperCase()}
          </div>
          {isExpanded && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.first_name} {user?.last_name}</p>
              <p className="truncate text-xs text-muted-foreground capitalize">{user?.role}</p>
            </div>
          )}
        </div>

        {isExpanded && (
          <div className="mt-4 flex gap-2 animate-in fade-in slide-in-from-bottom-2">
            <button onClick={() => navigate('/settings')} className="flex flex-1 items-center justify-center gap-2 rounded-lg border p-2 text-muted-foreground hover:bg-accent">
              <Settings className="h-4 w-4" /> Settings
            </button>
            <button onClick={logout} className="flex flex-1 items-center justify-center gap-2 rounded-lg border p-2 text-muted-foreground hover:bg-accent text-destructive">
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}