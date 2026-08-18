import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate, useOutletContext } from 'react-router-dom';
import { keepPreviousData } from '@tanstack/react-query';
import { documentsApi, projectsApi, API_URL } from '@/services/api';
import { useViewMode } from '@/components/layout/DualView';
import { useNotifications } from '@/hooks/useNotifications';
import type { Document, Project, DocumentStatus, Label } from '@/types';
import type { TreeFolder } from '../components/TreePanel';

export function useDocuments() {
  const queryClient  = useQueryClient();
  const navigate     = useNavigate();
  const { unreadCount } = useNotifications();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── UI state
  const [searchTerm,          setSearchTerm]          = useState('');
  const [showFilters,         setShowFilters]         = useState(false);
  const [deleteConfirm,       setDeleteConfirm]       = useState<{ id: string; name: string } | null>(null);
  const [bulkDeleteConfirm,   setBulkDeleteConfirm]   = useState(false);
  const [previewDoc,          setPreviewDoc]          = useState<{ url: string; fileName: string; fileType: string } | null>(null);
  const [showTagSelector,     setShowTagSelector]     = useState(false);
  const [availableTags,       setAvailableTags]       = useState<any[]>([]);
  const [infoDoc,             setInfoDoc]             = useState<Document | null>(null);
  const [shareDoc,            setShareDoc]            = useState<Document | null>(null);
  const [selectedFolder,      setSelectedFolder]      = useState('All Documents');
  const [selectedTreeFolderId,    setSelectedTreeFolderId]    = useState<string | null>(null);
  const [selectedTreeFolderName,  setSelectedTreeFolderName]  = useState<string | null>(null);
  const [showSharedWithMe,    setShowSharedWithMe]    = useState(false);
  const [selectedDocs,        setSelectedDocs]        = useState<Set<string>>(new Set());
  const [isTreeOpen,          setIsTreeOpen]          = useState(true);
  const [showUploadModal,     setShowUploadModal]     = useState(false);
  const [sidebarDoc,          setSidebarDoc]          = useState<Document | null>(null);
  const [sidebarPreviewUrl,   setSidebarPreviewUrl]   = useState<string | null>(null);
  const [showNewDocModal,     setShowNewDocModal]     = useState(false);
  const [newDocName,          setNewDocName]          = useState('');
  const [newDocContent,       setNewDocContent]       = useState('');
  const [newDocFormat,        setNewDocFormat]        = useState('txt');
  const [customFormat,        setCustomFormat]        = useState('');
  const [moveConfirmModal,    setMoveConfirmModal]    = useState<{ isOpen: boolean; documentIds: string[]; targetName: string; targetProjectId: number; targetFolderId: string | null } | null>(null);
  const [toast,               setToast]               = useState<{ isOpen: boolean; type: 'success' | 'error'; message: string } | null>(null);
  const [currentPage,         setCurrentPage]         = useState(1);
  const [sortBy,              setSortBy]              = useState<'updated_at' | 'created_at'>('updated_at');
  const [rowsPerPage,         setRowsPerPage]         = useState(25);

  const { viewMode, setViewMode } = useViewMode({ defaultMode: 'table' });

  // ── URL params 
  const projectFilter  = searchParams.get('project')   || '';
  const statusFilter   = searchParams.get('status')    || '';
  const fileTypeFilter = searchParams.get('file_type') || '';
  const highlightDocId = searchParams.get('highlight') || '';
  const sharedParam    = searchParams.get('shared') === 'true';
  const [activeHighlightId, setActiveHighlightId] = React.useState(highlightDocId);

  React.useEffect(() => { setCurrentPage(1); }, [projectFilter, fileTypeFilter, searchTerm]);
  React.useEffect(() => { queryClient.invalidateQueries({ queryKey: ['documents'] }); }, []);
  React.useEffect(() => {
    if (!sharedParam) return;
    setShowSharedWithMe(true); setSelectedFolder('Shared With Me'); setSelectedTreeFolderId(null);
    if (highlightDocId) { setActiveHighlightId(highlightDocId); setTimeout(() => setActiveHighlightId(''), 4000); }
    setSearchParams({}, { replace: true });
  }, [sharedParam]);

  // ── Outlet context 
  const { isActivityOpen, setIsActivityOpen } = useOutletContext<{ isActivityOpen: boolean; setIsActivityOpen: (o: boolean) => void }>();

  // ── Data queries 
  const { data: projectsData } = useQuery({ queryKey: ['projects'], queryFn: () => projectsApi.list() });

  const { data: tagsData } = useQuery({
    queryKey: ['labels'],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/documents/labels/`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error(`Failed to fetch labels: ${response.status}`);
      const data = await response.json();
      return data.results || data || [];
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
  const projectLookup     = projects.reduce((acc: Record<number, string>, p: Project) => { acc[p.id] = p.name; return acc; }, {});
  const projectTypeLookup = projects.reduce((acc: Record<number, string>, p: Project) => { acc[p.id] = (p as any).task_type || ''; return acc; }, {});
  const currentProjectName = projectFilter ? projects.find(p => String(p.id) === projectFilter)?.name || projectFilter : '';
  const totalPages = Math.ceil(totalCount / rowsPerPage) || 1;
  const hasActiveFilters = projectFilter || statusFilter || fileTypeFilter || searchTerm;

  // ── Displayed documents (filter + sort) 
  const displayedDocuments = (() => {
    const nc: Record<string, number> = {}; const ni: Record<string, number> = {};
    allDocs.forEach((d: Document) => { const b = (d as any).file_name || d.original_file_name || d.name || ''; nc[b] = (nc[b] || 0) + 1; });
    return allDocs.map((d: Document) => {
      const b = (d as any).file_name || d.original_file_name || d.name || ''; let dn = b;
      if (nc[b] > 1) { if (ni[b] === undefined) ni[b] = 0; else ni[b] += 1; if (ni[b] > 0) { const di = b.lastIndexOf('.'); dn = di !== -1 ? `${b.slice(0, di)} (${ni[b]})${b.slice(di)}` : `${b} (${ni[b]})`; } }
      return { ...d, name: dn, project_name: projectLookup[d.project] || d.project_name || 'General' };
    }).filter((d: Document) => {
      if (statusFilter && d.status !== statusFilter) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchesName = (d.name || '').toLowerCase().includes(q);
        const matchesProject = (d as any).project_name?.toLowerCase().includes(q) || (d as any).project_details?.name?.toLowerCase().includes(q);
        const matchesTags = (d.labels || []).some((t: Label) => (t.name || '').toLowerCase().includes(q));
        const matchesStatus = (d.status || '').toLowerCase().includes(q);
        const matchesOwner = (d as any).uploaded_by_details?.username?.toLowerCase().includes(q) || (d as any).uploaded_by_details?.first_name?.toLowerCase().includes(q) || (d as any).uploaded_by_details?.last_name?.toLowerCase().includes(q) || (d as any).owner?.username?.toLowerCase().includes(q);
        const matchesShared = (d as any).shared_with?.some((u: any) => (u.username || u.first_name || '').toLowerCase().includes(q));
        const matchesUpdated = (d.updated_at || '').toLowerCase().includes(q);
        if (!matchesName && !matchesProject && !matchesTags && !matchesStatus && !matchesOwner && !matchesShared && !matchesUpdated) return false;
      }
      return true;
    }).sort((a: Document, b: Document) => new Date(b[sortBy]).getTime() - new Date(a[sortBy]).getTime());
  })();

  // ── Tree folder data 
  const backendFolders = (foldersData || []) as { id: string; project: number; parent: string | null; name: string; is_system_generated?: boolean; document_count?: number; created_at: string }[];
  const treeFolders: TreeFolder[] = (() => {
    const projectChildren: TreeFolder[] = projects.map(p => {
      const buildChildren = (parentId: string, projectId: number): TreeFolder[] =>
        backendFolders.filter(f => f.parent === parentId).map(f => ({
          id: f.id, name: f.name, count: f.document_count ?? 0,
          folderCount: backendFolders.filter(sub => sub.parent === f.id).length,
          projectId, isSystemGenerated: f.is_system_generated || false,
          children: buildChildren(f.id, projectId),
        }));
      const projectFolders = backendFolders.filter(f => f.project === p.id && f.parent === null).map(f => ({
        id: f.id, name: f.name, count: f.document_count ?? 0,
        folderCount: backendFolders.filter(sub => sub.parent === f.id).length,
        projectId: p.id, isSystemGenerated: f.is_system_generated || false,
        children: buildChildren(f.id, p.id),
      }));
      const projectDocCount = (p as any).document_count ?? allDocsForTree.filter((doc: Document) => doc.project === p.id && !doc.folder).length;
      return { id: undefined, name: p.name, count: projectDocCount, folderCount: projectFolders.length, projectId: p.id, children: projectFolders };
    });
    return [{ name: 'All Documents', count: projectChildren.reduce((s, p) => s + p.count, 0), folderCount: projectChildren.length, children: projectChildren }];
  })();

  // ── Handlers 
  const updateFilter = (k: string, v: string) => { const n = new URLSearchParams(searchParams); if (v) n.set(k, v); else n.delete(k); setSearchParams(n); };
  const clearFilters = () => { setSearchParams({}); setSearchTerm(''); setCurrentPage(1); };
  const removeFilter = (k: string) => { if (k === 'search') setSearchTerm(''); else updateFilter(k, ''); };

  const handleDeleteClick = (e: React.MouseEvent, doc: Document) => { e.stopPropagation(); setDeleteConfirm({ id: doc.id, name: doc.name }); };
  const toggleSelect = (id: string) => setSelectedDocs(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = () => {
    if (selectedDocs.size === displayedDocuments.length) setSelectedDocs(new Set());
    else setSelectedDocs(new Set(displayedDocuments.map((d: Document) => d.id)));
  };

  const handleBulkDelete = async () => {
    for (const id of Array.from(selectedDocs)) { try { await documentsApi.delete(id); } catch (e) { console.error('Delete failed:', e); } }
    setSelectedDocs(new Set()); setBulkDeleteConfirm(false);
    queryClient.invalidateQueries({ queryKey: ['documents'] });
  };

  const handleBulkChangeStatus = async (newStatus: DocumentStatus) => {
    for (const id of Array.from(selectedDocs)) { try { await documentsApi.updateStatus(id, newStatus); } catch (e) { console.error('Status update failed:', e); } }
    setSelectedDocs(new Set()); queryClient.invalidateQueries({ queryKey: ['documents'] });
  };

  const handleBulkShare = () => {
    const firstId = Array.from(selectedDocs)[0];
    if (firstId) { const doc = displayedDocuments.find((d: Document) => d.id === firstId); if (doc) setShareDoc(doc); }
  };

  const handleBulkMove = async (targetProjectId: number) => {
    for (const id of Array.from(selectedDocs)) { try { await documentsApi.update(id, { project: targetProjectId } as any); } catch (e) { console.error('Move failed:', e); } }
    setSelectedDocs(new Set()); queryClient.invalidateQueries({ queryKey: ['documents'] });
  };

  const handleBulkAddTags = async (tagIds: number[]) => {
    if (tagIds.length === 0) { alert('Please select at least one tag'); return; }
    const documentIds = Array.from(selectedDocs);
    if (documentIds.length === 0) { alert('Please select at least one document'); return; }
    try {
      const token = localStorage.getItem('access_token');
      const workspaceId = localStorage.getItem('active_workspace_id');
      const response = await fetch(`${API_URL}/documents/bulk-add-labels/`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'X-Workspace-ID': workspaceId || '' },
        body: JSON.stringify({ document_ids: documentIds, label_ids: tagIds }),
      });
      if (!response.ok) { const text = await response.text(); const error = text ? JSON.parse(text) : {}; throw new Error(error.error || error.detail || 'Failed to add tags'); }
      setShowTagSelector(false); setSelectedDocs(new Set());
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['documents-tree-counts'] });
    } catch (error: any) { alert(error.message || 'Failed to add tags. Please try again.'); }
  };

  const handleDocumentClick = async (doc: Document) => {
    setSidebarDoc(doc); setSidebarPreviewUrl(null);
    try { const r = await documentsApi.getDownloadUrl(doc.project, { document_id: doc.id }); setSidebarPreviewUrl(r.url); } catch (e) { console.error(e); }
  };

  const handleOpenFullPreview = () => {
    if (sidebarDoc && sidebarPreviewUrl) setPreviewDoc({ url: sidebarPreviewUrl, fileName: sidebarDoc.original_file_name || sidebarDoc.name, fileType: sidebarDoc.file_type });
  };

  const handleCreateFolder = async (projectId: number, parentId: string | null, folderName: string) => {
    try {
      await documentsApi.createFolder({ project: projectId, name: folderName, parent: parentId });
      await queryClient.invalidateQueries({ queryKey: ['document-folders'] });
      await queryClient.invalidateQueries({ queryKey: ['documents'] });
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (e: any) { alert(e.response?.data?.detail || e.response?.data?.name?.[0] || 'Failed to create folder'); }
  };

  const handleRenameFolder = async (folderId: string, newName: string) => {
    try {
      await documentsApi.renameFolder(folderId, newName);
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    } catch (e: any) { alert(e.response?.data?.detail || 'Failed to rename folder'); }
  };

  return {
    // routing
    navigate, queryClient, isActivityOpen, setIsActivityOpen, unreadCount,
    // view
    viewMode, setViewMode,
    // url filters
    projectFilter, statusFilter, fileTypeFilter, highlightDocId, activeHighlightId,
    updateFilter, clearFilters, removeFilter, hasActiveFilters,
    // search + pagination
    searchTerm, setSearchTerm, currentPage, setCurrentPage, sortBy, setSortBy, rowsPerPage, setRowsPerPage, totalPages,
    // ui state
    showFilters, setShowFilters,
    deleteConfirm, setDeleteConfirm,
    bulkDeleteConfirm, setBulkDeleteConfirm,
    previewDoc, setPreviewDoc,
    showTagSelector, setShowTagSelector,
    availableTags, setAvailableTags,
    infoDoc, setInfoDoc,
    shareDoc, setShareDoc,
    selectedFolder, setSelectedFolder,
    selectedTreeFolderId, setSelectedTreeFolderId,
    selectedTreeFolderName, setSelectedTreeFolderName,
    showSharedWithMe, setShowSharedWithMe,
    selectedDocs, setSelectedDocs,
    isTreeOpen, setIsTreeOpen,
    showUploadModal, setShowUploadModal,
    sidebarDoc, setSidebarDoc,
    sidebarPreviewUrl, setSidebarPreviewUrl,
    showNewDocModal, setShowNewDocModal,
    newDocName, setNewDocName,
    newDocContent, setNewDocContent,
    newDocFormat, setNewDocFormat,
    customFormat, setCustomFormat,
    moveConfirmModal, setMoveConfirmModal,
    toast, setToast,
    // data
    projects, isLoading, totalCount, displayedDocuments,
    treeFolders, currentProjectName, allDocs, allDocsForTree,
    sharedWithMeCount, hasNextPage, hasPreviousPage,
    projectTypeLookup,
    // handlers
    handleDeleteClick, toggleSelect, toggleSelectAll,
    handleBulkDelete, handleBulkChangeStatus, handleBulkShare, handleBulkMove, handleBulkAddTags,
    handleDocumentClick, handleOpenFullPreview,
    handleCreateFolder, handleRenameFolder,
  };
}