import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { usersApi, chatApi, gatewaySocket } from '@/services/api';
import type { ChatRoom, ChatMessage, ChatRoomMessagesResponse, ToastNotification, GatewayIncomingMessage, ProjectChatRoom, TeamChatRoom, User, OptimisticChatMessage } from '@/types';
import type { GatewayWebSocketService } from '@/services/api';

// Extended user type with last message info
export interface UserWithActivity extends User {
  lastMessageTime?: string;
  lastMessageContent?: string;
  isUnread?: boolean;
  activityTimestamp?: number;
}

export function useTeamChat() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const { projectId: urlProjectId, roomId: urlRoomId } = useParams<{ projectId: string; roomId: string; tab: string }>();
  const queryClient = useQueryClient();

  // ─── UI State ───
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [selectedProjectRoom, setSelectedProjectRoom] = useState<ProjectChatRoom | null>(null);
  const [selectedTeamRoom, setSelectedTeamRoom] = useState<TeamChatRoom | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [richHtmlContent, setRichHtmlContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviewUrls, setFilePreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | number | null>(null);
  const [openMenuMessageId, setOpenMenuMessageId] = useState<string | number | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | number | null>(null);
  const [messageReactions, setMessageReactions] = useState<Map<string | number, Map<string, number>>>(new Map());
  const menuRef = useRef<HTMLDivElement>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const dragCounter = useRef(0);
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticChatMessage[]>([]);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; fileName: string; fileType?: string } | null>(null);
  const [userPresence, setUserPresence] = useState<Map<number, 'online' | 'offline'>>(new Map());

  // ─── Unread Tracking & Notifications ───
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());
  const [toastNotifications, setToastNotifications] = useState<ToastNotification[]>([]);
  const [roomUserMap, setRoomUserMap] = useState<Map<string, number>>(new Map());
  const roomUserMapRef = useRef<Map<string, number>>(new Map());
  const [userRoomMap, setUserRoomMap] = useState<Map<number, string>>(new Map());
  const [lastMessages, setLastMessages] = useState<Map<number, { content: string; timestamp: string; isUnread: boolean }>>(new Map());
  const [chatListVersion, setChatListVersion] = useState(0);
  const [userLastActivity, setUserLastActivity] = useState<Map<number, number>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isPaginatingRef = useRef(false);

  // ─── Sidebar State 
  const [isCreateTeamModalOpen, setIsCreateTeamModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chats');
  const [headerView, setHeaderView] = useState<'chat' | 'shared'>('chat');
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showMemberList, setShowMemberList] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ─── WebSocket References
  const gatewaySocketRef = useRef<GatewayWebSocketService | null>(null);
  const isGatewayInitialized = useRef(false);
  const activeRoomRef = useRef<ChatRoom | null>(null);
  const selectedUserIdRef = useRef<number | null>(null);
  const justLeftRoomRef = useRef<string | null>(null);
  const justLeftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    selectedUserIdRef.current = selectedUserId;
  }, [selectedUserId]);

  // ─── Click outside for header menu 
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target as Node)) {
        setShowHeaderMenu(false);
      }
    };
    if (showHeaderMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showHeaderMenu]);

  // 1. Fetch Users List 
  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['team-chat-users'],
    queryFn: () => usersApi.list(),
  });

  // ─── 1b. Fetch Project Rooms
  const { data: projectRoomsData, isLoading: isLoadingProjects } = useQuery({
    queryKey: ['project-chat-rooms'],
    queryFn: () => chatApi.getProjectRooms(),
  });

  // 1c. Fetch Team Rooms 
  const { data: teamRoomsData, isLoading: isLoadingTeams } = useQuery({
    queryKey: ['team-chat-rooms'],
    queryFn: () => chatApi.getTeamRooms(),
  });

  // 1d. Fetch Private Rooms 
  const { data: privateRoomsData } = useQuery({
    queryKey: ['private-chat-rooms'],
    queryFn: () => chatApi.getPrivateRooms(),
    refetchOnMount: 'always',
  });

  // 1e. Fetch Initial Unread Counts 
  const { data: unreadData } = useQuery({
    queryKey: ['chat-unread-counts'],
    queryFn: () => chatApi.getUnreadCount(),
    refetchOnMount: 'always',
    staleTime: 0,
  });

  // Fetch room details for all rooms (favourite status) 
  const [roomDetailsLoaded, setRoomDetailsLoaded] = useState(false);

  useEffect(() => {
    const fetchAllRoomDetails = async () => {
      const allPromises: Promise<any>[] = [];

      if (privateRoomsData) {
        privateRoomsData.forEach((room: ChatRoom) => {
          allPromises.push(queryClient.fetchQuery({
            queryKey: ['chat-room-details', room.id],
            queryFn: () => chatApi.getRoomDetails(room.id),
            staleTime: 5 * 60 * 1000,
          }));
        });
      }

      if (projectRoomsData) {
        projectRoomsData.forEach((room: ProjectChatRoom) => {
          allPromises.push(queryClient.fetchQuery({
            queryKey: ['chat-room-details', room.id],
            queryFn: () => chatApi.getRoomDetails(room.id),
            staleTime: 5 * 60 * 1000,
          }));
        });
      }

      if (teamRoomsData) {
        teamRoomsData.forEach((room: TeamChatRoom) => {
          allPromises.push(queryClient.fetchQuery({
            queryKey: ['chat-room-details', room.id],
            queryFn: () => chatApi.getRoomDetails(room.id),
            staleTime: 5 * 60 * 1000,
          }));
        });
      }

      if (allPromises.length > 0) {
        await Promise.all(allPromises);
        setRoomDetailsLoaded(true);
        setChatListVersion(prev => prev + 1);
      }
    };

    if ((privateRoomsData || projectRoomsData || teamRoomsData) && !roomDetailsLoaded) {
      fetchAllRoomDetails();
    }
  }, [privateRoomsData, projectRoomsData, teamRoomsData, queryClient, roomDetailsLoaded]);

  // Auto-select project room from URL params (/team-chat/:projectId/:roomId)
  useEffect(() => {
    if (urlRoomId && urlProjectId && projectRoomsData && projectRoomsData.length > 0) {
      const matchedRoom = projectRoomsData.find(room => room.id === urlRoomId);
      if (matchedRoom) {
        if (selectedProjectRoom?.id === matchedRoom.id) return;
        setSelectedUserId(null);
        setSelectedTeamRoom(null);
        setActiveRoom(null);
        setSelectedProjectRoom(matchedRoom);
        activeRoomRef.current = { id: matchedRoom.id } as ChatRoom;
        queryClient.prefetchQuery({
          queryKey: ['chat-room-details', matchedRoom.id],
          queryFn: () => chatApi.getRoomDetails(matchedRoom.id),
        });
      }
    }
  }, [urlRoomId, urlProjectId, projectRoomsData]);

  // Auto-select team room from URL params (/team-chat/teams/:roomId)
  useEffect(() => {
    if (urlRoomId && !urlProjectId && teamRoomsData && teamRoomsData.length > 0) {
      const matchedRoom = teamRoomsData.find(room => room.id === urlRoomId);
      if (matchedRoom) {
        if (selectedTeamRoom?.id === matchedRoom.id) return;
        setSelectedUserId(null);
        setSelectedProjectRoom(null);
        setActiveRoom(null);
        setSelectedTeamRoom(matchedRoom);
        activeRoomRef.current = { id: matchedRoom.id } as ChatRoom;
        queryClient.prefetchQuery({
          queryKey: ['chat-room-details', matchedRoom.id],
          queryFn: () => chatApi.getRoomDetails(matchedRoom.id),
        });
      }
    }
  }, [urlRoomId, urlProjectId, teamRoomsData]);

  // Auto-select private room from URL params (/team-chat/chat/:roomId)
  useEffect(() => {
    if (!urlRoomId || urlProjectId) return;

    const activate = (matchedRoom: any) => {
      if (activeRoomRef.current?.id === matchedRoom.id) return;

      setSelectedTeamRoom(null);
      setSelectedProjectRoom(null);

      const otherUserId: number | undefined = matchedRoom.participants?.find(
        (id: number) => id !== currentUser?.id
      );

      setActiveRoom(matchedRoom as ChatRoom);
      activeRoomRef.current = matchedRoom as ChatRoom;
      (window as any).__activeTeamChatRoomId = matchedRoom.id;

      if (otherUserId) {
        setSelectedUserId(otherUserId);
        setRoomUserMap(prev => {
          const m = new Map(prev);
          m.set(matchedRoom.id, otherUserId);
          return m;
        });
        setUserRoomMap(prev => {
          const m = new Map(prev);
          m.set(otherUserId, matchedRoom.id);
          return m;
        });
        roomUserMapRef.current.set(matchedRoom.id, otherUserId);
      }

      queryClient.prefetchQuery({
        queryKey: ['chat-messages', matchedRoom.id],
        queryFn: () => chatApi.getRoomMessages(matchedRoom.id),
      });

      queryClient.prefetchQuery({
        queryKey: ['chat-room-details', matchedRoom.id],
        queryFn: () => chatApi.getRoomDetails(matchedRoom.id),
      });
    };

    // Try cache first
    if (privateRoomsData && privateRoomsData.length > 0) {
      const matchedRoom = (privateRoomsData as any[]).find((room: any) => room.id === urlRoomId);
      if (matchedRoom) {
        activate(matchedRoom);
        return;
      }
    }

    // Cache miss — fetch directly so switching between members always works
    chatApi.getRoomDetails(urlRoomId).then(room => {
      if (room) activate(room);
    }).catch(() => { });

  }, [urlRoomId, urlProjectId, privateRoomsData, currentUser?.id]);
  // Sort Teams by Last Message Time
  const teamRooms = useMemo(() => {
    if (!teamRoomsData) return [];
    return [...teamRoomsData].sort((a, b) => {
      const roomDetailsA = queryClient.getQueryData(['chat-room-details', a.id]) as ChatRoom | undefined;
      const roomDetailsB = queryClient.getQueryData(['chat-room-details', b.id]) as ChatRoom | undefined;
      const isFavouriteA = roomDetailsA?.current_user_membership?.is_favourite || false;
      const isFavouriteB = roomDetailsB?.current_user_membership?.is_favourite || false;

      if (isFavouriteA !== isFavouriteB) return isFavouriteA ? -1 : 1;

      let timeA = (a.last_message as any)?.created_at ? new Date((a.last_message as any).created_at).getTime() : 0;
      let timeB = (b.last_message as any)?.created_at ? new Date((b.last_message as any).created_at).getTime() : 0;

      if (unreadData?.by_room) {
        const unreadA = unreadData.by_room[a.id];
        const unreadB = unreadData.by_room[b.id];
        if (unreadA?.last_message_at) timeA = Math.max(timeA, new Date(unreadA.last_message_at).getTime());
        if (unreadB?.last_message_at) timeB = Math.max(timeB, new Date(unreadB.last_message_at).getTime());
      }

      if (timeA !== timeB) return timeB - timeA;
      return a.name.localeCompare(b.name);
    });
  }, [teamRoomsData, unreadData, queryClient, chatListVersion]);

  // Map AND Sort Project Rooms 
  const projectRooms = useMemo(() => {
    const normalized = (projectRoomsData || []).map(room => ({
      ...room,
      name: room.name || (room as any).project_name || (room as any).title || 'Unnamed Project'
    }));

    return normalized.sort((a, b) => {
      const roomDetailsA = queryClient.getQueryData(['chat-room-details', a.id]) as ChatRoom | undefined;
      const roomDetailsB = queryClient.getQueryData(['chat-room-details', b.id]) as ChatRoom | undefined;
      const isFavouriteA = roomDetailsA?.current_user_membership?.is_favourite || false;
      const isFavouriteB = roomDetailsB?.current_user_membership?.is_favourite || false;

      if (isFavouriteA !== isFavouriteB) return isFavouriteA ? -1 : 1;

      let timeA = a.last_message?.created_at ? new Date(a.last_message.created_at).getTime() : 0;
      let timeB = b.last_message?.created_at ? new Date(b.last_message.created_at).getTime() : 0;

      if (unreadData?.by_room) {
        const unreadA = unreadData.by_room[a.id];
        const unreadB = unreadData.by_room[b.id];
        if (unreadA?.last_message_at) timeA = Math.max(timeA, new Date(unreadA.last_message_at).getTime());
        if (unreadB?.last_message_at) timeB = Math.max(timeB, new Date(unreadB.last_message_at).getTime());
      }

      if (timeA !== timeB) return timeB - timeA;
      return a.name.localeCompare(b.name);
    });
  }, [projectRoomsData, unreadData, queryClient, chatListVersion]);

  // Sync Unread API data with local state & Map Private Rooms to Users
  useEffect(() => {
    if (unreadData?.by_room && usersData?.results && currentUser) {
      let updatesNeeded = false;
      const newUnreadMap = new Map(unreadCounts);
      const newRoomUserMap = new Map(roomUserMap);
      const newUserRoomMap = new Map(userRoomMap);
      const newLastMessages = new Map(lastMessages);

      Object.entries(unreadData.by_room).forEach(([roomId, data]) => {
        if (newUnreadMap.get(roomId) !== data.unread_count) {
          newUnreadMap.set(roomId, data.unread_count);
          updatesNeeded = true;
        }

        if (data.room_type === 'private' && data.name.startsWith('Chat: ')) {
          const names = data.name.replace('Chat: ', '').split(' & ');
          const otherUsername = names.find(n => n !== currentUser.username);
          if (otherUsername) {
            const user = usersData.results.find(u => u.username === otherUsername);
            if (user) {
              if (!newRoomUserMap.has(roomId)) {
                newRoomUserMap.set(roomId, user.id);
                newUserRoomMap.set(user.id, roomId);
                updatesNeeded = true;
              }
              if (data.unread_count > 0) {
                const prevMsg = newLastMessages.get(user.id);
                if (!prevMsg?.isUnread) {
                  newLastMessages.set(user.id, {
                    content: (prevMsg?.content || 'Unread messages').replace(/<[^>]*>/g, '').trim() || 'Unread messages',
                    timestamp: prevMsg?.timestamp || new Date().toISOString(),
                    isUnread: true
                  });
                  updatesNeeded = true;
                }
              }
            }
          }
        }
      });

      if (updatesNeeded) {
        setUnreadCounts(newUnreadMap);
        setRoomUserMap(newRoomUserMap);
        roomUserMapRef.current = newRoomUserMap;
        setUserRoomMap(newUserRoomMap);
        setLastMessages(newLastMessages);
        setChatListVersion(v => v + 1);
      }
    }
  }, [unreadData, usersData, currentUser]);

  // Sync Private Rooms data 
  useEffect(() => {
    if (privateRoomsData && currentUser && usersData?.results) {
      let updatesNeeded = false;
      const newRoomUserMap = new Map(roomUserMap);
      const newUserRoomMap = new Map(userRoomMap);
      const newLastMessages = new Map(lastMessages);

      privateRoomsData.forEach((room: any) => {
        if (room.room_type === 'private') {
          let otherUserId: number | undefined;
          if (room.participants && Array.isArray(room.participants)) {
            otherUserId = room.participants.find((id: number) => id !== currentUser.id);
          }
          if (otherUserId) {
            if (!newRoomUserMap.has(room.id)) {
              newRoomUserMap.set(room.id, otherUserId);
              newUserRoomMap.set(otherUserId, room.id);
              updatesNeeded = true;
            }
            if (room.last_message) {
              const currentMsg = newLastMessages.get(otherUserId);
              const roomTime = new Date(room.last_message.created_at).getTime();
              const existingTime = currentMsg ? new Date(currentMsg.timestamp).getTime() : 0;
              if (roomTime > existingTime) {
                newLastMessages.set(otherUserId, {
                  content: (room.last_message.content_preview || room.last_message.content || 'Sent a message').replace(/<[^>]*>/g, '').trim() || 'Sent a message',
                  timestamp: room.last_message.created_at,
                  isUnread: room.unread_count > 0
                });
                updatesNeeded = true;
              }
            }
          }
        }
      });

      if (updatesNeeded) {
        setRoomUserMap(newRoomUserMap);
        roomUserMapRef.current = newRoomUserMap;
        setUserRoomMap(newUserRoomMap);
        setLastMessages(newLastMessages);
      }
    }
  }, [privateRoomsData, currentUser, usersData]);

  // Subscribe to global presence map
  useEffect(() => {
    const currentMap = gatewaySocket.presenceMap;
    if (currentMap.size > 0) {
      setUserPresence(new Map(currentMap));
    }
    if (gatewaySocket.isConnected()) {
      gatewaySocket.requestOnlineUsers();
    }
    const unsubscribePresence = gatewaySocket.onPresenceUpdate((map) => {
      setUserPresence(new Map(map));
    });
    return () => { unsubscribePresence(); };
  }, []);

  //  Attach message handler to gateway WebSocket 
  useEffect(() => {
    if (!currentUser || isGatewayInitialized.current) return;

    isGatewayInitialized.current = true;
    const gateway = gatewaySocket;
    gatewaySocketRef.current = gateway;

    const handler = (data: GatewayIncomingMessage) => {
      if (data.type === 'GATEWAY_CONNECTED') return;
      if (data.type === 'PRESENCE') return;

      if (data.type === 'room_created') {
        const newRoom = data.room || (data as any).data;
        if (newRoom?.room_type === 'project') {
          queryClient.invalidateQueries({ queryKey: ['project-chat-rooms'], refetchType: 'active' });
        } else if (newRoom?.room_type === 'team') {
          queryClient.invalidateQueries({ queryKey: ['team-chat-rooms'], refetchType: 'active' });
        }
        return;
      }

      const message = (data as any).data;
      const actualRoomId = message?.room_id || message?.room;

      if (data.type === 'CHAT_MESSAGE' && message && actualRoomId) {
        const isOwnMessage = message.sender.id === currentUser?.id;

        const enrichedMessage: ChatMessage = {
          ...message,
          is_own_message: isOwnMessage,
          room: actualRoomId
        };

        let chatListUserId: number | null = null;
        if (isOwnMessage) {
          const roomData = queryClient.getQueryData<ChatRoom>(['chat-room', actualRoomId]);
          chatListUserId = roomData?.participants?.find(p => p.id !== currentUser?.id)?.id || null;
        } else {
          chatListUserId = enrichedMessage.sender.id;
        }

        if (chatListUserId) {
          const shouldMarkUnread = !isOwnMessage && selectedUserId !== chatListUserId;
          setLastMessages(prev => {
            const newMap = new Map(prev);
            newMap.set(chatListUserId!, {
              content: enrichedMessage.content.replace(/<[^>]*>/g, '').trim() || enrichedMessage.content,
              timestamp: enrichedMessage.created_at,
              isUnread: shouldMarkUnread
            });
            setChatListVersion(v => v + 1);
            return newMap;
          });
          setUserLastActivity(prev => {
            const newMap = new Map(prev);
            newMap.set(chatListUserId!, Date.now());
            return newMap;
          });
        }

        queryClient.setQueryData(['chat-messages', actualRoomId], (oldData: ChatRoomMessagesResponse | undefined) => {
          const existingMessages = oldData?.messages || [];
          const isDuplicate = existingMessages.some(m => m.id === enrichedMessage.id);
          if (isDuplicate) {
            console.warn('⚠️ [CACHE] Duplicate message detected, skipping:', enrichedMessage.id);
            return oldData;
          }
          const updatedMessages = [...existingMessages, enrichedMessage].sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          return {
            ...oldData,
            messages: updatedMessages,
            count: updatedMessages.length,
            has_more: oldData?.has_more ?? false
          };
        });

        if (isOwnMessage) {
          setOptimisticMessages(prev =>
            prev.filter(m =>
              !(m.room === actualRoomId &&
                m.optimisticStatus !== 'error' &&
                m.content === enrichedMessage.content &&
                m.message_type === enrichedMessage.message_type)
            )
          );
        }

        queryClient.invalidateQueries({ queryKey: ['chat-messages', actualRoomId], refetchType: 'none' });

        // setTimeout for verifying query state
        setTimeout(() => {
          queryClient.getQueryData<ChatRoomMessagesResponse>(['chat-messages', actualRoomId]);
        }, 100);

        // Check if this message's room is currently open in ANY of the three views
        const isActiveRoom =
          actualRoomId === activeRoomRef.current?.id ||
          // Also check the sender — if we have that user's chat open right now
          (!isOwnMessage && selectedUserIdRef.current === enrichedMessage.sender.id);

        if (!isActiveRoom) {
          setUnreadCounts(prev => {
            const newMap = new Map(prev);
            newMap.set(actualRoomId, (newMap.get(actualRoomId) || 0) + 1);
            return newMap;
          });

          // Keep sidebar unread list in sync without a full refetch — optimistically
          // bump the unread_count on the cached room entry so the list updates instantly.
          queryClient.setQueryData<import('@/types').ChatRoomListItem[]>(
            ['sidebar-all-chat-rooms'],
            (old) => {
              if (!old) return old;
              const exists = old.some(r => r.id === actualRoomId);
              if (exists) {
                return old.map(r =>
                  r.id === actualRoomId
                    ? { ...r, unread_count: (r.unread_count || 0) + 1 }
                    : r
                );
              }
              // Room not in cache yet — trigger a refetch to pull it in
              queryClient.invalidateQueries({ queryKey: ['sidebar-all-chat-rooms'] });
              return old;
            }
          );

          const toast: ToastNotification = {
            id: `${Date.now()}`,
            room_id: actualRoomId,
            sender_name: enrichedMessage.sender.full_name || enrichedMessage.sender.username,
            message_preview: enrichedMessage.content.replace(/<[^>]*>/g, '').trim() || enrichedMessage.content,
            timestamp: enrichedMessage.created_at
          };
          setToastNotifications(prev => [...prev, toast]);
        }
      }

      if (data.type === 'SIGNAL' && (data as any).event === 'CHAT_UNREAD_UPDATE') {
        const unreadDataSignal = (data as any).data;
        const roomId = unreadDataSignal.room_id;
        const roomUnread = unreadDataSignal.room_unread || 0;
        const isCurrentlyActiveRoom = roomId === activeRoomRef.current?.id;
        const justLeft = roomId === justLeftRoomRef.current;

        if (isCurrentlyActiveRoom || justLeft) {
          const userId = roomUserMapRef.current.get(roomId);
          if (userId) {
            setLastMessages(prev => {
              const newMap = new Map(prev);
              const existing = newMap.get(userId);
              if (existing?.isUnread) {
                newMap.set(userId, { ...existing, isUnread: false });
              }
              return newMap;
            });
          }
          return;
        }

        setUnreadCounts(prev => {
          const newMap = new Map(prev);
          newMap.set(roomId, roomUnread);
          return newMap;
        });

        const userId = roomUserMapRef.current.get(roomId);
        if (userId) {
          if (roomUnread > 0) {
            setLastMessages(prev => {
              const newMap = new Map(prev);
              const existing = newMap.get(userId);
              if (existing || newMap.has(userId)) {
                newMap.set(userId, {
                  content: existing?.content || 'Unread messages',
                  timestamp: existing?.timestamp || new Date().toISOString(),
                  isUnread: true
                });
              }
              return newMap;
            });
          }
        } else {
          queryClient.invalidateQueries({ queryKey: ['chat-unread-counts'] });
        }
        queryClient.setQueryData<import('@/types').ChatRoomListItem[]>(
          ['sidebar-all-chat-rooms'],
          (old) => {
            if (!old) {
              queryClient.invalidateQueries({ queryKey: ['sidebar-all-chat-rooms'] });
              return old;
            }
            const roomExists = old.some(r => r.id === roomId);
            if (!roomExists) {
              queryClient.invalidateQueries({ queryKey: ['sidebar-all-chat-rooms'] });
              return old;
            }
            return old.map(r =>
              r.id === roomId ? { ...r, unread_count: roomUnread } : r
            );
          }
        );
      }
    };

    gateway.onMessage(handler);

    return () => {
      gateway.offMessage(handler);
      isGatewayInitialized.current = false;
      gatewaySocketRef.current = null;
      (window as any).__activeTeamChatRoomId = undefined;
    };
  }, [currentUser?.id, queryClient]);

  // 3. Mutation: Create or Get Private Room 
  const createRoomMutation = useMutation({
    mutationFn: (userId: number) => chatApi.createPrivateRoom(userId),
    onSuccess: (roomData, userId) => {
      setActiveRoom(roomData);
      activeRoomRef.current = roomData;
      (window as any).__activeTeamChatRoomId = roomData.id;
      queryClient.setQueryData(['chat-room', roomData.id], roomData);

      queryClient.prefetchQuery({
        queryKey: ['chat-room-details', roomData.id],
        queryFn: () => chatApi.getRoomDetails(roomData.id),
      });

      setRoomUserMap(prev => {
        const newMap = new Map(prev);
        newMap.set(roomData.id, userId);
        return newMap;
      });
      setUserRoomMap(prev => {
        const newMap = new Map(prev);
        newMap.set(userId, roomData.id);
        return newMap;
      });

      // Update URL to include the room ID once we have it
      navigate(`/team-chat/chat/${roomData.id}`, { replace: true });
    },
    onError: (error) => {
      console.error('[ROOM ERROR] Failed to load chat room', error);
    }
  });

  // ─── 4. Fetch Messages 
  const { data: messagesData, isLoading: isLoadingMessages } = useQuery({
    queryKey: ['chat-messages', activeRoom?.id || selectedProjectRoom?.id || selectedTeamRoom?.id || urlRoomId],
    queryFn: async () => {
      const roomId = activeRoom?.id || selectedProjectRoom?.id || selectedTeamRoom?.id || urlRoomId;
      if (!roomId) {
        console.warn('⚠️ [MESSAGES QUERY] No roomId available, returning empty');
        return Promise.resolve({ messages: [], count: 0, has_more: false });
      }
      const messages = await chatApi.getRoomMessages(roomId);

      try {
        await chatApi.markAsRead(roomId);
        queryClient.invalidateQueries({ queryKey: ['chat-unread-counts'] });
        queryClient.setQueryData<import('@/types').ChatRoomListItem[]>(
          ['sidebar-all-chat-rooms'],
          (old) => old
            ? old.map(r => r.id === roomId ? { ...r, unread_count: 0 } : r)
            : old
        );

        setUnreadCounts(prev => {
          const newMap = new Map(prev);
          newMap.set(roomId, 0);
          return newMap;
        });

        const userId = roomUserMapRef.current.get(roomId);
        if (userId) {
          setLastMessages(prev => {
            const newMap = new Map(prev);
            const existing = newMap.get(userId);
            if (existing?.isUnread) {
              newMap.set(userId, { ...existing, isUnread: false });
            }
            return newMap;
          });
        }
      } catch (error) {
        console.error('Failed to mark messages as read:', error);
      }
      return messages;
    },
    enabled: !!(activeRoom || selectedProjectRoom || selectedTeamRoom || urlRoomId),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  // Debug log to see query state
  useEffect(() => {
  }, [messagesData, isLoadingMessages, activeRoom?.id, urlRoomId]);

  // ─── 5. Clear unread on room open 
  useEffect(() => {
    if (!activeRoom?.id) return;
    setUnreadCounts(prev => {
      const newMap = new Map(prev);
      newMap.delete(activeRoom.id);
      return newMap;
    });
  }, [activeRoom?.id]);

  //  Composed messages (confirmed + optimistic) 
  const messages = useMemo(() => {
    const confirmedMessages: OptimisticChatMessage[] = (messagesData?.messages || []).map(m => ({
      ...m,
      optimisticStatus: 'sent' as const,
    }));
    const currentRoomId = activeRoom?.id || selectedProjectRoom?.id || selectedTeamRoom?.id || urlRoomId;
    const confirmedIds = new Set(confirmedMessages.map(m => String(m.id)));
    const pendingOptimistic = optimisticMessages.filter(om =>
      om.room === currentRoomId && !confirmedIds.has(String(om.id))
    );
    return [...confirmedMessages, ...pendingOptimistic].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [messagesData?.messages, optimisticMessages, activeRoom?.id, selectedProjectRoom?.id, selectedTeamRoom?.id, urlRoomId]);

  // Load More (Pagination) 
  const handleLoadMore = async () => {
    const roomId = activeRoom?.id || selectedProjectRoom?.id || selectedTeamRoom?.id || urlRoomId;
    if (!roomId || !messagesData?.has_more || isFetchingMore || !messagesData.messages.length) return;

    const sortedMessages = [...messagesData.messages].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const oldestMessage = sortedMessages[0];

    setIsFetchingMore(true);
    isPaginatingRef.current = true;

    const container = scrollContainerRef.current;
    const previousScrollHeight = container?.scrollHeight || 0;
    const previousScrollTop = container?.scrollTop || 0;

    try {
      const olderMessagesData = await chatApi.getRoomMessages(roomId, {
        before: oldestMessage.id.toString(),
        limit: 50
      });

      queryClient.setQueryData(['chat-messages', roomId], (oldData: ChatRoomMessagesResponse | undefined) => {
        if (!oldData) return olderMessagesData;
        const existingIds = new Set(oldData.messages.map(m => String(m.id)));
        const uniqueOlderMessages = olderMessagesData.messages.filter(m => !existingIds.has(String(m.id)));
        return {
          ...oldData,
          messages: [...uniqueOlderMessages, ...oldData.messages],
          has_more: olderMessagesData.has_more,
          count: oldData.messages.length + uniqueOlderMessages.length
        };
      });

      setTimeout(() => {
        if (scrollContainerRef.current) {
          const newScrollHeight = scrollContainerRef.current.scrollHeight;
          scrollContainerRef.current.scrollTop = (newScrollHeight - previousScrollHeight) + previousScrollTop;
        }
      }, 50);
    } catch (error) {
      console.error('Failed to load older messages:', error);
    } finally {
      setIsFetchingMore(false);
      setTimeout(() => { isPaginatingRef.current = false; }, 150);
    }
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    if (scrollContainerRef.current.scrollTop <= 5) {
      if (messagesData?.has_more && !isFetchingMore && !isPaginatingRef.current) {
        handleLoadMore();
      }
    }
  };

  //  Debug effects 
  useEffect(() => { }, [messages]);
  useEffect(() => { }, [activeRoom, selectedProjectRoom, selectedTeamRoom, selectedUserId]);

  //  Users 
  const users = useMemo(() => {
    if (!usersData?.results) return [];
    return usersData.results.filter(u => u.id !== currentUser?.id && u.is_active);
  }, [usersData, currentUser?.id]);

  const usersWithActivity = useMemo((): UserWithActivity[] => {
    return users.map(user => {
      const lastMsg = lastMessages.get(user.id);
      return {
        ...user,
        lastMessageTime: lastMsg?.timestamp,
        lastMessageContent: lastMsg?.content,
        isUnread: lastMsg?.isUnread || false,
        activityTimestamp: userLastActivity.get(user.id) || 0
      } as UserWithActivity;
    });
  }, [users, lastMessages, userLastActivity]);

  const sortedUsers = useMemo(() => {
    return [...usersWithActivity].sort((a, b) => {
      const roomA = userRoomMap.get(a.id);
      const roomB = userRoomMap.get(b.id);

      const roomDetailsA = roomA ? (queryClient.getQueryData(['chat-room-details', roomA]) as ChatRoom | undefined) : undefined;
      const roomDetailsB = roomB ? (queryClient.getQueryData(['chat-room-details', roomB]) as ChatRoom | undefined) : undefined;
      const isFavouriteA = roomDetailsA?.current_user_membership?.is_favourite || false;
      const isFavouriteB = roomDetailsB?.current_user_membership?.is_favourite || false;

      if (isFavouriteA !== isFavouriteB) return isFavouriteA ? -1 : 1;

      const unreadA = roomA ? (unreadCounts.get(roomA) || 0) : 0;
      const unreadB = roomB ? (unreadCounts.get(roomB) || 0) : 0;
      if (unreadA !== unreadB) return unreadB - unreadA;

      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      const activityA = (a as any).activityTimestamp || 0;
      const activityB = (b as any).activityTimestamp || 0;
      const latestA = Math.max(timeA, activityA);
      const latestB = Math.max(timeB, activityB);
      if (latestA !== latestB) return latestB - latestA;

      const nameA = a.first_name || a.username;
      const nameB = b.first_name || b.username;
      return nameA.localeCompare(nameB);
    });
  }, [usersWithActivity, unreadCounts, userRoomMap, chatListVersion, userLastActivity, queryClient]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return sortedUsers;
    return sortedUsers.filter(user =>
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [sortedUsers, searchQuery]);

  const selectedUser = users.find(u => u.id === selectedUserId);

  const getUserUnreadCount = (userId: number): number => {
    const roomId = userRoomMap.get(userId);
    return roomId ? (unreadCounts.get(roomId) || 0) : 0;
  };

  const hasUnreadMessages = (userId: number): boolean => {
    return getUserUnreadCount(userId) > 0;
  };

  const unreadUsers = useMemo(() => {
    return filteredUsers.filter(user => {
      const unreadCount = getUserUnreadCount(user.id);
      return (user as any).isUnread || unreadCount > 0;
    });
  }, [filteredUsers, chatListVersion, unreadCounts]);

  // All Unread Items (Chats + Projects + Teams)
  const allUnreadItems = useMemo(() => {
    const chatItems = unreadUsers.map(user => ({
      type: 'chat' as const,
      id: String(user.id),
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
      avatar: (((user.first_name?.charAt(0) || '') + (user.last_name?.charAt(0) || '')).toUpperCase() || user.username.charAt(0).toUpperCase()),
      avatarClass: 'bg-blue-100 text-blue-700 rounded-full',
      preview: (user.lastMessageContent || 'No messages yet').replace(/<[^>]*>/g, '').trim(),
      unreadCount: getUserUnreadCount(user.id),
      onClick: () => handleUserSelect(user.id),
      isSelected: selectedUserId === user.id,
    }));

    const projectItems = projectRooms
      .filter(p => (unreadCounts.get(p.id) || 0) > 0)
      .map(p => ({
        type: 'project' as const,
        id: p.id,
        name: p.name,
        avatar: p.name.charAt(0).toUpperCase(),
        avatarClass: 'bg-purple-100 text-purple-700 rounded',
        preview: (p.last_message?.content_preview || 'No messages yet').replace(/<[^>]*>/g, '').trim(),
        unreadCount: unreadCounts.get(p.id) || 0,
        onClick: () => handleProjectClick(p),
        isSelected: selectedProjectRoom?.id === p.id,
      }));

    const teamItems = teamRooms
      .filter(t => (unreadCounts.get(t.id) || 0) > 0)
      .map(t => {
        const lastMsg = (t.last_message as any);
        const preview = lastMsg ? (lastMsg.content_preview || lastMsg.content || '').replace(/<[^>]*>/g, '').trim() || 'Sent a message' : 'No messages yet';
        return {
          type: 'team' as const,
          id: t.id,
          name: t.name,
          avatar: t.name.charAt(0).toUpperCase(),
          avatarClass: 'bg-green-100 text-green-700 rounded',
          preview,
          unreadCount: unreadCounts.get(t.id) || 0,
          onClick: () => handleTeamClick(t),
          isSelected: selectedTeamRoom?.id === t.id,
        };
      });

    return [...chatItems, ...projectItems, ...teamItems];
  }, [unreadUsers, projectRooms, teamRooms, unreadCounts, selectedUserId, selectedProjectRoom, selectedTeamRoom, chatListVersion]);

  // Tab Unread Counts 
  const tabUnreadCounts = useMemo(() => {
    const chats = sortedUsers.reduce((sum, user) => {
      const roomId = userRoomMap.get(user.id);
      return sum + (roomId ? (unreadCounts.get(roomId) || 0) : 0);
    }, 0);
    const projects = projectRooms.reduce((sum, project) => sum + (unreadCounts.get(project.id) || 0), 0);
    const teams = teamRooms.reduce((sum, team) => sum + (unreadCounts.get(team.id) || 0), 0);
    const unread = chats + projects + teams;
    return { chats, projects, teams, unread };
  }, [sortedUsers, projectRooms, teamRooms, unreadCounts, userRoomMap, chatListVersion]);

  //  Shared Documents 
  const sharedDocuments = useMemo(() => {
    return messages.filter(msg => msg.attachment).map(msg => ({
      id: msg.id,
      name: msg.attachment_name || 'Attachment',
      url: msg.attachment!,
      sender: msg.sender,
      created_at: msg.created_at,
    }));
  }, [messages]);

  // ─── Selection Handlers ───────────────────────────────────────────────────
  const handleUserSelect = (userId: number) => {
    if (selectedUserId === userId) return;
    const leavingRoomId = selectedUserId ? userRoomMap.get(selectedUserId) : null;
    if (leavingRoomId) {
      justLeftRoomRef.current = leavingRoomId;
      if (justLeftTimerRef.current) clearTimeout(justLeftTimerRef.current);
      justLeftTimerRef.current = setTimeout(() => {
        justLeftRoomRef.current = null;
      }, 3000); // suppress unread signals for 3s after leaving
    }
    setSelectedProjectRoom(null);
    setSelectedTeamRoom(null);
    setSelectedUserId(userId);

    setLastMessages(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(userId);
      if (existing) newMap.set(userId, { ...existing, isUnread: false });
      return newMap;
    });

    const existingRoomId = userRoomMap.get(userId);
    if (existingRoomId) {
      // ✅ FIX: Room already exists - fetch it and set as active BEFORE navigating
      queryClient.fetchQuery({
        queryKey: ['chat-room', existingRoomId],
        queryFn: () => chatApi.getRoomDetails(existingRoomId),
      }).then((roomData) => {
        setActiveRoom(roomData);
        activeRoomRef.current = roomData;
        (window as any).__activeTeamChatRoomId = roomData.id;
      });

      navigate(`/team-chat/chat/${existingRoomId}`);

      setUnreadCounts(prev => {
        const newMap = new Map(prev);
        newMap.set(existingRoomId, 0);
        return newMap;
      });
    } else {
      // ✅ Room doesn't exist yet - create it (onSuccess will set activeRoom)
      navigate('/team-chat/chat');
      createRoomMutation.mutate(userId);
    }
  };

  const handleProjectClick = async (projectRoom: ProjectChatRoom) => {
    setSelectedUserId(null);
    setSelectedTeamRoom(null);
    setActiveRoom(null);
    setSelectedProjectRoom(projectRoom);
    activeRoomRef.current = { id: projectRoom.id } as ChatRoom;

    setUnreadCounts(prev => {
      const newMap = new Map(prev);
      newMap.set(projectRoom.id, 0);
      return newMap;
    });

    queryClient.prefetchQuery({
      queryKey: ['chat-room-details', projectRoom.id],
      queryFn: () => chatApi.getRoomDetails(projectRoom.id),
    });

    const projectId = (projectRoom as any).project_id ?? (projectRoom as any).project ?? '';
    if (projectId) navigate(`/team-chat/${projectId}/${projectRoom.id}`);
  };

  const handleTeamClick = async (teamRoom: TeamChatRoom) => {
    navigate(`/team-chat/teams/${teamRoom.id}`);
    setSelectedUserId(null);
    setSelectedProjectRoom(null);
    setActiveRoom(null);
    setSelectedTeamRoom(teamRoom);
    activeRoomRef.current = { id: teamRoom.id } as ChatRoom;

    setUnreadCounts(prev => {
      const newMap = new Map(prev);
      newMap.set(teamRoom.id, 0);
      return newMap;
    });

    queryClient.prefetchQuery({
      queryKey: ['chat-room-details', teamRoom.id],
      queryFn: () => chatApi.getRoomDetails(teamRoom.id),
    });
  };

  //  Message Actions 
  const handleQuickReaction = (messageId: string | number, emoji: string) => {
    setMessageReactions(prev => {
      const newMap = new Map(prev);
      const messageReactionMap = newMap.get(messageId) || new Map();
      const currentCount = messageReactionMap.get(emoji) || 0;
      messageReactionMap.set(emoji, currentCount + 1);
      newMap.set(messageId, messageReactionMap);
      return newMap;
    });
  };

  const handleReplyWithQuote = (message: ChatMessage) => {
    const plainPreview = message.content.replace(/<[^>]*>/g, '').trim().slice(0, 120);
    const quoteHtml = `<blockquote>${plainPreview}</blockquote><p></p>`;
    setRichHtmlContent(quoteHtml);
    setMessageInput(plainPreview);
    setOpenMenuMessageId(null);
  };

  const handleForward = (_message: ChatMessage) => { setOpenMenuMessageId(null); };
  const handleCopyLink = (_message: ChatMessage) => { setOpenMenuMessageId(null); };
  const handleSaveMessage = (_message: ChatMessage) => { setOpenMenuMessageId(null); };
  const handlePinMessage = (_message: ChatMessage) => { setOpenMenuMessageId(null); };
  const handleMarkAsUnread = (_message: ChatMessage) => { setOpenMenuMessageId(null); };

  const handleDeleteMessage = (messageId: string | number) => {
    if (!activeRoom?.id) return;
    deleteMessageMutation.mutate({ roomId: activeRoom.id, messageId: String(messageId) });
  };

  //  Click outside for message menu 
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuMessageId(null);
        setShowReactionPicker(null);
      }
    };
    if (openMenuMessageId || showReactionPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => { document.removeEventListener('mousedown', handleClickOutside); };
  }, [openMenuMessageId, showReactionPicker]);

  // File Handling 
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) processFiles(files);
  };

  const processFiles = (files: File[]) => {
    setSelectedFiles(prev => [...prev, ...files]);
    const newUrls = files.map(file => {
      if (file.type.startsWith('image/')) return URL.createObjectURL(file);
      return null;
    }).filter(Boolean) as string[];
    if (newUrls.length > 0) setFilePreviewUrls(prev => [...prev, ...newUrls]);
  };

  const handleAttachmentClick = () => { fileInputRef.current?.click(); };

  // ─── Drag & Drop 
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) processFiles(Array.from(files));
  };

  //  Auto-scroll to bottom
  useEffect(() => {
    if (isPaginatingRef.current) return;
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages]);

  //  Cleanup preview URLs 
  useEffect(() => {
    return () => {
      filePreviewUrls.forEach(url => { if (url) URL.revokeObjectURL(url); });
    };
  }, [filePreviewUrls]);

  // ─── Optimistic Message Builder ───────────────────────────────────────────
  const buildOptimisticMessage = (
    roomId: string,
    content: string,
    tempId: string,
    file?: File | null
  ): OptimisticChatMessage => ({
    id: tempId,
    room: roomId,
    sender: {
      id: currentUser!.id,
      username: currentUser!.username,
      full_name: `${currentUser!.first_name} ${currentUser!.last_name}`.trim() || currentUser!.username,
      email: currentUser!.email,
    },
    content,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_own_message: true,
    message_type: file ? 'file' : 'text',
    attachment: file ? URL.createObjectURL(file) : null,
    attachment_name: file ? file.name : '',
    reply_to: null,
    reply_to_preview: null,
    is_deleted: false,
    optimisticStatus: 'sending',
    optimisticId: tempId,
  });

  // Retry Failed Message 
  const handleRetryMessage = async (optimisticMsg: OptimisticChatMessage) => {
    const roomId = optimisticMsg.room;

    setOptimisticMessages(prev =>
      prev.map(m => m.optimisticId === optimisticMsg.optimisticId ? { ...m, optimisticStatus: 'sending' } : m)
    );

    try {
      if (optimisticMsg.message_type === 'file' && optimisticMsg.attachment) {
        setOptimisticMessages(prev => prev.filter(m => m.optimisticId !== optimisticMsg.optimisticId));
        return;
      }
      const gs = gatewaySocketRef.current;
      if (gs) {
        gs.sendMessage(roomId, optimisticMsg.content);
        setTimeout(() => {
          setOptimisticMessages(prev =>
            prev.map(m => m.optimisticId === optimisticMsg.optimisticId ? { ...m, optimisticStatus: 'sent' } : m)
          );
        }, 5000);
      }
    } catch {
      setOptimisticMessages(prev =>
        prev.map(m => m.optimisticId === optimisticMsg.optimisticId ? { ...m, optimisticStatus: 'error' } : m)
      );
    }
  };

  // ─── Send Message ─────────────────────────────────────────────────────────
  const handleSendMessage = async () => {
    if (isUploadingFile) return;

    const content = richHtmlContent && richHtmlContent !== '<p></p>' ? richHtmlContent : messageInput.trim();
    const hasFiles = selectedFiles.length > 0;
    if (!content && !hasFiles) return;

    const roomId = selectedProjectRoom?.id || selectedTeamRoom?.id || activeRoom?.id || urlRoomId;

    if (hasFiles && roomId) {
      const tempIds: string[] = [];
      const optimisticMsgs: OptimisticChatMessage[] = [];

      selectedFiles.forEach((file, index) => {
        const tempId = `optimistic-${Date.now()}-${Math.random()}`;
        tempIds.push(tempId);
        const msgContent = index === 0 ? content : '';
        optimisticMsgs.push(buildOptimisticMessage(roomId, msgContent, tempId, file));
      });

      setOptimisticMessages(prev => [...prev, ...optimisticMsgs]);
      setMessageInput('');
      setRichHtmlContent('');

      const capturedFiles = [...selectedFiles];
      setSelectedFiles([]);
      filePreviewUrls.forEach(url => { if (url) URL.revokeObjectURL(url); });
      setFilePreviewUrls([]);
      if (fileInputRef.current) fileInputRef.current.value = '';

      try {
        setIsUploadingFile(true);
        const uploadPromises = capturedFiles.map((file, index) => {
          const msgContent = index === 0 ? content : '';
          return chatApi.sendMessageWithAttachment(roomId, { content: msgContent, attachment: file });
        });

        const responses = await Promise.all(uploadPromises);

        queryClient.setQueryData(['chat-messages', roomId], (oldData: ChatRoomMessagesResponse | undefined) => {
          const existingMessages = oldData?.messages || [];
          let updatedMessages = [...existingMessages];
          responses.forEach(response => {
            const isDuplicate = updatedMessages.some(m => m.id === response.id);
            if (!isDuplicate) updatedMessages.push(response);
          });
          updatedMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          return {
            ...oldData,
            messages: updatedMessages,
            count: updatedMessages.length,
            has_more: oldData?.has_more ?? false,
          };
        });

        setOptimisticMessages(prev => prev.filter(m => !tempIds.includes(m.optimisticId!)));
        queryClient.invalidateQueries({ queryKey: ['chat-messages', roomId], refetchType: 'active' });
      } catch (error) {
        console.error('❌ [SEND ERROR] Failed to send message with attachment:', error);
        setOptimisticMessages(prev =>
          prev.map(m => tempIds.includes(m.optimisticId!) ? { ...m, optimisticStatus: 'error' } : m)
        );
      } finally {
        setIsUploadingFile(false);
      }
      return;
    }

    if (!roomId) {
      console.error('❌ [SEND ERROR] No active room');
      return;
    }

    const tempId = `optimistic-${Date.now()}-${Math.random()}`;
    const optimisticMsg = buildOptimisticMessage(roomId, content, tempId);

    setOptimisticMessages(prev => [...prev, optimisticMsg]);
    setMessageInput('');
    setRichHtmlContent('');

    const sendViaWebSocket = () => {
      if (selectedProjectRoom && gatewaySocketRef.current) {
        gatewaySocketRef.current.sendMessage(selectedProjectRoom.id, content);
        return true;
      }
      if (selectedTeamRoom && gatewaySocketRef.current) {
        gatewaySocketRef.current.sendMessage(selectedTeamRoom.id, content);
        return true;
      }
      if (activeRoom && gatewaySocketRef.current) {
        gatewaySocketRef.current.sendMessage(activeRoom.id, content);
        return true;
      }
      return false;
    };

    const sent = sendViaWebSocket();
    if (!sent) {
      console.error('❌ [SEND ERROR] No active Gateway WebSocket connection');
      setOptimisticMessages(prev =>
        prev.map(m => m.optimisticId === tempId ? { ...m, optimisticStatus: 'error' } : m)
      );
      return;
    }

    setTimeout(() => {
      setOptimisticMessages(prev => {
        const still = prev.find(m => m.optimisticId === tempId);
        if (still && still.optimisticStatus === 'sending') {
          return prev.map(m => m.optimisticId === tempId ? { ...m, optimisticStatus: 'error' } : m);
        }
        return prev;
      });
    }, 10000);
  };

  //  Delete Message Mutation 
  const deleteMessageMutation = useMutation({
    mutationFn: ({ roomId, messageId }: { roomId: string; messageId: string }) =>
      chatApi.deleteMessage(roomId, messageId),
    onSuccess: (_, { roomId, messageId }) => {
      queryClient.setQueryData(['chat-messages', roomId], (oldData: ChatRoomMessagesResponse | undefined) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          messages: oldData.messages.filter(msg => msg.id !== messageId),
          count: oldData.count - 1,
        };
      });
      setOpenMenuMessageId(null);
    },
    onError: (error) => {
      console.error('Failed to delete message:', error);
      alert('Failed to delete message. Please try again.');
    },
  });

  // Toggle Favourite Mutation
  const toggleFavouriteMutation = useMutation({
    mutationFn: ({ roomId, isFavourite }: { roomId: string; isFavourite: boolean }) =>
      chatApi.updateRoomSettings(roomId, { is_favourite: isFavourite }),
    onSuccess: async (_response, { roomId }) => {
      const updatedRoomDetails = await chatApi.getRoomDetails(roomId);
      queryClient.setQueryData(['chat-room-details', roomId], updatedRoomDetails);
      queryClient.invalidateQueries({ queryKey: ['private-chat-rooms'] });
      queryClient.invalidateQueries({ queryKey: ['project-chat-rooms'] });
      queryClient.invalidateQueries({ queryKey: ['team-chat-rooms'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-all-chat-rooms'] });
      setChatListVersion(prev => prev + 1);
      setShowHeaderMenu(false);
    },
    onError: (error) => {
      console.error('Failed to update favourite status:', error);
      alert('Failed to update favourite status. Please try again.');
    },
  });

  //  Dismiss Toast 
  const dismissToast = (toastId: string) => {
    setToastNotifications(prev => prev.filter(t => t.id !== toastId));
  };

  return {
    // Auth
    currentUser,
    queryClient,
    // Selection
    selectedUserId,
    activeRoom,
    selectedProjectRoom,
    selectedTeamRoom,
    selectedUser,
    // Input
    messageInput,
    setMessageInput,
    richHtmlContent,
    setRichHtmlContent,
    // Search
    searchQuery,
    setSearchQuery,
    // Files
    selectedFiles,
    setSelectedFiles,
    filePreviewUrls,
    setFilePreviewUrls,
    fileInputRef,
    // UI flags
    hoveredMessageId,
    setHoveredMessageId,
    openMenuMessageId,
    setOpenMenuMessageId,
    showReactionPicker,
    setShowReactionPicker,
    messageReactions,
    menuRef,
    isUploadingFile,
    isDragging,
    isFetchingMore,
    // Optimistic
    optimisticMessages,
    // Doc preview
    previewDoc,
    setPreviewDoc,
    // Presence
    userPresence,
    // Unread
    unreadCounts,
    toastNotifications,
    roomUserMap,
    userRoomMap,
    lastMessages,
    // Sidebar
    isCreateTeamModalOpen,
    setIsCreateTeamModalOpen,
    activeTab,
    setActiveTab,
    headerView,
    setHeaderView,
    showHeaderMenu,
    setShowHeaderMenu,
    showMemberList,
    setShowMemberList,
    headerMenuRef,
    // Refs
    messagesEndRef,
    scrollContainerRef,
    // Loading states
    isLoadingUsers,
    isLoadingProjects,
    isLoadingTeams,
    isLoadingMessages,
    // Data
    users,
    filteredUsers,
    sortedUsers,
    projectRooms,
    teamRooms,
    messages,
    messagesData,
    sharedDocuments,
    allUnreadItems,
    tabUnreadCounts,
    // Helpers
    getUserUnreadCount,
    hasUnreadMessages,
    // Handlers
    handleUserSelect,
    handleProjectClick,
    handleTeamClick,
    handleSendMessage,
    handleLoadMore,
    handleScroll,
    handleFileSelect,
    handleAttachmentClick,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleQuickReaction,
    handleReplyWithQuote,
    handleForward,
    handleCopyLink,
    handleSaveMessage,
    handlePinMessage,
    handleMarkAsUnread,
    handleDeleteMessage,
    handleRetryMessage,
    dismissToast,
    // Mutations
    toggleFavouriteMutation,
    deleteMessageMutation,
  };
}