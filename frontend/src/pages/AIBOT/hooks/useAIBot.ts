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
  const [sessionTitles, setSessionTitles] = useState<Record<number, string>>(() => {
    try { return JSON.parse(localStorage.getItem('aibot_session_titles') || '{}'); }
    catch { return {}; }
  });
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
    if (isExpanded) loadSessions();
  }, [isExpanded, loadSessions]);

  // ── Load message history for a session
  const loadSessionHistory = useCallback(async (sessionId: number) => {
    setHistoryLoading(true);
    setMessages([]);
    setError(null);
    try {
      const detail = await agentApi.getSession(sessionId);
      const rawMessages = Array.isArray(detail.messages) ? detail.messages : [];

      const uiMessages: AgentUIMessage[] = rawMessages
        .reduce((acc: AgentUIMessage[], m) => {
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

          acc.push({
            id: generateId(),
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content,
            timestamp: detail.created_at ?? new Date().toISOString(),
          });
          return acc;
        }, []);
      // Backfill title from first user message
      const firstUserMsg = uiMessages.find(m => m.role === 'user');
      if (firstUserMsg) {
        setSessionTitles(prev => {
          if (prev[sessionId]) return prev;
          const updated = { ...prev, [sessionId]: firstUserMsg.content };
          localStorage.setItem('aibot_session_titles', JSON.stringify(updated));
          return updated;
        });
      }

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
    setSession(null);
    setMessages([]);
    setError(null);
    setSearchQuery('');
    inputRef.current?.focus();
  }, []);

  const renameSession = useCallback((newTitle: string, sessionId?: number) => {
    const id = sessionId ?? activeSessionId;
    if (!id) return;
    setSessionTitles(prev => {
      const updated = { ...prev, [id]: newTitle };
      localStorage.setItem('aibot_session_titles', JSON.stringify(updated));
      return updated;
    });
  }, [activeSessionId]);

  const deleteSession = useCallback((sessionId?: number) => {
    const id = sessionId ?? activeSessionId;
    if (!id) return;
    setSessionTitles(prev => {
      const updated = { ...prev };
      delete updated[id];
      localStorage.setItem('aibot_session_titles', JSON.stringify(updated));
      return updated;
    });
    setSessions(prev => prev.filter(s => s.id !== id));
    if (id === activeSessionId) { setSession(null); setMessages([]); }
    setMessages([]);
  }, [activeSessionId]);

  // ── Send a message with streaming 
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
          setSessionTitles(prev => {
            if (prev[done.session_id]) return prev;
            const updated = { ...prev, [done.session_id]: text };
            localStorage.setItem('aibot_session_titles', JSON.stringify(updated));
            return updated;
          });
          loadSessions();
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
    setIsExpanded(prev => !prev);
  }, []);

  // ── Derived 
  const filteredSessions = sessions.filter(s =>
    String(s.id).includes(searchQuery) ||
    new Date(s.updated_at).toLocaleDateString().includes(searchQuery)
  );

  return {
    // state
    sessions, sessionsLoading, filteredSessions,
    sessionTitles,
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
    deleteSession,
    loadSessionHistory,
    handleFabMouseDown, handleFabClick,
  };
}