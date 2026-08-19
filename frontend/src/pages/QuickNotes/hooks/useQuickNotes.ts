import { useState, useEffect } from 'react';
import { quickNotesApi, authApi, usersApi } from '@/services/api';
import type { QuickNote, QuickNoteFolder } from '@/types';

// ─── State model ──────────────────────────────────────────────────────────────
export interface QuickNotesState {
  folders:          QuickNoteFolder[];
  notes:            QuickNote[];
  selectedFolderId: number | 'all' | `project-${number}`;
  selectedNoteId:   number | 'pending' | null;
  isLoading:        boolean;
  pendingNote:      { folderId: number | null; projectId?: number | null } | null;
  currentUserId:    number | null;
  users:            import('@/types').User[];
}

function getDefaultState(): QuickNotesState {
  return {
    folders:          [],
    notes:            [],
    selectedFolderId: 'all',
    selectedNoteId:   null,
    isLoading:        true,
    pendingNote:      null,
    currentUserId:    null,
    users:            [],
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useQuickNotes() {
  const [state, setState] = useState<QuickNotesState>(getDefaultState);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [folders, notesResp, currentUser, usersData] = await Promise.all([
          quickNotesApi.getFolders(),
          quickNotesApi.getNotes(),
          authApi.getMe(),
          usersApi.listAll().catch(() => []),
        ]);
        if (cancelled) return;
        setState(prev => ({
          ...prev,
          folders,
          notes: notesResp.results,
          isLoading:     false,
          currentUserId: currentUser.id,
          users:         usersData,
        }));
      } catch {
        if (!cancelled) setState(prev => ({ ...prev, isLoading: false }));
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const getNotesForFolder = (folderId: number | 'all' | `project-${number}`): QuickNote[] => {
    const sorted = [...state.notes].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
    if (typeof folderId === 'string' && folderId.startsWith('project-')) {
      const projectId = parseInt(folderId.replace('project-', ''));
      return sorted.filter(n => n.project === projectId);
    }
    if (folderId === 'all') return sorted;
    return sorted.filter(n => n.folder === folderId);
  };

  const getNoteTitle = (note: QuickNote): string =>
    note.title && note.title.trim() ? note.title : 'Untitled';

  const createNote = (folderId: number | 'all' | `project-${number}`): void => {
    let targetFolder:  number | null = null;
    let targetProject: number | null = null;
    if (typeof folderId === 'string' && folderId.startsWith('project-')) {
      targetProject = parseInt(folderId.replace('project-', ''));
    } else if (typeof folderId === 'number') {
      targetFolder = folderId;
    }
    setState(prev => ({ ...prev, pendingNote: { folderId: targetFolder, projectId: targetProject }, selectedNoteId: null }));
  };

  const updateNote = async (id: number | 'pending', content: string): Promise<void> => {
    if (id === 'pending') {
      if (!content.trim()) return;
      const currentState = await new Promise<QuickNotesState>(resolve => {
        setState(prev => { resolve(prev); return prev; });
      });
      const targetFolder  = currentState.pendingNote?.folderId  ?? null;
      const targetProject = currentState.pendingNote?.projectId ?? null;
      try {
        const newNote = await quickNotesApi.createNote({ content, folder: targetFolder, project: targetProject });
        setState(prev => ({ ...prev, notes: [...prev.notes, newNote], selectedNoteId: newNote.id, pendingNote: null }));
      } catch (err) { console.error('[QuickNotes] createNote failed:', err); }
      return;
    }
    setState(prev => ({ ...prev, notes: prev.notes.map(n => n.id === id ? { ...n, content, updated_at: new Date().toISOString() } : n) }));
    try {
      const updated = await quickNotesApi.updateNote(id, { content });
      setState(prev => ({ ...prev, notes: prev.notes.map(n => n.id === id ? { ...n, ...updated } : n) }));
    } catch (err) { console.error('[QuickNotes] updateNote failed:', err); }
  };

  const renameNote = async (noteId: number, newTitle: string): Promise<void> => {
    setState(prev => ({ ...prev, notes: prev.notes.map(n => n.id === noteId ? { ...n, title: newTitle, updated_at: new Date().toISOString() } : n) }));
    await quickNotesApi.updateNote(noteId, { title: newTitle });
  };

  const deleteNote = async (noteId: number): Promise<void> => {
    setState(prev => {
      const remaining = prev.notes.filter(n => n.id !== noteId);
      const newSelected = prev.selectedNoteId === noteId
        ? (remaining.find(n => n.folder === prev.selectedFolderId || prev.selectedFolderId === 'all')?.id ?? null)
        : prev.selectedNoteId;
      return { ...prev, notes: remaining, selectedNoteId: newSelected };
    });
    await quickNotesApi.deleteNote(noteId);
  };

  const createFolder = async (name: string): Promise<void> => {
    const folder = await quickNotesApi.createFolder({ name });
    setState(prev => ({ ...prev, folders: [...prev.folders, folder], selectedFolderId: folder.id }));
  };

  const renameFolder = async (folderId: number, newName: string): Promise<void> => {
    setState(prev => ({ ...prev, folders: prev.folders.map(f => f.id === folderId ? { ...f, name: newName } : f) }));
    try {
      const updated = await quickNotesApi.updateFolder(folderId, { name: newName });
      setState(prev => ({ ...prev, folders: prev.folders.map(f => f.id === folderId ? { ...f, ...updated } : f) }));
    } catch (err) { console.error('[QuickNotes] renameFolder failed:', err); }
  };

  const deleteFolder = async (folderId: number): Promise<void> => {
    setState(prev => ({
      ...prev,
      folders:          prev.folders.filter(f => f.id !== folderId),
      selectedFolderId: prev.selectedFolderId === folderId ? 'all' : prev.selectedFolderId,
      notes:            prev.notes.map(n => n.folder === folderId ? { ...n, folder: null } : n),
    }));
    try { await quickNotesApi.deleteFolder(folderId); }
    catch (err) { console.error('[QuickNotes] deleteFolder failed:', err); }
  };

  const selectFolder = (folderId: number | 'all' | `project-${number}`): void => {
    setState(prev => {
      if (typeof folderId === 'string' && folderId.startsWith('project-')) {
        const projectId   = parseInt(folderId.replace('project-', ''));
        const projectNotes = [...prev.notes].filter(n => n.project === projectId).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        return { ...prev, selectedFolderId: folderId, selectedNoteId: projectNotes[0]?.id ?? null };
      }
      const notes = folderId === 'all'
        ? [...prev.notes].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        : [...prev.notes].filter(n => n.folder === folderId).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      return { ...prev, selectedFolderId: folderId, selectedNoteId: notes[0]?.id ?? null };
    });
  };

  const selectNote = (noteId: number): void => {
    setState(prev => ({ ...prev, selectedNoteId: noteId }));
  };

  const addAttachmentToNote = (noteId: number, attachment: import('@/types').QuickNoteAttachment): void => {
    setState(prev => ({ ...prev, notes: prev.notes.map(n => n.id === noteId ? { ...n, attachments: [...(n.attachments || []), attachment] } : n) }));
  };

  const removeAttachmentFromNote = (noteId: number, attachmentId: number): void => {
    setState(prev => ({ ...prev, notes: prev.notes.map(n => n.id === noteId ? { ...n, attachments: n.attachments?.filter(a => a.id !== attachmentId) || [] } : n) }));
  };

  const attachNoteToProject = async (noteId: number, projectId: number | null): Promise<void> => {
    setState(prev => ({ ...prev, notes: prev.notes.map(n => n.id === noteId ? { ...n, project: projectId, updated_at: new Date().toISOString() } : n) }));
    try { await quickNotesApi.updateNote(noteId, { project: projectId }); }
    catch (err) { console.error('[QuickNotes] attachNoteToProject failed:', err); }
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
    renameFolder,
    deleteFolder,
    selectFolder,
    selectNote,
    addAttachmentToNote,
    removeAttachmentFromNote,
    attachNoteToProject,
  };
}