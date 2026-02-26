import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  NotebookPen, Plus, FolderPlus, Maximize2, X, Folder, FileText,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';

// ─── Data model ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'zanflow_quick_notes';

export interface QuickNote {
  id: string;
  folderId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuickNoteFolder {
  id: string;
  name: string;
  createdAt: string;
}

export interface QuickNotesState {
  folders: QuickNoteFolder[];
  notes: QuickNote[];
  selectedFolderId: string;
  selectedNoteId: string | null;
}

function getDefaultState(): QuickNotesState {
  return {
    folders: [{ id: 'default', name: 'Notes', createdAt: new Date().toISOString() }],
    notes: [],
    selectedFolderId: 'all',
    selectedNoteId: null,
  };
}

// ─── Internal hook (exported so page can reuse) ───────────────────────────────

export function useQuickNotes() {
  const [state, setState] = useState<QuickNotesState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as QuickNotesState;
    } catch { /* ignore */ }
    return getDefaultState();
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const getNotesForFolder = (folderId: string): QuickNote[] => {
    const sorted = [...state.notes].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    if (folderId === 'all') return sorted;
    return sorted.filter((n) => n.folderId === folderId);
  };

  const getNoteTitle = (content: string): string => {
    const firstLine = content.split('\n').find((l) => l.trim()) ?? '';
    return firstLine.slice(0, 40) || 'Untitled';
  };

  const createNote = (folderId: string): string => {
    const id = Date.now().toString();
    const now = new Date().toISOString();
    const targetFolder = folderId === 'all' ? 'default' : folderId;
    const newNote: QuickNote = { id, folderId: targetFolder, content: '', createdAt: now, updatedAt: now };
    setState((prev) => ({ ...prev, notes: [...prev.notes, newNote], selectedNoteId: id }));
    return id;
  };

  const updateNote = (id: string, content: string): void => {
    setState((prev) => ({
      ...prev,
      notes: prev.notes.map((n) =>
        n.id === id ? { ...n, content, updatedAt: new Date().toISOString() } : n,
      ),
    }));
  };

  const createFolder = (name: string): void => {
    const id = Date.now().toString();
    const folder: QuickNoteFolder = { id, name, createdAt: new Date().toISOString() };
    setState((prev) => ({ ...prev, folders: [...prev.folders, folder], selectedFolderId: id }));
  };

  const selectFolder = (folderId: string): void => {
    setState((prev) => {
      const notes =
        folderId === 'all'
          ? [...prev.notes].sort(
              (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
            )
          : [...prev.notes]
              .filter((n) => n.folderId === folderId)
              .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      return { ...prev, selectedFolderId: folderId, selectedNoteId: notes[0]?.id ?? null };
    });
  };

  const selectNote = (noteId: string): void => {
    setState((prev) => ({ ...prev, selectedNoteId: noteId }));
  };

  return {
    state,
    getNotesForFolder,
    getNoteTitle,
    createNote,
    updateNote,
    createFolder,
    selectFolder,
    selectNote,
  };
}

// ─── Shared toolbar icon button (mini window only) ────────────────────────────

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
  getNotesForFolder: (folderId: string) => QuickNote[];
  onSelectFolder: (folderId: string) => void;
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
    { id: 'all', name: 'All Notes', count: state.notes.length },
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
  getNoteTitle: (content: string) => string;
  onSelectNote: (noteId: string) => void;
  onNewNote: () => void;
}

export function NotesList({
  state,
  visibleNotes,
  getNoteTitle,
  onSelectNote,
  onNewNote,
}: NotesListProps) {
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
        {visibleNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40 gap-2 py-12">
            <FileText className="h-8 w-8" />
            <p className="text-xs">No notes yet</p>
          </div>
        ) : (
          visibleNotes.map((note) => {
            const title = getNoteTitle(note.content);
            const preview = note.content.replace(/\n/g, ' ').slice(0, 80);
            const isSelected = state.selectedNoteId === note.id;
            return (
              <button
                key={note.id}
                onClick={() => onSelectNote(note.id)}
                className={cn(
                  'w-full text-left px-4 py-3 border-b border-border/50 transition-colors hover:bg-accent',
                  isSelected && 'bg-primary/8 border-l-2 border-l-primary',
                )}
              >
                <p className="text-sm font-medium text-foreground truncate leading-tight">{title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formatRelativeTime(note.updatedAt)}
                </p>
                {preview && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-snug">{preview}</p>
                )}
              </button>
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
  getNoteTitle: (content: string) => string;
  onUpdateNote: (id: string, content: string) => void;
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
          {getNoteTitle(selectedNote.content)}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          {formatRelativeTime(selectedNote.updatedAt)}
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
  onSelectFolder: (folderId: string) => void;
  onSelectNote: (noteId: string) => void;
  onUpdateNote: (id: string, content: string) => void;
  state: QuickNotesState;
  getNotesForFolder: (folderId: string) => QuickNote[];
  getNoteTitle: (content: string) => string;
  triggerFolderCreate?: boolean;
  onAcknowledgeFolderCreate?: () => void;
}

export function QuickNotesContent({
  onNewNote,
  onCreateFolder,
  onSelectFolder,
  onSelectNote,
  onUpdateNote,
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
  getNoteTitle: (content: string) => string;
  onClose: () => void;
  onMaximize: () => void;
  onNewNote: () => void;
  onNewFolder: () => void;
  onUpdateNote: (id: string, content: string) => void;
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
          {selectedNote ? getNoteTitle(selectedNote.content) : 'No note selected'}
        </span>
        {selectedNote && (
          <span className="shrink-0 ml-2">{formatRelativeTime(selectedNote.updatedAt)}</span>
        )}
      </div>
    </div>
  );
}

// ─── FAB + mini window (mounted in Layout) ────────────────────────────────────

const FAB_SIZE = 48; // h-12 w-12 = 48px
const MINI_W = 340;
const MINI_H = 260; // approximate MiniWindow height
const FAB_POS_KEY = 'zanflow_fab_pos';

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}

function getInitialFabPos(): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(FAB_POS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  // default: bottom-6 right-6
  return {
    x: window.innerWidth - FAB_SIZE - 24,
    y: window.innerHeight - FAB_SIZE - 24,
  };
}

export function QuickNotes() {
  const navigate = useNavigate();
  const [isMiniOpen, setIsMiniOpen] = useState(false);
  const miniTextareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Drag state ──────────────────────────────────────────────────────────────
  const [fabPos, setFabPos] = useState<{ x: number; y: number }>(getInitialFabPos);
  const dragging = useRef(false);
  const didDrag = useRef(false);
  const dragStart = useRef<{ mx: number; my: number; fx: number; fy: number } | null>(null);

  // Persist position
  useEffect(() => {
    localStorage.setItem(FAB_POS_KEY, JSON.stringify(fabPos));
  }, [fabPos]);

  // Clamp position on window resize
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

  // ── Notes logic ─────────────────────────────────────────────────────────────
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
    if (didDrag.current) return; // suppress click after drag
    if (!isMiniOpen && !selectedNote) createNote(state.selectedFolderId);
    setIsMiniOpen((prev) => !prev);
  };

  const handleMaximize = () => { setIsMiniOpen(false); navigate('/quick-notes'); };
  const handleNewFolder = () => { setIsMiniOpen(false); navigate('/quick-notes'); };

  // ── Mini window position: prefer above-left of FAB, clamped to viewport ────
  const miniLeft = clamp(fabPos.x + FAB_SIZE / 2 - MINI_W / 2, 8, window.innerWidth - MINI_W - 8);
  const miniTop  = clamp(fabPos.y - MINI_H - 12, 8, window.innerHeight - MINI_H - 8);

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

      {/* Mini window — positioned relative to FAB */}
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
