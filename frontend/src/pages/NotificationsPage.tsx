import React, { useState, useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BellOff, Search, X, Trash2 } from 'lucide-react';
import { fetchNotifications, deleteReadNotifications, api } from '@/services/api';
import { cn } from '@/lib/utils';
import type { NotificationData } from '@/types';
import { useNotifications } from '@/hooks/useNotifications';

export function NotificationsPage({ 
  onClose,
  defaultFilter = 'unread'
}: { 
  onClose?: () => void;
  defaultFilter?: 'all' | 'unread';
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>(defaultFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
   const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  // Get unread count from useNotifications hook
  const { setNotifications: setGlobalNotifications } = useNotifications();

  const handleClose = () => (onClose ? onClose() : navigate(-1));

// Step A: Fetch notifications from REST API with pagination
  const {
    data: infiniteData,
    isLoading: isFetchingInitial,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['notifications-initial'],
    queryFn: fetchNotifications,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (!lastPage || !lastPage.notifications) return undefined;
      const currentPage = lastPage.current_page ?? 1;
      const totalPages = lastPage.total_pages ?? 1;
      return currentPage < totalPages ? currentPage + 1 : undefined;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const notifications = React.useMemo(() => {
    if (!infiniteData?.pages) return [];
    const seen = new Set<number>();
    const merged: NotificationData[] = [];
    for (const page of infiniteData.pages) {
      for (const n of page?.notifications ?? []) {
        if (!seen.has(n.id)) {
          seen.add(n.id);
          merged.push(n);
        }
      }
    }
    return merged;
  }, [infiniteData]);

 // Update global notifications when data changes
  useEffect(() => {
    if (notifications.length > 0) {
      setGlobalNotifications(notifications);
    }
  }, [notifications, setGlobalNotifications]);

  // Infinite scroll: fetch next page when user scrolls near bottom
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight - scrollTop - clientHeight < 150 && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Reset to default filter when panel opens
  useEffect(() => {
    setFilter(defaultFilter);
  }, [defaultFilter]);

  // Mutation for clearing all notifications
  const clearAllReadMutation = useMutation({
    mutationFn: deleteReadNotifications,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications-initial'] });
      const previous = queryClient.getQueryData(['notifications-initial']);
      // Optimistic update: wipe all pages
      queryClient.setQueryData(['notifications-initial'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages?.map((page: any) => ({ ...page, notifications: [] })) ?? [],
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['notifications-initial'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-initial'] });
    },
  });

  // Mutation for deleting notifications
  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/notification/${id}/`);
    },
    onSuccess: () => {
      // Refetch notifications after delete
      queryClient.invalidateQueries({ queryKey: ['notifications-initial'] });
    },
  });

  // Check if notification is read
  const isNotificationRead = (n: NotificationData) => {
    return n.is_read || false;
  };

  const filtered = notifications
    .filter((n: NotificationData) => (filter === 'unread' ? !isNotificationRead(n) : true))
    .filter((n: NotificationData) => {
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
  const getNotificationColor = (n: NotificationData): string => {
    const type = n.notification_type;

    // For task-related notifications
    if (type === 'task_status_updated' && n.metadata?.new_status) {
      return '#ef9fab';
    }
    if (type === 'task_completed') {
      return '#1bb059';
    }
    if (type === 'task_assigned') {
      return '#3b82f6';
    }
    if (type === 'project_assigned' || type === 'project_assigI want to lCaccccned') {
      return '#9c45ce';
    }
    if (type === 'event_created') {
      return '#f97316'; // Orange accent for events
    }
    return '#9170df';
  };

  const handleNotificationClick = async (n: NotificationData) => {
    if (!n.is_read) {
      try {
        await api.post(`/notification/${n.id}/mark-read/`);
        queryClient.invalidateQueries({ queryKey: ['notifications-initial'] });
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }

  // Navigate based on related object or metadata
  const relatedType = (n.related_object?.type || n.related_object_info?.type) as string | undefined;
  const relatedId = n.related_object?.id || n.related_object_info?.id;

  if (relatedType === 'document' && relatedId) {
      navigate(`/documents`);
    } else if (relatedType === 'task' || n.metadata?.task_id) {
      const taskId = relatedId || n.metadata?.task_id;
      navigate(`/tasks/${taskId}`);
    } else if (relatedType === 'project' || n.metadata?.project_id) {
      const projectId = relatedId || n.metadata?.project_id;
      navigate(`/projects/${projectId}`);
    } else if (relatedType === 'event' || n.metadata?.event_id) {
      const eventId = relatedId || n.metadata?.event_id;
      // Pass the event ID as a query parameter
      navigate(`/calendar?eventId=${eventId}`);
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
                <button
                    onClick={() => clearAllReadMutation.mutate()}
                    disabled={clearAllReadMutation.isPending || notifications.length === 0}
                    className="text-[10px] font-semibold text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40 whitespace-nowrap"
                    title="Clear all notifications"
                  >
                    Clear All
                  </button>
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
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar px-4 mb-10">
          {isFetchingInitial ? (
            <div className="py-20 text-center text-sm opacity-50 italic">
              Loading activity...
            </div>
          ) : filtered.length > 0 ? (
            <div className="pb-2">
              {filtered.map((n: NotificationData) => {
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
                        deleteNotificationMutation.mutate(n.id);
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
                        {n.notification_type?.replace(/_/g, ' ') || 'Notification'}
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
                      {n.message ? n.message.replace(/<[^>]*>?/gm, '').trim() : ''}
                    </p>
                  </div>
                );
              })}
            {/* Load more indicator */}
            {isFetchingNextPage && (
              <div className="py-4 text-center text-xs text-muted-foreground opacity-50 italic">
                Loading more...
              </div>
            )}
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
