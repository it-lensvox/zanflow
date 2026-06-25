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
import { MyWork } from '@/pages/MyWork';

// Lazy-loaded page components for route-level code splitting
const Dashboard = lazy(() => import('@/pages/Dashboard/Dashboard').then(m => ({ default: m.Dashboard })));
const Login = lazy(() => import('@/pages/Login').then(m => ({ default: m.Login })));
const Projects = lazy(() => import('@/pages/Project/Projects').then(m => ({ default: m.Projects })));
const ProjectSettings = lazy(() => import('@/pages/Project/ProjectSettings').then(m => ({ default: m.ProjectSettings })));
const DocumentCreate = lazy(() => import('@/pages/Documents/DocumentCreate').then(m => ({ default: m.DocumentCreate })));
const Documents = lazy(() => import('@/pages/Documents/Documents').then(m => ({ default: m.Documents })));
const SharedWithMe = lazy(() => import('@/pages/Documents/SharedWithMe').then(m => ({ default: m.SharedWithMe })));const MyTask = lazy(() => import('@/pages/MyTask/MyTask').then(m => ({ default: m.MyTask })));
const CreateTask = lazy(() => import('@/pages/MyTask/pages/CreateTask').then(m => ({ default: m.CreateTask })));
const TaskDetailPage = lazy(() => import('@/pages/MyTask/pages/TaskDetailPage').then(m => ({ default: m.TaskDetailPage })));
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

  if (isLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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

  if (isLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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

      <Route
        path="/login"
        element={
          isAuthenticated
            ? <Navigate to="/dashboard" replace />
            : <Suspense fallback={<PageLoader />}><Login /></Suspense>
        }
      />

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
       <Route path="/dashboard" element={<Dashboard />} />
       <Route path="/my-work" element={<MyWork />} />
               <Route path="/profile" element={<Profile />} />
        <Route path="/resetPassword" element={<ResetPassword />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetailWrapper />} />
        <Route path="/projects/:projectId/documents/new" element={<DocumentCreate />} />
        <Route path="/projects/:id/settings" element={<ProjectSettings />} />
        <Route path="/notifications" element={<NotificationsPage />} />
<Route path="/documents" element={<Documents />} />
<Route path="/documents/shared-with-me" element={<SharedWithMe />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/team-chat" element={<TeamChatModern />} />
        <Route path="/team-chat/chat" element={<TeamChatModern />} />
        <Route path="/team-chat/chat/:roomId" element={<TeamChatModern />} />
        <Route path="/team-chat/teams" element={<TeamChatModern />} />
        <Route path="/team-chat/teams/:roomId" element={<TeamChatModern />} />
        <Route path="/team-chat/project" element={<TeamChatModern />} />
        <Route path="/team-chat/:projectId/:roomId" element={<TeamChatModern />} />
        <Route path="/team-chat/unread" element={<TeamChatModern />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/quick-notes" element={<QuickNotesPage />} />
        <Route path="/tasks/:id" element={<TaskDetailPage />} />
        

        {/* Taskboard Routes */}
        <Route path="/taskboard" element={<MyTask />}>
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
                <CreateTask />
              </AdminRoute>
            }
          />
        </Route>

        {/* Admin Accordion */}
        <Route path="/admin" element={<AdminDashboard />}>
          <Route path="teams" element={<Teams />} />
          <Route path="user-roles" element={<UserManagement />} />
          <Route path="team-performance" element={<TeamPerformance />} />
          <Route path="workspace" element={<WorkSpace />} />
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