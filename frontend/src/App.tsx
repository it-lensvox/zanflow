import { useEffect, lazy, Suspense, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout';
import type { User as AppUser } from '@/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { projectsApi, notificationSocket, gatewaySocket } from '@/services/api';
import { TaskDraftsProvider } from '@/pages/MyTask/components/Taskdrafts';
import { MyWork } from '@/pages/MyWork/MyWork';

// Lazy-loaded page components for route-level code splitting
const Dashboard = lazy(() => import('@/pages/Dashboard/Dashboard').then(m => ({ default: m.Dashboard })));
const Login = lazy(() => import('@/pages/Login').then(m => ({ default: m.Login })));
const Projects = lazy(() => import('@/pages/Project/Projects').then(m => ({ default: m.Projects })));
const ProjectSettings = lazy(() => import('@/pages/Project/ProjectSettings').then(m => ({ default: m.ProjectSettings })));
const DocumentCreate = lazy(() => import('@/pages/Documents/DocumentCreate').then(m => ({ default: m.DocumentCreate })));
const Documents = lazy(() => import('@/pages/Documents/Documents').then(m => ({ default: m.Documents })));
const SharedWithMe = lazy(() => import('@/pages/Documents/SharedWithMe').then(m => ({ default: m.SharedWithMe }))); const MyTask = lazy(() => import('@/pages/MyTask/MyTask').then(m => ({ default: m.MyTask })));
const CreateTask = lazy(() => import('@/pages/MyTask/pages/CreateTask/CreateTask').then(m => ({ default: m.CreateTask })));
const TaskDetailPage = lazy(() => import('@/pages/MyTask/TaskDetail/TaskDetailPage').then(m => ({ default: m.TaskDetailPage })));
const Teams = lazy(() => import('@/pages/TeamManagement/Teams').then(m => ({ default: m.Teams })));
const UserManagement = lazy(() => import('@/pages/TeamManagement/UserManagement').then(m => ({ default: m.UserManagement })));
const TeamPerformance = lazy(() => import('@/pages/TeamManagement/TeamPerformance').then(m => ({ default: m.TeamPerformance })));
const TaskDetails = lazy(() => import('@/pages/TaskType/TaskDetails').then(m => ({ default: m.TaskDetails })));
const Calendar = lazy(() => import('@/pages/Calendar/Calendar').then(m => ({ default: m.Calendar })));
const SharedCalendarView = lazy(() => import('@/pages/Calendar/SharedCalendarView').then(m => ({ default: m.SharedCalendarView })));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const Profile = lazy(() => import('@/pages/Profile').then(m => ({ default: m.Profile })));
const ResetPassword = lazy(() => import('@/pages/ResetPassword').then(m => ({ default: m.ResetPassword })));
const TeamChatModern = lazy(() => import('@/pages/TeamsChat/TeamChatModern').then(m => ({ default: m.TeamChatModern })));
const Settings = lazy(() => import('@/pages/Settings').then(m => ({ default: m.Settings })));
const SetupAccount = lazy(() => import('@/pages/TeamManagement/SetupAccount').then(m => ({ default: m.SetupAccount })));
const WorkSpace = lazy(() => import('@/pages/TeamManagement/Workspace/Workspace').then(m => ({ default: m.WorkSpace })));
const QuickNotesPage = lazy(() => import('@/pages/QuickNotes/QuickNotesPage').then(m => ({ default: m.QuickNotesPage })));
const LandingPage = lazy(() => import('@/pages/LandingPage/LandingPage').then(m => ({ default: m.LandingPage })));
const Signup = lazy(() => import('@/pages/SignUp/SignUp').then(m => ({ default: m.Signup })));

/** Shown when the user's JWT does not include "pm" in platforms */
function NoAccessPage() {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center bg-muted/30">
      <div style={{ fontSize: 48 }}>🔒</div>
      <h1 className="text-2xl font-bold">No PM Access</h1>
      <p className="text-muted-foreground max-w-sm">
        Your account does not have access to the Project Management platform.
        Please contact your administrator to request access.
      </p>
      <div className="flex gap-3">
        <button
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
          onClick={() => { window.location.href = 'mailto:support@dyuksa.com?subject=PM Access Request'; }}
        >
          Request Access
        </button>
        <button
          className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-accent"
          onClick={logout}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

// ── Error Boundary
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
          <h2 className="text-xl font-semibold text-foreground">Something went wrong</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            An unexpected error occurred while loading this page. Please try reloading.
          </p>
          <button
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAllowed, isLoading, isAuthenticated } = useAuth();
  const ALLOWED_ROLES: AppUser['role'][] = ['admin', 'manager', 'annotator', 'developer'];
  const isAuthorized = isAllowed(ALLOWED_ROLES);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthorized) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function ProjectDetailWrapper() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(Number(id)),
    enabled: !!id,
    staleTime: 0,
    placeholderData: () => {
      const cache = queryClient.getQueryData(['projects']) as any || queryClient.getQueryData(['projects', '']) as any;
      const list = Array.isArray(cache) ? cache : (cache?.results || []);
      return list.find((p: any) => p.id === Number(id));
    },
  });

  // ✅ Show spinner while loading — never show blank page
  if (isLoading && !project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!project) return null;

  // ✅ All project types use TaskDetails — including demo and any future types
  return <TaskDetails />;
}

// Helper component to render the Admin UI for nested routes
const AdminDashboard = () => (
  <AdminRoute>
    <Outlet />
  </AdminRoute>
);



function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Root: unauthenticated → landing, authenticated → dashboard */}
      <Route
        path="/"
        element={
          isAuthenticated
            ? <Navigate to="/dashboard" replace />
            : <Suspense fallback={<PageLoader />}><LandingPage /></Suspense>
        }
      />

      <Route path="/login" element={<Suspense fallback={<PageLoader />}><Login /></Suspense>} />
      <Route path="/no-access" element={<NoAccessPage />} />
      <Route path="/welcome" element={<Suspense fallback={<PageLoader />}><LandingPage /></Suspense>} />
      <Route path="/signup" element={<Suspense fallback={<PageLoader />}><Signup /></Suspense>} />


      {/* Public — no auth required — invited user has no account yet */}
      <Route
        path="/setup-account"
        element={<Suspense fallback={<PageLoader />}><SetupAccount /></Suspense>}
      />
      {/* Public Calendar View - no auth required */}
      <Route
        path="/calendar/shared/:token"
        element={<Suspense fallback={<PageLoader />}><SharedCalendarView /></Suspense>}
      />
      {/* Routes WITH Sidebar */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
        <Route path="/my-work" element={<MyWork />} />
        <Route path="/profile" element={<Suspense fallback={<PageLoader />}><Profile /></Suspense>} />
        <Route path="/resetPassword" element={<Suspense fallback={<PageLoader />}><ResetPassword /></Suspense>} />
        <Route path="/projects" element={<Suspense fallback={<PageLoader />}><Projects /></Suspense>} />
        <Route path="/projects/:id" element={<ProjectDetailWrapper />} />
        <Route path="/projects/:projectId/documents/new" element={<Suspense fallback={<PageLoader />}><DocumentCreate /></Suspense>} />
        <Route path="/projects/:id/settings" element={<Suspense fallback={<PageLoader />}><ProjectSettings /></Suspense>} />
        <Route path="/notifications" element={<Suspense fallback={<PageLoader />}><NotificationsPage /></Suspense>} />
        <Route path="/documents" element={<Suspense fallback={<PageLoader />}><Documents /></Suspense>} />
        <Route path="/documents/shared-with-me" element={<Suspense fallback={<PageLoader />}><SharedWithMe /></Suspense>} />
        <Route path="/calendar" element={<Suspense fallback={<PageLoader />}><Calendar /></Suspense>} />
        <Route path="/team-chat" element={<Suspense fallback={<PageLoader />}><TeamChatModern /></Suspense>} />
        <Route path="/team-chat/chat" element={<Suspense fallback={<PageLoader />}><TeamChatModern /></Suspense>} />
        <Route path="/team-chat/chat/:roomId" element={<Suspense fallback={<PageLoader />}><TeamChatModern /></Suspense>} />
        <Route path="/team-chat/teams" element={<Suspense fallback={<PageLoader />}><TeamChatModern /></Suspense>} />
        <Route path="/team-chat/teams/:roomId" element={<Suspense fallback={<PageLoader />}><TeamChatModern /></Suspense>} />
        <Route path="/team-chat/project" element={<Suspense fallback={<PageLoader />}><TeamChatModern /></Suspense>} />
        <Route path="/team-chat/:projectId/:roomId" element={<Suspense fallback={<PageLoader />}><TeamChatModern /></Suspense>} />
        <Route path="/team-chat/unread" element={<Suspense fallback={<PageLoader />}><TeamChatModern /></Suspense>} />
        <Route path="/settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
        <Route path="/quick-notes" element={<Suspense fallback={<PageLoader />}><QuickNotesPage /></Suspense>} />
        <Route path="/tasks/:id" element={<Suspense fallback={<PageLoader />}><TaskDetailPage /></Suspense>} />


        {/* Taskboard Routes */}
        <Route path="/taskboard" element={<Suspense fallback={<PageLoader />}><MyTask /></Suspense>}>
          <Route index element={null} />
          <Route path="completed" element={null} />
          <Route path="pending" element={null} />
          <Route path="in_progress" element={null} />
          <Route path="backlog" element={null} />
          <Route path="deployed" element={null} />
          <Route path="deferred" element={null} />
          <Route path="review" element={null} />
          <Route
            path="create"
            element={
              <AdminRoute>
                <Suspense fallback={<PageLoader />}><CreateTask /></Suspense>
              </AdminRoute>
            }
          />
        </Route>

        {/* Admin Accordion */}
        <Route path="/admin" element={<AdminDashboard />}>
          <Route path="teams" element={<Suspense fallback={<PageLoader />}><Teams /></Suspense>} />
          <Route path="user-roles" element={<Suspense fallback={<PageLoader />}><UserManagement /></Suspense>} />
          <Route path="team-performance" element={<Suspense fallback={<PageLoader />}><TeamPerformance /></Suspense>} />
          <Route path="workspace" element={<Suspense fallback={<PageLoader />}><WorkSpace /></Suspense>} />
          <Route index element={<Navigate to="teams" replace />} />
        </Route>

      </Route>
    </Routes>
  );
}

const preloadDashboard = () => import('@/pages/Dashboard/Dashboard');

function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  // Connect/disconnect when auth state hydrates 
  useEffect(() => {
    if (isAuthenticated) {
      notificationSocket.connect();
      gatewaySocket.connect();
      preloadDashboard();
      return () => {
        notificationSocket.disconnect();
        gatewaySocket.disconnect();
      };
    }
  }, [isAuthenticated]);

  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <TaskDraftsProvider>
        <WebSocketProvider>
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
        </WebSocketProvider>
      </TaskDraftsProvider>
    </AuthProvider>
  );
}

export default App;