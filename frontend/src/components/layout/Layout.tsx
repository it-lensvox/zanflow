import { Outlet, useMatch } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useState, Suspense, useEffect, useRef } from 'react';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { QuickNotes } from '@/components/QuickNotes';
import { AIBot } from '@/pages/AI BOT/AI BOT';
import { useNotifications } from '@/hooks/useNotifications';
import { TaskDraftBar } from '@/pages/MyTask/Taskdrafts';

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
  const isProjectDetailPage = useMatch('/projects/:id');
  const { unreadCount } = useNotifications();

   const faviconImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const drawFavicon = (img: HTMLImageElement) => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
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

    // If image already loaded (cached), draw immediately — no waiting for onload
    if (faviconImgRef.current?.complete) {
      drawFavicon(faviconImgRef.current);
    } else {
      const img = new Image();
      img.src = './src/public/assets/logo.png';
      img.onload = () => {
        faviconImgRef.current = img;
        drawFavicon(img);
      };
    }
  }, [unreadCount]);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />

      <main className="flex-1 overflow-auto flex flex-col">
        <div id="layout-wrapper" className="container flex-1 flex flex-col">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet context={{ isActivityOpen, setIsActivityOpen }} />
          </Suspense>
        </div>
      </main>

      {isActivityOpen && (
        <NotificationsPage onClose={() => setIsActivityOpen(false)} />
      )}
     {!isProjectDetailPage && <AIBot />}
      <QuickNotes />
      <TaskDraftBar />
    </div>
  );
}