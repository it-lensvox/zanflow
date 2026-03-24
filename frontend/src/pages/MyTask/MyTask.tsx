import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
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
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationsPage } from '../NotificationsPage';

const DATE_FIELD_OPTIONS: { value: 'end_date' | 'start_date' | 'created_at'; label: string }[] = [
    { value: 'end_date', label: 'Due Date' },
    { value: 'start_date', label: 'Start Date' },
    { value: 'created_at', label: 'Created At' },
];

// ── Module-level flag: sanitise the tasks cache exactly once per page load ──
let _taskCacheSanitised = false;

function sanitiseTaskCache(queryClient: import('@tanstack/react-query').QueryClient) {
    if (_taskCacheSanitised) return;
    _taskCacheSanitised = true;
    const existing = queryClient.getQueryData(['tasks']);
    const isValidInfiniteShape =
        existing &&
        typeof existing === 'object' &&
        Array.isArray((existing as any).pages) &&
        (existing as any).pages.every(
            (p: any) => p && typeof p === 'object' && Array.isArray(p.results)
        );
    if (!isValidInfiniteShape) {
        console.log('[MyTask] 🧹 One-time cache sanitise. shape was:', existing ? typeof existing : 'null');
        queryClient.removeQueries({ queryKey: ['tasks'] });
    } else {
        console.log('[MyTask] ✅ Cache already valid. Keeping', (existing as any).pages.length, 'pages.');
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
    const [showDateFieldDropdown, setShowDateFieldDropdown] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [showAITaskModal, setShowAITaskModal] = useState(false);
    const activeFilter = location.pathname.split('/').filter(p => p)[1]?.toUpperCase() || 'ALL';

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
        queryFn: ({ pageParam = 1 }) => taskApi.listPaginated(pageParam as number),
        getNextPageParam: (lastPage) => {
            if (!lastPage || typeof lastPage !== 'object') return undefined;
            if (!('next' in lastPage) || !lastPage.next) return undefined;
            try {
                const url = new URL(lastPage.next);
                const p = url.searchParams.get('page');
                return p ? Number(p) : undefined;
            } catch {
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
            const assigneeFilterValue = columnFilters['assigned_to'];
            const matchesAssignee = !assigneeFilterValue ||
                (task.assigned_to || []).map(String).includes(String(assigneeFilterValue));
            return matchesFilter && matchesSearch && matchesAssignee;
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
    }), [handleTaskClick, queryClient, user, navigate, dateField]);
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

    return (
        <div className="w-full p-8 space-y-8">
            {location.pathname.startsWith('/taskboard') && !location.pathname.endsWith('/create') ? (
                <>
                    <div>
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
                                        className="w-full pl-9 pr-4 py-2 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                    />
                                </div>
                                <div className="flex items-center border border-gray-200 rounded-md bg-white p-1 gap-1">
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

                        {/* Content Section*/}
                        <div className="space-y-0 mt-6 flex-1 flex flex-col">
                            <DualView
                                viewMode={viewMode}
                                isLoading={loading}
                                gridProps={{
                                    data: filteredTasks,
                                    renderCard: (task: Task) => <TaskGridCard task={task} onTaskClick={handleTaskClick} />,
                                    gridClassName: "grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
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
                                                    columnLabel={col.key === dateField ? DateFieldLabel : col.label as string}
                                                    filterType={
                                                        ['project', 'heading', 'labels'].includes(col.key) ? 'search' :
                                                            ['status', 'priority', 'assigned_to'].includes(col.key) ? 'list' :
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
                                                            {col.key === 'assigned_to' && (
                                                                <ListFilter
                                                                    columnKey="assigned_to"
                                                                    options={(usersData || []).map(u => ({
                                                                        value: String(u.id),
                                                                        label: `${u.first_name} ${u.last_name}`.trim() || u.username,
                                                                    }))}
                                                                    selectedValue={columnFilters['assigned_to'] || ''}
                                                                    onSelect={(value) => { setColumnFilters(prev => ({ ...prev, assigned_to: value })); setActiveFilterKey(null); }}
                                                                    onClear={() => { clearFilter('assigned_to'); setActiveFilterKey(null); }}
                                                                    isActive={activeFilterKey === 'assigned_to'}
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

                            {viewMode === 'table' && (
                                <div
                                    className="p-3 border-t border-[#dfe1e6] bg-white cursor-pointer hover:bg-gray-50 transition-colors rounded-b-md -mt-px"
                                    onClick={() => navigate('/taskboard/create')}
                                >
                                    <div className="flex items-center gap-2 text-gray-500 text-[13px] font-medium pl-1">
                                        <Plus className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                                        <span className="hover:text-blue-600 transition-colors">Create</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </>
                //     )
                // ) : (
                //     <Outlet />
                // )}
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
            {showDateFieldDropdown && dropdownPos && ReactDOM.createPortal(
                <div
                    style={{ position: 'absolute', top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999 }}
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
        </div>
    );
};