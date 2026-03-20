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

      // Update unread count from WebSocket notification
      if (notification.unread_count !== undefined) {
        setUnreadCount(notification.unread_count);
      }

      // Force refetch with resetQueries to ensure fresh data
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