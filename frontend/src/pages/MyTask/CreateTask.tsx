import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, Calendar, CheckCircle, AlertCircle, ArrowLeft, Briefcase, User, Flag, Paperclip, Type, Sparkles, Plus, Link, Trash2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { taskApi, usersApi, projectsApi } from '@/services/api';
import { ProjectMinimal, AITaskSuggestionResponse, Label } from '@/types';
import { AITask } from './AITask';
import { RichTextEditor } from '@/components/common/RichTextEditor';

interface UserOption {
    value: string;
    label: string;
    id: number;
}

interface CreateTaskProps {
    onClose?: () => void;
    onSuccess?: () => void;
    isModal?: boolean;
    fixedProjectId?: number;
}

export const CreateTask: React.FC<CreateTaskProps> = ({
    onClose,
    onSuccess,
    isModal = false,
    fixedProjectId
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const [heading, setHeading] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [assignedToList, setAssignedToList] = useState<number[]>([]);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
    const [priorityDropdownOpen, setPriorityDropdownOpen] = useState(false);
    const [selectedProjects, setSelectedProjects] = useState<number[]>(
        fixedProjectId
            ? [fixedProjectId]
            : location.state?.projectId
                ? [Number(location.state.projectId)]
                : []
    );
    const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
    const [status, setStatus] = useState('pending');
    const [priority, setPriority] = useState('medium');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [attachments, setAttachments] = useState<File[]>([]);
    const [labels, setLabels] = useState('');
    const [linkInput, setLinkInput] = useState('');
    const [links, setLinks] = useState<string[]>([]);
    const [showAIModal, setShowAIModal] = useState(false);
    const [showSuccessView, setShowSuccessView] = useState(false);
    const [duration, setDuration] = useState('');
    const [projectLabels, setProjectLabels] = useState<Label[]>([]);
    const [selectedLabelIds, setSelectedLabelIds] = useState<number[]>([]);
    const [labelDropdownOpen, setLabelDropdownOpen] = useState(false);
    const [assigneeSearchInput, setAssigneeSearchInput] = useState('');
    const [projectSearchInput, setProjectSearchInput] = useState('');
    const [highlightedUserIndex, setHighlightedUserIndex] = useState(0);
    const [isTitleRefining, setIsTitleRefining] = useState(false);
    const [isDescRefining, setIsDescRefining] = useState(false);
    const projectSearchInputRef = useRef<HTMLInputElement>(null);
    const [projectMembers, setProjectMembers] = useState<{ user: { id: number; username: string; full_name: string } }[]>([]);

    const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value;
        const isDeleting = (e.nativeEvent as any).inputType === 'deleteContentBackward';
        if (isDeleting) {
            setDuration(val);
            return;
        }
        val = val.replace(/[^0-9:]/g, '');

        // Auto-format logic for additions:
        // 1. If user types 2 digits (e.g., "24"), append a colon: "24:"
        if (/^\d{2}$/.test(val)) {
            val = val + ':';
        }
        // 2. If user types a digit after the colon (e.g., "24:1"), append a zero: "24:10"
        else if (/^\d{2}:\d$/.test(val)) {
            val = val + '0';
        }

        setDuration(val);
    };

    useEffect(() => {
        if (!fixedProjectId && location.state?.projectId) {
            setSelectedProjects([Number(location.state.projectId)]);
        }
    }, [location.state?.projectId, fixedProjectId]);

    useEffect(() => {
        const fetchLabelsAndMembers = async () => {
            if (selectedProjects.length > 0) {
                try {
                    // Fetch labels
                    const labelsData = await projectsApi.getLabels(selectedProjects[0]);
                    setProjectLabels(labelsData.results || []);

                    // Fetch project details including members
                    const projectDetails = await projectsApi.get(selectedProjects[0]);
                    setProjectMembers(projectDetails.members || []);
                } catch (error) {
                    console.error("Failed to fetch project data:", error);
                }
            } else {
                setProjectLabels([]);
                setSelectedLabelIds([]);
                setProjectMembers([]);
            }
        };
        fetchLabelsAndMembers();
    }, [selectedProjects]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const MAX_FILE_SIZE = 500 * 1024 * 1024;
            const newFiles = Array.from(e.target.files).filter(file => {
                if (file.size > MAX_FILE_SIZE) {
                    setError(`File ${file.name} exceeds the 500 MB limit.`);
                    return false;
                }
                return true;
            });
            setAttachments(prev => [...prev, ...newFiles]);
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleAddLink = () => {
        if (linkInput.trim()) {
            setLinks([...links, linkInput.trim()]);
            setLinkInput('');
        }
    };

    const removeLink = (index: number) => {
        setLinks(links.filter((_, i) => i !== index));
    };

    const priorityOptions = [
        { value: 'critical', label: 'Critical', color: 'text-red-600', icon: '🔴' },
        { value: 'high', label: 'High', color: 'text-red-600', icon: '🔵' },
        { value: 'medium', label: 'Medium', color: 'text-orange-600', icon: '🟡' },
        { value: 'low', label: 'Low', color: 'text-green-600', icon: '🟢' },
    ];

    const statusOptions = [
        { value: 'review', label: 'Review', color: 'bg-yellow-100 text-yellow-800' },
        { value: 'backlog', label: 'Backlog', color: 'bg-gray-100 text-gray-800' },
        { value: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-800' },
        { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800' },
        { value: 'deployed', label: 'Deployed', color: 'bg-purple-100 text-purple-800' },
        { value: 'deferred', label: 'Deferred', color: 'bg-gray-100 text-gray-600' },
    ];

    const { data: usersData, isLoading: usersLoading, error: usersError } = useQuery({
        queryKey: ['users'],
        queryFn: usersApi.list,
        staleTime: Infinity,
    });

    const { data: projectsData, isLoading: projectsLoading, error: projectsError } = useQuery({
        queryKey: ['projects'],
        queryFn: () => projectsApi.list(),
        staleTime: Infinity,
    });

    // Memoize derived data to maintain existing variable names
    const allUserOptions = React.useMemo<UserOption[]>(() => {
        if (!usersData) return [];
        const data = (usersData as any).results || usersData;
        return Array.isArray(data) ? data.map((user: any) => ({
            value: String(user.id),
            label: user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.username,
            id: user.id,
        })) : [];
    }, [usersData]);

    const allProjectOptions = React.useMemo<ProjectMinimal[]>(() => {
        if (!projectsData) return [];
        return (projectsData as any).results || projectsData || [];
    }, [projectsData]);

    // Filter users based on search input and project membership
    const filteredUserOptions = React.useMemo(() => {
        let availableUsers = allUserOptions;

        if (selectedProjects.length > 0 && projectMembers.length > 0) {
            const projectMemberIds = projectMembers.map(member => member.user.id);
            availableUsers = allUserOptions.filter((user) => projectMemberIds.includes(user.id));
        }
        availableUsers = availableUsers.filter((user) => !assignedToList.includes(user.id));
        if (!assigneeSearchInput.trim()) {
            return availableUsers;
        }

        return availableUsers.filter((user) =>
            user.label.toLowerCase().startsWith(assigneeSearchInput.toLowerCase())
        );
    }, [allUserOptions, assignedToList, assigneeSearchInput, selectedProjects, projectMembers]);

    // Filter projects based on search input with priority sorting
    const filteredProjectOptions = React.useMemo(() => {
        if (!projectSearchInput.trim()) {
            return allProjectOptions;
        }

        const searchLower = projectSearchInput.toLowerCase();
        const startsWithSearch = allProjectOptions.filter((project) =>
            project.name.toLowerCase().startsWith(searchLower)
        );
        const containsSearch = allProjectOptions.filter(
            (project) =>
                !project.name.toLowerCase().startsWith(searchLower) &&
                project.name.toLowerCase().includes(searchLower)
        );

        return [...startsWithSearch, ...containsSearch];
    }, [allProjectOptions, projectSearchInput]);



    // Handle initial load errors
    useEffect(() => {
        if (usersError || projectsError) {
            console.error("Failed to load dynamic data:", usersError || projectsError);
            setError("Failed to load required lists. Please refresh.");
        }
    }, [usersError, projectsError]);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const isOutsideStatus = !target.closest('[data-dropdown="status"]');
            const isOutsidePriority = !target.closest('[data-dropdown="priority"]');
            const isOutsideAssignee = !target.closest('[data-dropdown="assignee"]');
            const isOutsideProject = !target.closest('[data-dropdown="project"]');
            const isOutsideLabel = !target.closest('[data-dropdown="label"]');

            if (isOutsideStatus) setStatusDropdownOpen(false);
            if (isOutsidePriority) setPriorityDropdownOpen(false);
            if (isOutsideAssignee) setDropdownOpen(false);
            if (isOutsideProject) setProjectDropdownOpen(false);
            if (isOutsideLabel) setLabelDropdownOpen(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const aiGeneratedTask = location.state?.aiGeneratedTask as AITaskSuggestionResponse;
        if (aiGeneratedTask) {

            // Set all form fields
            setHeading(aiGeneratedTask.heading || '');
            setStartDate(aiGeneratedTask.start_date || '');
            setEndDate(aiGeneratedTask.end_date || '');
            setStatus(aiGeneratedTask.status || 'pending');
            setPriority(aiGeneratedTask.priority || 'medium');
            setAssignedToList(aiGeneratedTask.assigned_to || []);

            if (aiGeneratedTask.project) {
                setSelectedProjects([aiGeneratedTask.project]);
            }

            // Handle description - now works directly with HTML state
            if (aiGeneratedTask.description) {
                setDescription(aiGeneratedTask.description);
            }

            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, navigate, location.pathname]);

    // For Task Title and Description AI refined 
    const handleRefineTitle = async () => {
        if (!heading.trim()) return;

        setIsTitleRefining(true);
        try {
            const response = await taskApi.refineText({
                text: heading,
                type: 'optimize_title'
            });
            if (response.refined_text) {
                setHeading(response.refined_text);
            }
        } catch (error) {
            console.error("Failed to optimize title", error);
        } finally {
            setIsTitleRefining(false);
        }
    };

    const handleRefineDescription = async () => {
        // Extract text content from HTML description
        const stripHtml = (html: string) => {
            const temp = document.createElement('div');
            temp.innerHTML = html;
            return temp.textContent || temp.innerText || '';
        };

        const currentText = stripHtml(description);
        const isEmpty = !currentText.trim();

        // If empty, we need a title to generate from
        if (isEmpty && !heading.trim()) {
            setError("Please enter a Task Title first to generate a description.");
            return;
        }

        setIsDescRefining(true);
        try {
            const payload: any = {
                text: isEmpty ? heading : currentText,
                type: isEmpty ? 'generate_description' : 'refine_description'
            };

            const response = await taskApi.refineText(payload);

            if (response.refined_text) {
                // Set the description with the refined HTML
                setDescription(response.refined_text);
            }
        } catch (error) {
            console.error("Failed to refine description", error);
        } finally {
            setIsDescRefining(false);
        }
    };

    const handleClose = () => {
        if (isModal && onClose) {
            onClose();
        } else {
            navigate('/taskboard');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        if (!heading || selectedProjects.length === 0) {
            setError('Please fill in all required fields.');
            setLoading(false);
            return;
        }
        const projectId = selectedProjects[0];

        try {
            const formData = new FormData();
            formData.append('heading', heading);
            formData.append('description', description);
            if (startDate) formData.append('start_date', `${startDate}T09:00:00Z`);
            if (endDate) formData.append('end_date', `${endDate}T18:00:00Z`);
            formData.append('duration_time', duration);
            formData.append('status', status);
            formData.append('priority', priority);
            formData.append('project', String(projectId));
            selectedLabelIds.forEach(id => {
                formData.append('labels', String(id));
            });
            links.forEach(link => {
                formData.append('links', link);
            });
            assignedToList.forEach(id => {
                formData.append('assigned_to', String(id));
            });
            attachments.forEach((file) => {
                formData.append('uploaded_files', file);
            });

            await taskApi.create(formData);
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            setShowSuccessView(true);

            setTimeout(() => {
                if (isModal && onSuccess) {
                    onSuccess();
                } else {
                    navigate('/taskboard');
                }
            }, 1500);

        } catch (err: any) {
            console.error('❌ [CreateTask] Upload failed:', err);
            console.error('❌ [CreateTask] Error details:', err.response?.data);
            console.error('Error creating task:', err);
            setError(err.response?.data?.message || 'Failed to create task. Please check your inputs.');
            setLoading(false);
        }
    };

    if (showSuccessView) {
        return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center">
                <div className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg text-base font-medium w-fit">
                    Task created successfully
                </div>
            </div>
        );
    }

    return (
        <div className={isModal
            ? "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            : "h-full flex flex-col"
        }>
            {/* Inner card: constrained + scrollable in both modes */}
            <div className={isModal
                ? "bg-white rounded-lg shadow-xl w-full max-w-4xl flex flex-col max-h-[calc(100vh-64px)]"
                : "w-full max-w-4xl mx-auto flex flex-col max-h-[calc(100vh-64px)]"
            }>

                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between px-8 pt-6 pb-4 border-b border-gray-200 bg-background rounded-t-lg">
                    <div className="max-w-4xl w-full mx-auto flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold text-gray-900">Create task</h1>
                            <p className="text-sm text-gray-500 mt-1">Fill in the details below to create a new task</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="submit"
                                form="create-task-form"
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={loading}
                            >
                                {loading ? 'Creating...' : 'Create task'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowAIModal(true)}
                                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded hover:bg-purple-700 transition-colors flex items-center gap-2"
                            >
                                <Sparkles className="w-4 h-4" />
                                Generate Task By AI
                            </button>
                            <button
                                type="button"
                                onClick={handleClose}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                                disabled={loading}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>

                { /* scroolable body */}
                <div className="flex-1 overflow-y-auto scrollbar-hide px-8 py-6">
                    <div className="max-w-4xl mx-auto"></div>
                    <form id="create-task-form" onSubmit={handleSubmit}>
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                            {/* Alerts */}
                            {error && (
                                <div className="p-4 bg-red-50 border-b border-red-100 flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-red-800">Error</p>
                                        <p className="text-sm text-red-700 mt-1">{error}</p>
                                    </div>
                                </div>
                            )}
                            {success && (
                                <div className="p-4 bg-green-50 border-b border-green-100 flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-green-800">{success}</p>
                                    </div>
                                </div>
                            )}

                        <div className="p-5 space-y-4">
                            {/* Project Selection */}
                            <div className="relative" data-dropdown="project">
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                    <Briefcase className="w-4 h-4" />
                                    Project <span className="text-red-500">*</span>
                                </label>
                                <div
                                    className={`w-full p-2.5 rounded border border-gray-300 bg-white flex flex-wrap gap-2 min-h-[42px] ${fixedProjectId ? 'cursor-not-allowed bg-gray-50' : 'cursor-pointer hover:border-gray-400'
                                        } transition-colors`}
                                    onClick={() => {
                                        if (!fixedProjectId) {
                                            setProjectDropdownOpen(true);
                                            setTimeout(() => projectSearchInputRef.current?.focus(), 0);
                                        }
                                    }}
                                >
                                    {projectsLoading ? (
                                        <span className="text-gray-400 text-sm flex items-center gap-2">
                                            <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                            Loading projects...
                                        </span>
                                    ) : selectedProjects.length === 0 ? (
                                        !projectDropdownOpen ? (
                                            <span className="text-gray-400 text-sm">Search project</span>
                                        ) : (
                                            <input
                                                ref={projectSearchInputRef}
                                                type="text"
                                                value={projectSearchInput}
                                                onChange={(e) => setProjectSearchInput(e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                placeholder="Search project"
                                                className="flex-1 min-w-[120px] outline-none text-sm text-gray-400"
                                            />
                                        )
                                    ) : (
                                        <>
                                            {selectedProjects.map((projectId) => {
                                                const project = allProjectOptions.find(p => p.id === projectId);
                                                if (!project) return null;
                                                return (
                                                    <span key={projectId} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm font-medium flex items-center gap-1">
                                                        {project.name}
                                                        {!fixedProjectId && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedProjects([]);
                                                                    setProjectSearchInput('');
                                                                }}
                                                                className="hover:text-red-600"
                                                            >
                                                                ×
                                                            </button>
                                                        )}
                                                    </span>
                                                );
                                            })}
                                            {!fixedProjectId && projectDropdownOpen && (
                                                <input
                                                    ref={projectSearchInputRef}
                                                    type="text"
                                                    value={projectSearchInput}
                                                    onChange={(e) => setProjectSearchInput(e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    placeholder="Search project"
                                                    className="flex-1 min-w-[120px] outline-none text-sm text-gray-400"
                                                />
                                            )}
                                        </>
                                    )}
                                </div>
                                {projectDropdownOpen && !fixedProjectId && (
                                    <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                                        {filteredProjectOptions.length > 0 ? (
                                            filteredProjectOptions.map((project) => (
                                                <div
                                                    key={project.id}
                                                    className="px-4 py-2.5 hover:bg-gray-50 cursor-pointer text-sm"
                                                    onClick={() => {
                                                        setSelectedProjects([project.id]);
                                                        setProjectDropdownOpen(false);
                                                        setProjectSearchInput('');
                                                    }}
                                                >
                                                    {project.name}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="px-4 py-2.5 text-sm text-gray-500 text-center">
                                                No projects found
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Task Title */}
                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                    <Type className="w-4 h-4" />
                                    Task title <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={heading}
                                        onChange={(e) => setHeading(e.target.value)}
                                        className="w-full p-2.5 pr-10 rounded border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                        placeholder="Enter a concise task title"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={handleRefineTitle}
                                        disabled={isTitleRefining || !heading.trim()}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-purple-600 hover:bg-purple-50 rounded-full transition-colors disabled:opacity-50"
                                        title="Optimize with AI"
                                    >
                                        {isTitleRefining ? (
                                            <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <Sparkles className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/*  Description Section */}
                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                    Description
                                    <button
                                        type="button"
                                        onClick={handleRefineDescription}
                                        disabled={isDescRefining}
                                        className="ml-auto p-1.5 hover:bg-purple-50 text-purple-600 rounded transition-colors flex items-center gap-1"
                                        title="Refine/Generate Description with AI"
                                    >
                                        {isDescRefining ? (
                                            <div className="w-3.5 h-3.5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <Sparkles className="w-4 h-4" />
                                        )}
                                    </button>
                                </label>
                                <RichTextEditor
                                    value={description}
                                    onChange={setDescription}
                                    placeholder="Type @ to mention a teammate and notify them about this work item."
                                    minHeight="200px"
                                    maxHeight="400px"
                                    features={{
                                        bold: true,
                                        italic: true,
                                        underline: true,
                                        strikethrough: true,
                                        code: true,
                                        codeBlock: true,
                                        link: true,
                                        bulletList: true,
                                        orderedList: true,
                                        blockquote: true,
                                        horizontalRule: true,
                                        table: true,
                                        image: true,
                                        heading: true,
                                        textAlign: true,
                                    }}
                                />
                            </div>

                            {/* Link Field */}
                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                    <Link className="w-4 h-4" />
                                    Links
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={linkInput}
                                        onChange={(e) => setLinkInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddLink())}
                                        placeholder="Paste URL here..."
                                        className="flex-1 p-2.5 rounded border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddLink}
                                        className="p-2.5 bg-blue-50 text-blue-600 rounded border border-blue-200 hover:bg-blue-100 transition-colors"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </div>
                                {links.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        {links.map((link, index) => (
                                            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200 group">
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <Link className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                                    <a
                                                        href={link.startsWith('http') ? link : `https://${link}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-sm text-blue-600 hover:underline truncate"
                                                    >
                                                        {link}
                                                    </a>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeLink(index)}
                                                    className="p-1 text-gray-400 hover:text-red-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-gray-200 pt-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Status */}
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                                            Status
                                        </label>
                                        <div className="relative" data-dropdown="status">
                                            <div
                                                className="w-full p-2.5 rounded border border-gray-300 hover:border-gray-400 cursor-pointer bg-white flex items-center justify-between min-h-[42px] transition-colors"
                                                onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                                            >
                                                <span className="text-sm text-gray-700">
                                                    {statusOptions.find(opt => opt.value === status)?.label || 'Select status'}
                                                </span>
                                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                            {statusDropdownOpen && (
                                                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                                                    {statusOptions.map((option) => (
                                                        <div
                                                            key={option.value}
                                                            className="px-4 py-2.5 hover:bg-gray-50 cursor-pointer text-sm flex items-center justify-between"
                                                            onClick={() => {
                                                                setStatus(option.value);
                                                                setStatusDropdownOpen(false);
                                                            }}
                                                        >
                                                            <span>{option.label}</span>
                                                            {status === option.value && (
                                                                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Priority */}
                                    <div>
                                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                            <Flag className="w-4 h-4" />
                                            Priority
                                        </label>
                                        <div className="relative" data-dropdown="priority">
                                            <div
                                                className="w-full p-2.5 rounded border border-gray-300 hover:border-gray-400 cursor-pointer bg-white flex items-center justify-between min-h-[42px] transition-colors"
                                                onClick={() => setPriorityDropdownOpen(!priorityDropdownOpen)}
                                            >
                                                <span className="text-sm text-gray-700">
                                                    {priorityOptions.find(opt => opt.value === priority)?.icon}{' '}
                                                    {priorityOptions.find(opt => opt.value === priority)?.label || 'Select priority'}
                                                </span>
                                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                            {priorityDropdownOpen && (
                                                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                                                    {priorityOptions.map((option) => (
                                                        <div
                                                            key={option.value}
                                                            className="px-4 py-2.5 hover:bg-gray-50 cursor-pointer text-sm flex items-center justify-between"
                                                            onClick={() => {
                                                                setPriority(option.value);
                                                                setPriorityDropdownOpen(false);
                                                            }}
                                                        >
                                                            <span>
                                                                {option.icon} {option.label}
                                                            </span>
                                                            {priority === option.value && (
                                                                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Combined Date & Duration Section */}
                                    <div className="col-span-1 md:col-span-2">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50/50 rounded-xl border border-gray-100 shadow-sm">
                                            {/* Start Date */}
                                            <div className="">
                                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                                    <Calendar className="w-4 h-4" />
                                                    Start date
                                                </label>
                                                <input
                                                    type="date"
                                                    value={startDate}
                                                    onChange={(e) => setStartDate(e.target.value)}
                                                    className="w-full p-2.5 rounded border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                                />
                                            </div>

                                            {/* End Date */}
                                            <div>
                                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                                    <Calendar className="w-4 h-4" />
                                                    Due Date
                                                </label>
                                                <input
                                                    type="date"
                                                    value={endDate}
                                                    onChange={(e) => setEndDate(e.target.value)}
                                                    className="w-full p-2.5 rounded border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                                />
                                            </div>

                                            {/* Duration Time */}
                                            <div className="space-y-2">
                                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                                    <span className="flex items-center justify-center w-4 h-4 bg-blue-100 text-blue-600 rounded-full text-[10px]">⏱</span>
                                                    Duration
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={duration}
                                                        onChange={handleDurationChange}
                                                        placeholder="HH:MM:SS"
                                                        className="w-full p-2.5 rounded border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Assignees and Labels Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Assignees */}
                                <div>
                                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                        <User className="w-4 h-4" />
                                        Assignees <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative" data-dropdown="assignee">
                                        {/* Main input field - shows selected users + allows typing */}
                                        <div className="w-full p-2.5 rounded border border-gray-300 hover:border-gray-400 bg-white flex flex-wrap gap-2 min-h-[42px] transition-colors">
                                            {usersLoading ? (
                                                <span className="text-gray-400 text-sm flex items-center gap-2">
                                                    <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                                    Loading users...
                                                </span>
                                            ) : (
                                                <>
                                                    {/* Selected users as chips */}
                                                    {assignedToList.map((userId) => {
                                                        const user = allUserOptions.find(u => u.id === userId);
                                                        if (!user) return null;
                                                        return (
                                                            <span key={userId} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm font-medium flex items-center gap-1">
                                                                {user.label}
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setAssignedToList(assignedToList.filter(id => id !== userId));
                                                                    }}
                                                                    className="hover:text-red-600"
                                                                >
                                                                    ×
                                                                </button>
                                                            </span>
                                                        );
                                                    })}

                                                    {/* Search input */}
                                                    <input
                                                        type="text"
                                                        value={assigneeSearchInput}
                                                        onChange={(e) => {
                                                            setAssigneeSearchInput(e.target.value);
                                                            setHighlightedUserIndex(0);
                                                            setDropdownOpen(true);
                                                        }}
                                                        onFocus={() => {
                                                            setDropdownOpen(true);
                                                            setHighlightedUserIndex(0);
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'ArrowDown') {
                                                                e.preventDefault();
                                                                setHighlightedUserIndex((prev) =>
                                                                    Math.min(prev + 1, filteredUserOptions.length - 1)
                                                                );
                                                            } else if (e.key === 'ArrowUp') {
                                                                e.preventDefault();
                                                                setHighlightedUserIndex((prev) => Math.max(prev - 1, 0));
                                                            } else if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                if (filteredUserOptions[highlightedUserIndex]) {
                                                                    setAssignedToList([...assignedToList, filteredUserOptions[highlightedUserIndex].id]);
                                                                    setAssigneeSearchInput('');
                                                                    setHighlightedUserIndex(0);
                                                                }
                                                            } else if (e.key === 'Escape') {
                                                                setDropdownOpen(false);
                                                                setAssigneeSearchInput('');
                                                                setHighlightedUserIndex(0);
                                                            } else if (e.key === 'Backspace' && assigneeSearchInput === '' && assignedToList.length > 0) {
                                                                // Remove last selected user when backspace is pressed on empty input
                                                                setAssignedToList(assignedToList.slice(0, -1));
                                                            }
                                                        }}
                                                        placeholder={assignedToList.length === 0 ? "Assign to team members" : ""}
                                                        className="flex-1 min-w-[120px] outline-none text-sm"
                                                    />
                                                </>
                                            )}
                                        </div>

                                        {/* Dropdown with filtered users */}
                                        {dropdownOpen && !usersLoading && filteredUserOptions.length > 0 && (
                                            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                                                {filteredUserOptions.map((user, index) => (
                                                    <div
                                                        key={user.id}
                                                        className={`px-4 py-2.5 cursor-pointer text-sm ${index === highlightedUserIndex
                                                            ? 'bg-blue-50 text-blue-700'
                                                            : 'hover:bg-gray-50'
                                                            }`}
                                                        onClick={() => {
                                                            setAssignedToList([...assignedToList, user.id]);
                                                            setAssigneeSearchInput('');
                                                            setHighlightedUserIndex(0);
                                                            setDropdownOpen(false);
                                                        }}
                                                        onMouseEnter={() => setHighlightedUserIndex(index)}
                                                    >
                                                        {user.label}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right: Labels */}
                                <div>
                                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                        <Flag className="w-4 h-4 text-gray-400" />
                                        Labels
                                    </label>
                                    <div className="relative" data-dropdown="label">
                                        <div
                                            className={`w-full p-2.5 rounded border border-gray-300 bg-white flex flex-wrap gap-2 min-h-[42px] transition-colors ${selectedProjects.length === 0 ? 'cursor-not-allowed bg-gray-50' : 'cursor-pointer hover:border-gray-400'}`}
                                            onClick={() => selectedProjects.length > 0 && setLabelDropdownOpen(!labelDropdownOpen)}
                                        >
                                            {selectedLabelIds.length === 0 ? (
                                                <span className="text-gray-400 text-sm">
                                                    {selectedProjects.length === 0 ? 'Select labels' : 'Select labels'}
                                                </span>
                                            ) : (
                                                selectedLabelIds.map((labelId) => {
                                                    const label = projectLabels.find(l => l.id === labelId);
                                                    if (!label) return null;
                                                    return (
                                                        <span
                                                            key={labelId}
                                                            className="px-2 py-1 rounded text-xs font-medium text-white flex items-center gap-1"
                                                            style={{ backgroundColor: label.color }}
                                                        >
                                                            {label.name}
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedLabelIds(prev => prev.filter(id => id !== labelId));
                                                                }}
                                                                className="hover:text-black/50 ml-1"
                                                            >
                                                                ×
                                                            </button>
                                                        </span>
                                                    );
                                                })
                                            )}
                                        </div>
                                        {labelDropdownOpen && projectLabels.length > 0 && (
                                            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                                                {projectLabels.filter(label => !selectedLabelIds.includes(label.id)).map((label) => (
                                                    <div
                                                        key={label.id}
                                                        className="px-4 py-2.5 hover:bg-gray-50 cursor-pointer text-sm flex items-center justify-between gap-2"
                                                        onClick={() => {
                                                            setSelectedLabelIds([...selectedLabelIds, label.id]);
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                className="w-3 h-3 rounded-full"
                                                                style={{ backgroundColor: label.color }}
                                                            />
                                                            {label.name}
                                                        </div>
                                                        {/* Show checkmark for labels being added (not yet saved) */}
                                                        {selectedLabelIds.includes(label.id) && (
                                                            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                ))}
                                                {projectLabels.filter(label => !selectedLabelIds.includes(label.id)).length === 0 && (
                                                    <div className="px-4 py-2.5 text-sm text-gray-500 italic">
                                                        No more labels available
                                                        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-2 mt-1">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setLabelDropdownOpen(false);
                                                                }}
                                                                className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                                                            >
                                                                Done {selectedLabelIds.length > 0 && `(${selectedLabelIds.length} selected)`}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {labelDropdownOpen && projectLabels.length === 0 && (
                                            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm text-gray-500 text-center">
                                                No labels found for this project.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Attachments */}
                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                    <Paperclip className="w-4 h-4" />
                                    Attachments
                                </label>
                                <div
                                    className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-gray-400 transition-colors cursor-pointer relative bg-gray-50"
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        if (e.dataTransfer.files) {
                                            const droppedFiles = Array.from(e.dataTransfer.files);
                                            setAttachments(prev => [...prev, ...droppedFiles]);
                                        }
                                    }}
                                >
                                    <input
                                        type="file"
                                        multiple
                                        onChange={handleFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        accept="*"
                                    />
                                    <div className="text-center">
                                        <Paperclip className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                        <p className="text-sm text-gray-600">
                                            <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">Videos, images, archives, code, PDFs (Max 500MB)</p>
                                    </div>
                                </div>

                                    {attachments.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            {attachments.map((file, index) => (
                                                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                        <Paperclip className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                                        <span className="text-sm text-gray-700 truncate">{file.name}</span>
                                                        <span className="text-xs text-gray-500 flex-shrink-0">
                                                            {(file.size / 1024 / 1024).toFixed(2)} MB
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
            {showAIModal && (
                <AITask
                    onClose={() => setShowAIModal(false)}
                    fixedProjectId={fixedProjectId || (selectedProjects.length > 0 ? selectedProjects[0] : undefined)}
                />
            )}
        </div>
    );
};