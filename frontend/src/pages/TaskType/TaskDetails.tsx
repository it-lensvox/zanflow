import React, { useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Loader2, Upload, FileText, List, Grid3X3, Settings, MessageCircle } from 'lucide-react';
import { projectsApi, taskApi, documentsApi } from '@/services/api';
import { DualView } from '@/components/layout/DualView/DualView';
import { TaskGridCard, createTasksTableColumns } from '@/components/layout/DualView/taskConfig';
import { TaskDetailModal } from '../MyTask/TaskDetailModal';
import { useTableFilters, ColumnFilterConfig } from '@/hooks/useTableFilters';
import { SearchFilter, ListFilter, DateFilter, FilterHeaderWrapper } from '@/components/layout/DualView/FilterComponents';
import { getStatusConfig, priorityOptions, statusOptions } from '@/components/layout/DualView/taskConfig';
import { CreateTask } from '@/pages/MyTask/CreateTask';
import { MediaPreviewModal, MediaThumbnail } from './ContentCreation';
import { pdfjs, Document as PDFDocument, Page as PDFPage } from 'react-pdf';
import './TaskDetails.scss';
import { APITesting } from './APITesting';
import type { Task } from '@/types';

// pdfjs.GlobalWorkerOptions.workerSrc = new URL(
//   'pdfjs-dist/build/pdf.worker.min.mjs',
//   import.meta.url
// ).toString();

type TabType = 'tasks' | 'add_documents' | 'api_testing';


export function TaskDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();


    const [activeTab, setActiveTab] = useState<TabType>('tasks');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<any | null>(null);

    // Upload & Media States
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [selectedMedia, setSelectedMedia] = useState<any | null>(null);


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
    const { data: documentsData, isLoading: isMediaLoading } = useQuery({
        queryKey: ['documents', { project: id }],
        queryFn: () => documentsApi.list({ project: (Number(id)) }),
        enabled: !!id,
        staleTime: 1000 * 60 * 5,
    });

    const allResults = documentsData?.results || documentsData || [];
    const mediaFiles = allResults.filter((file: any) => {
        const hasGtMetadata = !!file.metadata?.gt_category;
        return !hasGtMetadata;
    });

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

            queryClient.invalidateQueries({ queryKey: ['documents', { project: id }] });
            await queryClient.refetchQueries({
                queryKey: ['documents'],
                type: 'active'
            });
        } catch (err: any) {
            setUploadError(err.message || 'Upload failed');
        } finally {
            setIsUploading(false);
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
                            {project?.task_type.replace('_', ' ').toUpperCase()} Dashboard
                        </p>
                    </div>

                </div>
                <div className="content-creation__tabs">
                    {(['tasks', 'add_documents', 'api_testing'] as TabType[]).map((tab) => (
                        <button
                            key={tab}
                            className={`content-creation__tab ${activeTab === tab ? 'content-creation__tab--active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab === 'add_documents' ? 'Documents' : tab.toUpperCase()}
                        </button>
                    ))}

                    <button
                        className="content-creation__tab content-creation__tab--create-task"
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
                             {/* View Toggle Controls */}
                            <div className="flex justify-end mb-2">
                                <div className="flex items-center border border-gray-200 rounded-md bg-white p-1 gap-1">
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
                            </div>

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
                        <div className="content-creation__media">
                            <div className="content-creation__upload-area">
                                <label className={`content-creation__upload-box ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                                    <input
                                        type="file"
                                        className="hidden"
                                        onChange={handleFileUpload}
                                        disabled={isUploading}
                                        accept="*"
                                    />
                                    {isUploading ? (
                                        <Loader2 className="content-creation__upload-icon animate-spin" />
                                    ) : (
                                        <Upload className="content-creation__upload-icon" />
                                    )}
                                    <p className="content-creation__upload-text">
                                        {isUploading ? 'Uploading...' : 'Drop documents here or click to browse'}
                                    </p>
                                    <p className="content-creation__upload-subtext">All document types supported (Max 500MB)</p>
                                    {uploadError && <p className="text-destructive text-sm mt-2">{uploadError}</p>}
                                </label>
                            </div>

                            {isMediaLoading ? (
                                <div className="flex justify-center p-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
                                </div>
                            ) : mediaFiles.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6">
                                    {mediaFiles.map((file: any) => (
                                        <div
                                            key={file.id}
                                            className="border rounded-lg p-2 bg-white text-center cursor-pointer hover:shadow-md transition-shadow"
                                            onClick={() => setSelectedMedia(file)}
                                        >
                                            <div className="aspect-square bg-muted rounded flex items-center justify-center mb-2 overflow-hidden border relative">
                                                <MediaThumbnail file={file} projectId={Number(id)} />
                                            </div>
                                            <p className="text-xs font-medium truncate">{file.original_file_name || file.name}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="content-creation__media-empty">
                                    <FileText className="content-creation__empty-media-icon" />
                                    <p className="content-creation__empty-text">No documents uploaded yet</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* API Testing Tab Content */}
                    {activeTab === 'api_testing' && (
                        <APITesting />
                    )}
                </div>
            </div>

            {
                selectedMedia && (
                    <MediaPreviewModal
                        doc={selectedMedia}
                        projectId={Number(id)}
                        onClose={() => setSelectedMedia(null)}
                    />
                )
            }

            {
                isCreateTaskModalOpen && (
                    <div className="content-creation__modal-overlay">
                        <div className="content-creation__modal-container bg-gray-50 p-6">
                            <CreateTask
                                onClose={() => setIsCreateTaskModalOpen(false)}
                                onSuccess={() => {
                                    setIsCreateTaskModalOpen(false);
                                    queryClient.invalidateQueries({ queryKey: ['tasks'] });
                                }}
                                isModal={true}
                                fixedProjectId={id ? Number(id) : undefined}
                            />
                        </div>
                    </div>
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
        </div >
    );
}