import { useState, useCallback, useRef, useEffect } from 'react';
import { agentApi } from '@/services/api';
import type { AgentSession, AgentUIMessage } from '@/types';

// ─── Local helpers
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Hook 
export function useAIBot() {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const setSession = (id: number | null) => {
    activeSessionRef.current = id;
    setActiveSessionId(id);
  };
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Local messages for the active session 
  const [messages, setMessages] = useState<AgentUIMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // FAB drag
  const [fabPos, setFabPos] = useState(() => ({ x: window.innerWidth - 72, y: window.innerHeight - 80 }));
  const dragging = useRef(false);
  const didDrag = useRef(false);
  const dragStart = useRef<{ mx: number; my: number; fx: number; fy: number } | null>(null);

  // Expand state
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeSessionRef = useRef<number | null>(null);
  const sessionsFetchedRef = useRef(false);

  // ── Scroll to bottom on new messages 
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ── Focus input when expanded
  useEffect(() => {
    if (isExpanded) inputRef.current?.focus();
  }, [isExpanded]);

  // ── Listen for programmatic open + optional query pre-fill
  useEffect(() => {
    const handler = (e: Event) => {
      const query = (e as CustomEvent<{ query?: string }>).detail?.query;
      setIsExpanded(true);
      setIsFullScreen(true);
      if (query) {
        setTimeout(() => {
          setInput(query);
          inputRef.current?.focus();
        }, 80);
      }
    };
    window.addEventListener('aibot:open', handler);
    return () => window.removeEventListener('aibot:open', handler);
  }, []);

  // ── FAB drag resize handler 
  useEffect(() => {
    const onResize = () => setFabPos(prev => ({
      x: Math.min(prev.x, window.innerWidth - 56),
      y: Math.min(prev.y, window.innerHeight - 56),
    }));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Load sessions when opened 
 const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const data = await agentApi.listSessions();
      setSessions(data);
    } catch {
    } finally {
      setSessionsLoading(false);
    }
  }, []);

 useEffect(() => {
    if (isExpanded && !sessionsFetchedRef.current) {
      sessionsFetchedRef.current = true;
      loadSessions();
    }
  }, [isExpanded, loadSessions]);

  // ── Load message history for a session
  const loadSessionHistory = useCallback(async (sessionId: number) => {
    setHistoryLoading(true);
    setMessages([]);
    setError(null);
    try {
      const detail = await agentApi.getSession(sessionId);
      const rawMessages = Array.isArray(detail.messages) ? detail.messages : [];

      // ── Step 1: extract tool_called name and tool_result data from the raw
      const toolCallMap: Record<string, { toolCalled: string; toolResult: Record<string, unknown> }> = {};

      rawMessages.forEach((m: any) => {
        if (!Array.isArray(m.content)) return;

        // assistant message carrying a tool_use block
        if (m.role === 'assistant') {
          const toolUseBlock = m.content.find((b: any) => b.type === 'tool_use');
          if (toolUseBlock?.id && toolUseBlock?.name) {
            toolCallMap[toolUseBlock.id] = { toolCalled: toolUseBlock.name, toolResult: {} };
          }
        }

        // user message carrying the tool_result block
        if (m.role === 'user') {
          const toolResultBlock = m.content.find((b: any) => b.type === 'tool_result');
          if (toolResultBlock?.tool_use_id && toolCallMap[toolResultBlock.tool_use_id]) {
            try {
              const parsed = typeof toolResultBlock.content === 'string'
                ? JSON.parse(toolResultBlock.content)
                : toolResultBlock.content;
              toolCallMap[toolResultBlock.tool_use_id].toolResult = parsed ?? {};
            } catch {
              toolCallMap[toolResultBlock.tool_use_id].toolResult = {};
            }
          }
        }
      });

      // The most recent completed tool pair — attached to the next assistant text
      const toolEntries = Object.values(toolCallMap);
      const lastTool = toolEntries.length > 0 ? toolEntries[toolEntries.length - 1] : null;

      // ── Step 2: build UI messages — same as before but now attach tool data
      const uiMessages: AgentUIMessage[] = rawMessages
        .reduce((acc: AgentUIMessage[], m: any) => {
          // Extract plain text content regardless of format
          let content = '';
          if (typeof m.content === 'string') {
            content = m.content.trim();
          } else if (Array.isArray(m.content)) {
            const textBlock = m.content.find((block: any) => block.type === 'text' && block.text?.trim());
            content = textBlock ? (textBlock.text || '').trim() : '';
          }

          // Only keep messages that have actual displayable text
          if (!content) return acc;

          // For assistant messages: attach the last resolved tool pair
          const isAssistant = m.role === 'assistant';
          const uiMsg: AgentUIMessage = {
            id:         generateId(),
            role:       isAssistant ? 'assistant' : 'user',
            content,
            timestamp:  detail.created_at ?? new Date().toISOString(),
            toolCalled: isAssistant ? (lastTool?.toolCalled ?? null) : undefined,
            toolResult: isAssistant ? (lastTool?.toolResult ?? null) : undefined,
          };
          acc.push(uiMsg);
          return acc;
        }, []);

      setMessages(uiMessages);
      setSession(sessionId);
      setSearchQuery('');
    } catch {
      setError('Failed to load conversation history.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // ── Start a new conversation 
  const startNewConversation = useCallback(() => {
    loadSessions();
    setSession(null);
    setMessages([]);
    setError(null);
    setSearchQuery('');
    inputRef.current?.focus();
  }, [loadSessions]);

  const renameSession = useCallback(async (newTitle: string, sessionId?: number) => {
    const id = sessionId ?? activeSessionId;
    if (!id) return;
    // Optimistic update — update title in sessions list immediately
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
    try {
      await agentApi.updateSession(id, { title: newTitle });
    } catch {
      // Revert on failure by reloading sessions
      loadSessions();
    }
  }, [activeSessionId, loadSessions]);

  const pinSession = useCallback(async (sessionId: number, isPinned: boolean) => {
    // Optimistic update
    setSessions(prev => {
      const updated = prev.map(s => s.id === sessionId ? { ...s, is_pinned: isPinned } : s);
      // Pinned sessions first, preserve backend order within each group
      return [...updated.filter(s => s.is_pinned), ...updated.filter(s => !s.is_pinned)];
    });
    try {
      await agentApi.updateSession(sessionId, { is_pinned: isPinned });
    } catch {
      loadSessions();
    }
  }, [loadSessions]);

  const deleteSession = useCallback(async (sessionId?: number) => {
    const id = sessionId ?? activeSessionId;
    if (!id) return;
    // Optimistic update
    setSessions(prev => prev.filter(s => s.id !== id));
    if (id === activeSessionId) { setSession(null); setMessages([]); }
    try {
      await agentApi.deleteSession(id);
    } catch {
      loadSessions();
    }
  }, [activeSessionId, loadSessions]);
  
  // ── Send a message with streaming 
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    // 1 — Add user message immediately
    const userMsg: AgentUIMessage = {
      id:        generateId(),
      role:      'user',
      content:   text,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setError(null);

    // 2 — Create empty placeholder bot message to stream chunks into
    const botMsgId = generateId();
    const botPlaceholder: AgentUIMessage = {
      id:        botMsgId,
      role:      'assistant',
      content:   '',
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, botPlaceholder]);

    try {
      await agentApi.stream(
        { query: text, session_id: activeSessionRef.current },

        // onChunk — typewriter effect
        (() => {
          let chunkQueue: string[] = [];
          let isProcessing = false;
          const processQueue = () => {
            if (chunkQueue.length === 0) { isProcessing = false; return; }
            isProcessing = true;
            const next = chunkQueue.shift()!;
            setMessages(prev => prev.map(m =>
              m.id === botMsgId ? { ...m, content: m.content + next } : m
            ));
            setTimeout(processQueue, 18);
          };
          return (chunk: string) => {
            chunkQueue.push(chunk);
            if (!isProcessing) processQueue();
          };
        })(),

        // onDone — attach tool data so EntityCards can render
        (done) => {
          setMessages(prev => prev.map(m =>
            m.id === botMsgId
              ? { ...m, toolCalled: done.tool_called, toolResult: done.tool_result }
              : m
          ));
          setSession(done.session_id);
          loadSessions();
          // If the agent created a standup/daily-update, notify other pages to refresh
          const isStandupTool = (done.tool_called || '').toLowerCase().includes('standup')
            || (done.tool_called || '').toLowerCase().includes('daily_update')
            || (done.tool_called || '').toLowerCase().includes('create_daily')
            || (done.tool_called || '').toLowerCase().includes('daily_updates')
            || (done.tool_called || '').toLowerCase().includes('get_daily');
          if (isStandupTool) {
            window.dispatchEvent(new CustomEvent('aibot:standup-created'));
          }
        },

        // onError
        (errText: string) => {
          setMessages(prev => prev.map(m =>
            m.id === botMsgId ? { ...m, content: `⚠️ ${errText}` } : m
          ));
          setError(errText);
        },
      );
    } catch (err: any) {
      const errText = err?.message || 'Something went wrong. Please try again.';
      setMessages(prev => prev.map(m =>
        m.id === botMsgId ? { ...m, content: `⚠️ ${errText}` } : m
      ));
      setError(errText);
    } finally {
      setIsTyping(false);
    }
  }, [input, isTyping, activeSessionId, loadSessions]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // ── FAB drag 
  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didDrag.current = true;
    setFabPos({
      x: Math.min(Math.max(dragStart.current.fx + dx, 0), window.innerWidth - 56),
      y: Math.min(Math.max(dragStart.current.fy + dy, 0), window.innerHeight - 56),
    });
  }, []);

  const onMouseUp = useCallback(() => {
    dragging.current = false;
    dragStart.current = null;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }, [onMouseMove]);

  const handleFabMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    didDrag.current = false;
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, fx: fabPos.x, fy: fabPos.y };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [fabPos, onMouseMove, onMouseUp]);

  const handleFabClick = useCallback(() => {
    if (didDrag.current) return;
    if (!isExpanded) {
      setIsExpanded(true);
      setIsFullScreen(true);
    } else {
      setIsExpanded(false);
      setIsFullScreen(false);
    }
  }, [isExpanded]);

  // ── Derived 
  const filteredSessions = sessions.filter(s =>
    (s.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(s.id).includes(searchQuery)
  );

  return {
    // state
    sessions, sessionsLoading, filteredSessions,
    activeSessionId,
    messages, isTyping, historyLoading,
    input, setInput,
    error,
    searchQuery, setSearchQuery,
    isExpanded, setIsExpanded,
    isFullScreen, setIsFullScreen,
    isHistoryOpen, setIsHistoryOpen,
    fabPos,
    // refs
    messagesEndRef, inputRef,
    // handlers
    sendMessage, handleKeyDown,
    startNewConversation,
    renameSession,
    pinSession,
    deleteSession,
    bulkDeleteSessions: useCallback(async (ids: number[]) => {
      // Optimistic — remove all immediately
      setSessions(prev => prev.filter(s => !ids.includes(s.id)));
      if (ids.includes(activeSessionRef.current!)) { setSession(null); setMessages([]); }
      // Delete all in parallel
      await Promise.all(ids.map(id => agentApi.deleteSession(id).catch(() => null)));
      // Reload to sync any failures
      loadSessions();
    }, [loadSessions]),
    loadSessionHistory,
    handleFabMouseDown, handleFabClick,
  };
}