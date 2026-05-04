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
  Search, FileText, Info, X, Calendar, User, NotebookPen, Pencil, Plus, Trash2
} from 'lucide-react';
import { DualView, ViewToggle } from '@/components/layout/DualView';
import { createDocumentsTableColumns, DocumentGridCard } from '@/components/layout/DualView/documentsConfig';
import { TaskGridCard, createTasksTableColumns, getStatusConfig, priorityOptions, statusOptions } from '@/components/layout/DualView/taskConfig';
import { TaskDetailModal } from '../MyTask/TaskDetailModal';
import { SearchFilter, ListFilter, DateFilter, FilterHeaderWrapper } from '@/components/layout/DualView/FilterComponents';
import { CreateTask } from '@/pages/MyTask/CreateTask';
import { InlineCreateRow } from '@/components/layout/CreateTask/InlineCreateRow';
import { DocumentPreview, useDocumentPreviewKeyboard } from '@/components/common/DocumentPreview';
import { DocumentShareModal } from '@/pages/Documents/DocumentShareModal';
import DeleteModal from '@/components/common/Deletemodal';
import Threads from '../Project/Thread';
import { useProjectDetails, TabType } from '@/hooks/useTaskDetails';
import type { Task, FilteredDocument, QuickNote } from '@/types';
import { taskApi } from '@/services/api';

//Date Field Dropdown
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
          className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-purple-50 hover:text-purple-700 transition-colors ${dateField === opt.value ? 'font-semibold text-purple-600 bg-purple-50' : 'text-gray-700'
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

// Person Field Dropdown
function PersonFieldDropdown({
  show,
  dropdownPos,
  personField,
  PERSON_FIELD_OPTIONS,
  onSelect,
}: {
  show: boolean;
  dropdownPos: { top: number; left: number } | null;
  personField: string;
  PERSON_FIELD_OPTIONS: { value: 'assigned_to' | 'created_by' | 'updated_by'; label: string }[];
  onSelect: (value: 'assigned_to' | 'created_by' | 'updated_by') => void;
}) {
  if (!show || !dropdownPos) return null;
  return ReactDOM.createPortal(
    <div
      style={{ position: 'absolute', top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999 }}
      className="bg-white border border-gray-200 rounded-lg shadow-lg min-w-[130px] py-1"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {PERSON_FIELD_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onMouseDown={(e) => {
            e.stopPropagation();
            onSelect(opt.value);
          }}
          className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-purple-50 hover:text-purple-700 transition-colors ${personField === opt.value ? 'font-semibold text-purple-600 bg-purple-50' : 'text-gray-700'
            }`}
        >
          {personField === opt.value && <span className="mr-1.5">✓</span>}
          {opt.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}

// ─── Document Filter Bar 
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
            className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 capitalize ${documentFilter === f
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
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors duration-150 border-b border-gray-100 last:border-b-0 ${selectedTaskId === option.task_id ? 'bg-gray-100' : ''
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
            className={`flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-lg font-medium text-sm cursor-pointer hover:bg-gray-800 transition-all duration-200 shadow-sm ${isUploading ? 'opacity-50 cursor-not-allowed' : ''
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

// ─── Main Unified Component 
export function TaskDetails() {
  const ctx = useProjectDetails();
  useDocumentPreviewKeyboard(() => ctx.setPreviewDocument(null));

  // Bulk Upload State & Refs
  const bulkFileInputRef = React.useRef<HTMLInputElement>(null);
  const [isBulkUploading, setIsBulkUploading] = React.useState(false);
  const [uploadResultModal, setUploadResultModal] = React.useState<{ type: 'success' | 'error', message: string } | null>(null);

  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = React.useState(false);
  const [pastedJson, setPastedJson] = React.useState("");

  const dummyJsonExample = `{
  "tasks": [
    {
      "heading": "Integrate AWS Bedrock APIs",
      "description": "Set up the initial endpoints for LLM interaction.",
      "priority": "high",
      "status": "pending",
      "assignee_emails": ["shifali@example.com", "harshit@example.com"]
    },
    {
      "heading": "Write Unit Tests for Chat Bot",
      "description": "Ensure WebSocket connections handle disconnects gracefully.",
      "priority": "medium",
      "status": "backlog",
      "assignee_emails": ["megha@example.com"]
    }
  ]
}`;

  const processBulkFile = async (file: File) => {
    if (!ctx.id) return;
    setIsBulkUploading(true);
    try {
      await taskApi.bulkUpload(ctx.id, file);
      if (ctx.queryClient) {
        ctx.queryClient.invalidateQueries();
      }
      setUploadResultModal({ type: 'success', message: 'Tasks successfully created from JSON!' });
      setIsBulkUploadModalOpen(false); // Close the input modal on success
      setPastedJson(""); // Clear pasted text
    } catch (error: any) {
      console.error('Bulk upload error:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Failed to upload tasks.';
      setUploadResultModal({ type: 'error', message: errorMessage });
    } finally {
      setIsBulkUploading(false);
      if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
    }
  };

  const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processBulkFile(file);
  };

  const handlePasteUpload = async () => {
    if (!pastedJson.trim()) return;

    // Quick frontend validation to catch syntax errors before hitting the API
    try {
      JSON.parse(pastedJson);
    } catch (e) {
      setUploadResultModal({ type: 'error', message: "Invalid JSON format. Please check your syntax." });
      return;
    }

    // Convert the pasted string into a File object so the API accepts it normally
    const file = new File([pastedJson], 'pasted_tasks.json', { type: 'application/json' });
    await processBulkFile(file);
  };

  // DateFieldLabel

  // DateFieldLabel 
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
  // PersonFieldLabel
  const PersonFieldLabel = useMemo(
    () => (
      <button
        ref={ctx.personTriggerRef}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (ctx.personTriggerRef.current) {
            const rect = ctx.personTriggerRef.current.getBoundingClientRect();
            ctx.setDropdownPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX });
          }
          ctx.setShowPersonFieldDropdown((v: boolean) => !v);
        }}
        className="flex items-center gap-1 text-[14px] font-bold tracking-wide text-gray-700 hover:text-purple-600 transition-colors"
      >
        {ctx.activePersonLabel}
        <svg className="w-3 h-3 mt-0.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    ),
    [ctx.showPersonFieldDropdown, ctx.personField, ctx.activePersonLabel],
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
      <div className="flex min-h-screen bg-[#f8fafc] text-black">
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
                className={`px-8 py-3.5 rounded-t-lg border-b-[3px] text-[0.95rem] font-semibold cursor-pointer transition-all duration-200 ${ctx.activeTab === key
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
                  className={`p-1.5 rounded transition-colors ${ctx.viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  title="List View"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => ctx.setViewMode('grid')}
                  className={`p-1.5 rounded transition-colors ${ctx.viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  title="Grid View"
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Create Task */}
            <button
              className={`flex items-center gap-2 px-6 py-3.5 border-b-[3px] border-transparent text-slate-500 font-semibold text-[0.95rem] cursor-pointer transition-all duration-200 hover:bg-gradient-to-r hover:from-[#5568d3] hover:to-[#65408b] hover:text-white rounded-t-lg ${ctx.activeTab !== 'tasks' ? 'ml-auto' : ''
                }`}
              onClick={() => ctx.setIsCreateTaskModalOpen(true)}
            >
              Create Task
            </button>

            {/* Bulk Upload JSON */}
            {ctx.activeTab === 'tasks' && (
              <button
                onClick={() => setIsBulkUploadModalOpen(true)}
                className="flex items-center gap-2 px-6 py-3.5 border-b-[3px] border-transparent text-slate-500 font-semibold text-[0.95rem] cursor-pointer transition-all duration-200 hover:bg-gradient-to-r hover:from-[#5568d3] hover:to-[#65408b] hover:text-white rounded-t-lg"
                title="Import tasks via JSON"
              >
                <Upload className="w-4 h-4" />
                Import Tasks
              </button>
            )}

            {/* Quick Notes */}
            <button
              onClick={() => ctx.setShowNotesPanel(true)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors flex items-center gap-2 text-gray-600 hover:text-black"
              title="Project Notes"
            >
              <NotebookPen className="h-4 w-4" />
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
                              personField: ctx.personField,
                            }).map((col) => ({
                              ...col,
                              headerClassName: `relative ${ctx.activeFilterKey === col.key ? 'z-[100]' : ''}`,
                              label: (
                                <div ref={ctx.activeFilterKey === col.key ? ctx.filterContainerRef : null}>
                                  <FilterHeaderWrapper
                                    columnLabel={col.key === ctx.personField ? PersonFieldLabel : col.key === ctx.dateField ? DateFieldLabel : (col.label as string)}
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

                        {/* Inline create row  */}
                        {ctx.viewMode === 'list' && !ctx.isInlineCreating && (
                          <div
                            className="p-3 border border-t-0 border-[#dfe1e6] bg-white cursor-pointer hover:bg-gray-50 transition-colors rounded-b-md"
                            onClick={() => ctx.setIsInlineCreating(true)}
                          >
                            <div className="flex items-center gap-2 text-gray-500 text-[13px] font-medium pl-1">
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              <span className="hover:text-blue-600 transition-colors">Create Task</span>
                            </div>
                          </div>
                        )}
                        {ctx.viewMode === 'list' && ctx.isInlineCreating && (
                          <InlineCreateRow
                            columns={createTasksTableColumns({
                              onTaskClick: ctx.setSelectedTask,
                              queryClient: ctx.queryClient,
                              user: ctx.user,
                              navigate: ctx.navigate,
                              dateField: ctx.dateField,
                              personField: ctx.personField,
                            })}
                            onCancel={() => ctx.setIsInlineCreating(false)}
                            queryClient={ctx.queryClient}
                            fixedProjectId={ctx.id ? Number(ctx.id) : undefined}
                          />
                        )}
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
                          onShareClick={(d) => ctx.setShareDoc(d as any)}
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
                        onInfoClick: (doc) => ctx.setInfoDoc(doc),
                        onShareClick: (doc) => ctx.setShareDoc(doc),
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
      {/* Document Info Panel — same as /documents page */}
      {ctx.infoDoc && (
        <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
          <div className="pointer-events-auto w-[340px] h-full bg-white border-l border-gray-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-gray-800">Document Info</span>
              </div>
              <button onClick={() => ctx.setInfoDoc(null)} className="p-1.5 rounded hover:bg-gray-200 transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              {[
                { icon: <FileText className="w-4 h-4 text-blue-500" />, label: 'File Name', value: ctx.infoDoc.original_file_name || ctx.infoDoc.name },
                { icon: <User className="w-4 h-4 text-blue-500" />, label: 'Uploaded By', value: ctx.infoDoc.created_by?.full_name || 'System' },
                { icon: <Calendar className="w-4 h-4 text-rose-500" />, label: 'Created At', value: ctx.infoDoc.created_at ? new Date(ctx.infoDoc.created_at).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A' },
                { icon: <Calendar className="w-4 h-4 text-amber-500" />, label: 'Updated At', value: ctx.infoDoc.updated_at ? new Date(ctx.infoDoc.updated_at).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A' },
              ].map((row, i) => (
                <div key={i} className="flex items-start gap-3 py-1.5 border-b border-gray-50 last:border-0">
                  <div className="mt-0.5 flex-shrink-0">{row.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{row.label}</div>
                    <div className="text-[12px] text-gray-700 break-all">{row.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Document Share Modal — same as /documents page */}
      <DocumentShareModal
        isOpen={!!ctx.shareDoc}
        onClose={() => ctx.setShareDoc(null)}
        document={ctx.shareDoc}
      />


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

      {/* Quick Notes Slide-Out Panel */}
      {ctx.showNotesPanel && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/20"
          onClick={() => ctx.setShowNotesPanel(false)}
        >
          <div
            className="w-96 bg-white h-full shadow-2xl flex flex-col transform transition-transform animate-in slide-in-from-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2">
                <NotebookPen className="w-5 h-5 text-purple-600" />
                <h2 className="text-[1.1rem] font-bold text-gray-800">Quick Notes</h2>
              </div>
              <div className="flex items-center gap-2">
                {!ctx.isCreatingNote && (
                  <button
                    onClick={ctx.handleCreateNoteStart}
                    className="p-1.5 rounded-full bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                    title="Create Shared Note"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
                <button className="p-1.5 rounded-full hover:bg-gray-200 transition-colors" onClick={() => ctx.setShowNotesPanel(false)}>
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#f8fafc]">

              {/* New Note Creation Form */}
              {ctx.isCreatingNote && (
                <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-purple-200 p-4">
                  <textarea
                    value={ctx.newNoteContent}
                    onChange={(e) => ctx.setNewNoteContent(e.target.value)}
                    className="w-full min-h-[120px] p-3 text-[14px] text-gray-700 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white resize-y"
                    placeholder="Type a new shared note for this project..."
                    autoFocus
                  />
                  <div className="flex justify-end gap-2 mt-3">
                    <button
                      onClick={ctx.handleCreateNoteCancel}
                      className="px-4 py-1.5 text-[13px] font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                      disabled={ctx.isSavingNewNote}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={ctx.handleCreateNoteSave}
                      className="px-4 py-1.5 text-[13px] font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md transition-colors flex items-center gap-2"
                      disabled={ctx.isSavingNewNote || !ctx.newNoteContent.trim()}
                    >
                      {ctx.isSavingNewNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      Create Note
                    </button>
                  </div>
                </div>
              )}

              {ctx.notesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin h-6 w-6 text-purple-600" />
                </div>
              ) : ctx.projectNotes.length > 0 ? (
                ctx.projectNotes.map((note: QuickNote) => {
                  // Cross-reference the note's creator
                  const noteUser = ctx.usersData?.find((u: any) => u.id === note.user) || (ctx.user?.id === note.user ? ctx.user : null);
                  const displayName = noteUser?.first_name
                    ? `${noteUser.first_name} ${noteUser.last_name || ''}`.trim()
                    : noteUser?.username || 'User';
                  const initial = displayName.charAt(0).toUpperCase();

                  // Cross-reference the last editor (if available and different from creator)
                  const editorUser = note.updated_by ? (ctx.usersData?.find((u: any) => u.id === note.updated_by) || (ctx.user?.id === note.updated_by ? ctx.user : null)) : null;
                  const editorName = editorUser?.first_name
                    ? `${editorUser.first_name} ${editorUser.last_name || ''}`.trim()
                    : editorUser?.username;

                  return (
                    <div key={note.id} className="group bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 p-4 hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold uppercase">
                            {initial}
                          </div>
                          <span className="text-sm font-bold text-gray-800">
                            {displayName}
                          </span>
                        </div>

                        {/* Show Edit to everyone, but Delete ONLY to the original author */}
                        {ctx.editingNoteId !== note.id && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <button
                              onClick={() => ctx.handleEditNoteStart(note)}
                              className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
                              title="Edit Note"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>

                            {note.user === ctx.user?.id && (
                              <button
                                onClick={() => ctx.handleDeleteNote(note.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                title="Delete Note"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {ctx.editingNoteId === note.id ? (
                        <div className="mt-2">
                          <textarea
                            value={ctx.editNoteContent}
                            onChange={(e) => ctx.setEditNoteContent(e.target.value)}
                            className="w-full min-h-[120px] p-3 text-[14px] text-gray-700 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white resize-y"
                            placeholder="Type your note here..."
                            autoFocus
                          />
                          <div className="flex justify-end gap-2 mt-3">
                            <button
                              onClick={ctx.handleEditNoteCancel}
                              className="px-4 py-1.5 text-[13px] font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                              disabled={ctx.isSavingNote}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={ctx.handleEditNoteSave}
                              className="px-4 py-1.5 text-[13px] font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md transition-colors flex items-center gap-2"
                              disabled={ctx.isSavingNote}
                            >
                              {ctx.isSavingNote && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[14px] text-gray-600 leading-relaxed whitespace-pre-wrap">
                          {note.content}
                        </div>
                      )}

                      {/* Display the Last Edited badge when anyone edits it, including the owner */}
                      {note.updated_by && editorName && ctx.editingNoteId !== note.id && (
                        <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-medium text-gray-400 bg-gray-50/80 w-fit px-2 py-1 rounded-md border border-gray-100">
                          <Pencil className="w-3 h-3 text-gray-400" />
                          Last edited by {editorName}
                        </div>
                      )}

                      {note.attachments && note.attachments.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-gray-50">
                          {note.attachments.map((att) => (
                            <button
                              key={att.id}
                              onClick={() => ctx.setPreviewDocument({
                                url: att.file,
                                fileName: att.filename,
                                fileType: att.filename.split('.').pop()?.toLowerCase() || ''
                              })}
                              className="px-2.5 py-1 bg-gray-50 hover:bg-gray-100 hover:text-purple-600 hover:border-purple-200 text-gray-600 rounded-md text-[11px] font-semibold border border-gray-200 transition-colors cursor-pointer text-left"
                              title="Click to preview document"
                            >
                              {att.filename}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 flex flex-col items-center">
                  <NotebookPen className="h-12 w-12 text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium text-sm">No quick notes attached to this project.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Import Tasks Modal ── */}
      {isBulkUploadModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all animate-in zoom-in-95 duration-200">

            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-[#65408b]" />
                <h2 className="text-[1.1rem] font-bold text-gray-800">Import Tasks via JSON</h2>
              </div>
              <button onClick={() => setIsBulkUploadModalOpen(false)} className="p-1.5 rounded-full hover:bg-gray-200 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-[#f8fafc] flex flex-col gap-6">

              {/* Expected Format Section */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-500" /> Expected Format
                </h3>
                <pre className="bg-slate-900 text-green-400 p-4 rounded-lg text-[12px] overflow-x-auto font-mono leading-relaxed">
                  {dummyJsonExample}
                </pre>
              </div>

              {/* Paste or Upload Section */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-4">
                <h3 className="text-sm font-bold text-gray-800">Paste JSON Code</h3>
                <textarea
                  value={pastedJson}
                  onChange={(e) => setPastedJson(e.target.value)}
                  placeholder="Paste your JSON array here..."
                  className="w-full h-48 p-3 text-[13px] text-gray-700 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#65408b] font-mono resize-y bg-gray-50"
                />

                <div className="flex items-center justify-between mt-2 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept=".json"
                      ref={bulkFileInputRef}
                      className="hidden"
                      onChange={handleBulkUpload}
                      disabled={isBulkUploading}
                    />
                    <button
                      onClick={() => bulkFileInputRef.current?.click()}
                      disabled={isBulkUploading}
                      className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 border border-gray-300 shadow-sm"
                    >
                      <FileText className="w-4 h-4 text-gray-500" />
                      Select .json File
                    </button>
                  </div>

                  <button
                    onClick={handlePasteUpload}
                    disabled={isBulkUploading || !pastedJson.trim()}
                    className="px-6 py-2 bg-[#65408b] hover:bg-[#553675] text-white text-sm font-bold rounded-lg transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isBulkUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Create Tasks
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Upload Result Modal ── */}
      {uploadResultModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
            <div className={`p-6 text-center border-t-4 ${uploadResultModal.type === 'success' ? 'border-green-500' : 'border-red-500'}`}>
              <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full mb-4 ${uploadResultModal.type === 'success' ? 'bg-green-100' : 'bg-red-100'}`}>
                {uploadResultModal.type === 'success' ? (
                  <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {uploadResultModal.type === 'success' ? 'Success!' : 'Upload Failed'}
              </h3>
              <p className="text-gray-500 text-sm mb-6 px-2 break-words">
                {uploadResultModal.message}
              </p>
              <button
                onClick={() => setUploadResultModal(null)}
                className={`w-full py-2.5 px-4 rounded-lg font-bold text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${uploadResultModal.type === 'success'
                    ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500 hover:shadow-lg hover:-translate-y-0.5'
                    : 'bg-red-600 hover:bg-red-700 focus:ring-red-500 hover:shadow-lg hover:-translate-y-0.5'
                  }`}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      <DateFieldDropdown
        show={ctx.showDateFieldDropdown}
        dropdownPos={ctx.dropdownPos}
        dateField={ctx.dateField}
        DATE_FIELD_OPTIONS={ctx.DATE_FIELD_OPTIONS}
        onSelect={ctx.selectDateField}
      />
      <PersonFieldDropdown
        show={ctx.showPersonFieldDropdown}
        dropdownPos={ctx.dropdownPos}
        personField={ctx.personField}
        PERSON_FIELD_OPTIONS={ctx.PERSON_FIELD_OPTIONS}
        onSelect={(value) => {
          ctx.clearFilter('assigned_to');
          ctx.clearFilter('created_by');
          ctx.clearFilter('updated_by');
          ctx.setPersonField(value);
          ctx.setShowPersonFieldDropdown(false);
          ctx.setActiveFilterKey(null);
        }}
      />
    </>
  );
}