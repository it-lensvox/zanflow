import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare, Search, Send, Paperclip, Smile, Phone, Video, Plus, Info, Filter,
  Image, X, ChevronRight, ChevronDown, Users as UsersIcon, Briefcase
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { usersApi, chatApi, ChatWebSocketService, GlobalChatWebSocketService } from '@/services/api';
import type { ChatRoom, ChatMessage, ChatRoomMessagesResponse, ToastNotification, WebSocketGlobalMessage, ProjectChatRoom, TeamChatRoom, User } from '@/types';
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
  const socketRef = useRef<ChatWebSocketService | null>(null);
  const globalSocketRef = useRef<GlobalChatWebSocketService | null>(null);
  const isGlobalSocketInitialized = useRef(false);
  const activeRoomRef = useRef<ChatRoom | null>(null);
  const projectSocketRef = useRef<ChatWebSocketService | null>(null);
  const teamSocketRef = useRef<ChatWebSocketService | null>(null);

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
  const projectRooms = projectRoomsData || [];

  // 2. Initialize Global WebSocket ONCE on Mount
  useEffect(() => {
    if (!currentUser || isGlobalSocketInitialized.current) {
      return;
    }

    console.log('🔌 Initializing Global WebSocket for user:', currentUser.username);
    isGlobalSocketInitialized.current = true;

    const globalSocket = new GlobalChatWebSocketService();
    globalSocket.connect();
    globalSocketRef.current = globalSocket;

    globalSocket.onMessage((data: WebSocketGlobalMessage) => {
      const { type, message, room_id } = data;
      const actualRoomId = room_id || message?.room;

      if (type === 'chat_message' && message && actualRoomId) {
        const isOwnMessage = message.sender.id === currentUser?.id;

        // 1. Update last messages for the sidebar
        let chatListUserId: number | null = null;
        if (isOwnMessage) {
          const roomData = queryClient.getQueryData<ChatRoom>(['chat-room', actualRoomId]);
          chatListUserId = roomData?.participants?.find(p => p.id !== currentUser?.id)?.id || null;
        } else {
          chatListUserId = message.sender.id;
        }

        if (chatListUserId) {
          setLastMessages(prev => {
            const newMap = new Map(prev);
            newMap.set(chatListUserId!, { content: message.content, timestamp: message.created_at });
            setChatListVersion(v => v + 1);
            return newMap;
          });
        }

        // 2. Update the specific room's message cache
        queryClient.setQueryData(['chat-messages', actualRoomId], (oldData: ChatRoomMessagesResponse | undefined) => {
          const existingMessages = oldData?.messages || [];
          if (existingMessages.some(m => m.id === message.id)) return oldData;

          const updatedMessages = [...existingMessages, message].sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );

          return { ...oldData, messages: updatedMessages, count: updatedMessages.length, has_more: oldData?.has_more ?? false };
        });

        // 3. Trigger immediate UI update if it's the active room
        if (actualRoomId === activeRoomRef.current?.id) {
          queryClient.invalidateQueries({ queryKey: ['chat-messages', actualRoomId], refetchType: 'none' });
        } else {
          setUnreadCounts(prev => {
            const newMap = new Map(prev);
            newMap.set(actualRoomId, (newMap.get(actualRoomId) || 0) + 1);
            return newMap;
          });

          const toast: ToastNotification = {
            id: `${Date.now()}`,
            room_id: actualRoomId,
            sender_name: message.sender.full_name || message.sender.username,
            message_preview: message.content,
            timestamp: message.created_at
          };
          setToastNotifications(prev => [...prev, toast]);
        }
      }
    });

    // Cleanup on unmount
    return () => {
      console.log('🧹 Cleaning up Global WebSocket');
      globalSocket.disconnect();
      isGlobalSocketInitialized.current = false;
    };
  }, [currentUser?.id, queryClient]);

  // 3. Mutation: Create or Get Private Room
  const createRoomMutation = useMutation({
    mutationFn: (userId: number) => chatApi.createPrivateRoom(userId),
    onSuccess: (roomData, userId) => {
      console.log('✅ Room created/retrieved:', roomData.id);
      setActiveRoom(roomData);
      activeRoomRef.current = roomData;

      // Cache the room data for later participant lookup
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
      console.error("Failed to load chat room", error);
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
  });

  // 5. Room-specific WebSocket
  useEffect(() => {
    if (!activeRoom?.id) return;

    console.log('🔌 Connecting to room-specific WebSocket:', activeRoom.id);

    const socket = new ChatWebSocketService();
    socket.connect(activeRoom.id);
    socketRef.current = socket;

    // Clear unread count when opening a room
    setUnreadCounts(prev => {
      const newMap = new Map(prev);
      newMap.delete(activeRoom.id);
      return newMap;
    });

    socket.onMessage((newMessage) => {
      queryClient.setQueryData(['chat-messages', activeRoom.id], (old: ChatRoomMessagesResponse | undefined) => {
        if (!old) return { messages: [newMessage], count: 1, has_more: false };
        if (old.messages.some(m => m.id === newMessage.id)) return old;

        return {
          ...old,
          messages: [...old.messages, newMessage].sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          ),
          count: old.messages.length + 1
        };
      });

      // Explicitly notify the query to re-render
      queryClient.invalidateQueries({ queryKey: ['chat-messages', activeRoom.id], refetchType: 'none' });
    });

    return () => {
      console.log('🧹 Disconnecting from room WebSocket:', activeRoom.id);
      socket.disconnect();
    };
  }, [activeRoom?.id, queryClient]);

  const messages = useMemo(() => {
    if (!messagesData?.messages) return [];

    // Always sort messages by timestamp 
    return [...messagesData.messages].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [messagesData?.messages]);

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

    console.log('👤 User selected:', userId);

    // Clean up project and team sockets when switching to chat
    if (projectSocketRef.current) {
      console.log('🧹 Cleaning up Project WebSocket (switching to chat)');
      projectSocketRef.current.disconnect();
      projectSocketRef.current = null;
    }
    if (teamSocketRef.current) {
      console.log('🧹 Cleaning up Team WebSocket (switching to chat)');
      teamSocketRef.current.disconnect();
      teamSocketRef.current = null;
    }

    // Reset project/team selections
    setSelectedProjectRoom(null);
    setSelectedTeamRoom(null);

    setSelectedUserId(userId);
    setActiveRoom(null);
    activeRoomRef.current = null;
    createRoomMutation.mutate(userId);
  };

  // Handler for project room click
  const handleProjectClick = async (projectRoom: ProjectChatRoom) => {
    console.log('📂 Project room selected:', projectRoom.name, projectRoom.id);

    // Clean up existing sockets
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    if (projectSocketRef.current) {
      projectSocketRef.current.disconnect();
      projectSocketRef.current = null;
    }
    if (teamSocketRef.current) {
      teamSocketRef.current.disconnect();
      teamSocketRef.current = null;
    }

    // Reset states
    setSelectedUserId(null);
    setSelectedTeamRoom(null);
    setSelectedProjectRoom(projectRoom);
    setActiveRoom(null);

    // Clear unread count for this room
    setUnreadCounts(prev => {
      const newMap = new Map(prev);
      newMap.set(projectRoom.id, 0);
      return newMap;
    });

    // Fetch messages for this project room
    queryClient.invalidateQueries({ queryKey: ['chat-messages', projectRoom.id] });

    // Initialize WebSocket for project room
    const projectSocket = new ChatWebSocketService();
    projectSocket.connect(projectRoom.id);
    projectSocketRef.current = projectSocket;

    // Register message callback
    projectSocket.onMessage((newMessage: ChatMessage) => {
      console.log('📩 Project WS received:', newMessage);
      queryClient.setQueryData(
        ['chat-messages', projectRoom.id],
        (oldData: ChatRoomMessagesResponse | undefined) => {
          const existingMessages = oldData?.messages || [];
          if (existingMessages.some(m => m.id === newMessage.id)) return oldData;

          const updatedMessages = [...existingMessages, newMessage].sort(
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
      queryClient.invalidateQueries({ queryKey: ['chat-messages', projectRoom.id], refetchType: 'none' });
    });
  };

  // Handler for team room click
  const handleTeamClick = async (teamRoom: TeamChatRoom) => {
    console.log('🏢 Team room selected:', teamRoom.name, teamRoom.id);

    // Clean up existing sockets
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    if (projectSocketRef.current) {
      projectSocketRef.current.disconnect();
      projectSocketRef.current = null;
    }
    if (teamSocketRef.current) {
      teamSocketRef.current.disconnect();
      teamSocketRef.current = null;
    }

    // Reset states
    setSelectedUserId(null);
    setSelectedProjectRoom(null);
    setSelectedTeamRoom(teamRoom);
    setActiveRoom(null);

    // Clear unread count for this room
    setUnreadCounts(prev => {
      const newMap = new Map(prev);
      newMap.set(teamRoom.id, 0);
      return newMap;
    });

    // Fetch messages for this team room
    queryClient.invalidateQueries({ queryKey: ['chat-messages', teamRoom.id] });

    // Initialize WebSocket for team room
    const teamSocket = new ChatWebSocketService();
    teamSocket.connect(teamRoom.id);
    teamSocketRef.current = teamSocket;

    // Register message callback
    teamSocket.onMessage((newMessage: ChatMessage) => {
      console.log('📩 Team WS received:', newMessage);
      queryClient.setQueryData(
        ['chat-messages', teamRoom.id],
        (oldData: ChatRoomMessagesResponse | undefined) => {
          const existingMessages = oldData?.messages || [];
          if (existingMessages.some(m => m.id === newMessage.id)) return oldData;

          const updatedMessages = [...existingMessages, newMessage].sort(
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
      queryClient.invalidateQueries({ queryKey: ['chat-messages', teamRoom.id], refetchType: 'none' });
    });
  };

  // Send Message
  const handleSendMessage = async () => {
    const content = messageInput.trim();
    const hasFile = selectedFile !== null;

    if (!content && !hasFile) return;

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
        console.error('Failed to send message with attachment:', error);
      }
      return;
    }

    // Otherwise use WebSocket for text-only messages
    setMessageInput('');

    // Send via Project WebSocket if project room is selected
    if (selectedProjectRoom && projectSocketRef.current) {
      projectSocketRef.current.sendMessage(content);
      return;
    }

    // Send via Team WebSocket if team room is selected
    if (selectedTeamRoom && teamSocketRef.current) {
      teamSocketRef.current.sendMessage(content);
      return;
    }

    // Send via Chat WebSocket for private rooms
    if (activeRoom && socketRef.current) {
      socketRef.current.sendMessage(content);
    } else {
      console.error('No active WebSocket connection');
    }
  };


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
            <button className="p-2 hover:bg-gray-100 rounded transition-colors">
              <Filter className="h-4 w-4 text-gray-600" />
            </button>
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-gray-100 border-0 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Collapsible Sections */}
        <div className="flex-1 overflow-y-auto">
          {/* Chat Section */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => setIsChatSectionOpen(!isChatSectionOpen)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isChatSectionOpen ? (
                  <ChevronDown className="h-4 w-4 text-gray-600" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                )}
                <MessageSquare className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-semibold text-gray-900">Chats</span>
              </div>
              <span className="text-xs text-gray-500">{users.length}</span>
            </button>

            {isChatSectionOpen && (
              <div className="bg-white">
                {isLoadingUsers ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <MessageSquare className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No users available</p>
                  </div>
                ) : (
                  users.map((user) => {
                    const isActive = selectedUserId === user.id;
                    const roomId = userRoomMap.get(user.id);
                    const unreadCount = roomId ? unreadCounts.get(roomId) || 0 : 0;
                    const lastMsg = lastMessages.get(user.id);

                    return (
                      <div
                        key={user.id}
                        onClick={() => handleUserSelect(user.id)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors relative",
                          isActive
                            ? "bg-blue-50 border-l-3 border-l-blue-600"
                            : "hover:bg-gray-50"
                        )}
                      >
                        <div className="relative flex-shrink-0">
                          <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center font-semibold text-blue-700 text-sm">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          <StatusIndicator status={getUserStatus(user.id)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className={cn(
                              "text-sm truncate",
                              isActive ? "font-semibold text-gray-900" : "font-medium text-gray-900"
                            )}>
                              {user.first_name || user.last_name
                                ? `${user.first_name} ${user.last_name}`.trim()
                                : user.username}
                            </p>
                            {lastMsg && (
                              <span className="text-[10px] text-gray-500 ml-2 flex-shrink-0">
                                {new Date(lastMsg.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            {lastMsg ? (
                              <p className="text-xs text-gray-600 truncate">
                                {lastMsg.content}
                              </p>
                            ) : (
                              <p className="text-xs text-gray-500 truncate">
                                {user.email}
                              </p>
                            )}
                            {unreadCount > 0 && (
                              <span className="ml-2 flex-shrink-0 h-5 min-w-[20px] px-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                {unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Projects Section */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => setIsProjectsSectionOpen(!isProjectsSectionOpen)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isProjectsSectionOpen ? (
                  <ChevronDown className="h-4 w-4 text-gray-600" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                )}
                <Briefcase className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-semibold text-gray-900">Projects</span>
              </div>
              <span className="text-xs text-gray-500">{projectRooms.length}</span>
            </button>

            {isProjectsSectionOpen && (
              <div className="bg-white">
                {isLoadingProjects ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  </div>
                ) : projectRooms.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <Briefcase className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No project rooms available</p>
                  </div>
                ) : (
                  projectRooms.map((room: ProjectChatRoom) => {
                    const isActive = activeRoom?.id === room.id;

                    return (
                      <div
                        key={room.id}
                        onClick={() => handleProjectClick(room)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors relative",
                          isActive
                            ? "bg-blue-50 border-l-3 border-l-blue-600"
                            : "hover:bg-gray-50"
                        )}
                      >
                        <div className="relative flex-shrink-0">
                          <div className={cn(
                            "h-9 w-9 rounded bg-purple-100 flex items-center justify-center font-semibold text-sm",
                            isActive ? "bg-purple-600 text-white" : "text-purple-700"
                          )}>
                            {room.name.charAt(0).toUpperCase()}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className={cn(
                              "text-sm truncate",
                              isActive ? "font-semibold text-gray-900" : "font-medium text-gray-900"
                            )}>
                              {room.name}
                            </p>
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {room.participant_count} {room.participant_count === 1 ? 'member' : 'members'}
                          </p>
                        </div>
                        {room.unread_count > 0 && (
                          <span className="ml-2 flex-shrink-0 h-5 min-w-[20px] px-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {room.unread_count}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Teams & Channels Section */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => setIsTeamsSectionOpen(!isTeamsSectionOpen)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isTeamsSectionOpen ? (
                  <ChevronDown className="h-4 w-4 text-gray-600" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                )}
                <UsersIcon className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-semibold text-gray-900">Teams & Channels</span>
              </div>
              <span className="text-xs text-gray-500">{teamRooms.length}</span>
            </button>

            {isTeamsSectionOpen && (
              <div className="bg-white">
                {isLoadingTeams ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  </div>
                ) : teamRooms.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <UsersIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No teams available</p>
                  </div>
                ) : (
                  teamRooms.map((room: TeamChatRoom) => {
                    const isActive = activeRoom?.id === room.id;

                    return (
                      <div
                        key={room.id}
                        onClick={() => handleTeamClick(room)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors relative",
                          isActive
                            ? "bg-blue-50 border-l-3 border-l-blue-600"
                            : "hover:bg-gray-50"
                        )}
                      >
                        <div className="relative flex-shrink-0">
                          <div className={cn(
                            "h-9 w-9 rounded bg-green-100 flex items-center justify-center font-semibold text-sm",
                            isActive ? "bg-green-600 text-white" : "text-green-700"
                          )}>
                            {room.name.charAt(0).toUpperCase()}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className={cn(
                              "text-sm truncate",
                              isActive ? "font-semibold text-gray-900" : "font-medium text-gray-900"
                            )}>
                              {room.name}
                            </p>
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {room.participant_count} {room.participant_count === 1 ? 'member' : 'members'}
                          </p>
                        </div>
                        {room.unread_count > 0 && (
                          <span className="ml-2 flex-shrink-0 h-5 min-w-[20px] px-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {room.unread_count}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Side */}
      <div className="flex-1 flex flex-col bg-white">
        {(selectedUser || selectedProjectRoom || selectedTeamRoom) ? (
          <>
            {/* Chat Header */}
            <div className="h-14 px-4 flex items-center justify-between bg-white border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="relative">
                  {selectedUser ? (
                    <>
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center font-semibold text-blue-700 text-sm">
                        {selectedUser.username.charAt(0).toUpperCase()}
                      </div>
                      <StatusIndicator status={getUserStatus(selectedUser.id)} />
                    </>
                  ) : selectedProjectRoom ? (
                    <div className="h-8 w-8 rounded bg-purple-100 flex items-center justify-center font-semibold text-purple-700 text-sm">
                      {selectedProjectRoom?.name.charAt(0).toUpperCase()}
                    </div>
                  ) : selectedTeamRoom ? (
                    <div className="h-8 w-8 rounded bg-green-100 flex items-center justify-center font-semibold text-green-700 text-sm">
                      {selectedTeamRoom?.name.charAt(0).toUpperCase()}
                    </div>
                  ) : null}
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-gray-900">
                    {selectedUser
                      ? (selectedUser.first_name || selectedUser.last_name
                        ? `${selectedUser.first_name} ${selectedUser.last_name}`.trim()
                        : selectedUser.username)
                      : selectedProjectRoom?.name || selectedTeamRoom?.name
                    }
                  </h3>
                  <p className="text-xs text-gray-600 capitalize">
                    {selectedUser
                      ? `${getUserStatus(selectedUser.id)} • ${selectedUser.role}`
                      : `${selectedProjectRoom?.participant_count || selectedTeamRoom?.participant_count} members`
                    }
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button className="p-2 hover:bg-gray-100 rounded transition-colors">
                  <Video className="h-4 w-4 text-gray-600" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded transition-colors">
                  <Phone className="h-4 w-4 text-gray-600" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded transition-colors">
                  <Info className="h-4 w-4 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-[#f3f2f1]">
              {createRoomMutation.isPending ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <MessageSquare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-base font-medium text-gray-600">Start the conversation</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {selectedUser
                        ? `Say hi to ${selectedUser?.first_name || selectedUser?.username}`
                        : selectedProjectRoom
                          ? `Start discussing ${selectedProjectRoom.name}`
                          : selectedTeamRoom
                            ? `Start chatting in ${selectedTeamRoom.name}`
                            : 'Start the conversation'
                      }
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg: ChatMessage) => {
                    const isMe = msg.is_own_message ?? (msg.sender.id === currentUser?.id);

                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex items-start gap-2",
                          isMe ? "justify-end" : "justify-start"
                        )}
                      >
                        {/* Avatar on left for receiver, right for sender */}
                        {!isMe && (
                          <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center font-semibold text-gray-700 text-xs flex-shrink-0 mt-1">
                            {msg.sender.username.charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div className={cn(
                          "max-w-[70%] rounded-lg p-3",
                          isMe
                            ? "bg-blue-600 text-white"
                            : "bg-white text-gray-900 shadow-sm border border-gray-200"
                        )}>
                          {!isMe && (
                            <p className="text-[10px] font-semibold text-gray-600 mb-1">
                              {msg.sender.full_name || msg.sender.username}
                            </p>
                          )}

                          {/* Display attachment if present */}
                          {msg.attachment && msg.message_type === 'image' && (
                            <div className="mb-2">
                              <img
                                src={msg.attachment}
                                alt={msg.attachment_name || 'Attachment'}
                                className="max-w-full rounded cursor-pointer"
                                style={{ maxHeight: '300px' }}
                                onClick={() => window.open(msg.attachment!, '_blank')}
                              />
                            </div>
                          )}

                          {msg.attachment && msg.message_type !== 'image' && (
                            <a
                              href={msg.attachment}

                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                "flex items-center gap-2 mb-2 p-2 rounded",
                                isMe ? "bg-blue-700" : "bg-gray-100"
                              )}
                            >
                              <Paperclip className="h-4 w-4" />
                              <span className="text-xs truncate max-w-[200px]">
                                {msg.attachment_name || 'Download'}
                              </span>
                            </a>
                          )}

                          {msg.content && <p className="text-sm break-words">{msg.content}</p>}

                          <span className={cn(
                            "text-[10px] block mt-1",
                            isMe ? "text-blue-100 text-right" : "text-gray-500 text-left"
                          )}>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* Avatar on right for sender */}
                        {
                          isMe && (
                            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center font-semibold text-white text-xs flex-shrink-0 mt-1">
                              {currentUser?.username.charAt(0).toUpperCase()}
                            </div>
                          )
                        }
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="p-4 bg-white border-t border-gray-200">
              <div className="flex items-end gap-2">
                {/* Attachment Button */}
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
                  />
                  <button
                    onClick={handleAttachmentClick}
                    className="p-2 hover:bg-gray-100 rounded transition-colors"
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
                  <div className="absolute right-2 bottom-2 flex items-center gap-1">
                    <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
                      <Smile className="h-4 w-4 text-gray-600" />
                    </button>
                  </div>
                </div>

                {/* Send Button */}
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() && !selectedFile}
                  className={cn(
                    'p-2.5 rounded transition-colors',
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
      {/* Create Team Modal */}
      {isCreateTeamModalOpen && (
        <CreateTeamModal
          isOpen={isCreateTeamModalOpen}
          onClose={() => setIsCreateTeamModalOpen(false)}
          onSuccess={() => {
            setIsCreateTeamModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['team-chat-rooms'] });
          }}
        />
      )}
    </div >
  );
}