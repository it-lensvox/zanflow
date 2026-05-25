import React from 'react';
import { useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams, useNavigate, useOutletContext } from 'react-router-dom';
import {
  FileText, Search, Filter, ChevronDown, Bell, ChevronLeft, ChevronRight,
  Info, X, Calendar, User, HardDrive, Tag, Hash, Upload, Plus, List,
  Grid3X3, Network, FolderOpen, Folder, ChevronRight as ChevronRightIcon,
  ArrowLeft, Move, Share, Trash2, MoreHorizontal, SortDesc, Settings,
  Bookmark, Layers, Clock, Sparkles, HelpCircle, ExternalLink, ZoomIn, ZoomOut,
  MessageSquare, Pencil
} from 'lucide-react';
import { API_URL } from '@/services/api';
import { Button, Card, CardContent, Input } from '@/components/common';
import { documentsApi, projectsApi, usersApi } from '@/services/api';
import type { Document, Project, DocumentStatus } from '@/types';
import { ViewToggle, DualView, useViewMode } from '@/components/layout/DualView';
import type { TableColumn } from '@/components/layout/DualView';
import { createDocumentsTableColumns, DocumentGridCard } from '@/components/layout/DualView/documentsConfig';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationsPage } from '../NotificationsPage';
import { DocumentPreview } from '@/components/common/DocumentPreview';
import { DocumentShareModal } from '@/pages/Documents/DocumentShareModal';

/*  EXACT tree_view.html theme:
    --primary-blue:#4169FF  --text-primary:#1a1a1a  --text-secondary:#6b7280
    --bg-primary:#ffffff    --bg-secondary:#f9fafb  --border-color:#e5e7eb
    --hover-bg:#f3f4f6      active-bg:#EEF2FF       primary-hover:#3554CC
    status-review:#FFF4E6/#D97706  status-draft:#F3F4F6/#6B7280  status-approved:#E8F5E9/#16A34A
    filter-project:#DBEAFE/#2563EB filter-type:#F3E8FF/#7C3AED filter-tag:#D1FAE5/#059669
    doc-pdf:#EF4444 doc-docx:#2563EB doc-xlsx:#16A34A doc-pptx:#EA580C
    project-badge:#EEF2FF/#4F46E5  checkbox-accent:#4169FF
    feature-green:#D1FAE5/#059669 feature-purple:#E9D5FF/#7C3AED
    feature-orange:#FED7AA/#EA580C feature-blue:#BFDBFE/#2563EB feature-yellow:#FEF3C7/#D97706
    why-tree:#EEF2FF comment-badge:#EF4444  */

const FILE_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Image' },
  { value: 'json', label: 'JSON' },
  { value: 'text', label: 'Text' },
];

interface ConfirmationModalProps { isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; }
interface TreeFolder {
  id?: string;
  name: string;
  count: number;
  folderCount?: number;        // ✅ ADD THIS - number of subfolders
  isOpen?: boolean;
  projectId?: number;
  isSystemGenerated?: boolean;
  children?: TreeFolder[];
}
// ---- TreePanel (collapsible, inline create + rename) ----
function TreePanel({ folders, onFolderClick, selectedFolder, selectedFolderId, isOpen, onToggle, onCreateFolder, onRenameFolder }: {
  folders: TreeFolder[];
  onFolderClick: (name: string, folderId?: string, projectId?: number) => void;
  selectedFolder: string;
  selectedFolderId: string | null;  // ✅ ADD THIS
  isOpen: boolean;
  onToggle: () => void;
  onCreateFolder: (projectId: number, parentId: string | null, name: string) => void;
  onRenameFolder: (folderId: string, newName: string) => void;
}) {
  const [openNodes, setOpenNodes] = useState<Record<string, boolean>>({ 'All Documents': true });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  // New folder inline state: which project node to show the input under
  const [creatingUnder, setCreatingUnder] = useState<{ projectId: number; nodeKey: string } | null>(null);
  const [newFolderName, setNewFolderName] = useState('');

  const toggleNode = (n: string) => setOpenNodes((p) => ({ ...p, [n]: !p[n] }));

  const startRename = (folderId: string, currentName: string) => {
    setEditingId(folderId); setEditName(currentName);
  };
  const commitRename = () => {
    if (editingId && editName.trim()) onRenameFolder(editingId, editName.trim());
    setEditingId(null); setEditName('');
  };

  const startCreateFolder = (projectId: number, nodeKey: string) => {
    // Open the parent node so the input is visible
    setOpenNodes((p) => ({ ...p, [nodeKey]: true }));
    setCreatingUnder({ projectId, nodeKey });
    setNewFolderName('');
  };
  const commitCreateFolder = () => {
    if (creatingUnder && newFolderName.trim()) {
      onCreateFolder(creatingUnder.projectId, null, newFolderName.trim());
    }
    setCreatingUnder(null); setNewFolderName('');
  };
  const cancelCreateFolder = () => {
    setCreatingUnder(null); setNewFolderName('');
  };

  const renderFolder = (f: TreeFolder, depth = 0): React.ReactNode => {
    const nodeKey = f.id || f.name;
    const isO = openNodes[nodeKey] ?? false;
    const hasC = !!(f.children?.length) || (creatingUnder?.nodeKey === nodeKey);
    const isSel = (f.id && selectedFolderId === f.id) || (!f.id && selectedFolder === f.name);  // ✅ FIXED
    const isEditing = editingId === f.id;
    const showNewInput = creatingUnder?.nodeKey === nodeKey;

    return (
      <div key={nodeKey} style={{ marginLeft: depth > 0 ? 20 : 0 }}>
        <div
          className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm group/folder"
          style={{ background: isSel ? '#EEF2FF' : 'transparent', color: isSel ? '#4169FF' : '#1a1a1a', fontWeight: isSel ? 600 : 400 }}
          onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = '#f3f4f6'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = isSel ? '#EEF2FF' : 'transparent'; }}
          onClick={() => { if (hasC) toggleNode(nodeKey); onFolderClick(f.name, f.id, f.projectId); }}
        >
          {hasC ? (
            <ChevronRightIcon className={`w-3 h-3 flex-shrink-0 transition-transform ${isO ? 'rotate-90' : ''}`} style={{ color: '#6b7280' }} />
          ) : <span className="w-3 flex-shrink-0" />}
          {isO && hasC ? (
            <FolderOpen className="w-4 h-4 flex-shrink-0" style={{ color: '#6b7280', fill: 'currentColor' }} />
          ) : (
            <Folder className="w-4 h-4 flex-shrink-0" style={{ color: '#6b7280', fill: 'currentColor' }} />
          )}
          {isEditing ? (
            <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
              onBlur={commitRename} onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setEditingId(null); setEditName(''); } }}
              onClick={(e) => e.stopPropagation()} className="flex-1 text-sm rounded px-1 py-0.5 min-w-0"
              style={{ border: '1px solid #4169FF', outline: 'none', background: '#fff', color: '#1a1a1a' }} />
          ) : (
            <span className="flex-1 truncate" onDoubleClick={(e) => { e.stopPropagation(); if (f.id && !f.isSystemGenerated) startRename(f.id, f.name); }}>{f.name}</span>
          )}

          {/* Dual count display */}
          <div className="flex items-center gap-2 text-xs font-medium">
            {/* Show folder count only if > 0 */}
            {f.folderCount !== undefined && f.folderCount > 0 && (
              <span className="flex items-center gap-1"
                style={{ color: '#4169FF' }}
                title="Subfolders">
                <Folder className="w-3 h-3" />
                {f.folderCount}
              </span>
            )}
            {/* Always show document count */}
            <span className="flex items-center gap-1"
              style={{ color: '#6b7280' }}
              title="Documents">
              <FileText className="w-3 h-3" />
              {f.count}
            </span>
          </div>
          {/* Rename pencil icon on hover */}
          {f.id && !f.isSystemGenerated && !isEditing && (
            <button className="opacity-0 group-hover/folder:opacity-100 p-0.5 rounded"
              style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); startRename(f.id!, f.name); }} title="Rename folder">
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Children + inline new folder input */}
        {isO && (
          <div className="mt-1">
            {f.children?.map((c) => renderFolder(c, depth + 1))}
            {/* Inline new folder input row */}
            {showNewInput && (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm" style={{ marginLeft: 20 }}>
                <Folder className="w-4 h-4 flex-shrink-0" style={{ color: '#4169FF' }} />
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitCreateFolder();
                    if (e.key === 'Escape') cancelCreateFolder();
                  }}
                  onBlur={() => { if (newFolderName.trim()) commitCreateFolder(); else cancelCreateFolder(); }}
                  placeholder="Folder name..."
                  className="flex-1 text-sm rounded px-2 py-1 min-w-0"
                  style={{ border: '1px solid #4169FF', outline: 'none', background: '#fff', color: '#1a1a1a', fontSize: 13 }}
                />
                <button onClick={cancelCreateFolder} style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-shrink-0 overflow-hidden"
      style={{ width: isOpen ? 280 : 44, minWidth: isOpen ? 280 : 44, borderRight: '1px solid #e5e7eb', background: '#fff', transition: 'width 0.3s ease, min-width 0.3s ease' }}>
      {/* Collapsed */}
      {!isOpen && (
        <div className="flex flex-col items-center py-4 h-full">
          <button onClick={onToggle} className="p-1.5 rounded-md" style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }} title="Show Tree View">
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="mt-3" style={{ writingMode: 'vertical-rl', fontSize: 11, fontWeight: 600, color: '#6b7280', letterSpacing: '0.05em' }}>Tree View</div>
        </div>
      )}
      {/* Expanded */}
      {isOpen && (
        <div className="overflow-y-auto p-4 h-full" style={{ width: 280 }}>
          <div className="flex items-center justify-between mb-4">
            <span style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a' }}>Tree View</span>
            <button onClick={onToggle} className="p-1 rounded-md" style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }} title="Hide Tree View">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1">{folders.map((f) => renderFolder(f))}</div>

          {/* + New Folder button */}
          <button className="flex items-center gap-2 mt-4 px-2 py-2 text-sm font-medium rounded-md w-full"
            style={{ color: '#4169FF', background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            onClick={() => {
              // ✅ Find currently selected folder/project
              const findSelected = (ff: TreeFolder[]): TreeFolder | undefined => {
                for (const f of ff) {
                  // Check if this is the selected node
                  if ((f.id && selectedFolderId === f.id) || (!f.id && selectedFolder === f.name)) {
                    return f;
                  }
                  // Recursively check children
                  if (f.children) {
                    const r = findSelected(f.children);
                    if (r) return r;
                  }
                }
                return undefined;
              };

              const selected = findSelected(folders);

              if (selected?.projectId) {
                // ✅ Create folder under the selected project/folder
                startCreateFolder(selected.projectId, selected.id || selected.name);
              } else {
                // ✅ Fallback: use first project
                const firstProject = folders[0]?.children?.find((c) => c.projectId);
                if (firstProject?.projectId) {
                  startCreateFolder(firstProject.projectId, firstProject.id || firstProject.name);
                }
              }
            }}>
            <Plus className="w-4 h-4" /> New Folder
          </button>
          {/* <button style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginTop: 4 }}><Settings className="w-4 h-4" /></button> */}
        </div>
      )}
    </div>
  );
}

// ---- ActiveFiltersBar ----
function ActiveFiltersBar({
  projectFilter,
  projectName,
  statusFilter,
  fileTypeFilter,
  searchTerm,
  ownerFilter,        // ✅ ADD THIS
  ownerName,          // ✅ ADD THIS
  onClearAll,
  onRemoveFilter
}: {
  projectFilter: string;
  projectName: string;
  statusFilter: string;
  fileTypeFilter: string;
  searchTerm: string;
  ownerFilter?: string;    // ✅ ADD THIS
  ownerName?: string;      // ✅ ADD THIS
  onClearAll: () => void;
  onRemoveFilter: (k: string) => void;
}) {
  if (!(projectFilter || statusFilter || fileTypeFilter || searchTerm || ownerFilter)) return null;

  // ✅ Helper function for owner avatar
  const getOwnerAvatar = (name: string) => {
    const initials = name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'SY';

    const avatarColors = [
      '#7C3AED', '#EF4444', '#F59E0B', '#10B981', '#3B82F6',
      '#EC4899', '#8B5CF6', '#F97316', '#14B8A6', '#6366F1',
    ];

    const colorIndex = name
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0) % avatarColors.length;

    return {
      initials,
      color: avatarColors[colorIndex]
    };
  };

  return (
    <div className="flex items-center gap-2 px-6 py-3" style={{ background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
      <span style={{ fontWeight: 600, fontSize: 13, color: '#1a1a1a' }}>Active Filters:</span>

      {projectFilter && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] font-medium" style={{ background: '#DBEAFE', color: '#2563EB' }}>
          Project: {projectName}
          <X className="w-3 h-3 cursor-pointer opacity-60 hover:opacity-100 ml-1" onClick={() => onRemoveFilter('project')} />
        </span>
      )}

      {statusFilter && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] font-medium" style={{ background: '#FFF4E6', color: '#D97706' }}>
          Status: {statusFilter.replace('_', ' ')}
          <X className="w-3 h-3 cursor-pointer opacity-60 hover:opacity-100 ml-1" onClick={() => onRemoveFilter('status')} />
        </span>
      )}

      {fileTypeFilter && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] font-medium" style={{ background: '#F3E8FF', color: '#7C3AED' }}>
          Type: {fileTypeFilter.toUpperCase()}
          <X className="w-3 h-3 cursor-pointer opacity-60 hover:opacity-100 ml-1" onClick={() => onRemoveFilter('file_type')} />
        </span>
      )}

      {/* ✅ NEW: Owner Filter with Avatar */}
      {ownerFilter && ownerName && (() => {
        const avatar = getOwnerAvatar(ownerName);
        return (
          <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-[13px] font-medium" style={{ background: '#F3F4F6', color: '#1a1a1a' }}>
            Owner:
            <div
              className="rounded-full flex items-center justify-center text-white font-semibold"
              style={{
                width: 20,
                height: 20,
                backgroundColor: avatar.color,
                fontSize: 9,
                fontWeight: 600,
              }}
              title={ownerName}
            >
              {avatar.initials}
            </div>
            <span>{ownerName}</span>
            <X className="w-3 h-3 cursor-pointer opacity-60 hover:opacity-100 ml-1" onClick={() => onRemoveFilter('owner')} />
          </span>
        );
      })()}

      {searchTerm && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] font-medium" style={{ background: '#D1FAE5', color: '#059669' }}>
          Search: "{searchTerm}"
          <X className="w-3 h-3 cursor-pointer opacity-60 hover:opacity-100 ml-1" onClick={() => onRemoveFilter('search')} />
        </span>
      )}

      <span className="cursor-pointer ml-1" style={{ color: '#4169FF', fontWeight: 500, fontSize: 13 }} onClick={onClearAll}>
        Clear all
      </span>
    </div>
  );
}

// ---- BulkToolbar (all actions wired) ----
function ToolbarBtn({ icon, label, onClick, disabled, title }: { icon: React.ReactNode; label: string; onClick?: () => void; disabled?: boolean; title?: string }) {
  return (
    <button onClick={disabled ? undefined : onClick} title={title} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium" style={{ color: disabled ? '#d1d5db' : '#6b7280', border: '1px solid #e5e7eb', background: '#fff', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = '#f3f4f6'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}>{icon}{label}</button>
  );
}

// Status picker dropdown for bulk status change
function BulkStatusDropdown({ onSelect, onClose }: { onSelect: (status: DocumentStatus) => void; onClose: () => void }) {
  const statuses: { value: DocumentStatus; label: string; bg: string; color: string }[] = [
    { value: 'draft', label: 'Draft', bg: '#F3F4F6', color: '#6B7280' },
    { value: 'in_review', label: 'In Review', bg: '#FFF4E6', color: '#D97706' },
    { value: 'approved', label: 'Approved', bg: '#E8F5E9', color: '#16A34A' },
    { value: 'archived', label: 'Archived', bg: '#F3F4F6', color: '#6B7280' },
  ];
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute top-full mt-1 left-0 z-50 rounded-lg shadow-lg py-1" style={{ background: '#fff', border: '1px solid #e5e7eb', minWidth: 160 }}>
        <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Change Status</div>
        {statuses.map((s) => (
          <div key={s.value} className="flex items-center gap-2 cursor-pointer" style={{ padding: '8px 12px', fontSize: 13 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            onClick={() => { onSelect(s.value); onClose(); }}>
            <span className="inline-flex rounded-full" style={{ padding: '2px 10px', fontSize: 11, fontWeight: 500, background: s.bg, color: s.color }}>{s.label}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// Project picker dropdown for bulk move
function BulkMoveDropdown({ projects, onSelect, onClose }: { projects: Project[]; onSelect: (projectId: number) => void; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute top-full mt-1 left-0 z-50 rounded-lg shadow-lg py-1 max-h-[250px] overflow-y-auto" style={{ background: '#fff', border: '1px solid #e5e7eb', minWidth: 200 }}>
        <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Move to Project</div>
        {projects.map((p) => (
          <div key={p.id} className="flex items-center gap-2 cursor-pointer" style={{ padding: '8px 12px', fontSize: 13, color: '#1a1a1a' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            onClick={() => { onSelect(p.id); onClose(); }}>
            <Folder className="w-3.5 h-3.5" style={{ color: '#4F46E5' }} />
            {p.name}
          </div>
        ))}
        {projects.length === 0 && <div style={{ padding: '8px 12px', fontSize: 13, color: '#6b7280' }}>No projects found</div>}
      </div>
    </>
  );
}

function BulkToolbar({ selectedCount, onClear, onDeleteSelected, onChangeStatus, onShare, onMove, onAddTags, projects }: {
  selectedCount: number; onClear: () => void; onDeleteSelected: () => void;
  onChangeStatus: (status: DocumentStatus) => void; onShare: () => void; onMove: (projectId: number) => void;
  onAddTags: () => void;  // ✅ ADD THIS LINE
  projects: Project[];
}) {
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showMoveDropdown, setShowMoveDropdown] = useState(false);

  return (
    <div className="flex items-center gap-3 px-6 py-3" style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
      {selectedCount > 0 ? (<>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium cursor-pointer" style={{ background: '#EEF2FF', color: '#4169FF', border: '1px solid #4169FF' }} onClick={onClear}>
          <input type="checkbox" checked readOnly style={{ accentColor: '#4169FF' }} className="w-[18px] h-[18px] cursor-pointer" />
          <span>{selectedCount} selected</span>
        </div>
        {/* Move */}
        <div className="relative">
          <ToolbarBtn icon={<Move className="w-3.5 h-3.5" />} label="Move" onClick={() => setShowMoveDropdown(!showMoveDropdown)} />
          {showMoveDropdown && <BulkMoveDropdown projects={projects} onSelect={onMove} onClose={() => setShowMoveDropdown(false)} />}
        </div>
        {/* Add Tags */}
        {/* Add Tags - NOW ENABLED */}
        {/* Add Tags - Direct Button */}
        <button
          onClick={() => {
            console.log('🎯 Add Tags clicked!');
            onAddTags();
          }}
          title="Add tags to selected documents"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium"
          style={{
            color: '#6b7280',
            border: '1px solid #e5e7eb',
            background: '#fff',
            cursor: 'pointer',
            opacity: 1
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
        >
          <Tag className="w-3.5 h-3.5" />
          Add Tags
        </button>     {/* Change Status */}
        <div className="relative">
          <ToolbarBtn icon={<SortDesc className="w-3.5 h-3.5" />} label="Change Status" onClick={() => setShowStatusDropdown(!showStatusDropdown)} />
          {showStatusDropdown && <BulkStatusDropdown onSelect={onChangeStatus} onClose={() => setShowStatusDropdown(false)} />}
        </div>
        {/* Share */}
        <ToolbarBtn icon={<Share className="w-3.5 h-3.5" />} label="Share" onClick={onShare} />
        {/* Delete */}
        <ToolbarBtn icon={<Trash2 className="w-3.5 h-3.5" />} label="Delete" onClick={onDeleteSelected} />
        <div style={{ width: 1, height: 24, background: '#e5e7eb', margin: '0 4px' }} />
        <button className="flex items-center px-3 py-1.5 rounded-md" style={{ color: '#6b7280', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}><MoreHorizontal className="w-3.5 h-3.5" /></button>
      </>) : <span style={{ fontSize: 13, color: '#6b7280' }}>Select documents to perform bulk actions</span>}
    </div>
  );
}

// ---- DetailRow ----
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex items-center justify-between" style={{ padding: '10px 0', borderBottom: '1px solid #e5e7eb' }}><span style={{ fontSize: 13, color: '#6b7280' }}>{label}</span><span style={{ fontSize: 13, color: '#1a1a1a', fontWeight: 500, textAlign: 'right' as const, maxWidth: '60%' }}>{value}</span></div>;
}

// ---- SidePreviewPanel ----
type PreviewTab = 'preview' | 'details' | 'activity' | 'comments';
function SidePreviewPanel({ doc, previewUrl, onClose, onOpenFull }: { doc: Document; previewUrl: string | null; onClose: () => void; onOpenFull: () => void }) {
  const [tab, setTab] = useState<PreviewTab>('preview');
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [mentionedUserIds, setMentionedUserIds] = useState<number[]>([]);
  const isOpen = !!doc;

  const { data: activityData } = useQuery({
    queryKey: ['document-activity', doc.id],
    queryFn: () => documentsApi.getActivity(doc.id),
    enabled: tab === 'activity'
  });

  const { data: commentsData } = useQuery({
    queryKey: ['document-comments', doc.id],
    queryFn: () => documentsApi.getComments(doc.id),
    enabled: tab === 'comments'
  });

  const { data: teamMembersData } = useQuery({
    queryKey: ['users-list-comments'],
    queryFn: usersApi.listAll,
    enabled: isOpen && showMentions,
  });

  const activities = activityData?.data?.results || [];
  const comments = commentsData?.data?.results || [];
  const teamMembers = teamMembersData || [];

  const filteredMembers = Array.isArray(teamMembers)
    ? teamMembers.filter((member: any) => {
      const fullName = `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.username || '';
      return (
        fullName.toLowerCase().includes(mentionSearch.toLowerCase()) ||
        member.email?.toLowerCase().includes(mentionSearch.toLowerCase())
      );
    })
    : [];

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setCommentText(text);
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = text.slice(0, cursorPos);
    const words = textBeforeCursor.split(/\s/);
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith('@') && lastWord.length > 0) {
      setShowMentions(true);
      setMentionSearch(lastWord.slice(1));
    } else {
      setShowMentions(false);
      setMentionSearch('');
    }
  };

  const insertMention = (member: any) => {
    const cursorPos = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = commentText.slice(0, cursorPos);
    const textAfterCursor = commentText.slice(cursorPos);

    const words = textBeforeCursor.split(/\s/);
    const lastWord = words[words.length - 1];
    const atSymbolPos = textBeforeCursor.lastIndexOf(lastWord);
    const beforeAt = commentText.slice(0, atSymbolPos);

    // Format: FirstnameLastname (no spaces)
    const fullName = `${member.first_name || ''}${member.last_name || ''}`.trim() || member.username || '';
    const formattedName = fullName.replace(/\s+/g, '');

    const newText = beforeAt + '@' + formattedName + ' ' + textAfterCursor;

    setCommentText(newText);
    setShowMentions(false);
    setMentionSearch('');

    // ✅ ADD THIS - Track the user ID (avoid duplicates)
    setMentionedUserIds(prev => {
      if (!prev.includes(member.id)) {
        return [...prev, member.id];
      }
      return prev;
    });

    setTimeout(() => {
      textareaRef.current?.focus();
      const newCursorPos = (beforeAt + '@' + formattedName + ' ').length;
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;

    try {
      // ✅ SEND mentions array with user IDs
      await documentsApi.addComment(doc.id, commentText.trim(), mentionedUserIds);

      setCommentText('');
      setShowMentions(false);
      setMentionedUserIds([]); // ✅ Clear tracked IDs after posting

      queryClient.invalidateQueries({ queryKey: ['document-comments', doc.id] });
    } catch (error) {
      console.error('Failed to add comment:', error);
      alert('Failed to add comment. Please try again.');
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      await documentsApi.deleteComment(doc.id, commentId);
      queryClient.invalidateQueries({ queryKey: ['document-comments', doc.id] });
    } catch (error) {
      console.error('Failed to delete comment:', error);
      alert('Failed to delete comment. Please try again.');
    }
  };

  const renderCommentWithMentions = (text: string) => {
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span key={i} style={{ color: '#4169FF', fontWeight: 600, cursor: 'pointer' }}
            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
            onClick={() => alert(`View profile for ${part.slice(1)}`)}>
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const fmtD = (d?: string) => d ? new Date(d).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
  const fmtS = (d?: string) => d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
  const sc: Record<string, { b: string; t: string }> = { draft: { b: '#F3F4F6', t: '#6B7280' }, in_review: { b: '#FFF4E6', t: '#D97706' }, approved: { b: '#E8F5E9', t: '#16A34A' }, archived: { b: '#F3F4F6', t: '#6B7280' } };
  const sl: Record<string, string> = { draft: 'Draft', in_review: 'In Review', approved: 'Approved', archived: 'Archived' };
  const fn = doc.original_file_name || doc.name || 'Document';
  const ext = fn.split('.').pop()?.toLowerCase() || '';
  const icm: Record<string, string> = { pdf: '#EF4444', doc: '#2563EB', docx: '#2563EB', xls: '#16A34A', xlsx: '#16A34A', ppt: '#EA580C', pptx: '#EA580C' };
  const ib = icm[ext] || '#6B7280';
  const ss = sc[doc.status] || sc.draft;

  const tabs: { k: PreviewTab; l: string; badge?: number }[] = [
    { k: 'preview', l: 'Preview' },
    { k: 'details', l: 'Details' },
    { k: 'activity', l: 'Activity' },
    { k: 'comments', l: 'Comments', badge: comments.length > 0 ? comments.length : undefined }
  ];

  return (
    <div className="flex-shrink-0 flex flex-col" style={{ width: 380, borderLeft: '1px solid #e5e7eb', background: '#fff' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #e5e7eb' }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="rounded flex items-center justify-center text-white flex-shrink-0" style={{ width: 32, height: 40, background: ib }}><FileText className="w-4 h-4" /></div>
          <span style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a' }} className="truncate">{fn}</span>
        </div>
        <button onClick={onClose} style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X className="w-4 h-4" /></button>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid #e5e7eb', padding: '0 20px' }}>
        <div className="flex gap-5">
          {tabs.map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)} className="flex items-center gap-1.5" style={{ padding: '8px 4px', fontSize: 14, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', color: tab === t.k ? '#1a1a1a' : '#6b7280', borderBottom: `2px solid ${tab === t.k ? '#4169FF' : 'transparent'}` }}>
              {t.l}{t.badge && <span className="rounded-full" style={{ background: '#EF4444', color: '#fff', fontSize: 11, fontWeight: 600, padding: '2px 6px', marginLeft: 6 }}>{t.badge}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {tab === 'preview' && (<>
          <div className="rounded-lg overflow-hidden mb-5" style={{ border: '1px solid #e5e7eb' }}>
            {previewUrl && (ext === 'pdf' || doc.file_type?.includes('pdf')) ? (
              <div><iframe src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewUrl)}&embedded=true`} className="w-full border-0" style={{ height: 400 }} title={fn} />
                <div className="flex items-center justify-center gap-3 py-3" style={{ background: '#f9fafb', borderTop: '1px solid #e5e7eb', fontSize: 13, color: '#6b7280' }}>
                  <button style={{ padding: 4, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}><ZoomOut className="w-3.5 h-3.5" /></button><span>1 / 12</span><button style={{ padding: 4, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}><ZoomIn className="w-3.5 h-3.5" /></button>
                </div></div>
            ) : previewUrl && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext) ? (
              <div className="p-4 flex items-center justify-center" style={{ background: '#f9fafb', minHeight: 300 }}><img src={previewUrl} alt={fn} className="max-w-full max-h-[300px] object-contain rounded" /></div>
            ) : (
              <div className="p-8 flex flex-col items-center justify-center text-center" style={{ background: '#fff', minHeight: 300 }}>
                <div className="rounded-lg flex items-center justify-center text-white mb-3" style={{ width: 64, height: 80, background: ib }}><FileText className="w-6 h-6" /></div>
                <p style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a', marginBottom: 4 }}>{fn}</p><p style={{ fontSize: 12, color: '#6b7280' }}>Click "Open Document" to view full preview</p>
              </div>)}
          </div>
          <div>
            <DetailRow label="Type" value={ext.toUpperCase() || doc.file_type || 'Unknown'} />
            <DetailRow label="Status" value={<span className="inline-flex rounded-full" style={{ padding: '4px 12px', fontSize: 12, fontWeight: 500, background: ss.b, color: ss.t }}>{sl[doc.status] || doc.status}</span>} />
            <DetailRow label="Project" value={<span className="inline-flex items-center gap-1.5 rounded-md" style={{ padding: '4px 10px', background: '#EEF2FF', color: '#4F46E5', fontSize: 13 }}><Folder className="w-3 h-3" />{doc.project_name || 'General'}</span>} />
            <DetailRow label="Owner" value={doc.created_by?.full_name || 'System'} />
            <DetailRow label="Created" value={fmtS(doc.created_at)} />
            <DetailRow label="Updated" value={fmtD(doc.updated_at)} />
            {doc.labels && doc.labels.length > 0 && <DetailRow label="Tags" value={<div className="flex flex-wrap gap-1.5 justify-end">{doc.labels.slice(0, 2).map((l) => <span key={l.id} className="rounded-md" style={{ padding: '4px 10px', fontSize: 12, fontWeight: 500, background: l.color ? `${l.color}20` : '#F3E8FF', color: l.color || '#7C3AED' }}>{l.name}</span>)}{doc.labels.length > 2 && <span className="rounded-md" style={{ padding: '4px 8px', fontSize: 12, fontWeight: 500, background: '#F3F4F6', color: '#6B7280' }}>+{doc.labels.length - 2}</span>}</div>} />}
            <DetailRow label="Location" value={<span className="flex items-center gap-1" style={{ color: '#6b7280', fontSize: 13 }}><Folder className="w-3 h-3" />/ {doc.project_name || 'General'}</span>} />
          </div>
          <button onClick={onOpenFull} className="w-full mt-5 rounded-lg flex items-center justify-center gap-2" style={{ padding: 12, background: '#4169FF', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#3554CC'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#4169FF'; }}><ExternalLink className="w-4 h-4" />Open Document</button>
          <button className="w-full mt-4 rounded-lg flex items-center justify-center" style={{ padding: 10, border: '1px solid #e5e7eb', color: '#6b7280', background: 'none', cursor: 'pointer' }}><MoreHorizontal className="w-4 h-4" /></button>
        </>)}

        {tab === 'details' && <div>
          <DetailRow label="File Name" value={<span style={{ fontWeight: 500, color: '#1a1a1a', wordBreak: 'break-all' as const }}>{fn}</span>} />
          <DetailRow label="Type" value={ext.toUpperCase() || 'Unknown'} />
          <DetailRow label="Status" value={<span className="inline-flex rounded-full" style={{ padding: '4px 12px', fontSize: 12, fontWeight: 500, background: ss.b, color: ss.t }}>{sl[doc.status] || doc.status}</span>} />
          <DetailRow label="Project" value={doc.project_name || 'General'} />
          <DetailRow label="Owner" value={doc.created_by?.full_name || 'System'} />
          <DetailRow label="Created" value={fmtD(doc.created_at)} />
          <DetailRow label="Updated" value={fmtD(doc.updated_at)} />
          {doc.description && <DetailRow label="Description" value={doc.description} />}
        </div>}

        {tab === 'activity' && (
          <div className="space-y-3">
            {activities.length > 0 ? (
              activities.map((activity: any, index: number) => (
                <div key={index} className="flex gap-3 pb-3" style={{ borderBottom: index < activities.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                  <div className="flex-shrink-0 mt-1">
                    {activity.type === 'created' && <div className="rounded-full flex items-center justify-center" style={{ width: 32, height: 32, background: '#D1FAE5' }}><Plus className="w-4 h-4" style={{ color: '#059669' }} /></div>}
                    {activity.type === 'status_changed' && <div className="rounded-full flex items-center justify-center" style={{ width: 32, height: 32, background: '#FFF4E6' }}><SortDesc className="w-4 h-4" style={{ color: '#D97706' }} /></div>}
                    {activity.type === 'updated' && <div className="rounded-full flex items-center justify-center" style={{ width: 32, height: 32, background: '#DBEAFE' }}><Pencil className="w-4 h-4" style={{ color: '#2563EB' }} /></div>}
                    {activity.type === 'moved' && <div className="rounded-full flex items-center justify-center" style={{ width: 32, height: 32, background: '#F3E8FF' }}><Move className="w-4 h-4" style={{ color: '#7C3AED' }} /></div>}
                    {activity.type === 'shared' && <div className="rounded-full flex items-center justify-center" style={{ width: 32, height: 32, background: '#E0E7FF' }}><Share className="w-4 h-4" style={{ color: '#4F46E5' }} /></div>}
                    {activity.type === 'commented' && <div className="rounded-full flex items-center justify-center" style={{ width: 32, height: 32, background: '#FCE7F3' }}><MessageSquare className="w-4 h-4" style={{ color: '#EC4899' }} /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 13, color: '#1a1a1a', fontWeight: 500, marginBottom: 2 }}>{activity.description}</p>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 12, color: '#6b7280' }}>{activity.user?.full_name || 'System'}</span>
                      <span style={{ color: '#e5e7eb' }}>•</span>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>{new Date(activity.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="w-10 h-10 mb-3" style={{ color: '#e5e7eb' }} />
                <p style={{ fontSize: 14, fontWeight: 500, color: '#6b7280' }}>No activity yet</p>
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Document activity will appear here</p>
              </div>
            )}
          </div>
        )}

        {tab === 'comments' && (
          <div className="space-y-4">
            <div className="space-y-4">
              {comments.length > 0 ? (
                comments.map((comment: any) => (
                  <div key={comment.id} className="flex gap-3">
                    <div className="rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0" style={{ width: 32, height: 32, backgroundColor: comment.user?.avatar_color || '#4169FF', fontSize: 12 }}>
                      {comment.user?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="rounded-lg" style={{ background: '#f9fafb', padding: '10px 12px' }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{comment.user?.full_name || 'Anonymous'}</span>
                          <span style={{ fontSize: 12, color: '#6b7280' }}>{new Date(comment.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p style={{ fontSize: 13, color: '#374151', lineHeight: '1.5' }}>{renderCommentWithMentions(comment.content)}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare className="w-10 h-10 mb-3" style={{ color: '#e5e7eb' }} />
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#6b7280' }}>No comments yet</p>
                  <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Be the first to comment</p>
                </div>
              )}
            </div>

            {/* Add Comment Form */}
            <div className="pt-4 relative" style={{ borderTop: '1px solid #e5e7eb' }}>
              <label htmlFor="comment-input" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>Add a comment</label>
              <div className="relative">
                <textarea ref={textareaRef} id="comment-input" name="comment" value={commentText} onChange={handleCommentChange} placeholder="Write a comment... (Type @ to mention someone)" aria-label="Write a comment"
                  style={{ width: '100%', minHeight: 80, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#4169FF'}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; setTimeout(() => setShowMentions(false), 200); }}
                />
                {showMentions && filteredMembers.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-2 bg-white border rounded-lg shadow-lg overflow-hidden" style={{ width: '100%', maxHeight: 200, overflowY: 'auto', zIndex: 1000, border: '1px solid #e5e7eb' }}>
                    <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>Mention Someone</div>
                    {filteredMembers.map((member: any) => {
                      const fullName = `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.username;
                      const initials = `${member.first_name?.[0] || ''}${member.last_name?.[0] || ''}`.toUpperCase() || '?';
                      return (
                        <div key={member.id} className="flex items-center gap-3 px-4 py-2 cursor-pointer" style={{ fontSize: 13 }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          onMouseDown={() => insertMention(member)}>
                          <div className="rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0" style={{ width: 28, height: 28, backgroundColor: member.avatar_color || '#4169FF', fontSize: 11 }}>{initials}</div>
                          <div className="flex-1 min-w-0">
                            <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>{fullName}</div>
                            <div style={{ fontSize: 11, color: '#6b7280' }}>{member.email}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex justify-end mt-2">
                <button onClick={handleAddComment} disabled={!commentText.trim()} className="rounded-lg flex items-center gap-2"
                  style={{ padding: '6px 16px', background: !commentText.trim() ? '#a5b4fc' : '#4169FF', color: '#fff', border: 'none', fontSize: 13, fontWeight: 500, cursor: !commentText.trim() ? 'not-allowed' : 'pointer' }}>
                  <MessageSquare className="w-3.5 h-3.5" />Post Comment
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- DocumentInfoPanel ----
function DocumentInfoPanel({ doc, onClose }: { doc: Document | null; onClose: () => void }) {
  const panelRef = React.useRef<HTMLDivElement>(null);  // ✅ ADD THIS

  // ✅ ADD THIS ENTIRE useEffect
  React.useEffect(() => {
    if (!doc) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Small delay to prevent immediate closing
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [doc, onClose]);
  
  if (!doc) return null;
  const fmtD = (d?: string) => d ? new Date(d).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
  const rows: { icon: React.ReactNode; label: string; value: React.ReactNode }[] = [
    { icon: <FileText className="w-4 h-4" style={{ color: '#4169FF' }} />, label: 'File Name', value: <span style={{ color: '#1a1a1a', fontWeight: 600 }}>{doc.original_file_name || doc.name}</span> },
    { icon: <User className="w-4 h-4" style={{ color: '#4169FF' }} />, label: 'Uploaded By', value: doc.created_by?.full_name || 'System' },
    { icon: <Calendar className="w-4 h-4" style={{ color: '#EF4444' }} />, label: 'Created At', value: fmtD(doc.created_at) },
    { icon: <Calendar className="w-4 h-4" style={{ color: '#D97706' }} />, label: 'Updated At', value: fmtD(doc.updated_at) },
  ];
  if (doc.description) rows.splice(1, 0, { icon: <FileText className="w-4 h-4" style={{ color: '#6b7280' }} />, label: 'Description', value: doc.description });
  return (
    <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
      <div ref={panelRef}  className="pointer-events-auto h-full flex flex-col animate-in slide-in-from-right duration-300" style={{ width: 340, background: '#fff', borderLeft: '1px solid #e5e7eb', boxShadow: '0 25px 50px -12px rgba(0,0,0,.25)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
          <div className="flex items-center gap-2"><Info className="w-4 h-4" style={{ color: '#4169FF' }} /><span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>Document Info</span></div>
          <button onClick={onClose} style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {rows.map((r, i) => <div key={i} className="flex items-start gap-3 py-1.5" style={{ borderBottom: '1px solid #f9fafb' }}><div className="mt-0.5 flex-shrink-0">{r.icon}</div><div className="flex-1 min-w-0"><div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 2 }}>{r.label}</div><div style={{ fontSize: 12, color: '#1a1a1a' }}>{r.value}</div></div></div>)}
          {doc.labels && doc.labels.length > 0 && <div className="flex items-start gap-3 py-1.5"><Tag className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#7C3AED' }} /><div className="flex-1"><div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' as const, marginBottom: 4 }}>Labels</div><div className="flex flex-wrap gap-1">{doc.labels.map((l) => <span key={l.id} className="px-2 py-0.5 rounded-full text-white" style={{ fontSize: 10, fontWeight: 500, backgroundColor: l.color }}>{l.name}</span>)}</div></div></div>}
        </div>
      </div>
    </div>
  );
}

// ---- ConfirmationModal ----
function ConfirmationModal({ isOpen, onClose, onConfirm, title }: ConfirmationModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-md" onClick={onClose} />
      <Card className="relative w-full max-w-[400px] shadow-2xl animate-in fade-in zoom-in duration-300">
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-3 rounded-full" style={{ background: '#FEE2E2' }}><FileText className="h-6 w-6" style={{ color: '#EF4444' }} /></div>
            <div className="space-y-2"><h3 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>Confirm Deletion</h3><p style={{ fontSize: 14, color: '#6b7280' }}>{title}</p></div>
            <div className="flex w-full gap-4 pt-4">
              <button className="flex-1 py-2.5 rounded-lg font-semibold" style={{ background: '#EF4444', color: '#fff', border: 'none', cursor: 'pointer' }} onClick={onConfirm}>Yes</button>
              <button className="flex-1 py-2.5 rounded-lg font-semibold" style={{ background: '#fff', color: '#1a1a1a', border: '1px solid #e5e7eb', cursor: 'pointer' }} onClick={onClose}>No</button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Upload Document Modal (auto-uses current project/folder from tree) ----
function UploadDocumentModal({ isOpen, onClose, projectId, projectName, folderId, folderName, onSuccess }: {
  isOpen: boolean; onClose: () => void; projectId: number | null; projectName: string; folderId: string | null; folderName: string | null; onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  React.useEffect(() => {
    if (isOpen) { setFile(null); setUploading(false); setProgress(''); setError(''); }
  }, [isOpen]);

  const handleFileSelect = (f: File) => { setFile(f); setError(''); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFileSelect(f); };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileTypeFromExt = (name: string): string => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return 'pdf';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
    if (['mp4', 'mov', 'avi'].includes(ext)) return 'video';
    if (ext === 'json') return 'json';
    if (['txt', 'md', 'csv'].includes(ext)) return 'text';
    return 'other';
  };

  const handleUpload = async () => {
    if (!file || !projectId) { setError('Please select a project from the tree first.'); return; }
    setUploading(true); setError(''); setProgress('Getting upload URL...');
    try {
      const uploadUrlResponse = await documentsApi.getUploadUrl(projectId, { file_name: file.name, file_type: file.type || 'application/octet-stream' });
      const { url: s3Url, fields: s3Fields, file_key } = uploadUrlResponse;
      setProgress('Uploading file...');
      await documentsApi.uploadFileToS3(s3Url, s3Fields, file);
      setProgress('Confirming upload...');
      await documentsApi.confirmUpload(projectId, {
        file_key, file_name: file.name, file_type: getFileTypeFromExt(file.name),
        ...(folderId ? { folder: folderId } : {}),
      } as any);
      setProgress('Done!');
      onSuccess();
      setTimeout(() => onClose(), 500);
    } catch (e: any) {
      console.error('Upload failed:', e);
      setError(e.response?.data?.detail || e.message || 'Upload failed.');
    } finally { setUploading(false); }
  };

  if (!isOpen) return null;

  const uploadTarget = folderId && folderName
    ? `${projectName} / ${folderName}`
    : projectName || 'No project selected';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="relative w-full max-w-[520px] rounded-xl shadow-2xl" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #e5e7eb' }}>
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5" style={{ color: '#4169FF' }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>Upload Document</span>
          </div>
          <button onClick={onClose} style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X className="w-5 h-5" /></button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Upload target display */}
          <div className="flex items-center gap-3 rounded-lg" style={{ padding: '12px 16px', background: '#EEF2FF', border: '1px solid #c7d2fe' }}>
            <Folder className="w-5 h-5 flex-shrink-0" style={{ color: '#4169FF' }} />
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Uploading to</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#4169FF' }}>{uploadTarget}</p>
            </div>
          </div>

          {!projectId && (
            <p style={{ fontSize: 13, color: '#EF4444', fontWeight: 500 }}>Please select a project from the tree view first.</p>
          )}

          {/* Drop zone */}
          {!file ? (
            <div className="flex flex-col items-center justify-center rounded-lg cursor-pointer"
              style={{ border: `2px dashed ${dragOver ? '#4169FF' : '#e5e7eb'}`, background: dragOver ? '#EEF2FF' : '#f9fafb', padding: '40px 20px' }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
              onClick={() => document.getElementById('upload-file-input')?.click()}>
              <Upload className="w-10 h-10 mb-3" style={{ color: dragOver ? '#4169FF' : '#6b7280' }} />
              <p style={{ fontSize: 14, color: '#1a1a1a', marginBottom: 4 }}><strong>Click to upload</strong> or drag and drop</p>
              <p style={{ fontSize: 12, color: '#6b7280' }}>PDF, PNG, JPG, DOCX, XLSX, PPTX, JSON, TXT (Max 500MB)</p>
              <input id="upload-file-input" type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg" style={{ border: '1px solid #e5e7eb', background: '#f9fafb', padding: '12px 16px' }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="rounded flex items-center justify-center text-white flex-shrink-0" style={{ width: 36, height: 44, background: '#4169FF' }}><FileText className="w-5 h-5" /></div>
                <div className="min-w-0">
                  <p className="truncate" style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a' }}>{file.name}</p>
                  <p style={{ fontSize: 12, color: '#6b7280' }}>{formatFileSize(file.size)}</p>
                </div>
              </div>
              <button onClick={() => setFile(null)} style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X className="w-4 h-4" /></button>
            </div>
          )}

          {progress && <p style={{ fontSize: 13, color: '#4169FF', fontWeight: 500 }}>{progress}</p>}
          {error && <p style={{ fontSize: 13, color: '#EF4444', fontWeight: 500 }}>{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid #e5e7eb' }}>
          <button onClick={onClose} className="rounded-lg" style={{ padding: '8px 20px', border: '1px solid #e5e7eb', background: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', color: '#1a1a1a' }}>Cancel</button>
          <button onClick={handleUpload} disabled={uploading || !file || !projectId} className="rounded-lg flex items-center gap-2"
            style={{ padding: '8px 20px', background: (!file || !projectId || uploading) ? '#a5b4fc' : '#4169FF', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: (!file || !projectId || uploading) ? 'not-allowed' : 'pointer' }}>
            {uploading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading...</> : <><Upload className="w-4 h-4" /> Upload</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// Tag Selector Modal for Bulk Add Tags
function TagSelectorModal({
  isOpen,
  onClose,
  availableTags,
  selectedCount,
  onConfirm
}: {
  isOpen: boolean;
  onClose: () => void;
  availableTags: any[];
  selectedCount: number;
  onConfirm: (tagIds: number[]) => void;
}) {
  const queryClient = useQueryClient();
  // ✅ ADD THIS - Fetch labels directly in modal
  const { data: freshLabels, refetch: refetchLabels } = useQuery({
    queryKey: ['labels-modal'],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/documents/labels/`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch labels');
      const data = await response.json();
      return data.results || data || [];
    },
    enabled: isOpen,  // Only fetch when modal is open
    staleTime: 0,     // Always refetch
  });
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);  // ✅ ADD THIS
  const [successMessage, setSuccessMessage] = useState('');  // ✅ ADD THIS
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#3B82F6'); // Default blue
  const [isCreating, setIsCreating] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setSelectedTags([]);
      setSearchTerm('');
      setSuccessMessage('');  // ✅ ADD THIS
      setIsSubmitting(false);  // ✅ ADD THIS
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const labelsToUse: any[] = freshLabels || availableTags || [];

  const filteredTags = labelsToUse.filter((tag: any) =>
    tag.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const toggleTag = (tagId: number) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };
  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) {
      alert('Please enter a label name');
      return;
    }

    setIsCreating(true);
    try {
      const token = localStorage.getItem('access_token');

      const urlParams = new URLSearchParams(window.location.search);
      const projectIdFromUrl = urlParams.get('project');
      const currentProjectId = projectIdFromUrl ? Number(projectIdFromUrl) : 154;

      console.log('🔄 Creating label:', {
        project: currentProjectId,
        name: newLabelName.trim(),
        color: newLabelColor
      });

      const response = await fetch(`${API_URL}/documents/labels/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          project: currentProjectId,
          name: newLabelName.trim(),
          color: newLabelColor
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Backend error details:', errorData);

        let errorMessage = 'Failed to create label';
        if (errorData.name && Array.isArray(errorData.name)) {
          errorMessage = errorData.name[0];
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        }
        throw new Error(errorMessage);
      }

      const newLabel = await response.json();
      console.log('✅ Label created:', newLabel);

      // ✅ Refetch both queries
      await refetchLabels();
      await queryClient.invalidateQueries({ queryKey: ['labels'] });

      // ✅ Small delay for state to update
      await new Promise(resolve => setTimeout(resolve, 300));

      // Reset form
      setNewLabelName('');
      setNewLabelColor('#3B82F6');
      setShowCreateForm(false);

      alert(`Label "${newLabel.name}" created successfully! You can now select it.`);

    } catch (error: any) {
      console.error('Failed to create label:', error);
      alert(error.message || 'Failed to create label');
    } finally {
      setIsCreating(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-[520px] rounded-xl shadow-2xl"
        style={{ background: '#fff', border: '1px solid #e5e7eb' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid #e5e7eb' }}
        >
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5" style={{ color: '#4169FF' }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>
              Add Tags to {selectedCount} Document{selectedCount !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute h-4 w-4" style={{ left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
            <input
              type="text"
              placeholder="Search tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 40px',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                fontSize: 14,
                outline: 'none'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#4169FF'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
            />
          </div>
          {/* ✅ ADD THIS: Create New Label Button */}
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="w-full mb-4 py-2 px-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create New Label
          </button>

          {/* ✅ ADD THIS: Create Label Form */}
          {showCreateForm && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Label Name
                  </label>
                  <input
                    type="text"
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                    placeholder="e.g., Review, Contract, Legal"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Color
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={newLabelColor}
                      onChange={(e) => setNewLabelColor(e.target.value)}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={newLabelColor}
                      onChange={(e) => setNewLabelColor(e.target.value)}
                      placeholder="#3B82F6"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleCreateLabel}
                    disabled={isCreating || !newLabelName.trim()}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreating ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewLabelName('');
                      setNewLabelColor('#3B82F6');
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Existing Available Tags list */}
          <div className="text-sm font-semibold text-gray-700 mb-2">AVAILABLE TAGS</div>

          {/* Success Message */}
          {successMessage && (
            <div
              className="rounded-lg"
              style={{
                padding: '12px 16px',
                background: '#D1FAE5',
                border: '1px solid #10B981',
                marginBottom: 16
              }}
            >
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="#10B981"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <p style={{ fontSize: 14, fontWeight: 500, color: '#065F46', margin: 0 }}>
                  {successMessage}
                </p>
              </div>
            </div>
          )}

          {/* Selected Tags Summary */}
          {selectedTags.length > 0 && (
            <div
              className="rounded-lg"
              style={{ padding: '12px 16px', background: '#EEF2FF', border: '1px solid #c7d2fe' }}
            >
              <p style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>
                SELECTED ({selectedTags.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedTags.map((tagId) => {
                  const tag = labelsToUse.find((t) => t.id === tagId);  // ✅ Use labelsToUse
                  if (!tag) return null;
                  return (
                    <span
                      key={tagId}
                      className="inline-flex items-center gap-2 rounded-md"
                      style={{
                        padding: '6px 12px',
                        fontSize: 13,
                        fontWeight: 500,
                        background: tag.color || '#7C3AED',
                        color: '#fff',
                        cursor: 'pointer'
                      }}
                      onClick={() => toggleTag(tagId)}
                    >
                      {tag.name}
                      <X className="w-3 h-3" />
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Available Tags */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              AVAILABLE TAGS
            </p>
            <div
              className="space-y-2 overflow-y-auto"
              style={{ maxHeight: 300 }}
            >
              {filteredTags.length > 0 ? (
                filteredTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag.id);
                  return (
                    <div
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className="flex items-center gap-3 rounded-lg cursor-pointer"
                      style={{
                        padding: '12px 16px',
                        border: `2px solid ${isSelected ? '#4169FF' : '#e5e7eb'}`,
                        background: isSelected ? '#EEF2FF' : '#fff',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = '#f9fafb';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = '#fff';
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => { }}
                        onClick={(e) => e.stopPropagation()}
                        style={{ accentColor: '#4169FF', width: 18, height: 18, cursor: 'pointer' }}
                      />
                      <span
                        className="inline-flex rounded-md flex-1"
                        style={{
                          padding: '6px 12px',
                          fontSize: 13,
                          fontWeight: 500,
                          background: tag.color || '#7C3AED',
                          color: '#fff'
                        }}
                      >
                        {tag.name}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div
                  className="flex flex-col items-center justify-center py-12 text-center"
                  style={{ color: '#6b7280' }}
                >
                  <Tag className="w-10 h-10 mb-3" style={{ color: '#e5e7eb' }} />
                  <p style={{ fontSize: 14, fontWeight: 500 }}>No tags found</p>
                  <p style={{ fontSize: 12, marginTop: 4 }}>
                    {searchTerm ? 'Try a different search term' : 'Ask your admin to create tags first'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4"
          style={{ borderTop: '1px solid #e5e7eb' }}
        >
          <button
            onClick={onClose}
            className="rounded-lg"
            style={{
              padding: '8px 20px',
              border: '1px solid #e5e7eb',
              background: '#fff',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              color: '#1a1a1a'
            }}
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              if (selectedTags.length === 0) {
                setSuccessMessage('');
                alert('Please select at least one tag');
                return;
              }

              setIsSubmitting(true);
              setSuccessMessage('');

              try {
                await onConfirm(selectedTags);

                // ✅ Show success message in modal
                setSuccessMessage(`Successfully added ${selectedTags.length} tag(s) to ${selectedCount} document(s)!`);

                // ✅ Auto-close after 2 seconds
                setTimeout(() => {
                  onClose();
                }, 2000);

              } catch (error: any) {
                setSuccessMessage('');
                alert(error.message || 'Failed to add tags');
              } finally {
                setIsSubmitting(false);
              }
            }}
            disabled={selectedTags.length === 0 || isSubmitting}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: selectedTags.length === 0 || isSubmitting ? '#D1D5DB' : '#4169FF',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: selectedTags.length === 0 || isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <Tag className="w-4 h-4" />
            {isSubmitting ? 'Adding...' : `Add ${selectedTags.length > 0 ? selectedTags.length : ''} Tag${selectedTags.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ========== MAIN COMPONENT ==========
export function Documents() {
  const queryClient = useQueryClient();
  const { unreadCount } = useNotifications();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; fileName: string; fileType: string } | null>(null);
  const navigate = useNavigate();
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [infoDoc, setInfoDoc] = useState<Document | null>(null);
  const [shareDoc, setShareDoc] = useState<Document | null>(null);
  const [selectedFolder, setSelectedFolder] = useState('All Documents');
  const [selectedTreeFolderId, setSelectedTreeFolderId] = useState<string | null>(null);
  const [selectedTreeFolderName, setSelectedTreeFolderName] = useState<string | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [isTreeOpen, setIsTreeOpen] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [sidebarDoc, setSidebarDoc] = useState<Document | null>(null);
  const [sidebarPreviewUrl, setSidebarPreviewUrl] = useState<string | null>(null);
  const [showNewDocModal, setShowNewDocModal] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocContent, setNewDocContent] = useState('');
  const [newDocFormat, setNewDocFormat] = useState('txt');
  const [customFormat, setCustomFormat] = useState('');

  const { viewMode, setViewMode } = useViewMode({ defaultMode: 'table' });
  const projectFilter = searchParams.get('project') || '';
  const statusFilter = searchParams.get('status') || '';
  const fileTypeFilter = searchParams.get('file_type') || '';
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'updated_at' | 'created_at'>('updated_at');
  const [rowsPerPage, setRowsPerPage] = useState(25);

  React.useEffect(() => { setCurrentPage(1); }, [projectFilter, fileTypeFilter, searchTerm]);
  React.useEffect(() => { queryClient.invalidateQueries({ queryKey: ['documents'] }); }, []);

  const { data: projectsData } = useQuery({ queryKey: ['projects'], queryFn: () => projectsApi.list() });
  // Fetch available tags/labels
  const { data: tagsData } = useQuery({
    queryKey: ['labels'],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');

      const response = await fetch('${API_URL}/documents/labels/', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch labels: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Parent loaded labels:', data.results?.length || data.length);
      return data.results || data || [];
    },
    staleTime: 0,  // ✅ CHANGED - Always fetch fresh
    refetchOnMount: 'always',  // ✅ ADDED
    refetchOnWindowFocus: true,  // ✅ ADDED
  });

  React.useEffect(() => {
    if (tagsData) {
      setAvailableTags(tagsData);
      console.log('✅ Loaded', tagsData.length, 'labels:', tagsData);
    }
  }, [tagsData]);
  // Existing query for displaying documents (filtered)
  const { data: allDocumentsData, isLoading } = useQuery({
    queryKey: ['documents', 'all', projectFilter, fileTypeFilter, currentPage, selectedTreeFolderId],
    queryFn: () => {
      const params: any = {
        page: currentPage,
        file_type: fileTypeFilter || undefined,
        status: statusFilter || undefined,
      };

      if (selectedTreeFolderId) {
        params.folder = selectedTreeFolderId;
      } else if (projectFilter) {
        params.project = Number(projectFilter);
        params.root_only = true;
      }

      return documentsApi.list(params);
    },
    enabled: true,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  // ✅ ADD THIS NEW QUERY - For tree counts only (no filters)
  const { data: allDocumentsForTree } = useQuery({
    queryKey: ['documents-tree-counts'],
    queryFn: () => documentsApi.list({}),  // ✅ Fetch all with default page size
    staleTime: 30000,
  });

  // Fetch folders for ALL projects
  const { data: foldersData } = useQuery({
    queryKey: ['document-folders'],
    queryFn: async () => {
      const res = await documentsApi.listFolders();
      return res.results || res || [];
    },
    staleTime: 0,
  });

  const rawProjects = projectsData?.results || projectsData || [];
  const projects = (Array.isArray(rawProjects) ? rawProjects : []) as Project[];
  const allDocs = allDocumentsData?.results || allDocumentsData || [];
  const allDocsForTree = allDocumentsForTree?.results || allDocumentsForTree || [];
  const totalCount = (allDocumentsData as any)?.count || 0;
  const hasNextPage = !!(allDocumentsData as any)?.next;
  const hasPreviousPage = !!(allDocumentsData as any)?.previous;
  const projectLookup = projects.reduce((acc: Record<number, string>, p: Project) => { acc[p.id] = p.name; return acc; }, {});

  // ---- TreeDocumentView ----
  function TreeDocumentView({ documents, projects, onDocumentClick, selectedDocs, toggleSelect }: {
    documents: Document[];
    projects: Project[];
    onDocumentClick: (doc: Document) => void;
    selectedDocs: Set<string>;
    toggleSelect: (id: string) => void;
  }) {
    const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());

    const toggleProject = (projectId: number) => {
      setExpandedProjects((prev) => {
        const next = new Set(prev);
        if (next.has(projectId)) {
          next.delete(projectId);
        } else {
          next.add(projectId);
        }
        return next;
      });
    };

    // Group documents by project
    const docsByProject = documents.reduce((acc, doc) => {
      if (!acc[doc.project]) {
        acc[doc.project] = [];
      }
      acc[doc.project].push(doc);
      return acc;
    }, {} as Record<number, Document[]>);

    const getFileIcon = (doc: Document) => {
      const ext = doc.original_file_name?.split('.').pop()?.toLowerCase() || '';
      const iconColors: Record<string, string> = {
        pdf: '#EF4444',
        doc: '#2563EB', docx: '#2563EB',
        xls: '#16A34A', xlsx: '#16A34A',
        ppt: '#EA580C', pptx: '#EA580C',
        png: '#7C3AED', jpg: '#7C3AED', jpeg: '#7C3AED',
      };
      return iconColors[ext] || '#6B7280';
    };

    return (
      <div className="p-6 overflow-auto h-full">
        <div className="space-y-2">
          {projects.map((project) => {
            const projectDocs = docsByProject[project.id] || [];
            const isExpanded = expandedProjects.has(project.id);

            if (projectDocs.length === 0) return null;

            return (
              <div key={project.id} className="border rounded-lg" style={{ borderColor: '#e5e7eb' }}>
                {/* Project Header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer"
                  style={{ background: '#f9fafb', borderBottom: isExpanded ? '1px solid #e5e7eb' : 'none' }}
                  onClick={() => toggleProject(project.id)}
                >
                  <ChevronRightIcon
                    className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    style={{ color: '#6b7280' }}
                  />
                  <Folder className="w-5 h-5" style={{ color: '#4169FF' }} />
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a', flex: 1 }}>
                    {project.name}
                  </span>
                  <span
                    className="px-2.5 py-1 rounded-full"
                    style={{ fontSize: 12, fontWeight: 500, background: '#EEF2FF', color: '#4169FF' }}
                  >
                    {projectDocs.length} {projectDocs.length === 1 ? 'document' : 'documents'}
                  </span>
                </div>

                {/* Documents List */}
                {isExpanded && (
                  <div className="divide-y" style={{ borderColor: '#f3f4f6' }}>
                    {projectDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-3 p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => onDocumentClick(doc)}
                      >
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={selectedDocs.has(doc.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelect(doc.id);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{ accentColor: '#4169FF', width: 18, height: 18, cursor: 'pointer' }}
                        />

                        {/* File Icon */}
                        <div
                          className="rounded flex items-center justify-center flex-shrink-0"
                          style={{ width: 36, height: 44, background: getFileIcon(doc), color: '#fff' }}
                        >
                          <FileText className="w-4 h-4" />
                        </div>

                        {/* Document Info */}
                        <div className="flex-1 min-w-0">
                          <p
                            className="truncate"
                            style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a' }}
                          >
                            {doc.original_file_name || doc.name}
                          </p>
                          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                            Updated {new Date(doc.updated_at).toLocaleDateString()}
                          </p>
                        </div>

                        {/* Status Badge */}
                        <span
                          className="px-3 py-1 rounded-full flex-shrink-0"
                          style={{
                            fontSize: 12,
                            fontWeight: 500,
                            background:
                              doc.status === 'approved'
                                ? '#E8F5E9'
                                : doc.status === 'in_review'
                                  ? '#FFF4E6'
                                  : '#F3F4F6',
                            color:
                              doc.status === 'approved'
                                ? '#16A34A'
                                : doc.status === 'in_review'
                                  ? '#D97706'
                                  : '#6B7280',
                          }}
                        >
                          {doc.status === 'approved'
                            ? 'Approved'
                            : doc.status === 'in_review'
                              ? 'In Review'
                              : doc.status === 'draft'
                                ? 'Draft'
                                : 'Archived'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }



  const displayedDocuments = (() => {
    const nc: Record<string, number> = {}; const ni: Record<string, number> = {};
    allDocs.forEach((d: Document) => { const b = (d as any).file_name || d.original_file_name || d.name || ''; nc[b] = (nc[b] || 0) + 1; });
    return allDocs.map((d: Document) => {
      const b = (d as any).file_name || d.original_file_name || d.name || ''; let dn = b;
      if (nc[b] > 1) { if (ni[b] === undefined) ni[b] = 0; else ni[b] += 1; if (ni[b] > 0) { const di = b.lastIndexOf('.'); dn = di !== -1 ? `${b.slice(0, di)} (${ni[b]})${b.slice(di)}` : `${b} (${ni[b]})`; } }
      return { ...d, name: dn, project_name: projectLookup[d.project] || d.project_name || 'General' };
    }).filter((d: Document) => {
      if (statusFilter && d.status !== statusFilter) return false;
      if (searchTerm && !d.name.toLowerCase().includes(searchTerm.toLowerCase())) return false; return true;
    }).sort((a: Document, b: Document) => new Date(b[sortBy]).getTime() - new Date(a[sortBy]).getTime());
  })();

  const backendFolders = (foldersData || []) as { id: string; project: number; parent: string | null; name: string; is_system_generated?: boolean; document_count?: number; created_at: string }[];

  const treeFolders: TreeFolder[] = (() => {
    const projectChildren: TreeFolder[] = projects.map((p) => {
      const projectFolders = backendFolders
        .filter((f) => f.project === p.id && f.parent === null)
        .map((f) => {
          const subfolderCount = backendFolders.filter(
            (sub) => sub.parent === f.id
          ).length;

          return {
            id: f.id,
            name: f.name,
            count: f.document_count ?? 0,
            folderCount: subfolderCount,
            projectId: p.id,
            isSystemGenerated: f.is_system_generated || false,
            children: [] as TreeFolder[],
          };
        });

      // ✅ CORRECT - Use allDocsForTree (not filtered by project)
      const projectDocCount = allDocsForTree.filter(
        (doc: Document) => doc.project === p.id && !doc.folder
      ).length;

      return {
        id: undefined,
        name: p.name,
        count: projectDocCount,
        folderCount: projectFolders.length,
        projectId: p.id,
        children: projectFolders,
      };
    });

    const totalAllDocs = projectChildren.reduce(
      (sum, project) => sum + project.count,
      0
    );

    return [{
      name: 'All Documents',
      count: totalAllDocs,
      folderCount: projectChildren.length,
      children: projectChildren
    }];
  })();

  // Create folder handler (name comes from inline input in TreePanel)
  const handleCreateFolder = async (projectId: number, parentId: string | null, folderName: string) => {
    try {
      await documentsApi.createFolder({ project: projectId, name: folderName, parent: parentId });
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (e: any) {
      console.error('Create folder failed:', e);
      alert(e.response?.data?.detail || e.response?.data?.name?.[0] || 'Failed to create folder');
    }
  };

  // Rename folder handler
  const handleRenameFolder = async (folderId: string, newName: string) => {
    try {
      await documentsApi.renameFolder(folderId, newName);
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    } catch (e: any) {
      console.error('Rename folder failed:', e);
      alert(e.response?.data?.detail || 'Failed to rename folder');
    }
  };

  const updateFilter = (k: string, v: string) => { const n = new URLSearchParams(searchParams); if (v) n.set(k, v); else n.delete(k); setSearchParams(n); };
  const clearFilters = () => { setSearchParams({}); setSearchTerm(''); setCurrentPage(1); };
  const removeFilter = (k: string) => { if (k === 'search') setSearchTerm(''); else updateFilter(k, ''); };
  const hasActiveFilters = projectFilter || statusFilter || fileTypeFilter || searchTerm;
  const handleDeleteClick = (e: React.MouseEvent, doc: Document) => { e.stopPropagation(); setDeleteConfirm({ id: doc.id, name: doc.name }); };

  // Checkbox toggle
  const toggleSelect = (id: string) => setSelectedDocs((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleSelectAll = () => {
    if (selectedDocs.size === displayedDocuments.length) setSelectedDocs(new Set());
    else setSelectedDocs(new Set(displayedDocuments.map((d: Document) => d.id)));
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    const ids = Array.from(selectedDocs);
    for (const id of ids) { try { await documentsApi.delete(id); } catch (e) { console.error('Delete failed:', e); } }
    setSelectedDocs(new Set()); setBulkDeleteConfirm(false);
    queryClient.invalidateQueries({ queryKey: ['documents'] });
  };

  // Bulk change status
  const handleBulkChangeStatus = async (newStatus: DocumentStatus) => {
    const ids = Array.from(selectedDocs);
    for (const id of ids) {
      try { await documentsApi.updateStatus(id, newStatus); } catch (e) { console.error('Status update failed:', e); }
    }
    setSelectedDocs(new Set());
    queryClient.invalidateQueries({ queryKey: ['documents'] });
  };

  // Bulk share — opens share modal for the first selected doc (or could loop)
  const handleBulkShare = () => {
    const firstId = Array.from(selectedDocs)[0];
    if (firstId) {
      const doc = displayedDocuments.find((d: Document) => d.id === firstId);
      if (doc) setShareDoc(doc);
    }
  };

  // Bulk move — update project for all selected docs
  const handleBulkMove = async (targetProjectId: number) => {
    const ids = Array.from(selectedDocs);
    for (const id of ids) {
      try { await documentsApi.update(id, { project: targetProjectId } as any); } catch (e) { console.error('Move failed:', e); }
    }
    setSelectedDocs(new Set());
    queryClient.invalidateQueries({ queryKey: ['documents'] });
  };
  // Bulk add tags handler
  const handleBulkAddTags = async (tagIds: number[]) => {
    if (tagIds.length === 0) {
      alert('Please select at least one tag');
      return;
    }

    const documentIds = Array.from(selectedDocs);
    if (documentIds.length === 0) {
      alert('Please select at least one document');
      return;
    }

    try {
      const token = localStorage.getItem('access_token');

      const response = await fetch('${API_URL}/documents/bulk-add-labels/', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          document_ids: documentIds,
          label_ids: tagIds,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.detail || 'Failed to add tags');
      }

      const result = await response.json();

      // Success!
      setShowTagSelector(false);
      setSelectedDocs(new Set());
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['documents-tree-counts'] });

      // ✅ UNCOMMENT THIS - Show success message
      const message = result.skipped_count
        ? `Successfully added tags to ${result.updated_count} document(s). ${result.skipped_count} skipped due to permissions.`
        : `Successfully added tags to ${result.updated_count} document(s)`;

      alert(message);
    } catch (error: any) {
      console.error('Bulk add tags failed:', error);
      alert(error.message || 'Failed to add tags. Please try again.');
    }
  };

  const handleDocumentClick = async (doc: Document) => {
    setSidebarDoc(doc); setSidebarPreviewUrl(null);
    try { const r = await documentsApi.getDownloadUrl(doc.project, { document_id: doc.id }); setSidebarPreviewUrl(r.url); } catch (e) { console.error(e); }
  };
  const handleOpenFullPreview = () => { if (sidebarDoc && sidebarPreviewUrl) setPreviewDoc({ url: sidebarPreviewUrl, fileName: sidebarDoc.original_file_name || sidebarDoc.name, fileType: sidebarDoc.file_type }); };
  const { isActivityOpen, setIsActivityOpen } = useOutletContext<{ isActivityOpen: boolean; setIsActivityOpen: (o: boolean) => void }>();

  // Build table columns WITH checkbox column prepended
  const baseColumns = createDocumentsTableColumns({ onDeleteClick: handleDeleteClick, onInfoClick: (d: Document) => setInfoDoc(d), onShareClick: (d: Document) => setShareDoc(d) });
  const checkboxColumn: TableColumn<Document> = {
    key: '_select' as any,
    label: <input type="checkbox" checked={selectedDocs.size === displayedDocuments.length && displayedDocuments.length > 0} onChange={toggleSelectAll} style={{ accentColor: '#4169FF', width: 18, height: 18, cursor: 'pointer' }} />,
    render: (doc: Document) => <input type="checkbox" checked={selectedDocs.has(doc.id)} onChange={(e) => { e.stopPropagation(); toggleSelect(doc.id); }} onClick={(e) => e.stopPropagation()} style={{ accentColor: '#4169FF', width: 18, height: 18, cursor: 'pointer' }} />,
    width: '40px',
  };
  const columnsWithCheckbox = [checkboxColumn, ...baseColumns];

  const emptyState = (
    <div className="flex flex-col items-center justify-center py-12">
      <FileText className="h-12 w-12 mb-4" style={{ color: '#6b7280' }} />
      <h3 style={{ fontSize: 18, fontWeight: 500, color: '#1a1a1a' }}>No documents found</h3>
      <p style={{ color: '#6b7280', marginBottom: 16 }}>{hasActiveFilters ? 'Try adjusting your filters' : 'Create your first document to get started'}</p>
      {hasActiveFilters && <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>}
    </div>
  );
  const currentProjectName = projectFilter ? projects.find((p) => String(p.id) === projectFilter)?.name || projectFilter : '';
  const totalPages = Math.ceil(totalCount / rowsPerPage) || 1;

  return (
    <div className="flex w-full h-screen">
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden" style={{ background: '#fff' }}>
        {/* TOPBAR */}
        <div className="flex-shrink-0" style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '16px 24px' }}>
          <div className="flex items-center justify-between mb-4">
            <div><h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>Documents</h1><p style={{ fontSize: 14, color: '#6b7280' }}>Manage all your documents across projects</p></div>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 rounded-md" style={{ padding: '8px 16px', border: '1px solid #e5e7eb', background: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', color: '#1a1a1a' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }} onClick={() => setShowUploadModal(true)}><Upload className="h-4 w-4" /> Upload</button>
              <button
                className="flex items-center gap-2 rounded-md"
                style={{
                  padding: '8px 16px',
                  background: '#4169FF',
                  color: '#fff',
                  border: 'none',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#3554CC'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#4169FF'; }}
                onClick={() => setShowNewDocModal(true)}
              >
                <Plus className="h-4 w-4" /> New Document
              </button>              <div className="flex rounded-md overflow-hidden" style={{ border: '1px solid #e5e7eb' }}>
                {/* List View */}
                <button
                  style={{
                    padding: '8px 12px',
                    border: 'none',
                    cursor: 'pointer',
                    background: viewMode === 'table' ? '#EEF2FF' : '#fff',
                    color: viewMode === 'table' ? '#4169FF' : '#6b7280'
                  }}
                  onClick={() => setViewMode('table')}
                  title="Table View">
                  <List className="w-4 h-4" />
                </button>

                {/* Grid View */}
                <button
                  style={{
                    padding: '8px 12px',
                    border: 'none',
                    cursor: 'pointer',
                    background: viewMode === 'grid' ? '#EEF2FF' : '#fff',
                    color: viewMode === 'grid' ? '#4169FF' : '#6b7280'
                  }}
                  onClick={() => setViewMode('grid')}
                  title="Grid View">
                  <Grid3X3 className="w-4 h-4" />
                </button>

                {/* Tree View */}
                <button
                  style={{
                    padding: '8px 12px',
                    border: 'none',
                    cursor: 'pointer',
                    background: viewMode === 'tree' ? '#EEF2FF' : '#fff',
                    color: viewMode === 'tree' ? '#4169FF' : '#6b7280'
                  }}
                  onClick={() => setViewMode('tree' as any)}
                  title="Tree View">
                  <Network className="w-4 h-4" />
                </button>
              </div>
              <button className="relative" style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }} onClick={() => setIsActivityOpen(!isActivityOpen)}>
                <Bell className="h-5 w-5" />{unreadCount > 0 && <span className="absolute rounded-full" style={{ top: 4, right: 4, width: 8, height: 8, background: '#EF4444' }} />}
              </button>
            </div>
          </div>
          <div className="relative mb-4">
            <Search className="absolute h-4 w-4" style={{ left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
            <input type="text" placeholder="Search documents by name, content, tags, or owner..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '10px 40px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, background: '#f9fafb', outline: 'none', fontFamily: 'inherit' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#4169FF'; e.currentTarget.style.background = '#fff'; }} onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#f9fafb'; }} />
            <span className="absolute rounded" style={{ right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#6b7280', background: '#fff', padding: '2px 6px', border: '1px solid #e5e7eb' }}>⌘ K</span>
          </div>
          <div className="flex items-center gap-3">
            <select value={projectFilter} onChange={(e) => updateFilter('project', e.target.value)} style={{ padding: '8px 32px 8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 14, appearance: 'none' as const, backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 5L6 8L9 5' stroke='%236B7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', fontFamily: 'inherit', color: '#1a1a1a' }}>
              <option value="">All Projects</option>{projects.map((p: Project) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={fileTypeFilter} onChange={(e) => updateFilter('file_type', e.target.value)} style={{ padding: '8px 32px 8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 14, appearance: 'none' as const, backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 5L6 8L9 5' stroke='%236B7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', fontFamily: 'inherit', color: '#1a1a1a' }}>
              {FILE_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button className="flex items-center gap-2 rounded-md" style={{ padding: '8px 12px', border: '1px solid #e5e7eb', background: '#fff', fontSize: 14, cursor: 'pointer', color: '#1a1a1a' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }} onClick={() => setShowFilters(!showFilters)}><Filter className="w-3.5 h-3.5" /> Filters</button>
            {/* <button className="flex items-center justify-center rounded-full" style={{ width: 32, height: 32, background: '#4169FF', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>?</button> */}
          </div>
        </div>

        <ActiveFiltersBar
          projectFilter={projectFilter}
          projectName={currentProjectName}
          statusFilter={statusFilter}
          fileTypeFilter={fileTypeFilter}
          searchTerm={searchTerm}
          ownerFilter={searchParams.get('owner') || ''}           // ✅ ADD THIS
          ownerName={searchParams.get('owner_name') || ''}        // ✅ ADD THIS
          onClearAll={clearFilters}
          onRemoveFilter={removeFilter}
        />
        <div className="flex-1 flex overflow-hidden" style={{ background: '#fff' }}>
          <TreePanel
            folders={treeFolders}
            onFolderClick={(name, folderId, folderProjectId) => {
              const pr = projects.find((p) => p.name === name);
              if (pr) {
                // Clicked a project node
                updateFilter('project', String(pr.id));
                setSelectedFolder(name);
                setSelectedTreeFolderId(null);
                setSelectedTreeFolderName(null);
              } else if (name === 'All Documents') {
                updateFilter('project', '');
                setSelectedFolder('All Documents');
                setSelectedTreeFolderId(null);
                setSelectedTreeFolderName(null);
              } else if (folderId) {
                // Clicked a subfolder — filter by UUID
                if (folderProjectId) {
                  updateFilter('project', String(folderProjectId));
                }
                setSelectedFolder(name);
                setSelectedTreeFolderId(folderId); // ✅ This triggers folder filtering
                setSelectedTreeFolderName(name);
              }
            }}
            selectedFolder={selectedFolder}
            selectedFolderId={selectedTreeFolderId}  // ✅ ADD THIS LINE
            isOpen={isTreeOpen}
            onToggle={() => setIsTreeOpen((p) => !p)}
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
          />

          <div className="flex-1 flex flex-col overflow-hidden">
            <BulkToolbar
              selectedCount={selectedDocs.size}
              onClear={() => setSelectedDocs(new Set())}
              onDeleteSelected={() => setBulkDeleteConfirm(true)}
              onChangeStatus={handleBulkChangeStatus}
              onShare={handleBulkShare}
              onMove={handleBulkMove}
              onAddTags={() => setShowTagSelector(true)}  // ✅ ADD THIS LINE
              projects={projects}
            />
            <div className="flex-1 overflow-auto">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center min-h-[50vh] w-full">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary mb-4"></div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#6b7280' }} className="animate-pulse">Loading documents...</p>
                </div>
              ) : viewMode === 'tree' ? (
                <TreeDocumentView
                  documents={allDocs}
                  projects={projects}
                  onDocumentClick={handleDocumentClick}
                  selectedDocs={selectedDocs}
                  toggleSelect={toggleSelect}
                />
              ) : (
                <DualView
                  viewMode={viewMode}
                  isLoading={isLoading}
                  gridProps={{
                    data: displayedDocuments,
                    renderCard: (doc) => (
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={selectedDocs.has(doc.id)}
                          onChange={() => toggleSelect(doc.id)}
                          className="absolute top-3 left-3 z-10"
                          style={{ accentColor: '#4169FF', width: 18, height: 18, cursor: 'pointer' }}
                        />
                        <div
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDocumentClick(doc); }}
                          className="cursor-pointer"
                          style={{ pointerEvents: 'auto' }}>
                          <div style={{ pointerEvents: 'none' }}>
                            <DocumentGridCard
                              key={doc.id}
                              document={doc}
                              onDeleteClick={(e) => { e.stopPropagation(); handleDeleteClick(e, doc); }}
                              onShareClick={(d: Document) => setShareDoc(d)}
                            />
                          </div>
                        </div>
                      </div>
                    ),
                    emptyState,
                    gridClassName: 'grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                  }}
                  tableProps={{
                    data: displayedDocuments,
                    columns: columnsWithCheckbox,
                    rowKey: (d: Document) => d.id,
                    onRowClick: (d: Document) => handleDocumentClick(d),
                    emptyState,
                    rowClassName: (d: Document) => `group ${selectedDocs.has(d.id) ? 'bg-[#EEF2FF]' : ''}`
                  }}
                />
              )}
            </div>

            {totalCount > 0 && (
              <div className="flex items-center justify-between flex-shrink-0" style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', background: '#fff' }}>
                <div style={{ fontSize: 13, color: '#6b7280' }}>{displayedDocuments.length > 0 ? `Showing 1 to ${Math.min(rowsPerPage, displayedDocuments.length)} of ${totalCount} documents` : 'No documents found'}</div>
                <div className="flex items-center gap-3">
                  <label style={{ fontSize: 13, color: '#6b7280' }}>Rows per page:</label>
                  <select value={rowsPerPage} onChange={(e) => setRowsPerPage(Number(e.target.value))} style={{ padding: '6px 32px 6px 10px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, background: '#fff', cursor: 'pointer', appearance: 'none' as const, backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 5L6 8L9 5' stroke='%236B7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', fontFamily: 'inherit' }}>
                    <option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
                  </select>
                  <div className="flex gap-1.5">
                    <button className="flex items-center justify-center rounded-md" style={{ width: 32, height: 32, border: '1px solid #e5e7eb', background: '#fff', cursor: !hasPreviousPage ? 'not-allowed' : 'pointer', color: !hasPreviousPage ? '#e5e7eb' : '#6b7280' }} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={!hasPreviousPage}><ChevronLeft className="w-3.5 h-3.5" /></button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((pg) => <button key={pg} className="flex items-center justify-center rounded-md" style={{ width: 32, height: 32, fontSize: 13, fontWeight: 500, cursor: 'pointer', background: currentPage === pg ? '#4169FF' : '#fff', color: currentPage === pg ? '#fff' : '#6b7280', border: `1px solid ${currentPage === pg ? '#4169FF' : '#e5e7eb'}` }} onClick={() => setCurrentPage(pg)}>{pg}</button>)}
                    <button className="flex items-center justify-center rounded-md" style={{ width: 32, height: 32, border: '1px solid #e5e7eb', background: '#fff', cursor: (!hasNextPage || !displayedDocuments.length) ? 'not-allowed' : 'pointer', color: (!hasNextPage || !displayedDocuments.length) ? '#e5e7eb' : '#6b7280' }} onClick={() => setCurrentPage((p) => p + 1)} disabled={!hasNextPage || !displayedDocuments.length}><ChevronRight className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {sidebarDoc && <SidePreviewPanel doc={sidebarDoc} previewUrl={sidebarPreviewUrl} onClose={() => { setSidebarDoc(null); setSidebarPreviewUrl(null); }} onOpenFull={handleOpenFullPreview} />}
        </div>
      </div>

      {/* MODALS */}
      <UploadDocumentModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        projectId={projectFilter ? Number(projectFilter) : null}
        projectName={currentProjectName || 'No project selected'}
        folderId={selectedTreeFolderId}
        folderName={selectedTreeFolderName}
        onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['documents'] }); queryClient.invalidateQueries({ queryKey: ['document-folders'] }); }}
      />
      <ConfirmationModal isOpen={!!deleteConfirm} title={`Are you sure you want to delete "${deleteConfirm?.name}"?`} onClose={() => setDeleteConfirm(null)} onConfirm={async () => { if (deleteConfirm) { try { await documentsApi.delete(deleteConfirm.id); setDeleteConfirm(null); queryClient.invalidateQueries({ queryKey: ['documents'] }); } catch (e) { console.error(e); } } }} />
      <ConfirmationModal isOpen={bulkDeleteConfirm} title={`Are you sure you want to delete ${selectedDocs.size} selected document(s)?`} onClose={() => setBulkDeleteConfirm(false)} onConfirm={handleBulkDelete} />
      {isActivityOpen && <NotificationsPage onClose={() => setIsActivityOpen(false)} defaultFilter="unread" />}
      <DocumentInfoPanel doc={infoDoc} onClose={() => setInfoDoc(null)} />
      {previewDoc && <DocumentPreview url={previewDoc.url} fileName={previewDoc.fileName} fileType={previewDoc.fileType} onClose={() => setPreviewDoc(null)} />}
      <DocumentShareModal isOpen={!!shareDoc} onClose={() => setShareDoc(null)} document={shareDoc} />

      {/* Tag Selector Modal */}
      <TagSelectorModal
        isOpen={showTagSelector}
        onClose={() => setShowTagSelector(false)}
        availableTags={availableTags}
        selectedCount={selectedDocs.size}
        onConfirm={handleBulkAddTags}
      />

      {/* New Document Modal */}
      {showNewDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} onClick={() => setShowNewDocModal(false)} />
          <div className="relative w-full max-w-[700px] rounded-xl shadow-2xl" style={{ background: '#fff', border: '1px solid #e5e7eb', maxHeight: '90vh', overflow: 'hidden' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #e5e7eb' }}>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" style={{ color: '#4169FF' }} />
                <span style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>Create New Document</span>
              </div>
              <button onClick={() => setShowNewDocModal(false)} style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
              {/* Project Selection */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>
                  Project (Optional)
                </label>
                <select
                  value={projectFilter}
                  onChange={(e) => updateFilter('project', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 32px 10px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    fontSize: 14,
                    background: '#fff',
                    cursor: 'pointer',
                    appearance: 'none' as const,
                    backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 5L6 8L9 5' stroke='%236B7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 10px center',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#4169FF'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                >
                  <option value="">All Documents (No specific project)</option>
                  {projects.map((p: Project) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                  Leave as "All Documents" to create without a project, or select a project to organize your document.
                </p>
              </div>

              {/* Show selected location if project/folder is chosen */}
              {projectFilter && (
                <div className="flex items-center gap-3 rounded-lg" style={{ padding: '12px 16px', background: '#EEF2FF', border: '1px solid #c7d2fe' }}>
                  <Folder className="w-5 h-5 flex-shrink-0" style={{ color: '#4169FF' }} />
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Saving to</p>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#4169FF' }}>
                      {selectedTreeFolderId && selectedTreeFolderName
                        ? `${currentProjectName} / ${selectedTreeFolderName}`
                        : currentProjectName}
                    </p>
                  </div>
                </div>
              )}

              {/* Document Name */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>
                  Document Name *
                </label>
                <input
                  type="text"
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                  placeholder="Enter document name"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    fontSize: 14,
                    outline: 'none'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#4169FF'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                />
              </div>

              {/* Content */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>
                  Content
                </label>
                <textarea
                  value={newDocContent}
                  onChange={(e) => setNewDocContent(e.target.value)}
                  placeholder="Type or paste your content here..."
                  style={{
                    width: '100%',
                    minHeight: 200,
                    padding: '12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    fontSize: 14,
                    fontFamily: 'Monaco, Courier New, monospace',
                    resize: 'vertical',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#4169FF'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                />
              </div>

              {/* Format Selector */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>
                  Select Format
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 12 }}>
                  {['txt', 'pdf', 'docx', 'xlsx', 'md', 'json'].map((format) => (
                    <div
                      key={format}
                      onClick={() => setNewDocFormat(format)}
                      style={{
                        padding: 16,
                        border: `2px solid ${newDocFormat === format ? '#4169FF' : '#e5e7eb'}`,
                        borderRadius: 8,
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: newDocFormat === format ? '#EEF2FF' : 'transparent',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ fontSize: 24, marginBottom: 8 }}>
                        {format === 'txt' && '📄'}
                        {format === 'pdf' && '📕'}
                        {format === 'docx' && '📘'}
                        {format === 'xlsx' && '📊'}
                        {format === 'md' && '📝'}
                        {format === 'json' && '🔧'}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#666' }}>
                        .{format}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Format */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>
                  Or Type Custom Format
                </label>
                <input
                  type="text"
                  value={customFormat}
                  onChange={(e) => setCustomFormat(e.target.value)}
                  placeholder="e.g., csv, html, xml"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    fontSize: 14,
                    outline: 'none'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#4169FF'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid #e5e7eb' }}>
              <button
                onClick={() => {
                  setShowNewDocModal(false);
                  setNewDocName('');
                  setNewDocContent('');
                  setNewDocFormat('txt');
                  setCustomFormat('');
                }}
                className="rounded-lg"
                style={{
                  padding: '8px 20px',
                  border: '1px solid #e5e7eb',
                  background: '#fff',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  color: '#1a1a1a'
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newDocName) {
                    alert('Please enter a document name');
                    return;
                  }

                  try {
                    const format = customFormat || newDocFormat;
                    const fullName = newDocName.includes('.') ? newDocName : `${newDocName}.${format}`;

                    // Create a File object from the content
                    const blob = new Blob([newDocContent], { type: 'text/plain' });
                    const file = new File([blob], fullName, { type: 'text/plain' });

                    // Determine which project to use
                    // If projectFilter is set, use it; otherwise, we need a default project
                    let targetProjectId = projectFilter ? Number(projectFilter) : null;

                    // If no project selected and user is in "All Documents", use the first available project
                    // OR your backend should handle documents without a project
                    if (!targetProjectId && projects.length > 0) {
                      // Option 1: Use first project as default
                      targetProjectId = projects[0].id;

                      // Option 2: If your backend supports null project_id, remove this line
                      // and pass null to the API
                    }

                    if (!targetProjectId) {
                      alert('No projects available. Please create a project first.');
                      return;
                    }

                    // Step 1: Get upload URL from backend
                    const uploadUrlResponse = await documentsApi.getUploadUrl(targetProjectId, {
                      file_name: fullName,
                      file_type: file.type || 'application/octet-stream'
                    });

                    const { url: s3Url, fields: s3Fields, file_key } = uploadUrlResponse;

                    // Step 2: Upload to S3
                    await documentsApi.uploadFileToS3(s3Url, s3Fields, file);

                    // Step 3: Confirm upload with backend
                    const getFileTypeFromExt = (name: string): string => {
                      const ext = name.split('.').pop()?.toLowerCase() || '';
                      if (ext === 'pdf') return 'pdf';
                      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
                      if (['mp4', 'mov', 'avi'].includes(ext)) return 'video';
                      if (ext === 'json') return 'json';
                      if (['txt', 'md', 'csv'].includes(ext)) return 'text';
                      return 'other';
                    };

                    await documentsApi.confirmUpload(targetProjectId, {
                      file_key,
                      file_name: fullName,
                      file_type: getFileTypeFromExt(fullName),
                      ...(selectedTreeFolderId ? { folder: selectedTreeFolderId } : {}),
                    } as any);

                    // Success! Refresh the documents list
                    queryClient.invalidateQueries({ queryKey: ['documents'] });
                    queryClient.invalidateQueries({ queryKey: ['document-folders'] });

                    // Close modal and reset
                    setShowNewDocModal(false);
                    setNewDocName('');
                    setNewDocContent('');
                    setNewDocFormat('txt');
                    setCustomFormat('');

                  } catch (error: any) {
                    console.error('Create document failed:', error);
                    alert(error.response?.data?.detail || error.message || 'Failed to create document.');
                  }
                }}
                disabled={!newDocName}
                className="rounded-lg flex items-center gap-2"
                style={{
                  padding: '8px 20px',
                  background: !newDocName ? '#a5b4fc' : '#4169FF',
                  color: '#fff',
                  border: 'none',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: !newDocName ? 'not-allowed' : 'pointer'
                }}
              >
                <Plus className="w-4 h-4" /> Create Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}