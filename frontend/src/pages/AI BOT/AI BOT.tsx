import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    Send, Search, Maximize2, Plus,
    ChevronDown, Clock, Trash2, PanelLeftOpen, PanelLeftClose, Bot
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { aiBotApi } from '@/services/api';
import { RichTextEditor, markdownToHtml } from '@/components/common/RichTextEditor';
import type { AIBotUIMessage, AIBotSession } from '@/types';

// ── Draggable FAB helpers

const AIBOT_FAB_SIZE = 48;
const AIBOT_POS_KEY = 'zanflow_aibot_fab_pos';

function clampAI(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}

function getInitialAIBotPos(): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(AIBOT_POS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { }
  return {
    x: window.innerWidth - AIBOT_FAB_SIZE - 24,
    y: window.innerHeight - AIBOT_FAB_SIZE - 80,
  };
}

// Storage helpers

const STORAGE_KEY = 'aibot_sessions';

function loadSessions(): AIBotSession[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as AIBotSession[];
        return parsed.map(s => ({
            ...s,
            createdAt: new Date(s.createdAt),
            updatedAt: new Date(s.updatedAt),
            messages: s.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })),
        }));
    } catch {
        return [];
    }
}

function saveSessions(sessions: AIBotSession[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function generateId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Derive page name + optional entity id from the current URL path
function getPageContext(pathname: string): { page: string; id: string | number | null } {
    const segments = pathname.split('/').filter(Boolean);
    const page = segments[0] ?? 'dashboard';
    const rawId = segments[1];
    const id = rawId && !isNaN(Number(rawId)) ? Number(rawId) : (rawId ?? null);
    return { page, id };
}

// Component 

export function AIBot() {
    const location = useLocation();
    const [isExpanded, setIsExpanded] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
    const [sessions, setSessions] = useState<AIBotSession[]>(loadSessions);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(
        () => loadSessions()[0]?.id ?? null
    );
    const [messageInput, setMessageInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [wsConnected, setWsConnected] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const streamBufferRef = useRef<string>('');
    const streamMsgIdRef = useRef<string | null>(null);

    // Persist sessions to localStorage
    useEffect(() => { saveSessions(sessions); }, [sessions]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [sessions, activeSessionId]);

    useEffect(() => {
        if (isExpanded && inputRef.current) inputRef.current.focus();
    }, [isExpanded]);

    const activeSessionIdRef = useRef<string | null>(activeSessionId);
    useEffect(() => { activeSessionIdRef.current = activeSessionId; }, [activeSessionId]);

    // Connect WebSocket when expanded, disconnect on collapse
    useEffect(() => {
        if (!isExpanded) {
            wsRef.current?.close();
            wsRef.current = null;
            setWsConnected(false);
            return;
        }

        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        const ws = aiBotApi.connect();
        wsRef.current = ws;

        ws.onopen = () => {
            setWsConnected(true);
            setSessions(prev => {
                if (prev.length > 0) return prev;
                const newSession: AIBotSession = {
                    id: generateId(),
                    title: 'Chat 1',
                    messages: [],
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };
                setActiveSessionId(newSession.id);
                activeSessionIdRef.current = newSession.id;
                return [newSession];
            });
        };

        ws.onmessage = (event) => {
            const msg = aiBotApi.parseMessage(event);
            if (!msg) return;

            if (msg.type === 'ai_chunk' || msg.type === 'ai_response') {
                streamBufferRef.current += msg.text;
                const currentText = streamBufferRef.current;
                const sessionId = activeSessionIdRef.current;
                if (!sessionId) return;

                if (!streamMsgIdRef.current) {
                    const bubbleId = generateId();
                    streamMsgIdRef.current = bubbleId;
                    const botMsg: AIBotUIMessage = {
                        id: bubbleId,
                        text: currentText,
                        sender: 'bot',
                        timestamp: new Date(),
                    };
                    setSessions(prev => prev.map(s =>
                        s.id === sessionId
                            ? { ...s, messages: [...s.messages, botMsg], updatedAt: new Date() }
                            : s
                    ));
                } else {
                    const bubbleId = streamMsgIdRef.current;
                    setSessions(prev => prev.map(s =>
                        s.id === sessionId
                            ? {
                                ...s,
                                messages: s.messages.map(m =>
                                    m.id === bubbleId ? { ...m, text: currentText } : m
                                ),
                            }
                            : s
                    ));
                }
            }

            if (msg.type === 'chat_title' && msg.text) {
                const sessionId = activeSessionIdRef.current;
                if (sessionId) {
                    setSessions(prev => prev.map(s =>
                        s.id === sessionId ? { ...s, title: msg.text } : s
                    ));
                }
            }

            if (msg.type === 'ai_done' || msg.type === 'ai_complete' || msg.type === 'system') {
                streamBufferRef.current = '';
                streamMsgIdRef.current = null;
                setIsTyping(false);
            }

            if (msg.type === 'error') {
                streamBufferRef.current = '';
                streamMsgIdRef.current = null;
                setIsTyping(false);
                const errMsg: AIBotUIMessage = {
                    id: generateId(),
                    text: msg.text || 'Something went wrong. Please try again.',
                    sender: 'bot',
                    timestamp: new Date(),
                };
                setSessions(prev => prev.map(s =>
                    s.id === activeSessionIdRef.current
                        ? { ...s, messages: [...s.messages, errMsg], updatedAt: new Date() }
                        : s
                ));
            }
        };

        ws.onerror = () => setWsConnected(false);
        ws.onclose = () => {
            setWsConnected(false);
            wsRef.current = null;
        };

        return () => {
            ws.close();
        };
    }, [isExpanded]);

    //  Session management 

    const createNewSession = useCallback(() => {
        const newSession: AIBotSession = {
            id: generateId(),
            title: `Chat ${sessions.length + 1}`,
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        setSessions(prev => [...prev, newSession]);
        setActiveSessionId(newSession.id);
        setSearchQuery('');
    }, [sessions.length]);

    const switchSession = useCallback((id: string) => {
        setActiveSessionId(id);
        setSearchQuery('');
    }, []);

    const deleteSession = useCallback((id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSessions(prev => {
            const remaining = prev.filter(s => s.id !== id);
            if (activeSessionId === id) {
                setActiveSessionId(remaining[remaining.length - 1]?.id ?? null);
            }
            return remaining;
        });
    }, [activeSessionId]);

    // ── Messaging
    const sendMessage = useCallback(() => {
        const text = messageInput.trim();
        if (!text || !activeSessionId || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        const userMsg: AIBotUIMessage = {
            id: generateId(),
            text,
            sender: 'user',
            timestamp: new Date(),
        };

        setSessions(prev =>
            prev.map(s =>
                s.id === activeSessionId
                    ? { ...s, messages: [...s.messages, userMsg], updatedAt: new Date() }
                    : s
            )
        );
        setMessageInput('');
        setIsTyping(true);

        // Reset stream buffer for the new response
        streamBufferRef.current = '';
        streamMsgIdRef.current = null;

        const { page, id } = getPageContext(location.pathname);
        aiBotApi.sendMessage(wsRef.current, {
            message: text,
            context: { page, id },
        });
    }, [messageInput, activeSessionId, wsConnected, location.pathname]);
    const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }, [sendMessage]);

    // ── Derived 

    const activeSession = sessions.find(s => s.id === activeSessionId);
    const filteredSessions = sessions.filter(s =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

// Drag state for the collapsed FAB
    const [aiBotPos, setAIBotPos] = useState<{ x: number; y: number }>(getInitialAIBotPos);
    const aiBotDragging = useRef(false);
    const aiBotDidDrag = useRef(false);
    const aiBotDragStart = useRef<{ mx: number; my: number; fx: number; fy: number } | null>(null);

    useEffect(() => {
        localStorage.setItem(AIBOT_POS_KEY, JSON.stringify(aiBotPos));
    }, [aiBotPos]);

    useEffect(() => {
        const onResize = () => {
            setAIBotPos((prev) => ({
                x: clampAI(prev.x, 0, window.innerWidth - AIBOT_FAB_SIZE),
                y: clampAI(prev.y, 0, window.innerHeight - AIBOT_FAB_SIZE),
            }));
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const onAIBotMouseMove = useCallback((e: MouseEvent) => {
        if (!aiBotDragging.current || !aiBotDragStart.current) return;
        const dx = e.clientX - aiBotDragStart.current.mx;
        const dy = e.clientY - aiBotDragStart.current.my;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) aiBotDidDrag.current = true;
        setAIBotPos({
            x: clampAI(aiBotDragStart.current.fx + dx, 0, window.innerWidth - AIBOT_FAB_SIZE),
            y: clampAI(aiBotDragStart.current.fy + dy, 0, window.innerHeight - AIBOT_FAB_SIZE),
        });
    }, []);

    const onAIBotMouseUp = useCallback(() => {
        aiBotDragging.current = false;
        aiBotDragStart.current = null;
        window.removeEventListener('mousemove', onAIBotMouseMove);
        window.removeEventListener('mouseup', onAIBotMouseUp);
    }, [onAIBotMouseMove]);

    const handleAIBotMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        aiBotDidDrag.current = false;
        aiBotDragging.current = true;
        aiBotDragStart.current = { mx: e.clientX, my: e.clientY, fx: aiBotPos.x, fy: aiBotPos.y };
        window.addEventListener('mousemove', onAIBotMouseMove);
        window.addEventListener('mouseup', onAIBotMouseUp);
    }, [aiBotPos, onAIBotMouseMove, onAIBotMouseUp]);

    if (!isExpanded) {
        return (
            <button
                onMouseDown={handleAIBotMouseDown}
                onClick={() => { if (!aiBotDidDrag.current) setIsExpanded(true); }}
                title="Open AI Bot (drag to reposition)"
                style={{ left: aiBotPos.x, top: aiBotPos.y }}
                className="fixed z-50 w-12 h-12 bg-[#1a1a2e] rounded-full shadow-lg border border-[#2d2d4e] hover:shadow-xl hover:bg-[#22223a] transition-all duration-200 hover:scale-105 flex items-center justify-center text-white cursor-grab active:cursor-grabbing select-none"
            >
                <Bot className="w-6 h-6 pointer-events-none" />
            </button>
        );
    }

    // History Panel 

    const historyPanelJSX = (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200 bg-gray-50">
                <span className="text-sm font-semibold text-gray-700">Chat History</span>
                <button
                    onClick={createNewSession}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                    title="New Chat"
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
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            {/* Session list */}
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
                                </div>
                            </div>
                            <button
                                onClick={e => deleteSession(session.id, e)}
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

    // Chat Area 

    const chatAreaJSX = (
        <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 bg-[#f0ede8]">
                {!activeSession || activeSession.messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-4">
                        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                            <Bot className="w-8 h-8 text-blue-500" />
                        </div>
                        <h4 className="font-medium text-gray-900 mb-2">No messages yet</h4>
                        <p className="text-sm text-gray-500 mb-4">Ask the AI bot anything</p>
                        {sessions.length === 0 && (
                            <button
                                onClick={createNewSession}
                                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm font-medium"
                            >
                                Start First Chat
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
                                        : 'bg-white text-gray-900 border border-gray-200'
                                        }`}
                                >
                                    {message.sender === 'bot' && (
                                        <p className="text-xs font-semibold text-gray-600 mb-1">AI Bot</p>
                                    )}
                                    {message.sender === 'bot' ? (
                                        <RichTextEditor
                                            value={markdownToHtml(message.text)}
                                            onChange={() => { }}
                                            readOnly
                                            showToolbar={false}
                                            minHeight="0px"
                                            className="!border-0 !ring-0 !bg-transparent !rounded-none [&_.ProseMirror]:!p-0 [&_.ProseMirror]:!min-h-0"
                                        />
                                    ) : (
                                        <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
                                    )}
                                    <p className={`text-xs mt-1 ${message.sender === 'user' ? 'text-green-100' : 'text-gray-500'}`}>
                                        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        ))}

                        {/* Typing indicator */}
                        {isTyping && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                                    <div className="flex gap-1 items-center h-4">
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="border-t border-gray-200 p-3 bg-white">
                {activeSession ? (
                    <div className="flex items-end gap-2">
                        <textarea
                            ref={inputRef}
                            value={messageInput}
                            onChange={e => setMessageInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Ask AI anything..."
                            rows={2}
                            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!messageInput.trim() || isTyping}
                            className="p-2.5 bg-[#2d6a5f] text-white rounded-md hover:bg-[#235549] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Send"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={createNewSession}
                        className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        + New Chat
                    </button>
                )}
            </div>
        </>
    );

    return (
        <>
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
                        {/* History Panel */}
                        <div
                            className={`flex flex-col bg-white border-r border-gray-200 transition-all duration-300 overflow-hidden shrink-0 ${isHistoryPanelOpen ? 'w-64' : 'w-0'
                                }`}
                        >
                            {isHistoryPanelOpen && historyPanelJSX}
                        </div>

                        {/* Chat Area */}
                        <div className="flex-1 flex flex-col bg-white overflow-hidden min-w-0">
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
                                        <p className="text-xs text-gray-500">{activeSession?.title ?? 'New chat'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={createNewSession}
                                        className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                                        title="New Chat"
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
                /* MINI WIDGET */
                <div
                    className="fixed z-50"
                    style={{
                        left: clampAI(aiBotPos.x + AIBOT_FAB_SIZE / 2 - (isHistoryPanelOpen ? 340 : 200), 8, window.innerWidth - (isHistoryPanelOpen ? 680 : 400) - 8),
                        top: clampAI(aiBotPos.y - 612, 8, window.innerHeight - 620),
                    }}
                >
                    <div
                        className="bg-white rounded-lg shadow-2xl border border-gray-200 flex overflow-hidden"
                        style={{
                            width: isHistoryPanelOpen ? '680px' : '400px',
                            height: '600px',
                            transition: 'width 0.3s ease',
                        }}
                    >
                        {/* History Panel */}
                        <div
                            className={`flex flex-col border-r border-gray-200 transition-all duration-300 overflow-hidden ${isHistoryPanelOpen ? 'w-64' : 'w-0'
                                }`}
                        >
                            {isHistoryPanelOpen && historyPanelJSX}
                        </div>

                        {/* Chat Column */}
                        <div className="flex flex-col flex-1 overflow-hidden">
                            {/* Header */}
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
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <div className="min-w-0">
                                            <p className="text-xs text-gray-500 truncate">
                                                {activeSession?.title ?? 'New chat'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 ml-auto shrink-0">
                                    <button
                                        onClick={createNewSession}
                                        className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                                        title="New Chat"
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

export default AIBot;