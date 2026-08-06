// ─── QuickNotes FAB + MiniWindow ─────────────────────────────────────────────
// This file is intentionally slim — only the floating button and mini editor.
// All page logic lives in src/pages/QuickNotes/.
// This component is mounted globally in Layout.tsx so it appears on every page.

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotebookPen, Plus, FolderPlus, Maximize2, X } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { useQuickNotes } from '@/pages/QuickNotes/hooks/useQuickNotes';
import type { QuickNote } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────
const FAB_SIZE    = 48;
const MINI_W      = 340;
const MINI_H      = 260;
const FAB_POS_KEY = 'zanflow_quicknotes_fab_pos';

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}

function getInitialFabPos(): { x: number; y: number } {
  return {
    x: window.innerWidth  - FAB_SIZE - 24,
    y: window.innerHeight - FAB_SIZE - 132,
  };
}

// ─── Toolbar icon button (mini window only) ───────────────────────────────────
function ToolbarBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={label}
      className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
      {icon}
    </button>
  );
}

// ─── Mini window ─────────────────────────────────────────────────────────────
interface MiniWindowProps {
  selectedNote:       QuickNote | null;
  isReadOnly?:        boolean;
  getNoteTitle:       (note: QuickNote) => string;
  onClose:            () => void;
  onMaximize:         () => void;
  onNewNote:          () => void;
  onNewFolder:        () => void;
  onUpdateNote:       (id: number | 'pending', content: string) => void;
  onFlushAndMaximize: (pendingContent: string) => void;
}

function MiniWindow({ selectedNote, isReadOnly = false, getNoteTitle, onClose, onNewNote, onNewFolder, onUpdateNote, onFlushAndMaximize }: MiniWindowProps) {
  const [localContent, setLocalContent] = useState(selectedNote?.content ?? '');
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setLocalContent(selectedNote?.content ?? ''); }, [selectedNote?.id]);
  useEffect(() => { const id = requestAnimationFrame(() => textareaRef.current?.focus()); return () => cancelAnimationFrame(id); }, []);
  useEffect(() => { return () => { if (debounceRef.current) clearTimeout(debounceRef.current); }; }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setLocalContent(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onUpdateNote(selectedNote ? selectedNote.id : 'pending', value), 800);
  };

  const handleMaximizeClick = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onFlushAndMaximize(localContent);
  };

  return (
    <div className={cn('w-[340px] rounded-2xl border border-border', 'bg-card shadow-2xl flex flex-col overflow-hidden', 'animate-in fade-in slide-in-from-bottom-4 duration-200')}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/40">
        <div className="flex items-center gap-1">
          <ToolbarBtn icon={<Plus className="h-3.5 w-3.5" />}       label="New Note"              onClick={onNewNote} />
          <ToolbarBtn icon={<FolderPlus className="h-3.5 w-3.5" />} label="New Folder"            onClick={onNewFolder} />
        </div>
        <div className="flex items-center gap-1">
          <ToolbarBtn icon={<Maximize2 className="h-3.5 w-3.5" />}  label="Open Quick Notes page" onClick={handleMaximizeClick} />
          <ToolbarBtn icon={<X className="h-3.5 w-3.5" />}          label="Close"                 onClick={onClose} />
        </div>
      </div>

      <textarea ref={textareaRef} value={localContent} onChange={handleChange} readOnly={isReadOnly}
        placeholder={isReadOnly ? 'This note is read-only.' : 'Start typing a note…'}
        className={cn('h-[200px] resize-none bg-background text-sm text-foreground px-4 py-3 placeholder:text-muted-foreground/40 focus:outline-none leading-relaxed', isReadOnly && 'cursor-not-allowed opacity-80')} />

      <div className="px-4 py-1.5 text-[10px] text-muted-foreground border-t border-border bg-muted/40 flex items-center justify-between">
        <span className="truncate">{selectedNote ? getNoteTitle(selectedNote) : 'No note selected'}</span>
        {selectedNote && <span className="shrink-0 ml-2">{formatRelativeTime(selectedNote.updated_at)}</span>}
      </div>
    </div>
  );
}

// ─── FAB ─────────────────────────────────────────────────────────────────────
export function QuickNotes() {
  const navigate = useNavigate();
  const [isMiniOpen, setIsMiniOpen] = useState(false);
  const [fabPos,     setFabPos]     = useState<{ x: number; y: number }>(getInitialFabPos);
  const dragging  = useRef(false);
  const didDrag   = useRef(false);
  const dragStart = useRef<{ mx: number; my: number; fx: number; fy: number } | null>(null);

  useEffect(() => { localStorage.setItem(FAB_POS_KEY, JSON.stringify(fabPos)); }, [fabPos]);

  useEffect(() => {
    const onResize = () => setFabPos(prev => ({ x: clamp(prev.x, 0, window.innerWidth - FAB_SIZE), y: clamp(prev.y, 0, window.innerHeight - FAB_SIZE) }));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didDrag.current = true;
    setFabPos({ x: clamp(dragStart.current.fx + dx, 0, window.innerWidth - FAB_SIZE), y: clamp(dragStart.current.fy + dy, 0, window.innerHeight - FAB_SIZE) });
  }, []);

  const onMouseUp = useCallback(() => {
    dragging.current = false; dragStart.current = null;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }, [onMouseMove]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); didDrag.current = false; dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, fx: fabPos.x, fy: fabPos.y };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [fabPos, onMouseMove, onMouseUp]);

  const { state, getNoteTitle, createNote, updateNote } = useQuickNotes();
  const selectedNote = state.notes.find(n => n.id === state.selectedNoteId) ?? null;

  const handleFabClick = () => {
    if (didDrag.current) return;
    if (!isMiniOpen && !selectedNote) createNote(state.selectedFolderId);
    setIsMiniOpen(prev => !prev);
  };

  const handleFlushAndMaximize = (pendingContent: string) => {
    if (pendingContent.trim()) updateNote(selectedNote ? selectedNote.id : 'pending', pendingContent);
    setIsMiniOpen(false);
    navigate('/quick-notes', { state: { selectedNoteId: selectedNote?.id ?? null } });
  };

  const handleMaximize  = () => { setIsMiniOpen(false); navigate('/quick-notes', { state: { selectedNoteId: selectedNote?.id ?? null } }); };
  const handleNewFolder = () => { setIsMiniOpen(false); navigate('/quick-notes'); };

  const miniLeft = clamp(fabPos.x + FAB_SIZE / 2 - MINI_W / 2, 8, window.innerWidth - MINI_W - 8);
  const miniTop  = clamp(fabPos.y - MINI_H - 12, 8, window.innerHeight - MINI_H - 8);

  return (
    <>
      <button onMouseDown={handleMouseDown} onClick={handleFabClick}
        title="Quick Notes (drag to reposition)"
        style={{ left: fabPos.x, top: fabPos.y }}
        className={cn('fixed z-[60] flex h-12 w-12 items-center justify-center rounded-full', 'bg-primary text-primary-foreground shadow-lg', 'hover:opacity-90 transition-opacity duration-200', 'focus:outline-none cursor-grab active:cursor-grabbing select-none')}>
        <NotebookPen className="h-5 w-5 pointer-events-none" />
      </button>

      {isMiniOpen && (
        <div className="fixed z-[60] px-2 sm:px-0" style={{ left: miniLeft, top: miniTop, maxWidth: '100vw' }}>
          <MiniWindow
            selectedNote={selectedNote}
            isReadOnly={selectedNote ? (state.folders.find(f => f.id === selectedNote.folder)?.name === 'Team Member Updates' || getNoteTitle(selectedNote) === 'Team Member Updates') : false}
            getNoteTitle={getNoteTitle}
            onClose={() => setIsMiniOpen(false)}
            onMaximize={handleMaximize}
            onNewNote={() => createNote(state.selectedFolderId)}
            onNewFolder={handleNewFolder}
            onUpdateNote={updateNote}
            onFlushAndMaximize={handleFlushAndMaximize}
          />
        </div>
      )}
    </>
  );
}