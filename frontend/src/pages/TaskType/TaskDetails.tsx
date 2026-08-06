import React, { useMemo, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Upload, List, Grid3X3, Settings, Copy, Check,
  Search, FileText, Info, X, Calendar, User, NotebookPen, Pencil, Plus, Trash2
} from 'lucide-react';
import { DualView, ViewToggle } from '@/components/layout/DualView';
import { createDocumentsTableColumns, DocumentGridCard } from '@/components/layout/DualView/documentsConfig';
import { TaskGridCard, createTasksTableColumns, getStatusConfig, priorityOptions, statusOptions } from '@/components/layout/DualView/taskConfig';
import { TaskDetailModal } from '../MyTask/TaskDetail/Components/TaskDetailModal';
import { SearchFilter, ListFilter, DateFilter, FilterHeaderWrapper } from '@/components/layout/DualView/FilterComponents';
import { CreateTask } from '@/pages/MyTask/pages/CreateTask/CreateTask';
import { InlineCreateRow } from '@/components/layout/CreateTask/InlineCreateRow';
import { DocumentPreview, useDocumentPreviewKeyboard } from '@/components/common/DocumentPreview';
import { DocumentShareModal } from '@/pages/Documents/DocumentShareModal';
import DeleteModal from '@/components/common/Deletemodal';
// import Threads from '../Project/Thread';
import { useProjectDetails, TabType } from '@/hooks/useTaskDetails';
import type { Task, QuickNote } from '@/types';
import { taskApi } from '@/services/api';
import type { TaskSelectionProps } from '@/components/layout/DualView/taskConfig';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { useJsonPreview } from '@/hooks/useJsonPreview';
import { TaskPreviewOverlay } from '@/pages/Project/components/TaskPreviewOverlay';
import { plainTextToHtml } from '@/lib/utils';

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
      className="bg-popover border border-border rounded-lg shadow-lg min-w-[130px] py-1"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {DATE_FIELD_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onMouseDown={(e) => {
            e.stopPropagation();
            onSelect(opt.value);
          }}
          className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-purple-500/10 hover:text-purple-500 transition-colors ${dateField === opt.value ? 'font-semibold text-purple-500 bg-purple-500/10' : 'text-foreground'
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
      className="bg-popover border border-border rounded-lg shadow-lg min-w-[130px] py-1"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {PERSON_FIELD_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onMouseDown={(e) => {
            e.stopPropagation();
            onSelect(opt.value);
          }}
          className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-purple-500/10 hover:text-purple-500 transition-colors ${personField === opt.value ? 'font-semibold text-purple-500 bg-purple-500/10' : 'text-foreground'
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
    <div className="flex items-center justify-between mb-6 bg-card p-4 rounded-xl shadow-sm border border-border">
      <div className="flex items-center gap-3">
        {(['project', 'task'] as const).map((f) => (
          <button
            key={f}
            onClick={() => handleFilterChange(f)}
            className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 capitalize ${documentFilter === f
              ? 'bg-foreground text-background shadow-md'
              : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}

        {documentFilter === 'task' && (
          <div className="relative" ref={taskDropdownRef}>
            <button
              onClick={() => setShowTaskDropdown(!showTaskDropdown)}
            className="flex items-center gap-2 px-4 py-2.5 bg-input border-2 border-border rounded-lg hover:border-muted-foreground/40 transition-all duration-200 min-w-[200px]"
            >
              <span className="text-sm font-medium text-foreground truncate flex-1 text-left">
                {selectedTaskName}
              </span>
              <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showTaskDropdown && (
              <div className="absolute top-full left-0 mt-2 w-80 bg-popover rounded-xl shadow-lg border border-border z-50 max-h-96 overflow-hidden">
                <div className="p-3 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search tasks..."
                      value={taskSearchQuery}
                      onChange={(e) => setTaskSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="overflow-y-auto max-h-72">
                  {filteredTaskOptions.length > 0 ? (
                    filteredTaskOptions.map((option: any) => (
                      <button
                        key={option.task_id}
                        onClick={() => handleTaskSelect(option.task_id)}
                        className={`w-full text-left px-4 py-3 hover:bg-accent transition-colors duration-150 border-b border-border last:border-b-0 ${selectedTaskId === option.task_id ? 'bg-accent' : ''
                          }`}
                      >
                        <p className="text-sm font-medium text-foreground">{option.task_heading}</p>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">No tasks found</div>
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
            className={`flex items-center gap-2 px-5 py-2.5 bg-foreground text-background rounded-lg font-medium text-sm cursor-pointer hover:opacity-90 transition-all duration-200 shadow-sm ${isUploading ? 'opacity-50 cursor-not-allowed' : ''
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
  const { copied: jsonExampleCopied, copy: copyJsonExample } = useCopyToClipboard();
  const { tasks: parsedTasks, error: previewError } = useJsonPreview(pastedJson);
  const [previewTasks, setPreviewTasks] = useState(parsedTasks);
  const [showPreviewOverlay, setShowPreviewOverlay] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showBulkDeleteDenied, setShowBulkDeleteDenied] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const handleBulkDeleteClick = () => {
    const unauthorised = ctx.filteredTasks
      .filter((task: Task) => ctx.selectedTaskIds.has(task.id))
      .some((task: Task) => task.assigned_by !== ctx.user?.id);

    if (unauthorised) {
      setShowBulkDeleteDenied(true);
    } else {
      setShowBulkDeleteConfirm(true);
    }
  };

  const handleBulkDeleteConfirmed = async () => {
    setIsBulkDeleting(true);
    await ctx.handleBulkDeleteTasks();
    setIsBulkDeleting(false);
    setShowBulkDeleteConfirm(false);
  };

  useEffect(() => {
    if (!showPreviewOverlay) {
      setPreviewTasks(parsedTasks);
    }
  }, [parsedTasks, showPreviewOverlay]);

  const handleDeletePreviewTask = (index: number) => {
    const updated = previewTasks.filter((_, i) => i !== index);
    setPreviewTasks(updated);
    setPastedJson(JSON.stringify({ tasks: updated }, null, 2));
  };

  const handleEditPreviewTaskTitle = (index: number, newTitle: string) => {
    const updated = previewTasks.map((t, i) => i === index ? { ...t, heading: newTitle } : t);
    setPreviewTasks(updated);
    setPastedJson(JSON.stringify({ tasks: updated }, null, 2));
  };

  const handleShowPreview = () => {
    if (previewTasks.length === 0) return;
    setIsBulkUploadModalOpen(false);
    setShowPreviewOverlay(true);
  };

  const handleBackToImport = () => {
    setShowPreviewOverlay(false);
    setIsBulkUploadModalOpen(true);
  };

  const handleCreateFromPreview = async () => {
    if (previewTasks.length === 0) return;
    const json = JSON.stringify({ tasks: previewTasks }, null, 2);
    const file = new File([json], 'pasted_tasks.json', { type: 'application/json' });
    setShowPreviewOverlay(false);
    await processBulkFile(file);
    setPreviewTasks([]);
  };

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
      "assignee_emails": ["lensvox@example.com"]
    }
  ]
}`;

  const processBulkFile = async (file: File) => {
    if (!ctx.id) return;
    setIsBulkUploading(true);
    try {
      // Convert plain-text descriptions to HTML before storing,
      // so both view mode and edit mode show properly formatted content.
      let uploadFile = file;
      try {
        const raw = await file.text();
        const parsed = JSON.parse(raw);
        if (parsed?.tasks && Array.isArray(parsed.tasks)) {
          parsed.tasks = parsed.tasks.map((t: any) => ({
            ...t,
            description: t.description ? plainTextToHtml(t.description) : t.description,
          }));
          const converted = JSON.stringify(parsed);
          uploadFile = new File([converted], file.name, { type: 'application/json' });
        }
      } catch {
        // If parsing fails, fall through and let the API handle the error
      }
      await taskApi.bulkUpload(ctx.id, uploadFile);
      if (ctx.queryClient) {
        ctx.queryClient.invalidateQueries();
      }
      setUploadResultModal({ type: 'success', message: 'Tasks successfully created from JSON!' });
      setIsBulkUploadModalOpen(false);
      setPastedJson("");
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

    // Read file content into pastedJson so the preview renders
    const text = await file.text();
    setPastedJson(text);
  };

  const _handlePasteUpload = async () => {
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
  const DateFieldLabel = useMemo(
    () => (
      <button
        ref={ctx.dateTriggerRef}
        onClick={ctx.openDateFieldDropdown}
        className="flex items-center gap-1 text-[14px] font-bold tracking-wide text-foreground hover:text-purple-500 transition-colors"
      >
        {ctx.activeDateLabel}
        <svg className="w-3 h-3 mt-0.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    ),
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
        className="flex items-center gap-1 text-[14px] font-bold tracking-wide text-foreground hover:text-purple-500 transition-colors"
      >
        {ctx.activePersonLabel}
        <svg className="w-3 h-3 mt-0.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <div className="min-h-screen bg-background text-foreground">
        <div className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40 py-8">

          {/* ── Header ── */}
          <div className="flex items-center gap-4 mb-8">
            <Link
              to="/projects"
              className="p-3 rounded-xl bg-card border border-border shadow-sm text-foreground hover:bg-accent hover:shadow-md hover:-translate-x-0.5 transition-all duration-200 flex items-center justify-center"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center justify-between w-full">
              <h1 className="text-[1.3rem] font-bold text-foreground m-0">
                {ctx.project.name}
              </h1>
              <p className="text-base text-muted-foreground font-semibold tracking-wide m-0">
                {ctx.project.task_type?.replace('_', ' ').toUpperCase()} DASHBOARD
              </p>
            </div>
          </div>

          {/* ── Tab bar ── */}
         <div className="flex gap-2 border-b-2 border-border bg-card rounded-t-2xl px-2 pt-2 shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => ctx.setActiveTab(key)}
                className={`px-8 py-3.5 rounded-t-lg border-b-[3px] text-[0.95rem] font-semibold cursor-pointer transition-all duration-200 ${ctx.activeTab === key
                  ? 'bg-accent text-foreground border-b-2 border-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  }`}
              >
                {label}
              </button>
            ))}

            {/* List / Grid toggle */}
            {ctx.activeTab === 'tasks' && (
              <div className="flex items-center bg-muted p-1 gap-1 ml-auto rounded-lg">
                <button
                  onClick={() => ctx.setViewMode('list')}
                  className={`p-1.5 rounded transition-colors ${ctx.viewMode === 'list' ? 'bg-blue-500/20 text-blue-500' : 'text-muted-foreground hover:bg-accent'
                    }`}
                  title="List View"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => ctx.setViewMode('grid')}
                  className={`p-1.5 rounded transition-colors ${ctx.viewMode === 'grid' ? 'bg-blue-500/20 text-blue-500' : 'text-muted-foreground hover:bg-accent'
                    }`}
                  title="Grid View"
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Create Task */}
            <button
              className={`flex items-center gap-2 px-6 py-3.5 border-b-[3px] border-transparent text-muted-foreground font-semibold text-[0.95rem] cursor-pointer transition-all duration-200 hover:bg-gradient-to-r hover:from-[#5568d3] hover:to-[#65408b] hover:text-white rounded-t-lg ${ctx.activeTab !== 'tasks' ? 'ml-auto' : ''
                }`}
              onClick={() => ctx.setIsCreateTaskModalOpen(true)}
            >
              Create Task
            </button>

            {/* Bulk Upload JSON */}
            {ctx.activeTab === 'tasks' && (
              <button
                onClick={() => setIsBulkUploadModalOpen(true)}
                className="flex items-center gap-2 px-6 py-3.5 border-b-[3px] border-transparent text-muted-foreground font-semibold text-[0.95rem] cursor-pointer transition-all duration-200 hover:bg-gradient-to-r hover:from-[#5568d3] hover:to-[#65408b] hover:text-white rounded-t-lg"
                title="Import tasks via JSON"
              >
                <Upload className="w-4 h-4" />
                Import Tasks
              </button>
            )}

            {/* Quick Notes */}
            <button
              onClick={() => ctx.setShowNotesPanel(true)}
              className="p-2 hover:bg-accent rounded-full transition-colors flex items-center gap-2 text-muted-foreground hover:text-foreground"
              title="Project Notes"
            >
              <NotebookPen className="h-4 w-4" />
            </button>

            {/* Settings */}
            <button
              onClick={() => ctx.navigate(`/projects/${ctx.id}/settings`)}
              className="p-2 hover:bg-accent rounded-full transition-colors flex items-center gap-2 text-muted-foreground hover:text-foreground"
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
                      <div className="bg-card border border-border rounded-lg shadow-sm">
                        {/* ── Bulk selection toolbar ── */}
                        {ctx.selectedTaskIds.size > 0 && (
                         <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--muted))' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#1663f6', background: '#EEF4FF', border: '1px solid #c7d7fd', borderRadius: 6, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Check size={13} strokeWidth={3} /> {ctx.selectedTaskIds.size} selected
                            </span>
                            <button
                              onClick={handleBulkDeleteClick}
                              style={{ height: 32, border: '1px solid #fca5a5', borderRadius: 6, background: 'hsl(var(--card))', padding: '0 14px', fontSize: 13, fontWeight: 600, display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer', color: '#dc2626' }}
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                            <button
                              onClick={() => ctx.toggleAllTasks(ctx.filteredTasks)}
                              style={{ marginLeft: 'auto', height: 32, border: '1px solid hsl(var(--border))', borderRadius: 6, background: 'none', padding: '0 12px', fontSize: 13, fontWeight: 500, cursor: 'pointer', color: 'hsl(var(--muted-foreground))' }}
                            >
                              Clear
                            </button>
                          </div>
                        )}
                        <div className="overflow-x-auto pb-4">
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
                              selectionProps: {
                                selectedIds: ctx.selectedTaskIds,
                                toggleSelect: ctx.toggleTaskSelect,
                                toggleAll: ctx.toggleAllTasks,
                                visibleTasks: ctx.filteredTasks,
                              } satisfies TaskSelectionProps,
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
                                            options={[
                                              {
                                                value: '__empty__',
                                                label: 'Empty',
                                                icon: (
                                                  <span style={{ width: 18, height: 18, borderRadius: '50%', border: '1.5px dashed #94a3b8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <span style={{ fontSize: 9, color: '#94a3b8' }}>–</span>
                                                  </span>
                                                ),
                                              },
                                              ...(ctx.usersData || []).map((u: any) => ({
                                                value: String(u.id),
                                                label: `${u.first_name} ${u.last_name}`.trim() || u.username,
                                              })),
                                            ]}
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

                        {/* Inline create row  */}
                        {ctx.viewMode === 'list' && !ctx.isInlineCreating && (
                          <div
                            className="p-3 border border-t-0 border-border bg-card cursor-pointer hover:bg-accent transition-colors rounded-b-md"
                            onClick={() => ctx.setIsInlineCreating(true)}
                          >
                           <div className="flex items-center gap-2 text-muted-foreground text-[13px] font-medium pl-1">
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
                  <div className="flex flex-col items-center justify-center p-16 text-center border-2 border-dashed border-border rounded-2xl bg-card shadow-sm">
                    <div className="text-6xl mb-4">📋</div>
                    <h3 className="text-2xl font-bold m-0 mb-2 text-foreground">No tasks found</h3>
                    <p className="text-muted-foreground m-0 mb-8 text-base">
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
                          <p className="text-base font-semibold text-muted-foreground m-0">
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
                          <p className="text-base font-semibold text-muted-foreground m-0">
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
                    <div className="bg-card p-8 rounded-lg shadow-lg">
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
      {/* Document Info Panel */}
      {ctx.infoDoc && (
        <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
          <div className="pointer-events-auto w-[340px] h-full bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-semibold text-foreground">Document Info</span>
              </div>
              <button onClick={() => ctx.setInfoDoc(null)} className="p-1.5 rounded hover:bg-accent transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              {[
                { icon: <FileText className="w-4 h-4 text-blue-500" />, label: 'File Name', value: ctx.infoDoc.original_file_name || ctx.infoDoc.name },
                { icon: <User className="w-4 h-4 text-blue-500" />, label: 'Uploaded By', value: ctx.infoDoc.created_by?.full_name || 'System' },
                { icon: <Calendar className="w-4 h-4 text-rose-500" />, label: 'Created At', value: ctx.infoDoc.created_at ? new Date(ctx.infoDoc.created_at).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A' },
                { icon: <Calendar className="w-4 h-4 text-amber-500" />, label: 'Updated At', value: ctx.infoDoc.updated_at ? new Date(ctx.infoDoc.updated_at).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A' },
              ].map((row, i) => (
                <div key={i} className="flex items-start gap-3 py-1.5 border-b border-border last:border-0">
                  <div className="mt-0.5 flex-shrink-0">{row.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">{row.label}</div>
                    <div className="text-[12px] text-foreground break-all">{row.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Document Share Modal */}
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

      <DeleteModal
        isOpen={!!ctx.deleteConfirm}
        type="confirm"
        itemType="document"
        itemName={ctx.deleteConfirm?.name}
        onConfirm={ctx.handleDeleteConfirm}
        onCancel={() => ctx.setDeleteConfirm(null)}
        isDeleting={ctx.isDeleting}
      />

      {/* Bulk delete — confirm */}
      <DeleteModal
        isOpen={showBulkDeleteConfirm}
        type="confirm"
        itemType="task"
        itemName={ctx.selectedTaskIds.size === 1 ? undefined : `${ctx.selectedTaskIds.size} tasks`}
        onConfirm={handleBulkDeleteConfirmed}
        onCancel={() => setShowBulkDeleteConfirm(false)}
        isDeleting={isBulkDeleting}
      />

      {/* Bulk delete — permission denied */}
      <DeleteModal
        isOpen={showBulkDeleteDenied}
        type="denied"
        itemType="task"
        onCancel={() => setShowBulkDeleteDenied(false)}
      />

      {/* Quick Notes Slide-Out Panel */}
      {ctx.showNotesPanel && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/30"
          onClick={() => ctx.setShowNotesPanel(false)}
        >
          <div
            className="w-96 bg-card h-full shadow-2xl flex flex-col transform transition-transform animate-in slide-in-from-right border-l border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-border bg-muted">
              <div className="flex items-center gap-2">
                <NotebookPen className="w-5 h-5 text-purple-600" />
                <h2 className="text-[1.1rem] font-bold text-foreground">Quick Notes</h2>
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
                <button className="p-1.5 rounded-full hover:bg-accent transition-colors" onClick={() => ctx.setShowNotesPanel(false)}>
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-background">

              {/* New Note Creation Form */}
              {ctx.isCreatingNote && (
                <div className="bg-card rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-purple-500/30 p-4">
                  <textarea
                    value={ctx.newNoteContent}
                    onChange={(e) => ctx.setNewNoteContent(e.target.value)}
                    className="w-full min-h-[120px] p-3 text-[14px] text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-input resize-y placeholder:text-muted-foreground"
                    placeholder="Type a new shared note for this project..."
                    autoFocus
                  />
                  <div className="flex justify-end gap-2 mt-3">
                    <button
                      onClick={ctx.handleCreateNoteCancel}
                      className="px-4 py-1.5 text-[13px] font-medium text-muted-foreground bg-muted hover:bg-accent rounded-md transition-colors"
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
                    <div key={note.id} className="group bg-card rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-border p-4 hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold uppercase">
                            {initial}
                          </div>
                          <span className="text-sm font-bold text-foreground">
                            {displayName}
                          </span>
                        </div>

                        {/* Show Edit to everyone, but Delete ONLY to the original author */}
                        {ctx.editingNoteId !== note.id && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <button
                              onClick={() => ctx.handleEditNoteStart(note)}
                              className="p-1.5 text-muted-foreground hover:text-purple-500 hover:bg-purple-500/10 rounded-md transition-colors"
                              title="Edit Note"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>

                            {note.user === ctx.user?.id && (
                              <button
                                onClick={() => ctx.handleDeleteNote(note.id)}
                                className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
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
                            className="w-full min-h-[120px] p-3 text-[14px] text-foreground border border-purple-500/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-input resize-y placeholder:text-muted-foreground"
                            placeholder="Type your note here..."
                            autoFocus
                          />
                          <div className="flex justify-end gap-2 mt-3">
                            <button
                              onClick={ctx.handleEditNoteCancel}
                              className="px-4 py-1.5 text-[13px] font-medium text-muted-foreground bg-muted hover:bg-accent rounded-md transition-colors"
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
                        <div className="text-[14px] text-foreground leading-relaxed whitespace-pre-wrap">
                          {note.content}
                        </div>
                      )}

                      {/* Display the Last Edited badge when anyone edits it, including the owner */}
                      {note.updated_by && editorName && ctx.editingNoteId !== note.id && (
                        <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-muted w-fit px-2 py-1 rounded-md border border-border">
                          <Pencil className="w-3 h-3 text-muted-foreground" />
                          Last edited by {editorName}
                        </div>
                      )}

                      {note.attachments && note.attachments.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-border">
                          {note.attachments.map((att) => (
                            <button
                              key={att.id}
                              onClick={() => ctx.setPreviewDocument({
                                url: att.file,
                                fileName: att.filename,
                                fileType: att.filename.split('.').pop()?.toLowerCase() || ''
                              })}
                              className="px-2.5 py-1 bg-muted hover:bg-accent hover:text-purple-500 hover:border-purple-500/30 text-muted-foreground rounded-md text-[11px] font-semibold border border-border transition-colors cursor-pointer text-left"
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
                 <NotebookPen className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground font-medium text-sm">No quick notes attached to this project.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Task Preview Overlay ── */}
      {showPreviewOverlay && (
        <TaskPreviewOverlay
          tasks={previewTasks}
          onRemoveTask={handleDeletePreviewTask}
          onEditTitle={handleEditPreviewTaskTitle}
          onBack={handleBackToImport}
          onCreateTasks={handleCreateFromPreview}
          isCreating={isBulkUploading}
        />
      )}

      {/* ── Import Tasks Modal ── */}
      {isBulkUploadModalOpen && (
       <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all animate-in zoom-in-95 duration-200">

            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border bg-muted">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-[#65408b]" />
                <h2 className="text-[1.1rem] font-bold text-foreground">Import Tasks via JSON</h2>
              </div>
              <button onClick={() => setIsBulkUploadModalOpen(false)} className="p-1.5 rounded-full hover:bg-accent transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-background flex flex-col gap-6">

              {/* Expected Format Section */}
              <div className="bg-card p-4 rounded-xl border border-border shadow-sm">
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-500" /> Expected Format
                </h3>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => copyJsonExample(dummyJsonExample)}
                    aria-label={jsonExampleCopied ? 'Copied' : 'Copy sample JSON'}
                    className={`absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${jsonExampleCopied
                      ? 'bg-green-500/20 text-green-300'
                      : 'bg-white/10 text-white/80 hover:bg-white/20'
                      }`}
                  >
                    {jsonExampleCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy
                      </>
                    )}
                  </button>
                 <pre className="bg-[#0d1117] text-green-400 p-4 rounded-lg text-[12px] overflow-x-auto font-mono leading-relaxed">
                    {dummyJsonExample}
                  </pre>
                </div>
              </div>

              {/* Paste or Upload Section */}
              <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-col gap-4">
                <h3 className="text-sm font-bold text-foreground">Paste JSON Code</h3>
                <textarea
                  value={pastedJson}
                  onChange={(e) => setPastedJson(e.target.value)}
                  placeholder="Paste your JSON array here..."
                  className="w-full h-48 p-3 text-[13px] text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#65408b] font-mono resize-y bg-input placeholder:text-muted-foreground"
                />

                {/* Inline count + preview hint */}
                {previewTasks.length > 0 && !previewError && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                    <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                    <span className="text-[12px] font-semibold text-green-700">
                      {previewTasks.length} {previewTasks.length === 1 ? 'task' : 'tasks'} detected — click Preview to review before creating.
                    </span>
                  </div>
                )}

                {/* Inline syntax error hint */}
                {pastedJson.trim() && previewError && (
                  <p className="text-[11px] text-red-500 mt-1">{previewError}</p>
                )}

                <div className="flex items-center justify-between mt-2 pt-4 border-t border-border">
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
                      className="px-4 py-2 bg-muted hover:bg-accent text-foreground text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 border border-border shadow-sm"
                    >
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      Select .json File
                    </button>
                  </div>

                  <button
                    onClick={handleShowPreview}
                    disabled={isBulkUploading || previewTasks.length === 0 || !!previewError}
                    className="px-6 py-2 bg-[#65408b] hover:bg-[#553675] text-white text-sm font-bold rounded-lg transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Search className="w-4 h-4" />
                    Preview
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Upload Result Modal ── */}
      {uploadResultModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
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