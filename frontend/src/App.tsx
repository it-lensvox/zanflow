import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout';
import type { User as AppUser } from '@/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { projectsApi, notificationSocket } from '@/services/api';

// Lazy-loaded page components for route-level code splitting
const Dashboard = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Login = lazy(() => import('@/pages/Login').then(m => ({ default: m.Login })));
const Projects = lazy(() => import('@/pages/Project/Projects').then(m => ({ default: m.Projects })));
const ProjectSettings = lazy(() => import('@/pages/Project/ProjectSettings').then(m => ({ default: m.ProjectSettings })));
const DocumentCreate = lazy(() => import('@/pages/Documents/DocumentCreate').then(m => ({ default: m.DocumentCreate })));
const Documents = lazy(() => import('@/pages/Documents/Documents').then(m => ({ default: m.Documents })));
const MyTask = lazy(() => import('@/pages/MyTask/MyTask').then(m => ({ default: m.MyTask })));
const CreateTask = lazy(() => import('@/pages/MyTask/CreateTask').then(m => ({ default: m.CreateTask })));
const TaskDetailPage = lazy(() => import('@/pages/MyTask/TaskDetailPage').then(m => ({ default: m.TaskDetailPage })));
const Teams = lazy(() => import('@/pages/TeamManagement/Teams').then(m => ({ default: m.Teams })));
const UserManagement = lazy(() => import('@/pages/TeamManagement/UserManagement').then(m => ({ default: m.UserManagement })));
const TeamPerformance = lazy(() => import('@/pages/TeamManagement/TeamPerformance').then(m => ({ default: m.TeamPerformance })));
const ContentCreation = lazy(() => import('@/pages/TaskType/ContentCreation').then(m => ({ default: m.ContentCreation })));
const TaskDetails = lazy(() => import('@/pages/TaskType/TaskDetails').then(m => ({ default: m.TaskDetails })));
const Calendar = lazy(() => import('@/pages/Calendar/Calendar').then(m => ({ default: m.Calendar })));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const Profile = lazy(() => import('@/pages/Profile').then(m => ({ default: m.Profile })));
const ResetPassword = lazy(() => import('@/pages/ResetPassword').then(m => ({ default: m.ResetPassword })));
const TeamChatModern = lazy(() => import('@/pages/TeamsChat/TeamChatModern').then(m => ({ default: m.TeamChatModern })));
const Settings = lazy(() => import('@/pages/Settings').then(m => ({ default: m.Settings })));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAllowed, isLoading, isAuthenticated } = useAuth();
  const ALLOWED_ROLES: AppUser['role'][] = ['admin', 'manager', 'annotator'];
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

  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(Number(id)),
    enabled: !!id,
    placeholderData: () => {
      const cache = queryClient.getQueryData(['projects']) as any || queryClient.getQueryData(['projects', '']) as any;
      const list = Array.isArray(cache) ? cache : (cache?.results || []);
      return list.find((p: any) => p.id === Number(id));
    },
  });

  if (!project) return null;

  // 1. Content Creation specific UI
  if (project.task_type === 'content_creation' || project.task_type === 'content-creation') {
    return <ContentCreation />;
  }

  // 2. Extraction & OCR
  const taskDetailsTypes = ['client', 'internal', 'Content Creation', 'ideas'];
  if (taskDetailsTypes.includes(project.task_type)) {
    return <TaskDetails />;
  }
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
      <Route
        path="/login"
        element={
          isAuthenticated
            ? <Navigate to="/users" replace />
            : <Suspense fallback={<PageLoader />}><Login /></Suspense>
        }
      />

      {/* Routes WITH Sidebar */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/resetPassword" element={<ResetPassword />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetailWrapper />} />
        <Route path="/projects/:projectId/documents/new" element={<DocumentCreate />} />
        <Route path="/projects/:id/settings" element={<ProjectSettings />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/documents" element={<Documents />} />
        {/* <Route path="/documents/:id" element={<DocumentDetail />} /> */}
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/team-chat" element={<TeamChatModern />} />
        <Route path="/settings" element={<Settings />} />
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
          <Route index element={<Navigate to="teams" replace />} />
        </Route>

      </Route>
    </Routes>
  );
}

// Preload the Dashboard chunk as soon as the user is authenticated so
// there is no lazy-load delay when they land on "/" after login.
const preloadDashboard = () => import('@/pages/Dashboard');

// Global WebSocket initializer component
function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      notificationSocket.connect();
      console.log('🌐 Global WebSocket initialized');
      // Kick off the Dashboard chunk download in the background the
      // moment we know the user is logged in.
      preloadDashboard();
      return () => {
      };
    }
  }, [isAuthenticated]);

  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <AppRoutes />
      </WebSocketProvider>
    </AuthProvider>
  );
}

export default App;