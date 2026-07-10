import React, { useState } from 'react';
import { X, Plus, Folder, ChevronRight, ArrowLeft, Share2, Trash2, Pencil,
} from 'lucide-react';
import { getTypeHex } from '@/pages/Project/projectConstants';

// ─── Types 
export interface TreeFolder {
  id?: string;
  name: string;
  count: number;
  folderCount?: number;
  isOpen?: boolean;
  projectId?: number;
  isSystemGenerated?: boolean;
  taskType?: string;
  children?: TreeFolder[];
}

// ─── Project type colour 
const TYPE_LEGEND = [
  { label: 'Client',   color: '#3b82f6' },
  { label: 'Internal', color: '#8b5cf6' },
  { label: 'Content',  color: '#ec4899' },
  { label: 'Ideas',    color: '#f59e0b' },
  { label: 'Demo',     color: '#22c36a' },
];

// ─── Props 
interface TreePanelProps {
  folders: TreeFolder[];
  onFolderClick: (name: string, folderId?: string, projectId?: number) => void;
  selectedFolder: string;
  selectedFolderId: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onCreateFolder: (projectId: number, parentId: string | null, name: string) => void;
  onRenameFolder: (folderId: string, newName: string) => void;
  onDeleteFolder: (folderId: string) => void;
setMoveConfirmModal: (modal: any) => void;
  setToast: (toast: any) => void;
  showSharedWithMe: boolean;
  setShowSharedWithMe: (v: boolean) => void;
  setSelectedFolder: (name: string) => void;
  setSelectedTreeFolderId: (id: string | null) => void;
  sharedWithMeCount: number;
}

// ─── Component 
export function TreePanel({
  folders,
  onFolderClick,
  selectedFolder,
  selectedFolderId,
  isOpen,
  onToggle,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  setMoveConfirmModal,
  setToast,
  showSharedWithMe,
  setShowSharedWithMe,
  setSelectedFolder,
  setSelectedTreeFolderId,
  sharedWithMeCount,
}: TreePanelProps) {
  const [openNodes, setOpenNodes] = useState<Record<string, boolean>>({ 'All Documents': true });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [creatingUnder, setCreatingUnder] = useState<{ projectId: number; nodeKey: string; parentFolderId: string | null } | null>(null);
  const [deleteFolderConfirm, setDeleteFolderConfirm] = useState<{ id: string; name: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; folder: TreeFolder } | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [dragHoverTimer, setDragHoverTimer] = useState<NodeJS.Timeout | null>(null);
  const [autoOpenedNodes, setAutoOpenedNodes] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);

  React.useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    document.addEventListener('contextmenu', handler);
    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('contextmenu', handler);
    };
  }, [contextMenu]);

  React.useEffect(() => {
    const handleDragEnd = () => {
      if (isDragging) {
        setIsDragging(false);
        setOpenNodes((prev) => {
          const next = { ...prev };
          autoOpenedNodes.forEach((nodeKey) => { delete next[nodeKey]; });
          return next;
        });
        setAutoOpenedNodes(new Set());
      }
    };
    document.addEventListener('dragend', handleDragEnd);
    document.addEventListener('drop', handleDragEnd);
    return () => {
      document.removeEventListener('dragend', handleDragEnd);
      document.removeEventListener('drop', handleDragEnd);
    };
  }, [isDragging, autoOpenedNodes]);

  React.useEffect(() => {
    return () => { if (dragHoverTimer) clearTimeout(dragHoverTimer); };
  }, [dragHoverTimer]);

  const toggleNode = (n: string) => setOpenNodes((p) => ({ ...p, [n]: !p[n] }));

  const startRename = (folderId: string, currentName: string) => {
    setEditingId(folderId); setEditName(currentName);
  };
  const commitRename = () => {
    if (editingId && editName.trim()) onRenameFolder(editingId, editName.trim());
    setEditingId(null); setEditName('');
  };

  const startCreateFolder = (projectId: number, nodeKey: string, parentFolderId: string | null = null) => {
    setOpenNodes((p) => ({ ...p, [nodeKey]: true }));
    setCreatingUnder({ projectId, nodeKey, parentFolderId });
    setNewFolderName('');
  };
  const commitCreateFolder = () => {
    if (creatingUnder && newFolderName.trim()) {
      onCreateFolder(creatingUnder.projectId, creatingUnder.parentFolderId, newFolderName.trim());
    }
    setCreatingUnder(null); setNewFolderName('');
  };
  const cancelCreateFolder = () => { setCreatingUnder(null); setNewFolderName(''); };

  const renderFolder = (f: TreeFolder, depth = 0): React.ReactNode => {
    const nodeKey = f.id || f.name;
    const isO = openNodes[nodeKey] ?? false;
    const hasC = !!(f.children?.length) || (creatingUnder?.nodeKey === nodeKey);
    const isSel = (f.id && selectedFolderId === f.id) || (!f.id && selectedFolder === f.name);
    const isEditing = editingId === f.id;
    const showNewInput = creatingUnder?.nodeKey === nodeKey;
    const typeHex = f.taskType ? getTypeHex(f.taskType) : (depth === 0 ? '#4169FF' : '#667085');
    const showAccent = depth >= 1; 

    const rowBg = isSel
    ? (showAccent ? `${typeHex}15` : `${typeHex}12`)
    : 'transparent';
    const rowBorder = showAccent ? `3px solid ${typeHex}` : 'none';

    return (
      <div key={nodeKey} style={{ marginLeft: depth > 0 ? 16 : 0 }}>
        <div
          className="flex items-center gap-2 cursor-pointer group/folder"
          style={{ background: rowBg, borderLeft: rowBorder, borderRadius: showAccent ? '0 6px 6px 0' : 6, padding: '0 8px', height: 29, marginBottom: 1 }}
          onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = showAccent ? `${typeHex}0a` : 'hsl(var(--accent))'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = isSel ? '#EEF2FF' : 'transparent'; }}
          onClick={() => { if (hasC) toggleNode(nodeKey); onFolderClick(f.name, f.id, f.projectId); }}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, folder: f }); }}
          onDragOver={(e) => {
            e.preventDefault(); e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            if (!isDragging) setIsDragging(true);
            e.currentTarget.style.background = '#D1FAE5';
            e.currentTarget.style.borderLeft = '3px solid #10B981';
            if (hasC && !isO && !dragHoverTimer) {
              const timer = setTimeout(() => {
                setOpenNodes((prev) => ({ ...prev, [nodeKey]: true }));
                setAutoOpenedNodes((prev) => new Set(prev).add(nodeKey));
              }, 800);
              setDragHoverTimer(timer);
            }
          }}
          onDragLeave={(e) => {
            e.preventDefault(); e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            const isLeavingFolder = (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom);
            e.currentTarget.style.background = rowBg;
            e.currentTarget.style.borderLeft = rowBorder;
            if (dragHoverTimer) { clearTimeout(dragHoverTimer); setDragHoverTimer(null); }
            if (isLeavingFolder && autoOpenedNodes.has(nodeKey)) {
              setTimeout(() => {
                setOpenNodes((prev) => {
                  const next = { ...prev };
                  delete next[nodeKey];
                  const closeChildNodes = (folder: TreeFolder) => {
                    const childKey = folder.id || folder.name;
                    if (autoOpenedNodes.has(childKey)) delete next[childKey];
                    folder.children?.forEach(closeChildNodes);
                  };
                  if (f.children) f.children.forEach(closeChildNodes);
                  return next;
                });
                setAutoOpenedNodes((prev) => { const next = new Set(prev); next.delete(nodeKey); return next; });
              }, 100);
            }
          }}
          onDrop={async (e) => {
            e.preventDefault(); e.stopPropagation();
            if (dragHoverTimer) { clearTimeout(dragHoverTimer); setDragHoverTimer(null); }
            setIsDragging(false); setAutoOpenedNodes(new Set());
            e.currentTarget.style.background = isSel ? '#EEF2FF' : 'transparent';
            e.currentTarget.style.borderLeft = 'none';
            const documentIdsJson = e.dataTransfer.getData('documentIds');
            if (!documentIdsJson) return;
            const documentIds: string[] = JSON.parse(documentIdsJson);
            if (!f.projectId) {
              setToast({ isOpen: true, type: 'error', message: 'Cannot move documents to "All Documents". Please select a specific project or folder.' });
              return;
            }
            setMoveConfirmModal({ isOpen: true, documentIds, targetName: f.id ? f.name : `${f.name} (root)`, targetProjectId: f.projectId, targetFolderId: f.id || null });
          }}
        >
          {/* Folder icon */}
          {depth >= 1 && (
            <Folder
              className="w-3.5 h-3.5 flex-shrink-0"
              style={{
                color: typeHex,
                fill: isO && hasC ? `${typeHex}30` : 'none',
                transition: 'fill 0.15s',
              }}
            />
          )}
          {isEditing ? (
            <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setEditingId(null); setEditName(''); } }}
              onClick={(e) => e.stopPropagation()} className="flex-1 text-sm rounded px-1 py-0.5 min-w-0"
              style={{ border: `1px solid ${typeHex}`, outline: 'none', background: 'hsl(var(--input))', color: 'hsl(var(--foreground))' }} />
         ) : (
            <span
              style={{ flex: 1, fontSize: 12, color: isSel ? typeHex : 'hsl(var(--foreground))', fontWeight: isSel ? 700 : depth === 0 ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              onDoubleClick={(e) => { e.stopPropagation(); if (f.id && !f.isSystemGenerated) startRename(f.id, f.name); }}
            >
              {f.name}
            </span>
          )}
          {/* Doc count — plain muted number, same as Project tree */}
          {f.count > 0 && (
            <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', flexShrink: 0 }}>
              {f.count}
            </span>
          )}
        </div>

        {isO && (
          <div className="mt-1">
            {showNewInput && (
              <div className="flex items-center gap-2 py-1 rounded-md text-sm" style={{ marginLeft: 36, marginBottom: 4, marginRight: 4 }}>
                <Folder className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#4169FF' }} />
                <input autoFocus value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitCreateFolder(); if (e.key === 'Escape') cancelCreateFolder(); }}
                  onBlur={() => { if (newFolderName.trim()) commitCreateFolder(); else cancelCreateFolder(); }}
                  placeholder="Folder name..." className="flex-1 rounded px-2 py-0.5 min-w-0"
                  style={{ border: '1px solid #4169FF', outline: 'none', background: 'hsl(var(--input))', color: 'hsl(var(--foreground))', fontSize: 12, height: 26 }} />
                <button onClick={cancelCreateFolder} style={{ color: 'hsl(var(--muted-foreground))', background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}>
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {[...(f.children || [])].sort((a, b) => a.name.localeCompare(b.name)).map((c) => renderFolder(c, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`flex-shrink-0 overflow-hidden ${isOpen ? 'block' : 'hidden sm:block'}`}
      style={{ width: isOpen ? 280 : 44, minWidth: isOpen ? 280 : 44, borderRight: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', transition: 'width 0.3s ease, min-width 0.3s ease' }}
    >
      {/* ── Collapsed state ── */}
      {!isOpen && (
        <div className="flex flex-col items-center py-4 h-full">
          <button onClick={onToggle} className="p-1.5 rounded-md"
            style={{ color: 'hsl(var(--muted-foreground))', background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'hsl(var(--accent))'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            title="Show Tree View">
            <ChevronRight className="w-4 h-4" />
          </button>
         <div className="mt-3" style={{ writingMode: 'vertical-rl', fontSize: 11, fontWeight: 600, color: 'hsl(var(--muted-foreground))', letterSpacing: '0.05em' }}>Folders</div>
        </div>
      )}

      {/* ── Expanded state ── */}
      {isOpen && (
        <div className="overflow-y-auto p-4 h-full" style={{ width: 280 }}>
          <div className="flex items-center justify-between mb-4">
            <span style={{ fontWeight: 800, fontSize: 14, color: '#172033' }}>Folders</span>
            <button onClick={onToggle} className="p-1 rounded-md"
              style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              title="Hide Tree View">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1">{folders.map((f) => renderFolder(f))}</div>

          {/* Shared With Me */}
          <div
            onClick={() => { setShowSharedWithMe(true); setSelectedFolder('Shared With Me'); setSelectedTreeFolderId(null); }}
            className="flex items-center gap-2 cursor-pointer text-sm"
            style={{ background: showSharedWithMe ? '#EEF2FF' : 'transparent', borderRadius: 7, padding: '6px 10px', color: showSharedWithMe ? '#4169FF' : '#1a1a1a', fontWeight: showSharedWithMe ? 600 : 400, borderTop: '1px solid #e5e7eb', paddingTop: 10, marginTop: 8 }}
            onMouseEnter={e => { if (!showSharedWithMe) e.currentTarget.style.background = '#f3f4f6'; }}
            onMouseLeave={e => { e.currentTarget.style.background = showSharedWithMe ? '#EEF2FF' : 'transparent'; }}
          >
            <Share2 className="w-4 h-4 flex-shrink-0" style={{ color: showSharedWithMe ? '#4169FF' : '#6b7280' }} />
            <span style={{ flex: 1 }}>Shared With Me</span>
            {sharedWithMeCount > 0 && <span style={{ fontSize: 11, color: '#6b7280' }}>{sharedWithMeCount}</span>}
          </div>

          {/* Project type colour legend */}
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap' as const, gap: '4px 10px', padding: '6px 2px' }}>
            {TYPE_LEGEND.map(t => (
              <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: '#667085' }}>{t.label}</span>
              </div>
            ))}
          </div>

          {/* New Folder button */}
          {(() => {
            const findSelected = (ff: TreeFolder[]): TreeFolder | undefined => {
              for (const f of ff) {
                if ((f.id && selectedFolderId === f.id) || (!f.id && selectedFolder === f.name)) return f;
                if (f.children) { const r = findSelected(f.children); if (r) return r; }
              }
              return undefined;
            };
            const selected = findSelected(folders);
            const isDisabled = !selected?.projectId;
            return (
              <button
                className="flex items-center gap-2 mt-4 px-2 py-2 text-sm font-medium rounded-md w-full"
                disabled={isDisabled}
                title={isDisabled ? 'Select a project first to create a folder' : 'Create new folder'}
                style={{ color: isDisabled ? '#b0b8c9' : '#4169FF', background: 'none', border: 'none', cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled ? 0.5 : 1 }}
                onMouseEnter={(e) => { if (!isDisabled) e.currentTarget.style.background = '#f3f4f6'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                onClick={() => {
                  if (isDisabled || !selected?.projectId) return;
                  startCreateFolder(selected.projectId, selected.id || selected.name, selected.id || null);
                }}
              >
                <Plus className="w-4 h-4" /> New Folder
              </button>
            );
          })()}
        </div>
      )}

      {/* ── Context menu ── */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[998]" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
          <div className="fixed z-[999] rounded-lg shadow-xl py-1 animate-in fade-in duration-100"
            style={{ left: contextMenu.x, top: contextMenu.y, background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '8px 14px 6px', borderBottom: '1px solid #f3f4f6' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{contextMenu.folder.name}</p>
            </div>
            {contextMenu.folder.id && !contextMenu.folder.isSystemGenerated && (
              <button onClick={() => { setContextMenu(null); startCreateFolder(contextMenu.folder.projectId!, contextMenu.folder.id || contextMenu.folder.name, contextMenu.folder.id!); }}
                className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                style={{ color: '#1a1a1a', background: 'none', border: 'none', cursor: 'pointer' }}>
                <Plus className="w-4 h-4" style={{ color: '#4169FF' }} />Create Subfolder
              </button>
            )}
            {contextMenu.folder.id && !contextMenu.folder.isSystemGenerated && (
              <button onClick={() => { setContextMenu(null); startRename(contextMenu.folder.id!, contextMenu.folder.name); }}
                className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                style={{ color: '#1a1a1a', background: 'none', border: 'none', cursor: 'pointer' }}>
                <Pencil className="w-4 h-4" style={{ color: '#6b7280' }} />Rename
              </button>
            )}
            {contextMenu.folder.id && !contextMenu.folder.isSystemGenerated && (
              <div style={{ height: 1, background: '#f3f4f6', margin: '4px 0' }} />
            )}
            {contextMenu.folder.id && !contextMenu.folder.isSystemGenerated && (
              <button onClick={() => { setContextMenu(null); setDeleteFolderConfirm({ id: contextMenu.folder.id!, name: contextMenu.folder.name }); }}
                className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-red-50 transition-colors"
                style={{ color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                <Trash2 className="w-4 h-4" />Delete
              </button>
            )}
            {contextMenu.folder.isSystemGenerated && (
              <div style={{ padding: '8px 14px', fontSize: 12, color: '#6b7280' }}>System folder — no actions available</div>
            )}
          </div>
        </>
      )}

      {/* ── Delete folder confirmation ── */}
      {deleteFolderConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteFolderConfirm(null)} />
          <div className="relative w-full max-w-[400px] rounded-xl shadow-2xl bg-white border border-gray-200 p-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-3 rounded-full" style={{ background: '#FEE2E2' }}>
                <Trash2 className="h-6 w-6" style={{ color: '#EF4444' }} />
              </div>
              <div className="space-y-1">
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>Delete Folder</h3>
                <p style={{ fontSize: 14, color: '#6b7280' }}>
                  Are you sure you want to delete <strong style={{ color: '#1a1a1a' }}>"{deleteFolderConfirm.name}"</strong>? This cannot be undone.
                </p>
              </div>
              <div className="flex w-full gap-3 pt-2">
                <button className="flex-1 py-2.5 rounded-lg font-semibold"
                  style={{ background: 'hsl(var(--popover))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))', cursor: 'pointer', fontSize: 14 }}
                  onClick={() => setDeleteFolderConfirm(null)}>Cancel</button>
                <button className="flex-1 py-2.5 rounded-lg font-semibold"
                  style={{ background: '#EF4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14 }}
                  onClick={() => { onDeleteFolder(deleteFolderConfirm.id); setDeleteFolderConfirm(null); }}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}