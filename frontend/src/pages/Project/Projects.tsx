import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { FolderKanban, Bell } from 'lucide-react';
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
    clearFilter,
    activeFilterKey,
    setActiveFilterKey,
    filterContainerRef,
  } = useTableFilters<Project>({
    data: projects,
    columns: filterConfig,
    globalSearchFields: ['name'],
  });

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
  }, [setActiveFilterKey]);

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

  return (
    <div className="w-full p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground">
            Manage your ground truth and testing projects
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
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

      {/* ── Project-type filter pills ── */}
      <div className="flex items-center gap-2 -mt-4">
        <span className="text-xs text-muted-foreground font-medium mr-1">Filter:</span>
        {PROJECT_TYPE_FILTERS.map(({ label, value, dot }) => {
          const isActive = filter === value;
          return (
            <button
              key={value}
              onClick={() => setFilter(isActive ? '' : value)}
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
            onClick={() => setFilter('')}
            className="ml-1 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <DualView
        viewMode={viewMode}
        isLoading={isLoading}
        gridProps={{
          data: filteredProjects,
          renderCard: (project: any) => (
            <ProjectGridCard
              key={project.id}
              project={project}
              onToggleFavorite={toggleFavorite}
            />
          ),
          emptyState,
          gridClassName: 'grid gap-4 md:grid-cols-2 lg:grid-cols-3',
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
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        navigateOnSuccess={false}
      />
    </div>
  );
}