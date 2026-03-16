import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useState, Suspense, useMemo } from 'react';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { QuickNotes } from '@/components/QuickNotes';
import Threads from '@/pages/Project/Thread';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '@/services/api';

// Sidebar stays fully mounted and visible
function PageSkeleton() {
  return (
    <div className="h-full flex flex-col animate-pulse p-6 gap-4">
      {/* Page header bar */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-48 rounded-lg bg-muted" />
        <div className="h-9 w-28 rounded-lg bg-muted" />
      </div>

      {/* Subheader / filter row */}
      <div className="flex gap-3">
        <div className="h-5 w-32 rounded bg-muted" />
        <div className="h-5 w-24 rounded bg-muted" />
        <div className="h-5 w-20 rounded bg-muted" />
      </div>

      {/* Content cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-muted" />
              <div className="h-4 w-32 rounded bg-muted" />
            </div>
            <div className="h-3 w-full rounded bg-muted" />
            <div className="h-3 w-4/5 rounded bg-muted" />
            <div className="flex gap-2 pt-1">
              <div className="h-5 w-16 rounded-full bg-muted" />
              <div className="h-5 w-12 rounded-full bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Layout() {
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const location = useLocation();
const activeProjectId = useMemo(() => {
    const projectMatch = location.pathname.match(/\/projects\/(\d+)/);
    const chatMatch = location.pathname.match(/\/team-chat\/(\d+)/);
    return projectMatch?.[1] || chatMatch?.[1] || null;
  }, [location.pathname]);

  // Fetch all projects as fallback for pages with no project in URL
  const { data: allProjectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
    staleTime: Infinity, // already fetched by Sidebar — reuse cache, no extra request
  });

  const fallbackProject = useMemo(() => {
    if (!allProjectsData) return null;
    const list = Array.isArray(allProjectsData)
      ? allProjectsData
      : (allProjectsData as any)?.results || [];
    return list[0] || null;
  }, [allProjectsData]);

  // Use URL project if available, else fall back to first project in list
  const resolvedProjectId = activeProjectId ?? (fallbackProject?.id ? String(fallbackProject.id) : null);

  const { data: activeProject } = useQuery({
    queryKey: ['project', resolvedProjectId],
    queryFn: () => projectsApi.get(Number(resolvedProjectId)),
    enabled: !!resolvedProjectId,
  });

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar is OUTSIDE Suspense — it never unmounts on page transitions */}
      <Sidebar />

      <main className="flex-1 overflow-auto flex flex-col">
        <div id="layout-wrapper" className="container flex-1 flex flex-col">
          {/* Suspense only covers the page content, not the sidebar */}
          <Suspense fallback={<PageSkeleton />}>
            <Outlet context={{ isActivityOpen, setIsActivityOpen }} />
          </Suspense>
        </div>
      </main>

      {isActivityOpen && (
        <NotificationsPage onClose={() => setIsActivityOpen(false)} />
      )}
      <QuickNotes />
      {resolvedProjectId && activeProject && (
        <div style={{ position: 'fixed', bottom: '24px', right: '80px', zIndex: 50 }}>
          <Threads
            projectId={Number(resolvedProjectId)}
            projectName={activeProject.name}
          />
        </div>
      )}
    </div>
  );
}
