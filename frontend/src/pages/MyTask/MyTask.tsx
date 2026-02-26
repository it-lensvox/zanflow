import React, { useState, useCallback } from 'react';
import { Plus, Grid3X3, List, Search, Bell, ChevronLeft, ChevronRight } from 'lucide-react';
const GRID_PAGE_SIZE = 20;
import { useNavigate, Outlet, useLocation, useOutletContext } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { taskApi } from '@/services/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

export const MyTask: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
    const [gridPage, setGridPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [showAITaskModal, setShowAITaskModal] = useState(false);
    const activeFilter = location.pathname.split('/').filter(p => p)[1]?.toUpperCase() || 'ALL';

    const { data: tasksData, isLoading: loading } = useQuery({
        queryKey: ['tasks'],
        queryFn: () => taskApi.list(),
        enabled: !!user,
    });

    const tasks = React.useMemo(() => {
        if (!tasksData || !user) return [];
        const allTasks = Array.isArray(tasksData) ? tasksData : tasksData.tasks || tasksData.results || [];
        if (user.role === 'admin') {
            return allTasks;
        }
        if (user.role === 'manager') {
            return allTasks.filter((task: Task) =>
                task.assigned_by === user.id ||
                task.assigned_to.includes(user.id)
            );
        }
        return allTasks.filter((task: Task) =>
            task.assigned_to.includes(user.id)
        );
    }, [tasksData, user]);

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
        { key: 'end_date', type: 'date' },
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
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        setSelectedTask(updatedTask);
    }, [queryClient]);

    const handleDeleteTask = useCallback(async (id: number) => {
        await taskApi.delete(id);
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        setSelectedTask(null);
    }, [queryClient]);

    const filteredTasks = React.useMemo(() => {
        return hookFilteredTasks.filter((task: Task) => {
            const matchesFilter = activeFilter === 'ALL' || task.status.toUpperCase() === activeFilter;
            const matchesSearch = searchQuery.trim() === '' ||
                task.heading.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesFilter && matchesSearch;
        });
    }, [hookFilteredTasks, activeFilter, searchQuery]);

    const totalGridPages = Math.ceil(filteredTasks.length / GRID_PAGE_SIZE);
    const pagedTasks = filteredTasks.slice(
        (gridPage - 1) * GRID_PAGE_SIZE,
        gridPage * GRID_PAGE_SIZE,
    );

    const handleFilter = useCallback((key: string) => {
        setActiveFilterKey(prev => prev === key ? null : key);
        setGridPage(1);
    }, [setActiveFilterKey]);

    const handleAITaskGenerate = useCallback(async (projectId: number, description: string) => {
        console.log('Generating AI task for project:', projectId, 'with description:', description);
    }, []);

    // Create table columns configuration
    const tableColumns = createTasksTableColumns({
        onTaskClick: handleTaskClick,
        queryClient,
        user,
        navigate
    });
    const { unreadCount } = useNotifications();

    const { isActivityOpen, setIsActivityOpen } = useOutletContext<{
        isActivityOpen: boolean;
        setIsActivityOpen: (open: boolean) => void;
    }>();
    const paginationControls = viewMode === 'grid' && filteredTasks.length > GRID_PAGE_SIZE && (
        <div className="flex items-center justify-between px-4 py-3 border-t bg-background shrink-0">
            <div className="text-sm text-muted-foreground">
                Showing page {gridPage} of {totalGridPages} ({filteredTasks.length} total tasks)
            </div>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setGridPage((prev) => Math.max(1, prev - 1))}
                    disabled={gridPage === 1}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-border bg-background hover:bg-accent text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                </button>
                <span className="text-sm font-medium px-3 py-1 rounded bg-primary text-primary-foreground">
                    {gridPage}
                </span>
                <button
                    onClick={() => setGridPage((prev) => Math.min(totalGridPages, prev + 1))}
                    disabled={gridPage === totalGridPages}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-border bg-background hover:bg-accent text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Next
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );

    return (
        <div className="flex w-full h-screen">
            <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
                {location.pathname.startsWith('/taskboard') && !location.pathname.endsWith('/create') ? (
                    loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin h-8 w-8 border-b-2 border-blue-600" />
                        </div>
                    ) : (
                        <div className="flex flex-col h-full">
                            {/* Header Section */}
                            <div className="flex items-center justify-between px-8 pt-8 shrink-0">
                                <div>
                                    <h1 className="text-3xl font-bold text-foreground">Task Board</h1>
                                    <p className="text-lg text-muted-foreground mt-1">Manage and track your tasks efficiently</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {['admin', 'manager', 'annotator'].includes(user?.role || '') && (
                                        <>
                                            <button
                                                onClick={() => navigate('/taskboard/create')}
                                                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                                            >
                                                <Plus className="w-4 h-4 mr-2" />
                                                Create Task
                                            </button>
                                            <button
                                                onClick={() => setShowAITaskModal(true)}
                                                className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 transition-colors shadow-sm"
                                            >
                                                Generate Task by AI
                                            </button>
                                        </>
                                    )}
                                    <Button
                                        variant="outline"
                                        className="relative"
                                        onClick={() => setIsActivityOpen(!isActivityOpen)}
                                    >
                                        <Bell className="h-5 w-5 text-foreground" />
                                        {unreadCount > 0 && (
                                            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                                                {unreadCount}
                                            </span>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {/* Controls Section */}
                            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between px-8 pt-4 shrink-0">
                                <div className="relative flex-1 max-w-sm">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                    <input
                                        type="text"
                                        placeholder="Search tasks..."
                                        value={searchQuery}
                                        onChange={(e) => { setSearchQuery(e.target.value); setGridPage(1); }}
                                        className="w-full pl-9 pr-4 py-2 text-sm rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground placeholder:text-muted-foreground"
                                    />
                                </div>
                                <div className="flex items-center border border-border rounded-md bg-card p-1 gap-1">
                                    <button
                                        onClick={() => { setViewMode('table'); setGridPage(1); }}
                                        className={`p-1.5 rounded transition-colors ${viewMode === 'table' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'}`}
                                        title="Table View"
                                    >
                                        <List className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => { setViewMode('grid'); setGridPage(1); }}
                                        className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'}`}
                                        title="Grid View"
                                    >
                                        <Grid3X3 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Content Section */}
                            <div className="flex-1 overflow-hidden px-8 pb-4 pt-6 min-h-0 flex flex-col">
                                <div className="flex-1 overflow-auto">
                                    <DualView
                                        viewMode={viewMode}
                                        isLoading={loading}
                                        gridProps={{
                                            data: pagedTasks,
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
                                                    <div ref={activeFilterKey === col.key ? filterContainerRef : null}>
                                                        <FilterHeaderWrapper
                                                            columnLabel={col.label as string}
                                                            filterType={
                                                                ['project', 'heading', 'labels'].includes(col.key) ? 'search' :
                                                                    ['status', 'priority'].includes(col.key) ? 'list' :
                                                                        col.key === 'end_date' ? 'date' : 'none'
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
                                                                    {col.key === 'end_date' && (
                                                                        <DateFilter
                                                                            columnKey="end_date"
                                                                            value={columnFilters.end_date || ''}
                                                                            onChange={(value) => { setColumnFilters(prev => ({ ...prev, end_date: value })); setActiveFilterKey(null); }}
                                                                            onClear={() => { clearFilter('end_date'); setActiveFilterKey(null); }}
                                                                            isActive={activeFilterKey === 'end_date'}
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
                                    {viewMode === 'table' && (
                                        <div
                                            className="p-3 border-t border-border bg-card cursor-pointer hover:bg-accent/50 transition-colors rounded-b-md -mt-px"
                                            onClick={() => navigate('/taskboard/create')}
                                        >
                                            <div className="flex items-center gap-2 text-muted-foreground text-[13px] font-medium pl-1">
                                                <Plus className="w-4 h-4 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                                                <span className="hover:text-primary transition-colors">Create</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {paginationControls}
                            </div>
                        </div>
                    )
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
            </div>
        </div>
    );
};