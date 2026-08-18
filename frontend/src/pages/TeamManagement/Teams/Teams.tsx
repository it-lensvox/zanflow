import { useCallback } from 'react';
import { Plus, Users } from 'lucide-react';
import { ViewToggle, DualView, useViewMode } from '@/components/layout/DualView';
import { SearchFilter, FilterHeaderWrapper } from '@/components/layout/DualView/FilterComponents';
import { Button, Card, CardContent } from '@/components/common';
import DeleteModal from '@/components/common/Deletemodal';
import { CreateTeamModal } from './components/Createteammodal';
import { useTeams }             from './hooks/useTeams';
import { TeamGridCard }         from './components/TeamGridCard';
import { getTeamsTableColumns } from './components/TeamsTableColumns';
import { TEXT, MUTED, LINE } from '@/config/tokens';
import type { Team } from '@/types';


export function Teams() {
  const {
    filteredTeams, isLoading,
    isCreateModalOpen, setIsCreateModalOpen,
    teamToDelete,
    toggleFavorite, handleMemberAdded, handleTeamCreated,
    handleDeleteClick, handleCancelDelete, handleConfirmDelete,
    handleSort,
    columnFilters, setColumnFilters,
    activeFilterKey, setActiveFilterKey,
    filterContainerRef,
  } = useTeams();

  const { viewMode, setViewMode } = useViewMode({
    defaultMode: 'table',
    storageKey: 'teams-view-mode',
  });

  const handleFilter = useCallback((key: string) => {
    setActiveFilterKey(prev => prev === key ? null : key);
  }, [setActiveFilterKey]);

  const columns = getTeamsTableColumns(toggleFavorite, handleMemberAdded, handleDeleteClick);

  const emptyState = (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Users className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground">No teams yet</h3>
        <p className="text-muted-foreground mb-4 text-sm">Create your first team to get started</p>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />Create Team
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <>
      <div
        className="flex flex-col h-full overflow-hidden px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40 pt-6 pb-8"
        style={{ background: 'hsl(var(--background))' }}
      >
        {/* ── Card container — matches Projects page */}
        <div
          className="flex flex-col flex-1 rounded-xl overflow-hidden"
          style={{ background: 'hsl(var(--card))', border: `1px solid ${LINE}`, boxShadow: '0 1px 4px rgba(16,24,40,.06)' }}
        >
          {/* ── Header */}
          <div
            className="flex-shrink-0 px-6 pt-6 pb-4"
            style={{ borderBottom: `1px solid ${LINE}`, background: 'hsl(var(--card))' }}
          >
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: TEXT, letterSpacing: '-.02em' }}>
                  Teams
                </h1>
                <p style={{ margin: '4px 0 0', fontSize: 14, color: MUTED }}>
                  Manage your team structure and members
                </p>
              </div>
              <div className="flex items-center gap-3">
                <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} modes={['table', 'grid']} showLabels={false} />
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Create Team
                </Button>
              </div>
            </div>
          </div>

          {/* ── Scrollable content */}
          <div className="flex-1 overflow-auto">
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
                    onDelete={handleDeleteClick}
                  />
                ),
                emptyState,
                gridClassName: 'grid gap-4 p-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
              }}
              tableProps={{
                data: filteredTeams,
                activeFilterKey,
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
                          columnKey="name"
                          placeholder="Search teams..."
                          value={columnFilters['name'] || ''}
                          onChange={value => setColumnFilters(prev => ({ ...prev, name: value }))}
                          isActive={activeFilterKey === 'name'}
                        />
                      </FilterHeaderWrapper>
                    </div>
                  ) : col.label,
                })),
                rowKey: (team: Team) => team.id,
                onRowClick: () => {},
                emptyState,
                rowClassName: () => 'group',
                onSort: handleSort,
                onFilter: (key: string) => { if (key === 'name') handleFilter(key); },
              }}
            />
          </div>
        </div>
      </div>

      <CreateTeamModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleTeamCreated}
      />

      <DeleteModal
        isOpen={!!teamToDelete}
        type="confirm"
        itemType="team"
        itemName={teamToDelete?.name}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </>
  );
}