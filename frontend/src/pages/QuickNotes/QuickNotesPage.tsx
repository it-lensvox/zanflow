import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useQuickNotes, QuickNotesContent } from '@/components/QuickNotes/QuickNotes';

export function QuickNotesPage() {
  const [triggerFolderCreate, setTriggerFolderCreate] = useState(false);
  const location = useLocation();

  const {
    state,
    getNotesForFolder,
    getNoteTitle,
    createNote,
    updateNote,
    createFolder,
    renameFolder,
    deleteFolder,
    selectFolder,
    selectNote,
    renameNote,
    deleteNote,
    addAttachmentToNote,
    removeAttachmentFromNote,
    attachNoteToProject,
  } = useQuickNotes();

  // When navigating from mini view, auto-select the note that was active there
  useEffect(() => {
    const incoming = (location.state as { selectedNoteId?: number } | null)?.selectedNoteId;
    if (incoming && !state.isLoading) {
      selectNote(incoming);
    }
  }, [location.state, state.isLoading]);

  const handleNewNote = () => {
    createNote(state.selectedFolderId);
  };

  const handleNewFolder = () => {
    setTriggerFolderCreate(true);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="flex-1 flex flex-col w-full overflow-hidden">

        {/* Page header */}
        <div className="px-8 pt-8 pb-4 shrink-0 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Quick Notes</h1>
            <p className="text-muted-foreground">Your personal notes and folders.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleNewFolder}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-background hover:bg-accent text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Folder
            </button>
            <button
              onClick={handleNewNote}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:opacity-90 text-primary-foreground text-sm font-medium transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Note
            </button>
          </div>
        </div>

        {/* 3-column notes UI */}
        <div className="flex-1 overflow-hidden mx-8 mb-8 rounded-xl border border-border">
          <QuickNotesContent
            state={state}
            getNotesForFolder={getNotesForFolder}
            getNoteTitle={getNoteTitle}
            onNewNote={handleNewNote}
            onCreateFolder={createFolder}
            onRenameFolder={renameFolder}
            onDeleteFolder={deleteFolder}
            onSelectFolder={selectFolder}
            onSelectNote={selectNote}
            onUpdateNote={updateNote}
            onRenameNote={renameNote}
            onDeleteNote={deleteNote}
            onAddAttachment={addAttachmentToNote}
            onRemoveAttachment={removeAttachmentFromNote}
            onAttachToProject={attachNoteToProject}
            triggerFolderCreate={triggerFolderCreate}
            onAcknowledgeFolderCreate={() => setTriggerFolderCreate(false)}
          />
        </div>

      </div>
    </div>
  );
}