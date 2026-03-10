import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Tabs from '@radix-ui/react-tabs';
import {
  MessageSquare, Search, Plus, X, Users as UsersIcon, Paperclip, Smile,
  MoreVertical, Reply, Forward, Link2, Bookmark, Trash2, Pin, MailOpen, PinOff, Loader2, AlertCircle, RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { usersApi, chatApi, GatewayWebSocketService } from '@/services/api';
import type { ChatRoom, ChatMessage, ChatRoomMessagesResponse, ToastNotification, GatewayIncomingMessage, ProjectChatRoom, TeamChatRoom, User, OptimisticChatMessage } from '@/types';
import { CreateTeamModal } from '@/pages/TeamManagement/Createteammodal';
import { ChatMessageInput } from '@/components/common/RichTextEditor';
import { DocumentThumbnail, DocumentPreview } from '@/components/common/DocumentPreview';

// Extended user type with last message info
interface UserWithActivity extends User {
  lastMessageTime?: string;
  lastMessageContent?: string;
  isUnread?: boolean;
  activityTimestamp?: number;
}

function MemberListContent({ roomId, roomType }: { roomId: string; roomType: 'team' | 'project' }) {
  const { data: roomDetails, isLoading } = useQuery({
    queryKey: ['chat-room-details', roomId],
    queryFn: () => chatApi.getRoomDetails(roomId),
    enabled: !!roomId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const members = roomDetails?.memberships || [];

  if (members.length === 0) {
    return (
      <div className="text-center py-8">
        <UsersIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No members found</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {members.map((member) => (
        <div
          key={member.user.id}
          className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 transition-colors"
        >
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center font-semibold text-white text-xs flex-shrink-0">
            {member.user.full_name?.charAt(0).toUpperCase() || member.user.username.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">
              {member.user.full_name || member.user.username}
            </p>
            <p className="text-[10px] text-gray-500 truncate">
              {member.user.email}
            </p>
          </div>
          {member.room_role && member.room_role !== 'member' && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded">
              {member.room_role}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function TeamChatModern() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const { projectId: urlProjectId, roomId: urlRoomId } = useParams<{ projectId: string; roomId: string }>();
  const queryClient = useQueryClient();


  // UI State
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [selectedProjectRoom, setSelectedProjectRoom] = useState<ProjectChatRoom | null>(null);
  const [selectedTeamRoom, setSelectedTeamRoom] = useState<TeamChatRoom | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [richHtmlContent, setRichHtmlContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | number | null>(null);
  const [openMenuMessageId, setOpenMenuMessageId] = useState<string | number | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | number | null>(null);
  const [messageReactions, setMessageReactions] = useState<Map<string | number, Map<string, number>>>(new Map());
  const menuRef = useRef<HTMLDivElement>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticChatMessage[]>([]);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; fileName: string; fileType?: string } | null>(null);

  // Unread tracking & notifications
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());
  const [toastNotifications, setToastNotifications] = useState<ToastNotification[]>([]);
  const [roomUserMap, setRoomUserMap] = useState<Map<string, number>>(new Map());
  const roomUserMapRef = useRef<Map<string, number>>(new Map());
  const [userRoomMap, setUserRoomMap] = useState<Map<number, string>>(new Map());

  const [lastMessages, setLastMessages] = useState<Map<number, { content: string; timestamp: string; isUnread: boolean }>>(new Map());
  const [chatListVersion, setChatListVersion] = useState(0);
  const [userLastActivity, setUserLastActivity] = useState<Map<number, number>>(new Map());

  // Sidebar section states
  const [isCreateTeamModalOpen, setIsCreateTeamModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chats');
  const [headerView, setHeaderView] = useState<'chat' | 'shared'>('chat');
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showMemberList, setShowMemberList] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // WebSocket References
  const gatewaySocketRef = useRef<GatewayWebSocketService | null>(null);
  const isGatewayInitialized = useRef(false);
  const activeRoomRef = useRef<ChatRoom | null>(null);

  // Click outside handler for header menu
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

  // 1b. Fetch Project Rooms
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

  // Fetch room details for all rooms to get favourite status on initial load
  const [roomDetailsLoaded, setRoomDetailsLoaded] = useState(false);

  useEffect(() => {
    const fetchAllRoomDetails = async () => {
      const allPromises: Promise<any>[] = [];

      // Fetch private room details
      if (privateRoomsData) {
        privateRoomsData.forEach((room: ChatRoom) => {
          const promise = queryClient.fetchQuery({
            queryKey: ['chat-room-details', room.id],
            queryFn: () => chatApi.getRoomDetails(room.id),
            staleTime: 5 * 60 * 1000,
          });
          allPromises.push(promise);
        });
      }

      // Fetch project room details
      if (projectRoomsData) {
        projectRoomsData.forEach((room: ProjectChatRoom) => {
          const promise = queryClient.fetchQuery({
            queryKey: ['chat-room-details', room.id],
            queryFn: () => chatApi.getRoomDetails(room.id),
            staleTime: 5 * 60 * 1000,
          });
          allPromises.push(promise);
        });
      }

      // Fetch team room details
      if (teamRoomsData) {
        teamRoomsData.forEach((room: TeamChatRoom) => {
          const promise = queryClient.fetchQuery({
            queryKey: ['chat-room-details', room.id],
            queryFn: () => chatApi.getRoomDetails(room.id),
            staleTime: 5 * 60 * 1000,
          });
          allPromises.push(promise);
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

  // Auto-select project room from URL params
  useEffect(() => {
    if (urlRoomId && projectRoomsData && projectRoomsData.length > 0 && !selectedProjectRoom) {
      const matchedRoom = projectRoomsData.find(room => room.id === urlRoomId);
      if (matchedRoom) {
        setSelectedUserId(null);
        setSelectedTeamRoom(null);
        setActiveRoom(null);
        setSelectedProjectRoom(matchedRoom);
        activeRoomRef.current = { id: matchedRoom.id } as ChatRoom;
        queryClient.prefetchQuery({
          queryKey: ['chat-room-details', matchedRoom.id],
          queryFn: () => chatApi.getRoomDetails(matchedRoom.id),
        });
        queryClient.invalidateQueries({ queryKey: ['chat-messages', matchedRoom.id] });
      }
    }
  }, [urlRoomId, projectRoomsData]);

  // Sort Teams by Last Message Time 
  const teamRooms = useMemo(() => {
    if (!teamRoomsData) return [];
    return [...teamRoomsData].sort((a, b) => {
      const roomDetailsA = queryClient.getQueryData(['chat-room-details', a.id]) as ChatRoom | undefined;
      const roomDetailsB = queryClient.getQueryData(['chat-room-details', b.id]) as ChatRoom | undefined;
      const isFavouriteA = roomDetailsA?.current_user_membership?.is_favourite || false;
      const isFavouriteB = roomDetailsB?.current_user_membership?.is_favourite || false;

      if (isFavouriteA !== isFavouriteB) {
        return isFavouriteA ? -1 : 1;
      }

      // 1. Get timestamp from Room object
      let timeA = (a.last_message as any)?.created_at ? new Date((a.last_message as any).created_at).getTime() : 0;
      let timeB = (b.last_message as any)?.created_at ? new Date((b.last_message as any).created_at).getTime() : 0;

      // 2. Check if Unread API has fresher data
      if (unreadData?.by_room) {
        const unreadA = unreadData.by_room[a.id];
        const unreadB = unreadData.by_room[b.id];

        if (unreadA?.last_message_at) {
          timeA = Math.max(timeA, new Date(unreadA.last_message_at).getTime());
        }
        if (unreadB?.last_message_at) {
          timeB = Math.max(timeB, new Date(unreadB.last_message_at).getTime());
        }
      }
      // Sort Descending (Newest first)
      if (timeA !== timeB) return timeB - timeA;
      return a.name.localeCompare(b.name);
    });
  }, [teamRoomsData, unreadData, queryClient, chatListVersion]);

  // Map AND Sort Project rooms by Last Message Time
  const projectRooms = useMemo(() => {
    const normalized = (projectRoomsData || []).map(room => ({
      ...room,
      name: room.name || (room as any).project_name || (room as any).title || 'Unnamed Project'
    }));

    return normalized.sort((a, b) => {
      // Priority 0: Favourite status (favourites first)
      const roomDetailsA = queryClient.getQueryData(['chat-room-details', a.id]) as ChatRoom | undefined;
      const roomDetailsB = queryClient.getQueryData(['chat-room-details', b.id]) as ChatRoom | undefined;
      const isFavouriteA = roomDetailsA?.current_user_membership?.is_favourite || false;
      const isFavouriteB = roomDetailsB?.current_user_membership?.is_favourite || false;

      if (isFavouriteA !== isFavouriteB) {
        return isFavouriteA ? -1 : 1;
      }

      // 1. Get timestamp from Room object
      let timeA = a.last_message?.created_at ? new Date(a.last_message.created_at).getTime() : 0;
      let timeB = b.last_message?.created_at ? new Date(b.last_message.created_at).getTime() : 0;
      // 2. Check if Unread API has fresher data
      if (unreadData?.by_room) {
        const unreadA = unreadData.by_room[a.id];
        const unreadB = unreadData.by_room[b.id];

        if (unreadA?.last_message_at) {
          timeA = Math.max(timeA, new Date(unreadA.last_message_at).getTime());
        }
        if (unreadB?.last_message_at) {
          timeB = Math.max(timeB, new Date(unreadB.last_message_at).getTime());
        }
      }

      // Sort Descending (Newest first)
      if (timeA !== timeB) return timeB - timeA;
      // Fallback to Alphabetical
      return a.name.localeCompare(b.name);
    });
  }, [projectRoomsData, unreadData, queryClient, chatListVersion]);

  // Sync unread API data with local state & Map Private Rooms to Users
  useEffect(() => {
    if (unreadData?.by_room && usersData?.results && currentUser) {
      let updatesNeeded = false;
      const newUnreadMap = new Map(unreadCounts);
      const newRoomUserMap = new Map(roomUserMap);
      const newUserRoomMap = new Map(userRoomMap);
      const newLastMessages = new Map(lastMessages);

      Object.entries(unreadData.by_room).forEach(([roomId, data]) => {
        // 1. Update unread counts
        if (newUnreadMap.get(roomId) !== data.unread_count) {
          newUnreadMap.set(roomId, data.unread_count);
          updatesNeeded = true;
        }

        // 2. Dynamically map Private Room IDs to Users (based on Room Name)
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
              // Force unread status on the user in the sidebar
              if (data.unread_count > 0) {
                const prevMsg = newLastMessages.get(user.id);
                // Only update if not already marked unread
                if (!prevMsg?.isUnread) {
                  newLastMessages.set(user.id, {
                    content: prevMsg?.content || 'Unread messages',
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
          // If ID found, map it
          if (otherUserId) {
            if (!newRoomUserMap.has(room.id)) {
              newRoomUserMap.set(room.id, otherUserId);
              newUserRoomMap.set(otherUserId, room.id);
              updatesNeeded = true;
            }

            // Update Last Message Data
            if (room.last_message) {
              const currentMsg = newLastMessages.get(otherUserId);
              const roomTime = new Date(room.last_message.created_at).getTime();
              const existingTime = currentMsg ? new Date(currentMsg.timestamp).getTime() : 0;

              // Only update if this data is newer or doesn't exist
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

  // Initialize Gateway WebSocket ONCE on Mount
  useEffect(() => {
    if (!currentUser || isGatewayInitialized.current) {
      return;
    }

    isGatewayInitialized.current = true;

    const gateway = new GatewayWebSocketService();
    gateway.connect();
    gatewaySocketRef.current = gateway;

    gateway.onMessage((data: GatewayIncomingMessage) => {

      // Handle connection acknowledgement
      if (data.type === 'GATEWAY_CONNECTED') {
        return;
      }

      // Handle presence events
      if (data.type === 'PRESENCE') {
        return;
      }

      // Handle room creation events for real-time rendering
      if (data.type === 'room_created') {
        const newRoom = data.room || (data as any).data;

        if (newRoom?.room_type === 'project') {
          queryClient.invalidateQueries({
            queryKey: ['project-chat-rooms'],
            refetchType: 'active'
          });
        } else if (newRoom?.room_type === 'team') {
          queryClient.invalidateQueries({
            queryKey: ['team-chat-rooms'],
            refetchType: 'active'
          });
        }
        return;
      }

      const message = (data as any).data;
      const actualRoomId = message?.room_id || message?.room;


      if (data.type === 'CHAT_MESSAGE' && message && actualRoomId) {
        const isOwnMessage = message.sender.id === currentUser?.id;

        // Add is_own_message field if not present
        const enrichedMessage: ChatMessage = {
          ...message,
          is_own_message: isOwnMessage,
          room: actualRoomId
        };

        // 1. Update last messages for the sidebar
        let chatListUserId: number | null = null;
        if (isOwnMessage) {
          const roomData = queryClient.getQueryData<ChatRoom>(['chat-room', actualRoomId]);
          chatListUserId = roomData?.participants?.find(p => p.id !== currentUser?.id)?.id || null;
        } else {
          chatListUserId = enrichedMessage.sender.id;
        }

        if (chatListUserId) {
          // Determine if this message should be marked as unread
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

          // Update user activity timestamp for sorting
          setUserLastActivity(prev => {
            const newMap = new Map(prev);
            newMap.set(chatListUserId!, Date.now());
            return newMap;
          });
        }

        // 2. Get current cache before update
        const beforeUpdate = queryClient.getQueryData<ChatRoomMessagesResponse>(['chat-messages', actualRoomId]);

        // 3. Update the specific room's message cache
        queryClient.setQueryData(['chat-messages', actualRoomId], (oldData: ChatRoomMessagesResponse | undefined) => {
          const existingMessages = oldData?.messages || [];

          // Check for duplicate
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

        // Remove any matching optimistic message for own confirmed messages
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

        // 4. Verify cache update
        const afterUpdate = queryClient.getQueryData<ChatRoomMessagesResponse>(['chat-messages', actualRoomId]);

        // 5. Check if this is the active room
        const isActiveRoom = actualRoomId === activeRoomRef.current?.id;

        // 6. Force re-render by invalidating query
        queryClient.invalidateQueries({
          queryKey: ['chat-messages', actualRoomId],
          refetchType: 'none'
        });

        // 7. Additional check - verify query state
        setTimeout(() => {
          const finalState = queryClient.getQueryData<ChatRoomMessagesResponse>(['chat-messages', actualRoomId]);
        }, 100);


        // 8. Handle unread counts and notifications for non-active rooms
        if (!isActiveRoom) {
          setUnreadCounts(prev => {
            const newMap = new Map(prev);
            newMap.set(actualRoomId, (newMap.get(actualRoomId) || 0) + 1);
            return newMap;
          });

          const toast: ToastNotification = {
            id: `${Date.now()}`,
            room_id: actualRoomId,
            sender_name: enrichedMessage.sender.full_name || enrichedMessage.sender.username,
            message_preview: enrichedMessage.content.replace(/<[^>]*>/g, '').trim() || enrichedMessage.content,
            timestamp: enrichedMessage.created_at
          };
          setToastNotifications(prev => [...prev, toast]);
        } else {
        }
      }

      // Handle chat unread updates from WebSocket SIGNAL
      if (data.type === 'SIGNAL' && (data as any).event === 'CHAT_UNREAD_UPDATE') {
        const unreadData = (data as any).data;
        const roomId = unreadData.room_id;
        const roomUnread = unreadData.room_unread || 0;

        // Update unread counts
        setUnreadCounts(prev => {
          const newMap = new Map(prev);
          newMap.set(roomId, roomUnread);
          return newMap;
        });

        // Use Ref to get userId (bypasses stale closure)
        const userId = roomUserMapRef.current.get(roomId);

        if (userId) {
          if (roomUnread > 0) {
            setLastMessages(prev => {
              const newMap = new Map(prev);
              const existing = newMap.get(userId);
              // Update existing or create placeholder if user is found
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
          // Unknown room (new chat): Refetch API to get name/mapping
          queryClient.invalidateQueries({ queryKey: ['chat-unread-counts'] });
        }
      }

    });

    // Cleanup on unmount
    return () => {
      gateway.disconnect();
      isGatewayInitialized.current = false;
    };
  }, [currentUser?.id, queryClient]);

  // 3. Mutation: Create or Get Private Room
  const createRoomMutation = useMutation({
    mutationFn: (userId: number) => chatApi.createPrivateRoom(userId),
    onSuccess: (roomData, userId) => {
      setActiveRoom(roomData);
      activeRoomRef.current = roomData;
      queryClient.setQueryData(['chat-room', roomData.id], roomData);

      // Prefetch room details for favourite status
      queryClient.prefetchQuery({
        queryKey: ['chat-room-details', roomData.id],
        queryFn: () => chatApi.getRoomDetails(roomData.id),
      });

      // Map room ID to user ID
      setRoomUserMap(prev => {
        const newMap = new Map(prev);
        newMap.set(roomData.id, userId);
        return newMap;
      });

      // Map user ID to room ID
      setUserRoomMap(prev => {
        const newMap = new Map(prev);
        newMap.set(userId, roomData.id);
        return newMap;
      });
    },
    onError: (error) => {
      console.error("[ROOM ERROR] Failed to load chat room", error);
    }
  });

  const { data: messagesData, isLoading: isLoadingMessages } = useQuery({
    queryKey: ['chat-messages', activeRoom?.id || selectedProjectRoom?.id || selectedTeamRoom?.id],
    queryFn: async () => {
      const roomId = activeRoom?.id || selectedProjectRoom?.id || selectedTeamRoom?.id;
      if (!roomId) {
        return Promise.resolve({ messages: [], count: 0, has_more: false });
      }

      // Fetch messages
      const messages = await chatApi.getRoomMessages(roomId);
      try {
        await chatApi.markAsRead(roomId);
        queryClient.invalidateQueries({ queryKey: ['chat-unread-counts'] });
      } catch (error) {
        console.error('Failed to mark messages as read:', error);
      }

      return messages;
    },
    enabled: !!(activeRoom || selectedProjectRoom || selectedTeamRoom),
    staleTime: 0,
    refetchOnMount: true,
  });

  // 5. Room-specific WebSocket
  useEffect(() => {
    if (!activeRoom?.id) return;

    setUnreadCounts(prev => {
      const newMap = new Map(prev);
      newMap.delete(activeRoom.id);
      return newMap;
    });
  }, [activeRoom?.id]);

  const messages = useMemo(() => {
    const confirmedMessages: OptimisticChatMessage[] = (messagesData?.messages || []).map(m => ({
      ...m,
      optimisticStatus: 'sent' as const,
    }));

    const currentRoomId = activeRoom?.id || selectedProjectRoom?.id || selectedTeamRoom?.id;
    const confirmedIds = new Set(confirmedMessages.map(m => String(m.id)));
    const pendingOptimistic = optimisticMessages.filter(om =>
      om.room === currentRoomId && !confirmedIds.has(String(om.id))
    );

    return [...confirmedMessages, ...pendingOptimistic].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [messagesData?.messages, optimisticMessages, activeRoom?.id, selectedProjectRoom?.id, selectedTeamRoom?.id]);

  // Log when messages array changes
  useEffect(() => {
  }, [messages]);

  // Monitor active room changes for debugging
  useEffect(() => {
  }, [activeRoom, selectedProjectRoom, selectedTeamRoom, selectedUserId]);

  // Filter and sort users with activity
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

  // unread first, then by timestamp (Last Message), then alphabetically
  const sortedUsers = useMemo(() => {
    return [...usersWithActivity].sort((a, b) => {
      // Get room IDs for both users
      const roomA = userRoomMap.get(a.id);
      const roomB = userRoomMap.get(b.id);

      // Priority 0: Favourite status
      const roomDetailsA = roomA ? (queryClient.getQueryData(['chat-room-details', roomA]) as ChatRoom | undefined) : undefined;
      const roomDetailsB = roomB ? (queryClient.getQueryData(['chat-room-details', roomB]) as ChatRoom | undefined) : undefined;
      const isFavouriteA = roomDetailsA?.current_user_membership?.is_favourite || false;
      const isFavouriteB = roomDetailsB?.current_user_membership?.is_favourite || false;

      if (isFavouriteA !== isFavouriteB) {
        return isFavouriteA ? -1 : 1;
      }

      // Priority 1: Unread messages
      const unreadA = roomA ? (unreadCounts.get(roomA) || 0) : 0;
      const unreadB = roomB ? (unreadCounts.get(roomB) || 0) : 0;

      if (unreadA !== unreadB) {
        return unreadB - unreadA;
      }

      // Priority 2: Last Message Timestamp (Most recent first)
      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      const activityA = (a as any).activityTimestamp || 0;
      const activityB = (b as any).activityTimestamp || 0;

      // Use the absolute latest timestamp known for the user
      const latestA = Math.max(timeA, activityA);
      const latestB = Math.max(timeB, activityB);

      if (latestA !== latestB) {
        return latestB - latestA;
      }

      // Priority 3: Alphabetical by name
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

  // Get unread count for a specific user
  const getUserUnreadCount = (userId: number): number => {
    const roomId = userRoomMap.get(userId);
    return roomId ? (unreadCounts.get(roomId) || 0) : 0;
  };

  //Check if user has unread messages
  const hasUnreadMessages = (userId: number): boolean => {
    return getUserUnreadCount(userId) > 0;
  };

  // Unread users filter
  const unreadUsers = useMemo(() => {
    return filteredUsers.filter(user => {
      const unreadCount = getUserUnreadCount(user.id);
      return (user as any).isUnread || unreadCount > 0;
    });
  }, [filteredUsers, chatListVersion, unreadCounts]);

  // Shared documents from messages
  const sharedDocuments = useMemo(() => {
    return messages.filter(msg => msg.attachment).map(msg => ({
      id: msg.id,
      name: msg.attachment_name || 'Attachment',
      url: msg.attachment!,
      sender: msg.sender,
      created_at: msg.created_at,
    }));
  }, [messages]);

  // Select User -> Create/Get Room
  const handleUserSelect = (userId: number) => {
    if (selectedUserId === userId) return;

    navigate('/team-chat');

    // Reset project/team selections
    setSelectedProjectRoom(null);
    setSelectedTeamRoom(null);
    setSelectedUserId(userId);

    // Clear unread status for this user
    setLastMessages(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(userId);
      if (existing) {
        newMap.set(userId, { ...existing, isUnread: false });
      }
      return newMap;
    });
    setActiveRoom(null);
    activeRoomRef.current = null;
    queryClient.resetQueries({ queryKey: ['chat-messages'] });

    createRoomMutation.mutate(userId);
  };

  // Handler for project room click
  const handleProjectClick = async (projectRoom: ProjectChatRoom) => {
    setSelectedUserId(null);
    setSelectedTeamRoom(null);
    setActiveRoom(null);

    // Set project room
    setSelectedProjectRoom(projectRoom);
    activeRoomRef.current = { id: projectRoom.id } as ChatRoom;
    setUnreadCounts(prev => {
      const newMap = new Map(prev);
      newMap.set(projectRoom.id, 0);
      return newMap;
    });

    // Prefetch room details for favourite status
    queryClient.prefetchQuery({
      queryKey: ['chat-room-details', projectRoom.id],
      queryFn: () => chatApi.getRoomDetails(projectRoom.id),
    });

    queryClient.resetQueries({ queryKey: ['chat-messages'] });
    queryClient.invalidateQueries({ queryKey: ['chat-messages', projectRoom.id] });

    // Navigate to the project chat room URL
    const projectId = (projectRoom as any).project_id ?? (projectRoom as any).project ?? '';
    if (projectId) {
      navigate(`/team-chat/${projectId}/${projectRoom.id}`);
    }
  };

  // Handler for team room click
  const handleTeamClick = async (teamRoom: TeamChatRoom) => {
    navigate('/team-chat');
    setSelectedUserId(null);
    setSelectedProjectRoom(null);
    setActiveRoom(null);

    // Set team room
    setSelectedTeamRoom(teamRoom);
    activeRoomRef.current = { id: teamRoom.id } as ChatRoom;
    setUnreadCounts(prev => {
      const newMap = new Map(prev);
      newMap.set(teamRoom.id, 0);
      return newMap;
    });

    // Prefetch room details for favourite status
    queryClient.prefetchQuery({
      queryKey: ['chat-room-details', teamRoom.id],
      queryFn: () => chatApi.getRoomDetails(teamRoom.id),
    });

    // CRITICAL FIX: Reset previous messages and fetch new ones
    queryClient.resetQueries({ queryKey: ['chat-messages'] });
    queryClient.invalidateQueries({ queryKey: ['chat-messages', teamRoom.id] });
  };

  // Handle quick emoji reaction
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

  // Handle message actions
  const handleReplyWithQuote = (message: ChatMessage) => {
    const plainPreview = message.content.replace(/<[^>]*>/g, '').trim().slice(0, 120);
    const quoteHtml = `<blockquote>${plainPreview}</blockquote><p></p>`;
    setRichHtmlContent(quoteHtml);
    setMessageInput(plainPreview);
    setOpenMenuMessageId(null);
  };

  const handleForward = (message: ChatMessage) => {
    setOpenMenuMessageId(null);
  };

  const handleCopyLink = (message: ChatMessage) => {
    setOpenMenuMessageId(null);
  };

  const handleSaveMessage = (message: ChatMessage) => {
    setOpenMenuMessageId(null);
  };

  // Delete message handler
  const handleDeleteMessage = (messageId: string | number) => {
    if (!activeRoom?.id) return;

    deleteMessageMutation.mutate({
      roomId: activeRoom.id,
      messageId: String(messageId),
    });
  };

  const handlePinMessage = (message: ChatMessage) => {
    setOpenMenuMessageId(null);
  };

  const handleMarkAsUnread = (message: ChatMessage) => {
    setOpenMenuMessageId(null);
  };

  // Close menu when clicking outside
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

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenuMessageId, showReactionPicker]);

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Process file (used by both file picker and drag-drop)
  const processFile = (file: File) => {
    setSelectedFile(file);

    // Generate preview URL for images
    if (file.type.startsWith('image/')) {
      const previewUrl = URL.createObjectURL(file);
      setFilePreviewUrl(previewUrl);
    } else {
      setFilePreviewUrl(null);
    }
  };

  // Handle attachment button click
  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
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
    if (files && files.length > 0) {
      const file = files[0];
      processFile(file);
    }
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
  }, [filePreviewUrl]);

  // Send Message
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

  // Retry sending a failed optimistic message
  const handleRetryMessage = async (optimisticMsg: OptimisticChatMessage) => {
    const roomId = optimisticMsg.room;

    // Mark as sending again
    setOptimisticMessages(prev =>
      prev.map(m => m.optimisticId === optimisticMsg.optimisticId
        ? { ...m, optimisticStatus: 'sending' }
        : m
      )
    );

    try {
      if (optimisticMsg.message_type === 'file' && optimisticMsg.attachment) {
        setOptimisticMessages(prev =>
          prev.filter(m => m.optimisticId !== optimisticMsg.optimisticId)
        );
        return;
      }

      const gatewaySocket = gatewaySocketRef.current;
      if (gatewaySocket) {
        gatewaySocket.sendMessage(roomId, optimisticMsg.content);
        setTimeout(() => {
          setOptimisticMessages(prev =>
            prev.map(m => m.optimisticId === optimisticMsg.optimisticId
              ? { ...m, optimisticStatus: 'sent' }
              : m
            )
          );
        }, 5000);
      }
    } catch {
      setOptimisticMessages(prev =>
        prev.map(m => m.optimisticId === optimisticMsg.optimisticId
          ? { ...m, optimisticStatus: 'error' }
          : m
        )
      );
    }
  };

  // Send Message
  const handleSendMessage = async () => {
    // Prevent multiple submissions while uploading
    if (isUploadingFile) {
      return;
    }

    // Use rich HTML if available (Tiptap), fall back to plain text
    const content = richHtmlContent && richHtmlContent !== '<p></p>' ? richHtmlContent : messageInput.trim();
    const hasFile = selectedFile !== null;

    if (!content && !hasFile) {
      return;
    }

    const roomId = selectedProjectRoom?.id || selectedTeamRoom?.id || activeRoom?.id;

    // If there's a file attachment, use HTTP POST
    if (hasFile && roomId) {
      const tempId = `optimistic-${Date.now()}-${Math.random()}`;
      const optimisticMsg = buildOptimisticMessage(roomId, content, tempId, selectedFile);

      // 1. Immediately render optimistic message
      setOptimisticMessages(prev => [...prev, optimisticMsg]);

      // 2. Clear input right away
      setMessageInput('');
      setRichHtmlContent('');
      const capturedFile = selectedFile!;
      setSelectedFile(null);
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
        setFilePreviewUrl(null);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      try {
        setIsUploadingFile(true);
        const response = await chatApi.sendMessageWithAttachment(roomId, {
          content: content,
          attachment: capturedFile,
        });

        // 3. Confirmed: replace optimistic with real message in cache
        queryClient.setQueryData(
          ['chat-messages', roomId],
          (oldData: ChatRoomMessagesResponse | undefined) => {
            const existingMessages = oldData?.messages || [];
            const isDuplicate = existingMessages.some(m => m.id === response.id);
            if (isDuplicate) return oldData;
            const updatedMessages = [...existingMessages, response].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            return {
              ...oldData,
              messages: updatedMessages,
              count: updatedMessages.length,
              has_more: oldData?.has_more ?? false,
            };
          }
        );
        // 4. Remove the optimistic entry and force re-render in one state batch
        setOptimisticMessages(prev => prev.filter(m => m.optimisticId !== tempId));

        // 5. Force React Query to notify subscribers of the cache change
        queryClient.invalidateQueries({ queryKey: ['chat-messages', roomId], refetchType: 'active' });
      } catch (error) {
        console.error('❌ [SEND ERROR] Failed to send message with attachment:', error);
        // 5. Mark optimistic message as errored
        setOptimisticMessages(prev =>
          prev.map(m => m.optimisticId === tempId ? { ...m, optimisticStatus: 'error' } : m)
        );
      } finally {
        setIsUploadingFile(false);
      }
      return;
    }

    // Text-only via WebSocket 
    if (!roomId) {
      console.error('❌ [SEND ERROR] No active room');
      return;
    }

    const tempId = `optimistic-${Date.now()}-${Math.random()}`;
    const optimisticMsg = buildOptimisticMessage(roomId, content, tempId);

    // 1. Immediately render optimistic message
    setOptimisticMessages(prev => [...prev, optimisticMsg]);

    // 2. Clear input immediately
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
      // Mark as error immediately if no socket
      setOptimisticMessages(prev =>
        prev.map(m => m.optimisticId === tempId ? { ...m, optimisticStatus: 'error' } : m)
      );
      return;
    }

    // 3. The WebSocket echo
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

  // Delete Message Mutation
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
    onSuccess: async (response, { roomId, isFavourite }) => {
      console.log('✅ Favourite updated successfully:', { roomId, isFavourite, response });

      // Immediately fetch updated room details to update cache
      const updatedRoomDetails = await chatApi.getRoomDetails(roomId);
      queryClient.setQueryData(['chat-room-details', roomId], updatedRoomDetails);

      // Invalidate related queries to trigger re-fetch
      queryClient.invalidateQueries({ queryKey: ['private-chat-rooms'] });
      queryClient.invalidateQueries({ queryKey: ['project-chat-rooms'] });
      queryClient.invalidateQueries({ queryKey: ['team-chat-rooms'] });

      // Force a re-render by updating chat list version
      setChatListVersion(prev => prev + 1);

      setShowHeaderMenu(false);
    },
    onError: (error) => {
      console.error('Failed to update favourite status:', error);
      alert('Failed to update favourite status. Please try again.');
    },
  });

  function ToastNotificationComponent({ toast }: { toast: ToastNotification }) {
    useEffect(() => {
      const timer = setTimeout(() => {
        handleClose();
      }, 5000);

      return () => clearTimeout(timer);
    }, []);

    const handleClose = () => {
      setToastNotifications(prev => prev.filter(t => t.id !== toast.id));
    };

    return (
      <div className="flex items-start gap-3 p-4 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[300px] max-w-[400px] animate-slide-in">
        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center font-semibold text-blue-700 text-sm flex-shrink-0">
          {toast.sender_name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900">{toast.sender_name}</p>
          <p className="text-xs text-gray-600 mt-0.5 truncate">{toast.message_preview}</p>
        </div>
        <button
          onClick={() => setToastNotifications(prev => prev.filter(t => t.id !== toast.id))}
          className="text-gray-400 hover:text-gray-600 flex-shrink-0 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f3f2f1] overflow-hidden border-2 border-gray-200">
      {previewDoc && (
        <div className="fixed inset-0 z-[200]">
          <DocumentPreview
            url={previewDoc.url}
            fileName={previewDoc.fileName}
            fileType={previewDoc.fileType}
            onClose={() => setPreviewDoc(null)}
            defaultFullscreen={false}
          />
        </div>
      )}
      {/* Toast Notifications Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toastNotifications.map(toast => (
          <ToastNotificationComponent key={toast.id} toast={toast} />
        ))}
      </div>
      {/* Left Sidebar */}
      <div className="w-80 bg-[#f3f2f1] border-r border-gray-200 flex flex-col h-full overflow-hidden">
        {/* Sidebar Header */}
        <div className="h-14 px-4 flex items-center justify-between bg-white border-b border-gray-200">
          <h2 className="font-semibold text-base text-gray-900">Chat</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsCreateTeamModalOpen(true)}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title="Create Team"
            >
              <Plus className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-3 py-3 bg-white border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search"
              className="w-full pl-9 pr-3 py-2 text-sm bg-[#f3f2f1] rounded border-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Tab Navigation */}
        <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <Tabs.List className="flex items-center gap-1 px-3 py-2 bg-white border-b border-gray-200">
            <Tabs.Trigger
              value="chats"
              className="px-4 py-1.5 text-xs font-medium rounded-full transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:bg-gray-100"
            >
              Chats
            </Tabs.Trigger>
            <Tabs.Trigger
              value="projects"
              className="px-4 py-1.5 text-xs font-medium rounded-full transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:bg-gray-100"
            >
              Projects
            </Tabs.Trigger>
            <Tabs.Trigger
              value="teams"
              className="px-4 py-1.5 text-xs font-medium rounded-full transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:bg-gray-100"
            >
              Teams
            </Tabs.Trigger>
            <Tabs.Trigger
              value="unread"
              className="px-4 py-1.5 text-xs font-medium rounded-full transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:bg-gray-100"
            >
              Unread
            </Tabs.Trigger>
          </Tabs.List>

          {/* Scrollable Lists */}
          <div className="flex-1 overflow-y-auto scrollbar-hide min-h-0 bg-white">
            <Tabs.Content value="chats">
              {/* Chats Section */}
              <div className="bg-white">
                <div className="border-t border-gray-100">
                  {isLoadingUsers ? (
                    <div className="p-4 text-center">
                      <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">No users found</div>
                  ) : (
                    filteredUsers.map(user => {
                      const isSelected = selectedUserId === user.id;
                      const unreadCount = getUserUnreadCount(user.id);
                      const hasUnreadMessages = (user as any).isUnread || unreadCount > 0;

                      // Get favourite status for this user
                      const roomId = userRoomMap.get(user.id);
                      const roomDetailsQuery = roomId ? queryClient.getQueryData(['chat-room-details', roomId]) as ChatRoom | undefined : undefined;
                      const isFavourite = roomDetailsQuery?.current_user_membership?.is_favourite || false;

                      return (
                        <button
                          key={user.id}
                          onClick={() => handleUserSelect(user.id)}
                          className={cn(
                            "w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors border-l-2",
                            isSelected ? "bg-blue-50 border-blue-600" : "border-transparent"
                          )}
                        >
                          <div className="relative flex-shrink-0">
                            <div className={cn(
                              "h-10 w-10 rounded-full flex items-center justify-center font-semibold text-sm",
                              isSelected ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-700"
                            )}>
                              {user.username.charAt(0).toUpperCase()}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center justify-between mb-0.5">
                              <p className={cn(
                                "text-sm truncate flex-1",
                                hasUnreadMessages ? "font-bold text-gray-900" : "font-medium text-gray-900"
                              )}>
                                {user?.first_name} {user?.last_name}
                              </p>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {isFavourite && (
                                  <Pin className="h-3.5 w-3.5 text-blue-600" />
                                )}
                                {user.lastMessageTime && (
                                  <span className={cn(
                                    "text-[10px]",
                                    hasUnreadMessages ? "text-blue-600 font-semibold" : "text-gray-500"
                                  )}>
                                    {new Date(user.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <p className={cn(
                                "text-xs truncate",
                                hasUnreadMessages ? "font-semibold text-gray-900" : "text-gray-600"
                              )}>
                                {user.lastMessageContent
                                  ? user.lastMessageContent.replace(/<[^>]*>/g, '').trim() || 'Sent a message'
                                  : 'No messages yet'}
                              </p>
                              {unreadCount > 0 && (
                                <span className="ml-2 flex-shrink-0 h-5 min-w-[20px] px-1.5 bg-blue-600 text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
                                  {unreadCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </Tabs.Content>

            <Tabs.Content value="projects">

              {/* Projects Section */}
              <div className="bg-white">
                <div className="border-t border-gray-100">
                  {isLoadingProjects ? (
                    <div className="p-4 text-center">
                      <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                    </div>
                  ) : projectRooms.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">No projects</div>
                  ) : (
                    projectRooms.map(project => {
                      const isSelected = selectedProjectRoom?.id === project.id;
                      const unreadCount = unreadCounts.get(project.id) || 0;

                      // Get favourite status for this project
                      const roomDetailsQuery = queryClient.getQueryData(['chat-room-details', project.id]) as ChatRoom | undefined;
                      const isFavourite = roomDetailsQuery?.current_user_membership?.is_favourite || false;

                      return (
                        <button
                          key={project.id}
                          onClick={() => handleProjectClick(project)}
                          className={cn(
                            "w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors border-l-2",
                            isSelected ? "bg-blue-50 border-blue-600" : "border-transparent"
                          )}
                        >
                          <div className="h-10 w-10 rounded bg-purple-100 flex items-center justify-center font-semibold text-purple-700 text-sm flex-shrink-0">
                            {project.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm font-medium text-gray-900 truncate">{project.name}</p>
                            <p className="text-xs text-gray-600 truncate">
                              {project.last_message?.content_preview
                                ? project.last_message.content_preview.replace(/<[^>]*>/g, '').trim() || 'Sent a message'
                                : 'No messages yet'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isFavourite && (
                              <Pin className="h-3.5 w-3.5 text-blue-600" />
                            )}
                            {unreadCount > 0 && (
                              <span className="h-5 min-w-[20px] px-1.5 bg-blue-600 text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
                                {unreadCount}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </Tabs.Content>

            <Tabs.Content value="teams">

              {/* Teams Section */}
              <div className="bg-white">
                <div className="border-t border-gray-100">
                  {isLoadingTeams ? (
                    <div className="p-4 text-center">
                      <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                    </div>
                  ) : teamRooms.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">No teams</div>
                  ) : (
                    teamRooms.map(team => {
                      const isSelected = selectedTeamRoom?.id === team.id;
                      const unreadCount = unreadCounts.get(team.id) || 0;

                      // Get favourite status for this team
                      const roomDetailsQuery = queryClient.getQueryData(['chat-room-details', team.id]) as ChatRoom | undefined;
                      const isFavourite = roomDetailsQuery?.current_user_membership?.is_favourite || false;

                      return (
                        <button
                          key={team.id}
                          onClick={() => handleTeamClick(team)}
                          className={cn(
                            "w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors border-l-2",
                            isSelected ? "bg-blue-50 border-blue-600" : "border-transparent"
                          )}
                        >
                          <div className="h-10 w-10 rounded bg-green-100 flex items-center justify-center font-semibold text-green-700 text-sm flex-shrink-0">
                            {team.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm font-medium text-gray-900 truncate">{team.name}</p>
                            <p className="text-xs text-gray-600 truncate">
                              {(() => {
                                const lastMsg = (team.last_message as any);
                                if (!lastMsg) return 'No messages yet';
                                const raw = lastMsg.content_preview || lastMsg.content || '';
                                return raw.replace(/<[^>]*>/g, '').trim() || 'Sent a message';
                              })()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isFavourite && (
                              <Pin className="h-3.5 w-3.5 text-blue-600" />
                            )}
                            {unreadCount > 0 && (
                              <span className="h-5 min-w-[20px] px-1.5 bg-blue-600 text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
                                {unreadCount}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </Tabs.Content>

            <Tabs.Content value="unread">
              {/* Unread Section */}
              <div className="bg-white">
                <div className="border-t border-gray-100">
                  {unreadUsers.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">No unread messages</div>
                  ) : (
                    unreadUsers.map(user => {
                      const isSelected = selectedUserId === user.id;
                      const unreadCount = getUserUnreadCount(user.id);

                      return (
                        <button
                          key={user.id}
                          onClick={() => handleUserSelect(user.id)}
                          className={cn(
                            "w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors border-l-2",
                            isSelected ? "bg-blue-50 border-blue-600" : "border-transparent"
                          )}
                        >
                          <div className="relative flex-shrink-0">
                            <div className={cn(
                              "h-10 w-10 rounded-full flex items-center justify-center font-semibold text-sm",
                              isSelected ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-700"
                            )}>
                              {user.username.charAt(0).toUpperCase()}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center justify-between mb-0.5">
                              <p className="text-sm font-bold text-gray-900 truncate">
                                {user.first_name || user.username}
                              </p>
                              {user.lastMessageTime && (
                                <span className="text-[10px] ml-2 flex-shrink-0 text-blue-600 font-semibold">
                                  {new Date(user.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-gray-900 truncate">
                                {user.lastMessageContent || 'No messages yet'}
                              </p>
                              {unreadCount > 0 && (
                                <span className="ml-2 flex-shrink-0 h-5 min-w-[20px] px-1.5 bg-blue-600 text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
                                  {unreadCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </Tabs.Content>
          </div>
        </Tabs.Root>
      </div>

      {/* Right Panel - Chat View */}
      <div className="flex-1 flex flex-col bg-white h-full overflow-hidden">
        {(activeRoom || selectedProjectRoom || selectedTeamRoom) ? (
          <>
            {/* Chat Header */}
            <div className="h-14 px-6 flex items-center justify-between bg-white border-b border-gray-200">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {selectedProjectRoom ? (
                      <div className="h-10 w-10 rounded bg-purple-100 flex items-center justify-center font-semibold text-purple-700 text-sm">
                        {selectedProjectRoom.name.charAt(0).toUpperCase()}
                      </div>
                    ) : selectedTeamRoom ? (
                      <div className="h-10 w-10 rounded bg-green-100 flex items-center justify-center font-semibold text-green-700 text-sm">
                        {selectedTeamRoom.name.charAt(0).toUpperCase()}
                      </div>
                    ) : selectedUser ? (
                      <>
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center font-semibold text-blue-700 text-sm">
                          {selectedUser.username.charAt(0).toUpperCase()}
                        </div>
                      </>
                    ) : null}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-gray-900">
                      {selectedProjectRoom?.name || selectedTeamRoom?.name || (selectedUser ? `${selectedUser.first_name || selectedUser.username}` : '')}
                    </h3>
                    {selectedProjectRoom && (
                      <p className="text-xs text-gray-500"></p>
                    )}
                    {selectedTeamRoom && (
                      <p className="text-xs text-gray-500"></p>
                    )}
                  </div>
                </div>

                {/* View Switcher */}
                <Tabs.Root value={headerView} onValueChange={(value) => setHeaderView(value as 'chat' | 'shared')} className="flex items-center">
                  <Tabs.List className="flex items-center gap-1 border-b-2 border-transparent">
                    <Tabs.Trigger
                      value="chat"
                      className="px-3 py-1 text-sm font-medium transition-all border-b-2 -mb-[2px] data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=inactive]:border-transparent data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-gray-900"
                    >
                      Chat
                    </Tabs.Trigger>
                    <Tabs.Trigger
                      value="shared"
                      className="px-3 py-1 text-sm font-medium transition-all border-b-2 -mb-[2px] data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=inactive]:border-transparent data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-gray-900"
                    >
                      Shared
                    </Tabs.Trigger>
                  </Tabs.List>
                </Tabs.Root>
              </div>
              <div className="flex items-center gap-1">
                {/* <button className="p-2 hover:bg-gray-100 rounded transition-colors">
                  <Phone className="h-4 w-4 text-gray-600" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded transition-colors">
                  <Video className="h-4 w-4 text-gray-600" />
                </button> */}
                <div className="relative" ref={headerMenuRef}>
                  <button
                    onClick={() => setShowHeaderMenu(!showHeaderMenu)}
                    className="p-2 hover:bg-gray-100 rounded transition-colors"
                  >
                    <MoreVertical className="h-4 w-4 text-gray-600" />
                  </button>

                  {showHeaderMenu && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                      <button
                        onClick={() => {
                          const roomId = selectedProjectRoom?.id || selectedTeamRoom?.id || activeRoom?.id;
                          if (roomId) {
                            // Fetch current favourite status from the query cache
                            const roomDetailsQuery = queryClient.getQueryData(['chat-room-details', roomId]) as ChatRoom | undefined;
                            const currentFavourite = roomDetailsQuery?.current_user_membership?.is_favourite || false;
                            toggleFavouriteMutation.mutate({ roomId, isFavourite: !currentFavourite });
                          } else {
                            console.error('❌ No room ID available for favourite toggle');
                          }
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        {(() => {
                          const roomId = selectedProjectRoom?.id || selectedTeamRoom?.id || activeRoom?.id;
                          const roomDetailsQuery = roomId ? queryClient.getQueryData(['chat-room-details', roomId]) as ChatRoom | undefined : undefined;
                          const isFavourite = roomDetailsQuery?.current_user_membership?.is_favourite || false;
                          return isFavourite ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />;
                        })()}
                        {(() => {
                          const roomId = selectedProjectRoom?.id || selectedTeamRoom?.id || activeRoom?.id;
                          const roomDetailsQuery = roomId ? queryClient.getQueryData(['chat-room-details', roomId]) as ChatRoom | undefined : undefined;
                          const isFavourite = roomDetailsQuery?.current_user_membership?.is_favourite || false;
                          return isFavourite ? 'Remove from favourites' : 'Add to favourites';
                        })()}
                      </button>

                      {(selectedTeamRoom || selectedProjectRoom) && (
                        <>
                          <button
                            onClick={() => setShowMemberList(!showMemberList)}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <UsersIcon className="h-4 w-4" />
                            Member list
                          </button>

                          {showMemberList && (
                            <div className="border-t border-gray-200 mt-1 pt-2 px-2 max-h-64 overflow-y-auto">
                              {selectedTeamRoom && (
                                <MemberListContent roomId={selectedTeamRoom.id} roomType="team" />
                              )}
                              {selectedProjectRoom && (
                                <MemberListContent roomId={selectedProjectRoom.id} roomType="project" />
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Content Area */}
            {headerView === 'chat' ? (
              <>
                {/* Messages Area */}
                <div
                  className="flex-1 overflow-y-auto bg-[#efeae2] scrollbar-hide p-6"
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >

                  {/* Drag Overlay */}
                  {isDragging && (
                    <div className="absolute inset-0 bg-blue-50 bg-opacity-90 border-4 border-dashed border-blue-400 rounded-lg z-50 flex items-center justify-center">
                      <div className="text-center">
                        <Paperclip className="h-16 w-16 text-blue-600 mx-auto mb-4" />
                        <p className="text-xl font-semibold text-blue-600">Drop file to upload</p>
                        <p className="text-sm text-blue-500 mt-2">Release to attach the file</p>
                      </div>
                    </div>
                  )}
                  {isLoadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">No messages yet</p>
                        <p className="text-xs text-gray-400 mt-1">Start the conversation!</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {messages.map((message, index) => {
                        const isOwn = message.is_own_message;
                        const showAvatar = index === 0 || messages[index - 1].sender.id !== message.sender.id;
                        const isHovered = hoveredMessageId === message.id;

                        // — Date separator logic —
                        const msgDate = new Date(message.created_at);
                        const msgDay = msgDate.toDateString();
                        const prevMsgDay = index > 0 ? new Date(messages[index - 1].created_at).toDateString() : null;
                        const showDateSeparator = index === 0 || msgDay !== prevMsgDay;

                        const getDateLabel = (date: Date) => {
                          const today = new Date();
                          const yesterday = new Date();
                          yesterday.setDate(today.getDate() - 1);
                          if (date.toDateString() === today.toDateString()) return 'Today';
                          if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
                          return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                        };
                        const menuOpen = openMenuMessageId === message.id;
                        const reactions = messageReactions.get(message.id);

                        return (
                          <div key={message.id}>
                            {/* Date separator */}
                            {showDateSeparator && (
                              <div className="flex items-center gap-3 my-4 px-2">
                                <div className="flex-1 h-px bg-gray-400" />
                                <span className="text-[11px] font-medium text-gray-700 bg-[#efeae2] px-3 py-1 rounded-full whitespace-nowrap select-none">
                                  {getDateLabel(msgDate)}
                                </span>
                                <div className="flex-1 h-px bg-gray-400" />
                              </div>
                            )}

                            <div
                              className={cn("flex gap-2 group relative", isOwn ? "flex-row-reverse" : "")}
                              onMouseEnter={() => setHoveredMessageId(message.id)}
                              onMouseLeave={() => setHoveredMessageId(null)}
                            >
                              {/* Avatar */}
                              <div className="flex-shrink-0">
                                {showAvatar ? (
                                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center font-semibold text-white text-sm shadow-sm">
                                    {message.sender.username.charAt(0).toUpperCase()}
                                  </div>
                                ) : (
                                  <div className="h-9 w-9" />
                                )}
                              </div>

                              {/* Message Content */}
                              <div className={cn("flex-1 max-w-[65%]", isOwn ? "flex flex-col items-end" : "flex flex-col items-start")}>
                                {showAvatar && (
                                  <div className={cn("flex items-baseline gap-2 mb-1", isOwn ? "flex-row-reverse" : "")}>
                                    <span className={cn(
                                      "text-xs font-medium",
                                      isOwn ? "text-gray-700" : "text-gray-900"
                                    )}>
                                      {message.sender.full_name || message.sender.username}
                                    </span>
                                    <span className="text-[11px] text-gray-400 font-normal">
                                      {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                )}

                                <div className="relative">
                                  {(() => {
                                    // Strip HTML tags to get plain text for emoji detection
                                    const plainText = message.content
                                      ? message.content.replace(/<[^>]*>/g, '').trim()
                                      : '';
                                    const isEmojiOnly = plainText.length > 0 &&
                                      /^[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Emoji_Component}\s]+$/u.test(plainText) &&
                                      !/[a-zA-Z0-9]/.test(plainText);

                                    return (
                                      <div
                                        className={cn(
                                          "text-sm break-words max-w-full",
                                          isEmojiOnly
                                            ? "px-1 py-1"
                                            : cn(
                                              "px-3 py-2 rounded-lg shadow-sm",
                                              isOwn
                                                ? "bg-[#7699a3] text-white rounded-br-none"
                                                : "bg-white text-gray-900 border border-gray-100 rounded-bl-none"
                                            )
                                        )}
                                        style={{
                                          minWidth: isEmojiOnly ? undefined : '60px',
                                          wordBreak: 'break-word',
                                          overflowWrap: 'break-word'
                                        }}
                                      >
                                        {message.content && (
                                          <div
                                            className={cn(
                                              "prose prose-sm max-w-none break-words",
                                              isEmojiOnly
                                                ? "[&_p]:m-0 [&_p]:text-4xl [&_p]:leading-none"
                                                : isOwn
                                                  ? "prose-invert [&_*]:text-white [&_a]:text-blue-200 [&_code]:bg-green-800 [&_code]:text-green-100 [&_blockquote]:border-green-400"
                                                  : "[&_a]:text-blue-600 [&_code]:bg-gray-100 [&_code]:text-red-600"
                                            )}
                                            dangerouslySetInnerHTML={{ __html: message.content }}
                                          />
                                        )}
                                        {/* Attachment */}
                                        {message.attachment && (
                                          <div className={message.content ? "mt-2 pt-2 border-t border-blue-500" : ""}>
                                            {(message as OptimisticChatMessage).optimisticStatus === 'sending' ? (
                                              <div className="flex items-center gap-2 text-xs opacity-70">
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                <span>{(message as OptimisticChatMessage).attachment_name || 'Uploading file…'}</span>
                                              </div>
                                            ) : (
                                              <DocumentThumbnail
                                                url={message.attachment}
                                                fileName={message.attachment_name || 'Attachment'}
                                                onClick={() => setPreviewDoc({
                                                  url: message.attachment!,
                                                  fileName: message.attachment_name || 'Attachment',
                                                })}
                                                className="w-40"
                                              />
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}

                                  {/* Optimistic status indicator */}
                                  {isOwn && (message as OptimisticChatMessage).optimisticStatus === 'sending' && (
                                    <div className="flex justify-end mt-1">
                                      <span className="flex items-center gap-1 text-[10px] text-gray-400">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Sending…
                                      </span>
                                    </div>
                                  )}
                                  {isOwn && (message as OptimisticChatMessage).optimisticStatus === 'error' && (
                                    <div className="flex justify-end mt-1">
                                      <button
                                        onClick={() => handleRetryMessage(message as OptimisticChatMessage)}
                                        className="flex items-center gap-1 text-[10px] text-red-500 hover:text-red-700 transition-colors"
                                        title="Failed to send — click to retry"
                                      >
                                        <AlertCircle className="h-3 w-3" />
                                        Failed to send
                                        <RotateCcw className="h-3 w-3 ml-0.5" />
                                      </button>
                                    </div>
                                  )}


                                  {/* Quick Actions on Hover */}
                                  {(isHovered || menuOpen) && (
                                    <div
                                      className={cn(
                                        "absolute top-0 flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg shadow-sm px-1 py-0.5",
                                        isOwn ? "right-full mr-2" : "left-full ml-2"
                                      )}
                                    >
                                      {/* Quick Emoji Reactions */}
                                      <button
                                        onClick={() => handleQuickReaction(message.id, '👍')}
                                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                                        title="Like"
                                      >
                                        <span className="text-xs">👍</span>
                                      </button>
                                      <button
                                        onClick={() => handleQuickReaction(message.id, '❤️')}
                                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                                        title="Love"
                                      >
                                        <span className="text-xs">❤️</span>
                                      </button>
                                      <button
                                        onClick={() => handleQuickReaction(message.id, '😊')}
                                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                                        title="Smile"
                                      >
                                        <span className="text-xs">😊</span>
                                      </button>

                                      <div className="h-4 w-px bg-gray-200 mx-0.5" />

                                      {/* More Reactions Button */}
                                      <button
                                        onClick={() => setShowReactionPicker(showReactionPicker === message.id ? null : message.id)}
                                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                                        title="More reactions"
                                      >
                                        <Smile className="h-3.5 w-3.5 text-gray-600" />
                                      </button>

                                      {/* More Options Menu */}
                                      <button
                                        onClick={() => setOpenMenuMessageId(menuOpen ? null : message.id)}
                                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                                        title="More options"
                                      >
                                        <MoreVertical className="h-3.5 w-3.5 text-gray-600" />
                                      </button>

                                      {/* Dropdown Menu */}
                                      {menuOpen && (
                                        <div
                                          ref={menuRef}
                                          className={cn(
                                            "absolute top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-48 z-50",
                                            isOwn ? "right-0" : "left-0"
                                          )}
                                        >
                                          <button
                                            onClick={() => handleReplyWithQuote(message)}
                                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                                          >
                                            <Reply className="h-4 w-4" />
                                            Reply
                                          </button>
                                          <button
                                            onClick={() => handleForward(message)}
                                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                                          >
                                            <Forward className="h-4 w-4" />
                                            Forward
                                          </button>
                                          <button
                                            onClick={() => handleCopyLink(message)}
                                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                                          >
                                            <Link2 className="h-4 w-4" />
                                            Copy link
                                          </button>
                                          <button
                                            onClick={() => handlePinMessage(message)}
                                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                                          >
                                            <Pin className="h-4 w-4" />
                                            Pin message
                                          </button>
                                          <button
                                            onClick={() => handleSaveMessage(message)}
                                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                                          >
                                            <Bookmark className="h-4 w-4" />
                                            Save
                                          </button>
                                          <button
                                            onClick={() => handleMarkAsUnread(message)}
                                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                                          >
                                            <MailOpen className="h-4 w-4" />
                                            Mark as unread
                                          </button>
                                          <div className="h-px bg-gray-200 my-1" />
                                          {isOwn && (
                                            <button
                                              onClick={() => handleDeleteMessage(message.id)}
                                              className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                                            >
                                              <Trash2 className="h-4 w-4" />
                                              Delete
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Display Reactions */}
                                  {reactions && reactions.size > 0 && (
                                    <div className={cn(
                                      "flex gap-1 mt-1",
                                      isOwn ? "justify-end" : ""
                                    )}>
                                      {Array.from(reactions.entries()).map(([emoji, count]) => (
                                        <span
                                          key={emoji}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-200 rounded-full text-xs"
                                        >
                                          <span>{emoji}</span>
                                          <span className="text-gray-600">{count}</span>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                {/* Message Input */}
                <div className=" bg-white border-t border-gray-200"
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <>
                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileSelect}
                      className="hidden"
                      accept="*"
                    />

                    <ChatMessageInput
                      value={messageInput}
                      onChange={(plainText, html) => {
                        setMessageInput(plainText);
                        setRichHtmlContent(html);
                      }}
                      onSend={handleSendMessage}
                      onAttachmentClick={handleAttachmentClick}
                      placeholder="Type a message…"
                      disabled={false}
                      isUploading={isUploadingFile}
                      selectedFile={selectedFile}
                      filePreviewUrl={filePreviewUrl}
                      onRemoveFile={() => {
                        setSelectedFile(null);
                        setFilePreviewUrl(null);
                        if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    />
                  </>
                </div>
              </>
            ) : (
              /* Shared Documents Panel */
              <div className="flex-1 overflow-y-auto bg-[#f3f2f1] p-6">
                <div className="max-w-4xl mx-auto">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Shared Documents</h3>
                  {sharedDocuments.length === 0 ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-center">
                        <Paperclip className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">No shared documents</p>
                        <p className="text-xs text-gray-400 mt-1">Documents shared in this chat will appear here</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {sharedDocuments.map((doc) => (
                        <a
                          key={doc.id}
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all group"
                        >
                          <div className="h-12 w-12 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <Paperclip className="h-6 w-6 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600">
                              {doc.name}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Shared by {doc.sender.full_name || doc.sender.username} • {new Date(doc.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center bg-[#f3f2f1]">
            <div className="text-center max-w-sm">
              <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Welcome to Chat</h3>
              <p className="text-gray-600 text-sm">
                Select a user from the list to start messaging
              </p>
              <p className="text-xs text-gray-400 mt-4">
                {users.length} {users.length === 1 ? 'user' : 'users'} available
              </p>
            </div>
          </div>
        )}
      </div>
      {isCreateTeamModalOpen && (
        <CreateTeamModal
          isOpen={isCreateTeamModalOpen}
          onClose={() => setIsCreateTeamModalOpen(false)}
          onSuccess={() => {
            setIsCreateTeamModalOpen(false);
            queryClient.invalidateQueries({
              queryKey: ['team-chat-rooms'],
              refetchType: 'active'
            });
          }}
        />
      )}
    </div>
  );
}