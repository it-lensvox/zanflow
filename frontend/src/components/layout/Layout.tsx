import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useState, Suspense, useEffect, useRef } from 'react';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { AIBot } from '@/pages/AIBOT/AIBOT';
import { useNotifications } from '@/hooks/useNotifications';
import { TaskDraftBar } from '@/pages/MyTask/components/Taskdrafts';
import { GlobalSearchTrigger } from '@/components/GlobalSearch';
import { Bell, HelpCircle } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import logoImage from '../../public/assets/logo.png';
import { QuickCreateButton } from '@/components/QuickCreateButton';
import { cn } from '@/lib/utils';

// Page titles per route
const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/my-work': 'My Work',
  '/taskboard': 'Tasks',
  '/projects': 'Projects',
  '/documents': 'Documents',
  '/calendar': 'Calendar',
  '/team-chat': 'Team Chat',
  '/quick-notes': 'Quick Notes',
  '/reports': 'Reports',
  '/team': 'Team',
  '/profile': 'Profile',
  '/settings': 'Settings',
};

function getPageTitle(pathname: string) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
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
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { unreadCount } = useNotifications();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const faviconImgRef = useRef<HTMLImageElement | null>(null);
  const pageTitle = getPageTitle(location.pathname);

  // Hide top bar on Dashboard
  const isDashboard = location.pathname === '/dashboard';

  // Listen for mobile sidebar 
  useEffect(() => {
    const handler = () => setIsMobileSidebarOpen(true);
    window.addEventListener('dashboard:open-sidebar', handler);
    return () => window.removeEventListener('dashboard:open-sidebar', handler);
  }, []);

  // ── Favicon with notification badge
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
    <div className="flex h-screen bg-background overflow-hidden">

      {/* Mobile sidebar backdrop */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 md:relative md:flex md:flex-shrink-0 transition-transform duration-300",
        isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <Sidebar onMobileClose={() => setIsMobileSidebarOpen(false)} />
      </div>

      {/* Main area */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* ── Global Top Bar ── */}
        {!isDashboard && (
          <div style={{
            height: 52, flexShrink: 0,
            display: 'flex', alignItems: 'center',
            padding: '0 20px', gap: 12,
            background: 'hsl(var(--card))',
            borderBottom: '1px solid hsl(var(--border))',
            zIndex: 27,
          }}>
            {/* Left: hamburger (mobile) + breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'hsl(var(--muted-foreground))' }}>
              {/* Hamburger — mobile only */}
              <button
                className="md:hidden flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted transition-colors flex-shrink-0 mr-1"
                onClick={() => setIsMobileSidebarOpen(true)}
                aria-label="Open menu"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
              </button>
              <span style={{ color: 'hsl(var(--muted-foreground))', fontWeight: 500 }}>DYUKSA</span>
              <span style={{ color: 'hsl(var(--foreground))', fontWeight: 700 }}>{pageTitle}</span>
            </div>

            {/* search — grows to fill ~40% of the row */}
            <div className="hidden sm:flex" style={{ flex: '0 1 40%', minWidth: 160, marginLeft: 'auto' }}>
              <GlobalSearchTrigger />
            </div>

            {/* Right: Moon + QuickCreate + Bell + Help */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {/* Theme toggle — active styled container */}
              <div
                title="Toggle theme"
                style={{
                  width: 34, height: 34,
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  background: 'hsl(var(--accent))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'background 0.2s, box-shadow 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,.08)',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--secondary))'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--accent))'; }}
              >
                <ThemeToggle />
              </div>

              {/* Quick create */}
              <QuickCreateButton />

              {/* Notification bell */}
              <button
                onClick={() => setIsActivityOpen(!isActivityOpen)}
                style={{ position: 'relative', width: 34, height: 34, border: '1px solid hsl(var(--border))', borderRadius: 8, background: 'hsl(var(--card))', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                <Bell size={15} color="currentColor" />
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, background: '#EF4444', borderRadius: '50%', fontSize: 9, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Help */}
              <button
                style={{ width: 34, height: 34, border: '1px solid hsl(var(--border))', borderRadius: 8, background: 'hsl(var(--card))', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                className="hidden sm:flex"
              >
                <HelpCircle size={15} color="hsl(var(--muted-foreground))" />
              </button>
            </div>
          </div>
        )}

        {/* Dashboard's Row 1 dispatches 'dashboard:open-sidebar' to open mobile sidebar */}
        {isDashboard && null}

        {/* ── Page content ── */}
        <div id="layout-wrapper" className="flex-1 flex flex-col min-w-0 overflow-auto">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet context={{ isActivityOpen, setIsActivityOpen }} />
          </Suspense>
        </div>
      </main>

      {isActivityOpen && <NotificationsPage onClose={() => setIsActivityOpen(false)} />}
      <AIBot />
      <TaskDraftBar />
    </div>
  );
}