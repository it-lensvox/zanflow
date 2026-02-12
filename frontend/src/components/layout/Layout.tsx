import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useState } from 'react';
import { NotificationsPage } from '@/pages/NotificationsPage';

export function Layout() {
  const [isActivityOpen, setIsActivityOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div id="layout-wrapper" className="container">
          <Outlet context={{ isActivityOpen, setIsActivityOpen }} />
        </div>
      </main>

      {/* Render the component directly - it handles its own positioning and backdrop */}
      {isActivityOpen && (
        <NotificationsPage onClose={() => setIsActivityOpen(false)} />
      )}
    </div>
  );
}
