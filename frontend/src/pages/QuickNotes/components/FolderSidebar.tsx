import { useState, useEffect, useRef } from 'react';
import { Plus, Folder, FolderKanban, ChevronRight, ChevronDown, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { projectsApi } from '@/services/api';
import { getTypeHex } from '@/pages/Project/projectConstants';
import DeleteModal from '@/components/common/Deletemodal';
import type { QuickNote } from '@/types';
import type { QuickNotesState } from '../hooks/useQuickNotes';

interface FolderSidebarProps {
  state:                   QuickNotesState;
  getNotesForFolder:       (folderId: number | 'all' | `project-${number}`) => QuickNote[];
  onSelectFolder:          (folderId: number | 'all' | `project-${number}`) => void;
  onCreateFolder:          (name: string) => void;
  onRenameFolder:          (folderId: number, newName: string) => void;
  onDeleteFolder:          (folderId: number) => void;
  triggerFolderCreate?:    boolean;
  onAcknowledgeFolderCreate?: () => void;
}

export function FolderSidebar({
  state, getNotesForFolder, onSelectFolder, onCreateFolder,
  onRenameFolder, onDeleteFolder, triggerFolderCreate = false, onAcknowledgeFolderCreate,
}: FolderSidebarProps) {
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [inputVal,        setInputVal]       = useState('');
  const inputRef         = useRef<HTMLInputElement>(null);
  const [openMenuId,     setOpenMenuId]     = useState<number | null>(null);
  const [renamingId,     setRenamingId]     = useState<number | null>(null);
  const [renameValue,    setRenameValue]    = useState('');
  const renameInputRef   = useRef<HTMLInputElement>(null);
  const menuRef          = useRef<HTMLDivElement>(null);
  const [deleteTarget,   setDeleteTarget]   = useState<{ id: number; name: string } | null>(null);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [projects,        setProjects]        = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectsError,   setProjectsError]   = useState<string | null>(null);

  // ── Fetch projects when expanded ─────────────────────────────────────────
  useEffect(() => {
    if (showAllProjects && projects.length === 0) {
      setLoadingProjects(true);
      setProjectsError(null);
      projectsApi.list({ disable_pagination: true } as any)
        .then(res => setProjects(res.results || (res as any)))
        .catch(() => setProjectsError('Failed to load projects'))
        .finally(() => setLoadingProjects(false));
    }
  }, [showAllProjects]);

  useEffect(() => { if (triggerFolderCreate) { setIsAddingFolder(true); onAcknowledgeFolderCreate?.(); } }, [triggerFolderCreate]);
  useEffect(() => { if (isAddingFolder) inputRef.current?.focus(); }, [isAddingFolder]);
  useEffect(() => { if (renamingId)     renameInputRef.current?.focus(); }, [renamingId]);
  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputVal.trim()) { onCreateFolder(inputVal.trim()); setInputVal(''); setIsAddingFolder(false); }
    if (e.key === 'Escape') { setInputVal(''); setIsAddingFolder(false); }
  };

  const commitRename = (folderId: number) => {
    const trimmed = renameValue.trim();
    if (trimmed) onRenameFolder(folderId, trimmed);
    setRenamingId(null); setRenameValue('');
  };

  const allFolderItems = [
    { id: 'all' as const, name: 'All Notes', count: state.notes.length },
    ...state.folders.map(f => ({ id: f.id, name: f.name, count: getNotesForFolder(f.id).length })),
  ];

  return (
   <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid hsl(var(--border))' }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: 'hsl(var(--muted-foreground))' }}>Folders</span>
        <button onClick={() => setIsAddingFolder(true)} title="New Folder"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 4, border: 'none', background: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))' }}
          onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--accent))'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
          <Plus style={{ width: 13, height: 13 }} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
        {allFolderItems.map(folder => {
          const isMenuOpen  = openMenuId === folder.id;
          const isRenaming  = renamingId === folder.id;
          const isReal      = folder.id !== 'all';
          const isSelected  = state.selectedFolderId === folder.id;
          const isReadOnly  = folder.name === 'Team Member Updates';

          return (
            <div key={folder.id} style={{ position: 'relative', marginBottom: 1 }}>
              <button
                onClick={() => onSelectFolder(folder.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', textAlign: 'left',
                 background: isSelected ? '#4169FF18' : 'transparent',
                  color:      isSelected ? '#4169FF' : 'hsl(var(--foreground))',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'hsl(var(--accent))'; }}
                onMouseLeave={e => { e.currentTarget.style.background = isSelected ? '#4169FF18' : 'transparent'; }}
              >
                <Folder style={{ width: 14, height: 14, flexShrink: 0, color: folder.id === 'all' ? '#f59e0b' : '#3b82f6' }} />

                {isRenaming ? (
                  <input ref={renameInputRef} value={renameValue} onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitRename(folder.id as number); if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); } }}
                    onBlur={() => commitRename(folder.id as number)} onClick={e => e.stopPropagation()}
                    style={{ flex: 1, fontSize: 12, fontWeight: 500, background: 'hsl(var(--input))', border: '1px solid #4169FF', borderRadius: 4, padding: '1px 4px', outline: 'none', color: 'hsl(var(--foreground))' }} />
                ) : (
                  <span style={{ flex: 1, fontSize: 12, fontWeight: isSelected ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
                )}

                <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', flexShrink: 0 }}>{folder.count}</span>

                {isReal && !isReadOnly && (
                  <button onClick={e => { e.stopPropagation(); setOpenMenuId(prev => prev === folder.id ? null : folder.id as number); }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: 4, border: 'none', cursor: 'pointer', background: isMenuOpen ? 'hsl(var(--accent))' : 'none', color: 'hsl(var(--muted-foreground))', flexShrink: 0 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--accent))'}
                    onMouseLeave={e => e.currentTarget.style.background = isMenuOpen ? 'hsl(var(--accent))' : 'none'}>
                    <MoreVertical style={{ width: 11, height: 11 }} />
                  </button>
                )}
              </button>

              {isMenuOpen && isReal && (
                <div ref={menuRef} style={{ position: 'absolute', left: 8, top: 36, zIndex: 50, minWidth: 130, borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))', boxShadow: '0 4px 16px rgba(0,0,0,.18)', padding: '4px 0' }}>
                  <button onClick={e => { e.stopPropagation(); setOpenMenuId(null); setRenamingId(folder.id as number); setRenameValue(folder.name); }}
                    style={{ width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: 12, color: 'hsl(var(--foreground))', background: 'none', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--accent))'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>Rename</button>
                  <button onClick={e => { e.stopPropagation(); setOpenMenuId(null); setDeleteTarget({ id: folder.id as number, name: folder.name }); }}
                    style={{ width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#ef444418'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>Delete</button>
                </div>
              )}
            </div>
          );
        })}

        {/* ── All Projects section ── */}
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid hsl(var(--border))' }}>
          <button onClick={() => setShowAllProjects(v => !v)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '7px 10px', borderRadius: 7, border: 'none', background: 'none', cursor: 'pointer', color: 'hsl(var(--foreground))' }}
            onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--accent))'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FolderKanban style={{ width: 14, height: 14, flexShrink: 0, color: '#8b5cf6' }} />
              <span style={{ fontSize: 12, fontWeight: 500 }}>All Projects</span>
            </div>
            {showAllProjects ? <ChevronDown style={{ width: 12, height: 12, color: 'hsl(var(--muted-foreground))' }} /> : <ChevronRight style={{ width: 12, height: 12, color: 'hsl(var(--muted-foreground))' }} />}
          </button>

          {showAllProjects && (
            <div style={{ marginLeft: 20, marginTop: 2 }}>
              {loadingProjects ? (
                <p style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', padding: '6px 10px' }}>Loading…</p>
              ) : projectsError ? (
                <p style={{ fontSize: 11, color: '#ef4444', padding: '6px 10px' }}>{projectsError}</p>
              ) : projects.filter(p => p.status !== 'archived').length === 0 ? (
                <p style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', padding: '6px 10px' }}>No projects found</p>
              ) : (
                projects.filter(p => p.status !== 'archived').map(project => {
                  const typeHex  = getTypeHex(project.task_type || '');
                  const isActive = state.selectedFolderId === `project-${project.id}`;
                  return (
                    <button key={project.id}
                      onClick={() => onSelectFolder(`project-${project.id}` as `project-${number}`)}
                     style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', textAlign: 'left', background: isActive ? '#4169FF18' : 'none', color: isActive ? '#4169FF' : 'hsl(var(--foreground))' }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'hsl(var(--accent))'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isActive ? '#4169FF18' : 'none'; }}>
                      {/* Project type colour dot */}
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: typeHex, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{project.name}</span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* New folder input */}
        {isAddingFolder && (
          <div style={{ padding: '4px 4px', marginTop: 4 }}>
            <input ref={inputRef} value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={handleKeyDown}
              onBlur={() => { setInputVal(''); setIsAddingFolder(false); }}
              placeholder="Folder name…"
             style={{ width: '100%', borderRadius: 6, border: '1px solid #4169FF', background: 'hsl(var(--input))', padding: '5px 10px', fontSize: 12, color: 'hsl(var(--foreground))', outline: 'none' }} />
          </div>
        )}

        <DeleteModal isOpen={!!deleteTarget} type="confirm" itemType="folder" itemName={deleteTarget?.name}
          onConfirm={() => { if (deleteTarget) onDeleteFolder(deleteTarget.id); setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)} />
      </div>
    </div>
  );
}