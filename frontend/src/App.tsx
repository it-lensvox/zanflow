import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout';
import type { User as AppUser } from '@/types';
import { ContentCreation } from '@/pages/TaskType/ContentCreation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { projectsApi } from '@/services/api';
import { TaskDetails } from '@/pages/TaskType/TaskDetails';
import { APITesting } from '@/pages/TaskType/APITesting';

import {
  Dashboard,
  Login,
  Projects,
  ProjectCreate,
  DocumentCreate,
  DocumentDetail,
  Documents,
  ProjectSettings,
  UserManagement,
  MyTask,
  CreateTask,
  TeamPerformance,
  Calendar,
  // NotificationsPage,
  Profile,
  ResetPassword,
  TeamChatModern,
} from '@/pages';

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
          isAuthenticated ? <Navigate to="/users" replace /> : <Login />
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
        <Route path="/projects/new" element={<ProjectCreate />} />
        <Route path="/projects/:id" element={<ProjectDetailWrapper />} />
        <Route path="/projects/:id/api-testing" element={<APITesting />} />
        <Route path="/projects/:projectId/documents/new" element={<DocumentCreate />} />
        <Route path="/projects/:id/settings" element={<ProjectSettings />} />
        {/* <Route path="/notifications" element={<NotificationsPage />} /> */}
        <Route path="/documents" element={<Documents />} />
        <Route path="/documents/:id" element={<DocumentDetail />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/team-chat" element={<TeamChatModern />} />

        <Route path="/test-runs" element={<div>Test Runs (Phase 2)</div>} />
        <Route path="/test-runs/:id" element={<div>Test Run Detail (Phase 2)</div>} />

        <Route path="/settings" element={<div>Settings</div>} />
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
          <Route path="user-roles" element={<UserManagement />} />
          <Route path="team-performance" element={<TeamPerformance />} />
          <Route index element={<Navigate to="user-roles" replace />} />
        </Route>

      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;