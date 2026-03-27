import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { notificationSocket, api } from '@/services/api';
import type { NotificationData } from '@/types';
import notificationSoundFile from '../public/assets/notification-sound.mp3';

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 3. Initialize the audio object on mount using the imported file
  useEffect(() => {
    audioRef.current = new Audio(notificationSoundFile);
  }, []);

  // Trigger notification refetch
  const triggerRefetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['notifications-initial'] });
  }, [queryClient]);

  useEffect(() => {
    // Connect to notification WebSocket
    notificationSocket.connect();
    setIsConnected(notificationSocket.isConnected());
    const unsubscribe = notificationSocket.onNotification((notification) => {
      // 4. Play the sound when a new notification arrives
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch((error) => {
          console.warn('Browser prevented audio playback:', error);
        });
      }

      // Update unread count: increment locally for every new unread notification,
      if (notification.unread_count !== undefined) {
        setUnreadCount(notification.unread_count);
      } else if (!notification.is_read) {
        setUnreadCount((prev) => prev + 1);
        queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      }

      // Force refetch with resetQueries to ensure fresh data
      queryClient.resetQueries({ queryKey: ['notifications-initial'] });

      // Real-time task sync: when a task-related notification arrives,
      const relatedType = notification.related_object?.type || notification.related_object_info?.type;

      const isTaskNotification =
        relatedType === 'task' ||
        notification.title?.toLowerCase().includes('task');
      if (isTaskNotification) {
        queryClient.refetchQueries({ queryKey: ['tasks'] });
      }

      // Real-time document sync: when a document_shared notification arrives,
      const isDocumentNotification =
        relatedType === 'document' ||
        notification.notification_type === 'document_shared' ||
        notification.notification_type === 'DOCUMENT_SHARED';

      console.log('[useNotifications] 📄 isDocumentNotification:', isDocumentNotification, '| relatedType:', relatedType, '| notification_type:', notification.notification_type);

      if (isDocumentNotification) {
        console.log('[useNotifications] 📄 >>> Invalidating documents queries for receiver...');
        queryClient.invalidateQueries({ queryKey: ['documents'] });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient]);

  // Fetch unread count 
  useEffect(() => {
    const initializeUnreadCount = async () => {
      try {
        const data = await queryClient.fetchQuery({
          queryKey: ['notifications-unread-count'],
          queryFn: async () => {
            const response = await api.get('/notification/', { params: { page: 1 } });
            return response.data;
          },
          staleTime: 30_000,
        });
        if (data?.unread_count !== undefined) {
          setUnreadCount(data.unread_count);
        }
      } catch (error) {
        console.error('[useNotifications] Failed to initialize unread count:', error);
      }
    };

    initializeUnreadCount();

    // Subscribe only to the infinite query pages to sync unread count after panel opens
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (
        event?.query.queryKey[0] === 'notifications-initial' &&
        event.type === 'updated'
      ) {
        const data = event.query.state.data as any;
        const firstPage = data?.pages?.[0];
        if (firstPage?.unread_count !== undefined) {
          setUnreadCount(firstPage.unread_count);
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