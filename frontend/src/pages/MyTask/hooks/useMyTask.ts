import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation, useOutletContext, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { taskApi, usersApi, projectsApi } from '@/services/api';
import { useTableFilters, ColumnFilterConfig } from '@/hooks/useTableFilters';
import { statusOptions, priorityOptions } from '@/components/layout/DualView/taskConfig';
import { useNotifications } from '@/hooks/useNotifications';
import type { Task } from '@/types';
import { DATE_FIELD_OPTIONS, PERSON_FIELD_OPTIONS } from '../taskBoardConstants';

// ─── Cache sanity guard 
function sanitiseTaskCache(queryClient: ReturnType<typeof useQueryClient>) {
  const existing = queryClient.getQueryData(['tasks']);
  if (!existing) return;
  const hasPages = Array.isArray((existing as any).pages);
  const isValid =
    typeof existing === 'object' &&
    hasPages &&
    (existing as any).pages.every(
      (p: any) => p && typeof p === 'object' && Array.isArray(p.results)
    );
  if (!isValid) {
    queryClient.removeQueries({ queryKey: ['tasks'] });
  }
}

export function useMyTask() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [searchParams] = useSearchParams();
  const { user }  = useAuth();
  const queryClient = useQueryClient();
  const { unreadCount } = useNotifications();

  sanitiseTaskCache(queryClient);

  // ── UI state
  const [viewMode,              setViewMode]              = useState<'grid' | 'table'>('table');
  const [dateField,             setDateField]             = useState<'end_date' | 'start_date' | 'created_at'>('end_date');
  const [personField,           setPersonField]           = useState<'assigned_to' | 'created_by' | 'updated_by'>('assigned_to');
  const [showDateFieldDropdown, setShowDateFieldDropdown] = useState(false);
  const [showPersonFieldDropdown, setShowPersonFieldDropdown] = useState(false);
  const [dropdownPos,           setDropdownPos]           = useState<{ top: number; left: number } | null>(null);
  const [searchQuery,           setSearchQuery]           = useState('');
  const [selectedTask,          setSelectedTask]          = useState<Task | null>(null);
  const [showAITaskModal,       setShowAITaskModal]       = useState(false);
  const [isInlineCreating,      setIsInlineCreating]      = useState(false);

  const dateTriggerRef   = useRef<HTMLButtonElement>(null);
  const personTriggerRef = useRef<HTMLButtonElement>(null);

 // Active status filter from URL path
  const activeFilter = location.pathname.split('/').filter(Boolean)[1]?.toUpperCase() || 'ALL';

  // ── Server-side filters from URL query params (e.g. /taskboard/pending?priority=critical&project_id=1)
  const priorityParam  = searchParams.get('priority')   || undefined;
  const projectIdParam = searchParams.get('project_id') || undefined;
  const labelNameParam = searchParams.get('label_name') || undefined;
  const statusParam = activeFilter !== 'ALL' ? activeFilter.toLowerCase() : undefined;
  const urlStatusRedirectRef = useRef<string | null>(null);
  const statusFromUrl = searchParams.get('status');
  const pendingStatusRedirect = !!statusFromUrl && location.pathname !== `/taskboard/${statusFromUrl.toLowerCase()}` && urlStatusRedirectRef.current !== statusFromUrl;

  // ── Outlet context
  const outletContext = useOutletContext<{
    isActivityOpen: boolean;
    setIsActivityOpen: (v: boolean) => void;
  } | null>();
  const isActivityOpen    = outletContext?.isActivityOpen    ?? false;
  const setIsActivityOpen = outletContext?.setIsActivityOpen ?? (() => {});

  // ── Close person dropdown on outside click 
  useEffect(() => {
    if (!showPersonFieldDropdown) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (personTriggerRef.current?.contains(target)) return;
      if (document.querySelector('[data-person-dropdown="true"]')?.contains(target)) return;
      setShowPersonFieldDropdown(false);
      setDropdownPos(null);
    };
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
  }, [showPersonFieldDropdown]);

  // ── Close date dropdown on outside click
  useEffect(() => {
    if (!showDateFieldDropdown) return;
    const handler = () => { setShowDateFieldDropdown(false); setDropdownPos(null); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDateFieldDropdown]);

  // ── Data: users list 
  const { data: usersData } = useQuery({
    queryKey: ['all-users'],
    queryFn:  () => usersApi.listAll(),
    enabled:  !!user,
  });

  // ── Data: projects (for project type colour lookup)
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn:  () => projectsApi.list(),
    staleTime: 60_000,
  });

  const projectTypeLookup = useMemo(() => {
    const raw = projectsData?.results || projectsData || [];
    const arr = Array.isArray(raw) ? raw : [];
    return arr.reduce((acc: Record<number, string>, p: any) => {
      acc[p.id] = p.task_type || '';
      return acc;
    }, {} as Record<number, string>);
  }, [projectsData]);

  // ── Data: infinite task pages
  const {
    data: infiniteData,
    isLoading: loading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ['tasks', statusParam, priorityParam, projectIdParam],
    queryFn:  async ({ pageParam = 1 }) => {
      const res = await taskApi.listPaginated(pageParam as number, {
        status: statusParam,
        priority: priorityParam,
        project_id: projectIdParam,
      });
      return res;
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage || typeof lastPage !== 'object' || Array.isArray(lastPage)) return undefined;
      if (!('next' in lastPage) || !lastPage.next) return undefined;
      if (!Array.isArray((lastPage as any).results)) return undefined;
      try {
        const url = new URL(lastPage.next);
        const p = url.searchParams.get('page');
        return p ? Number(p) : undefined;
      } catch { return undefined; }
    },
    initialPageParam: 1,
    enabled: !!user && !pendingStatusRedirect,
    staleTime: 1000 * 60 * 2,
    placeholderData: (prev: any) => prev,
  });

  // ── Flatten + role-filter pages into a single array 
  const tasks = useMemo(() => {
    const all: Task[] = infiniteData?.pages?.flatMap(p =>
      p && Array.isArray((p as any).results) ? (p as any).results : []
    ) ?? [];
    let filtered = all;
    if (user?.role === 'manager') {
      filtered = all.filter(t => t.assigned_by === user.id || t.assigned_to.includes(user.id));
    } else if (user?.role !== 'admin') {
      filtered = all.filter(t => t.assigned_to.includes(user?.id ?? -1));
    }
    const mapped = filtered.map(t => ({ ...t, status_label: (t.status || '').toLowerCase().replace(/_/g, ' ') }));
    return mapped;
  }, [infiniteData, user]);

  // ── Infinite scroll sentinel
 const sentinelRef         = useRef<HTMLDivElement>(null);
  const isFetchingRef       = useRef(false);

  useEffect(() => { isFetchingRef.current = isFetchingNextPage; }, [isFetchingNextPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingRef.current) {
          fetchNextPage();
        }
      },
      { threshold: 1.0, rootMargin: '0px 0px 100px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, fetchNextPage]);

  const hasUrlFilter = !!(statusParam || priorityParam || projectIdParam);
  useEffect(() => {
    if (hasUrlFilter && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasUrlFilter, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ── Column filter config 
  const filterConfig: ColumnFilterConfig[] = [
    { key: 'project',  type: 'search', searchFields: ['project_details', 'name'] },
    { key: 'heading',  type: 'search' },
    { key: 'labels',   type: 'search' },
    { key: 'status',   type: 'list', listOptions: statusOptions.map(o => ({ value: o.value.toUpperCase(), label: o.label })) },
    { key: 'priority', type: 'list', listOptions: priorityOptions.map(o => ({ value: o.value, label: o.label })) },
    { key: dateField,  type: 'date' },
  ];

  const {
    filteredData: hookFilteredTasks,
    handleSort,
    columnFilters,
    setColumnFilters,
    clearFilter,
    activeFilterKey,
    setActiveFilterKey,
    filterContainerRef,
  } = useTableFilters<Task>({
    data:               tasks,
    columns:            filterConfig,
    globalSearchFields: ['heading', 'description', 'status', 'priority', 'project_name', 'status_label'],
  });

  useEffect(() => {
    if (!statusFromUrl) return;
    if (urlStatusRedirectRef.current === statusFromUrl) return;
    const targetPath = `/taskboard/${statusFromUrl.toLowerCase()}`;
    if (location.pathname === targetPath) return;
    urlStatusRedirectRef.current = statusFromUrl;
    navigate({ pathname: targetPath, search: location.search }, { replace: true });
  }, [statusFromUrl, location.pathname, location.search, navigate]);

  const urlFiltersAppliedRef = useRef(false);
  useEffect(() => {
    if (urlFiltersAppliedRef.current) return;
    if (!searchParams.toString()) return;
    if (!projectsData) return;
    urlFiltersAppliedRef.current = true;

   const projectIdParam = searchParams.get('project_id');
    const priorityParam  = searchParams.get('priority');
    const labelNameParam = searchParams.get('label_name');

    setColumnFilters(prev => {
      const next = { ...prev };
      if (projectIdParam) {
        const projectsArr = (projectsData as any)?.results || (Array.isArray(projectsData) ? projectsData : []);
        const matchedProject = projectsArr.find((p: any) => String(p.id) === projectIdParam);
        if (matchedProject) next.project = matchedProject.name;
      }
      if (priorityParam) {
        next.priority = priorityParam;
      }
      return next;
    });

    // Label filter 
    if (labelNameParam) {
      setSearchQuery(labelNameParam);
    }
  }, [searchParams, projectsData, location.pathname, location.search, navigate, setColumnFilters]);

  // ── Final filtered list
 const filteredTasks = useMemo(() => {
    if (!hookFilteredTasks) return [];
    return hookFilteredTasks
      .filter(task => {
        if (!task?.status) return false;
        const matchesFilter   = activeFilter === 'ALL' || task.status.toUpperCase() === activeFilter;
        const q = searchQuery.trim().toLowerCase();
        const matchesSearch   = !q ||
          (task.heading || '').toLowerCase().includes(q) ||
          (task.status  || '').toLowerCase().replace(/_/g, ' ').includes(q) ||
          (task.project_details?.name || '').toLowerCase().includes(q) ||
          (task.description || '').replace(/<[^>]*>/g, '').toLowerCase().includes(q) ||
          (task.priority || '').toLowerCase().includes(q) ||
          (task.labels || []).some((l: any) => (l.name || l.label || '').toLowerCase().includes(q));
        const assigneeVal     = columnFilters['assigned_to'];
        const matchesAssignee = !assigneeVal || (task.assigned_to || []).map(String).includes(String(assigneeVal));
        const createdByVal    = columnFilters['created_by'];
        const matchesCreatedBy = !createdByVal || String(task.assigned_by) === String(createdByVal);
        const labelsVal       = columnFilters['labels'];
        const matchesLabel    = !labelsVal || (task.labels || []).some(
          (l: any) => (l.name || l.label || '').toLowerCase().includes(String(labelsVal).toLowerCase())
        );
        return matchesFilter && matchesSearch && matchesAssignee && matchesCreatedBy && matchesLabel;
      })
      .map(task => ({
        ...task,
        project_task_type: projectTypeLookup[(task.project as any)] || projectTypeLookup[task.project_details?.id as any] || '',
      }));
  }, [hookFilteredTasks, activeFilter, searchQuery, columnFilters, projectTypeLookup]);

  // ── Task event handlers 
  const handleTaskClick = useCallback((task: Task) => setSelectedTask(task), []);
  const handleCloseTaskDetail = useCallback(() => setSelectedTask(null), []);

  const handleSelectedTaskUpdate = useCallback((updatedTask: Task) => {
    queryClient.setQueryData(['tasks'], (old: any) => {
      if (!old?.pages) return old;
      const stripped = old.pages.map((page: any) => ({
        ...page,
        results: page.results.filter((t: Task) => t.id !== updatedTask.id),
      }));
      return {
        ...old,
        pages: [
          { ...stripped[0], results: [updatedTask, ...(stripped[0]?.results ?? [])] },
          ...stripped.slice(1),
        ],
      };
    });
    setSelectedTask(updatedTask);
  }, [queryClient]);

  const handleDeleteTask = useCallback(async (id: number) => {
    queryClient.setQueryData(['tasks'], (old: any) => {
      if (!old?.pages) return old;
      return { ...old, pages: old.pages.map((page: any) => ({ ...page, results: page.results.filter((t: Task) => t.id !== id) })) };
    });
    setSelectedTask(null);
    try { await taskApi.delete(id); } catch { queryClient.invalidateQueries({ queryKey: ['tasks'] }); }
  }, [queryClient]);

  const handleFilter = useCallback((key: string) => {
    setShowDateFieldDropdown(false);
    setActiveFilterKey(prev => prev === key ? null : key);
  }, [setActiveFilterKey]);

  const handleAITaskGenerate = useCallback(async (_projectId: number, _description: string) => {}, []);

  const openDateDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (dateTriggerRef.current) {
      const r = dateTriggerRef.current.getBoundingClientRect();
      setDropdownPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX });
    }
    setShowDateFieldDropdown(v => !v);
  };

  const openPersonDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (personTriggerRef.current) {
      const r = personTriggerRef.current.getBoundingClientRect();
      setDropdownPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX });
    }
    setShowPersonFieldDropdown(v => !v);
  };

  const activeDateLabel   = DATE_FIELD_OPTIONS.find(o => o.value === dateField)?.label   ?? 'Due Date';
  const activePersonLabel = PERSON_FIELD_OPTIONS.find(o => o.value === personField)?.label ?? 'Assignee';

  return {
    // auth / routing
    user, navigate, location, activeFilter,
    isActivityOpen, setIsActivityOpen, unreadCount,
    // view
    viewMode, setViewMode,
    // fields
    dateField,   setDateField,   activeDateLabel,
    personField, setPersonField, activePersonLabel,
    // dropdown state
    showDateFieldDropdown,   setShowDateFieldDropdown,
    showPersonFieldDropdown, setShowPersonFieldDropdown,
    dropdownPos, setDropdownPos,
    dateTriggerRef, personTriggerRef,
    openDateDropdown, openPersonDropdown,
    // data
    usersData, loading, isFetchingNextPage,
    filteredTasks,
    // filter
    searchQuery, setSearchQuery,
    columnFilters, setColumnFilters, clearFilter,
    activeFilterKey, setActiveFilterKey, filterContainerRef,
    handleSort, handleFilter,
    // tasks
    selectedTask, handleTaskClick, handleCloseTaskDetail,
    handleSelectedTaskUpdate, handleDeleteTask,
    handleAITaskGenerate,
    // modals
    showAITaskModal, setShowAITaskModal,
    isInlineCreating, setIsInlineCreating,
    // scroll
    sentinelRef,
    // cache
    queryClient,
  };
}