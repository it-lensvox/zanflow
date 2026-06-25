import { useState, useEffect, useRef } from 'react';
import { Plus, FileText, MoreVertical, Search } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import DeleteModal from '@/components/common/Deletemodal';
import { AttachProjectModal } from './AttachProjectModal';
import type { QuickNote } from '@/types';
import type { QuickNotesState } from '../hooks/useQuickNotes';

interface NotesListProps {
  state: QuickNotesState;
  visibleNotes: QuickNote[];
  getNoteTitle: (note: QuickNote) => string;
  onSelectNote: (noteId: number) => void;
  onNewNote: () => void;
  onRenameNote: (noteId: number, newTitle: string) => void;
  onDeleteNote: (noteId: number) => void;
  onAttachToProject: (noteId: number, projectId: number | null) => void;
}

export function NotesList({ state, visibleNotes, getNoteTitle, onSelectNote, onNewNote, onRenameNote, onDeleteNote, onAttachToProject }: NotesListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [attachTarget, setAttachTarget] = useState<QuickNote | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuId]);

  useEffect(() => { if (renamingId) renameInputRef.current?.focus(); }, [renamingId]);

  const commitRename = (noteId: number) => {
    const trimmed = renameValue.trim();
    if (trimmed) onRenameNote(noteId, trimmed);
    setRenamingId(null); setRenameValue('');
  };

  return (
    <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid #e6ebf2', display: 'flex', flexDirection: 'column', background: '#fafafa', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #e6ebf2', flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: '#667085' }}>
          {visibleNotes.length} {visibleNotes.length === 1 ? 'Note' : 'Notes'}
        </span>
        <button onClick={onNewNote} title="New Note"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 4, border: 'none', background: 'none', cursor: 'pointer', color: '#667085' }}
          onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
          <Plus style={{ width: 13, height: 13 }} />
        </button>
      </div>

      {/* Search bar */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #e6ebf2', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, background: '#f3f4f6', borderRadius: 7, padding: '0 10px', border: '1px solid transparent' }}
          onFocusCapture={e => (e.currentTarget.style.borderColor = '#1663f6', e.currentTarget.style.background = '#fff')}
          onBlurCapture={e => (e.currentTarget.style.borderColor = 'transparent', e.currentTarget.style.background = '#f3f4f6')}>
          <Search style={{ width: 12, height: 12, color: '#667085', flexShrink: 0 }} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search notes…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 12, color: '#172033', fontFamily: 'inherit' }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}
              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: '#667085', fontSize: 11, lineHeight: 1 }}>✕</button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {(() => {
          const q = searchQuery.trim().toLowerCase();
          const filtered = q
            ? visibleNotes.filter(n =>
              getNoteTitle(n).toLowerCase().includes(q) ||
              (n.content || '').toLowerCase().includes(q)
            )
            : visibleNotes;

          if (state.isLoading) return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#667085' }}>
              <p style={{ fontSize: 12 }}>Loading…</p>
            </div>
          );
          if (filtered.length === 0) return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', gap: 8, padding: '48px 0' }}>
              <FileText style={{ width: 28, height: 28 }} />
              <p style={{ fontSize: 12 }}>{q ? 'No matching notes' : 'No notes yet'}</p>
            </div>
          );
          return filtered.map(note => {
            const title = getNoteTitle(note);
            const isSelected = state.selectedNoteId === note.id;
            const isMenuOpen = openMenuId === note.id;
            const isRenaming = renamingId === note.id;
            const isReadOnly = state.folders.find(f => f.id === note.folder)?.name === 'Team Member Updates' || getNoteTitle(note) === 'Team Member Updates';

            return (
              <div key={note.id} style={{ position: 'relative' }}>
                <button onClick={() => onSelectNote(note.id)}
                  style={{ width: '100%', textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid #f3f4f6', background: isSelected ? '#eff6ff' : 'transparent', borderLeft: isSelected ? '2px solid #1663f6' : '2px solid transparent', cursor: 'pointer' }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f5f7fa'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isSelected ? '#eff6ff' : 'transparent'; }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isRenaming ? (
                        <input ref={renameInputRef} value={renameValue} onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') commitRename(note.id); if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); } }}
                          onBlur={() => commitRename(note.id)} onClick={e => e.stopPropagation()}
                          style={{ width: '100%', fontSize: 13, fontWeight: 500, color: '#172033', background: '#fff', border: '1px solid #1663f6', borderRadius: 4, padding: '1px 4px', outline: 'none' }} />
                      ) : (
                        <p style={{ fontSize: 13, fontWeight: 500, color: isSelected ? '#172033' : '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <p style={{ fontSize: 10, color: '#667085' }}>{formatRelativeTime(note.updated_at)}</p>
                        {note.updated_by && (() => {
                          const u = state.users.find(user => user.id === note.updated_by);
                          const name = u?.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : (u?.username || 'User');
                          return <span style={{ fontSize: 9, background: '#f3f4f6', padding: '1px 5px', borderRadius: 3, color: '#667085' }}>✎ {name}</span>;
                        })()}
                      </div>
                    </div>

                    {!isReadOnly && (
                      <button onClick={e => { e.stopPropagation(); setOpenMenuId(prev => prev === note.id ? null : note.id); }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 4, border: 'none', cursor: 'pointer', background: isMenuOpen ? '#e5e7eb' : 'none', color: '#667085', flexShrink: 0 }}
                        onMouseEnter={e => e.currentTarget.style.background = '#e5e7eb'}
                        onMouseLeave={e => e.currentTarget.style.background = isMenuOpen ? '#e5e7eb' : 'none'}>
                        <MoreVertical style={{ width: 12, height: 12 }} />
                      </button>
                    )}
                  </div>
                </button>

                {isMenuOpen && (
                  <div ref={menuRef} style={{ position: 'absolute', right: 8, top: 34, zIndex: 50, minWidth: 130, borderRadius: 8, border: '1px solid #e6ebf2', background: '#fff', boxShadow: '0 4px 16px rgba(16,24,40,.1)', padding: '4px 0' }}>
                    <button onClick={e => { e.stopPropagation(); setOpenMenuId(null); setRenamingId(note.id); setRenameValue(getNoteTitle(note)); }}
                      style={{ width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: 12, color: '#172033', background: 'none', border: 'none', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}>Rename</button>
                    {note.user === state.currentUserId && (
                      <button onClick={e => { e.stopPropagation(); setOpenMenuId(null); setAttachTarget(note); }}
                        style={{ width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: 12, color: '#172033', background: 'none', border: 'none', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}>Attach to Project</button>
                    )}
                    {note.user === state.currentUserId && (
                      <button onClick={e => { e.stopPropagation(); setOpenMenuId(null); setDeleteTarget({ id: note.id, title: getNoteTitle(note) }); }}
                        style={{ width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}>Delete</button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        })()}
      </div>

      <AttachProjectModal isOpen={!!attachTarget} onClose={() => setAttachTarget(null)} currentProjectId={attachTarget?.project}
        onAttach={projectId => { if (attachTarget) onAttachToProject(attachTarget.id, projectId); }} />

      <DeleteModal isOpen={!!deleteTarget} type="confirm" itemType="note" itemName={deleteTarget?.title}
        onConfirm={() => { if (deleteTarget) onDeleteNote(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}