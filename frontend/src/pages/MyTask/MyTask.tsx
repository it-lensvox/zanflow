import React, { useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Plus, Check, Trash2 } from 'lucide-react';
import { DualView }           from '@/components/layout/DualView/DualView';
import DeleteModal            from '@/components/common/Deletemodal';
import { TaskGridCard, createTasksTableColumns, getStatusConfig, priorityOptions, statusOptions } from '@/components/layout/DualView/taskConfig';
import { FilterHeaderWrapper, SearchFilter, ListFilter, DateFilter } from '@/components/layout/DualView/FilterComponents';
import { InlineCreateRow }    from '@/components/layout/CreateTask/InlineCreateRow';
import { TaskDetailModal }    from './TaskDetail/Components/TaskDetailModal';
import { AITask }             from './components/AITask';
import { NotificationsPage }  from '../NotificationsPage';
import { TaskBoardHeader }    from './components/TaskBoardHeader';
import { FieldSwitcherDropdown } from './components/FieldSwitcherDropdown';
import { useMyTask }          from './hooks/useMyTask';
import { DATE_FIELD_OPTIONS, PERSON_FIELD_OPTIONS, LINE } from './taskBoardConstants';
import type { Task } from '@/types';

export const MyTask: React.FC = () => {
  const location = useLocation();
  const t = useMyTask();

  const isBoard = location.pathname.startsWith('/taskboard') && !location.pathname.endsWith('/create');
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showBulkDeleteDenied, setShowBulkDeleteDenied] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const handleBulkDeleteClick = () => {
    // Mirror the same permission check used in TaskDetailModal:
    // user?.id === task.assigned_by (the creator)
    const unauthorised = t.filteredTasks
      .filter((task: Task) => t.selectedTaskIds.has(task.id))
      .some((task: Task) => task.assigned_by !== t.user?.id);

    if (unauthorised) {
      setShowBulkDeleteDenied(true);
    } else {
      setShowBulkDeleteConfirm(true);
    }
  };

  const handleBulkDeleteConfirmed = async () => {
    setIsBulkDeleting(true);
    await t.handleBulkDeleteTasks();
    setIsBulkDeleting(false);
    setShowBulkDeleteConfirm(false);
  };

  // Table columns 
  const tableColumns = useMemo(() => createTasksTableColumns({
    selectionProps: {
      selectedIds: t.selectedTaskIds,
      toggleSelect: t.toggleTaskSelect,
      toggleAll: t.toggleAllTasks,
      visibleTasks: t.filteredTasks,
    },
    onTaskClick: t.handleTaskClick,
    queryClient: t.queryClient,
    user:        t.user,
    navigate:    t.navigate,
    dateField:   t.dateField,
    personField: t.personField,
  }), [
    t.selectedTaskIds,
    t.filteredTasks, 
    t.toggleTaskSelect,
    t.toggleAllTasks,
    t.handleTaskClick,
    t.queryClient,
    t.user,
    t.navigate,
    t.dateField,
    t.personField,
  ]);

  // Column labels with interactive switcher buttons
  const DateFieldLabel = useMemo(() => (
    <button
      ref={t.dateTriggerRef}
      onClick={t.openDateDropdown}
      className="flex items-center gap-1 text-[14px] font-bold tracking-wide text-gray-700 hover:text-purple-600 transition-colors"
    >
      {t.activeDateLabel}
      <svg className="w-3 h-3 mt-0.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  ), [t.dateField, t.activeDateLabel]);

  const PersonFieldLabel = useMemo(() => (
    <button
      ref={t.personTriggerRef}
      type="button"
      onClick={t.openPersonDropdown}
      className="flex items-center gap-1 text-[14px] font-bold tracking-wide text-gray-700 hover:text-purple-600 transition-colors"
    >
      {t.activePersonLabel}
      <svg className="w-3 h-3 mt-0.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  ), [t.personField, t.activePersonLabel]);

  if (!isBoard) return <Outlet />;

  return (
   <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#fff', overflow: 'hidden' }}>

      {/* ── Sticky header ── */}
      <TaskBoardHeader
        searchQuery={t.searchQuery}
        setSearchQuery={t.setSearchQuery}
        viewMode={t.viewMode}
        setViewMode={t.setViewMode}
        canCreate={['admin', 'manager', 'annotator'].includes(t.user?.role || '')}
        onCreateTask={() => t.navigate('/taskboard/create')}
        onAITask={() => t.setShowAITaskModal(true)}
      />

      {/* ── Responsive grid CSS ── */}
      <style>{`
        .task-grid { display: grid; gap: 16px; padding: 0; grid-template-columns: repeat(1, 1fr); }
        @media (min-width: 480px)  { .task-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 860px)  { .task-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 1200px) { .task-grid { grid-template-columns: repeat(4, 1fr); } }
      `}</style>

      {/* ── Scrollable content ── */}
      <div
        className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40"
        style={{ flex: 1, overflowY: 'auto', paddingTop: 24, paddingBottom: 32 }}
      >
        {t.viewMode === 'table' && t.selectedTaskIds.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 4, background: '#f8faff', border: '1px solid #dfe1e6', borderRadius: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1663f6', background: '#EEF4FF', border: '1px solid #c7d7fd', borderRadius: 6, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={13} strokeWidth={3} /> {t.selectedTaskIds.size} selected
            </span>
            <button
              onClick={handleBulkDeleteClick}
              style={{ height: 32, border: '1px solid #fca5a5', borderRadius: 6, background: '#fff', padding: '0 14px', fontSize: 13, fontWeight: 600, display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer', color: '#dc2626' }}
            >
              <Trash2 size={13} /> Delete
            </button>
            <button
              onClick={() => t.toggleAllTasks(t.filteredTasks)}
              style={{ marginLeft: 'auto', height: 32, border: '1px solid #e5e7eb', borderRadius: 6, background: 'none', padding: '0 12px', fontSize: 13, fontWeight: 500, cursor: 'pointer', color: '#667085' }}
            >
              Clear
            </button>
          </div>
        )}
        <DualView
          viewMode={t.viewMode}
          isLoading={t.loading}
          gridProps={{
            data: t.filteredTasks,
            renderCard: (task: Task) => <TaskGridCard task={task} onTaskClick={t.handleTaskClick} />,
            gridClassName: 'task-grid',
          }}
          tableProps={{
            data:            t.filteredTasks,
            activeFilterKey: t.activeFilterKey,
            rowKey:          (task: Task) => task.id,
            onRowClick:      t.handleTaskClick,
            onSort:          t.handleSort,
            onFilter:        t.handleFilter,
            columns: tableColumns.map(col => {
              // ── Avatar-checkbox column: preserve its label exactly as built by taskConfig
              if (col.key === '__select__') return col;

              return {
                ...col,
                headerClassName: `relative ${t.activeFilterKey === col.key ? 'z-[100]' : ''}`,
                label: (
                  <div ref={t.activeFilterKey === col.key ? t.filterContainerRef : null}>
                    <FilterHeaderWrapper
                      columnLabel={
                        col.key === t.personField ? PersonFieldLabel :
                        col.key === t.dateField   ? DateFieldLabel   :
                        col.label as string
                      }
                      filterType={
                        ['project', 'heading', 'labels'].includes(col.key) ? 'search' :
                        ['status', 'priority'].includes(col.key) || col.key === t.personField ? 'list' :
                        col.key === t.dateField ? 'date' : 'none'
                      }
                      isActive={t.activeFilterKey === col.key}
                      filterContent={
                        <>
                          {col.key === 'status' && (
                            <ListFilter
                              columnKey="status"
                              options={statusOptions.map(s => ({
                                value: s.value.toUpperCase(),
                                label: s.label,
                                icon: React.createElement(getStatusConfig(s.value.toUpperCase() as any).icon, { className: 'w-3.5 h-3.5' }),
                                className: getStatusConfig(s.value.toUpperCase() as any).text,
                              }))}
                              selectedValue={t.columnFilters.status || ''}
                              onSelect={v => { t.setColumnFilters(p => ({ ...p, status: v })); t.setActiveFilterKey(null); }}
                              onClear={() => { t.clearFilter('status'); t.setActiveFilterKey(null); }}
                              isActive={t.activeFilterKey === 'status'}
                              containerRef={t.filterContainerRef}
                            />
                          )}
                          {col.key === 'priority' && (
                            <ListFilter
                              columnKey="priority"
                              options={priorityOptions.map(o => ({ value: o.value, label: o.label, icon: <span>{o.icon}</span> }))}
                              selectedValue={t.columnFilters.priority || ''}
                              onSelect={v => { t.setColumnFilters(p => ({ ...p, priority: v })); t.setActiveFilterKey(null); }}
                              onClear={() => { t.clearFilter('priority'); t.setActiveFilterKey(null); }}
                              isActive={t.activeFilterKey === 'priority'}
                              containerRef={t.filterContainerRef}
                            />
                          )}
                          {col.key === t.personField && (
                            <ListFilter
                              columnKey={t.personField}
                              options={(t.usersData || []).map(u => ({
                                value: String(u.id),
                                label: `${u.first_name} ${u.last_name}`.trim() || u.username,
                              }))}
                              selectedValue={t.columnFilters[t.personField] || ''}
                              onSelect={v => { t.setColumnFilters(p => ({ ...p, [t.personField]: v })); t.setActiveFilterKey(null); }}
                              onClear={() => { t.clearFilter(t.personField); t.setActiveFilterKey(null); }}
                              isActive={t.activeFilterKey === t.personField}
                              containerRef={t.filterContainerRef}
                            />
                          )}
                          {col.key === t.dateField && (
                            <DateFilter
                              columnKey={t.dateField}
                              value={t.columnFilters[t.dateField] || ''}
                              onChange={v => { t.setColumnFilters(p => ({ ...p, [t.dateField]: v })); t.setActiveFilterKey(null); }}
                              onClear={() => { t.clearFilter(t.dateField); t.setActiveFilterKey(null); }}
                              isActive={t.activeFilterKey === t.dateField}
                              containerRef={t.filterContainerRef}
                            />
                          )}
                        </>
                      }
                    >
                      {['project', 'heading', 'labels'].includes(col.key) && (
                        <SearchFilter
                          columnKey={col.key}
                          placeholder="Search…"
                          value={t.columnFilters[col.key] || ''}
                          onChange={v => t.setColumnFilters(p => ({ ...p, [col.key]: v }))}
                          isActive={t.activeFilterKey === col.key}
                        />
                      )}
                    </FilterHeaderWrapper>
                  </div>
                ),
              };
            }),
          }}
        />

        {/* ── Pagination bar — shown for both table and grid ── */}
        {(t.viewMode === 'table' || t.viewMode === 'grid') && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 4px', marginTop: 4, gap: 12 }}>
            <span style={{ fontSize: 13, color: '#667085' }}>
              {t.isFetchingNextPage
                ? 'Loading…'
                : `Showing ${t.totalCount === 0 ? 0 : (t.currentPage - 1) * 20 + 1}–${Math.min(t.currentPage * 20, t.totalCount)} of ${t.totalCount} tasks`
              }
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => t.setCurrentPage(p => Math.max(1, p - 1))}
                disabled={!t.hasPrevPage || t.isFetchingNextPage}
                style={{ height: 32, padding: '0 14px', borderRadius: 6, border: '1px solid #dfe1e6', background: '#fff', fontSize: 13, fontWeight: 500, color: t.hasPrevPage ? '#172033' : '#9ca3af', cursor: t.hasPrevPage ? 'pointer' : 'not-allowed' }}
              >
                ← Prev
              </button>
              <span style={{ fontSize: 13, color: '#172033', fontWeight: 600, padding: '0 8px' }}>
                {t.currentPage} / {t.totalPages}
              </span>
              <button
                onClick={() => t.setCurrentPage(p => Math.min(t.totalPages, p + 1))}
                disabled={!t.hasNextPage || t.isFetchingNextPage}
                style={{ height: 32, padding: '0 14px', borderRadius: 6, border: '1px solid #dfe1e6', background: '#fff', fontSize: 13, fontWeight: 500, color: t.hasNextPage ? '#172033' : '#9ca3af', cursor: t.hasNextPage ? 'pointer' : 'not-allowed' }}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Inline create row */}
        {t.viewMode === 'table' && !t.isInlineCreating && (
          <div
            onClick={() => t.setIsInlineCreating(true)}
            style={{ padding: '10px 12px', borderTop: `1px solid ${LINE}`, background: '#fff', cursor: 'pointer', borderRadius: '0 0 8px 8px', marginTop: -1 }}
            className="hover:bg-gray-50 transition-colors"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, color: '#9CA3AF', fontWeight: 500 }}>
              <Plus size={15} className="text-gray-400" />
              <span className="hover:text-blue-600 transition-colors">Create task</span>
            </div>
          </div>
        )}
        {t.viewMode === 'table' && t.isInlineCreating && (
          <InlineCreateRow
            columns={tableColumns}
            onCancel={() => t.setIsInlineCreating(false)}
            queryClient={t.queryClient}
          />
        )}
      </div>

      {/* ── Modals ── */}
      {t.selectedTask && (
        <TaskDetailModal
          task={t.selectedTask}
          onClose={t.handleCloseTaskDetail}
          onDelete={t.handleDeleteTask}
          onTaskUpdated={t.handleSelectedTaskUpdate}
        />
      )}

      {t.showAITaskModal && (
        <AITask
          onClose={() => t.setShowAITaskModal(false)}
          onGenerate={t.handleAITaskGenerate}
        />
      )}

      {t.isActivityOpen && (
        <NotificationsPage
          onClose={() => t.setIsActivityOpen(false)}
          defaultFilter="unread"
        />
      )}

      {/* Bulk delete — confirm */}
      <DeleteModal
        isOpen={showBulkDeleteConfirm}
        type="confirm"
        itemType="task"
        itemName={t.selectedTaskIds.size === 1 ? undefined : `${t.selectedTaskIds.size} tasks`}
        onConfirm={handleBulkDeleteConfirmed}
        onCancel={() => setShowBulkDeleteConfirm(false)}
        isDeleting={isBulkDeleting}
      />

      {/* Bulk delete — permission denied (reuses same modal, type="denied") */}
      <DeleteModal
        isOpen={showBulkDeleteDenied}
        type="denied"
        itemType="task"
        onCancel={() => setShowBulkDeleteDenied(false)}
      />
      {/* ── Date field switcher portal ── */}
      <FieldSwitcherDropdown
        show={t.showDateFieldDropdown}
        pos={t.dropdownPos}
        options={DATE_FIELD_OPTIONS}
        activeValue={t.dateField}
        onSelect={v => {
          t.setDateField(v as any);
          t.setShowDateFieldDropdown(false);
          t.setDropdownPos(null);
          t.clearFilter(t.dateField);
          t.setActiveFilterKey(null);
        }}
      />

      {/* ── Person field switcher portal ── */}
      <FieldSwitcherDropdown
        show={t.showPersonFieldDropdown}
        pos={t.dropdownPos}
        options={PERSON_FIELD_OPTIONS}
        activeValue={t.personField}
        dataAttr="data-person-dropdown"
        onSelect={v => {
          t.clearFilter('assigned_to');
          t.clearFilter('created_by');
          t.clearFilter('updated_by');
          t.setPersonField(v as any);
          t.setShowPersonFieldDropdown(false);
          t.setDropdownPos(null);
          t.setActiveFilterKey(null);
        }}
      />
    </div>
  );
};