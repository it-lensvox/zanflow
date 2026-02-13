import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BellOff, Search, X, Trash2 } from 'lucide-react';
import { notificationsApi } from '@/services/api';
import { cn } from '@/lib/utils';

export function NotificationsPage({ onClose }: { onClose?: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [localReadIds, setLocalReadIds] = useState<Set<number>>(new Set());

  const deleteNotification = useMutation({
    mutationFn: (id: number) => notificationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-summary'] });
    },
  });
  const handleClose = () => (onClose ? onClose() : navigate(-1));
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);


  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(),
  });

  const markAsRead = useMutation({
    mutationFn: (id: number) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-summary'] });
    },
  });

  // Check if notification is read (either from backend or local optimistic state)
  const isNotificationRead = (n: any) => {
    return localReadIds.has(n.id) || n.is_read;
  };

  const notifications = data?.notifications || [];
  const filtered = notifications
    .filter((n: any) => (filter === 'unread' ? !isNotificationRead(n) : true))
    .filter((n: any) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        n.title?.toLowerCase().includes(q) ||
        n.message?.toLowerCase().includes(q) ||
        n.notification_type?.toLowerCase().includes(q) ||
        n.metadata?.project_name?.toLowerCase().includes(q) ||
        n.metadata?.task_heading?.toLowerCase().includes(q)
      );
    });


  // Determine the accent color for a notification based on its type and metadata
  const getNotificationColor = (n: any): string => {
    const type = n.notification_type;

    // For task-related notifications, use the new_status or old_status from metadata
    if (type === 'task_status_updated' && n.metadata?.new_status) {
      return '#ef9fab';
    }
    if (type === 'task_completed') {
      return '#1bb059';
    }
    if (type === 'task_assigned') {
      return '#3b82f6';
    }
    if (type === 'project_assigned') {
      return '#9c45ce';
    }
    // Fallback
    return '#9170df';
  };

  const handleNotificationClick = (n: any) => {
    // Optimistic UI update - immediately mark as read locally
    if (!isNotificationRead(n)) {
      setLocalReadIds(prev => {
        const next = new Set(prev);
        next.add(n.id);
        return next;
      });
      markAsRead.mutate(n.id);
    }
    if (n.metadata?.task_id) {
      navigate(`/tasks/${n.metadata.task_id}`);
    } else if (n.metadata?.project_id) {
      navigate(`/projects/${n.metadata.project_id}`);
    }

    if (onClose) onClose();
  };

  return (
    // Backdrop overlay to create the popup feel
    <div className="fixed inset-0 z-30 flex items-start justify-end p-4 md:p-10 bg-black/20 backdrop-blur-sm"
      onClick={handleClose}>

      {/* The Popup Card */}
      <div className="w-full max-w-md border border-white/10 rounded-[2rem] shadow-2xl flex flex-col max-h-[85vh] bg-white"
        onClick={(e) => e.stopPropagation()}>

        {/* Header Section */} 
        <div className="px-6 py-5 border-b border-white/5 bg-white/10">
          <div className="flex items-center justify-between mb-4">
            {/* Left: Title (Hide when searching on small screens if needed) */}
            <div className='mx-3'>
              <h2 className="text-xl font-bold tracking-tight">Activity</h2>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                Recent updates
              </p>
            </div>

            {/* Right: Search Bar OR Search Icon */}
            <div className="flex items-center gap-3 flex-1 justify-end">
              {isSearchOpen ? (
                <div className="flex items-center gap-2 w-full animate-in fade-in slide-in-from-right-2">
                  <input
                    type="text"
                    placeholder="Search notifications..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#97bd30]/30"
                  />
                  <X
                    className="h-4 w-4 opacity-60 hover:opacity-100 cursor-pointer flex-shrink-0"
                    onClick={() => {
                      setIsSearchOpen(false);
                      setSearchQuery('');
                    }}
                  />
                </div>
              ) : (
                <>
                  <Search
                    className="h-4 w-4 opacity-60 hover:opacity-100 cursor-pointer"
                    onClick={() => setIsSearchOpen(true)}
                  />
                  <X
                    className="h-4 w-4 opacity-60 hover:opacity-100 cursor-pointer"
                    onClick={() => (onClose ? onClose() : navigate(-1))}
                  />
                </>
              )}
            </div>
          </div>

          {/* Filter Toggle inside the header */}
          <div className="inline-flex p-1 bg-gray-100 rounded-xl">
            {(['all', 'unread'] as const).map((key) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  "px-5 py-1.5 text-xs font-semibold rounded-lg transition-all",
                  filter === key
                    ? "bg-[#97bd30] text-white shadow-lg shadow-[#97bd30]/20"
                    : "text-gray-500 hover:text-gray-700 bg-transparent"
                )}
              >
                {key === 'all' ? 'All' : 'Unread'}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable List with Padding */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 mb-10">
          {isLoading ? (
            <div className="py-20 text-center text-sm opacity-50 italic">
              Loading activity...
            </div>
          ) : filtered.length > 0 ? (
            <div className="pb-2">
              {filtered.map((n: any) => {
                const isRead = isNotificationRead(n);
                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      "group relative p-4 rounded-2xl mb-3 border transition-all cursor-pointer",
                      !isRead
                        ? "bg-blue-50/50 border-blue-100 shadow-sm"
                        : "bg-white border-gray-100 hover:bg-gray-50"
                    )}
                  >
                    {/* Unread Accent */}
                    {!isRead && (
                      <span
                        className="absolute left-0 top-3 bottom-3 w-1 rounded-full"
                        style={{ backgroundColor: getNotificationColor(n) }}
                      />
                    )}

                {/* Delete Button - visible on hover */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification.mutate(n.id);
                  }}
                  className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all"
                  title="Delete notification"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>

                {/* Meta */}
                <div className="flex items-center justify-between mb-1 pr-6">
                  <span
                    className="text-[10px] font-semibold tracking-wide uppercase"
                    style={{ color: getNotificationColor(n) }}
                  >
                    {n.notification_type.replaceAll('_', ' ')}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {n.time_since}
                  </span>
                </div>

                {/* Content */}
                <p className="text-sm font-medium leading-snug pr-6">
                  {n.metadata?.task_heading || n.metadata?.project_name || n.title}
                </p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {n.message}
                </p>
              </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <BellOff className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm font-medium">No activity yet</p>
              <p className="text-xs opacity-60">
                You’re all caught up ✨
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
