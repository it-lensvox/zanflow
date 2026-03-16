import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Loader2, Upload, FileText, List, Grid3X3, Settings, MessageCircle, Search } from 'lucide-react';
import { projectsApi, taskApi, documentsApi } from '@/services/api';
import { DualView, ViewToggle } from '@/components/layout/DualView';
import { useViewMode } from '@/components/layout/DualView/useViewMode';
import { createDocumentsTableColumns, DocumentGridCard } from '@/components/layout/DualView/documentsConfig';
import { TaskGridCard, createTasksTableColumns } from '@/components/layout/DualView/taskConfig';
import { TaskDetailModal } from '../MyTask/TaskDetailModal';
import { useTableFilters, ColumnFilterConfig } from '@/hooks/useTableFilters';
import { SearchFilter, ListFilter, DateFilter, FilterHeaderWrapper } from '@/components/layout/DualView/FilterComponents';
import { getStatusConfig, priorityOptions, statusOptions } from '@/components/layout/DualView/taskConfig';
import { CreateTask } from '@/pages/MyTask/CreateTask';
import { MediaThumbnail } from './ContentCreation';
import { DocumentPreview, useDocumentPreviewKeyboard } from '@/components/common/DocumentPreview';
import DeleteModal from '@/components/common/Deletemodal';
import './TaskDetails.scss';
import type { Task, TaskOption, FilteredDocument, AllDocumentsResponse, TaskAttachment } from '@/types';
import Threads from '../Project/Thread';


type TabType = 'tasks' | 'add_documents';


export function TaskDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();


    const [activeTab, setActiveTab] = useState<TabType>('tasks');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const { viewMode: docViewMode, setViewMode: setDocViewMode } = useViewMode({
        defaultMode: 'table',
        storageKey: 'project-documents-view-mode',
    });
    const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<any | null>(null);

    // Upload & Media States
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [previewDocument, setPreviewDocument] = useState<{
        url: string;
        fileName: string;
        fileType?: string;
    } | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);


    // Document UI state
    const [documentFilter, setDocumentFilter] = useState<'project' | 'task'>('project');
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
    const [taskSearchQuery, setTaskSearchQuery] = useState('');
    const [showTaskDropdown, setShowTaskDropdown] = useState(false);
    const taskDropdownRef = useRef<HTMLDivElement>(null);

    const { data: project, isLoading: isProjectLoading } = useQuery({
        queryKey: ['project', id],
        queryFn: () => projectsApi.get((Number(id))),
        enabled: !!id,
        staleTime: Infinity,
        placeholderData: () => {
            const cache = queryClient.getQueryData(['projects']) as any || queryClient.getQueryData(['projects', '']) as any;
            const list = Array.isArray(cache) ? cache : (cache?.results || []);
            return list.find((p: any) => p.id === Number(id));
        }
    });

    // Fetch documents for the grid
    const [mediaPage, setMediaPage] = useState(1);
    const [allMediaFiles, setAllMediaFiles] = useState<any[]>([]);
    const [hasMoreMedia, setHasMoreMedia] = useState(true);
    const mediaScrollRef = useRef<HTMLDivElement>(null);

    const { data: documentsData, isLoading: isMediaLoading, isFetching: isMediaFetching } = useQuery({
        queryKey: ['documents', { project: id, page: mediaPage }],
        queryFn: () => documentsApi.list({ project: (Number(id)), page: mediaPage }),
        enabled: !!id && hasMoreMedia && activeTab !== 'add_documents',
        staleTime: 1000 * 60 * 5,
    });

    // Update media files when new data arrives
    useEffect(() => {
        if (documentsData) {
            const allResults = documentsData?.results || documentsData || [];
            const newMediaFiles = allResults.filter((file: any) => {
                const hasGtMetadata = !!file.metadata?.gt_category;
                return !hasGtMetadata;
            });

            if (mediaPage === 1) {
                setAllMediaFiles(newMediaFiles);
            } else {
                setAllMediaFiles(prev => [...prev, ...newMediaFiles]);
            }

            // Check if there are more pages
            if (documentsData?.next === null || allResults.length === 0) {
                setHasMoreMedia(false);
            }
        }
    }, [documentsData, mediaPage]);

    // Infinite scroll handler for media
    const handleMediaScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const scrollPercentage = (target.scrollTop + target.clientHeight) / target.scrollHeight;

        if (scrollPercentage > 0.8 && !isMediaFetching && hasMoreMedia) {
            setMediaPage(prev => prev + 1);
        }
    }, [isMediaFetching, hasMoreMedia]);

    const mediaFiles = allMediaFiles;
    const handleDeleteDocument = async (documentId: string) => {
        if (!id || !window.confirm('Are you sure you want to delete this file?')) return;

        try {
            await documentsApi.delete(documentId);
            queryClient.invalidateQueries({ queryKey: ['gt-documents', { project: id }] });
        } catch (error) {
            console.error('Failed to delete document:', error);
        }
    };

    const handleTaskCreated = () => {
        setIsCreateTaskModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
    };


    // 6. ADD this new useQuery for tasks
    const { data: tasksData, isLoading: isLoadingTasks } = useQuery({
        queryKey: ['tasks'],
        queryFn: () => taskApi.list(),
        staleTime: 0,
        select: (data) => {
            const allTasks = data.tasks || data.results || [];
            return allTasks.filter((t: any) => String(t.project) === id);
        },
    });

    const tasks = (tasksData || []) as Task[];

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (taskDropdownRef.current && !taskDropdownRef.current.contains(event.target as Node)) {
                setShowTaskDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handle filter change
    const handleFilterChange = (filter: 'project' | 'task') => {
        setDocumentFilter(filter);
        if (filter === 'project') {
            setSelectedTaskId(null);
            setShowTaskDropdown(false);
        }
    };

    // Handle task selection
    const handleTaskSelect = (taskId: number) => {
        setSelectedTaskId(taskId);
        setShowTaskDropdown(false);
        setTaskSearchQuery('');
    };

    // Fetch project-level documents
    const { data: allDocumentsData, isLoading: isAllDocumentsLoading } = useQuery({
        queryKey: ['all-documents', id],
        queryFn: async (): Promise<AllDocumentsResponse> => {
            return await documentsApi.getAllDocuments(Number(id));
        },
        enabled: activeTab === 'add_documents',
        staleTime: 0,
        refetchOnMount: true,
    });

    // Fetch task attachments when a specific task is selected
    const { data: selectedTaskData, isLoading: isTaskAttachmentsLoading } = useQuery({
        queryKey: ['task-attachments', selectedTaskId],
        queryFn: () => taskApi.get(selectedTaskId!),
        enabled: activeTab === 'add_documents' && documentFilter === 'task' && !!selectedTaskId,
        staleTime: 0,
        refetchOnMount: true,
    });

    // Fetch all tasks attachments when Task button is active but no specific task selected
    const { data: allTasksData, isLoading: isAllTasksLoading } = useQuery({
        queryKey: ['all-tasks-attachments', id],
        queryFn: () => taskApi.list(),
        enabled: activeTab === 'add_documents' && documentFilter === 'task' && !selectedTaskId,
        staleTime: 0,
        refetchOnMount: true,
        select: (data) => {
            const allTasks = data.tasks || data.results || [];
            return allTasks.filter((t: any) => String(t.project) === id);
        },
    });

    const allDocuments: FilteredDocument[] = allDocumentsData?.documents || [];

    // Must be declared before filteredDocuments
    const taskOptions: TaskOption[] = React.useMemo(() => {
        return tasks.map((task: Task) => ({
            task_id: task.id,
            task_heading: task.heading
        })).sort((a: TaskOption, b: TaskOption) => a.task_heading.localeCompare(b.task_heading));
    }, [tasks]);

    const selectedTaskName = taskOptions.find(t => t.task_id === selectedTaskId)?.task_heading || 'Select Task';

    // Filter documents based on selected filter
    const filteredDocuments = React.useMemo(() => {
        if (documentFilter === 'project') {
            // Only project-level docs (source === 'Project')
            return allDocuments.filter((doc: FilteredDocument) => doc.source === 'Project');
        } else if (documentFilter === 'task') {
            if (selectedTaskId) {
                // Specific task selected — show only that task's attachments
                const taskData = selectedTaskData?.task || selectedTaskData;
                const attachments: TaskAttachment[] = taskData?.attachments || [];
                return attachments.map((att: TaskAttachment) => ({
                    id: att.id,
                    file_name: att.file_name,
                    file_url: att.file_url,
                    uploaded_at: att.uploaded_at,
                    source: 'Task' as const,
                    task_id: selectedTaskId,
                    task_heading: selectedTaskName,
                }));
            }
            // No specific task — show all attachments from all tasks in this project
            const allTasks = (allTasksData || []) as Task[];
            return allTasks.flatMap((task: Task) =>
                (task.attachments || []).map((att: TaskAttachment) => ({
                    id: att.id,
                    file_name: att.file_name,
                    file_url: att.file_url,
                    uploaded_at: att.uploaded_at,
                    source: 'Task' as const,
                    task_id: task.id,
                    task_heading: task.heading,
                }))
            );
        }
        return allDocuments;
    }, [allDocuments, documentFilter, selectedTaskId, selectedTaskData, selectedTaskName, allTasksData]);

    const isDocumentsLoading = isAllDocumentsLoading || isTaskAttachmentsLoading || isAllTasksLoading;

    // Filter task options based on search
    const filteredTaskOptions = taskOptions.filter(option =>
        option.task_heading.toLowerCase().includes(taskSearchQuery.toLowerCase())
    );

    // Filter configuration for task columns
    const filterConfig: ColumnFilterConfig[] = [
        { key: 'project', type: 'search', searchFields: ['project_details', 'name'] },
        { key: 'heading', type: 'search' },
        { key: 'labels', type: 'search' },
        {
            key: 'status',
            type: 'list',
            listOptions: statusOptions.map(opt => ({
                value: opt.value.toUpperCase(),
                label: opt.label
            }))
        },
        {
            key: 'priority',
            type: 'list',
            listOptions: priorityOptions.map(opt => ({
                value: opt.value,
                label: opt.label
            }))
        },
        { key: 'end_date', type: 'date' },
    ];

    // Initialize filter hook
    const {
        filteredData: filteredTasks,
        handleSort,
        columnFilters,
        setColumnFilters,
        clearFilter,
        activeFilterKey,
        setActiveFilterKey,
        filterContainerRef,
    } = useTableFilters<Task>({
        data: tasks,
        columns: filterConfig,
        globalSearchFields: ['heading', 'description'],
    });

    // Handle filter toggle
    const handleFilter = useCallback((key: string) => {
        setActiveFilterKey(prev => prev === key ? null : key);
    }, [setActiveFilterKey]);


    // Reusable Upload Flow
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !id) return;

        const MAX_FILE_SIZE = 500 * 1024 * 1024;
        if (file.size > MAX_FILE_SIZE) {
            setUploadError('File size exceeds the 500 MB limit.');
            return;
        }

        try {
            setIsUploading(true);
            setUploadError(null);
            const projectIdNum = Number(id);

            const uploadUrlResponse = await documentsApi.getUploadUrl(projectIdNum, {
                file_name: file.name,
                file_type: file.type || 'application/octet-stream',
            });

            const { url: s3Url, fields: s3Fields, file_key } = uploadUrlResponse;

            await documentsApi.uploadFileToS3(s3Url, s3Fields, file);

            const ext = file.name.split('.').pop()?.toLowerCase() || '';
            const imageTypes = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'];
            const docTypes = ['doc', 'docx', 'pdf', 'txt', 'rtf'];
            const spreadsheetTypes = ['xls', 'xlsx', 'csv'];
            const presentationTypes = ['ppt', 'pptx'];

            let mappedType = 'other';
            if (imageTypes.includes(ext)) mappedType = 'image';
            else if (ext === 'pdf') mappedType = 'pdf';
            else if (ext === 'json') mappedType = 'json';
            else if (docTypes.includes(ext) || spreadsheetTypes.includes(ext) || presentationTypes.includes(ext)) mappedType = 'document';
            else if (ext === 'zip' || ext === 'xml') mappedType = ext;

            const confirmResponse = await documentsApi.confirmUpload(projectIdNum, {
                file_key: file_key,
                file_name: file.name,
                file_type: mappedType,
            });

            if (confirmResponse.id) {
                await documentsApi.getDownloadUrl(projectIdNum, { document_id: confirmResponse.id });
            }

            // Optimistically inject created_by from current user for the newly uploaded doc
            // so "Uploaded By" renders immediately without waiting for allMediaFiles refetch
            if (confirmResponse.id && user) {
                setAllMediaFiles(prev => [
                    ...prev,
                    {
                        id: confirmResponse.id,
                        created_by: {
                            id: user.id,
                            username: user.username,
                            full_name: `${user.first_name} ${user.last_name}`.trim() || user.username,
                        },
                        file_type: mappedType,
                        project_name: project?.name || 'General',
                    },
                ]);
            }
            // Reset pagination state to show new document immediately
            setMediaPage(1);
            setHasMoreMedia(true);
            queryClient.invalidateQueries({ queryKey: ['all-documents', id] });
            queryClient.invalidateQueries({ queryKey: ['documents', { project: id }] });
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (err: any) {
            setUploadError(err.message || 'Upload failed');
        } finally {
            setIsUploading(false);
        }
    };


    // Drag and drop handlers - reuse existing upload logic
    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isUploading) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        // Only set to false if leaving the drop zone entirely
        if (e.currentTarget === e.target) {
            setIsDragging(false);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (isUploading) return;

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const syntheticEvent = {
                target: { files: files }
            } as unknown as React.ChangeEvent<HTMLInputElement>;

            await handleFileUpload(syntheticEvent);
        }
    };

    const handleDeleteTask = async (taskId: number) => {
        try {
            await taskApi.delete(taskId);
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            setSelectedTask(null);
        } catch (error) {
            console.error("Failed to delete task:", error);
        }
    };

    // Handle document preview 
    const handleDocumentClick = (doc: FilteredDocument) => {
        if (!doc.file_url) {
            alert('Document URL not available.');
            return;
        }

        setPreviewDocument({
            url: doc.file_url,
            fileName: doc.file_name || 'Document',
            fileType: doc.file_name?.split('.').pop() || ''
        });
    };

    const handleDeleteClick = (e: React.MouseEvent, doc: any) => {
        e.stopPropagation();
        setDeleteConfirm({ id: String(doc.id), name: doc.name || doc.file_name || 'Document' });
    };

    const handleDeleteConfirm = async () => {
        if (!deleteConfirm) return;
        try {
            setIsDeleting(true);
            if (documentFilter === 'task') {
                await taskApi.deleteAttachment(deleteConfirm.id);
            } else {
                await documentsApi.delete(deleteConfirm.id);
            }
            setDeleteConfirm(null);
            if (documentFilter === 'project') {
                queryClient.invalidateQueries({ queryKey: ['all-documents', id] });
            } else if (selectedTaskId) {
                queryClient.invalidateQueries({ queryKey: ['task-attachments', selectedTaskId] });
            } else {
                queryClient.invalidateQueries({ queryKey: ['all-tasks-attachments', id] });
            }
        } catch (error) {
            console.error('Delete failed:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    // Enable keyboard shortcuts for document preview
    useDocumentPreviewKeyboard(() => setPreviewDocument(null));

    if (isProjectLoading) return <div className="content-creation-loading"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="content-creation task-details">
            <div className="content-creation__main">
                <div className="content-creation__header-top">
                    <Link to="/projects" className="content-creation__back-button">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div className="content-creation__title-section flex justify-between items-center w-full">
                        <div>
                            <h1 className="content-creation__title">{project?.name}</h1>
                        </div>
                        <p className="content-creation__subtitle">
                            {project?.task_type.replace('_', ' ').toUpperCase()} DASHBOARD
                        </p>
                    </div>

                </div>
                <div className="content-creation__tabs">
                    {(['tasks', 'add_documents'] as TabType[]).map((tab) => (
                        <button
                            key={tab}
                            className={`content-creation__tab ${activeTab === tab ? 'content-creation__tab--active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab === 'add_documents' ? 'Documents' : tab.toUpperCase()}
                        </button>
                    ))}

                    {activeTab === 'tasks' && (
                        <div className="flex items-center bg-white p-1 gap-1 ml-auto">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                                title="List View"
                            >
                                <List className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                                title="Grid View"
                            >
                                <Grid3X3 className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    <button
                        className={`content-creation__tab content-creation__tab--create-task${activeTab !== 'tasks' ? ' !ml-auto' : ''}`}
                        onClick={() => setIsCreateTaskModalOpen(true)}
                    >
                        Create Task
                    </button>

                    <button
                        onClick={() => navigate('/team-chat', { state: { projectId: Number(id) } })}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors flex items-center gap-2 text-gray-600 hover:text-black"
                        title="Team Chat"
                    >
                        <MessageCircle className="h-4 w-4" />
                    </button>

                    <button
                        onClick={() => navigate(`/projects/${id}/settings`)}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors flex items-center gap-2 text-gray-600 hover:text-black"
                        title="Project Settings"
                    >
                        <Settings className="h-4 w-4" />
                    </button>
                </div>
                <div className="content-creation__content">
                    {activeTab === 'tasks' && (
                        <div className="content-creation__tasks">
                            {isLoadingTasks ? (
                                <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8" /></div>
                            ) : tasks.length > 0 ? (
                                <>
                                    {viewMode === 'list' ? (
                                        <div className="bg-white rounded-lg shadow-sm">
                                            <DualView
                                                viewMode="table"
                                                gridProps={{
                                                    data: filteredTasks,
                                                    renderCard: (task: Task) => <TaskGridCard task={task} onTaskClick={setSelectedTask} />,
                                                }}
                                                tableProps={{
                                                    data: filteredTasks,
                                                    activeFilterKey: activeFilterKey,
                                                    columns: createTasksTableColumns({
                                                        onTaskClick: setSelectedTask,
                                                        queryClient,
                                                        user,
                                                        navigate
                                                    }).map(col => ({
                                                        ...col,
                                                        headerClassName: `relative ${activeFilterKey === col.key ? 'z-[100]' : ''}`,
                                                        label: (
                                                            <div ref={activeFilterKey === col.key ? filterContainerRef : null}>
                                                                <FilterHeaderWrapper
                                                                    columnLabel={col.label as string}
                                                                    filterType={
                                                                        ['project', 'heading', 'labels'].includes(col.key) ? 'search' :
                                                                            ['status', 'priority'].includes(col.key) ? 'list' :
                                                                                col.key === 'end_date' ? 'date' : 'none'
                                                                    }
                                                                    isActive={activeFilterKey === col.key}
                                                                    filterContent={
                                                                        <>
                                                                            {col.key === 'status' && (
                                                                                <ListFilter
                                                                                    columnKey="status"
                                                                                    options={statusOptions.map(status => ({
                                                                                        value: status.value.toUpperCase(),
                                                                                        label: status.label,
                                                                                        icon: React.createElement(getStatusConfig(status.value.toUpperCase() as any).icon, { className: "w-3.5 h-3.5" }),
                                                                                        className: getStatusConfig(status.value.toUpperCase() as any).text,
                                                                                    }))}
                                                                                    selectedValue={columnFilters.status || ''}
                                                                                    onSelect={(value) => {
                                                                                        setColumnFilters(prev => ({ ...prev, status: value }));
                                                                                        setActiveFilterKey(null);
                                                                                    }}
                                                                                    onClear={() => {
                                                                                        clearFilter('status');
                                                                                        setActiveFilterKey(null);
                                                                                    }}
                                                                                    isActive={activeFilterKey === 'status'}
                                                                                    containerRef={filterContainerRef}
                                                                                />
                                                                            )}
                                                                            {col.key === 'priority' && (
                                                                                <ListFilter
                                                                                    columnKey="priority"
                                                                                    options={priorityOptions.map(opt => ({
                                                                                        value: opt.value,
                                                                                        label: opt.label,
                                                                                        icon: <span>{opt.icon}</span>
                                                                                    }))}
                                                                                    selectedValue={columnFilters.priority || ''}
                                                                                    onSelect={(value) => {
                                                                                        setColumnFilters(prev => ({ ...prev, priority: value }));
                                                                                        setActiveFilterKey(null);
                                                                                    }}
                                                                                    onClear={() => {
                                                                                        clearFilter('priority');
                                                                                        setActiveFilterKey(null);
                                                                                    }}
                                                                                    isActive={activeFilterKey === 'priority'}
                                                                                    containerRef={filterContainerRef}
                                                                                />
                                                                            )}
                                                                            {col.key === 'end_date' && (
                                                                                <DateFilter
                                                                                    columnKey="end_date"
                                                                                    value={columnFilters.end_date || ''}
                                                                                    onChange={(value) => {
                                                                                        setColumnFilters(prev => ({ ...prev, end_date: value }));
                                                                                        setActiveFilterKey(null);
                                                                                    }}
                                                                                    onClear={() => {
                                                                                        clearFilter('end_date');
                                                                                        setActiveFilterKey(null);
                                                                                    }}
                                                                                    isActive={activeFilterKey === 'end_date'}
                                                                                    containerRef={filterContainerRef}
                                                                                />
                                                                            )}
                                                                        </>
                                                                    }
                                                                >
                                                                    {['project', 'heading', 'labels'].includes(col.key) && (
                                                                        <SearchFilter
                                                                            columnKey={col.key}
                                                                            placeholder={`Search...`}
                                                                            value={columnFilters[col.key] || ''}
                                                                            onChange={(value) => setColumnFilters(prev => ({ ...prev, [col.key]: value }))}
                                                                            isActive={activeFilterKey === col.key}
                                                                        />
                                                                    )}
                                                                </FilterHeaderWrapper>
                                                            </div>
                                                        )
                                                    })),
                                                    rowKey: (task: Task) => task.id,
                                                    onRowClick: setSelectedTask,
                                                    onSort: handleSort,
                                                    onFilter: handleFilter,
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {filteredTasks.map(task => (
                                                <TaskGridCard key={task.id} task={task} onTaskClick={setSelectedTask} />
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="content-creation__tasks-empty">
                                    <div className="content-creation__empty-icon">📋</div>
                                    <h3>No tasks found</h3>
                                    <p>Try changing your filter or create a new task</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'add_documents' && (
                        <div
                            className="content-creation__media"
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                        >
                            {/* Filter Bar */}
                            <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => handleFilterChange('project')}
                                        className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${documentFilter === 'project'
                                            ? 'bg-black text-white shadow-md'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        Project
                                    </button>
                                    <button
                                        onClick={() => handleFilterChange('task')}
                                        className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${documentFilter === 'task'
                                            ? 'bg-black text-white shadow-md'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        Task
                                    </button>

                                    {/* Task Dropdown */}
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
                                                            filteredTaskOptions.map((option) => (
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
                                                            <div className="px-4 py-8 text-center text-sm text-gray-500">
                                                                No tasks found
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Upload Button with View Toggle */}
                                {documentFilter === 'task' && (
                                    <ViewToggle viewMode={docViewMode} onViewModeChange={setDocViewMode} />
                                )}
                                {documentFilter === 'project' && (
                                    <div className="flex items-center gap-2">
                                        <ViewToggle viewMode={docViewMode} onViewModeChange={setDocViewMode} />
                                        <label className={`flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-lg font-medium text-sm cursor-pointer hover:bg-gray-800 transition-all duration-200 shadow-sm ${isUploading ? 'opacity-50 cursor-not-allowed' : ''
                                            }`}>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                className="hidden"
                                                onChange={handleFileUpload}
                                                disabled={isUploading}
                                                accept="*"
                                            />
                                            {isUploading ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Upload className="w-4 h-4" />
                                            )}
                                            <span>{isUploading ? 'Uploading...' : 'Upload Documents'}</span>
                                        </label>
                                    </div>
                                )}
                            </div>

                            {isDocumentsLoading ? (
                                <div className="flex justify-center p-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
                                </div>
                            ) : (
                                <DualView
                                    viewMode={docViewMode}
                                    isLoading={isAllDocumentsLoading}
                                    gridProps={{
                                        data: (filteredDocuments as any[]).map(doc => {
                                            const fileName = doc.file_name || doc.original_file_name || doc.name || '';
                                            const ext = fileName.split('.').pop()?.toLowerCase() || '';
                                            return {
                                                ...doc,
                                                name: fileName,
                                                status: doc.status ?? 'draft',
                                                file_type: doc.file_type || ext || 'other',
                                                project_name: doc.project_name || project?.name || 'General',
                                                created_by: doc.created_by ?? (doc.uploaded_by ? { full_name: doc.uploaded_by } : null),
                                                updated_at: doc.updated_at ?? doc.uploaded_at ?? doc.created_at ?? '',
                                            };
                                        }),
                                        renderCard: (doc: any) => (
                                            <DocumentGridCard
                                                key={doc.id}
                                                document={doc}
                                                onCardClick={(d) => handleDocumentClick(d as any)}
                                                onDeleteClick={(e, d) => handleDeleteClick(e, d)}
                                            />
                                        ),
                                        gridClassName: 'grid gap-4 md:grid-cols-2 lg:grid-cols-3',
                                        emptyState: (
                                            <div className="content-creation__media-empty">
                                                <p className="content-creation__empty-text">No documents uploaded yet</p>
                                            </div>
                                        ),
                                    }}
                                    tableProps={{
                                        data: (filteredDocuments as any[]).map(doc => {
                                            const fileName = doc.file_name || doc.original_file_name || doc.name || '';
                                            const ext = fileName.split('.').pop()?.toLowerCase() || '';
                                            // Cross-reference with allMediaFiles (documentsApi.list) to get created_by,
                                            // since getAllDocuments (FilteredDocument) does not include created_by
                                            const enriched = allMediaFiles.find((m: any) => m.id === doc.id);
                                            return {
                                                ...doc,
                                                name: fileName,
                                                status: doc.status ?? enriched?.status ?? 'draft',
                                                file_type: doc.file_type || enriched?.file_type || ext || 'other',
                                                project_name: doc.project_name || enriched?.project_name || project?.name || 'General',
                                                created_by: doc.created_by ?? enriched?.created_by ?? (doc.uploaded_by ? { full_name: doc.uploaded_by } : null),
                                                updated_at: doc.updated_at ?? doc.uploaded_at ?? doc.created_at ?? '',
                                            };
                                        }),
                                        columns: createDocumentsTableColumns({
                                            onDeleteClick: (e, doc) => handleDeleteClick(e, doc),
                                        }),
                                        rowKey: (doc: any) => doc.id,
                                        onRowClick: (doc: any) => handleDocumentClick(doc),
                                        emptyState: (
                                            <div className="content-creation__media-empty">
                                                <p className="content-creation__empty-text">No documents uploaded yet</p>
                                            </div>
                                        ),
                                    }}
                                />
                            )}
                            {/* Full-page drag overlay */}
                            {isDragging && (
                                <div className="fixed inset-0 bg-primary/10 border-4 border-dashed border-primary pointer-events-none z-50 flex items-center justify-center">
                                    <div className="bg-white p-8 rounded-lg shadow-lg">
                                        <Upload className="h-16 w-16 text-primary mx-auto mb-4" />
                                        <p className="text-xl font-semibold text-primary">Drop document anywhere to upload</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {previewDocument && (
                <DocumentPreview
                    url={previewDocument.url}
                    fileName={previewDocument.fileName}
                    fileType={previewDocument.fileType}
                    onClose={() => setPreviewDocument(null)}
                />
            )}

            {
                isCreateTaskModalOpen && (
                    <CreateTask
                        onClose={() => setIsCreateTaskModalOpen(false)}
                        onSuccess={() => {
                            setIsCreateTaskModalOpen(false);
                            queryClient.invalidateQueries({ queryKey: ['tasks'] });
                        }}
                        isModal={true}
                        fixedProjectId={id ? Number(id) : undefined}
                    />

                )
            }

            {
                selectedTask && (
                    <TaskDetailModal
                        task={selectedTask}
                        onClose={() => setSelectedTask(null)}
                        onTaskUpdated={() => queryClient.invalidateQueries({ queryKey: ['tasks'] })}
                        onDelete={handleDeleteTask}
                    />
                )
            }
            <DeleteModal
                isOpen={!!deleteConfirm}
                type="confirm"
                itemType="document"
                itemName={deleteConfirm?.name}
                onConfirm={handleDeleteConfirm}
                onCancel={() => setDeleteConfirm(null)}
                isDeleting={isDeleting}
            />
        </div >
    );
}