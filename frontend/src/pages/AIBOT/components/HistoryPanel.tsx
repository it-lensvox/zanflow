import { useState, useRef, useEffect } from 'react';
import { Search, Plus, MessageSquare, MoreHorizontal, Share2, Pencil, Pin, Trash2 } from 'lucide-react';
import type { AgentSession } from '@/types';

const MUTED = '#667085';

interface HistoryPanelProps {
  sessions:          AgentSession[];
  activeSessionId:   number | null;
  searchQuery:       string;
  setSearchQuery:    (q: string) => void;
  isLoading:         boolean;
  sessionTitles:     Record<number, string>;
  onSelectSession:   (id: number) => void;
  onNewConversation: () => void;
  onRenameSession:   (id: number, title: string) => void;
  onDeleteSession:   (id: number) => void;
}
function SessionMenu({ sessionId, title, onRename, onDelete, onClose }: {
  sessionId: number; title: string;
  onRename: (id: number, t: string) => void;
  onDelete:  (id: number) => void;
  onClose:  () => void;
}) {
  const menuRef     = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);
  const [renaming,  setRenaming]  = useState(false);
  const [renameVal, setRenameVal] = useState(title);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { if (renaming) inputRef.current?.focus(); }, [renaming]);

  const commitRename = () => {
    const t = renameVal.trim();
    if (t && t !== title) onRename(sessionId, t);
    onClose();
  };

  if (renaming) return (
    <div ref={menuRef} style={{ position: 'absolute', right: 0, top: 32, zIndex: 300, background: '#1f2937', border: '1px solid #374151', borderRadius: 8, padding: 8, minWidth: 180 }}>
      <input ref={inputRef} value={renameVal} onChange={e => setRenameVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') onClose(); }}
        onBlur={commitRename}
        style={{ width: '100%', background: '#111827', border: '1px solid #4b5563', borderRadius: 6, padding: '5px 8px', fontSize: 12, color: '#f9fafb', outline: 'none', fontFamily: 'inherit' }} />
    </div>
  );

  const items = [
    { icon: <Share2 style={{ width: 12, height: 12 }} />, label: 'Share',    action: () => onClose(),                           danger: false },
    { icon: <Pencil style={{ width: 12, height: 12 }} />, label: 'Rename',   action: () => setRenaming(true),                   danger: false },
    { icon: <Pin    style={{ width: 12, height: 12 }} />, label: 'Pin Chat', action: () => onClose(),                           danger: false },
    { icon: <Trash2 style={{ width: 12, height: 12 }} />, label: 'Delete',   action: () => { onDelete(sessionId); onClose(); }, danger: true  },
  ];

  return (
    <div ref={menuRef} style={{ position: 'absolute', right: 0, top: 32, zIndex: 300, background: '#1f2937', border: '1px solid #374151', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.4)', padding: '4px 0', minWidth: 148 }}>
      {items.map(item => (
        <button key={item.label} onClick={item.action}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: item.danger ? '#f87171' : '#d1d5db', textAlign: 'left', fontFamily: 'inherit' }}
          onMouseEnter={e => e.currentTarget.style.background = item.danger ? '#3f1515' : '#374151'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
          {item.icon}{item.label}
        </button>
      ))}
    </div>
  );
}

export function HistoryPanel({ sessions, activeSessionId, searchQuery, setSearchQuery, isLoading, sessionTitles, onSelectSession, onNewConversation, onRenameSession, onDeleteSession }: HistoryPanelProps) {
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const getTitle = (s: AgentSession) => {
    const t = sessionTitles[s.id];
    if (t) return t.length > 36 ? t.slice(0, 36) + '…' : t;
    return `Conversation ${s.id}`;
  };

  const filtered = sessions.filter(s =>
    getTitle(s).toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(s.id).includes(searchQuery)
  );

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#111827' }}>
      {/* Header */}
      <div style={{ padding: '16px 12px 10px', flexShrink: 0 }}>
        <button onClick={onNewConversation}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid #374151', background: 'transparent', cursor: 'pointer', color: '#e5e7eb', fontSize: 13, fontWeight: 500 }}
          onMouseEnter={e => e.currentTarget.style.background = '#1f2937'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <Plus style={{ width: 14, height: 14 }} />
          New conversation
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '0 12px 8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1f2937', borderRadius: 7, padding: '0 10px', height: 32, border: '1px solid #374151' }}>
          <Search style={{ width: 12, height: 12, color: '#6b7280', flexShrink: 0 }} />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 12, color: '#e5e7eb', fontFamily: 'inherit' }} />
        </div>
      </div>

      {/* Session list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
        <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: '#4b5563', padding: '4px 4px 6px' }}>Recent</p>

        {isLoading ? (
          <p style={{ fontSize: 12, color: '#6b7280', padding: '8px 4px' }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <p style={{ fontSize: 12, color: '#6b7280', padding: '8px 4px' }}>
            {searchQuery ? 'No results' : 'No conversations yet'}
          </p>
        ) : (
          filtered.map(session => {
            const isActive   = session.id === activeSessionId;
            const isMenuOpen = openMenuId === session.id;
            return (
              <div key={session.id} style={{ position: 'relative', marginBottom: 1 }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget.querySelector('.row-btn') as HTMLElement)?.style && ((e.currentTarget.querySelector('.row-btn') as HTMLElement).style.background = '#1f2937'); }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget.querySelector('.row-btn') as HTMLElement)?.style && ((e.currentTarget.querySelector('.row-btn') as HTMLElement).style.background = 'transparent'); }}>

                <button className="row-btn" onClick={() => onSelectSession(session.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left', background: isActive ? '#1f2937' : 'transparent', paddingRight: 32 }}>
                  <MessageSquare style={{ width: 13, height: 13, color: isActive ? '#60a5fa' : '#6b7280', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: isActive ? '#f9fafb' : '#d1d5db', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={sessionTitles[session.id] || `Conversation ${session.id}`}>
                      {getTitle(session)}
                    </p>
                    <p style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>
                      {session.message_count} msg · {formatDate(session.updated_at)}
                    </p>
                  </div>
                </button>

                {/* 3-dot button — appears on hover/active */}
                <button
                  onClick={e => { e.stopPropagation(); setOpenMenuId(isMenuOpen ? null : session.id); }}
                  style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 22, height: 22, borderRadius: 5, border: 'none', background: isMenuOpen ? '#374151' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#374151'}
                  onMouseLeave={e => { if (!isMenuOpen) e.currentTarget.style.background = 'transparent'; }}>
                  <MoreHorizontal style={{ width: 13, height: 13 }} />
                </button>

                {isMenuOpen && (
                  <SessionMenu
                    sessionId={session.id}
                    title={getTitle(session)}
                    onRename={(id, t) => { onRenameSession(id, t); setOpenMenuId(null); }}
                    onDelete={(id)    => { onDeleteSession(id);    setOpenMenuId(null); }}
                    onClose={() => setOpenMenuId(null)}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}