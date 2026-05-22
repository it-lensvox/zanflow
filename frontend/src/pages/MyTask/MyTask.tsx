import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ReactDOM, { createPortal } from 'react-dom';
import { Plus, Grid3X3, List, Search, Bell } from 'lucide-react';
import { useNavigate, Outlet, useLocation, useOutletContext } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { taskApi, usersApi } from '@/services/api';
import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { TaskDetailModal } from './TaskDetailModal';
import { AITask } from './AITask';
import { Task } from '@/types';
import { DualView } from '@/components/layout/DualView/DualView';
import { createTasksTableColumns, TaskGridCard, getStatusConfig, priorityOptions, statusOptions, } from '@/components/layout/DualView/taskConfig';
import { useTableFilters, ColumnFilterConfig } from '@/hooks/useTableFilters';
import { SearchFilter, ListFilter, DateFilter, FilterHeaderWrapper } from '@/components/layout/DualView/FilterComponents';
import { Button } from '@/components/common/Button';
import { InlineCreateRow } from '@/components/layout/CreateTask/InlineCreateRow';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationsPage } from '../NotificationsPage';

const DATE_FIELD_OPTIONS: { value: 'end_date' | 'start_date' | 'created_at'; label: string }[] = [
    { value: 'end_date', label: 'Due Date' },
    { value: 'start_date', label: 'Start Date' },
    { value: 'created_at', label: 'Created At' },
];
const PERSON_FIELD_OPTIONS: { value: 'assigned_to' | 'created_by' | 'updated_by'; label: string }[] = [
    { value: 'assigned_to', label: 'Assignee' },
    { value: 'created_by', label: 'Created By' },
    { value: 'updated_by', label: 'Updated By' },
];

// ── Sanitise the tasks cache on every mount to prevent InfiniteQuery crashes ──
function sanitiseTaskCache(queryClient: import('@tanstack/react-query').QueryClient) {
    const existing = queryClient.getQueryData(['tasks']);

    // undefined / null = no cached data yet → perfectly fine, let RQ start fresh
    if (!existing) {
        console.log('%c[Cache:tasks] ✅ No existing cache — clean start', 'color:#22c55e;font-weight:bold');
        return;
    }

    const shape = typeof existing;
    const hasPages = Array.isArray((existing as any).pages);
    const pageCount = hasPages ? (existing as any).pages.length : 'N/A';

    const isValidInfiniteShape =
        shape === 'object' &&
        hasPages &&
        (existing as any).pages.every(
            (p: any) => p && typeof p === 'object' && Array.isArray(p.results)
        );

    if (isValidInfiniteShape) {
        console.log(
            '%c[Cache:tasks] ✅ Valid InfiniteQuery shape',
            'color:#22c55e;font-weight:bold',
            `| pages: ${pageCount}`,
            `| total tasks: ${(existing as any).pages.reduce((acc: number, p: any) => acc + (p.results?.length ?? 0), 0)}`
        );
    } else {
        console.warn(
            '%c[Cache:tasks] ⚠️ CORRUPT / FLAT cache detected — clearing now',
            'color:#f97316;font-weight:bold',
            '\nShape:', shape,
            '| hasPages:', hasPages,
            '| keys:', Object.keys(existing as object).join(', ')
        );
        // removeQueries fully removes the entry so useInfiniteQuery starts with state.data = undefined
        // NOTE: setQueryData(undefined) is a NO-OP in React Query v5 — it must NOT be used here
        queryClient.removeQueries({ queryKey: ['tasks'], exact: true });
        console.log('%c[Cache:tasks] 🧹 Cache cleared — useInfiniteQuery will start fresh', 'color:#f97316;font-weight:bold');
    }
}

export const MyTask: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

    sanitiseTaskCache(queryClient);
    const [dateField, setDateField] = useState<'end_date' | 'start_date' | 'created_at'>('end_date');
    const [personField, setPersonField] = useState<'assigned_to' | 'created_by' | 'updated_by'>('assigned_to');
    const [showPersonFieldDropdown, setShowPersonFieldDropdown] = useState(false);
    const personTriggerRef = React.useRef<HTMLButtonElement>(null);
    const [showDateFieldDropdown, setShowDateFieldDropdown] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [showAITaskModal, setShowAITaskModal] = useState(false);
    const [isInlineCreating, setIsInlineCreating] = useState(false);
    const activeFilter = location.pathname.split('/').filter(p => p)[1]?.toUpperCase() || 'ALL';

    useEffect(() => {
        if (!showPersonFieldDropdown) return;

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;

            // Don't close if clicking on the trigger button
            if (personTriggerRef.current?.contains(target)) {
                return;
            }

            // Don't close if clicking inside the dropdown portal
            const dropdownElement = document.querySelector('[data-person-dropdown="true"]');
            if (dropdownElement?.contains(target)) {
                return;
            }

            // Close dropdown
            setShowPersonFieldDropdown(false);
            setDropdownPos(null);
        };

        // Add listener with a slight delay
        const timeoutId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showPersonFieldDropdown]);

    const { data: usersData } = useQuery({
        queryKey: ['all-users'],
        queryFn: () => usersApi.listAll(),
        enabled: !!user,
    });

    // Infinite-scroll paginated query
    const {
        data: infiniteData,
        isLoading: loading,
        isFetchingNextPage,
        fetchNextPage,
        hasNextPage,
    } = useInfiniteQuery({
        queryKey: ['tasks'],
        queryFn: async ({ pageParam = 1 }) => {
            console.log('%c[InfiniteQuery:tasks] 📦 Fetching page', 'color:#6366f1;font-weight:bold', pageParam);
            const result = await taskApi.listPaginated(pageParam as number);
            console.log(
                '%c[InfiniteQuery:tasks] ✅ Page fetched',
                'color:#22c55e;font-weight:bold',
                `| page: ${pageParam}`,
                `| count: ${result?.results?.length ?? 0}`,
                `| hasNext: ${!!result?.next}`
            );
            return result;
        },
        getNextPageParam: (lastPage) => {
            if (!lastPage || typeof lastPage !== 'object' || Array.isArray(lastPage)) {
                console.log('%c[InfiniteQuery:tasks] getNextPageParam → undefined (invalid lastPage)', 'color:#94a3b8');
                return undefined;
            }
            if (!('next' in lastPage) || !lastPage.next) {
                console.log('%c[InfiniteQuery:tasks] getNextPageParam → undefined (no next URL)', 'color:#94a3b8');
                return undefined;
            }
            if (!Array.isArray((lastPage as any).results)) {
                console.log('%c[InfiniteQuery:tasks] getNextPageParam → undefined (results not array)', 'color:#94a3b8');
                return undefined;
            }
            try {
                const url = new URL(lastPage.next);
                const p = url.searchParams.get('page');
                const nextPage = p ? Number(p) : undefined;
                console.log('%c[InfiniteQuery:tasks] getNextPageParam →', 'color:#6366f1', nextPage);
                return nextPage;
            } catch {
                console.log('%c[InfiniteQuery:tasks] getNextPageParam → undefined (URL parse error)', 'color:#f87171');
                return undefined;
            }
        },
        initialPageParam: 1,
        enabled: !!user,
        staleTime: 1000 * 60 * 2,
        placeholderData: (prev: any) => prev,
    });

    // Flatten all pages into a single ordered task array
    const tasks = React.useMemo(() => {
        const allTasks: Task[] = infiniteData?.pages?.flatMap(p =>
            (p && Array.isArray((p as any).results)) ? (p as any).results : []
        ) ?? [];
        console.log(
            '%c[InfiniteQuery:tasks] 📋 Tasks flattened',
            'color:#6366f1;font-weight:bold',
            `| pages loaded: ${infiniteData?.pages?.length ?? 0}`,
            `| total tasks: ${allTasks.length}`,
            `| hasNextPage: ${hasNextPage}`
        );
        let filtered = allTasks;
        if (user?.role === 'manager') {
            filtered = allTasks.filter((task: Task) =>
                task.assigned_by === user.id ||
                task.assigned_to.includes(user.id)
            );
        } else if (user?.role !== 'admin') {
            filtered = allTasks.filter((task: Task) =>
                task.assigned_to.includes(user?.id ?? -1)
            );
        }
        return filtered;
    }, [infiniteData, user]);

    // Sentinel ref
    const sentinelRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = sentinelRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
                    fetchNextPage();
                }
            },
            { threshold: 0.1 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    // Define filter configuration for columns
    const filterConfig: ColumnFilterConfig[] = [
        { key: 'project', type: 'search', searchFields: ['project_details', 'name'] },
        { key: 'heading', type: 'search' },
        { key: 'labels', type: 'search' },
        {
            key: 'status',
            type: 'list',
            listOptions: statusOptions.map(opt => ({
                value: opt.value.toUpperCase(),
                label: opt.label
            }))
        },
        {
            key: 'priority',
            type: 'list',
            listOptions: priorityOptions.map(opt => ({
                value: opt.value,
                label: opt.label
            }))
        },
        { key: dateField, type: 'date' },
    ];

    // Use the centralized filter hook
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
        data: tasks,
        columns: filterConfig,
        globalSearchFields: ['heading', 'description'],
    });

    const handleTaskClick = useCallback((task: Task) => setSelectedTask(task), []);
    const handleCloseTaskDetail = useCallback(() => setSelectedTask(null), []);

    const handleSelectedTaskUpdate = useCallback((updatedTask: Task) => {
        queryClient.setQueryData(['tasks'], (old: any) => {
            if (!old?.pages) return old;
            const pagesWithoutTask = old.pages.map((page: any) => ({
                ...page,
                results: page.results.filter((t: Task) => t.id !== updatedTask.id),
            }));
            return {
                ...old,
                pages: [
                    {
                        ...pagesWithoutTask[0],
                        results: [updatedTask, ...(pagesWithoutTask[0]?.results ?? [])],
                    },
                    ...pagesWithoutTask.slice(1),
                ],
            };
        });
        setSelectedTask(updatedTask);
    }, [queryClient]);

    const handleDeleteTask = useCallback(async (id: number) => {
        // Optimistically remove the task from all pages
        queryClient.setQueryData(['tasks'], (old: any) => {
            if (!old?.pages) return old;
            return {
                ...old,
                pages: old.pages.map((page: any) => ({
                    ...page,
                    results: page.results.filter((t: Task) => t.id !== id),
                })),
            };
        });
        setSelectedTask(null);

        try {
            await taskApi.delete(id);
        } catch (err) {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
        }
    }, [queryClient]);


    const filteredTasks = React.useMemo(() => {
        if (!hookFilteredTasks) return [];
        return hookFilteredTasks.filter((task: Task) => {
            if (!task || !task.status) {
                console.warn('[filteredTasks] Skipping task with missing status:', task);
                return false;
            }
            const matchesFilter = activeFilter === 'ALL' || task.status.toUpperCase() === activeFilter;
            const matchesSearch = searchQuery.trim() === '' ||
                (task.heading || '').toLowerCase().includes(searchQuery.toLowerCase());

            // Filter by Assignee
            const assigneeFilterValue = columnFilters['assigned_to'];
            const matchesAssignee = !assigneeFilterValue ||
                (task.assigned_to || []).map(String).includes(String(assigneeFilterValue));

            // Filter by Created By
            const createdByFilterValue = columnFilters['created_by'];
            const matchesCreatedBy = !createdByFilterValue ||
                String(task.assigned_by) === String(createdByFilterValue);

            return matchesFilter && matchesSearch && matchesAssignee && matchesCreatedBy;
        });
    }, [hookFilteredTasks, activeFilter, searchQuery, columnFilters]);
    const handleFilter = useCallback((key: string) => {
        console.log('[handleFilter] called with key:', key, '| dateField:', dateField, '| will reset showDateFieldDropdown');
        setShowDateFieldDropdown(false);
        setActiveFilterKey(prev => prev === key ? null : key);
    }, [setActiveFilterKey, dateField]);

    const handleAITaskGenerate = useCallback(async (projectId: number, description: string) => {
        console.log('Generating AI task for project:', projectId, 'with description:', description);
    }, []);

    // Create table columns configuration
    const tableColumns = useMemo(() => createTasksTableColumns({
        onTaskClick: handleTaskClick,
        queryClient,
        user,
        navigate,
        dateField,
        personField,
    }), [handleTaskClick, queryClient, user, navigate, dateField, personField]);
    const { unreadCount } = useNotifications();

    const outletContext = useOutletContext<{
        isActivityOpen: boolean;
        setIsActivityOpen: (open: boolean) => void;
    } | null>();
    const isActivityOpen = outletContext?.isActivityOpen ?? false;
    const setIsActivityOpen = outletContext?.setIsActivityOpen ?? (() => { });

    const activeDateLabel = DATE_FIELD_OPTIONS.find(o => o.value === dateField)?.label ?? 'Due Date';
    const dateTriggerRef = useRef<HTMLButtonElement>(null);
    const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
    useEffect(() => {
        if (!showDateFieldDropdown) return;
        const handler = (e: MouseEvent) => {
            setShowDateFieldDropdown(false);
            setDropdownPos(null);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showDateFieldDropdown]);

    const DateFieldLabel = useMemo(() => (
        <button
            ref={dateTriggerRef}
            onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (dateTriggerRef.current) {
                    const rect = dateTriggerRef.current.getBoundingClientRect();
                    setDropdownPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX });
                }
                setShowDateFieldDropdown(v => !v);
            }}
            className="flex items-center gap-1 text-[14px] font-bold tracking-wide text-gray-700 hover:text-purple-600 transition-colors"
        >
            {activeDateLabel}
            <svg className="w-3 h-3 mt-0.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </button>
    ), [showDateFieldDropdown, dateField, activeDateLabel]);
    const activePersonLabel = PERSON_FIELD_OPTIONS.find(o => o.value === personField)?.label ?? 'Assignee';

    const PersonFieldLabel = useMemo(() => (
        <button
            ref={personTriggerRef}
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (personTriggerRef.current) {
                    const rect = personTriggerRef.current.getBoundingClientRect();
                    setDropdownPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX });
                }
                setShowPersonFieldDropdown(v => !v);
            }}
            className="flex items-center gap-1 text-[14px] font-bold tracking-wide text-gray-700 hover:text-purple-600 transition-colors"
        >
            {activePersonLabel}
            <svg className="w-3 h-3 mt-0.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </button>
    ), [showPersonFieldDropdown, personField, activePersonLabel]);

    return (
        <div className="w-full flex flex-col h-screen overflow-hidden">
            {location.pathname.startsWith('/taskboard') && !location.pathname.endsWith('/create') ? (
                <>
                    {/* ── Sticky header — never scrolls ── */}
                    <div className="flex-shrink-0 px-8 pt-8 pb-0 bg-white z-10">
                        <div className="flex flex-col gap-6">
                            {/* Header Section */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-3xl font-bold text-gray-900">Task Board</h1>
                                    <p className="text-lg text-muted-foreground mt-1">Manage and track your tasks efficiently</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {['admin', 'manager', 'annotator'].includes(user?.role || '') && (
                                        <>
                                            <button
                                                onClick={() => navigate('/taskboard/create')}
                                                className="flex items-center px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 transition-colors shadow-sm"
                                            >
                                                Create Task
                                            </button>
                                            <button
                                                onClick={() => setShowAITaskModal(true)}
                                                className="flex items-center px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 transition-colors shadow-sm"
                                            >
                                                Generate Task by AI
                                            </button>
                                        </>
                                    )}
                                    <Button
                                        className="relative bg-[#F7EC8D]"
                                        onClick={() => setIsActivityOpen(!isActivityOpen)}
                                    >
                                        <Bell className="h-5 w-5 text-gray-800" />
                                        {unreadCount > 0 && (
                                            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                                                {unreadCount}
                                            </span>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {/* Controls Section */}
                            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                                <div className="relative flex-1 max-w-sm">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                                    <input
                                        type="text"
                                        placeholder="Search tasks..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-card text-gray-900 dark:text-foreground"
                                    />
                                </div>
                                <div className="flex items-center border border-gray-200 rounded-md bg-white dark:bg-card p-1 gap-1">
                                    <button
                                        onClick={() => setViewMode('table')}
                                        className={`p-1.5 rounded transition-colors ${viewMode === 'table' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                                        title="Table View"
                                    >
                                        <List className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('grid')}
                                        className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                                        title="Grid View"
                                    >
                                        <Grid3X3 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Scrollable content area ── */}
                    <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
                        {/* Content Section*/}
                        <div className="space-y-0 mt-6 flex flex-col">
                            <DualView
                                viewMode={viewMode}
                                isLoading={loading}
                                gridProps={{
                                    data: filteredTasks,
                                    renderCard: (task: Task) => <TaskGridCard task={task} onTaskClick={handleTaskClick} />,
                                    gridClassName: "grid gap-4 grid-cols-4",
                                }}
                                tableProps={{
                                    data: filteredTasks,
                                    activeFilterKey: activeFilterKey,
                                    columns: tableColumns.map(col => ({
                                        ...col,
                                        headerClassName: `relative ${activeFilterKey === col.key ? 'z-[100]' : ''}`,
                                        label: (
                                            /* Auto-Close for both search and dropdowns */
                                            <div ref={activeFilterKey === col.key ? filterContainerRef : null}>
                                                <FilterHeaderWrapper
                                                    columnLabel={col.key === personField ? PersonFieldLabel : col.key === dateField ? DateFieldLabel : col.label as string}
                                                    filterType={
                                                        ['project', 'heading', 'labels'].includes(col.key) ? 'search' :
                                                            ['status', 'priority'].includes(col.key) || col.key === personField ? 'list' :
                                                                col.key === dateField ? 'date' : 'none'
                                                    }
                                                    isActive={activeFilterKey === col.key}
                                                    filterContent={
                                                        <>
                                                            {col.key === 'status' && (
                                                                <ListFilter
                                                                    columnKey="status"
                                                                    options={statusOptions.map(status => ({
                                                                        value: status.value.toUpperCase(),
                                                                        label: status.label,
                                                                        icon: React.createElement(getStatusConfig(status.value.toUpperCase() as any).icon, { className: "w-3.5 h-3.5" }),
                                                                        className: getStatusConfig(status.value.toUpperCase() as any).text,
                                                                    }))}
                                                                    selectedValue={columnFilters.status || ''}
                                                                    onSelect={(value) => { setColumnFilters(prev => ({ ...prev, status: value })); setActiveFilterKey(null); }}
                                                                    onClear={() => { clearFilter('status'); setActiveFilterKey(null); }}
                                                                    isActive={activeFilterKey === 'status'}
                                                                    containerRef={filterContainerRef}
                                                                />
                                                            )}
                                                            {col.key === 'priority' && (
                                                                <ListFilter
                                                                    columnKey="priority"
                                                                    options={priorityOptions.map(opt => ({ value: opt.value, label: opt.label, icon: <span>{opt.icon}</span> }))}
                                                                    selectedValue={columnFilters.priority || ''}
                                                                    onSelect={(value) => { setColumnFilters(prev => ({ ...prev, priority: value })); setActiveFilterKey(null); }}
                                                                    onClear={() => { clearFilter('priority'); setActiveFilterKey(null); }}
                                                                    isActive={activeFilterKey === 'priority'}
                                                                    containerRef={filterContainerRef}
                                                                />
                                                            )}
                                                            {col.key === personField && (
                                                                <ListFilter
                                                                    columnKey={personField}
                                                                    options={(usersData || []).map(u => ({
                                                                        value: String(u.id),
                                                                        label: `${u.first_name} ${u.last_name}`.trim() || u.username,
                                                                    }))}
                                                                    selectedValue={columnFilters[personField] || ''}
                                                                    onSelect={(value) => { setColumnFilters(prev => ({ ...prev, [personField]: value })); setActiveFilterKey(null); }}
                                                                    onClear={() => { clearFilter(personField); setActiveFilterKey(null); }}
                                                                    isActive={activeFilterKey === personField}
                                                                    containerRef={filterContainerRef}
                                                                />
                                                            )}
                                                            {col.key === dateField && (
                                                                <DateFilter
                                                                    columnKey={dateField}
                                                                    value={columnFilters[dateField] || ''}
                                                                    onChange={(value) => { setColumnFilters(prev => ({ ...prev, [dateField]: value })); setActiveFilterKey(null); }}
                                                                    onClear={() => { clearFilter(dateField); setActiveFilterKey(null); }}
                                                                    isActive={activeFilterKey === dateField}
                                                                    containerRef={filterContainerRef}
                                                                />
                                                            )}
                                                        </>
                                                    }
                                                >
                                                    {['project', 'heading', 'labels'].includes(col.key) && (
                                                        <SearchFilter
                                                            columnKey={col.key}
                                                            placeholder={`Search...`}
                                                            value={columnFilters[col.key] || ''}
                                                            onChange={(value) => setColumnFilters(prev => ({ ...prev, [col.key]: value }))}
                                                            isActive={activeFilterKey === col.key}
                                                        />
                                                    )}
                                                </FilterHeaderWrapper>
                                            </div>
                                        )
                                    })),
                                    rowKey: (task: Task) => task.id,
                                    onRowClick: handleTaskClick,
                                    onSort: handleSort,
                                    onFilter: handleFilter,
                                }}
                            />
                            {/* Infinite-scroll sentinel — triggers next-page fetch when visible */}
                            <div ref={sentinelRef} className="h-1" aria-hidden="true" />

                            {/* Loading indicator while fetching more pages */}
                            {isFetchingNextPage && (
                                <div className="flex justify-center items-center py-3">
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
                                    <span className="ml-2 text-xs text-gray-400">Loading more tasks…</span>
                                </div>
                            )}

                            {viewMode === 'table' && !isInlineCreating && (
                                <div
                                    className="p-3 border-t border-[#dfe1e6] bg-white cursor-pointer hover:bg-gray-50 transition-colors rounded-b-md -mt-px"
                                    onClick={() => setIsInlineCreating(true)}
                                >
                                    <div className="flex items-center gap-2 text-gray-500 text-[13px] font-medium pl-1">
                                        <Plus className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                                        <span className="hover:text-blue-600 transition-colors">Create</span>
                                    </div>
                                </div>
                            )}
                            {viewMode === 'table' && isInlineCreating && (
                                <InlineCreateRow
                                    columns={tableColumns}
                                    onCancel={() => setIsInlineCreating(false)}
                                    queryClient={queryClient}
                                />
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <Outlet />
            )}

            {selectedTask && (
                <TaskDetailModal
                    task={selectedTask}
                    onClose={handleCloseTaskDetail}
                    onDelete={handleDeleteTask}
                    onTaskUpdated={handleSelectedTaskUpdate}
                />
            )}

            {showAITaskModal && (
                <AITask
                    onClose={() => setShowAITaskModal(false)}
                    onGenerate={handleAITaskGenerate}
                />
            )}

            {isActivityOpen && (
                <NotificationsPage
                    onClose={() => setIsActivityOpen(false)}
                    defaultFilter="unread"
                />
            )}
            {showDateFieldDropdown && dropdownPos && dropdownPos.top !== undefined && ReactDOM.createPortal(
                <div
                    style={{ position: 'absolute', top: dropdownPos?.top ?? 0, left: dropdownPos?.left ?? 0, zIndex: 9999 }}
                    className="bg-white border border-gray-200 rounded-lg shadow-lg min-w-[130px] py-1"
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    {DATE_FIELD_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                setDateField(opt.value);
                                setShowDateFieldDropdown(false);
                                setDropdownPos(null);
                                clearFilter(dateField);
                                setActiveFilterKey(null);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-purple-50 hover:text-purple-700 transition-colors ${dateField === opt.value ? 'font-semibold text-purple-600 bg-purple-50' : 'text-gray-700'}`}
                        >
                            {dateField === opt.value && <span className="mr-1.5">✓</span>}{opt.label}
                        </button>
                    ))}
                </div>,
                document.body
            )}
            {/* Person Field Dropdown */}
            {showPersonFieldDropdown && dropdownPos && createPortal(
                <div
                    data-person-dropdown="true" // ✅ ADD THIS
                    style={{ position: 'absolute', top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999 }}
                    className="bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]"
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    {PERSON_FIELD_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                // Clear all filters when switching
                                clearFilter('assigned_to');
                                clearFilter('created_by');
                                clearFilter('updated_by');
                                setPersonField(opt.value);
                                setShowPersonFieldDropdown(false);
                                setDropdownPos(null);
                                setActiveFilterKey(null);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-purple-50 hover:text-purple-700 transition-colors ${personField === opt.value ? 'font-semibold text-purple-600 bg-purple-50' : 'text-gray-700'}`}
                        >
                            {personField === opt.value && <span className="mr-1.5">✓</span>}{opt.label}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
};