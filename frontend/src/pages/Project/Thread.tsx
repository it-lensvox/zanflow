import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageCircle, Send, Search, MoreVertical, Plus,
  ChevronDown, User, Clock, Trash2
} from 'lucide-react';
import { threadsApi, threadsStorageApi, getTokens, authApi } from '@/services/api';
import type { ThreadSession, ThreadUIMessage, ThreadsProps } from '@/types';
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

        // 3. Map backend threads to UI state structure
        const activeSessions: ThreadSession[] = backendThreads.map(room => {
          const existingSession = storage.sessions.find(s => s.room_id === room.id);

          return {
            id: room.id,
            room_id: room.id,
            slug: room.slug,
            projectId: projectId,
            title: room.name,
            messages: existingSession?.messages || [],
            createdAt: new Date(room.created_at),
            updatedAt: new Date(room.updated_at),
            unreadCount: room.unread_count || 0,
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

    // Only create connection if not already connected
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
        setSessions(prev => {
          const updated = prev.map(session => {
            if (session.room_id === incomingMessage.data.room_id) {
              const isActiveSession = session.id === activeSessionIdRef.current;

              // Prevent duplicate: Check if message already exists
              const messageExists = session.messages.some(msg => msg.id === uiMessage.id);
              if (messageExists) {
                return session;
              }
              return {
                ...session,
                messages: [...session.messages, uiMessage],
                updatedAt: new Date(),
                unreadCount: (isActiveSession && isExpanded) ? 0 : session.unreadCount + 1,
              };
            }
            return session;
          });
          return updated;
        });
        return;
      }

      // Handle unread signals
      const unreadSignal = threadsApi.parseUnreadSignal(event);
      if (unreadSignal) {
        setSessions(prev =>
          prev.map(session =>
            session.room_id === unreadSignal.data.room_id
              ? {
                ...session,
                unreadCount: session.id === activeSessionIdRef.current ? 0 : unreadSignal.data.room_unread,
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
    // Join every thread room to receive messages even when collapsed
    sessions.forEach(session => {
      if (session.slug) {
        threadsApi.joinThreadRoom(wsRef.current!, session.slug);
      }
    });
  }, [wsConnected, sessions.length]);

  // Auto-mark active session as read and update ref
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;

    if (!activeSessionId) return;

    setSessions(prev =>
      prev.map(session =>
        session.id === activeSessionId
          ? { ...session, unreadCount: 0, lastReadAt: new Date() }
          : session
      )
    );
  }, [activeSessionId]);

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

        // Update session with loaded messages (replace, not append)
        setSessions(prev =>
          prev.map(session => {
            if (session.id === activeSessionId) {
              // Create a Set of existing message IDs from WebSocket
              const existingIds = new Set(session.messages.map(m => m.id));
              const wsOnlyMessages = session.messages.filter(m =>
                !uiMessages.some(apiMsg => apiMsg.id === m.id)
              );
              const combinedMessages = [...uiMessages, ...wsOnlyMessages]
                .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
              return { ...session, messages: combinedMessages };
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

  // Reload all sessions when expanding to get offline messages
  useEffect(() => {
    const reloadAllMessages = async () => {
      if (!isExpanded || !currentUserId || sessions.length === 0) return;

      // Reload messages for all sessions
      for (const session of sessions) {
        try {
          const response = await threadsApi.getThreadMessages(session.room_id);
          const uiMessages = response.messages.map(msg =>
            threadsApi.convertBackendMessageToUI(msg, currentUserId)
          );

          // Update this session with latest messages
          setSessions(prev =>
            prev.map(s => {
              if (s.id === session.id) {
                const wsOnlyMessages = s.messages.filter(m =>
                  !uiMessages.some(apiMsg => apiMsg.id === m.id)
                );

                const combinedMessages = [...uiMessages, ...wsOnlyMessages]
                  .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

                // Update unread count based on new messages
                const newMessageCount = uiMessages.length - (s.messages.length - wsOnlyMessages.length);

                return {
                  ...s,
                  messages: combinedMessages,
                  unreadCount: s.id === activeSessionId ? 0 : Math.max(0, s.unreadCount + newMessageCount),
                };
              }
              return s;
            })
          );
        } catch (error) {
          console.error(`  ❌ Failed to reload messages for ${session.title}:`, error);
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
      // Remove from local state
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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };

    if (showHistory) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showHistory]);


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

        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={() => {
              setIsExpanded(true);
              setLastExpandedTime(Date.now());
            }}
            className="flex items-center gap-3 px-4 py-3 bg-white rounded-full shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-200 hover:scale-105"
          >
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm relative">
              <User className="w-5 h-5" />
              {totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-white">
                  {totalUnread > 9 ? '9+' : totalUnread}
                </span>
              )}
            </div>
            <span className="font-medium text-gray-900">Threads</span>
            ...
          </button>
        </div>
      </>
    );
  }
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

      <div className="fixed bottom-6 right-6 z-50">
        <div
          className="bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ width: '400px', height: '600px' }}
        >
          {/* HEADER */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">Threads</h3>
              <p className="text-xs text-gray-500 truncate">{projectName}</p>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={createNewSession}
                className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                title="New Session"
              >
                <Plus className="w-4 h-4 text-gray-600" />
              </button>

              <div className="relative" ref={historyRef}>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                  title="Session History"
                >
                  <MoreVertical className="w-4 h-4 text-gray-600" />
                </button>

                {/* HISTORY DROPDOWN */}
                {showHistory && (
                  <div className="absolute top-full -left-64 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 py-2 max-h-96 overflow-hidden flex flex-col">
                    <div className="px-3 pb-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search sessions..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="overflow-y-auto flex-1">
                      {filteredSessions.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-gray-500">
                          {searchQuery ? 'No sessions found' : 'No sessions yet'}
                        </div>
                      ) : (
                        filteredSessions.map(session => (
                          <button
                            key={session.id}
                            onClick={() => switchSession(session.id)}
                            className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-l-2 flex items-start justify-between gap-2 group ${session.id === activeSessionId
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-transparent'
                              }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-gray-900 truncate">
                                {session.title}
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                <Clock className="w-3 h-3" />
                                <span>{new Date(session.updatedAt).toLocaleDateString()}</span>
                                <span>•</span>
                                <span>{session.messages.length} messages</span>
                                {session.unreadCount > 0 && (
                                  <>
                                    <span>•</span>
                                    <span className="px-1.5 py-0.5 bg-red-500 text-white rounded-full text-[10px] font-bold">
                                      {session.unreadCount}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            <button
                              onClick={(e) => deleteSession(session.id, e)}
                              className="p-1 hover:bg-red-100 rounded transition-colors opacity-0 group-hover:opacity-100"
                              title="Delete session"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-600" />
                            </button>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setIsExpanded(false)}
                className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                title="Collapse"
              >
                <ChevronDown className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>

          {/* MESSAGES SECTION */}
          <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50">
            {!activeSession || activeSession.messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                  <MessageCircle className="w-8 h-8 text-blue-500" />
                </div>
                <h4 className="font-medium text-gray-900 mb-2">No messages yet</h4>
                <p className="text-sm text-gray-500 mb-4">
                  Start a conversation for this project
                </p>
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
                        ? 'bg-blue-500 text-white'
                        : message.sender === 'system'
                          ? 'bg-gray-100 text-gray-900 border border-gray-300'
                          : 'bg-white text-gray-900 border border-gray-200'
                        }`}
                    >
                      {message.sender === 'other' && message.senderName && (
                        <p className="text-xs font-semibold text-gray-600 mb-1">
                          {message.senderName}
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
                      <p
                        className={`text-xs mt-1 ${message.sender === 'user'
                          ? 'text-blue-100'
                          : 'text-gray-500'
                          }`}
                      >
                        {new Date(message.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
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
                  className="p-2.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="text-center py-2">
                <button
                  onClick={createNewSession}
                  className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm font-medium"
                >
                  Start New Thread
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}