import React, { useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  Upload,
  List,
  Grid3X3,
  Settings,
  MessageCircle,
  Search,
} from 'lucide-react';
import { DualView, ViewToggle } from '@/components/layout/DualView';
import { createDocumentsTableColumns, DocumentGridCard } from '@/components/layout/DualView/documentsConfig';
import { TaskGridCard, createTasksTableColumns, getStatusConfig, priorityOptions, statusOptions } from '@/components/layout/DualView/taskConfig';
import { TaskDetailModal } from '../MyTask/TaskDetailModal';
import { SearchFilter, ListFilter, DateFilter, FilterHeaderWrapper } from '@/components/layout/DualView/FilterComponents';
import { CreateTask } from '@/pages/MyTask/CreateTask';
import { DocumentPreview, useDocumentPreviewKeyboard } from '@/components/common/DocumentPreview';
import DeleteModal from '@/components/common/Deletemodal';
import Threads from '../Project/Thread';
import { useProjectDetails, TabType } from '@/hooks/useTaskDetails';
import type { Task, FilteredDocument } from '@/types';

// ─── Date Field Dropdown (portal) ─────────────────────────────────────────────
function DateFieldDropdown({
  show,
  dropdownPos,
  dateField,
  DATE_FIELD_OPTIONS,
  onSelect,
}: {
  show: boolean;
  dropdownPos: { top: number; left: number } | null;
  dateField: string;
  DATE_FIELD_OPTIONS: { value: 'end_date' | 'start_date' | 'created_at'; label: string }[];
  onSelect: (value: 'end_date' | 'start_date' | 'created_at') => void;
}) {
  if (!show || !dropdownPos) return null;
  return ReactDOM.createPortal(
    <div
      style={{ position: 'absolute', top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999 }}
      className="bg-white border border-gray-200 rounded-lg shadow-lg min-w-[130px] py-1"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {DATE_FIELD_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onMouseDown={(e) => {
            e.stopPropagation();
            onSelect(opt.value);
          }}
          className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-purple-50 hover:text-purple-700 transition-colors ${
            dateField === opt.value ? 'font-semibold text-purple-600 bg-purple-50' : 'text-gray-700'
          }`}
        >
          {dateField === opt.value && <span className="mr-1.5">✓</span>}
          {opt.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}

// ─── Document Filter Bar ──────────────────────────────────────────────────────
function DocumentFilterBar({
  documentFilter,
  selectedTaskId,
  selectedTaskName,
  showTaskDropdown,
  setShowTaskDropdown,
  taskDropdownRef,
  taskSearchQuery,
  setTaskSearchQuery,
  filteredTaskOptions,
  handleTaskSelect,
  handleFilterChange,
  docViewMode,
  setDocViewMode,
  isUploading,
  fileInputRef,
  handleFileUpload,
}: any) {
  return (
    <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center gap-3">
        {(['project', 'task'] as const).map((f) => (
          <button
            key={f}
            onClick={() => handleFilterChange(f)}
            className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 capitalize ${
              documentFilter === f
                ? 'bg-black text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}

        {documentFilter === 'task' && (
          <div className="relative" ref={taskDropdownRef}>
            <button
              onClick={() => setShowTaskDropdown(!showTaskDropdown)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-gray-300 rounded-lg hover:border-gray-400 transition-all duration-200 min-w-[200px]"
            >
              <span className="text-sm font-medium text-gray-700 truncate flex-1 text-left">
                {selectedTaskName}
              </span>
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showTaskDropdown && (
              <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden">
                <div className="p-3 border-b border-gray-200">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search tasks..."
                      value={taskSearchQuery}
                      onChange={(e) => setTaskSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="overflow-y-auto max-h-72">
                  {filteredTaskOptions.length > 0 ? (
                    filteredTaskOptions.map((option: any) => (
                      <button
                        key={option.task_id}
                        onClick={() => handleTaskSelect(option.task_id)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors duration-150 border-b border-gray-100 last:border-b-0 ${
                          selectedTaskId === option.task_id ? 'bg-gray-100' : ''
                        }`}
                      >
                        <p className="text-sm font-medium text-gray-900">{option.task_heading}</p>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-8 text-center text-sm text-gray-500">No tasks found</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <ViewToggle viewMode={docViewMode} onViewModeChange={setDocViewMode} />
        {documentFilter === 'project' && (
          <label
            className={`flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-lg font-medium text-sm cursor-pointer hover:bg-gray-800 transition-all duration-200 shadow-sm ${
              isUploading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isUploading}
              accept="*"
              multiple
            />
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span>{isUploading ? 'Uploading...' : 'Upload Documents'}</span>
          </label>
        )}
      </div>
    </div>
  );
}

// ─── Main Unified Component ───────────────────────────────────────────────────
export function TaskDetails() {
  const ctx = useProjectDetails();
  useDocumentPreviewKeyboard(() => ctx.setPreviewDocument(null));

  // DateFieldLabel — memoised button rendered inline in filter headers
  const DateFieldLabel = useMemo(
    () => (
      <button
        ref={ctx.dateTriggerRef}
        onClick={ctx.openDateFieldDropdown}
        className="flex items-center gap-1 text-[14px] font-bold tracking-wide text-gray-700 hover:text-purple-600 transition-colors"
      >
        {ctx.activeDateLabel}
        <svg className="w-3 h-3 mt-0.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx.showDateFieldDropdown, ctx.dateField, ctx.activeDateLabel],
  );

  if (ctx.isProjectLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  if (!ctx.project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h2 className="text-2xl font-semibold">Project not found</h2>
        <Link to="/projects" className="text-blue-500 underline font-medium hover:text-blue-700">
          Back to projects
        </Link>
      </div>
    );
  }

  const tabs: { key: TabType; label: string }[] = [
    { key: 'tasks', label: 'Tasks' },
    { key: 'add_documents', label: 'Documents' },
  ];

  return (
    <>
      {/* ── Outer layout wrapper ── */}
      <div className="flex min-h-screen bg-[#f8fafc] text-black dark:bg-[#11181c] dark:text-white">
        <div className="flex-1 w-full p-8">

          {/* ── Header ── */}
          <div className="flex items-center gap-4 mb-8">
            <Link
              to="/projects"
              className="p-3 rounded-xl bg-white shadow-sm text-black hover:bg-slate-100 hover:shadow-md hover:-translate-x-0.5 transition-all duration-200 flex items-center justify-center"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center justify-between w-full">
              <h1 className="text-[1.3rem] font-bold bg-black bg-clip-text text-transparent m-0">
                {ctx.project.name}
              </h1>
              <p className="text-base text-slate-500 font-semibold tracking-wide m-0">
                {ctx.project.task_type?.replace('_', ' ').toUpperCase()} DASHBOARD
              </p>
            </div>
          </div>

          {/* ── Tab bar ── */}
          <div className="flex gap-2 border-b-2 border-slate-200 bg-white rounded-t-2xl px-2 pt-2 shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => ctx.setActiveTab(key)}
                className={`px-8 py-3.5 rounded-t-lg border-b-[3px] text-[0.95rem] font-semibold cursor-pointer transition-all duration-200 ${
                  ctx.activeTab === key
                    ? 'bg-slate-100 text-black border-b-2 border-black'
                    : 'border-transparent text-slate-500 hover:text-black hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}

            {/* List / Grid toggle (tasks only) */}
            {ctx.activeTab === 'tasks' && (
              <div className="flex items-center bg-white p-1 gap-1 ml-auto">
                <button
                  onClick={() => ctx.setViewMode('list')}
                  className={`p-1.5 rounded transition-colors ${
                    ctx.viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                  title="List View"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => ctx.setViewMode('grid')}
                  className={`p-1.5 rounded transition-colors ${
                    ctx.viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                  title="Grid View"
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Create Task */}
            <button
              className={`flex items-center gap-2 px-6 py-3.5 border-b-[3px] border-transparent text-slate-500 font-semibold text-[0.95rem] cursor-pointer transition-all duration-200 hover:bg-gradient-to-r hover:from-[#5568d3] hover:to-[#65408b] hover:text-white rounded-t-lg ${
                ctx.activeTab !== 'tasks' ? 'ml-auto' : ''
              }`}
              onClick={() => ctx.setIsCreateTaskModalOpen(true)}
            >
              Create Task
            </button>

            {/* Chat */}
            <button
              onClick={ctx.handleNavigateToChat}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors flex items-center gap-2 text-gray-600 hover:text-black"
              title="Team Chat"
            >
              <MessageCircle className="h-4 w-4" />
            </button>

            {/* Settings */}
            <button
              onClick={() => ctx.navigate(`/projects/${ctx.id}/settings`)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors flex items-center gap-2 text-gray-600 hover:text-black"
              title="Project Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>

          {/* ── Content ── */}
          <div className="mt-8">

            {/* TASKS TAB */}
            {ctx.activeTab === 'tasks' && (
              <div className="flex flex-col gap-8">
                {ctx.isLoadingTasks ? (
                  <div className="flex justify-center p-12">
                    <Loader2 className="animate-spin h-8 w-8" />
                  </div>
                ) : ctx.tasks.length > 0 ? (
                  <>
                    {ctx.viewMode === 'list' ? (
                      <div className="bg-white rounded-lg shadow-sm">
                        <DualView
                          viewMode="table"
                          gridProps={{
                            data: ctx.filteredTasks,
                            renderCard: (task: Task) => (
                              <TaskGridCard task={task} onTaskClick={ctx.setSelectedTask} />
                            ),
                          }}
                          tableProps={{
                            data: ctx.filteredTasks,
                            activeFilterKey: ctx.activeFilterKey,
                            columns: createTasksTableColumns({
                              onTaskClick: ctx.setSelectedTask,
                              queryClient: ctx.queryClient,
                              user: ctx.user,
                              navigate: ctx.navigate,
                              dateField: ctx.dateField,
                            }).map((col) => ({
                              ...col,
                              headerClassName: `relative ${ctx.activeFilterKey === col.key ? 'z-[100]' : ''}`,
                              label: (
                                <div ref={ctx.activeFilterKey === col.key ? ctx.filterContainerRef : null}>
                                  <FilterHeaderWrapper
                                    columnLabel={col.key === ctx.dateField ? DateFieldLabel : (col.label as string)}
                                    filterType={
                                      ['project', 'heading', 'labels'].includes(col.key)
                                        ? 'search'
                                        : ['status', 'priority', 'assigned_to'].includes(col.key)
                                        ? 'list'
                                        : col.key === ctx.dateField
                                        ? 'date'
                                        : 'none'
                                    }
                                    isActive={ctx.activeFilterKey === col.key}
                                    filterContent={
                                      <>
                                        {col.key === 'status' && (
                                          <ListFilter
                                            columnKey="status"
                                            options={statusOptions.map((s) => ({
                                              value: s.value.toUpperCase(),
                                              label: s.label,
                                              icon: React.createElement(
                                                getStatusConfig(s.value.toUpperCase() as any).icon,
                                                { className: 'w-3.5 h-3.5' },
                                              ),
                                              className: getStatusConfig(s.value.toUpperCase() as any).text,
                                            }))}
                                            selectedValue={ctx.columnFilters.status || ''}
                                            onSelect={(v) => {
                                              ctx.setColumnFilters((p) => ({ ...p, status: v }));
                                              ctx.setActiveFilterKey(null);
                                            }}
                                            onClear={() => {
                                              ctx.clearFilter('status');
                                              ctx.setActiveFilterKey(null);
                                            }}
                                            isActive={ctx.activeFilterKey === 'status'}
                                            containerRef={ctx.filterContainerRef}
                                          />
                                        )}
                                        {col.key === 'priority' && (
                                          <ListFilter
                                            columnKey="priority"
                                            options={priorityOptions.map((opt) => ({
                                              value: opt.value,
                                              label: opt.label,
                                              icon: <span>{opt.icon}</span>,
                                            }))}
                                            selectedValue={ctx.columnFilters.priority || ''}
                                            onSelect={(v) => {
                                              ctx.setColumnFilters((p) => ({ ...p, priority: v }));
                                              ctx.setActiveFilterKey(null);
                                            }}
                                            onClear={() => {
                                              ctx.clearFilter('priority');
                                              ctx.setActiveFilterKey(null);
                                            }}
                                            isActive={ctx.activeFilterKey === 'priority'}
                                            containerRef={ctx.filterContainerRef}
                                          />
                                        )}
                                        {col.key === 'assigned_to' && (
                                          <ListFilter
                                            columnKey="assigned_to"
                                            options={(ctx.usersData || []).map((u: any) => ({
                                              value: String(u.id),
                                              label: `${u.first_name} ${u.last_name}`.trim() || u.username,
                                            }))}
                                            selectedValue={ctx.columnFilters['assigned_to'] || ''}
                                            onSelect={(v) => {
                                              ctx.setColumnFilters((p) => ({ ...p, assigned_to: v }));
                                              ctx.setActiveFilterKey(null);
                                            }}
                                            onClear={() => {
                                              ctx.clearFilter('assigned_to');
                                              ctx.setActiveFilterKey(null);
                                            }}
                                            isActive={ctx.activeFilterKey === 'assigned_to'}
                                            containerRef={ctx.filterContainerRef}
                                          />
                                        )}
                                        {col.key === ctx.dateField && (
                                          <DateFilter
                                            columnKey={ctx.dateField}
                                            value={ctx.columnFilters[ctx.dateField] || ''}
                                            onChange={(v) => {
                                              ctx.setColumnFilters((p) => ({ ...p, [ctx.dateField]: v }));
                                              ctx.setActiveFilterKey(null);
                                            }}
                                            onClear={() => {
                                              ctx.clearFilter(ctx.dateField);
                                              ctx.setActiveFilterKey(null);
                                            }}
                                            isActive={ctx.activeFilterKey === ctx.dateField}
                                            containerRef={ctx.filterContainerRef}
                                          />
                                        )}
                                      </>
                                    }
                                  >
                                    {['project', 'heading', 'labels'].includes(col.key) && (
                                      <SearchFilter
                                        columnKey={col.key}
                                        placeholder="Search..."
                                        value={ctx.columnFilters[col.key] || ''}
                                        onChange={(v) =>
                                          ctx.setColumnFilters((p) => ({ ...p, [col.key]: v }))
                                        }
                                        isActive={ctx.activeFilterKey === col.key}
                                      />
                                    )}
                                  </FilterHeaderWrapper>
                                </div>
                              ),
                            })),
                            rowKey: (task: Task) => task.id,
                            onRowClick: ctx.setSelectedTask,
                            onSort: ctx.handleSort,
                            onFilter: ctx.handleFilter,
                          }}
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {ctx.filteredTasks.map((task) => (
                          <TaskGridCard key={task.id} task={task} onTaskClick={ctx.setSelectedTask} />
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white shadow-sm">
                    <div className="text-6xl mb-4">📋</div>
                    <h3 className="text-2xl font-bold m-0 mb-2">No tasks found</h3>
                    <p className="text-slate-500 m-0 mb-8 text-base">
                      Try changing your filter or create a new task
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* DOCUMENTS TAB */}
            {ctx.activeTab === 'add_documents' && (
              <div
                className="flex flex-col gap-6"
                onDragEnter={ctx.handleDragEnter}
                onDragLeave={ctx.handleDragLeave}
                onDragOver={ctx.handleDragOver}
                onDrop={ctx.handleDrop}
              >
                <DocumentFilterBar
                  documentFilter={ctx.documentFilter}
                  selectedTaskId={ctx.selectedTaskId}
                  selectedTaskName={ctx.selectedTaskName}
                  showTaskDropdown={ctx.showTaskDropdown}
                  setShowTaskDropdown={ctx.setShowTaskDropdown}
                  taskDropdownRef={ctx.taskDropdownRef}
                  taskSearchQuery={ctx.taskSearchQuery}
                  setTaskSearchQuery={ctx.setTaskSearchQuery}
                  filteredTaskOptions={ctx.filteredTaskOptions}
                  handleTaskSelect={ctx.handleTaskSelect}
                  handleFilterChange={ctx.handleFilterChange}
                  docViewMode={ctx.docViewMode}
                  setDocViewMode={ctx.setDocViewMode}
                  isUploading={ctx.isUploading}
                  fileInputRef={ctx.fileInputRef}
                  handleFileUpload={ctx.handleFileUpload}
                />

                {ctx.isDocumentsLoading ? (
                  <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
                  </div>
                ) : (
                  <DualView
                    viewMode={ctx.docViewMode}
                    isLoading={ctx.isAllDocumentsLoading}
                    gridProps={{
                      data: (ctx.filteredDocuments as any[]).map((doc) => {
                        const fileName = doc.file_name || doc.original_file_name || doc.name || '';
                        const ext = fileName.split('.').pop()?.toLowerCase() || '';
                        const enriched = ctx.allMediaFiles.find((m: any) => m.id === doc.id);
                        return {
                          ...doc,
                          name: fileName,
                          status: doc.status ?? enriched?.status ?? 'draft',
                          file_type: doc.file_type || enriched?.file_type || ext || 'other',
                          project_name: doc.project_name || enriched?.project_name || ctx.project?.name || 'General',
                          created_by:
                            doc.created_by ??
                            enriched?.created_by ??
                            (doc.uploaded_by ? { full_name: doc.uploaded_by } : null),
                          updated_at: doc.updated_at ?? doc.uploaded_at ?? doc.created_at ?? '',
                        };
                      }),
                      renderCard: (doc: any) => (
                        <DocumentGridCard
                          key={doc.id}
                          document={doc}
                          onCardClick={(d) => ctx.handleDocumentClick(d as any)}
                          onDeleteClick={(e, d) => ctx.handleDeleteClick(e, d)}
                        />
                      ),
                      gridClassName: 'grid gap-4 md:grid-cols-2 lg:grid-cols-3',
                      emptyState: (
                        <div className="flex flex-col items-center justify-center p-12 mt-8">
                          <p className="text-base font-semibold text-slate-500 m-0">
                            No documents uploaded yet
                          </p>
                        </div>
                      ),
                    }}
                    tableProps={{
                      data: (ctx.filteredDocuments as any[]).map((doc) => {
                        const fileName = doc.file_name || doc.original_file_name || doc.name || '';
                        const ext = fileName.split('.').pop()?.toLowerCase() || '';
                        const enriched = ctx.allMediaFiles.find((m: any) => m.id === doc.id);
                        return {
                          ...doc,
                          name: fileName,
                          status: doc.status ?? enriched?.status ?? 'draft',
                          file_type: doc.file_type || enriched?.file_type || ext || 'other',
                          project_name: doc.project_name || enriched?.project_name || ctx.project?.name || 'General',
                          created_by:
                            doc.created_by ??
                            enriched?.created_by ??
                            (doc.uploaded_by ? { full_name: doc.uploaded_by } : null),
                          updated_at: doc.updated_at ?? doc.uploaded_at ?? doc.created_at ?? '',
                        };
                      }),
                      columns: createDocumentsTableColumns({
                        onDeleteClick: (e, doc) => ctx.handleDeleteClick(e, doc),
                      }),
                      rowKey: (doc: any) => doc.id,
                      onRowClick: (doc: any) => ctx.handleDocumentClick(doc),
                      emptyState: (
                        <div className="flex flex-col items-center justify-center p-12 mt-8">
                          <p className="text-base font-semibold text-slate-500 m-0">
                            No documents uploaded yet
                          </p>
                        </div>
                      ),
                    }}
                  />
                )}

                {/* Drag overlay */}
                {ctx.isDragging && (
                  <div className="fixed inset-0 bg-primary/10 border-4 border-dashed border-primary pointer-events-none z-50 flex items-center justify-center">
                    <div className="bg-white p-8 rounded-lg shadow-lg">
                      <Upload className="h-16 w-16 text-primary mx-auto mb-4" />
                      <p className="text-xl font-semibold text-primary">
                        Drop document anywhere to upload
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Portals & Modals ── */}
      {ctx.previewDocument && (
        <DocumentPreview
          url={ctx.previewDocument.url}
          fileName={ctx.previewDocument.fileName}
          fileType={ctx.previewDocument.fileType}
          onClose={() => ctx.setPreviewDocument(null)}
        />
      )}

      {ctx.isCreateTaskModalOpen && (
        <CreateTask
          onClose={() => ctx.setIsCreateTaskModalOpen(false)}
          onSuccess={(newTask?: Task) => ctx.handleTaskCreated(newTask)}
          isModal={true}
          fixedProjectId={ctx.id ? Number(ctx.id) : undefined}
        />
      )}

      {ctx.selectedTask && (
        <TaskDetailModal
          task={ctx.selectedTask}
          onClose={() => ctx.setSelectedTask(null)}
          onTaskUpdated={ctx.handleTaskUpdated}
          onDelete={ctx.handleDeleteTask}
        />
      )}

      {ctx.project && (
        <Threads projectId={ctx.project.id} projectName={ctx.project.name} />
      )}

      <DeleteModal
        isOpen={!!ctx.deleteConfirm}
        type="confirm"
        itemType="document"
        itemName={ctx.deleteConfirm?.name}
        onConfirm={ctx.handleDeleteConfirm}
        onCancel={() => ctx.setDeleteConfirm(null)}
        isDeleting={ctx.isDeleting}
      />

      <DateFieldDropdown
        show={ctx.showDateFieldDropdown}
        dropdownPos={ctx.dropdownPos}
        dateField={ctx.dateField}
        DATE_FIELD_OPTIONS={ctx.DATE_FIELD_OPTIONS}
        onSelect={ctx.selectDateField}
      />
    </>
  );
}