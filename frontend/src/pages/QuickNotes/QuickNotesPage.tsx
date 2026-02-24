import { useState } from 'react';
import { NotebookPen, Plus } from 'lucide-react';
import {
  useQuickNotes,
  QuickNotesContent,
} from '@/components/QuickNotes/QuickNotes';

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
  } = useQuickNotes();

  const handleNewNote = () => {
    createNote(state.selectedFolderId);
  };

  const handleNewFolder = () => {
    setTriggerFolderCreate(true);
  };

  return (
    <div className="flex flex-col h-full bg-background border-2 border-gray-200 overflow-hidden">
      {/* Page header — matches the app's existing light theme header style */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0 bg-card">
        <div className="flex items-center gap-2.5">
          <NotebookPen className="h-5 w-5 text-primary" />
          <h1 className="text-base font-semibold text-foreground">Quick Notes</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleNewFolder}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-accent text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Folder
          </button>

          <button
            onClick={handleNewNote}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:opacity-90 text-primary-foreground text-xs font-medium transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Note
          </button>
        </div>
      </header>

      {/* 3-column body — fills remaining height */}
      <QuickNotesContent
        state={state}
        getNotesForFolder={getNotesForFolder}
        getNoteTitle={getNoteTitle}
        onNewNote={handleNewNote}
        onCreateFolder={createFolder}
        onSelectFolder={selectFolder}
        onSelectNote={selectNote}
        onUpdateNote={updateNote}
        triggerFolderCreate={triggerFolderCreate}
        onAcknowledgeFolderCreate={() => setTriggerFolderCreate(false)}
      />
    </div>
  );
}
