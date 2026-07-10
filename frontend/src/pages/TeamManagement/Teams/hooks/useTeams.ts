import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { teamsApi } from '@/services/api';
import { useTableFilters } from '@/hooks/useTableFilters';
import type { Team } from '@/types';

export function useTeams() {
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [teamToDelete, setTeamToDelete]           = useState<Team | null>(null);

  // ── Data fetching
  const { data, isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.list(),
    staleTime: 1000 * 60 * 10,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const teams: Team[] = (() => {
    if (!data) return [];
    if (Array.isArray(data)) return data as Team[];
    if (typeof data === 'object' && 'results' in data && Array.isArray((data as any).results))
      return (data as any).results as Team[];
    return [];
  })();

  // ── Column filters (matches Project pattern)
  const {
    filteredData: filteredTeams,
    handleSort,
    columnFilters,
    setColumnFilters,
    activeFilterKey,
    setActiveFilterKey,
    filterContainerRef,
  } = useTableFilters<Team>({
    data: teams,
    columns: [{ key: 'name', type: 'search' }],
    globalSearchFields: ['name'],
  });

  // ── Actions
  const toggleFavorite = useCallback(async (e: React.MouseEvent, team: Team) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await teamsApi.toggleFavorite(team.id, !team.is_favourite);
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    } catch (error) {
      console.error('Failed to toggle favourite:', error);
    }
  }, [queryClient]);

  const handleMemberAdded = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['teams'] });
  }, [queryClient]);

  const handleTeamCreated = useCallback(() => {
    setIsCreateModalOpen(false);
    queryClient.invalidateQueries({ queryKey: ['teams'] });
  }, [queryClient]);

  const handleDeleteClick  = useCallback((team: Team) => setTeamToDelete(team), []);
  const handleCancelDelete = useCallback(() => setTeamToDelete(null), []);

  const handleConfirmDelete = useCallback(async () => {
    if (!teamToDelete) return;
    try {
      await teamsApi.delete(teamToDelete.id);
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setTeamToDelete(null);
    } catch (error) {
      console.error('Failed to delete team:', error);
    }
  }, [teamToDelete, queryClient]);

  return {
    // data
    teams,
    filteredTeams,
    isLoading,
    // modal state
    isCreateModalOpen,
    setIsCreateModalOpen,
    teamToDelete,
    // actions
    toggleFavorite,
    handleMemberAdded,
    handleTeamCreated,
    handleDeleteClick,
    handleCancelDelete,
    handleConfirmDelete,
    // filter
    handleSort,
    columnFilters,
    setColumnFilters,
    activeFilterKey,
    setActiveFilterKey,
    filterContainerRef,
  };
}