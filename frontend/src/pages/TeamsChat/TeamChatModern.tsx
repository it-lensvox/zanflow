import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare, Search, Send, Paperclip, Smile, Phone, Video, Plus, Info,
  X, ChevronRight, ChevronDown, Users as UsersIcon, Briefcase, MoreVertical,
  Reply, Forward, Link2, Bookmark, Trash2, Pin, MailOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { usersApi, chatApi, GatewayWebSocketService } from '@/services/api';
import type { ChatRoom, ChatMessage, ChatRoomMessagesResponse, ToastNotification, GatewayIncomingMessage, ProjectChatRoom, TeamChatRoom, User } from '@/types';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { CreateTeamModal } from '@/pages/TeamManagement/Createteammodal';

// User status type
type UserStatus = 'online' | 'away' | 'busy' | 'offline';

// Extended user type with last message info
interface UserWithActivity extends User {
  lastMessageTime?: string;
  lastMessageContent?: string;
}

export function TeamChatModern() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  // UI State
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [selectedProjectRoom, setSelectedProjectRoom] = useState<ProjectChatRoom | null>(null);
  const [selectedTeamRoom, setSelectedTeamRoom] = useState<TeamChatRoom | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | number | null>(null);
  const [openMenuMessageId, setOpenMenuMessageId] = useState<string | number | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | number | null>(null);
  const [messageReactions, setMessageReactions] = useState<Map<string | number, Map<string, number>>>(new Map());
  const menuRef = useRef<HTMLDivElement>(null);

  // Unread tracking & notifications
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());
  const [toastNotifications, setToastNotifications] = useState<ToastNotification[]>([]);
  const [roomUserMap, setRoomUserMap] = useState<Map<string, number>>(new Map());
  const [userRoomMap, setUserRoomMap] = useState<Map<number, string>>(new Map());
  const [lastMessages, setLastMessages] = useState<Map<number, { content: string; timestamp: string }>>(new Map());
  const [chatListVersion, setChatListVersion] = useState(0);

  // Sidebar section states
  const [isChatSectionOpen, setIsChatSectionOpen] = useState(true);
  const [isProjectsSectionOpen, setIsProjectsSectionOpen] = useState(false);
  const [isTeamsSectionOpen, setIsTeamsSectionOpen] = useState(false);
  const [isCreateTeamModalOpen, setIsCreateTeamModalOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // WebSocket References
  const gatewaySocketRef = useRef<GatewayWebSocketService | null>(null);
  const isGatewayInitialized = useRef(false);
  const activeRoomRef = useRef<ChatRoom | null>(null);

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

  const teamRooms = teamRoomsData || [];

  // Map project rooms to ensure name field exists
  const normalizedProjectRooms = useMemo(() => {
    return (projectRoomsData || []).map(room => ({
      ...room,
      name: room.name || (room as any).project_name || (room as any).title || 'Unnamed Project'
    }));
  }, [projectRoomsData]);
  const projectRooms = normalizedProjectRooms;



  // Debug: Log project rooms data
  useEffect(() => {
    if (projectRoomsData) {
    }
  }, [projectRoomsData]);

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
          setLastMessages(prev => {
            const newMap = new Map(prev);
            newMap.set(chatListUserId!, { content: enrichedMessage.content, timestamp: enrichedMessage.created_at });
            setChatListVersion(v => v + 1);
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
            message_preview: enrichedMessage.content,
            timestamp: enrichedMessage.created_at
          };
          setToastNotifications(prev => [...prev, toast]);
        } else {
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
    queryFn: () => {
      const roomId = activeRoom?.id || selectedProjectRoom?.id || selectedTeamRoom?.id;
      return roomId
        ? chatApi.getRoomMessages(roomId)
        : Promise.resolve({ messages: [], count: 0, has_more: false });
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
    if (!messagesData?.messages) {
      return [];
    }

    const sortedMessages = [...messagesData.messages].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    return sortedMessages;
  }, [messagesData?.messages]);

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
        lastMessageContent: lastMsg?.content
      };
    });
  }, [users, lastMessages]);

  // unread first, then by last message time, then alphabetically
  const sortedUsers = useMemo(() => {
    return [...usersWithActivity].sort((a, b) => {
      // Get room IDs for both users
      const roomA = userRoomMap.get(a.id);
      const roomB = userRoomMap.get(b.id);

      // Priority 1: Unread messages
      const unreadA = roomA ? (unreadCounts.get(roomA) || 0) : 0;
      const unreadB = roomB ? (unreadCounts.get(roomB) || 0) : 0;

      if (unreadA !== unreadB) {
        return unreadB - unreadA;
      }

      // Priority 2: Last message time
      if (a.lastMessageTime && b.lastMessageTime) {
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
      }
      if (a.lastMessageTime) return -1;
      if (b.lastMessageTime) return 1;

      // Priority 3: Alphabetical by name
      const nameA = a.first_name || a.username;
      const nameB = b.first_name || b.username;
      return nameA.localeCompare(nameB);
    });
  }, [usersWithActivity, unreadCounts, userRoomMap, chatListVersion]);

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

  // Helper: Mock User Status 
  const getUserStatus = (userId: number): UserStatus => {
    return userId % 2 === 0 ? 'online' : 'offline';
  };

  // Select User -> Create/Get Room
  const handleUserSelect = (userId: number) => {
    if (selectedUserId === userId) return;

    // Reset project/team selections
    setSelectedProjectRoom(null);
    setSelectedTeamRoom(null);
    setSelectedUserId(userId);
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
    queryClient.resetQueries({ queryKey: ['chat-messages'] });
    queryClient.invalidateQueries({ queryKey: ['chat-messages', projectRoom.id] });
  };

  // Handler for team room click
  const handleTeamClick = async (teamRoom: TeamChatRoom) => {
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

    // CRITICAL FIX: Reset previous messages and fetch new ones
    queryClient.resetQueries({ queryKey: ['chat-messages'] });
    queryClient.invalidateQueries({ queryKey: ['chat-messages', teamRoom.id] });
  };


  // handler for emoji click
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setMessageInput((prev) => prev + emojiData.emoji);
    setShowEmojiPicker(false);
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

  // Handle reaction from picker
  const handleReactionFromPicker = (messageId: string | number, emojiData: EmojiClickData) => {
    handleQuickReaction(messageId, emojiData.emoji);
    setShowReactionPicker(null);
  };

  // Handle message actions
  const handleReplyWithQuote = (message: ChatMessage) => {
    setMessageInput(`> ${message.content}\n\n`);
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

  const handleDeleteMessage = (message: ChatMessage) => {
    if (confirm('Are you sure you want to delete this message?')) {
      setOpenMenuMessageId(null);
    }
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

  const toggleEmojiPicker = () => {
    setShowEmojiPicker((prev) => !prev);
  };

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  // Send on Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (messageInput.trim() || selectedFile) {
        handleSendMessage();
      }
    }
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);

      // Generate preview URL for images
      if (file.type.startsWith('image/')) {
        const previewUrl = URL.createObjectURL(file);
        setFilePreviewUrl(previewUrl);
      } else {
        setFilePreviewUrl(null);
      }
    }
  };

  // Handle attachment button click
  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
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
  const handleSendMessage = async () => {
    const content = messageInput.trim();
    const hasFile = selectedFile !== null;

    if (!content && !hasFile) {
      return;
    }

    const roomId = selectedProjectRoom?.id || selectedTeamRoom?.id || activeRoom?.id;

    // If there's a file attachment, use HTTP POST
    if (hasFile && roomId) {
      try {
        const response = await chatApi.sendMessageWithAttachment(roomId, {
          content: content || 'Sent an attachment',
          attachment: selectedFile!
        });

        // Update messages in cache
        queryClient.setQueryData(
          ['chat-messages', roomId],
          (oldData: ChatRoomMessagesResponse | undefined) => {
            const existingMessages = oldData?.messages || [];
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

        // Trigger re-render without refetch
        queryClient.invalidateQueries({ queryKey: ['chat-messages', roomId], refetchType: 'none' });

        // Reset states
        setMessageInput('');
        setSelectedFile(null);
        if (filePreviewUrl) {
          URL.revokeObjectURL(filePreviewUrl);
          setFilePreviewUrl(null);
        }
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        console.error('❌ [SEND ERROR] Failed to send message with attachment:', error);
      }
      return;
    }

    // Otherwise use WebSocket for text-only messages
    setMessageInput('');

    // Send via Gateway WebSocket if project room is selected
    if (selectedProjectRoom && gatewaySocketRef.current) {
      gatewaySocketRef.current.sendMessage(selectedProjectRoom.id, content);
      return;
    }

    // Send via Gateway WebSocket if team room is selected
    if (selectedTeamRoom && gatewaySocketRef.current) {
      gatewaySocketRef.current.sendMessage(selectedTeamRoom.id, content);
      return;
    }

    // Send via Gateway WebSocket for private rooms
    if (activeRoom && gatewaySocketRef.current) {
      gatewaySocketRef.current.sendMessage(activeRoom.id, content);
    } else {
      console.error('❌ [SEND ERROR] No active Gateway WebSocket connection');
    }
  };

  // Status Indicator Dot
  const StatusIndicator = ({ status }: { status: UserStatus }) => {
    const statusColors = {
      online: 'bg-green-500',
      away: 'bg-yellow-500',
      busy: 'bg-red-500',
      offline: 'bg-gray-400'
    };

    return (
      <div className={cn(
        "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white",
        statusColors[status]
      )} />
    );
  };

  // Toast Notification Component
  const ToastNotificationComponent = ({ toast }: { toast: ToastNotification }) => (
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

  return (
    <div className="flex h-screen bg-[#f3f2f1]">
      {/* Toast Notifications Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toastNotifications.map(toast => (
          <ToastNotificationComponent key={toast.id} toast={toast} />
        ))}
      </div>
      {/* Left Sidebar */}
      <div className="w-80 bg-[#f3f2f1] border-r border-gray-200 flex flex-col">
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

        {/* Scrollable User/Project/Team Lists */}
        <div className="flex-1 overflow-y-auto">
          {/* Chats Section */}
          <div className="bg-white">
            <button
              onClick={() => setIsChatSectionOpen(!isChatSectionOpen)}
              className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">Chats</span>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {filteredUsers.length}
                </span>
              </div>
              {isChatSectionOpen ? (
                <ChevronDown className="h-4 w-4 text-gray-600" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-600" />
              )}
            </button>

            {isChatSectionOpen && (
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
                    const status = getUserStatus(user.id);

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
                          <StatusIndicator status={status} />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {user.first_name || user.username}
                            </p>
                            {user.lastMessageTime && (
                              <span className="text-[10px] text-gray-500 ml-2 flex-shrink-0">
                                {new Date(user.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-600 truncate">
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
            )}
          </div>

          {/* Projects Section */}
          <div className="bg-white mt-1">
            <button
              onClick={() => setIsProjectsSectionOpen(!isProjectsSectionOpen)}
              className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">Projects</span>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {projectRooms.length}
                </span>
              </div>
              {isProjectsSectionOpen ? (
                <ChevronDown className="h-4 w-4 text-gray-600" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-600" />
              )}
            </button>

            {isProjectsSectionOpen && (
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
                            {project.last_message?.content_preview || 'No messages yet'}
                          </p>
                        </div>
                        {unreadCount > 0 && (
                          <span className="ml-2 flex-shrink-0 h-5 min-w-[20px] px-1.5 bg-blue-600 text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
                            {unreadCount}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Teams Section */}
          <div className="bg-white mt-1">
            <button
              onClick={() => setIsTeamsSectionOpen(!isTeamsSectionOpen)}
              className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <UsersIcon className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">Teams</span>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {teamRooms.length}
                </span>
              </div>
              {isTeamsSectionOpen ? (
                <ChevronDown className="h-4 w-4 text-gray-600" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-600" />
              )}
            </button>

            {isTeamsSectionOpen && (
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
                          <p className="text-xs text-gray-600 truncate">Team Chat</p>
                        </div>
                        {unreadCount > 0 && (
                          <span className="ml-2 flex-shrink-0 h-5 min-w-[20px] px-1.5 bg-blue-600 text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
                            {unreadCount}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - Chat View */}
      <div className="flex-1 flex flex-col bg-white">
        {(activeRoom || selectedProjectRoom || selectedTeamRoom) ? (
          <>
            {/* Chat Header */}
            <div className="h-14 px-6 flex items-center justify-between bg-white border-b border-gray-200">
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
                      <StatusIndicator status={getUserStatus(selectedUser.id)} />
                    </>
                  ) : null}
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-gray-900">
                    {selectedProjectRoom?.name || selectedTeamRoom?.name || (selectedUser ? `${selectedUser.first_name || selectedUser.username}` : '')}
                  </h3>
                  {selectedUser && (
                    <p className="text-xs text-gray-500 capitalize">{getUserStatus(selectedUser.id)}</p>
                  )}
                  {selectedProjectRoom && (
                    <p className="text-xs text-gray-500">Project Chat</p>
                  )}
                  {selectedTeamRoom && (
                    <p className="text-xs text-gray-500">Team Chat</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="p-2 hover:bg-gray-100 rounded transition-colors">
                  <Phone className="h-4 w-4 text-gray-600" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded transition-colors">
                  <Video className="h-4 w-4 text-gray-600" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded transition-colors">
                  <Info className="h-4 w-4 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto bg-[#efeae2] p-6">
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
                    const menuOpen = openMenuMessageId === message.id;
                    const reactions = messageReactions.get(message.id);

                    return (
                      <div
                        key={message.id}
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
                            <div
                              className={cn(
                                "px-3 py-2 rounded-lg text-sm break-words shadow-sm max-w-full",
                                isOwn
                                  ? "bg-[#005c4b] text-white rounded-br-none"
                                  : "bg-white text-gray-900 border border-gray-100 rounded-bl-none"
                              )}
                              style={{
                                minWidth: '60px',
                                wordBreak: 'break-word',
                                overflowWrap: 'break-word'
                              }}
                            >
                              {message.content}

                              {/* Attachment */}
                              {message.attachment && (
                                <div className="mt-2 pt-2 border-t border-blue-500">
                                  <a
                                    href={message.attachment}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-xs hover:underline"
                                  >
                                    <Paperclip className="h-3 w-3" />
                                    {message.attachment_name || 'Attachment'}
                                  </a>
                                </div>
                              )}
                            </div>

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

                                {/* Emoji Picker Popup */}
                                {showReactionPicker === message.id && (
                                  <div
                                    className={cn(
                                      "absolute top-full mt-1 z-50",
                                      isOwn ? "right-0" : "left-0"
                                    )}
                                  >
                                    <EmojiPicker
                                      onEmojiClick={(emojiData) => handleReactionFromPicker(message.id, emojiData)}
                                      width={280}
                                      height={350}
                                      searchPlaceHolder="Search emoji..."
                                      previewConfig={{ showPreview: false }}
                                    />
                                  </div>
                                )}

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
                                        onClick={() => handleDeleteMessage(message)}
                                        className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
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
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="p-4 bg-white border-t border-gray-200">
              <div className="flex items-center gap-2">
                {/* Attachment Button */}
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                    accept="*"
                  />
                  <button
                    onClick={handleAttachmentClick}
                    className="p-2 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                  >
                    <Paperclip className="h-5 w-5 text-gray-600" />
                  </button>
                </>

                {/* Input Area */}
                <div className="flex-1 relative">

                  {/* File Preview */}
                  {selectedFile && (
                    <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden max-w-[300px]">
                      {filePreviewUrl ? (
                        // Image Preview
                        <div className="relative">
                          <img
                            src={filePreviewUrl}
                            alt="Preview"
                            className="w-full h-auto max-h-[200px] object-contain bg-gray-50"
                          />
                          <button
                            onClick={() => {
                              setSelectedFile(null);
                              setFilePreviewUrl(null);
                              if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className="absolute top-2 right-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full p-1.5 transition-all"
                          >
                            <X className="h-4 w-4" />
                          </button>
                          <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
                            <p className="text-xs text-gray-700 truncate font-medium">
                              {selectedFile.name}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {(selectedFile.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                      ) : (
                        // Non-Image File Preview
                        <div className="p-3 flex items-center gap-3">
                          <div className="bg-blue-100 p-2 rounded">
                            <Paperclip className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-900 font-medium truncate">
                              {selectedFile.name}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {(selectedFile.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedFile(null);
                              setFilePreviewUrl(null);
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type a message"
                    rows={1}
                    className="w-full px-3 py-2 pr-24 text-sm border border-gray-300 rounded resize-none focus:outline-none focus:border-blue-500 max-h-32"
                    style={{ fieldSizing: 'content' } as any}
                  />

                  {/* Right side buttons in input */}
                  <div className="absolute right-2 bottom-2 flex items-center gap-1" ref={emojiPickerRef}>
                    <button
                      onClick={toggleEmojiPicker}
                      className={cn(
                        "p-1.5 rounded transition-colors",
                        showEmojiPicker ? "bg-blue-100" : "hover:bg-gray-100"
                      )}
                    >
                      <Smile className={cn(
                        "h-4 w-4",
                        showEmojiPicker ? "text-blue-600" : "text-gray-600"
                      )} />
                    </button>

                    {/* Emoji Picker Popup */}
                    {showEmojiPicker && (
                      <div className="absolute bottom-full right-0 mb-2 z-50">
                        <EmojiPicker
                          onEmojiClick={handleEmojiClick}
                          width={320}
                          height={400}
                          searchPlaceHolder="Search emoji..."
                          previewConfig={{ showPreview: false }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Send Button */}
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() && !selectedFile}
                  className={cn(
                    'p-2.5 rounded transition-colors flex-shrink-0',
                    (messageInput.trim() || selectedFile)
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  )}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
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
      {
        isCreateTeamModalOpen && (
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
        )
      }
    </div >
  );
}