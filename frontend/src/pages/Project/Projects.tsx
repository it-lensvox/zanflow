import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, FolderKanban, Bell } from 'lucide-react';
import { Button, Card, CardContent } from '@/components/common';
import { notificationsApi, projectsApi } from '@/services/api';
import type { Project } from '@/types';
import { ViewToggle, DualView, useViewMode, } from '@/components/layout/DualView';
import {
  getProjectsTableColumns,
  ProjectGridCard,
} from '@/components/layout/DualView/projectsConfig';
import { useTableFilters, ColumnFilterConfig } from '@/hooks/useTableFilters';
import { SearchFilter, FilterHeaderWrapper } from '@/components/layout/DualView/FilterComponents';
import { useOutletContext } from 'react-router-dom';

export function Projects() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>('');
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

  const { data: summary } = useQuery({
    queryKey: ['notifications-summary'],
    queryFn: () => notificationsApi.getSummary(),
    refetchInterval: 30000,
  });

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

  // Filter configuration - only for Project column
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
        <Link to="/projects/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </Link>
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
          <Link to="/projects/new">
            <Button>
              New Project
            </Button>
          </Link>
          <Button
            className="relative"
            onClick={() => setIsActivityOpen(!isActivityOpen)}
          >
            <Bell className="h-5 w-5" />
            {(summary?.unread ?? 0) > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {summary?.unread}
              </span>
            )}
          </Button>
        </div>
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
            (window.location.href = `/projects/${project.id}`),
          emptyState,
          rowClassName: () => 'group',
          onSort: handleSort,
          onFilter: (key: string) => {
            // Only allow filter on 'name' column
            if (key === 'name') {
              handleFilter(key);
            }
          },
        }}
      />
    </div>
  );
}