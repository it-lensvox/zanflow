import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  NotebookPen, Plus, FolderPlus, Maximize2, X, Folder, FileText, MoreVertical, Paperclip, Loader2, Trash2, Bold, Italic, List, ListOrdered, Pencil
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { quickNotesApi, projectsApi, authApi, usersApi } from '@/services/api';
import type { QuickNote, QuickNoteFolder } from '@/types';
import DeleteModal from '@/components/common/Deletemodal';
import { DocumentPreview } from '@/components/common/DocumentPreview'; 

// UI State model

export interface QuickNotesState {
  folders: QuickNoteFolder[];
  notes: QuickNote[];
  selectedFolderId: number | 'all';
  selectedNoteId: number | 'pending' | null;
  isLoading: boolean;
  pendingNote: { folderId: number | null } | null;
  currentUserId: number | null;
  users: import('@/types').User[];
}

function getDefaultState(): QuickNotesState {
  return {
    folders: [],
    notes: [],
    selectedFolderId: 'all',
    selectedNoteId: null,
    isLoading: true,
    pendingNote: null,
    currentUserId: null,
    users: [],
  };
}

export function useQuickNotes() {
  const [state, setState] = useState<QuickNotesState>(getDefaultState);

// Load folders + notes from backend on mount
useEffect(() => {
  let cancelled = false;
  async function load() {
    try {
      const [folders, notesResp, currentUser, usersData] = await Promise.all([
        quickNotesApi.getFolders(),
        quickNotesApi.getNotes(),
        authApi.getMe(),
        usersApi.listAll().catch(() => [])
      ]);
      if (cancelled) return;
      setState((prev) => ({
        ...prev,
        folders,
        notes: notesResp.results,
        isLoading: false,
        currentUserId: currentUser.id,
        users: usersData,
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

  const getNoteTitle = (note: QuickNote): string =>
    note.title && note.title.trim() ? note.title : 'Untitled';

  // "New Note" click — just marks a pending note, no API call yet
  const createNote = (folderId: number | 'all'): void => {
    const targetFolder = folderId === 'all' ? null : folderId;
    setState((prev) => ({
      ...prev,
      pendingNote: { folderId: targetFolder },
      selectedNoteId: null, 
    }));
  };

  const updateNote = async (id: number | 'pending', content: string): Promise<void> => {
    if (id === 'pending') {
      if (!content.trim()) return;
      const currentState = await new Promise<QuickNotesState>((resolve) => {
        setState((prev) => { resolve(prev); return prev; });
      });
      const targetFolder = currentState.pendingNote?.folderId ?? null;
      try {
        const newNote = await quickNotesApi.createNote({ content, folder: targetFolder });
        setState((prev) => ({
          ...prev,
          notes: [...prev.notes, newNote],
          selectedNoteId: newNote.id,
          pendingNote: null,
        }));
      } catch (err) {
        console.error('[QuickNotes] createNote (lazy) failed:', err);
      }
      return;
    }

    // Normal update for existing note
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

  const renameFolder = async (folderId: number, newName: string): Promise<void> => {
    setState((prev) => ({
      ...prev,
      folders: prev.folders.map((f) =>
        f.id === folderId ? { ...f, name: newName } : f,
      ),
    }));
    try {
      const updated = await quickNotesApi.updateFolder(folderId, { name: newName });
      setState((prev) => ({
        ...prev,
        folders: prev.folders.map((f) => f.id === folderId ? { ...f, ...updated } : f),
      }));
    } catch (err) {
      console.error('[QuickNotes] renameFolder failed:', err);
    }
  };

  const deleteFolder = async (folderId: number): Promise<void> => {
    setState((prev) => ({
      ...prev,
      folders: prev.folders.filter((f) => f.id !== folderId),
      selectedFolderId: prev.selectedFolderId === folderId ? 'all' : prev.selectedFolderId,
      notes: prev.notes.map((n) => n.folder === folderId ? { ...n, folder: null } : n),
    }));
    try {
      await quickNotesApi.deleteFolder(folderId);
    } catch (err) {
      console.error('[QuickNotes] deleteFolder failed:', err);
    }
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

  const addAttachmentToNote = (noteId: number, attachment: import('@/types').QuickNoteAttachment): void => {
    setState((prev) => ({
      ...prev,
      notes: prev.notes.map((n) =>
        n.id === noteId
          ? { ...n, attachments: [...(n.attachments || []), attachment] }
          : n
      ),
    }));
  };

  const removeAttachmentFromNote = (noteId: number, attachmentId: number): void => {
    setState((prev) => ({
      ...prev,
      notes: prev.notes.map((n) =>
        n.id === noteId
          ? { ...n, attachments: n.attachments?.filter(a => a.id !== attachmentId) || [] }
          : n
      ),
    }));
  };

  const attachNoteToProject = async (noteId: number, projectId: number | null): Promise<void> => {
    setState((prev) => ({
      ...prev,
      notes: prev.notes.map((n) =>
        n.id === noteId ? { ...n, project: projectId, updated_at: new Date().toISOString() } : n,
      ),
    }));
    try {
      await quickNotesApi.updateNote(noteId, { project: projectId });
    } catch (err) {
      console.error('[QuickNotes] attachNoteToProject failed:', err);
    }
  };

  return {
    state,
    attachNoteToProject,
    getNotesForFolder,
    getNoteTitle,
    createNote,
    updateNote,
    renameNote,
    deleteNote,
    createFolder,
    selectFolder,
    selectNote,
    renameFolder,
    deleteFolder,
    addAttachmentToNote,
    removeAttachmentFromNote,
  };
}

// Shared toolbar icon button

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

// Folder sidebar

interface FolderSidebarProps {
  state: QuickNotesState;
  getNotesForFolder: (folderId: number | 'all') => QuickNote[];
  onSelectFolder: (folderId: number | 'all') => void;
  onCreateFolder: (name: string) => void;
  onRenameFolder: (folderId: number, newName: string) => void;
  onDeleteFolder: (folderId: number) => void;
  triggerFolderCreate?: boolean;
  onAcknowledgeFolderCreate?: () => void;
}

export function FolderSidebar({
  state,
  getNotesForFolder,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  triggerFolderCreate = false,
  onAcknowledgeFolderCreate,
}: FolderSidebarProps) {
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Ellipsis menu state — reusing same pattern as NotesList
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    if (triggerFolderCreate) {
      setIsAddingFolder(true);
      onAcknowledgeFolderCreate?.();
    }
  }, [triggerFolderCreate, onAcknowledgeFolderCreate]);

  useEffect(() => {
    if (isAddingFolder) inputRef.current?.focus();
  }, [isAddingFolder]);

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  // Close dropdown on outside click
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

  const commitRename = (folderId: number) => {
    const trimmed = renameValue.trim();
    if (trimmed) onRenameFolder(folderId, trimmed);
    setRenamingId(null);
    setRenameValue('');
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent, folderId: number) => {
    if (e.key === 'Enter') commitRename(folderId);
    if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
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
    <div className="w-[220px] shrink-0 border-r border-border flex flex-col bg-card h-full">
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
        {allFolderItems.map((folder) => {
          const isMenuOpen = openMenuId === folder.id;
          const isRenaming = renamingId === folder.id;
          const isReal = folder.id !== 'all'; // 'All Notes' is virtual — no rename/delete
          const isReadOnlyFolder = folder.name === 'Team Member Updates';

          return (
            <div key={folder.id} className="relative">
              <button
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
                {isRenaming ? (
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => handleRenameKeyDown(e, folder.id as number)}
                    onBlur={() => commitRename(folder.id as number)}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 text-xs font-medium text-foreground bg-background border border-primary rounded px-1 py-0.5 focus:outline-none"
                  />
                ) : (
                  <span className="flex-1 truncate text-xs font-medium">{folder.name}</span>
                )}
                <span className="text-[10px] text-muted-foreground shrink-0">{folder.count}</span>

                {/* Ellipsis — only for real folders, not 'All Notes' */}
                {isReal && !isReadOnlyFolder && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId((prev) => (prev === folder.id ? null : folder.id as number));
                    }}
                    title="More options"
                    className={cn(
                      'shrink-0 flex h-5 w-5 items-center justify-center rounded transition-colors',
                      isMenuOpen
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:bg-accent',
                    )}
                  >
                    <MoreVertical className="h-3 w-3" />
                  </button>
                )}
              </button>

              {/* Dropdown menu */}
              {isMenuOpen && isReal && (
                <div
                  ref={menuRef}
                  className="absolute left-2 top-9 z-50 min-w-[130px] rounded-lg border border-border bg-popover shadow-md py-1 animate-in fade-in slide-in-from-top-1 duration-100"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(null);
                      setRenamingId(folder.id as number);
                      setRenameValue(folder.name);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
                  >
                    Rename
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(null);
                      setDeleteTarget({ id: folder.id as number, name: folder.name });
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-destructive hover:bg-accent transition-colors"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Delete confirmation modal for folders */}
        <DeleteModal
          isOpen={!!deleteTarget}
          type="confirm"
          itemType="folder"
          itemName={deleteTarget?.name}
          onConfirm={() => {
            if (deleteTarget) onDeleteFolder(deleteTarget.id);
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
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

// Notes list

// --- Project Attach Modal Component ---
function AttachProjectModal({
  isOpen,
  onClose,
  onAttach,
  currentProjectId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAttach: (projectId: number | null) => void;
  currentProjectId?: number | null;
}) {
  const [projects, setProjects] = useState<import('@/types').ProjectMinimal[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(currentProjectId ?? null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      projectsApi.list({ disable_pagination: true } as any)
        .then(res => setProjects(res.results || (res as any)))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedId(currentProjectId ?? null);
  }, [currentProjectId, isOpen]);

  if (!isOpen) return null;

  // Filter logic to separate the current project from the remaining list
  const currentProject = projects.find(p => p.id === currentProjectId);
  const remainingProjects = projects.filter(p => p.id !== currentProjectId);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-[400px] rounded-lg border border-border bg-card p-6 shadow-lg animate-in fade-in zoom-in-95 duration-200">
        <h2 className="text-lg font-semibold mb-4 text-foreground">Attach Note to Project</h2>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4 mb-6">
            {currentProject && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-md">
                <p className="text-[10px] text-green-500 font-bold uppercase tracking-wider mb-1">Currently Attached To</p>
                <p className="text-sm font-semibold text-foreground">{currentProject.name}</p>
              </div>
            )}
            
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wider">
                {currentProject ? 'Change to another project' : 'Select a project'}
              </p>
              <div className="max-h-[200px] overflow-y-auto space-y-1 border border-border rounded-md p-1 bg-muted/20">
                <button
                  onClick={() => setSelectedId(null)}
                  className={cn("w-full text-left px-3 py-2 text-sm rounded-md transition-colors", selectedId === null ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent text-foreground")}
                >
                  None (Make Personal Note)
                </button>
                {remainingProjects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={cn("w-full text-left px-3 py-2 text-sm rounded-md transition-colors", selectedId === p.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent text-foreground")}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent rounded-md transition-colors">Cancel</button>
          <button onClick={() => { onAttach(selectedId); onClose(); }} className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 rounded-md transition-colors">Confirm</button>
        </div>
      </div>
    </div>
  );
}

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

export function NotesList({
  state,
  visibleNotes,
  getNoteTitle,
  onSelectNote,
  onNewNote,
  onRenameNote,
  onDeleteNote,
  onAttachToProject,
}: NotesListProps) {
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [attachTarget, setAttachTarget] = useState<QuickNote | null>(null);
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

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null);

  const handleDeleteClick = (e: React.MouseEvent, note: QuickNote) => {
    e.stopPropagation();
    setOpenMenuId(null);
    setDeleteTarget({ id: note.id, title: getNoteTitle(note) });
  };

  return (
    <div className="w-[280px] shrink-0 border-r border-border flex flex-col bg-muted/30 h-full">
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
            const isReadOnlyNote = state.folders.find(f => f.id === note.folder)?.name === 'Team Member Updates' || getNoteTitle(note) === 'Team Member Updates';

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
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-[10px] text-muted-foreground">
                          {formatRelativeTime(note.updated_at)}
                        </p>
                        {note.updated_by && (
                          <span className="text-[9px] bg-muted px-1 rounded-sm text-muted-foreground whitespace-nowrap">
                            ✎ {(() => {
                              const u = state.users.find((user) => user.id === note.updated_by);
                              return u?.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : (u?.username || 'User');
                            })()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ellipsis trigger */}
                    {!isReadOnlyNote && (
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
                    )}
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
                    
                    {/* Only show Attach to Project if the current user is the creator */}
                    {note.user === state.currentUserId && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); setAttachTarget(note); }}
                        className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
                      >
                        Attach to Project
                      </button>
                    )}

                    {note.user === state.currentUserId && (
                      <button
                        onClick={(e) => handleDeleteClick(e, note)}
                        className="w-full text-left px-3 py-1.5 text-xs text-destructive hover:bg-accent transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
   </div>

      {/* Attach Project Modal */}
      <AttachProjectModal
        isOpen={!!attachTarget}
        onClose={() => setAttachTarget(null)}
        currentProjectId={attachTarget?.project}
        onAttach={(projectId) => {
          if (attachTarget) onAttachToProject(attachTarget.id, projectId);
        }}
      />

      {/* Delete confirmation modal for notes */}
      <DeleteModal
        isOpen={!!deleteTarget}
        type="confirm"
        itemType="note"
        itemName={deleteTarget?.title}
        onConfirm={() => {
          if (deleteTarget) onDeleteNote(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// Note editor 

interface NoteEditorProps {
  selectedNote: QuickNote | null;
  isPending?: boolean;
  isReadOnly?: boolean;
  getNoteTitle: (note: QuickNote) => string;
  onUpdateNote: (id: number | 'pending', content: string) => void;
  onRenameNote: (noteId: number, newTitle: string) => void;
  onAddAttachment: (noteId: number, attachment: import('@/types').QuickNoteAttachment) => void;
  onRemoveAttachment: (noteId: number, attachmentId: number) => void;
  editorRef?: React.RefObject<HTMLTextAreaElement>;
  users: import('@/types').User[];
}

export function NoteEditor({
  selectedNote,
  isPending = false,
  isReadOnly = false,
  getNoteTitle,
  onUpdateNote,
  onRenameNote,
  onAddAttachment,
  onRemoveAttachment,
  editorRef,
  users,
}: NoteEditorProps) {
  const [localContent, setLocalContent] = useState(selectedNote?.content ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<import('@/types').QuickNoteAttachment | null>(null);
  const [attachmentToDelete, setAttachmentToDelete] = useState<{ id: number; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- Title Editing Logic ---
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingTitle) titleInputRef.current?.focus();
  }, [isEditingTitle]);

  const startEditingTitle = () => {
    if (isReadOnly || isPending || !selectedNote) return;
    setTitleVal(getNoteTitle(selectedNote));
    setIsEditingTitle(true);
  };

  const commitTitle = () => {
    if (!selectedNote) return;
    const trimmed = titleVal.trim();
    if (trimmed && trimmed !== getNoteTitle(selectedNote)) {
      onRenameNote(selectedNote.id, trimmed);
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitTitle();
    if (e.key === 'Escape') setIsEditingTitle(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isReadOnly) return;

    const target = e.target as HTMLTextAreaElement;
    const { selectionStart, selectionEnd, value } = target;

    // Feature: Auto-start with "1. " on a completely empty note
    if (value.length === 0 && e.key.length === 1 && !e.ctrlKey && !e.metaKey && e.key !== 'Backspace') {
      e.preventDefault();
      const newValue = `1. ${e.key}`;
      setLocalContent(newValue);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onUpdateNote(isPending ? 'pending' : selectedNote!.id, newValue);
      }, 800);

      setTimeout(() => {
        target.selectionStart = target.selectionEnd = newValue.length;
      }, 0);
      return;
    }

    // Feature: Auto-continue numbering or bullets on Enter
    if (e.key === 'Enter') {
      const lines = value.substring(0, selectionStart).split('\n');
      const currentLine = lines[lines.length - 1];

      // Check for numbered list (e.g. "1. ")
      const numberedMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.*)$/);
      if (numberedMatch) {
        e.preventDefault();
        const [, indent, numStr, text] = numberedMatch;

        if (text.trim() === '') {
          // If line is empty, break out of list
          const newValue = value.substring(0, selectionStart - currentLine.length) + '\n' + value.substring(selectionEnd);
          setLocalContent(newValue);
          setTimeout(() => { target.selectionStart = target.selectionEnd = selectionStart - currentLine.length + 1; }, 0);
          return;
        }

        const nextNum = parseInt(numStr, 10) + 1;
        const insertion = `\n${indent}${nextNum}. `;
        const newValue = value.substring(0, selectionStart) + insertion + value.substring(selectionEnd);
        setLocalContent(newValue);
        setTimeout(() => { target.selectionStart = target.selectionEnd = selectionStart + insertion.length; }, 0);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          onUpdateNote(isPending ? 'pending' : selectedNote!.id, newValue);
        }, 800);
        return;
      }

      // Check for bullet list (e.g. "- " or "* ")
      const bulletMatch = currentLine.match(/^(\s*)([-*])\s+(.*)$/);
      if (bulletMatch) {
        e.preventDefault();
        const [, indent, bullet, text] = bulletMatch;

        if (text.trim() === '') {
          // If line is empty, break out of list
          const newValue = value.substring(0, selectionStart - currentLine.length) + '\n' + value.substring(selectionEnd);
          setLocalContent(newValue);
          setTimeout(() => { target.selectionStart = target.selectionEnd = selectionStart - currentLine.length + 1; }, 0);
          return;
        }

        const insertion = `\n${indent}${bullet} `;
        const newValue = value.substring(0, selectionStart) + insertion + value.substring(selectionEnd);
        setLocalContent(newValue);
        setTimeout(() => { target.selectionStart = target.selectionEnd = selectionStart + insertion.length; }, 0);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          onUpdateNote(isPending ? 'pending' : selectedNote!.id, newValue);
        }, 800);
        return;
      }
    }
  };

  const applyFormatting = (prefix: string, suffix: string = '') => {
    if (!editorRef?.current || isReadOnly) return;
    const target = editorRef.current;
    const { selectionStart, selectionEnd, value } = target;

    const selectedText = value.substring(selectionStart, selectionEnd);
    const replacement = `${prefix}${selectedText}${suffix}`;
    const newValue = value.substring(0, selectionStart) + replacement + value.substring(selectionEnd);

    setLocalContent(newValue);
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdateNote(isPending ? 'pending' : selectedNote!.id, newValue);
    }, 800);

    setTimeout(() => {
      target.focus();
      target.selectionStart = selectionStart + prefix.length;
      target.selectionEnd = selectionEnd + prefix.length;
    }, 0);
  };

  const handleDeleteClick = (e: React.MouseEvent, attachment: import('@/types').QuickNoteAttachment) => {
    e.stopPropagation();
    setAttachmentToDelete({ id: attachment.id, name: attachment.filename });
  };

  const confirmDeleteAttachment = async () => {
    if (!selectedNote || !attachmentToDelete) return;
    
    try {
      setIsDeleting(true);
      await quickNotesApi.deleteAttachment(attachmentToDelete.id);
      onRemoveAttachment(selectedNote.id, attachmentToDelete.id);
      setAttachmentToDelete(null);
    } catch (error) {
      console.error('Failed to delete attachment:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !selectedNote || isPending) return;

    try {
      setIsUploading(true);
      const uploadPromises = files.map(file => 
        quickNotesApi.uploadAttachment(selectedNote.id, file)
      );
      const newAttachments = await Promise.all(uploadPromises);
      newAttachments.forEach(attachment => {
        onAddAttachment(selectedNote.id, attachment);
      });

    } catch (error) {
      console.error('Failed to upload attachment(s):', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Sync local content when selected note changes
  useEffect(() => {
    setLocalContent(selectedNote?.content ?? '');
  }, [selectedNote?.id]);

  // Reset local content when a fresh pending note is opened
  useEffect(() => {
    if (isPending) setLocalContent('');
  }, [isPending]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isReadOnly) return;
    const value = e.target.value;
    setLocalContent(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdateNote(isPending ? 'pending' : selectedNote!.id, value);
    }, 800);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Neither a saved note nor a pending new note
  if (!selectedNote && !isPending) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/40 bg-background gap-3">
        <FileText className="h-10 w-10" />
        <p className="text-sm">Select or create a note</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden">
      <div className="px-8 pt-6 pb-2 shrink-0 border-b border-border flex items-start justify-between group">
        <div className="flex-1 min-w-0 pr-4">
          {isEditingTitle && selectedNote ? (
            <input
              ref={titleInputRef}
              value={titleVal}
              onChange={(e) => setTitleVal(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              onBlur={commitTitle}
              className="w-full text-lg font-semibold text-foreground bg-background border-b border-primary focus:outline-none placeholder:text-muted-foreground/50 leading-tight py-0"
              placeholder="Note Title..."
            />
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-lg font-semibold text-foreground truncate">
                {selectedNote ? getNoteTitle(selectedNote) : 'New Note'}
              </p>
              {selectedNote && !isPending && !isReadOnly && (
                <button
                  onClick={startEditingTitle}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded"
                  title="Rename Note"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 mt-1">
            <p className="text-[10px] text-muted-foreground">
              {selectedNote ? formatRelativeTime(selectedNote.updated_at) : 'Start typing to save…'}
            </p>
            {selectedNote && selectedNote.updated_by && (
              <span className="text-[10px] flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                <NotebookPen className="w-3 h-3" />
                Last edited by {(() => {
                  const u = users.find((user) => user.id === selectedNote.updated_by);
                  return u?.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : (u?.username || 'User');
                })()}
              </span>
            )}
          </div>
          </div>
        {selectedNote && !isPending && !isReadOnly && (
          <div className="shrink-0 ml-4 flex items-center">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept="*/*"
              multiple
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              title="Upload Document"
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
            </button>
            </div>
        )}
      </div>
      
      {/* Editor Toolbar */}
      {!isReadOnly && (
        <div className="px-8 py-2 border-b border-border flex items-center gap-1 bg-muted/30 shrink-0">
          <button onClick={() => applyFormatting('**', '**')} title="Bold" className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><Bold className="w-4 h-4" /></button>
          <button onClick={() => applyFormatting('*', '*')} title="Italic" className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><Italic className="w-4 h-4" /></button>
          <div className="w-px h-4 bg-border mx-2" />
          <button onClick={() => applyFormatting('- ')} title="Bullet List" className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><List className="w-4 h-4" /></button>
          <button onClick={() => applyFormatting('1. ')} title="Numbered List" className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><ListOrdered className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <textarea
          ref={editorRef}
          value={localContent}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          autoFocus={isPending}
          readOnly={isReadOnly}
          disabled={isReadOnly}
          className={cn("flex-1 resize-none bg-transparent text-sm text-foreground px-8 py-4 pb-8 placeholder:text-muted-foreground/40 focus:outline-none leading-relaxed selection:bg-primary/20", isReadOnly && "cursor-not-allowed opacity-80")}
          placeholder={isReadOnly ? "This note is read-only." : "Start writing…"}
          spellCheck
        />

        {/* Attachments Sidebar */}
        {selectedNote?.attachments && selectedNote.attachments.length > 0 && (
          <div className="w-72 shrink-0 border-l border-border bg-muted/5 p-4 overflow-y-auto flex flex-col gap-2">
            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              Attachments ({selectedNote.attachments.length})
            </h4>
            {selectedNote.attachments.map((attachment) => (
              <div key={attachment.id} className="relative group">
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(attachment)}
                  className="w-full flex items-start gap-3 p-3 rounded-lg border border-border bg-background hover:border-primary/50 hover:shadow-sm transition-all text-left pr-10"
                >
                  <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate" title={attachment.filename}>
                      {attachment.filename}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(attachment.created_at).toLocaleDateString()}
                    </p>
                    </div>
                </button>
                {!isReadOnly && (
                  <button
                    onClick={(e) => handleDeleteClick(e, attachment)}
                    title="Delete Attachment"
                    className="absolute top-2 right-2 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

{previewAttachment && (
          <DocumentPreview
            url={previewAttachment.file}
            fileName={previewAttachment.filename}
            onClose={() => setPreviewAttachment(null)}
          />
        )}

        {/* Delete Confirmation Modal for Attachment */}
        <DeleteModal
          isOpen={!!attachmentToDelete}
          type="confirm"
          itemType="document"
          itemName={attachmentToDelete?.name}
          onConfirm={confirmDeleteAttachment}
          onCancel={() => setAttachmentToDelete(null)}
          isDeleting={isDeleting}
        />
      </div>
    </div>
  );
}
//Full 3-column notes UI

interface QuickNotesContentProps {
  onNewNote: () => void;
  onCreateFolder: (name: string) => void;
  onRenameFolder: (folderId: number, newName: string) => void;
  onDeleteFolder: (folderId: number) => void;
  onSelectFolder: (folderId: number | 'all') => void;
  onSelectNote: (noteId: number) => void;
  onUpdateNote: (id: number | 'pending', content: string) => void;
  onRenameNote: (noteId: number, newTitle: string) => void;
  onDeleteNote: (noteId: number) => void;
  onAddAttachment: (noteId: number, attachment: import('@/types').QuickNoteAttachment) => void;
  onRemoveAttachment: (noteId: number, attachmentId: number) => void;
  onAttachToProject: (noteId: number, projectId: number | null) => void;
  state: QuickNotesState;
  getNotesForFolder: (folderId: number | 'all') => QuickNote[];
  getNoteTitle: (note: QuickNote) => string;
  triggerFolderCreate?: boolean;
  onAcknowledgeFolderCreate?: () => void;
}

export function QuickNotesContent({
  onNewNote,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onSelectFolder,
  onSelectNote,
  onUpdateNote,
  onRenameNote,
  onDeleteNote,
  onAddAttachment,
  onRemoveAttachment,
  onAttachToProject,
  state,
  getNotesForFolder,
  getNoteTitle,
  triggerFolderCreate = false,
  onAcknowledgeFolderCreate,
}: QuickNotesContentProps) {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const visibleNotes = getNotesForFolder(state.selectedFolderId);
  const isPending = state.selectedNoteId === 'pending' || state.pendingNote !== null;
  const selectedNote = isPending
    ? null
    : (state.notes.find((n) => n.id === state.selectedNoteId) ?? null);

  useEffect(() => {
    editorRef.current?.focus();
  }, [state.selectedNoteId]);

  return (
    <div className="flex h-full overflow-hidden">
      <FolderSidebar
        state={state}
        getNotesForFolder={getNotesForFolder}
        onSelectFolder={onSelectFolder}
        onCreateFolder={onCreateFolder}
        onRenameFolder={onRenameFolder}
        onDeleteFolder={onDeleteFolder}
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
        onAttachToProject={onAttachToProject}
      />
      <NoteEditor
        selectedNote={selectedNote}
        isPending={isPending}
        isReadOnly={selectedNote ? (state.folders.find(f => f.id === selectedNote.folder)?.name === 'Team Member Updates' || getNoteTitle(selectedNote) === 'Team Member Updates') : false}
        getNoteTitle={getNoteTitle}
        onUpdateNote={onUpdateNote}
        onRenameNote={onRenameNote}
        onAddAttachment={onAddAttachment}
        onRemoveAttachment={onRemoveAttachment}
        editorRef={editorRef}
        users={state.users}
      />
    </div>
  );
}

// Mini window

interface MiniWindowProps {
  selectedNote: QuickNote | null;
  isReadOnly?: boolean;
  getNoteTitle: (note: QuickNote) => string;
  onClose: () => void;
  onMaximize: () => void;
  onNewNote: () => void;
  onNewFolder: () => void;
  onUpdateNote: (id: number | 'pending', content: string) => void;
  onFlushAndMaximize: (pendingContent: string) => void;
}

function MiniWindow({
  selectedNote,
  isReadOnly = false,
  getNoteTitle,
  onClose,
  onMaximize,
  onNewNote,
  onNewFolder,
  onUpdateNote,
  onFlushAndMaximize,
}: MiniWindowProps) {
  const [localContent, setLocalContent] = useState(selectedNote?.content ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync when selected note changes (e.g. user clicks a different note)
  useEffect(() => {
    setLocalContent(selectedNote?.content ?? '');
  }, [selectedNote?.id]);

  // Auto-focus immediately when mini window mounts
  useEffect(() => {
    const id = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setLocalContent(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdateNote(selectedNote ? selectedNote.id : 'pending', value);
    }, 800);
  };

  // Flush debounce on unmount so no content is lost
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleMaximizeClick = () => {
    // Cancel pending debounce and flush immediately before navigating
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onFlushAndMaximize(localContent);
  };

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
            onClick={handleMaximizeClick}
          />
          <ToolbarBtn
            icon={<X className="h-3.5 w-3.5" />}
            label="Close"
            onClick={onClose}
          />
        </div>
      </div>

      {/* Textarea — local state so typing is never blocked */}
      <textarea
        ref={textareaRef}
        value={localContent}
        onChange={handleChange}
        readOnly={isReadOnly}
        placeholder={isReadOnly ? "This note is read-only." : "Start typing a note…"}
        className={cn("h-[200px] resize-none bg-background text-sm text-foreground px-4 py-3 placeholder:text-muted-foreground/40 focus:outline-none leading-relaxed", isReadOnly && "cursor-not-allowed opacity-80")}
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
const FAB_POS_KEY = 'zanflow_quicknotes_fab_pos';

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}

function getInitialFabPos(): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(FAB_POS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { }
  return {
    x: window.innerWidth - FAB_SIZE - 24,
    y: window.innerHeight - FAB_SIZE - 132,
  };
}

export function QuickNotes() {
  const navigate = useNavigate();
  const [isMiniOpen, setIsMiniOpen] = useState(false);

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

  const handleNewNote = () => { createNote(state.selectedFolderId); };

  const handleFabClick = () => {
    if (didDrag.current) return;
    if (!isMiniOpen && !selectedNote) createNote(state.selectedFolderId);
    setIsMiniOpen((prev) => !prev);
  };

  // Flush any unsaved mini content to backend, then navigate carrying the active note 
  const handleFlushAndMaximize = (pendingContent: string) => {
    if (pendingContent.trim()) {
      const id = selectedNote ? selectedNote.id : 'pending' as const;
      updateNote(id, pendingContent);
    }
    setIsMiniOpen(false);
    navigate('/quick-notes', {
      state: { selectedNoteId: selectedNote?.id ?? null },
    });
  };

  const handleMaximize = () => {
    setIsMiniOpen(false);
    navigate('/quick-notes', {
      state: { selectedNoteId: selectedNote?.id ?? null },
    });
  };
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
            isReadOnly={selectedNote ? (state.folders.find(f => f.id === selectedNote.folder)?.name === 'Team Member Updates' || getNoteTitle(selectedNote) === 'Team Member Updates') : false}
            getNoteTitle={getNoteTitle}
            onClose={() => setIsMiniOpen(false)}
            onMaximize={handleMaximize}
            onNewNote={handleNewNote}
            onNewFolder={handleNewFolder}
            onUpdateNote={updateNote}
            onFlushAndMaximize={handleFlushAndMaximize}
          />
        </div>
      )}
    </>
  );
}