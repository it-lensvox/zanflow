import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, Bell, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Card, CardContent } from '@/components/common';
import { projectsApi } from '@/services/api';
import type { Project } from '@/types';
import { cn } from '@/lib/utils';
import { ViewToggle, DualView, useViewMode, } from '@/components/layout/DualView';
import {
  getProjectsTableColumns, ProjectGridCard,
} from '@/components/layout/DualView/projectsConfig';
import { useTableFilters, ColumnFilterConfig } from '@/hooks/useTableFilters';
import { SearchFilter, FilterHeaderWrapper } from '@/components/layout/DualView/FilterComponents';
import { useOutletContext } from 'react-router-dom';
import { CreateProjectModal } from './CreateProjectModal';
import { useNotifications } from '@/hooks/useNotifications';
const GRID_PAGE_SIZE = 20;


// Project type filter definitions — order matches the colour legend in the table
const PROJECT_TYPE_FILTERS = [
  { label: 'Client',           value: 'client',           dot: 'bg-blue-500'  },
  { label: 'Internal',         value: 'internal',         dot: 'bg-green-500' },
  { label: 'Content Creation', value: 'content_creation', dot: 'bg-pink-500'  },
  { label: 'Ideas',            value: 'ideas',            dot: 'bg-yellow-500'},
] as const;

export function Projects() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [gridPage, setGridPage] = useState(1);
  const { viewMode, setViewMode } = useViewMode({
    defaultMode: 'table',
    storageKey: 'projects-view-mode',
  });

  const toggleFavorite = async (e: React.MouseEvent, project: Project) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await projectsApi.update(project.id, {
        is_favourite: !project.is_favourite,
      });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };
  const columns = getProjectsTableColumns(toggleFavorite);
  const { unreadCount } = useNotifications();

  const { isActivityOpen, setIsActivityOpen } = useOutletContext<{
    isActivityOpen: boolean;
    setIsActivityOpen: (open: boolean) => void;
  }>();

  const { data, isLoading } = useQuery({
    queryKey: ['projects', filter],
    queryFn: () => projectsApi.list(filter ? { task_type: filter } : undefined),
    staleTime: 1000 * 60 * 10,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const projects = (() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (
      typeof data === 'object' &&
      'results' in data &&
      Array.isArray(data.results)
    ) {
      return data.results;
    }
    return [];
  })() as Project[];

  // Filter configuration
  const filterConfig: ColumnFilterConfig[] = [
    { key: 'name', type: 'search' },
  ];

  // Initialize filter hook
  const {
    filteredData: filteredProjects,
    handleSort,
    columnFilters,
    setColumnFilters,
    activeFilterKey,
    setActiveFilterKey,
    filterContainerRef,
  } = useTableFilters<Project>({
    data: projects,
    columns: filterConfig,
    globalSearchFields: ['name'],
  });

  // Client-side pagination for grid view
  const totalGridPages = Math.ceil(filteredProjects.length / GRID_PAGE_SIZE);
  const pagedProjects = filteredProjects.slice(
    (gridPage - 1) * GRID_PAGE_SIZE,
    gridPage * GRID_PAGE_SIZE,
  );

  // Reset grid page when filters/data change
  const resetGridPage = useCallback(() => setGridPage(1), []);

  // Prefetch project data on hover for instant navigation
  const handleRowHover = useCallback((project: any) => {
    queryClient.prefetchQuery({
      queryKey: ['project', String(project.id)],
      queryFn: () => projectsApi.get(project.id),
      staleTime: 1000 * 60 * 5,
    });
  }, [queryClient]);

  // Handle filter toggle
  const handleFilter = useCallback((key: string) => {
    setActiveFilterKey(prev => prev === key ? null : key);
    resetGridPage();
  }, [setActiveFilterKey, resetGridPage]);

  const emptyState = (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No projects yet</h3>
        <p className="text-muted-foreground mb-4">
          Create your first project to get started
        </p>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          New Project
        </Button>
      </CardContent>
    </Card>
  );

  const paginationControls = viewMode === 'grid' && filteredProjects.length > GRID_PAGE_SIZE && (
    <div className="flex items-center justify-between px-4 py-3 border-t bg-background shrink-0">
      <div className="text-sm text-muted-foreground">
        Showing page {gridPage} of {totalGridPages} ({filteredProjects.length} total projects)
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setGridPage((prev) => Math.max(1, prev - 1))}
          disabled={gridPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <span className="text-sm font-medium px-3 py-1 rounded bg-primary text-primary-foreground">
          {gridPage}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setGridPage((prev) => Math.min(totalGridPages, prev + 1))}
          disabled={gridPage === totalGridPages}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex w-full h-screen">
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-8 pt-8 shrink-0">
            <div>
              <h1 className="text-3xl font-bold">Projects</h1>
              <p className="text-muted-foreground">
                Manage your ground truth and testing projects
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ViewToggle viewMode={viewMode} onViewModeChange={(mode) => { setViewMode(mode); resetGridPage(); }} />
              <Button onClick={() => setIsCreateModalOpen(true)}>
                New Project
              </Button>
              <Button
                className="relative"
                onClick={() => setIsActivityOpen(!isActivityOpen)}
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Project-type filter pills */}
          <div className="flex items-center gap-2 px-8 pt-4 shrink-0">
            <span className="text-xs text-muted-foreground font-medium mr-1">Filter:</span>
            {PROJECT_TYPE_FILTERS.map(({ label, value, dot }) => {
              const isActive = filter === value;
              return (
                <button
                  key={value}
                  onClick={() => { setFilter(isActive ? '' : value); resetGridPage(); }}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150',
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground',
                  )}
                >
                  <span className={`h-2 w-2 rounded-full shrink-0 ${dot}`} />
                  {label}
                </button>
              );
            })}
            {filter && (
              <button
                onClick={() => { setFilter(''); resetGridPage(); }}
                className="ml-1 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Projects View */}
          <div className="flex-1 overflow-hidden px-8 pb-4 pt-6 min-h-0 flex flex-col">
            <div className="flex-1 overflow-auto">
              <DualView
                viewMode={viewMode}
                isLoading={isLoading}
                gridProps={{
                  data: pagedProjects,
                  renderCard: (project: any) => (
                    <ProjectGridCard
                      key={project.id}
                      project={project}
                      onToggleFavorite={toggleFavorite}
                    />
                  ),
                  emptyState,
                  gridClassName: 'grid gap-4 md:grid-cols-2 lg:grid-cols-4',
                }}
                tableProps={{
                  data: filteredProjects,
                  activeFilterKey: activeFilterKey,
                  columns: columns.map(col => ({
                    ...col,
                    headerClassName: `relative ${activeFilterKey === col.key ? 'z-[100]' : ''}`,
                    label: col.key === 'name' ? (
                      <div ref={activeFilterKey === col.key ? filterContainerRef : null}>
                        <FilterHeaderWrapper
                          columnLabel="Project"
                          filterType="search"
                          isActive={activeFilterKey === col.key}
                        >
                          <SearchFilter
                            columnKey={col.key}
                            placeholder="Search..."
                            value={columnFilters[col.key] || ''}
                            onChange={(value) => setColumnFilters(prev => ({ ...prev, [col.key]: value }))}
                            isActive={activeFilterKey === col.key}
                          />
                        </FilterHeaderWrapper>
                      </div>
                    ) : col.label
                  })),
                  rowKey: (project: any) => project.id,
                  onRowClick: (project: any) =>
                    navigate(`/projects/${project.id}`),
                  onRowMouseEnter: handleRowHover,
                  emptyState,
                  rowClassName: () => 'group',
                  onSort: handleSort,
                  onFilter: (key: string) => {
                    if (key === 'name') {
                      handleFilter(key);
                    }
                  },
                }}
              />
            </div>
            {paginationControls}
          </div>
        </div>
      </div>
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        navigateOnSuccess={false}
      />
    </div>
  );
}