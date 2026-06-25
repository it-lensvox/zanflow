import React, { useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams, useOutletContext } from 'react-router-dom';
import { FileText, Search, X, Upload, Plus, Folder, ChevronDown, Check } from 'lucide-react';
import { TreePanel } from './components/TreePanel';
import { getTypeHex } from '@/pages/Project/projectConstants';
import type { TreeFolder } from './components/TreePanel';
import { ActiveFiltersBar } from './components/ActiveFiltersBar';
import { DocumentsBulkToolbar } from './components/DocumentsBulkActions';
import { SidePreviewPanel } from './components/SidePreviewPanel';
import { DocumentInfoPanel } from './components/DocumentInfoPanel';
import { ConfirmationModal } from './components/ConfirmationModal';
import { UploadDocumentModal } from './components/UploadDocumentModal';
import { TagSelectorModal } from './components/TagSelectorModal';
import { MoveConfirmationModal } from './components/MoveConfirmationModal';
import { Toast } from './components/Toast';
import { TreeDocumentView } from './components/TreeDocumentView';
import { API_URL } from '@/services/api';
import { Button } from '@/components/common';
import { documentsApi, projectsApi } from '@/services/api';
import type { Document, Project, DocumentStatus, Label } from '@/types';
import { DualView, useViewMode, ViewToggle } from '@/components/layout/DualView';
import type { TableColumn } from '@/components/layout/DualView';
import { Pagination } from '@/components/ui/Pagination';
import { createDocumentsTableColumns, DocumentGridCard } from '@/components/layout/DualView/documentsConfig';
import { NotificationsPage } from '../NotificationsPage';
import { DocumentPreview } from '@/components/common/DocumentPreview';
import { DocumentShareModal } from '@/pages/Documents/DocumentShareModal';

// ─── Design tokens 
const TEXT = '#172033';
const MUTED = '#667085';
const LINE = '#e6ebf2';
const BLUE = '#4169FF';

// ─── Static config 
const FILE_TYPE_OPTIONS = [
  { value: '',      label: 'All Types', ext: '',     color: '' },
  { value: 'pdf',   label: 'PDF',       ext: 'PDF',  color: '#EF4444' },
  { value: 'image', label: 'Image',     ext: 'IMG',  color: '#7C3AED' },
  { value: 'json',  label: 'JSON',      ext: 'JSON', color: '#F59E0B' },
  { value: 'text',  label: 'Text',      ext: 'TXT',  color: '#2563EB' },
];

export function Documents() {
  const queryClient = useQueryClient();
  const { isActivityOpen, setIsActivityOpen } = useOutletContext<{ isActivityOpen: boolean; setIsActivityOpen: (o: boolean) => void }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── URL params 
  const projectFilter = searchParams.get('project') || '';
  const statusFilter = searchParams.get('status') || '';
  const fileTypeFilter = searchParams.get('file_type') || '';
  const highlightDocId = searchParams.get('highlight') || '';
  const sharedParam = searchParams.get('shared') === 'true';
  const [activeHighlightId, setActiveHighlightId] = React.useState(highlightDocId);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; fileName: string; fileType: string } | null>(null);
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [infoDoc, setInfoDoc] = useState<Document | null>(null);
  const [shareDoc, setShareDoc] = useState<Document | null>(null);
  const [selectedFolder, setSelectedFolder] = useState('All Documents');
  const [selectedTreeFolderId, setSelectedTreeFolderId] = useState<string | null>(null);
  const [selectedTreeFolderName, setSelectedTreeFolderName] = useState<string | null>(null);
  const [showSharedWithMe, setShowSharedWithMe] = useState(false);
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
  const [moveConfirmModal, setMoveConfirmModal] = useState<{ isOpen: boolean; documentIds: string[]; targetName: string; targetProjectId: number; targetFolderId: string | null } | null>(null);
  const [toast, setToast] = useState<{ isOpen: boolean; type: 'success' | 'error'; message: string } | null>(null);
  const [currentPage,        setCurrentPage]        = useState(1);
  const [sortBy,             setSortBy]             = useState<'updated_at' | 'created_at'>('updated_at');
  const [rowsPerPage,        setRowsPerPage]        = useState(25);
  const [showProjectDrop,    setShowProjectDrop]    = useState(false);
  const [showTypeDrop,       setShowTypeDrop]       = useState(false);
  const { viewMode, setViewMode } = useViewMode({ defaultMode: 'table' });

  React.useEffect(() => { setCurrentPage(1); }, [projectFilter, fileTypeFilter, searchTerm]);
  React.useEffect(() => { queryClient.invalidateQueries({ queryKey: ['documents'] }); }, []);
  React.useEffect(() => {
    if (!sharedParam) return;
    setShowSharedWithMe(true); setSelectedFolder('Shared With Me'); setSelectedTreeFolderId(null);
    if (highlightDocId) { setActiveHighlightId(highlightDocId); setTimeout(() => setActiveHighlightId(''), 4000); }
    setSearchParams({}, { replace: true });
  }, [sharedParam]);

  // ── Queries 
  const { data: projectsData } = useQuery({ queryKey: ['projects'], queryFn: () => projectsApi.list() });
  const { data: tagsData } = useQuery({
    queryKey: ['labels'],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/documents/labels/`, { credentials: 'include', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Failed to fetch labels: ${res.status}`);
      const data = await res.json(); return data.results || data || [];
    },
    staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true,
  });
  React.useEffect(() => { if (tagsData) setAvailableTags(tagsData); }, [tagsData]);

  const { data: allDocumentsData, isLoading } = useQuery({
    queryKey: ['documents', 'all', projectFilter, fileTypeFilter, currentPage, selectedTreeFolderId, searchTerm],
    queryFn: () => {
      if (searchTerm.trim()) {
        const params: any = { page_size: 500, page: 1, file_type: fileTypeFilter || undefined, status: statusFilter || undefined };
        if (projectFilter) params.project = Number(projectFilter);
        return documentsApi.list(params);
      }
      const params: any = { page: currentPage, file_type: fileTypeFilter || undefined, status: statusFilter || undefined };
      if (selectedTreeFolderId) { params.folder = selectedTreeFolderId; }
      else if (projectFilter) { params.project = Number(projectFilter); params.root_only = true; }
      return documentsApi.list(params);
    },
    enabled: true, placeholderData: keepPreviousData, refetchOnWindowFocus: true, refetchOnMount: 'always', staleTime: 0,
  });

  const { data: allDocumentsForTree } = useQuery({
    queryKey: ['documents-tree-counts'],
    queryFn: () => documentsApi.list({ page_size: 1000 } as any),
    staleTime: 30000,
  });

  const { data: sharedWithMeData } = useQuery({
    queryKey: ['documents-shared-with-me', 1],
    queryFn: () => documentsApi.sharedWithMe({ page: 1 }),
    enabled: showSharedWithMe, staleTime: 0,
  });

  const { data: foldersData } = useQuery({
    queryKey: ['document-folders'],
    queryFn: async () => { const res = await documentsApi.listFolders(); return res.results || res || []; },
    staleTime: 0,
  });

  // ── Derived data 
  const rawProjects = projectsData?.results || projectsData || [];
  const projects = (Array.isArray(rawProjects) ? rawProjects : []) as Project[];
  const sharedWithMeDocs = sharedWithMeData?.results || sharedWithMeData || [];
  const sharedWithMeCount = sharedWithMeData?.count || sharedWithMeDocs.length || 0;
  const allDocs = showSharedWithMe ? sharedWithMeDocs : (allDocumentsData?.results || allDocumentsData || []);
  const allDocsForTree = allDocumentsForTree?.results || allDocumentsForTree || [];
  const totalCount = (allDocumentsData as any)?.count || 0;
  const hasNextPage = !!(allDocumentsData as any)?.next;
  const hasPreviousPage = !!(allDocumentsData as any)?.previous;
  const projectLookup = projects.reduce((acc: Record<number, string>, p: Project) => { acc[p.id] = p.name; return acc; }, {});
  const projectTypeLookup = projects.reduce((acc: Record<number, string>, p: Project) => { acc[p.id] = (p as any).task_type || ''; return acc; }, {});
  const currentProjectName = projectFilter ? projects.find(p => String(p.id) === projectFilter)?.name || projectFilter : '';
  const totalPages = Math.ceil(totalCount / rowsPerPage) || 1;
  const hasActiveFilters = projectFilter || statusFilter || fileTypeFilter || searchTerm;

  const displayedDocuments = (() => {
    const nc: Record<string, number> = {}; const ni: Record<string, number> = {};
    allDocs.forEach((d: Document) => { const b = (d as any).file_name || d.original_file_name || d.name || ''; nc[b] = (nc[b] || 0) + 1; });
    return allDocs.map((d: Document) => {
      const b = (d as any).file_name || d.original_file_name || d.name || ''; let dn = b;
      if (nc[b] > 1) { if (ni[b] === undefined) ni[b] = 0; else ni[b] += 1; if (ni[b] > 0) { const di = b.lastIndexOf('.'); dn = di !== -1 ? `${b.slice(0, di)} (${ni[b]})${b.slice(di)}` : `${b} (${ni[b]})`; } }
      return { ...d, name: dn, project_name: projectLookup[d.project] || d.project_name || 'General', project_task_type: projectTypeLookup[d.project] || '' };
    }).filter((d: Document) => {
      if (statusFilter && d.status !== statusFilter) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matches = (d.name || '').toLowerCase().includes(q) || (d as any).project_name?.toLowerCase().includes(q) || (d.labels || []).some((t: Label) => (t.name || '').toLowerCase().includes(q)) || (d.status || '').toLowerCase().includes(q) || (d as any).uploaded_by_details?.username?.toLowerCase().includes(q) || (d as any).owner?.username?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    }).sort((a: Document, b: Document) => new Date(b[sortBy]).getTime() - new Date(a[sortBy]).getTime());
  })();

  // ── Tree folder structure 
  const backendFolders = (foldersData || []) as { id: string; project: number; parent: string | null; name: string; is_system_generated?: boolean; document_count?: number; created_at: string }[];
  const treeFolders: TreeFolder[] = (() => {
    const projectChildren: TreeFolder[] = projects.map(p => {
      const taskType = (p as any).task_type || '';
      const buildChildren = (parentId: string, projectId: number): TreeFolder[] =>
        backendFolders.filter(f => f.parent === parentId).map(f => ({ id: f.id, name: f.name, count: f.document_count ?? 0, folderCount: backendFolders.filter(sub => sub.parent === f.id).length, projectId, isSystemGenerated: f.is_system_generated || false, taskType, children: buildChildren(f.id, projectId) }));
      const projectFolders = backendFolders.filter(f => f.project === p.id && f.parent === null).map(f => ({ id: f.id, name: f.name, count: f.document_count ?? 0, folderCount: backendFolders.filter(sub => sub.parent === f.id).length, projectId: p.id, isSystemGenerated: f.is_system_generated || false, taskType, children: buildChildren(f.id, p.id) }));
      const projectDocCount = (p as any).document_count ?? allDocsForTree.filter((doc: Document) => doc.project === p.id && !doc.folder).length;
      return { id: undefined, name: p.name, count: projectDocCount, folderCount: projectFolders.length, projectId: p.id, taskType, children: projectFolders };
    });
    return [{ name: 'All Documents', count: projectChildren.reduce((s, p) => s + p.count, 0), folderCount: projectChildren.length, children: projectChildren }];
  })();

  // ── Handlers 
  const updateFilter = (k: string, v: string) => { const n = new URLSearchParams(searchParams); if (v) n.set(k, v); else n.delete(k); setSearchParams(n); };
  const clearFilters = () => { setSearchParams({}); setSearchTerm(''); setCurrentPage(1); };
  const removeFilter = (k: string) => { if (k === 'search') setSearchTerm(''); else updateFilter(k, ''); };
  const handleDeleteClick = (e: React.MouseEvent, doc: Document) => { e.stopPropagation(); setDeleteConfirm({ id: doc.id, name: doc.name }); };
  const toggleSelect = (id: string) => setSelectedDocs(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = () => { if (selectedDocs.size === displayedDocuments.length) setSelectedDocs(new Set()); else setSelectedDocs(new Set(displayedDocuments.map((d: Document) => d.id))); };

  const handleBulkDelete = async () => { for (const id of Array.from(selectedDocs)) { try { await documentsApi.delete(id); } catch (e) { console.error(e); } } setSelectedDocs(new Set()); setBulkDeleteConfirm(false); queryClient.invalidateQueries({ queryKey: ['documents'] }); };
  const handleBulkChangeStatus = async (newStatus: DocumentStatus) => { for (const id of Array.from(selectedDocs)) { try { await documentsApi.updateStatus(id, newStatus); } catch (e) { console.error(e); } } setSelectedDocs(new Set()); queryClient.invalidateQueries({ queryKey: ['documents'] }); };
  const handleBulkShare = () => { const firstId = Array.from(selectedDocs)[0]; if (firstId) { const doc = displayedDocuments.find((d: Document) => d.id === firstId); if (doc) setShareDoc(doc); } };
  const handleBulkMove = async (targetProjectId: number) => { for (const id of Array.from(selectedDocs)) { try { await documentsApi.update(id, { project: targetProjectId } as any); } catch (e) { console.error(e); } } setSelectedDocs(new Set()); queryClient.invalidateQueries({ queryKey: ['documents'] }); };
  const handleBulkAddTags = async (tagIds: number[]) => {
    if (tagIds.length === 0 || selectedDocs.size === 0) return;
    try {
      const token = localStorage.getItem('access_token'); const workspaceId = localStorage.getItem('active_workspace_id');
      const res = await fetch(`${API_URL}/documents/bulk-add-labels/`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'X-Workspace-ID': workspaceId || '' }, body: JSON.stringify({ document_ids: Array.from(selectedDocs), label_ids: tagIds }) });
      if (!res.ok) { const err = await res.text().then(t => t ? JSON.parse(t) : {}); throw new Error(err.error || err.detail || 'Failed to add tags'); }
      setShowTagSelector(false); setSelectedDocs(new Set());
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['documents-tree-counts'] });
    } catch (error: any) { alert(error.message || 'Failed to add tags. Please try again.'); }
  };
  const handleDocumentClick = async (doc: Document) => {
    setSidebarDoc(doc); setSidebarPreviewUrl(null);
    try { const r = await documentsApi.getDownloadUrl(doc.project, { document_id: doc.id }); setSidebarPreviewUrl(r.url); } catch (e) { console.error(e); }
  };
  const handleOpenFullPreview = () => { if (sidebarDoc && sidebarPreviewUrl) setPreviewDoc({ url: sidebarPreviewUrl, fileName: sidebarDoc.original_file_name || sidebarDoc.name, fileType: sidebarDoc.file_type }); };
  const handleCreateFolder = async (projectId: number, parentId: string | null, folderName: string) => {
    try { await documentsApi.createFolder({ project: projectId, name: folderName, parent: parentId }); await queryClient.invalidateQueries({ queryKey: ['document-folders'] }); await queryClient.invalidateQueries({ queryKey: ['documents'] }); await queryClient.invalidateQueries({ queryKey: ['projects'] }); }
    catch (e: any) { alert(e.response?.data?.detail || e.response?.data?.name?.[0] || 'Failed to create folder'); }
  };
  const handleRenameFolder = async (folderId: string, newName: string) => {
    try { await documentsApi.renameFolder(folderId, newName); queryClient.invalidateQueries({ queryKey: ['document-folders'] }); queryClient.invalidateQueries({ queryKey: ['documents'] }); }
    catch (e: any) { alert(e.response?.data?.detail || 'Failed to rename folder'); }
  };

  // ── Table columns 
  const baseColumns = createDocumentsTableColumns({ onDeleteClick: handleDeleteClick, onInfoClick: (d: Document) => setInfoDoc(d), onShareClick: (d: Document) => setShareDoc(d) });
  const checkboxColumn: TableColumn<Document> = {
    key: '_select' as any,
    label: <input type="checkbox" checked={selectedDocs.size === displayedDocuments.length && displayedDocuments.length > 0} onChange={toggleSelectAll} style={{ accentColor: BLUE, width: 18, height: 18, cursor: 'pointer' }} />,
    render: (doc: Document) => <input type="checkbox" checked={selectedDocs.has(doc.id)} onChange={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); toggleSelect(doc.id); }} style={{ accentColor: BLUE, width: 18, height: 18, cursor: 'pointer' }} />,
    width: '40px',
  };
  const columnsWithCheckbox = [checkboxColumn, ...baseColumns];

  const emptyState = (
    <div className="flex flex-col items-center justify-center py-12">
      <FileText className="h-12 w-12 mb-4" style={{ color: MUTED }} />
      <h3 style={{ fontSize: 18, fontWeight: 500, color: TEXT }}>No documents found</h3>
      <p style={{ color: MUTED, marginBottom: 16 }}>{hasActiveFilters ? 'Try adjusting your filters' : 'Create your first document to get started'}</p>
      {hasActiveFilters && <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>}
    </div>
  );

  return (
    <div className="flex w-full h-full min-h-0">
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden" style={{ background: '#fff' }}>

        {/* ── TOPBAR (matches Project page design exactly) ── */}
        <div className="flex-shrink-0 px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40" style={{ background: '#fff', borderBottom: `1px solid ${LINE}`, paddingTop: 16, paddingBottom: 16 }}>

          {/* Title row */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
            <div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: TEXT, letterSpacing: '-.02em' }}>Documents</h1>
              <p style={{ margin: '4px 0 0', fontSize: 16, color: MUTED }}>Manage all your documents across projects</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap" style={{ paddingTop: 4 }}>
              <button onClick={() => setShowUploadModal(true)} style={{ height: 40, display: 'flex', alignItems: 'center', gap: 8, padding: '0 18px', border: `1px solid ${LINE}`, borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 600, color: TEXT, whiteSpace: 'nowrap' }}>
                <Upload size={15} /> Upload
              </button>
              <button onClick={() => setShowNewDocModal(true)} style={{ height: 40, display: 'flex', alignItems: 'center', gap: 8, padding: '0 20px', border: 'none', borderRadius: 8, background: BLUE, cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                <Plus size={15} /> New Document
              </button>
              <ViewToggle viewMode={viewMode} onViewModeChange={v => setViewMode(v as any)} modes={['table', 'grid', 'tree']} showLabels={false} />
            </div>
          </div>

          {/* Controls row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search */}
            <div style={{ flex: '0 0 65%', height: 40, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 8, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10, position: 'relative' }}>
              <Search size={16} color={MUTED} style={{ flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search documents by name, content, tags, or owner..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 16, color: TEXT, background: 'transparent', fontFamily: 'inherit', minWidth: 0 }}
              />
              <span style={{ background: '#f5f7fb', border: `1px solid ${LINE}`, borderRadius: 5, padding: '2px 8px', fontSize: 12, fontWeight: 700, color: MUTED, flexShrink: 0 }}>⌘ K</span>
            </div>

            {/* Project filter — custom dropdown matching Projects page */}
            <div style={{ position: 'relative', flex: 1, flexShrink: 0 }}>
              {showProjectDrop && <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setShowProjectDrop(false)} />}
              <button
                onClick={() => { setShowProjectDrop(v => !v); setShowTypeDrop(false); }}
                style={{ height: 40, width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', border: `1px solid ${showProjectDrop ? BLUE : LINE}`, borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 500, color: projectFilter ? TEXT : MUTED, whiteSpace: 'nowrap', fontFamily: 'inherit' }}
              >
                <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {projectFilter ? projects.find(p => String(p.id) === projectFilter)?.name || 'All Projects' : 'All Projects'}
                </span>
                <ChevronDown size={14} color={MUTED} style={{ flexShrink: 0, transition: 'transform 0.2s', transform: showProjectDrop ? 'rotate(180deg)' : 'none' }} />
              </button>
              {showProjectDrop && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(16,24,40,.12)', overflow: 'hidden', padding: '4px 0', maxHeight: 260, overflowY: 'auto' }}>
                  <button onClick={() => { updateFilter('project', ''); setShowProjectDrop(false); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: 'none', background: !projectFilter ? '#EEF4FF' : 'transparent', cursor: 'pointer', fontSize: 16, fontWeight: !projectFilter ? 700 : 500, color: !projectFilter ? BLUE : TEXT, textAlign: 'left', fontFamily: 'inherit' }}
                    onMouseEnter={e => { if (projectFilter) e.currentTarget.style.background = '#F7F8FB'; }}
                    onMouseLeave={e => { if (projectFilter) e.currentTarget.style.background = 'transparent'; }}>
                    <span style={{ flex: 1 }}>All Projects</span>
                    {!projectFilter && <Check size={14} color={BLUE} />}
                  </button>
                  {projects.map((p: Project) => {
                    const typeHex = getTypeHex((p as any).task_type);
                    const isActive = projectFilter === String(p.id);
                    return (
                      <button key={p.id} onClick={() => { updateFilter('project', String(p.id)); setShowProjectDrop(false); }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: 'none', background: isActive ? '#EEF4FF' : 'transparent', cursor: 'pointer', fontSize: 16, fontWeight: isActive ? 700 : 500, color: isActive ? BLUE : TEXT, textAlign: 'left', fontFamily: 'inherit' }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#F7F8FB'; }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: typeHex, flexShrink: 0 }} />
                        <span style={{ flex: 1 }}>{p.name}</span>
                        {isActive && <Check size={14} color={BLUE} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* File type filter — custom dropdown matching Projects page */}
            <div style={{ position: 'relative', flex: 1, flexShrink: 0 }}>
              {showTypeDrop && <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setShowTypeDrop(false)} />}
              <button
                onClick={() => { setShowTypeDrop(v => !v); setShowProjectDrop(false); }}
                style={{ height: 40, width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', border: `1px solid ${showTypeDrop ? BLUE : LINE}`, borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 500, color: fileTypeFilter ? TEXT : MUTED, whiteSpace: 'nowrap', fontFamily: 'inherit' }}
              >
                <span style={{ flex: 1, textAlign: 'left' }}>
                  {fileTypeFilter ? FILE_TYPE_OPTIONS.find(o => o.value === fileTypeFilter)?.label || 'All Types' : 'All Types'}
                </span>
                <ChevronDown size={14} color={MUTED} style={{ flexShrink: 0, transition: 'transform 0.2s', transform: showTypeDrop ? 'rotate(180deg)' : 'none' }} />
              </button>
              {showTypeDrop && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(16,24,40,.12)', overflow: 'hidden', padding: '4px 0' }}>
                  {FILE_TYPE_OPTIONS.map(o => {
                    const isActive = fileTypeFilter === o.value;
                    return (
                      <button key={o.value} onClick={() => { updateFilter('file_type', o.value); setShowTypeDrop(false); }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: 'none', background: isActive ? '#EEF4FF' : 'transparent', cursor: 'pointer', fontSize: 16, fontWeight: isActive ? 700 : 500, color: isActive ? BLUE : TEXT, textAlign: 'left', fontFamily: 'inherit' }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#F7F8FB'; }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                        {o.color ? (
                          <div style={{ width: 28, height: 20, borderRadius: 4, background: `${o.color}18`, border: `1px solid ${o.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: 8, fontWeight: 700, color: o.color, letterSpacing: '.03em', lineHeight: 1 }}>{o.ext}</span>
                          </div>
                        ) : (
                          <span style={{ width: 28 }} />
                        )}
                        <span style={{ flex: 1 }}>{o.label}</span>
                        {isActive && <Check size={14} color={BLUE} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Active filter chips ── */}
        <ActiveFiltersBar
          projectFilter={projectFilter} projectName={currentProjectName}
          statusFilter={statusFilter} fileTypeFilter={fileTypeFilter}
          searchTerm={searchTerm}
          ownerFilter={searchParams.get('owner') || ''} ownerName={searchParams.get('owner_name') || ''}
          onClearAll={clearFilters} onRemoveFilter={removeFilter}
        />

        {/* ── Workspace: tree + content ── */}
        <div className="flex-1 flex overflow-hidden px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40" style={{ background: '#fff' }}>

          {/* ── Tree sidebar ── */}
          <TreePanel
            folders={treeFolders}
            showSharedWithMe={showSharedWithMe}
            setShowSharedWithMe={setShowSharedWithMe}
            setSelectedFolder={setSelectedFolder}
            setSelectedTreeFolderId={setSelectedTreeFolderId}
            sharedWithMeCount={sharedWithMeCount}
            onFolderClick={(name, folderId, folderProjectId) => {
              setShowSharedWithMe(false);
              const pr = projects.find(p => p.name === name);
              if (pr) { updateFilter('project', String(pr.id)); setSelectedFolder(name); setSelectedTreeFolderId(null); setSelectedTreeFolderName(null); }
              else if (name === 'All Documents') { updateFilter('project', ''); setSelectedFolder('All Documents'); setSelectedTreeFolderId(null); setSelectedTreeFolderName(null); }
              else if (folderId) { if (folderProjectId) updateFilter('project', String(folderProjectId)); setSelectedFolder(name); setSelectedTreeFolderId(folderId); setSelectedTreeFolderName(name); }
            }}
            selectedFolder={selectedFolder} selectedFolderId={selectedTreeFolderId}
            isOpen={isTreeOpen} onToggle={() => setIsTreeOpen(p => !p)}
            onCreateFolder={handleCreateFolder} onRenameFolder={handleRenameFolder}
            onDeleteFolder={async (folderId) => {
              try { await documentsApi.deleteFolder(folderId); queryClient.invalidateQueries({ queryKey: ['document-folders'] }); queryClient.invalidateQueries({ queryKey: ['documents'] }); queryClient.invalidateQueries({ queryKey: ['documents-tree-counts'] }); setToast({ isOpen: true, type: 'success', message: 'Folder deleted successfully' }); }
              catch (error: any) { setToast({ isOpen: true, type: 'error', message: error?.response?.status === 403 ? 'Cannot delete system folders.' : 'Failed to delete folder. Please try again.' }); }
            }}
            setMoveConfirmModal={setMoveConfirmModal} setToast={setToast}
          />

          {/* ── Main content ── */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Bulk toolbar */}
            <DocumentsBulkToolbar
              selectedCount={selectedDocs.size} onClear={() => setSelectedDocs(new Set())}
              onDeleteSelected={() => setBulkDeleteConfirm(true)} onChangeStatus={handleBulkChangeStatus}
              onShare={handleBulkShare} onMove={handleBulkMove}
              onAddTags={() => setShowTagSelector(true)} projects={projects}
            />

            <div className="flex-1 overflow-auto">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center min-h-[50vh] w-full">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary mb-4" />
                  <p style={{ fontSize: 16, fontWeight: 500, color: MUTED }} className="animate-pulse">Loading documents...</p>
                </div>
              ) : viewMode === 'tree' ? (
                <TreeDocumentView documents={allDocs} projects={projects} onDocumentClick={handleDocumentClick} />
              ) : (
                <DualView
                  viewMode={viewMode} isLoading={isLoading}
                  gridProps={{
                    data: displayedDocuments,
                    gridClassName: 'document-grid',
                    renderCard: (doc) => (
                      <div onClick={() => handleDocumentClick(doc)} className="cursor-pointer">
                        <DocumentGridCard
                          key={doc.id}
                          document={doc}
                          projectTaskType={(doc as any).project_task_type || ''}
                          onDeleteClick={(e) => { e.stopPropagation(); handleDeleteClick(e, doc); }}
                          onShareClick={(d: Document) => setShareDoc(d)}
                        />
                      </div>
                    ),
                    emptyState,
                  }}
                  tableProps={{
                    data: displayedDocuments, columns: columnsWithCheckbox,
                    rowKey: (d: Document) => d.id, onRowClick: (d: Document) => handleDocumentClick(d),
                    emptyState,
                    rowProps: (doc: Document) => ({
                      draggable: true,
                      className: selectedDocs.has(doc.id) ? 'cursor-grab active:cursor-grabbing' : '',
                      style: { opacity: selectedDocs.has(doc.id) ? 0.95 : 1, background: activeHighlightId === doc.id ? '#FEF9C3' : undefined },
                      onDragStart: (e: React.DragEvent) => {
                        const ids = selectedDocs.has(doc.id) ? Array.from(selectedDocs) : [doc.id];
                        e.dataTransfer.setData('documentIds', JSON.stringify(ids));
                        e.dataTransfer.effectAllowed = 'move';
                      },
                    }),
                  }}
                />
              )}
            </div>

            {/* Pagination */}
            {totalCount > 0 && (
              <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalCount} pageSize={rowsPerPage} onPageChange={setCurrentPage} itemLabel="documents" />
            )}
          </div>

          {/* Side preview panel */}
          {sidebarDoc && (
            <SidePreviewPanel doc={sidebarDoc} previewUrl={sidebarPreviewUrl} onClose={() => { setSidebarDoc(null); setSidebarPreviewUrl(null); }} onOpenFull={handleOpenFullPreview} />
          )}
        </div>
      </div>

      {/* ── Grid responsive CSS ── */}
      <style>{`
        .document-grid { display: grid; gap: 16px; padding: 20px; grid-template-columns: repeat(1, 1fr); }
        @media (min-width: 480px)  { .document-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 860px)  { .document-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 1200px) { .document-grid { grid-template-columns: repeat(4, 1fr); } }
      `}</style>

      {/* ── MODALS ── */}
      <UploadDocumentModal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} projectId={projectFilter ? Number(projectFilter) : null} projectName={currentProjectName || 'No project selected'} folderId={selectedTreeFolderId} folderName={selectedTreeFolderName} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['documents'] }); queryClient.invalidateQueries({ queryKey: ['document-folders'] }); }} />
      <ConfirmationModal isOpen={!!deleteConfirm} title={`Are you sure you want to delete "${deleteConfirm?.name}"?`} onClose={() => setDeleteConfirm(null)} onConfirm={async () => { if (deleteConfirm) { try { await documentsApi.delete(deleteConfirm.id); setDeleteConfirm(null); queryClient.invalidateQueries({ queryKey: ['documents'] }); } catch (e) { console.error(e); } } }} />
      <ConfirmationModal isOpen={bulkDeleteConfirm} title={`Are you sure you want to delete ${selectedDocs.size} selected document(s)?`} onClose={() => setBulkDeleteConfirm(false)} onConfirm={handleBulkDelete} />
      {isActivityOpen && <NotificationsPage onClose={() => setIsActivityOpen(false)} defaultFilter="unread" />}
      <DocumentInfoPanel doc={infoDoc} onClose={() => setInfoDoc(null)} />
      {previewDoc && <DocumentPreview url={previewDoc.url} fileName={previewDoc.fileName} fileType={previewDoc.fileType} onClose={() => setPreviewDoc(null)} />}
      <DocumentShareModal isOpen={!!shareDoc} onClose={() => setShareDoc(null)} document={shareDoc} />

      {moveConfirmModal && (
        <MoveConfirmationModal
          isOpen={moveConfirmModal.isOpen}
          onClose={() => setMoveConfirmModal(null)}
          documentCount={moveConfirmModal.documentIds.length}
          targetName={moveConfirmModal.targetName}
          isMoving={false}
          onConfirm={async () => {
            const refreshAll = async () => {
              setSelectedDocs(new Set()); setSelectedTreeFolderId(null); setSelectedTreeFolderName(null); setSelectedFolder('All Documents');
              await queryClient.invalidateQueries({ queryKey: ['documents'] });
              await queryClient.invalidateQueries({ queryKey: ['document-folders'] });
              await queryClient.invalidateQueries({ queryKey: ['documents-tree-counts'] });
              await queryClient.refetchQueries({ queryKey: ['documents-tree-counts'] });
            };
            try {
              for (const docId of moveConfirmModal.documentIds) await documentsApi.update(docId, { project: moveConfirmModal.targetProjectId, folder: moveConfirmModal.targetFolderId || null } as any);
              await refreshAll(); setMoveConfirmModal(null);
              setToast({ isOpen: true, type: 'success', message: `Successfully moved ${moveConfirmModal.documentIds.length} document${moveConfirmModal.documentIds.length > 1 ? 's' : ''} to "${moveConfirmModal.targetName}"` });
            } catch (error: any) {
              await refreshAll(); setMoveConfirmModal(null);
              const s = error.response?.status; const detail = error.response?.data?.detail || '';
              const msg = s === 404 || detail.toLowerCase().includes('no document') ? 'Document not found — it may have already been moved.' : s === 403 ? 'You do not have permission to move this document.' : detail || 'Failed to move documents. Please try again.';
              setToast({ isOpen: true, type: 'error', message: msg });
            }
          }}
        />
      )}

      <TagSelectorModal isOpen={showTagSelector} onClose={() => setShowTagSelector(false)} availableTags={availableTags} selectedCount={selectedDocs.size} onConfirm={handleBulkAddTags} projects={projects} />

      {/* New Document Modal */}
      {showNewDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} onClick={() => setShowNewDocModal(false)} />
          <div className="relative w-full max-w-[700px] rounded-xl shadow-2xl" style={{ background: '#fff', border: '1px solid #e5e7eb', maxHeight: '90vh', overflow: 'hidden' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #e5e7eb' }}>
              <div className="flex items-center gap-2"><FileText className="w-5 h-5" style={{ color: BLUE }} /><span style={{ fontSize: 16, fontWeight: 600, color: TEXT }}>Create New Document</span></div>
              <button onClick={() => setShowNewDocModal(false)} style={{ color: MUTED, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 8 }}>Project (Optional)</label>
                <select value={projectFilter} onChange={e => updateFilter('project', e.target.value)} style={{ width: '100%', padding: '10px 32px 10px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14, background: '#fff', cursor: 'pointer', appearance: 'none' as const, backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 5L6 8L9 5' stroke='%236B7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', outline: 'none' }}>
                  <option value="">All Documents (No specific project)</option>
                  {projects.map((p: Project) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <p style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>Leave as "All Documents" to create without a project, or select a project to organize your document.</p>
              </div>
              {projectFilter && (
                <div className="flex items-center gap-3 rounded-lg" style={{ padding: '12px 16px', background: '#EEF2FF', border: '1px solid #c7d2fe' }}>
                  <Folder className="w-5 h-5 flex-shrink-0" style={{ color: BLUE }} />
                  <div><p style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Saving to</p><p style={{ fontSize: 14, fontWeight: 600, color: BLUE }}>{selectedTreeFolderId && selectedTreeFolderName ? `${currentProjectName} / ${selectedTreeFolderName}` : currentProjectName}</p></div>
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 8 }}>Document Name *</label>
                <input type="text" value={newDocName} onChange={e => setNewDocName(e.target.value)} placeholder="Enter document name" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14, outline: 'none' }} onFocus={e => e.currentTarget.style.borderColor = BLUE} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 8 }}>Content</label>
                <textarea value={newDocContent} onChange={e => setNewDocContent(e.target.value)} placeholder="Type or paste your content here..." style={{ width: '100%', minHeight: 200, padding: '12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14, fontFamily: 'Monaco, Courier New, monospace', resize: 'vertical', outline: 'none' }} onFocus={e => e.currentTarget.style.borderColor = BLUE} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 8 }}>Select Format</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 12 }}>
                  {['txt', 'pdf', 'docx', 'xlsx', 'md', 'json'].map(format => (
                    <div key={format} onClick={() => setNewDocFormat(format)} style={{ padding: 16, border: `2px solid ${newDocFormat === format ? BLUE : '#e5e7eb'}`, borderRadius: 8, textAlign: 'center' as const, cursor: 'pointer', background: newDocFormat === format ? '#EEF2FF' : 'transparent', transition: 'all 0.2s' }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>{format === 'txt' ? '📄' : format === 'pdf' ? '📕' : format === 'docx' ? '📘' : format === 'xlsx' ? '📊' : format === 'md' ? '📝' : '🔧'}</div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#666' }}>.{format}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 8 }}>Or Type Custom Format</label>
                <input type="text" value={customFormat} onChange={e => setCustomFormat(e.target.value)} placeholder="e.g., csv, html, xml" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14, outline: 'none' }} onFocus={e => e.currentTarget.style.borderColor = BLUE} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid #e5e7eb' }}>
              <button onClick={() => { setShowNewDocModal(false); setNewDocName(''); setNewDocContent(''); setNewDocFormat('txt'); setCustomFormat(''); }} className="rounded-lg" style={{ padding: '8px 20px', border: '1px solid #e5e7eb', background: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', color: TEXT }}>Cancel</button>
              <button disabled={!newDocName} className="rounded-lg flex items-center gap-2" style={{ padding: '8px 20px', background: !newDocName ? '#a5b4fc' : BLUE, color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: !newDocName ? 'not-allowed' : 'pointer' }}
                onClick={async () => {
                  if (!newDocName) { alert('Please enter a document name'); return; }
                  try {
                    const format = customFormat || newDocFormat;
                    const fullName = newDocName.includes('.') ? newDocName : `${newDocName}.${format}`;
                    const file = new File([new Blob([newDocContent], { type: 'text/plain' })], fullName, { type: 'text/plain' });
                    let targetProjectId = projectFilter ? Number(projectFilter) : null;
                    if (!targetProjectId && projects.length > 0) targetProjectId = projects[0].id;
                    if (!targetProjectId) { alert('No projects available. Please create a project first.'); return; }
                    const { url: s3Url, fields: s3Fields, file_key } = await documentsApi.getUploadUrl(targetProjectId, { file_name: fullName, file_type: file.type || 'application/octet-stream' });
                    await documentsApi.uploadFileToS3(s3Url, s3Fields, file);
                    const getFileTypeFromExt = (name: string) => { const ext = name.split('.').pop()?.toLowerCase() || ''; if (ext === 'pdf') return 'pdf'; if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image'; if (['mp4', 'mov', 'avi'].includes(ext)) return 'video'; if (ext === 'json') return 'json'; if (['txt', 'md', 'csv'].includes(ext)) return 'text'; return 'other'; };
                    await documentsApi.confirmUpload(targetProjectId, { file_key, file_name: fullName, file_type: getFileTypeFromExt(fullName), ...(selectedTreeFolderId ? { folder: selectedTreeFolderId } : {}) } as any);
                    queryClient.invalidateQueries({ queryKey: ['documents'] }); queryClient.invalidateQueries({ queryKey: ['document-folders'] });
                    setShowNewDocModal(false); setNewDocName(''); setNewDocContent(''); setNewDocFormat('txt'); setCustomFormat('');
                  } catch (error: any) { alert(error.response?.data?.detail || error.message || 'Failed to create document.'); }
                }}
              >
                <Plus className="w-4 h-4" /> Create Document
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast isOpen={toast.isOpen} type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
}