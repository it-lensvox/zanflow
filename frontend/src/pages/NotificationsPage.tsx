import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BellOff, Search, X } from 'lucide-react';
import { notificationsApi } from '@/services/api';
import { cn } from '@/lib/utils';
import { getStatusConfig } from '@/components/layout/DualView/taskConfig';

export function NotificationsPage({ onClose }: { onClose?: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(),
  });

  const markAsRead = useMutation({
    mutationFn: (id: number) => notificationsApi.markAsRead(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications = data?.notifications || [];
  const filtered =
    filter === 'unread'
      ? notifications.filter((n: any) => !n.is_read)
      : notifications;
  
  // Determine the accent color for a notification based on its type and metadata
const getNotificationColor = (n: any): string => {
  const type = n.notification_type;

  // For task-related notifications, use the new_status or old_status from metadata
  if (type === 'task_status_updated' && n.metadata?.new_status) {
    return getStatusConfig(n.metadata.new_status).color;
  }

  if (type === 'task_completed') {
    return getStatusConfig('completed').color; // green
  }

  if (type === 'task_assigned') {
    return getStatusConfig('in_progress').color; // blue
  }

  if (type === 'project_assigned') {
    return '#8b5cf6'; // purple — project-level event
  }

  // Fallback
  return '#9ca3af'; // gray
};
    
  return (
    // Backdrop overlay to create the popup feel
    <div className="fixed inset-0 z-30 flex items-start justify-end p-4 md:p-10 bg-black/20 backdrop-blur-sm">

      {/* The Popup Card */}
      <div className="w-full max-w-md border border-white/10 rounded-[2rem] shadow-2xl flex flex-col max-h-[85vh] bg-white">

        {/* Header Section */}
        <div className="px-6 py-5 border-b border-white/5 bg-white/10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Activity</h2>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                Recent updates
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Search className="h-4 w-4 opacity-60 hover:opacity-100 cursor-pointer" />
              <X
                className="h-4 w-4 opacity-60 hover:opacity-100 cursor-pointer"
                onClick={() => onClose ? onClose() : navigate(-1)}
              />
            </div>
          </div>

          {/* Filter Toggle inside the header */}
          <div className="inline-flex p-1 bg-white/5 rounded-xl">
            {(['all', 'unread'] as const).map((key) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  "px-5 py-1.5 text-xs font-semibold rounded-lg transition-all",
                  filter === key
                    ? "bg-[#97bd30] text-white shadow-lg shadow-[#97bd30]/20"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {key === 'all' ? 'All' : 'Unread'}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable List with Padding */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          {isLoading ? (
            <div className="py-20 text-center text-sm opacity-50 italic">
              Loading activity...
            </div>
          ) : filtered.length > 0 ? (
            filtered.map((n: any) => (
              <div
                key={n.id}
                onClick={() => !n.is_read && markAsRead.mutate(n.id)}
                className={cn(
                  "relative p-4 rounded-2xl mb-3 border border-transparent transition-all cursor-pointer",
                  !n.is_read
                    ? "bg-white/[0.05] border-white/5 shadow-sm"
                    : "hover:bg-white/[0.03]"
                )}
              >
                {/* Unread Accent */}
                {!n.is_read && (
                  <span className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-[#97bd30]" />
                )}

                {/* Meta */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold tracking-wide text-[#97bd30] uppercase">
                    {n.notification_type.replaceAll('_', ' ')}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {n.time_since}
                  </span>
                </div>

                {/* Content */}
                <p className="text-sm font-medium leading-snug">
                  {n.title}
                </p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {n.message}
                </p>
              </div>
            ))
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
