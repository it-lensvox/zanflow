import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useQuickNotes, QuickNotesContent } from '@/components/QuickNotes/QuickNotes';

export function QuickNotesPage() {
  const [triggerFolderCreate, setTriggerFolderCreate] = useState(false);

  const {
    state,
    getNotesForFolder,
    getNoteTitle,
    createNote,
    updateNote,
    createFolder,
    selectFolder,
    selectNote,
    renameNote,
    deleteNote,
  } = useQuickNotes();

  const handleNewNote = () => {
    createNote(state.selectedFolderId);
  };

  const handleNewFolder = () => {
    setTriggerFolderCreate(true);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="flex-1 overflow-y-auto w-full p-8 space-y-8">
        {/* Page header */}
        <div className="flex items-center justify-between">
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
        <div className="rounded-xl border border-border overflow-hidden" style={{ height: 'calc(100vh - 180px)' }}>
          <QuickNotesContent
            state={state}
            getNotesForFolder={getNotesForFolder}
            getNoteTitle={getNoteTitle}
            onNewNote={handleNewNote}
            onCreateFolder={createFolder}
            onSelectFolder={selectFolder}
            onSelectNote={selectNote}
            onUpdateNote={updateNote}
            onRenameNote={renameNote}
            onDeleteNote={deleteNote}
            triggerFolderCreate={triggerFolderCreate}
            onAcknowledgeFolderCreate={() => setTriggerFolderCreate(false)}
          />
        </div>
      </div>
    </div>
  );
}