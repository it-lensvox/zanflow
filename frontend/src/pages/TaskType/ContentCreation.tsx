import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
    ArrowLeft, Plus, Upload, Search, Film, Loader2, FileText, FileJson, Settings,
    List, Grid3X3, MessageCircle
} from 'lucide-react';
import { projectsApi, taskApi, documentsApi } from '@/services/api';
import type { Task, AllDocumentsResponse, FilteredDocument, TaskOption } from '@/types'
import { CreateTask } from '@/pages/MyTask/CreateTask';
import { DualView } from '@/components/layout/DualView/DualView';
import { TaskGridCard, createTasksTableColumns } from '@/components/layout/DualView/taskConfig';
import { DocumentPreview, useDocumentPreviewKeyboard } from '@/components/common/DocumentPreview';
import { TaskDetailModal } from '../MyTask/TaskDetailModal';
import { useTableFilters, ColumnFilterConfig } from '@/hooks/useTableFilters';
import { SearchFilter, ListFilter, DateFilter, FilterHeaderWrapper } from '@/components/layout/DualView/FilterComponents';
import { getStatusConfig, priorityOptions, statusOptions } from '@/components/layout/DualView/taskConfig';
import './ContentCreation.scss';
import Threads from '../Project/Thread';

type TabType = 'tasks' | 'calendar' | 'media';

export function MediaThumbnail({ file, projectId }: { file: any; projectId: number }) {
    const [imageUrl, setImageUrl] = React.useState<string | null>(null);
    const [imageError, setImageError] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);

    // Infer file type from filename
    const getFileType = () => {
        const fileName = file.file_name || file.original_file_name || '';
        const ext = fileName.split('.').pop()?.toLowerCase() || '';

        const imageTypes = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp'];
        const videoTypes = ['mp4', 'mov', 'avi', 'webm'];

        if (imageTypes.includes(ext)) return 'image';
        if (ext === 'pdf') return 'pdf';
        if (videoTypes.includes(ext)) return 'video';
        if (ext === 'json') return 'json';
        return 'other';
    };

    const fileType = file.file_type || getFileType();

    // Fetch image URL for images
    React.useEffect(() => {
        if (fileType !== 'image' || imageError) return;

        if (file.file_url) {
            setImageUrl(file.file_url);
        } else {
            setImageError(true);
        }
        setIsLoading(false);
    }, [file.file_url, fileType, imageError]);

    // Render image thumbnail
    if (fileType === 'image') {
        if (isLoading) {
            return (
                <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded">
                    <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
                </div>
            );
        }

        if (imageUrl && !imageError) {
            return (
                <img
                    src={imageUrl}
                    alt={file.file_name || file.original_file_name || 'Image'}
                    className="w-full h-full object-cover rounded"
                    onError={() => setImageError(true)}
                />
            );
        }

        // Fallback to icon if error
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded">
                <svg className="h-12 w-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            </div>
        );
    }

    // Video thumbnail with play icon overlay
    if (fileType === 'video') {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-900 rounded relative">
                <Film className="h-12 w-12 text-white" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                        <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </div>
                </div>
            </div>
        );
    }

    // PDF thumbnail
    if (fileType === 'pdf') {
        return (
            <div className="w-full h-full flex items-center justify-center bg-red-50 rounded">
                <FileText className="h-12 w-12 text-red-500" />
            </div>
        );
    }

    // JSON thumbnail
    if (fileType === 'json') {
        return (
            <div className="w-full h-full flex items-center justify-center bg-yellow-50 rounded">
                <FileJson className="h-12 w-12 text-yellow-600" />
            </div>
        );
    }

    // Default file icon
    return (
        <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded">
            <FileText className="h-12 w-12 text-gray-500" />
        </div>
    );
}

export function ContentCreation() {
    const { id } = useParams<{ id: string }>();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<TabType>('tasks');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const navigate = useNavigate();
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [previewDocument, setPreviewDocument] = useState<{
        url: string;
        fileName: string;
        fileType?: string;
    } | null>(null);
    const [documentFilter, setDocumentFilter] = useState<'project' | 'task'>('project');
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
    const [taskSearchQuery, setTaskSearchQuery] = useState('');
    const [showTaskDropdown, setShowTaskDropdown] = useState(false);
    const taskDropdownRef = useRef<HTMLDivElement>(null);
    const { data: tasksData, isLoading: isTasksLoading } = useQuery({
        queryKey: ['tasks'],
        queryFn: () => taskApi.list(),
        select: (data) => {
            const allTasks = data.tasks || data.results || [];
            return allTasks.filter((t: any) => String(t.project) === id);
        },
    });

    const tasks = tasksData || [];

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

    const { data: project, isLoading: isProjectLoading } = useQuery({
        queryKey: ['project', id],
        queryFn: () => projectsApi.get(Number(id)),
        enabled: !!id,
        staleTime: Infinity,
        placeholderData: () => {
            const cache = queryClient.getQueryData(['projects']) as any || queryClient.getQueryData(['projects', '']) as any;
            const list = Array.isArray(cache) ? cache : (cache?.results || []);
            return list.find((p: any) => p.id === Number(id));
        }
    });

    const [mediaPage, setMediaPage] = useState(1);
    const [allMediaFiles, setAllMediaFiles] = useState<any[]>([]);
    const [hasMoreMedia, setHasMoreMedia] = useState(true);
    const mediaScrollRef = useRef<HTMLDivElement>(null);

    const { data: documentsData, isLoading: isMediaLoading, isFetching: isMediaFetching } = useQuery({
        queryKey: ['documents', { project: id, page: mediaPage }],
        queryFn: () => documentsApi.list({ project: (Number(id)), page: mediaPage }),
        enabled: !!id && hasMoreMedia,
        staleTime: 1000 * 60 * 5,
    });

    // Update media files when new data arrives
    useEffect(() => {
        if (documentsData) {
            const newFiles = documentsData?.results || documentsData || [];

            if (mediaPage === 1) {
                setAllMediaFiles(newFiles);
            } else {
                setAllMediaFiles(prev => [...prev, ...newFiles]);
            }

            // Check if there are more pages
            if (documentsData?.next === null || newFiles.length === 0) {
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

    const mediaFiles = allMediaFiles;

    // Fetch all documents (project + task) - ONLY once when tab opens
    const { data: allDocumentsData, isLoading: isAllDocumentsLoading } = useQuery({
        queryKey: ['all-documents', id],
        queryFn: async (): Promise<AllDocumentsResponse> => {
            return await documentsApi.getAllDocuments(Number(id));
        },
        enabled: activeTab === 'media',
        staleTime: Infinity,
        gcTime: Infinity,
    });

    const allDocuments: FilteredDocument[] = allDocumentsData?.documents || [];

    // Filter documents based on selected filter
    const filteredDocuments = React.useMemo(() => {
        if (documentFilter === 'project') {
            return allDocuments.filter((doc: FilteredDocument) => doc.source === 'Project');
        } else if (documentFilter === 'task') {
            if (selectedTaskId) {
                return allDocuments.filter((doc: FilteredDocument) =>
                    doc.source === 'Task' && doc.task_id === selectedTaskId
                );
            }
            return allDocuments.filter((doc: FilteredDocument) => doc.source === 'Task');
        }
        return allDocuments;
    }, [allDocuments, documentFilter, selectedTaskId]);

    // Get unique task options from actual tasks data (not documents)
    const taskOptions: TaskOption[] = React.useMemo(() => {
        return tasks.map((task: Task) => ({
            task_id: task.id,
            task_heading: task.heading
        })).sort((a: TaskOption, b: TaskOption) => a.task_heading.localeCompare(b.task_heading));
    }, [tasks]);

    // Filter task options based on search
    const filteredTaskOptions = taskOptions.filter(option =>
        option.task_heading.toLowerCase().includes(taskSearchQuery.toLowerCase())
    );

    // Get selected task name
    const selectedTaskName = taskOptions.find(t => t.task_id === selectedTaskId)?.task_heading || 'Select Task';

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

            // Step 1: Get Upload URL
            const projectIdNum = Number(id);

            const uploadUrlResponse = await documentsApi.getUploadUrl(projectIdNum, {
                file_name: file.name,
                file_type: file.type || 'application/octet-stream',
            });

            const { url: s3Url, fields: s3Fields, file_key } = uploadUrlResponse;

            // Step 2: Direct S3 Upload
            await documentsApi.uploadFileToS3(s3Url, s3Fields, file);

            // Step 3: Confirm Upload
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
            else if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) mappedType = 'video';
            else if (['mp3', 'wav', 'ogg'].includes(ext)) mappedType = 'audio';
            else if (ext === 'zip' || ext === 'xml') mappedType = ext;

            const confirmResponse = await documentsApi.confirmUpload(projectIdNum, {
                file_key: file_key,
                file_name: file.name,
                file_type: mappedType,
            });

            // Step 4: Call Get Download URL
            if (confirmResponse.id) {
                await documentsApi.getDownloadUrl(projectIdNum, { document_id: confirmResponse.id });
            }

            // Reset pagination state to show new document immediately
            setMediaPage(1);
            setHasMoreMedia(true);
            setAllMediaFiles([]);
            queryClient.invalidateQueries({ queryKey: ['all-documents', id] });
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (err: any) {
            setUploadError(err.message || 'Upload failed');
        } finally {
            setIsUploading(false);
        }
    };

    // Drag and drop handlers
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
            // Create proper FileList-like object
            const syntheticEvent = {
                target: { files: files }
            } as unknown as React.ChangeEvent<HTMLInputElement>;

            await handleFileUpload(syntheticEvent);
        }
    };

    const handleTaskCreated = () => {
        setIsCreateTaskModalOpen(false);
        // This triggers the global refetch same as Taskboard
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
    };

    const handleDocumentPreview = (doc: FilteredDocument) => {
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

    // Enable keyboard shortcuts for document preview
    useDocumentPreviewKeyboard(() => setPreviewDocument(null));

    const handleTaskUpdated = (updatedTask: any) => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        setSelectedTask(updatedTask);
    };

    const handleDeleteTask = async (taskId: number) => {
        try {
            await taskApi.delete(taskId);
            // Use invalidation instead of local filter to ensure persistence
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            setSelectedTask(null);
        } catch (error) {
            console.error("Failed to delete task:", error);
        }
    };

    if (isProjectLoading) {
        return (
            <div className="content-creation-loading">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    if (!project) {
        return (
            <div className="content-creation-error">
                <h2>Project not found</h2>
                <Link to="/projects">Back to projects</Link>
            </div>
        );
    }

    return (
        <div className="content-creation">
            <div className="content-creation__main">
                <div className="content-creation__header">
                    <div className="content-creation__header-top">
                        <Link to="/projects" className="content-creation__back-button">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div className="content-creation__title-section" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <div>
                                <h1 className="content-creation__title">{project.name}</h1>
                            </div>
                            <p className="content-creation__subtitle">Content Creation Dashboard</p>
                        </div>
                    </div>

                    <div className="content-creation__tabs">
                        {(['tasks', 'calendar', 'media'] as TabType[]).map((tab) => (
                            <button
                                key={tab}
                                className={`content-creation__tab ${activeTab === tab ? 'content-creation__tab--active' : ''}`}
                                onClick={() => setActiveTab(tab)}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}

                        {/* View toggle — ml-auto pushes it + everything after it to the right */}
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
                            <Plus className="h-4 w-4" />
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
                            <Settings className="h-5 w-5" />
                            <span className="text-sm font-medium"></span>
                        </button>
                    </div>
                </div>

                <div className="content-creation__content">
                    {activeTab === 'tasks' && (
                        <div className="content-creation__tasks">
                            {isTasksLoading ? (
                                <div className="flex justify-center p-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
                                </div>
                            ) : tasks.length > 0 ? (
                                <>
                                    {viewMode === 'list' ? (
                                        <div className="bg-white rounded-lg shadow-sm">
                                            <DualView
                                                viewMode="table"
                                                gridProps={{
                                                    data: filteredTasks,
                                                    renderCard: (task: any) => <TaskGridCard task={task} onTaskClick={(t) => setSelectedTask(t as unknown as Task)} />,
                                                }}
                                                tableProps={{
                                                    data: filteredTasks,
                                                    activeFilterKey: activeFilterKey,
                                                    columns: createTasksTableColumns({
                                                        onTaskClick: (t) => setSelectedTask(t as unknown as Task),
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
                                                    rowKey: (task: any) => task.id,
                                                    onRowClick: (t) => setSelectedTask(t as unknown as Task),
                                                    onSort: handleSort,
                                                    onFilter: handleFilter,
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {tasks.map((task: Task) => (
                                                <TaskGridCard
                                                    key={task.id}
                                                    task={task as any}
                                                    onTaskClick={(t) => setSelectedTask(t as unknown as Task)}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="content-creation__tasks-empty">
                                    <div className="content-creation__empty-icon">📋</div>
                                    <h3>No tasks yet</h3>
                                    <p>Create your first content task to get started</p>
                                    <button
                                        className="content-creation__btn-primary"
                                        onClick={() => setIsCreateTaskModalOpen(true)}
                                    >
                                        <Plus className="h-4 w-4" />
                                        New Task
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'calendar' && (
                        <div className="content-creation__calendar">
                            <div className="content-creation__calendar-empty">
                                <div className="content-creation__empty-icon">📅</div>
                                <h3>Calendar View</h3>
                                <p>Schedule and manage your content creation timeline</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'media' && (
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

                                {/* Upload Button */}
                                {documentFilter === 'project' && (
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
                                )}
                            </div>

                            {isAllDocumentsLoading ? (
                                <div className="flex justify-center p-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
                                </div>
                            ) : filteredDocuments.length > 0 ? (
                                <div
                                    className="max-h-[600px] overflow-y-auto"
                                    onScroll={handleMediaScroll}
                                    ref={mediaScrollRef}
                                >
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6 px-2">
                                        {filteredDocuments.map((file: any) => (
                                            <div
                                                key={file.id}
                                                className="border rounded-lg p-2 bg-white text-center cursor-pointer hover:shadow-md transition-shadow"
                                                onClick={() => handleDocumentPreview(file)}
                                            >
                                                <div className="aspect-square bg-muted rounded flex items-center justify-center mb-2 overflow-hidden border relative">
                                                    <MediaThumbnail file={file} projectId={Number(id)} />
                                                </div>
                                                <p className="text-xs font-medium truncate">{file.file_name || file.original_file_name || file.name}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {isMediaFetching && mediaPage > 1 && (
                                        <div className="flex justify-center py-4">
                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                                        </div>
                                    )}

                                </div>
                            ) : (
                                <div className="content-creation__media-empty">
                                    <Film className="content-creation__empty-media-icon" />
                                    <p className="content-creation__empty-text">No media files yet</p>
                                </div>
                            )}
                            {/* Full-page drag overlay */}
                            {isDragging && (
                                <div className="fixed inset-0 bg-primary/10 border-4 border-dashed border-primary pointer-events-none z-50 flex items-center justify-center">
                                    <div className="bg-white p-8 rounded-lg shadow-lg">
                                        <Upload className="h-16 w-16 text-primary mx-auto mb-4" />
                                        <p className="text-xl font-semibold text-primary">Drop file anywhere to upload</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {isCreateTaskModalOpen && (
                <CreateTask
                    onClose={() => setIsCreateTaskModalOpen(false)}
                    onSuccess={handleTaskCreated}
                    isModal={true}
                    fixedProjectId={Number(id)}
                />
            )}

            {selectedTask && (
                <TaskDetailModal
                    task={selectedTask as any}
                    onClose={() => setSelectedTask(null)}
                    onDelete={handleDeleteTask}
                    onTaskUpdated={handleTaskUpdated}
                />
            )}
            {previewDocument && (
                <DocumentPreview
                    url={previewDocument.url}
                    fileName={previewDocument.fileName}
                    fileType={previewDocument.fileType}
                    onClose={() => setPreviewDocument(null)}
                />
            )}
            {/* Threads Component */}
            {project && (
                <Threads projectId={project.id} projectName={project.name} />
            )}
        </div>
    );
}