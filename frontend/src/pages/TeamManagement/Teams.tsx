import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Users } from 'lucide-react';
import { Button, Card, CardContent } from '@/components/common';
import { teamsApi } from '@/services/api';
import type { Team } from '@/types';
import { ViewToggle, DualView, useViewMode } from '@/components/layout/DualView';
import {
  getTeamsTableColumns,
  TeamGridCard,
} from '@/components/layout/DualView/TeamsConfig';
import { useTableFilters, ColumnFilterConfig } from '@/hooks/useTableFilters';
import { SearchFilter, FilterHeaderWrapper } from '@/components/layout/DualView/FilterComponents';
import { CreateTeamModal } from './Createteammodal';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  teamName: string;
}

function DeleteConfirmationModal({ isOpen, onClose, onConfirm, teamName }: DeleteConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Icon */}
        <div className="flex justify-center pt-6">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Confirm Deletion
          </h3>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <span className="font-medium text-gray-900">"{teamName}"</span>?
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            No
          </Button>
          <Button
            onClick={onConfirm}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
          >
            Yes
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Teams() {
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
  const { viewMode, setViewMode } = useViewMode({
    defaultMode: 'table',
    storageKey: 'teams-view-mode',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.list(),
    staleTime: 1000 * 60 * 10,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const teams = (() => {
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
  })() as Team[];

  const toggleFavorite = async (e: React.MouseEvent, team: Team) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await teamsApi.toggleFavorite(team.id, !team.is_favourite);
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };
  const handleMemberAdded = () => {
    queryClient.invalidateQueries({ queryKey: ['teams'] });
  };

  const handleTeamCreated = () => {
    setIsCreateModalOpen(false);
    queryClient.invalidateQueries({ queryKey: ['teams'] });
  };

  const handleDeleteClick = (team: Team) => {
    setTeamToDelete(team);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!teamToDelete) return;

    try {
      await teamsApi.delete(teamToDelete.id);
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setDeleteModalOpen(false);
      setTeamToDelete(null);
    } catch (error) {
      console.error('Failed to delete team:', error);
      // You can add a toast notification here if you have one
    }
  };

  const handleCancelDelete = () => {
    setDeleteModalOpen(false);
    setTeamToDelete(null);
  };

  const columns = getTeamsTableColumns(toggleFavorite, handleMemberAdded, handleDeleteClick);

  // Filter configuration - only for Team Name column
  const filterConfig: ColumnFilterConfig[] = [
    { key: 'name', type: 'search' },
  ];

  // Initialize filter hook
  const {
    filteredData: filteredTeams,
    handleSort,
    columnFilters,
    setColumnFilters,
    clearFilter,
    activeFilterKey,
    setActiveFilterKey,
    filterContainerRef,
  } = useTableFilters<Team>({
    data: teams,
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
        <Users className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No teams yet</h3>
        <p className="text-muted-foreground mb-4">
          Create your first team to get started
        </p>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Team
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <>
      <div className="w-full h-full flex flex-col">
        {/* Static Header */}
        <div className="flex-shrink-0 px-8 pt-8 pb-4 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Teams</h1>
              <p className="text-muted-foreground">
                Manage your team structure and members
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
              <Button onClick={() => setIsCreateModalOpen(true)}>
                Create Team
              </Button>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto px-8 py-6">
          <DualView
            viewMode={viewMode}
            isLoading={isLoading}
            gridProps={{
              data: filteredTeams,
              renderCard: (team: Team) => (
                <TeamGridCard
                  key={team.id}
                  team={team}
                  onToggleFavorite={toggleFavorite}
                  onMemberAdded={handleMemberAdded}
                />
              ),
              emptyState,
              gridClassName: 'grid gap-4 md:grid-cols-2 lg:grid-cols-3',
            }}
            tableProps={{
              data: filteredTeams,
              activeFilterKey: activeFilterKey,
              columns: columns.map(col => ({
                ...col,
                headerClassName: `relative ${activeFilterKey === col.key ? 'z-[100]' : ''}`,
                label: col.key === 'name' ? (
                  <div ref={activeFilterKey === col.key ? filterContainerRef : null}>
                    <FilterHeaderWrapper
                      columnLabel="Team Name"
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
              rowKey: (team: Team) => team.id,
              onRowClick: (team: Team) => { },
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
      </div>

      <CreateTeamModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleTeamCreated}
      />
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        teamName={teamToDelete?.name || ''}
      />
    </>
  );
}
