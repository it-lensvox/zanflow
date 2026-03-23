import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageCircle, Send, Search, Maximize2, Plus,
  ChevronDown, Clock, Trash2, PanelLeftOpen, PanelLeftClose
} from 'lucide-react';
import { threadsApi, threadsStorageApi, getTokens, authApi } from '@/services/api';
import type { ThreadSession, ThreadsProps } from '@/types';
import DeleteModal from '@/components/common/Deletemodal';


// MAIN COMPONENT
export default function Threads({ projectId, projectName }: ThreadsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [lastExpandedTime, setLastExpandedTime] = useState<number>(Date.now());
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [deletePermissionDenied, setDeletePermissionDenied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sessions, setSessions] = useState<ThreadSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const activeSessionIdRef = useRef<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  // GET CURRENT USER ID
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const user = await authApi.getMe();
        setCurrentUserId(user.id);
      } catch (error) {
        console.error('❌ Failed to fetch current user:', error);
      }
    };

    fetchCurrentUser();
  }, []);

  // LOAD & PERSIST DATA

  useEffect(() => {
    const loadThreads = async () => {
      try {
        // 1. Fetch real threads from backend
        const backendThreads = await threadsApi.getProjectThreads(projectId);

        // 2. Get localStorage data for message history
        const storage = threadsStorageApi.getProjectThreads(projectId);

        // 3. Fetch authoritative unread counts from API scoped to this project
        let apiUnreadMap: Record<string, number> = {};
        try {
          apiUnreadMap = await threadsApi.getThreadUnreadCounts(projectId);
        } catch {
        }

        // 4. Map backend threads to UI state, merging API unread counts
        const activeSessions: ThreadSession[] = backendThreads.map(room => {
          const existingSession = storage.sessions.find(s => s.room_id === room.id);

          // API unread map is authoritative; fall back to room.unread_count from list
          const unreadCount = apiUnreadMap[room.id] ?? room.unread_count ?? 0;

          return {
            id: room.id,
            room_id: room.id,
            slug: room.slug,
            projectId: projectId,
            title: room.name,
            messages: existingSession?.messages || [],
            createdAt: new Date(room.created_at),
            updatedAt: new Date(room.updated_at),
            unreadCount,
            lastReadAt: existingSession?.lastReadAt || new Date(),
            createdById: room.created_by?.id,
          };
        });
        setSessions(activeSessions);

        // 4. Set active session
        if (activeSessions.length > 0) {
          const lastSession = storage.lastActiveSessionId
            ? activeSessions.find(s => s.id === storage.lastActiveSessionId)
            : activeSessions[activeSessions.length - 1];

          setActiveSessionId(lastSession?.id || activeSessions[0].id);
        }
      } catch (error) {
        console.error('❌ Failed to load threads:', error);

        // Fallback to localStorage if API fails
        const storage = threadsStorageApi.getProjectThreads(projectId);
        const migratedSessions = storage.sessions.map(session => ({
          ...session,
          unreadCount: session.unreadCount ?? 0,
          lastReadAt: session.lastReadAt ?? new Date(),
        }));

        setSessions(migratedSessions);

        if (migratedSessions.length > 0) {
          const lastSession = storage.lastActiveSessionId
            ? migratedSessions.find(s => s.id === storage.lastActiveSessionId)
            : migratedSessions[migratedSessions.length - 1];

          setActiveSessionId(lastSession?.id || migratedSessions[0].id);
        }
      }
    };

    loadThreads();
  }, [projectId]);

  useEffect(() => {
    if (sessions.length > 0) {
      threadsStorageApi.saveProjectThreads(projectId, {
        sessions,
        lastActiveSessionId: activeSessionId,
      });
    }
  }, [sessions, activeSessionId, projectId]);

  // WEBSOCKET CONNECTION -
  useEffect(() => {
    const tokens = getTokens();
    if (!tokens?.access || !currentUserId) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const ws = threadsApi.connectThreadSocket(tokens.access);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      // Handle chat messages
      const incomingMessage = threadsApi.parseIncomingMessage(event);
      if (incomingMessage) {
        if (!currentUserId) {
          console.warn('⚠️ Message received but currentUserId not yet loaded, skipping...');
          return;
        }

        const uiMessage = threadsApi.convertToUIMessage(incomingMessage.data, currentUserId);
        const isSentByMe = incomingMessage.data.sender?.id === currentUserId;

        setSessions(prev => {
          const updated = prev.map(session => {
            if (session.room_id === incomingMessage.data.room_id) {
              const isActiveSession = session.id === activeSessionIdRef.current;
              const messageExists = session.messages.some(msg => msg.id === uiMessage.id);
              if (messageExists) {
                return session;
              }
              const shouldIncrementUnread =
                !isSentByMe &&
                !(isActiveSession && isExpanded);

              return {
                ...session,
                messages: [...session.messages, uiMessage],
                updatedAt: new Date(),
                unreadCount: shouldIncrementUnread ? session.unreadCount + 1 : session.unreadCount,
              };
            }
            return session;
          });
          return updated;
        });
      }
      const unreadSignal = threadsApi.parseUnreadSignal(event);
      if (unreadSignal) {
        setSessions(prev =>
          prev.map(session =>
            session.room_id === unreadSignal.data.room_id
              ? {
                ...session,
                unreadCount: (session.id === activeSessionIdRef.current && isExpanded)
                  ? 0
                  : unreadSignal.data.thread_unread,
              }
              : session
          )
        );
      }
    };

    ws.onerror = (error) => {
      setWsConnected(false);
    };

    ws.onclose = () => {
      setWsConnected(false);
      wsRef.current = null;
    };
    return () => {
    };
  }, [currentUserId]);


  // Join ALL rooms
  useEffect(() => {
    if (!wsConnected || !wsRef.current || sessions.length === 0) return;
    sessions.forEach(session => {
      if (session.slug) {
        threadsApi.joinThreadRoom(wsRef.current!, session.slug);
      }
    });
  }, [wsConnected, sessions.length]);

  // Always keep the ref in sync — needed by WS handler regardless of expanded state
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  // Auto-mark active session as read ONLY when the widget is open and visible.
  useEffect(() => {
    if (!activeSessionId || !isExpanded) return;

    // Only reset if messages have already been loaded for this session
    setSessions(prev =>
      prev.map(session => {
        if (session.id === activeSessionId && session.messages.length > 0) {
          return { ...session, unreadCount: 0, lastReadAt: new Date() };
        }
        return session;
      })
    );
  }, [activeSessionId, isExpanded]);

  // Load historical messages when switching to a thread
  useEffect(() => {
    const loadMessages = async () => {
      if (!activeSessionId || !currentUserId) return;

      const activeSession = sessions.find(s => s.id === activeSessionId);
      if (!activeSession) return;

      try {
        const response = await threadsApi.getThreadMessages(activeSession.room_id);

        // Convert backend messages to UI format
        const uiMessages = response.messages.map(msg =>
          threadsApi.convertBackendMessageToUI(msg, currentUserId)
        );

        // Update session with loaded messages
        setSessions(prev =>
          prev.map(session => {
            if (session.id === activeSessionId) {
              const existingIds = new Set(session.messages.map(m => m.id));
              const wsOnlyMessages = session.messages.filter(m =>
                !uiMessages.some(apiMsg => apiMsg.id === m.id)
              );
              const combinedMessages = [...uiMessages, ...wsOnlyMessages]
                .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
              return {
                ...session,
                messages: combinedMessages,
                unreadCount: isExpanded ? 0 : session.unreadCount,
                lastReadAt: isExpanded ? new Date() : session.lastReadAt,
              };
            }
            return session;
          })
        );

        // Scroll to bottom
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } catch (error) {
        console.error('❌ Failed to load messages:', error);
      }
    };

    loadMessages();
  }, [activeSessionId, currentUserId]);

  useEffect(() => {
    const reloadAllMessages = async () => {
      if (!isExpanded || !currentUserId || sessions.length === 0) return;

      let apiUnreadMap: Record<string, number> = {};
      try {
        apiUnreadMap = await threadsApi.getThreadUnreadCounts(projectId);
      } catch {
      }
      for (const session of sessions) {
        try {
          const response = await threadsApi.getThreadMessages(session.room_id);
          const uiMessages = response.messages.map(msg =>
            threadsApi.convertBackendMessageToUI(msg, currentUserId)
          );

          setSessions(prev =>
            prev.map(s => {
              if (s.id === session.id) {
                const wsOnlyMessages = s.messages.filter(m =>
                  !uiMessages.some(apiMsg => apiMsg.id === m.id)
                );
                const combinedMessages = [...uiMessages, ...wsOnlyMessages]
                  .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

                const unreadCount = s.id === activeSessionId && isExpanded
                  ? 0
                  : (apiUnreadMap[s.room_id] ?? s.unreadCount);

                return { ...s, messages: combinedMessages, unreadCount };
              }
              return s;
            })
          );
        } catch (error) {
          console.error(`❌ Failed to reload messages for ${session.title}:`, error);
        }
      }
    };

    reloadAllMessages();
  }, [lastExpandedTime]);

  // SESSION MANAGEMENT
  const createNewSession = useCallback(async () => {
    const title = `Thread ${sessions.length + 1}`;

    try {
      const threadRoom = await threadsApi.createThreadRoom({
        project_id: projectId,
        name: title,
      });

      const newSession: ThreadSession = {
        id: threadRoom.id,
        room_id: threadRoom.id,
        slug: threadRoom.slug,
        projectId,
        title: threadRoom.name,
        messages: [],
        createdAt: new Date(threadRoom.created_at),
        updatedAt: new Date(threadRoom.updated_at),
        unreadCount: 0,
        lastReadAt: new Date(),
      };

      setSessions(prev => [...prev, newSession]);
      setActiveSessionId(newSession.id);
      setShowHistory(false);
      setSearchQuery('');
    } catch (error) {
    }
  }, [projectId, sessions.length]);

  const switchSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setShowHistory(false);
    setSearchQuery('');

    // Mark session as read
    setSessions(prev =>
      prev.map(session =>
        session.id === sessionId
          ? { ...session, unreadCount: 0, lastReadAt: new Date() }
          : session
      )
    );
  }, []);

  const deleteSession = useCallback((sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    // Check if current user is the creator
    if (session.createdById && currentUserId && session.createdById !== currentUserId) {
      setDeletePermissionDenied(true);
      return;
    }
    // Show confirmation modal
    setSessionToDelete(sessionId);
    setDeleteModalOpen(true);
  }, [sessions, currentUserId]);

  const confirmDelete = useCallback(async () => {
    if (!sessionToDelete) return;

    setIsDeleting(true);
    try {
      const session = sessions.find(s => s.id === sessionToDelete);
      if (!session) return;
      // Call delete API
      await threadsApi.deleteThreadRoom(session.room_id);
      const remainingSessions = sessions.filter(s => s.id !== sessionToDelete);
      setSessions(remainingSessions);

      // Update active session if needed
      if (activeSessionId === sessionToDelete) {
        if (remainingSessions.length > 0) {
          setActiveSessionId(remainingSessions[remainingSessions.length - 1].id);
        } else {
          setActiveSessionId(null);
        }
      }

      // Close modal
      setDeleteModalOpen(false);
      setSessionToDelete(null);
    } catch (error) {
      console.error('❌ Failed to delete thread:', error);
      alert('Failed to delete thread. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }, [sessionToDelete, sessions, activeSessionId]);

  const cancelDelete = useCallback(() => {
    setDeleteModalOpen(false);
    setSessionToDelete(null);
  }, []);

  const closePermissionDenied = useCallback(() => {
    setDeletePermissionDenied(false);
  }, []);

  const updateSessionTitle = useCallback((sessionId: string, newTitle: string) => {
    setSessions(prev =>
      prev.map(session =>
        session.id === sessionId
          ? { ...session, title: newTitle, updatedAt: new Date() }
          : session
      )
    );
  }, []);

  // MESSAGE HANDLING
  const sendMessage = useCallback(() => {
    if (!messageInput.trim() || !activeSessionId || !wsConnected) return;

    const activeSession = sessions.find(s => s.id === activeSessionId);
    if (!activeSession || !wsRef.current) return;

    threadsApi.sendThreadMessage(
      wsRef.current,
      activeSession.room_id,
      messageInput.trim()
    );

    setMessageInput('');

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [messageInput, activeSessionId, wsConnected, sessions]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // UI EFFECTS
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, activeSessionId]);


  const activeSession = sessions.find(s => s.id === activeSessionId);
  const filteredSessions = threadsStorageApi.searchSessions(sessions, searchQuery);

  // COLLAPSED STATE
  if (!isExpanded) {
    const totalUnread = sessions.reduce((sum, s) => sum + s.unreadCount, 0);

    return (
      <>
        {/* Delete Modals */}
        <DeleteModal
          isOpen={deleteModalOpen}
          type="confirm"
          itemType="thread"
          itemName={sessions.find(s => s.id === sessionToDelete)?.title}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
          isDeleting={isDeleting}
        />

        <DeleteModal
          isOpen={deletePermissionDenied}
          type="denied"
          itemType="thread"
          onCancel={closePermissionDenied}
        />

        <div className="fixed bottom-5 right-20 z-50">
          <button
            onClick={() => {
              setIsExpanded(true);
              setLastExpandedTime(Date.now());
            }}
            className="flex items-center gap-3 px-4 py-3 bg-white rounded-full shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-200 hover:scale-105"
          >
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm relative">
              <MessageCircle className="w-5 h-5" />
              {totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-white">
                  {totalUnread > 9 ? '9+' : totalUnread}
                </span>
              )}
            </div>
            <div className="flex flex-col items-start">
              <span className="font-medium text-gray-900 text-sm">Thread</span>
              {totalUnread > 0 && (
                <span className="text-xs text-red-500 font-medium leading-none">
                  {totalUnread} unread
                </span>
              )}
            </div>
          </button>
        </div>
      </>
    );
  }

  const threadHistoryPanelJSX = (
    <div className="flex flex-col h-full">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200 bg-gray-50">
        <span className="text-sm font-semibold text-gray-700">Thread History</span>
        <button
          onClick={createNewSession}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
          title="New Thread"
        >
          <Plus className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Search */}
      <div className="px-2 py-2 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Session List */}
      <div className="overflow-y-auto flex-1">
        {filteredSessions.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-gray-400">
            {searchQuery ? 'No sessions found' : 'No sessions yet'}
          </div>
        ) : (
          filteredSessions.map(session => (
            <button
              key={session.id}
              onClick={() => switchSession(session.id)}
              className={`w-full px-3 py-2.5 text-left hover:bg-gray-50 transition-colors border-l-2 flex items-start justify-between gap-1 group ${session.id === activeSessionId
                ? 'border-blue-500 bg-blue-50'
                : 'border-transparent'
                }`}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-xs text-gray-900 truncate">{session.title}</div>
                <div className="flex items-center gap-1 mt-0.5 text-[10px] text-gray-400">
                  <Clock className="w-2.5 h-2.5" />
                  <span>{new Date(session.updatedAt).toLocaleDateString()}</span>
                  {session.unreadCount > 0 && (
                    <span className="ml-1 px-1 py-0.5 bg-red-500 text-white rounded-full text-[9px] font-bold">
                      {session.unreadCount}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={(e) => deleteSession(session.id, e)}
                className="p-0.5 hover:bg-red-100 rounded transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                title="Delete session"
              >
                <Trash2 className="w-3 h-3 text-red-500" />
              </button>
            </button>
          ))
        )}
      </div>
    </div>
  );

  const chatAreaJSX = (
    <>
      {/* MESSAGES SECTION */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-[#f0ede8]">
        {!activeSession || activeSession.messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-blue-500" />
            </div>
            <h4 className="font-medium text-gray-900 mb-2">No messages yet</h4>
            <p className="text-sm text-gray-500 mb-4">Start a conversation for this project</p>
            {sessions.length === 0 && (
              <button
                onClick={createNewSession}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm font-medium"
              >
                Create First Session
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {activeSession.messages.map((message, index) => (
              <div
                key={`${message.id}-${index}`}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2.5 ${message.sender === 'user'
                    ? 'bg-[#2d6a5f] text-white'
                    : message.sender === 'system'
                      ? 'bg-gray-100 text-gray-900 border border-gray-300'
                      : 'bg-white text-gray-900 border border-gray-200'
                    }`}
                >
                  {message.sender === 'other' && message.senderName && (
                    <p className="text-xs font-semibold text-gray-600 mb-1">{message.senderName}</p>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
                  <p className={`text-xs mt-1 ${message.sender === 'user' ? 'text-green-100' : 'text-gray-500'}`}>
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* INPUT SECTION */}
      <div className="border-t border-gray-200 p-3 bg-white">
        {activeSession ? (
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              rows={2}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <button
              onClick={sendMessage}
              disabled={!messageInput.trim()}
              className="p-2.5 bg-[#2d6a5f] text-white rounded-md hover:bg-[#235549] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="text-center py-2">
          </div>
        )}
      </div>
    </>
  );

  // RENDER
  return (
    <>
      {/* Delete Modals */}
      <DeleteModal
        isOpen={deleteModalOpen}
        type="confirm"
        itemType="thread"
        itemName={sessions.find(s => s.id === sessionToDelete)?.title}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        isDeleting={isDeleting}
      />
      <DeleteModal
        isOpen={deletePermissionDenied}
        type="denied"
        itemType="thread"
        onCancel={closePermissionDenied}
      />

      {/* FULL-SCREEN */}
      {isFullScreen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="shrink-0" style={{ width: 'var(--sidebar-width, 240px)' }} />
          <div
            className="relative z-10 flex bg-white rounded-xl shadow-2xl overflow-hidden"
            style={{
              width: isHistoryPanelOpen ? 'min(900px, calc(100% - 64px))' : 'min(680px, calc(100% - 64px))',
              height: 'calc(100vh - 80px)',
              transition: 'width 0.3s ease',
            }}
          >
            {/* Left: History Panel */}
            <div
              className={`flex flex-col bg-white border-r border-gray-200 transition-all duration-300 overflow-hidden shrink-0 ${isHistoryPanelOpen ? 'w-64' : 'w-0'
                }`}
            >
              {isHistoryPanelOpen && threadHistoryPanelJSX}
            </div>

            {/* Right: Chat Area */}
            <div className="flex-1 flex flex-col bg-white overflow-hidden min-w-0">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsHistoryPanelOpen(!isHistoryPanelOpen)}
                    className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                    title={isHistoryPanelOpen ? 'Collapse history' : 'Expand history'}
                  >
                    {isHistoryPanelOpen
                      ? <PanelLeftClose className="w-5 h-5 text-gray-600" />
                      : <PanelLeftOpen className="w-5 h-5 text-gray-600" />
                    }
                  </button>
                  <div>
                    <h3 className="font-semibold text-gray-900">Thread</h3>
                    <p className="text-xs text-gray-500">{projectName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={createNewSession}
                    className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                    title="New Session"
                  >
                    <Plus className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => { setIsFullScreen(false); setIsHistoryPanelOpen(false); }}
                    className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                    title="Exit full screen"
                  >
                    <ChevronDown className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>

              {chatAreaJSX}
            </div>
          </div>
        </div>
      ) : (
        /* DEFAULT MINI WIDGET */
        <div className="fixed bottom-20 right-4 z-50">
          <div
            className="bg-white rounded-lg shadow-2xl border border-gray-200 flex overflow-hidden"
            style={{ width: isHistoryPanelOpen ? '680px' : '400px', height: '600px', transition: 'width 0.3s ease' }}
          >
            {/* Left: Collapsible History Panel */}
            <div
              className={`flex flex-col border-r border-gray-200 transition-all duration-300 overflow-hidden ${isHistoryPanelOpen ? 'w-64' : 'w-0'
                }`}
            >
              {isHistoryPanelOpen && threadHistoryPanelJSX}
            </div>

            {/* Right: Chat Column */}
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* HEADER */}
              <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsHistoryPanelOpen(!isHistoryPanelOpen)}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                    title={isHistoryPanelOpen ? 'Collapse history' : 'Show history'}
                  >
                    {isHistoryPanelOpen
                      ? <PanelLeftClose className="w-4 h-4 text-gray-600" />
                      : <PanelLeftOpen className="w-4 h-4 text-gray-600" />
                    }
                  </button>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">Thread</h3>
                    <p className="text-xs text-gray-500 truncate">{projectName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 ml-auto shrink-0">
                  <button
                    onClick={createNewSession}
                    className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                    title="New Session"
                  >
                    <Plus className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => { setIsFullScreen(true); setIsHistoryPanelOpen(false); }}
                    className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                    title="Maximize"
                  >
                    <Maximize2 className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => { setIsExpanded(false); setIsHistoryPanelOpen(false); }}
                    className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                    title="Collapse"
                  >
                    <ChevronDown className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>

              {chatAreaJSX}
            </div>
          </div>
        </div>
      )}
    </>
  );
}