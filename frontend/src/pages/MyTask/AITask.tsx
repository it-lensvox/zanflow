import React, { useState, useEffect, useRef } from 'react';
import { X, Briefcase, Sparkles, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { projectsApi, taskApi } from '@/services/api';
import { ProjectMinimal, AITaskSuggestionPayload } from '@/types';
import { RichTextEditor } from '@/components/common/RichTextEditor';

interface AITaskProps {
    onClose: () => void;
    onGenerate?: (projectId: number, description: string) => void;
    fixedProjectId?: number;
}

export const AITask: React.FC<AITaskProps> = ({ onClose, onGenerate, fixedProjectId }) => {
    const navigate = useNavigate();
    const [selectedProjects, setSelectedProjects] = useState<number[]>(fixedProjectId ? [fixedProjectId] : []);
    const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
    const [projectSearchInput, setProjectSearchInput] = useState('');
    const [allProjectOptions, setAllProjectOptions] = useState<ProjectMinimal[]>([]);
    const [description, setDescription] = useState('');
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const projectSearchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchProjects = async () => {
            setIsDataLoading(true);
            try {
                const projectData = await projectsApi.list();
                const results = projectData?.results || projectData || [];
                setAllProjectOptions(Array.isArray(results) ? results : []);
            } catch (err) {
                console.error("Failed to load projects:", err);
                setError("Failed to load projects.");
                setAllProjectOptions([]);
            } finally {
                setIsDataLoading(false);
            }
        };
        fetchProjects();
    }, []);

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

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const isOutsideProject = !target.closest('[data-dropdown="project"]');

            if (isOutsideProject) setProjectDropdownOpen(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (selectedProjects.length === 0 || !description.trim()) {
            setError('Please select a project and provide a description.');
            return;
        }

        setLoading(true);
        try {
            const payload: AITaskSuggestionPayload = {
                project_id: selectedProjects[0],
                description: description.replace(/<[^>]*>/g, '').trim() // Strip HTML tags for API
            };

            const aiResponse = await taskApi.suggestTask(payload);

            // Navigate to create task page with AI-generated data
            navigate('/taskboard/create', {
                state: { aiGeneratedTask: aiResponse }
            });

            onClose();
        } catch (err: any) {
            console.error('Error generating task:', err);
            setError(err.response?.data?.message || err.response?.data?.error || 'Failed to generate task. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (isDataLoading) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-white dark:bg-card rounded-lg p-6 shadow-xl">
                    <div className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                        <p className="text-gray-600 dark:text-muted-foreground">Loading...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={handleBackdropClick}
        >
            <div className="bg-white dark:bg-card rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-border">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                            <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground">Generate Task by AI</h2>
                            <p className="text-sm text-gray-500 dark:text-muted-foreground mt-0.5">Let AI help you create comprehensive tasks</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded hover:bg-gray-100 dark:hover:bg-secondary transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-600 dark:text-muted-foreground" />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-5">
                        {/* Error Alert */}
                        {error && (
                            <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 rounded-lg flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-red-800">Error</p>
                                    <p className="text-sm text-red-700 mt-1">{error}</p>
                                </div>
                            </div>
                        )}

                        {/* Project Selection */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-foreground mb-2">
                                <Briefcase className="w-4 h-4" />
                                Project <span className="text-red-500">*</span>
                            </label>
                            <div className="relative" data-dropdown="project">
                                <div
                                    className={`w-full p-2.5 rounded border border-gray-300 dark:border-border bg-white dark:bg-muted flex flex-wrap gap-2 min-h-[42px] ${fixedProjectId ? 'cursor-not-allowed bg-gray-50 dark:bg-secondary' : 'cursor-pointer hover:border-gray-400 dark:hover:border-muted-foreground'
                                        } transition-colors`}
                                    onClick={() => {
                                        if (!fixedProjectId) {
                                            setProjectDropdownOpen(true);
                                            setTimeout(() => projectSearchInputRef.current?.focus(), 0);
                                        }
                                    }}
                                >
                                    {selectedProjects.length === 0 ? (
                                        !projectDropdownOpen ? (
                                            <span className="text-gray-400 dark:text-muted-foreground text-sm">Search project</span>
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
                                    <div className="absolute z-20 mt-1 w-full bg-white dark:bg-card border border-gray-200 dark:border-border rounded-lg shadow-lg max-h-56 overflow-y-auto">
                                        {filteredProjectOptions.length > 0 ? (
                                            filteredProjectOptions.map((project) => (
                                                <div
                                                    key={project.id}
                                                    className="px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-muted cursor-pointer text-sm dark:text-foreground"
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
                                            <div className="px-4 py-2.5 text-sm text-gray-500 dark:text-muted-foreground text-center">
                                                No projects found
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Description Section */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-foreground mb-2">
                                Description <span className="text-red-500">*</span>
                            </label>
                            <RichTextEditor
                                value={description}
                                onChange={setDescription}
                                placeholder="Describe what you want the AI to generate. Be specific about requirements, deliverables, and any constraints..."
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
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-gray-50 dark:bg-secondary border-t border-gray-200 dark:border-border flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-foreground bg-white dark:bg-card border border-gray-300 dark:border-border rounded hover:bg-gray-50 dark:hover:bg-muted transition-colors"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4" />
                                    Generate Task
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};