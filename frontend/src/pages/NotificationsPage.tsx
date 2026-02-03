import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BellOff, Search, X, Trash2 } from 'lucide-react';
import { notificationsApi } from '@/services/api';
import { cn } from '@/lib/utils';
import { getStatusConfig } from '@/components/layout/DualView/taskConfig';

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
  const filtered =
    filter === 'unread'
      ? notifications.filter((n: any) => !n.is_read)
      : notifications;

  return (
    <div className="flex flex-col h-full px-6">
      {/* Centered Container */}
      <div className="w-full max-w-3xl mx-auto flex flex-col h-full">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-white/10">
          <div className="flex items-center justify-between py-4">
            <div>
              <h2 className="text-xl font-semibold">Activity</h2>
              <p className="text-xs opacity-50">
                Recent actions & updates
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Search className="h-4 w-4 opacity-60 hover:opacity-100 cursor-pointer" />
              <X
                className="h-4 w-4 opacity-60 hover:opacity-100 cursor-pointer"
                onClick={() => navigate(-1)}
              />
            </div>
          </div>
        </div>

        {/* Filter Toggle */}
        <div className="py-4">
          <div className="inline-flex p-1 bg-muted rounded-xl">
            {(['all', 'unread'] as const).map((key) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  "px-5 py-1.5 text-xs font-semibold rounded-lg transition-all",
                  filter === key
                    ? "bg-[#97bd30] text-white shadow"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {key === 'all' ? 'All' : 'Unread'}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pb-6">
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
                  "relative p-4 rounded-xl mb-2 border border-white/5",
                  "hover:bg-white/[0.04] transition-all cursor-pointer",
                  !n.is_read && "bg-white/[0.03]"
                )}
              >
                {/* Unread Accent */}
                {!n.is_read && (
                  <span className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-[#97bd30]" />
                )}

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
