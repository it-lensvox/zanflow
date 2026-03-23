import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/common';
import { useQuery, useMutation } from '@tanstack/react-query';
import { teamsApi, usersApi } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import type { CreateTeamPayload } from '@/types';
import { RichTextEditor } from '@/components/common/RichTextEditor';

interface CreateTeamModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const CustomDropdown: React.FC<{
    value: string;
    onChange: (value: string) => void;
    options: string[];
    placeholder: string;
    icon?: React.ReactNode;
}> = ({ value, onChange, options, placeholder, icon }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div ref={dropdownRef} className="relative">
            <div
                className="w-full p-2 rounded border border-gray-300 hover:border-gray-400 cursor-pointer bg-white flex items-center justify-between transition-all dark:bg-secondary dark:border-gray-600"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2">
                    {icon}
                    <span className={`text-sm ${value ? 'text-gray-700' : 'text-gray-400'}`}>
                        {value || placeholder}
                    </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute z-10 w-full mt-1 border border-gray-200 rounded-lg bg-white shadow-lg overflow-hidden">
                    {options.map((option) => (
                        <div
                            key={option}
                            className={`px-3 py-2 cursor-pointer text-sm transition-colors ${value === option ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50 text-gray-700'
                                }`}
                            onClick={() => {
                                onChange(option);
                                setIsOpen(false);
                            }}
                        >
                            {option}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export function CreateTeamModal({ isOpen, onClose, onSuccess }: CreateTeamModalProps) {
    const [teamName, setTeamName] = useState('');
    const [teamType, setTeamType] = useState('');
    const [description, setDescription] = useState('');
    const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
    const [memberSearchInput, setMemberSearchInput] = useState('');
    const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
    const [highlightedMemberIndex, setHighlightedMemberIndex] = useState(0);
    const [leaderId, setLeaderId] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const memberDropdownRef = useRef<HTMLDivElement>(null);

    const { user } = useAuth();

    // Fetch team types from API
    const { data: teamTypeChoices, isLoading: isLoadingTeamTypes } = useQuery({
        queryKey: ['teamTypeChoices'],
        queryFn: teamsApi.getTeamTypeChoices,
    });

    const teamTypes = teamTypeChoices?.team_types || [];

    // Fetch users from API
    const { data: usersData, isLoading: usersLoading } = useQuery({
        queryKey: ['users'],
        queryFn: usersApi.list,
        staleTime: Infinity,
    });

    // Transform users data
    const allUserOptions = React.useMemo<Array<{
        value: string;
        label: string;
        id: number;
    }>>(() => {
        if (!usersData) return [];
        const data = (usersData as any).results || usersData;
        return Array.isArray(data) ? data.map((user: any) => ({
            value: String(user.id),
            label: user.first_name && user.last_name
                ? `${user.first_name} ${user.last_name}`
                : user.username,
            id: user.id,
        })) : [];
    }, [usersData]);

    // Filter users based on search input
    const filteredMemberOptions = React.useMemo(() => {
        const availableUsers = allUserOptions.filter(
            (user) => !selectedMembers.includes(user.id)
        );

        if (!memberSearchInput.trim()) {
            return availableUsers;
        }

        return availableUsers.filter((user) =>
            user.label.toLowerCase().startsWith(memberSearchInput.toLowerCase())
        );
    }, [allUserOptions, selectedMembers, memberSearchInput]);

    // Create team mutation
    const createTeamMutation = useMutation({
        mutationFn: teamsApi.create,
        onSuccess: () => {
            resetForm();
            onSuccess();
        },
        onError: (error: any) => {
            setError(error.response?.data?.detail || 'Failed to create team');
            setIsSubmitting(false);
        },
    });

    const resetForm = () => {
        setTeamName('');
        setTeamType('');
        setDescription('');
        setSelectedMembers([]);
        setMemberSearchInput('');
        setLeaderId(null);
        setError(null);
        setIsSubmitting(false);
    };

    const handleSubmit = async () => {
        setError(null);

        if (!teamName.trim()) {
            setError('Team name is required');
            return;
        }

        if (selectedMembers.length === 0) {
            setError('Please add at least one member');
            return;
        }

        setIsSubmitting(true);

        const payload: CreateTeamPayload = {
            name: teamName,
            team_type: teamType || 'engineering',
            description: description || '',
            leader_id: leaderId || user?.id || selectedMembers[0],
            member_ids: selectedMembers,
        };

        createTeamMutation.mutate(payload);
    };

    const handleClose = () => {
        if (!isSubmitting) {
            resetForm();
            onClose();
        }
    };

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isSubmitting) {
                if (!isSubmitting) {
                    resetForm();
                    onClose();
                }
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, isSubmitting, onClose]);

    // Handle click outside for member dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                memberDropdownRef.current &&
                !memberDropdownRef.current.contains(event.target as Node)
            ) {
                setMemberDropdownOpen(false);
            }
        };

        if (memberDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [memberDropdownOpen]);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isSubmitting) {
                handleClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, isSubmitting]);

    if (!isOpen) return null;

    const labelClass = 'block text-sm font-semibold text-gray-700 mb-1.5 dark:text-foreground';
    const inputClass = 'w-full border rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all dark:bg-secondary dark:border-gray-600 dark:text-foreground';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden dark:bg-card">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <h2 className="text-2xl font-bold dark:text-foreground">Create New Team</h2>
                    <button
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="p-1 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}

                    <div className="space-y-5">
                        {/* Team Name */}
                        <div>
                            <label className={labelClass}>Team Name *</label>
                            <input
                                type="text"
                                placeholder="Enter team name"
                                className={inputClass}
                                value={teamName}
                                onChange={(e) => setTeamName(e.target.value)}
                                disabled={isSubmitting}
                            />
                        </div>

                        {/* Team Type */}
                        <div>
                            <label className={labelClass}>Team Type</label>
                            <CustomDropdown
                                value={teamTypes.find(t => t.value === teamType)?.label || ""}
                                onChange={(label) => {
                                    const selected = teamTypes.find(t => t.label === label);
                                    if (selected) setTeamType(selected.value);
                                }}
                                options={teamTypes.map(t => t.label)}
                                placeholder={isLoadingTeamTypes ? "Loading..." : "Select team type"}
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className={labelClass}>Description</label>
                            <RichTextEditor
                                value={description}
                                onChange={setDescription}
                                placeholder="Enter team description..."
                                minHeight="120px"
                                maxHeight="250px"
                                readOnly={isSubmitting}
                                features={{
                                    bold: true,
                                    italic: true,
                                    underline: true,
                                    link: true,
                                    bulletList: true,
                                    orderedList: true,
                                    table: false,
                                    image: false,
                                    codeBlock: false,
                                    heading: false,
                                }}
                            />
                        </div>

                        {/* Add Members */}
                        <div>
                            <label className={labelClass}>Add Members *</label>
                            <div className="relative" data-dropdown="member">
                                <div className="w-full p-2 rounded border border-gray-300 hover:border-gray-400 bg-white flex flex-wrap gap-2 min-h-[38px] transition-colors dark:bg-secondary dark:border-gray-600" onClick={() => setMemberDropdownOpen(true)}>
                                    {usersLoading ? (
                                        <span className="text-gray-400 text-sm flex items-center gap-2">
                                            <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin dark:border-blue-500" />
                                            Loading users...
                                        </span>
                                    ) : (
                                        <>
                                            {/* Selected users as chips */}
                                            {selectedMembers.map((userId) => {
                                                const user = allUserOptions.find(u => u.id === userId);
                                                if (!user) return null;
                                                return (
                                                    <span
                                                        key={userId}
                                                        className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs flex items-center gap-1"
                                                    >
                                                        {user.label}
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedMembers(selectedMembers.filter(id => id !== userId));
                                                            }}
                                                            className="hover:text-red-600"
                                                            disabled={isSubmitting}
                                                        >
                                                            ×
                                                        </button>
                                                    </span>
                                                );
                                            })}

                                            {/* Search input */}
                                            <input
                                                type="text"
                                                value={memberSearchInput}
                                                onChange={(e) => {
                                                    setMemberSearchInput(e.target.value);
                                                    setHighlightedMemberIndex(0);
                                                    setMemberDropdownOpen(true);
                                                }}
                                                onFocus={() => {
                                                    setMemberDropdownOpen(true);
                                                    setHighlightedMemberIndex(0);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'ArrowDown') {
                                                        e.preventDefault();
                                                        setHighlightedMemberIndex((prev) =>
                                                            Math.min(prev + 1, filteredMemberOptions.length - 1)
                                                        );
                                                    } else if (e.key === 'ArrowUp') {
                                                        e.preventDefault();
                                                        setHighlightedMemberIndex((prev) => Math.max(prev - 1, 0));
                                                    } else if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        if (filteredMemberOptions[highlightedMemberIndex]) {
                                                            setSelectedMembers([...selectedMembers, filteredMemberOptions[highlightedMemberIndex].id]);
                                                            setMemberSearchInput('');
                                                            setHighlightedMemberIndex(0);
                                                        }
                                                    } else if (e.key === 'Escape') {
                                                        setMemberDropdownOpen(false);
                                                        setMemberSearchInput('');
                                                        setHighlightedMemberIndex(0);
                                                    } else if (e.key === 'Backspace' && memberSearchInput === '' && selectedMembers.length > 0) {
                                                        setSelectedMembers(selectedMembers.slice(0, -1));
                                                    }
                                                }}
                                                placeholder={selectedMembers.length === 0 ? "Search members..." : ""}
                                                className="flex-1 min-w-[120px] outline-none text-sm dark:bg-secondary dark:text-foreground"
                                                disabled={isSubmitting}
                                            />
                                        </>
                                    )}
                                </div>

                                {/* Dropdown */}
                                {memberDropdownOpen && !usersLoading && filteredMemberOptions.length > 0 && (
                                    <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto dark:bg-secondary" ref={memberDropdownRef}>
                                        {filteredMemberOptions.map((user, index) => (
                                            <div
                                                key={user.id}
                                                className={`px-3 py-2 cursor-pointer text-sm ${index === highlightedMemberIndex
                                                    ? 'bg-blue-50 text-blue-700'
                                                    : 'hover:bg-gray-50'
                                                    }`}
                                                onClick={() => {
                                                    setSelectedMembers([...selectedMembers, user.id]);
                                                    setMemberSearchInput('');
                                                    setHighlightedMemberIndex(0);
                                                    setMemberDropdownOpen(false);
                                                }}
                                                onMouseEnter={() => setHighlightedMemberIndex(index)}
                                            >
                                                {user.label}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50 dark:bg-secondary">
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Creating...' : 'Create Team'}
                    </Button>
                </div>
            </div>
        </div>
    );
}