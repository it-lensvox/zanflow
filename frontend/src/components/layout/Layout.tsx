import { Outlet, useMatch, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useState, Suspense, useEffect, useRef } from 'react';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { QuickNotes } from '@/components/QuickNotes';
import { AIBot } from '@/pages/AI BOT/AI BOT';
import { useNotifications } from '@/hooks/useNotifications';
import { TaskDraftBar } from '@/pages/MyTask/Taskdrafts';
import { GlobalSearchTrigger } from '@/components/GlobalSearch';
import { Bell } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import logoImage from '../../public/assets/logo.png';

// Page titles per route
const PAGE_TITLES: Record<string, string> = {
  '/dashboard':  'Dashboard',
  '/my-work':    'My Work',
  '/taskboard':  'Tasks',
  '/projects':   'Projects',
  '/documents':  'Documents',
  '/calendar':   'Calendar',
  '/team-chat':  'Team Chat',
  '/quick-notes':'Quick Notes',
  '/reports':    'Reports',
  '/team':       'Team',
  '/profile':    'Profile',
  '/settings':   'Settings',
};

function getPageTitle(pathname: string) {
  // Exact match first
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Prefix match (e.g. /projects/123)
  const prefix = Object.keys(PAGE_TITLES).find(k => pathname.startsWith(k + '/'));
  return prefix ? PAGE_TITLES[prefix] : '';
}

function PageSkeleton() {
  return (
    <div className="h-full flex flex-col animate-pulse p-6 gap-4">
      <div className="flex items-center justify-between">
        <div className="h-7 w-48 rounded-lg bg-muted" />
        <div className="h-9 w-28 rounded-lg bg-muted" />
      </div>
      <div className="flex gap-3">
        <div className="h-5 w-32 rounded bg-muted" />
        <div className="h-5 w-24 rounded bg-muted" />
        <div className="h-5 w-20 rounded bg-muted" />
      </div>
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
  const isProjectDetailPage = useMatch('/projects/:id');
  const { unreadCount }     = useNotifications();
  const { user }            = useAuth();
  const navigate            = useNavigate();
  const location            = useLocation();
  const faviconImgRef       = useRef<HTMLImageElement | null>(null);

  const firstName = (user as any)?.first_name || (user as any)?.username || 'User';
  const pageTitle = getPageTitle(location.pathname);

  // Hide top bar on Dashboard (it has its own header)
  const isDashboard = location.pathname === '/dashboard';

  // ── Favicon with notification badge ────────────────────────────────────────
  useEffect(() => {
    const drawFavicon = (img: HTMLImageElement) => {
      const canvas = document.createElement('canvas');
      canvas.width = 64; canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 64, 64);
      if (unreadCount > 0) {
        ctx.beginPath();
        ctx.arc(52, 12, 10, 0, 2 * Math.PI);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      const link = document.querySelector<HTMLLinkElement>("link[rel='icon']")
        || Object.assign(document.createElement('link'), { rel: 'icon' });
      document.head.appendChild(link);
      link.type = 'image/png';
      link.href = canvas.toDataURL('image/png');
    };
    if (faviconImgRef.current?.complete) {
      drawFavicon(faviconImgRef.current);
    } else {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = logoImage;
      img.onload = () => { faviconImgRef.current = img; drawFavicon(img); };
      img.onerror = () => { console.error('Favicon Error: Could not load the logo image'); };
    }
  }, [unreadCount]);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />

      <main className="flex-1 overflow-auto flex flex-col">

        {/* ── Global Top Bar (hidden on Dashboard which has its own) ── */}
        {!isDashboard && (
          <div style={{
            height: 56, flexShrink: 0,
            display: 'flex', alignItems: 'center',
            padding: '0 28px', gap: 16,
            background: '#fff',
            borderBottom: '1px solid #E6EBF2',
            position: 'sticky', top: 0, zIndex: 100,
          }}>
            {/* Page title */}
            <span style={{ fontSize: 16, fontWeight: 700, color: '#172033', flex: 1 }}>
              {pageTitle}
            </span>

            {/* Global search */}
            <GlobalSearchTrigger />

            {/* Notification bell */}
            <button
              onClick={() => setIsActivityOpen(!isActivityOpen)}
              style={{ position: 'relative', width: 36, height: 36, border: '1px solid #E6EBF2', borderRadius: 8, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <Bell size={15} color="#344054" />
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, background: '#EF4444', borderRadius: '50%', fontSize: 9, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Avatar */}
            <div
              onClick={() => navigate('/profile')}
              style={{ width: 34, height: 34, borderRadius: '50%', background: '#1663F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', flexShrink: 0 }}
            >
              {firstName[0]?.toUpperCase()}
            </div>
          </div>
        )}

        {/* ── Page content ── */}
        <div id="layout-wrapper" className="container flex-1 flex flex-col">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet context={{ isActivityOpen, setIsActivityOpen }} />
          </Suspense>
        </div>
      </main>

      {isActivityOpen && <NotificationsPage onClose={() => setIsActivityOpen(false)} />}
      {!isProjectDetailPage && <AIBot />}
      <QuickNotes />
      <TaskDraftBar />
    </div>
  );
}