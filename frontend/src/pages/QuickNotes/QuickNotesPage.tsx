import { useState, useEffect } from 'react';
import { Plus, FolderPlus } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useQuickNotes }       from './hooks/useQuickNotes';
import { QuickNotesContent }   from './components/QuickNotesContent';

// ─── Design tokens 
const TEXT  = '#172033';
const MUTED = '#667085';
const LINE  = '#e6ebf2';
const BLUE  = '#1663f6';

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

  // Navigate from mini view
  useEffect(() => {
    const incoming = (location.state as { selectedNoteId?: number } | null)?.selectedNoteId;
    if (incoming && !state.isLoading) selectNote(incoming);
  }, [location.state, state.isLoading]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#fff', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div
        className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40"
       style={{ flexShrink: 0, background: '#fff', borderBottom: `1px solid ${LINE}`, paddingTop: 16, paddingBottom: 16 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: TEXT, letterSpacing: '-.02em' }}>
              Quick Notes
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 16, color: MUTED }}>
              Your personal notes and folders
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap" style={{ paddingTop: 4 }}>
            <button
              onClick={() => setTriggerFolderCreate(true)}
              style={{ height: 40, display: 'flex', alignItems: 'center', gap: 8, padding: '0 18px', border: `1px solid ${LINE}`, borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 600, color: TEXT, whiteSpace: 'nowrap' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              <FolderPlus size={15} /> New Folder
            </button>
            <button
              onClick={() => createNote(state.selectedFolderId)}
              style={{ height: 40, display: 'flex', alignItems: 'center', gap: 8, padding: '0 20px', border: 'none', borderRadius: 8, background: BLUE, cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <Plus size={15} /> New Note
            </button>
          </div>
        </div>
      </div>

      {/* ── 3-column notes content — fills remaining height ── */}
      <div
        className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40"
        style={{ flex: 1, overflowY: 'hidden', paddingTop: 20, paddingBottom: 20, display: 'flex' }}
      >
        <div style={{ flex: 1, borderRadius: 12, border: `1px solid ${LINE}`, overflow: 'hidden', background: '#fff', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 4px rgba(16,24,40,.06)' }}>
          <QuickNotesContent
            state={state}
            getNotesForFolder={getNotesForFolder}
            getNoteTitle={getNoteTitle}
            onNewNote={() => createNote(state.selectedFolderId)}
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