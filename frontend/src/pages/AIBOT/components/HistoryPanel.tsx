import { useState, useRef, useEffect } from 'react';
import { Search, Plus, MoreHorizontal, Pencil, Pin, Trash2, Sparkles, Clock, CheckSquare, Square, X } from 'lucide-react';
import type { AgentSession } from '@/types';

interface HistoryPanelProps {
  sessions:          AgentSession[];
  activeSessionId:   number | null;
  searchQuery:       string;
  setSearchQuery:    (q: string) => void;
  isLoading:         boolean;
  onSelectSession:   (id: number) => void;
  onNewConversation: () => void;
  onRenameSession:   (id: number, title: string) => void;
  onPinSession:      (id: number, isPinned: boolean) => void;
  onDeleteSession:   (id: number) => void;
  onBulkDelete:      (ids: number[]) => void;
}

function SessionMenu({ sessionId, title, isPinned, onRename, onPin, onDelete, onClose }: {
  sessionId: number; title: string; isPinned: boolean;
  onRename: (id: number, t: string) => void;
  onPin:    (id: number, isPinned: boolean) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [renaming,  setRenaming]  = useState(false);
  const [renameVal, setRenameVal] = useState(title);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { if (renaming) inputRef.current?.focus(); }, [renaming]);

  const commitRename = () => { const t = renameVal.trim(); if (t && t !== title) onRename(sessionId, t); onClose(); };

  if (renaming) return (
    <div ref={menuRef} style={{ position: 'absolute', right: 0, top: 32, zIndex: 300, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 8, minWidth: 200, boxShadow: '0 16px 48px rgba(0,0,0,.6)' }}>
      <input ref={inputRef} value={renameVal} onChange={e => setRenameVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') onClose(); }} onBlur={commitRename}
        style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#f1f5f9', outline: 'none', fontFamily: 'inherit' }} />
    </div>
  );

  if (confirmDelete) return (
    <div ref={menuRef} style={{ position: 'absolute', right: 0, top: 32, zIndex: 300, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 12, minWidth: 200, boxShadow: '0 16px 48px rgba(0,0,0,.6)' }}>
      <p style={{ fontSize: 12, color: '#f1f5f9', marginBottom: 10 }}>Delete this conversation?</p>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => { onDelete(sessionId); onClose(); }}
          style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          Delete
        </button>
        <button onClick={() => setConfirmDelete(false)}
          style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: '1px solid #1e293b', background: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          Cancel
        </button>
      </div>
    </div>
  );

  const items = [
    { icon: <Pencil style={{ width: 11, height: 11 }} />, label: 'Rename',          action: () => setRenaming(true),                              danger: false },
    { icon: <Pin    style={{ width: 11, height: 11 }} />, label: isPinned ? 'Unpin' : 'Pin', action: () => { onPin(sessionId, !isPinned); onClose(); }, danger: false },
    { icon: <Trash2 style={{ width: 11, height: 11 }} />, label: 'Delete',           action: () => setConfirmDelete(true),                         danger: true  },
  ];

  return (
    <div ref={menuRef} style={{ position: 'absolute', right: 0, top: 32, zIndex: 300, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, boxShadow: '0 16px 48px rgba(0,0,0,.6)', padding: '4px 0', minWidth: 144 }}>
      {items.map(item => (
        <button key={item.label} onClick={item.action}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: item.danger ? '#f87171' : '#94a3b8', textAlign: 'left', fontFamily: 'inherit' }}
          onMouseEnter={e => e.currentTarget.style.background = item.danger ? '#1f0a0a' : '#1e293b'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
          {item.icon}{item.label}
        </button>
      ))}
    </div>
  );
}

export function HistoryPanel({ sessions, activeSessionId, searchQuery, setSearchQuery, isLoading, onSelectSession, onNewConversation, onRenameSession, onPinSession, onDeleteSession, onBulkDelete }: HistoryPanelProps) {
  const [openMenuId,    setOpenMenuId]    = useState<number | null>(null);
  const [selectMode,    setSelectMode]    = useState(false);
  const [selectedIds,   setSelectedIds]   = useState<Set<number>>(new Set());
  const [bulkConfirm,   setBulkConfirm]   = useState(false);

  const getTitle = (s: AgentSession) => {
    const t = s.title || `Session ${s.id}`;
    return t.length > 32 ? t.slice(0, 32) + '…' : t;
  };

  const filtered = sessions.filter(s =>
    getTitle(s).toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(s.id).includes(searchQuery)
  );

  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); setBulkConfirm(false); };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allFilteredIds = filtered.map(s => s.id);
  const allSelected    = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.has(id));

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(allFilteredIds));
  };

  const handleBulkDelete = () => {
    onBulkDelete(Array.from(selectedIds));
    exitSelectMode();
  };

  const formatDate = (iso: string) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60)    return 'just now';
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

 const renderSession = (session: AgentSession) => {
    const isActive     = session.id === activeSessionId;
    const isMenuOpen   = openMenuId === session.id;
    const isSelected   = selectedIds.has(session.id);

    return (
      <div key={session.id} style={{ position: 'relative', marginBottom: 2 }}>
        <button
          onClick={() => selectMode ? toggleSelect(session.id) : onSelectSession(session.id)}
          style={{
            width: '100%', display: 'flex', alignItems: 'flex-start', gap: 9,
            padding: '9px 30px 9px 10px', borderRadius: 9, border: 'none',
            cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
            background: isSelected
              ? 'rgba(239,68,68,.12)'
              : isActive
                ? 'linear-gradient(135deg, rgba(22,99,246,.15), rgba(22,99,246,.08))'
                : 'transparent',
            borderLeft: isSelected
              ? '2px solid #ef4444'
              : isActive ? '2px solid #3b82f6' : '2px solid transparent',
          }}
          onMouseEnter={e => { if (!isActive && !isSelected) e.currentTarget.style.background = '#0f172a'; }}
          onMouseLeave={e => { if (!isActive && !isSelected) e.currentTarget.style.background = 'transparent'; }}>

          {/* Checkbox in select mode */}
          {selectMode && (
            <div style={{ flexShrink: 0, marginTop: 2, color: isSelected ? '#ef4444' : '#334155' }}>
              {isSelected
                ? <CheckSquare style={{ width: 13, height: 13 }} />
                : <Square      style={{ width: 13, height: 13 }} />
              }
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
              {session.is_pinned && !selectMode && (
                <Pin style={{ width: 9, height: 9, color: '#60a5fa', flexShrink: 0 }} />
              )}
              <p style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: isSelected ? '#fca5a5' : isActive ? '#e2e8f0' : '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={session.title || `Session ${session.id}`}>
                {getTitle(session)}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock style={{ width: 9, height: 9, color: '#334155' }} />
              <span style={{ fontSize: 9, color: '#475569' }}>{formatDate(session.updated_at)}</span>
              <span style={{ fontSize: 9, color: '#334155' }}>· {session.message_count} msg</span>
            </div>
          </div>
        </button>

        {!selectMode && (
          <button
            onClick={e => { e.stopPropagation(); setOpenMenuId(isMenuOpen ? null : session.id); }}
            style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, borderRadius: 5, border: 'none', background: isMenuOpen ? '#1e293b' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', transition: 'all .15s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#1e293b'}
            onMouseLeave={e => { if (!isMenuOpen) e.currentTarget.style.background = 'transparent'; }}>
            <MoreHorizontal style={{ width: 11, height: 11 }} />
          </button>
        )}

        {isMenuOpen && (
          <SessionMenu
            sessionId={session.id} title={getTitle(session)} isPinned={session.is_pinned}
            onRename={(id, t) => { onRenameSession(id, t); setOpenMenuId(null); }}
            onPin={(id, p) => { onPinSession(id, p); setOpenMenuId(null); }}
            onDelete={(id) => { onDeleteSession(id); setOpenMenuId(null); }}
            onClose={() => setOpenMenuId(null)}
          />
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#080f1a' }}>

      {/* Header */}
      <div style={{ padding: '18px 14px 14px', flexShrink: 0 }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #1e3a5f, #1663f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(22,99,246,.4)' }}>
            <Sparkles style={{ width: 14, height: 14, color: '#93c5fd' }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-.01em' }}>Dyuksa AI</p>
            <p style={{ fontSize: 9, color: '#475569', fontWeight: 500, letterSpacing: '.04em', textTransform: 'uppercase' as const }}>Workspace assistant</p>
          </div>
        </div>

        {/* New conversation + Select toggle */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onNewConversation}
            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 10, border: '1px solid #1e293b', background: 'linear-gradient(135deg, #0f172a, #1e293b)', cursor: 'pointer', color: '#94a3b8', fontSize: 12, fontWeight: 500, transition: 'all .2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.color = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e293b'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.boxShadow = 'none'; }}>
            <Plus style={{ width: 13, height: 13 }} />
            New conversation
          </button>
          <button onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
            title={selectMode ? 'Cancel selection' : 'Select chats to delete'}
            style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${selectMode ? '#ef4444' : '#1e293b'}`, background: selectMode ? 'rgba(239,68,68,.12)' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: selectMode ? '#ef4444' : '#475569', flexShrink: 0, transition: 'all .2s' }}>
            {selectMode ? <X style={{ width: 13, height: 13 }} /> : <CheckSquare style={{ width: 13, height: 13 }} />}
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '0 12px 10px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#0f172a', borderRadius: 8, padding: '0 11px', height: 33, border: '1px solid #1e293b', transition: 'border-color .2s' }}
          onFocusCapture={e => e.currentTarget.style.borderColor = '#334155'}
          onBlurCapture={e => e.currentTarget.style.borderColor = '#1e293b'}>
          <Search style={{ width: 11, height: 11, color: '#475569', flexShrink: 0 }} />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 12, color: '#cbd5e1', fontFamily: 'inherit' }} />
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #1e293b, transparent)', margin: '0 12px 8px' }} />

      {/* Bulk action toolbar */}
      {selectMode && (
        <div style={{ padding: '0 12px 10px', flexShrink: 0 }}>
          {bulkConfirm ? (
            <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, padding: '10px 12px' }}>
              <p style={{ fontSize: 11, color: '#fca5a5', marginBottom: 8 }}>
                Delete {selectedIds.size} conversation{selectedIds.size > 1 ? 's' : ''}? This cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={handleBulkDelete}
                  style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Delete
                </button>
                <button onClick={() => setBulkConfirm(false)}
                  style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: '1px solid #1e293b', background: 'none', color: '#94a3b8', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Select all checkbox */}
              <button onClick={toggleSelectAll}
                style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid #1e293b', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 11, fontFamily: 'inherit' }}>
                {allSelected
                  ? <CheckSquare style={{ width: 12, height: 12, color: '#ef4444' }} />
                  : <Square      style={{ width: 12, height: 12 }} />
                }
                {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
              </button>
              {/* Delete selected */}
              <button
                onClick={() => setBulkConfirm(true)}
                disabled={selectedIds.size === 0}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 10px', borderRadius: 8, border: 'none', background: selectedIds.size > 0 ? '#ef4444' : '#1e293b', color: selectedIds.size > 0 ? '#fff' : '#334155', fontSize: 11, fontWeight: 600, cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed', fontFamily: 'inherit', transition: 'all .15s' }}>
                <Trash2 style={{ width: 11, height: 11 }} />
                Delete
              </button>
            </div>
          )}
        </div>
      )}

      {/* Session list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
        {isLoading ? (
          <p style={{ fontSize: 12, color: '#475569', padding: '10px 8px' }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '28px 12px', textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: '#475569' }}>{searchQuery ? 'No results' : 'No conversations yet'}</p>
            <p style={{ fontSize: 11, color: '#334155', marginTop: 4 }}>Start a new conversation above</p>
          </div>
        ) : (
          <>
            {/* ── Pinned section */}
            {filtered.some(s => s.is_pinned) && (
              <>
                <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.1em', color: '#60a5fa', padding: '4px 8px 6px' }}>Pinned</p>
                {filtered.filter(s => s.is_pinned).map(session => renderSession(session))}
                <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #1e293b, transparent)', margin: '6px 4px 8px' }} />
              </>
            )}

            {/* ── Recents section */}
            {filtered.some(s => !s.is_pinned) && (
              <>
                <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.1em', color: '#334155', padding: '4px 8px 6px' }}>Recents</p>
                {filtered.filter(s => !s.is_pinned).map(session => renderSession(session))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}