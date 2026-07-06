import { useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { projectsApi, notificationSocket, gatewaySocket } from '@/services/api';
import type { Project } from '@/types';
import { TREE_GROUPS } from '../projectConstants';

const ROWS_PER_PAGE = 25;

export function useProjects() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // ── Filters & UI state 
  const [typeFilter,       setTypeFilter]       = useState('');
  const [statusFilter,     setStatusFilter]     = useState('');
  const [searchTerm,       setSearchTerm]       = useState('');
  const [viewMode,         setViewMode]         = useState<'list' | 'grid' | 'tree'>('list');
  const [selectedIds,      setSelectedIds]      = useState<Set<number>>(new Set());
  const [showMoveModal,    setShowMoveModal]    = useState(false);
  const [detailProject,    setDetailProject]    = useState<Project | null>(null);
  const [treeOpen,         setTreeOpen]         = useState(true);
  const [treeFilter,       setTreeFilter]       = useState<number | null>(null);
  const [treeGroupFilter,  setTreeGroupFilter]  = useState<string | null>(null);
  const [currentPage,      setCurrentPage]      = useState(1);
  const [isCreateModalOpen,setIsCreateModalOpen]= useState(false);

  // ── Data fetching 
  const { data, isLoading } = useQuery({
    queryKey: ['projects', typeFilter],
    queryFn: () => projectsApi.list(typeFilter ? { task_type: typeFilter } : undefined),
    staleTime: 1000 * 60 * 10,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const allProjects: Project[] = (() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'object' && 'results' in data && Array.isArray((data as any).results)) return (data as any).results;
    return [];
  })();

  // ── Real-time sync 
  useEffect(() => {
    const seen = new Set<string>();
    const handle = (rel: { type: string; id: string | number }) => {
      if (rel.type !== 'project') return;
      const key = `${rel.id}-${Math.floor(Date.now() / 2000)}`;
      if (seen.has(key)) return;
      seen.add(key);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    };
    const u1 = notificationSocket.onNotification(d => {
      if (d.related_object?.type === 'project') handle(d.related_object);
    });
    const u2 = gatewaySocket.onMessage((msg: any) => {
      if (msg.type === 'SIGNAL' && msg.event === 'NEW_NOTIFICATION' && msg.data?.related_object?.type === 'project')
        handle(msg.data.related_object);
    });
    return () => { u1(); u2(); seen.clear(); };
  }, [queryClient]);

  // ── Favourite toggle (optimistic) ─────────────────────────────────────────
  const toggleFavorite = (e: React.MouseEvent, project: Project) => {
    e.preventDefault();
    e.stopPropagation();
    const upd = (old: any): any => {
      if (!old) return old;
      const list: Project[] = Array.isArray(old) ? old : (old.results ?? []);
      const updated = list.map(p => p.id === project.id ? { ...p, is_favourite: !project.is_favourite } : p);
      return Array.isArray(old) ? updated : { ...old, results: updated };
    };
    queryClient.setQueriesData<any>({ queryKey: ['projects'] }, upd);
    projectsApi.update(project.id, { is_favourite: !project.is_favourite }).catch(() => {
      const rev = (old: any): any => {
        if (!old) return old;
        const list: Project[] = Array.isArray(old) ? old : (old.results ?? []);
        const reverted = list.map(p => p.id === project.id ? { ...p, is_favourite: project.is_favourite } : p);
        return Array.isArray(old) ? reverted : { ...old, results: reverted };
      };
      queryClient.setQueriesData<any>({ queryKey: ['projects'] }, rev);
    });
  };

  // ── Prefetch on hover 
  const handleRowHover = useCallback((project: any) => {
    queryClient.prefetchQuery({
      queryKey: ['project', String(project.id)],
      queryFn: () => projectsApi.get(project.id),
      staleTime: 1000 * 60 * 5,
    });
  }, [queryClient]);

  // ── Filtering 
  const filtered = allProjects.filter(p => {
    if (treeFilter && p.id !== treeFilter) return false;
    if (treeGroupFilter) {
      const group = TREE_GROUPS.find(g => g.label === treeGroupFilter);
      if (group && !group.types.includes(((p as any).task_type || '').toLowerCase())) return false;
    }
    if (statusFilter && (p as any).status !== statusFilter) return false;
    if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const paginated  = filtered.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  // ── Selection 
  const toggleSelect = (id: number) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () =>
    setSelectedIds(selectedIds.size === paginated.length ? new Set() : new Set(paginated.map(p => p.id)));

  // ── Filter helpers 
  const clearAllFilters = () => { setStatusFilter(''); setTypeFilter(''); setSearchTerm(''); setCurrentPage(1); };

  // ── Tree navigation helpers 
  const handleTreeSelect = (id: number | null) => { setTreeFilter(id); setCurrentPage(1); setDetailProject(null); };
  const handleTreeGroupSelect = (label: string | null) => { setTreeGroupFilter(label); setCurrentPage(1); setDetailProject(null); };
  const handleDetailProject = (project: Project | null) =>
    setDetailProject(prev => prev?.id === project?.id ? null : project);

  return {
    // data
    allProjects, filtered, paginated, isLoading,
    totalPages, rowsPerPage: ROWS_PER_PAGE,
    // filters
    typeFilter,      setTypeFilter:      (v: string) => { setTypeFilter(v);      setCurrentPage(1); },
    statusFilter,    setStatusFilter:    (v: string) => { setStatusFilter(v);    setCurrentPage(1); },
    searchTerm,      setSearchTerm:      (v: string) => { setSearchTerm(v);      setCurrentPage(1); },
    clearAllFilters,
    // view
    viewMode, setViewMode,
    // pagination
    currentPage, setCurrentPage,
    // selection
    selectedIds, setSelectedIds, toggleSelect, toggleAll,
    // modals
    showMoveModal, setShowMoveModal,
    isCreateModalOpen, setIsCreateModalOpen,
    // detail panel
    detailProject, handleDetailProject,
    // tree
    treeOpen, setTreeOpen: () => setTreeOpen(p => !p),
    treeFilter, handleTreeSelect,
    treeGroupFilter, handleTreeGroupSelect,
    // handlers
    toggleFavorite, handleRowHover,
    navigate, queryClient,
  };
}