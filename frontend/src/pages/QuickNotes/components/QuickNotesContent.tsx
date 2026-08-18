import { useEffect, useRef } from 'react';
import { FolderSidebar } from './FolderSidebar';
import { NotesList }     from './NotesList';
import { NoteEditor }    from './NoteEditor';
import type { QuickNote } from '@/types';
import type { QuickNotesState } from '../hooks/useQuickNotes';

interface QuickNotesContentProps {
  state:                   QuickNotesState;
  getNotesForFolder:       (folderId: number | 'all' | `project-${number}`) => QuickNote[];
  getNoteTitle:            (note: QuickNote) => string;
  onNewNote:               () => void;
  onCreateFolder:          (name: string) => void;
  onRenameFolder:          (folderId: number, newName: string) => void;
  onDeleteFolder:          (folderId: number) => void;
  onSelectFolder:          (folderId: number | 'all' | `project-${number}`) => void;
  onSelectNote:            (noteId: number) => void;
  onUpdateNote:            (id: number | 'pending', content: string) => void;
  onRenameNote:            (noteId: number, newTitle: string) => void;
  onDeleteNote:            (noteId: number) => void;
  onAddAttachment:         (noteId: number, attachment: import('@/types').QuickNoteAttachment) => void;
  onRemoveAttachment:      (noteId: number, attachmentId: number) => void;
  onAttachToProject:       (noteId: number, projectId: number | null) => void;
  triggerFolderCreate?:    boolean;
  onAcknowledgeFolderCreate?: () => void;
}

export function QuickNotesContent({
  state, getNotesForFolder, getNoteTitle,
  onNewNote, onCreateFolder, onRenameFolder, onDeleteFolder,
  onSelectFolder, onSelectNote, onUpdateNote, onRenameNote, onDeleteNote,
  onAddAttachment, onRemoveAttachment, onAttachToProject,
  triggerFolderCreate = false, onAcknowledgeFolderCreate,
}: QuickNotesContentProps) {
  const editorRef    = useRef<HTMLTextAreaElement>(null);
  const visibleNotes = getNotesForFolder(state.selectedFolderId);
  const isPending    = state.selectedNoteId === 'pending' || state.pendingNote !== null;
  const selectedNote = isPending ? null : (state.notes.find(n => n.id === state.selectedNoteId) ?? null);
  const isReadOnly   = selectedNote
    ? state.folders.find(f => f.id === selectedNote.folder)?.name === 'Team Member Updates' || getNoteTitle(selectedNote) === 'Team Member Updates'
    : false;

  useEffect(() => { editorRef.current?.focus(); }, [state.selectedNoteId]);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <FolderSidebar
        state={state} getNotesForFolder={getNotesForFolder}
        onSelectFolder={onSelectFolder} onCreateFolder={onCreateFolder}
        onRenameFolder={onRenameFolder} onDeleteFolder={onDeleteFolder}
        triggerFolderCreate={triggerFolderCreate} onAcknowledgeFolderCreate={onAcknowledgeFolderCreate}
      />
      <NotesList
        state={state} visibleNotes={visibleNotes} getNoteTitle={getNoteTitle}
        onSelectNote={onSelectNote} onNewNote={onNewNote}
        onRenameNote={onRenameNote} onDeleteNote={onDeleteNote}
        onAttachToProject={onAttachToProject}
      />
      <NoteEditor
        selectedNote={selectedNote} isPending={isPending} isReadOnly={isReadOnly}
        getNoteTitle={getNoteTitle} onUpdateNote={onUpdateNote} onRenameNote={onRenameNote}
        onAddAttachment={onAddAttachment} onRemoveAttachment={onRemoveAttachment}
        editorRef={editorRef} users={state.users}
      />
    </div>
  );
}