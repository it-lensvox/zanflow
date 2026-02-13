import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { notificationSocket, api } from '@/services/api';
import type { NotificationData } from '@/types';

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();

  // Trigger notification refetch
  const triggerRefetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['notifications-initial'] });
  }, [queryClient]);

  useEffect(() => {
    // Connect to notification WebSocket
    notificationSocket.connect();
    setIsConnected(notificationSocket.isConnected());
    const unsubscribe = notificationSocket.onNotification((notification) => {
      
      // Update unread count from WebSocket notification
      if (notification.unread_count !== undefined) {
        setUnreadCount(notification.unread_count);
      }

      // Step C: Force refetch with resetQueries to ensure fresh data
      queryClient.resetQueries({ queryKey: ['notifications-initial'] });
    });
    return () => {
      unsubscribe();
    };
  }, [queryClient]);

  // Fetch and sync unread count on mount
  useEffect(() => {
    const initializeUnreadCount = async () => {
      try {
        // Prefetch notifications to populate cache and get unread count
        const data = await queryClient.fetchQuery({
          queryKey: ['notifications-initial'],
          queryFn: async () => {
            const response = await api.get('/notification/');
            return response.data;
          },
          staleTime: 0,
        });
        
        if ((data as any)?.unread_count !== undefined) {
          setUnreadCount((data as any).unread_count);
        }
      } catch (error) {
        console.error('Failed to initialize unread count:', error);
      }
    };

    initializeUnreadCount();

    // Listen for query cache updates
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (
        event?.query.queryKey[0] === 'notifications-initial' && 
        event.type === 'updated'
      ) {
        const data = event.query.state.data as any;
        if (data?.unread_count !== undefined) {
          setUnreadCount(data.unread_count);
        }
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [queryClient]);

  return {
    notifications,
    unreadCount,
    isConnected,
    setNotifications,
    triggerRefetch,
  };
}