import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  NotebookPen, Plus, FolderPlus, Maximize2, X, Folder, FileText, MoreVertical,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { quickNotesApi } from '@/services/api';
import type { QuickNote, QuickNoteFolder } from '@/types';

// UI State model

export interface QuickNotesState {
  folders: QuickNoteFolder[];
  notes: QuickNote[];
  selectedFolderId: number | 'all';
  selectedNoteId: number | null;
  isLoading: boolean;
}

function getDefaultState(): QuickNotesState {
  return {
    folders: [],
    notes: [],
    selectedFolderId: 'all',
    selectedNoteId: null,
    isLoading: true,
  };
}

export function useQuickNotes() {
  const [state, setState] = useState<QuickNotesState>(getDefaultState);

  // Load folders + notes from backend on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [folders, notesResp] = await Promise.all([
          quickNotesApi.getFolders(),
          quickNotesApi.getNotes(),
        ]);
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          folders,
          notes: notesResp.results,
          isLoading: false,
        }));
      } catch {
        if (!cancelled) setState((prev) => ({ ...prev, isLoading: false }));
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const getNotesForFolder = (folderId: number | 'all'): QuickNote[] => {
    const sorted = [...state.notes].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
    if (folderId === 'all') return sorted;
    return sorted.filter((n) => n.folder === folderId);
  };

  const getNoteTitle = (note: QuickNote): string => {
    if (note.title && note.title.trim()) return note.title;
    const firstLine = note.content.split('\n').find((l) => l.trim());
    return firstLine?.trim().slice(0, 40) || 'Untitled';
  };

  const createNote = async (folderId: number | 'all'): Promise<void> => {
    const targetFolder = folderId === 'all' ? null : folderId;
    const newNote = await quickNotesApi.createNote({
      content: '',
      folder: targetFolder,
    });
    setState((prev) => ({
      ...prev,
      notes: [...prev.notes, newNote],
      selectedNoteId: newNote.id,
    }));
  };

  const updateNote = async (id: number, content: string): Promise<void> => {
    setState((prev) => ({
      ...prev,
      notes: prev.notes.map((n) =>
        n.id === id ? { ...n, content, updated_at: new Date().toISOString() } : n,
      ),
    }));
    try {
      const updated = await quickNotesApi.updateNote(id, { content });
      setState((prev) => ({
        ...prev,
        notes: prev.notes.map((n) =>
          n.id === id ? { ...n, ...updated } : n,
        ),
      }));
    } catch (err) {
      console.error('[QuickNotes] updateNote failed:', err);
    }
  };

  const renameNote = async (noteId: number, newTitle: string): Promise<void> => {
    setState((prev) => ({
      ...prev,
      notes: prev.notes.map((n) =>
        n.id === noteId ? { ...n, title: newTitle, updated_at: new Date().toISOString() } : n,
      ),
    }));
    await quickNotesApi.updateNote(noteId, { title: newTitle });
  };

  const deleteNote = async (noteId: number): Promise<void> => {
    setState((prev) => {
      const remaining = prev.notes.filter((n) => n.id !== noteId);
      const newSelected =
        prev.selectedNoteId === noteId
          ? (remaining.find((n) => n.folder === prev.selectedFolderId || prev.selectedFolderId === 'all')?.id ?? null)
          : prev.selectedNoteId;
      return { ...prev, notes: remaining, selectedNoteId: newSelected };
    });
    await quickNotesApi.deleteNote(noteId);
  };

  const createFolder = async (name: string): Promise<void> => {
    const folder = await quickNotesApi.createFolder({ name });
    setState((prev) => ({
      ...prev,
      folders: [...prev.folders, folder],
      selectedFolderId: folder.id,
    }));
  };

  const selectFolder = (folderId: number | 'all'): void => {
    setState((prev) => {
      const notes =
        folderId === 'all'
          ? [...prev.notes].sort(
            (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
          )
          : [...prev.notes]
            .filter((n) => n.folder === folderId)
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      return { ...prev, selectedFolderId: folderId, selectedNoteId: notes[0]?.id ?? null };
    });
  };

  const selectNote = (noteId: number): void => {
    setState((prev) => ({ ...prev, selectedNoteId: noteId }));
  };

  return {
    state,
    getNotesForFolder,
    getNoteTitle,
    createNote,
    updateNote,
    renameNote,
    deleteNote,
    createFolder,
    selectFolder,
    selectNote,
  };
}

// Shared toolbar icon button (mini window only)

function ToolbarBtn({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
    >
      {icon}
    </button>
  );
}

// ─── Folder sidebar ───────────────────────────────────────────────────────────

interface FolderSidebarProps {
  state: QuickNotesState;
  getNotesForFolder: (folderId: number | 'all') => QuickNote[];
  onSelectFolder: (folderId: number | 'all') => void;
  onCreateFolder: (name: string) => void;
  triggerFolderCreate?: boolean;
  onAcknowledgeFolderCreate?: () => void;
}

export function FolderSidebar({
  state,
  getNotesForFolder,
  onSelectFolder,
  onCreateFolder,
  triggerFolderCreate = false,
  onAcknowledgeFolderCreate,
}: FolderSidebarProps) {
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (triggerFolderCreate) {
      setIsAddingFolder(true);
      onAcknowledgeFolderCreate?.();
    }
  }, [triggerFolderCreate, onAcknowledgeFolderCreate]);

  useEffect(() => {
    if (isAddingFolder) inputRef.current?.focus();
  }, [isAddingFolder]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputVal.trim()) {
      onCreateFolder(inputVal.trim());
      setInputVal('');
      setIsAddingFolder(false);
    }
    if (e.key === 'Escape') {
      setInputVal('');
      setIsAddingFolder(false);
    }
  };

  const allFolderItems = [
    { id: 'all' as const, name: 'All Notes', count: state.notes.length },
    ...state.folders.map((f) => ({
      id: f.id,
      name: f.name,
      count: getNotesForFolder(f.id).length,
    })),
  ];

  return (
    <div className="w-[220px] shrink-0 border-r border-border flex flex-col bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Folders
        </span>
        <button
          onClick={() => setIsAddingFolder(true)}
          title="New Folder"
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {allFolderItems.map((folder) => (
          <button
            key={folder.id}
            onClick={() => onSelectFolder(folder.id)}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors',
              state.selectedFolderId === folder.id
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <Folder
              className={cn(
                'h-4 w-4 shrink-0',
                folder.id === 'all' ? 'text-amber-500' : 'text-blue-500',
              )}
            />
            <span className="flex-1 truncate text-xs font-medium">{folder.name}</span>
            <span className="text-[10px] text-muted-foreground">{folder.count}</span>
          </button>
        ))}

        {isAddingFolder && (
          <div className="px-1 py-1 animate-in fade-in slide-in-from-left-2 duration-150">
            <input
              ref={inputRef}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                setInputVal('');
                setIsAddingFolder(false);
              }}
              placeholder="Folder name…"
              className="w-full rounded-md bg-background border border-border px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Notes list ───────────────────────────────────────────────────────────────

interface NotesListProps {
  state: QuickNotesState;
  visibleNotes: QuickNote[];
  getNoteTitle: (note: QuickNote) => string;
  onSelectNote: (noteId: number) => void;
  onNewNote: () => void;
  onRenameNote: (noteId: number, newTitle: string) => void;
  onDeleteNote: (noteId: number) => void;
}

export function NotesList({
  state,
  visibleNotes,
  getNoteTitle,
  onSelectNote,
  onNewNote,
  onRenameNote,
  onDeleteNote,
}: NotesListProps) {
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuId]);

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  const handleEllipsisClick = (e: React.MouseEvent, noteId: number) => {
    e.stopPropagation();
    setOpenMenuId((prev) => (prev === noteId ? null : noteId));
  };

  const handleRenameClick = (note: QuickNote) => {
    setOpenMenuId(null);
    setRenamingId(note.id);
    setRenameValue(getNoteTitle(note));
  };

  const commitRename = (noteId: number) => {
    const trimmed = renameValue.trim();
    if (trimmed) onRenameNote(noteId, trimmed);
    setRenamingId(null);
    setRenameValue('');
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent, noteId: number) => {
    if (e.key === 'Enter') commitRename(noteId);
    if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
  };

  const handleDeleteClick = (e: React.MouseEvent, noteId: number) => {
    e.stopPropagation();
    setOpenMenuId(null);
    onDeleteNote(noteId);
  };

  return (
    <div className="w-[280px] shrink-0 border-r border-border flex flex-col bg-muted/30">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {visibleNotes.length} {visibleNotes.length === 1 ? 'Note' : 'Notes'}
        </span>
        <button
          onClick={onNewNote}
          title="New Note"
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {state.isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40 gap-2 py-12">
            <p className="text-xs">Loading…</p>
          </div>
        ) : visibleNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40 gap-2 py-12">
            <FileText className="h-8 w-8" />
            <p className="text-xs">No notes yet</p>
          </div>
        ) : (
          visibleNotes.map((note) => {
            const title = getNoteTitle(note);
            const preview = note.content.replace(/\n/g, ' ').slice(0, 80);
            const isSelected = state.selectedNoteId === note.id;
            const isMenuOpen = openMenuId === note.id;
            const isRenaming = renamingId === note.id;

            return (
              <div key={note.id} className="relative">
                <button
                  onClick={() => onSelectNote(note.id)}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b border-border/50 transition-colors hover:bg-accent',
                    isSelected && 'bg-primary/8 border-l-2 border-l-primary',
                  )}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex-1 min-w-0">
                      {isRenaming ? (
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => handleRenameKeyDown(e, note.id)}
                          onBlur={() => commitRename(note.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full text-sm font-medium text-foreground bg-background border border-primary rounded px-1 py-0.5 focus:outline-none leading-tight"
                        />
                      ) : (
                        <p className="text-sm font-medium text-foreground truncate leading-tight">{title}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatRelativeTime(note.updated_at)}
                      </p>
                      {/* {preview && !isRenaming && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-snug">{preview}</p>
                      )} */}
                    </div>

                    {/* Ellipsis trigger */}
                    <button
                      onClick={(e) => handleEllipsisClick(e, note.id)}
                      title="More options"
                      className={cn(
                        'shrink-0 flex h-6 w-6 items-center justify-center rounded transition-colors mt-0.5',
                        isMenuOpen
                          ? 'bg-accent text-foreground'
                          : 'text-muted-foreground hover:bg-accent',
                      )}
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </button>

                {/* Dropdown menu */}
                {isMenuOpen && (
                  <div
                    ref={menuRef}
                    className="absolute right-2 top-8 z-50 min-w-[130px] rounded-lg border border-border bg-popover shadow-md py-1 animate-in fade-in slide-in-from-top-1 duration-100"
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRenameClick(note); }}
                      className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
                    >
                      Rename
                    </button>
                    <button
                      onClick={(e) => handleDeleteClick(e, note.id)}
                      className="w-full text-left px-3 py-1.5 text-xs text-destructive hover:bg-accent transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Note editor ──────────────────────────────────────────────────────────────

interface NoteEditorProps {
  selectedNote: QuickNote | null;
  getNoteTitle: (note: QuickNote) => string;
  onUpdateNote: (id: number, content: string) => void;
  editorRef?: React.RefObject<HTMLTextAreaElement>;
}

export function NoteEditor({
  selectedNote,
  getNoteTitle,
  onUpdateNote,
  editorRef,
}: NoteEditorProps) {
  if (!selectedNote) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/40 bg-background gap-3">
        <FileText className="h-10 w-10" />
        <p className="text-sm">Select or create a note</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden">
      <div className="px-8 pt-6 pb-2 shrink-0 border-b border-border">
        <p className="text-lg font-semibold text-foreground truncate">
          {getNoteTitle(selectedNote)}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          {formatRelativeTime(selectedNote.updated_at)}
        </p>
      </div>
      <textarea
        ref={editorRef}
        value={selectedNote.content}
        onChange={(e) => onUpdateNote(selectedNote.id, e.target.value)}
        className="flex-1 resize-none bg-transparent text-sm text-foreground px-8 py-4 pb-8 placeholder:text-muted-foreground/40 focus:outline-none leading-relaxed selection:bg-primary/20"
        placeholder="Start writing…"
        spellCheck
      />
    </div>
  );
}

// ─── Full 3-column notes UI ───────────────────────────────────────────────────

interface QuickNotesContentProps {
  onNewNote: () => void;
  onCreateFolder: (name: string) => void;
  onSelectFolder: (folderId: number | 'all') => void;
  onSelectNote: (noteId: number) => void;
  onUpdateNote: (id: number, content: string) => void;
  onRenameNote: (noteId: number, newTitle: string) => void;
  onDeleteNote: (noteId: number) => void;
  state: QuickNotesState;
  getNotesForFolder: (folderId: number | 'all') => QuickNote[];
  getNoteTitle: (note: QuickNote) => string;
  triggerFolderCreate?: boolean;
  onAcknowledgeFolderCreate?: () => void;
}

export function QuickNotesContent({
  onNewNote,
  onCreateFolder,
  onSelectFolder,
  onSelectNote,
  onUpdateNote,
  onRenameNote,
  onDeleteNote,
  state,
  getNotesForFolder,
  getNoteTitle,
  triggerFolderCreate = false,
  onAcknowledgeFolderCreate,
}: QuickNotesContentProps) {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const visibleNotes = getNotesForFolder(state.selectedFolderId);
  const selectedNote = state.notes.find((n) => n.id === state.selectedNoteId) ?? null;

  useEffect(() => {
    editorRef.current?.focus();
  }, [state.selectedNoteId]);

  return (
    <div className="flex flex-1 overflow-hidden">
      <FolderSidebar
        state={state}
        getNotesForFolder={getNotesForFolder}
        onSelectFolder={onSelectFolder}
        onCreateFolder={onCreateFolder}
        triggerFolderCreate={triggerFolderCreate}
        onAcknowledgeFolderCreate={onAcknowledgeFolderCreate}
      />
      <NotesList
        state={state}
        visibleNotes={visibleNotes}
        getNoteTitle={getNoteTitle}
        onSelectNote={onSelectNote}
        onNewNote={onNewNote}
        onRenameNote={onRenameNote}
        onDeleteNote={onDeleteNote}
      />
      <NoteEditor
        selectedNote={selectedNote}
        getNoteTitle={getNoteTitle}
        onUpdateNote={onUpdateNote}
        editorRef={editorRef}
      />
    </div>
  );
}

// ─── Mini window (FAB popup) ──────────────────────────────────────────────────

interface MiniWindowProps {
  selectedNote: QuickNote | null;
  getNoteTitle: (note: QuickNote) => string;
  onClose: () => void;
  onMaximize: () => void;
  onNewNote: () => void;
  onNewFolder: () => void;
  onUpdateNote: (id: number, content: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}

function MiniWindow({
  selectedNote,
  getNoteTitle,
  onClose,
  onMaximize,
  onNewNote,
  onNewFolder,
  onUpdateNote,
  textareaRef,
}: MiniWindowProps) {
  return (
    <div
      className={cn(
        'w-[340px] rounded-2xl border border-border',
        'bg-card shadow-2xl flex flex-col overflow-hidden',
        'animate-in fade-in slide-in-from-bottom-4 duration-200',
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/40">
        <div className="flex items-center gap-1">
          <ToolbarBtn
            icon={<Plus className="h-3.5 w-3.5" />}
            label="New Note"
            onClick={onNewNote}
          />
          <ToolbarBtn
            icon={<FolderPlus className="h-3.5 w-3.5" />}
            label="New Folder"
            onClick={onNewFolder}
          />
        </div>
        <div className="flex items-center gap-1">
          <ToolbarBtn
            icon={<Maximize2 className="h-3.5 w-3.5" />}
            label="Open Quick Notes page"
            onClick={onMaximize}
          />
          <ToolbarBtn
            icon={<X className="h-3.5 w-3.5" />}
            label="Close"
            onClick={onClose}
          />
        </div>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={selectedNote?.content ?? ''}
        onChange={(e) => selectedNote && onUpdateNote(selectedNote.id, e.target.value)}
        placeholder="Start typing a note…"
        className="h-[200px] resize-none bg-background text-sm text-foreground px-4 py-3 placeholder:text-muted-foreground/40 focus:outline-none leading-relaxed"
      />

      {/* Footer hint */}
      <div className="px-4 py-1.5 text-[10px] text-muted-foreground border-t border-border bg-muted/40 flex items-center justify-between">
        <span className="truncate">
          {selectedNote ? getNoteTitle(selectedNote) : 'No note selected'}
        </span>
        {selectedNote && (
          <span className="shrink-0 ml-2">{formatRelativeTime(selectedNote.updated_at)}</span>
        )}
      </div>
    </div>
  );
}

// FAB + mini window 

const FAB_SIZE = 48;
const MINI_W = 340;
const MINI_H = 260;
const FAB_POS_KEY = 'zanflow_fab_pos';

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}

function getInitialFabPos(): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(FAB_POS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { }
  return {
    x: window.innerWidth - FAB_SIZE * 2 - 24 - 12,
    y: window.innerHeight - FAB_SIZE - 24,
  };
}

export function QuickNotes() {
  const navigate = useNavigate();
  const [isMiniOpen, setIsMiniOpen] = useState(false);
  const miniTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [fabPos, setFabPos] = useState<{ x: number; y: number }>(getInitialFabPos);
  const dragging = useRef(false);
  const didDrag = useRef(false);
  const dragStart = useRef<{ mx: number; my: number; fx: number; fy: number } | null>(null);

  useEffect(() => {
    localStorage.setItem(FAB_POS_KEY, JSON.stringify(fabPos));
  }, [fabPos]);

  useEffect(() => {
    const onResize = () => {
      setFabPos((prev) => ({
        x: clamp(prev.x, 0, window.innerWidth - FAB_SIZE),
        y: clamp(prev.y, 0, window.innerHeight - FAB_SIZE),
      }));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didDrag.current = true;
    setFabPos({
      x: clamp(dragStart.current.fx + dx, 0, window.innerWidth - FAB_SIZE),
      y: clamp(dragStart.current.fy + dy, 0, window.innerHeight - FAB_SIZE),
    });
  }, []);

  const onMouseUp = useCallback(() => {
    dragging.current = false;
    dragStart.current = null;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }, [onMouseMove]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    didDrag.current = false;
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, fx: fabPos.x, fy: fabPos.y };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [fabPos, onMouseMove, onMouseUp]);

  const { state, getNoteTitle, createNote, updateNote } = useQuickNotes();
  const selectedNote = state.notes.find((n) => n.id === state.selectedNoteId) ?? null;

  useEffect(() => {
    if (isMiniOpen) {
      const id = setTimeout(() => miniTextareaRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [isMiniOpen]);

  const handleNewNote = () => { createNote(state.selectedFolderId); };

  const handleFabClick = () => {
    if (didDrag.current) return;
    if (!isMiniOpen && !selectedNote) createNote(state.selectedFolderId);
    setIsMiniOpen((prev) => !prev);
  };

  const handleMaximize = () => { setIsMiniOpen(false); navigate('/quick-notes'); };
  const handleNewFolder = () => { setIsMiniOpen(false); navigate('/quick-notes'); };

  const miniLeft = clamp(fabPos.x + FAB_SIZE / 2 - MINI_W / 2, 8, window.innerWidth - MINI_W - 8);
  const miniTop = clamp(fabPos.y - MINI_H - 12, 8, window.innerHeight - MINI_H - 8);

  return (
    <>
      {/* FAB */}
      <button
        onMouseDown={handleMouseDown}
        onClick={handleFabClick}
        title="Quick Notes (drag to reposition)"
        style={{ left: fabPos.x, top: fabPos.y }}
        className={cn(
          'fixed z-[60] flex h-12 w-12 items-center justify-center rounded-full',
          'bg-primary text-primary-foreground shadow-lg',
          'hover:opacity-90 transition-opacity duration-200',
          'focus:outline-none cursor-grab active:cursor-grabbing select-none',
        )}
      >
        <NotebookPen className="h-5 w-5 pointer-events-none" />
      </button>

      {/* Mini window */}
      {isMiniOpen && (
        <div style={{ position: 'fixed', left: miniLeft, top: miniTop, zIndex: 60 }}>
          <MiniWindow
            selectedNote={selectedNote}
            getNoteTitle={getNoteTitle}
            onClose={() => setIsMiniOpen(false)}
            onMaximize={handleMaximize}
            onNewNote={handleNewNote}
            onNewFolder={handleNewFolder}
            onUpdateNote={updateNote}
            textareaRef={miniTextareaRef}
          />
        </div>
      )}
    </>
  );
}