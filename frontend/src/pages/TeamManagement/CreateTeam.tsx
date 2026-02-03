import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/common';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamsApi, usersApi } from '@/services/api';
import type { User as AppUser } from '@/types';
import { useAuth } from '@/hooks/useAuth';

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
                className="w-full p-2 rounded border border-gray-300 hover:border-gray-400 cursor-pointer bg-white flex items-center justify-between transition-all"
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

// Rich Text Editor
const RichTextEditor: React.FC<{
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
}> = ({ value, onChange, placeholder }) => {
    return (
        <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full border rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all min-h-[100px] resize-none"
        />
    );
};

export function CreateTeam() {
    const navigate = useNavigate();
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

    const { user } = useAuth();
    const queryClient = useQueryClient();

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

    // Transform users data (same as CreateTask)
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
            queryClient.invalidateQueries({ queryKey: ['teams'] });
            navigate('/admin/user-roles');
        },
        onError: (error: any) => {
            setError(error?.response?.data?.message || 'Failed to create team');
            setIsSubmitting(false);
        },
    });


    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const isOutsideMember = !target.closest('[data-dropdown="member"]');
            if (isOutsideMember) setMemberDropdownOpen(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSave = async () => {
        // Validation
        if (!teamName.trim()) {
            setError('Team name is required');
            return;
        }

        if (!teamType) {
            setError('Please select a team type');
            return;
        }

        // Get team_type value from label
        const selectedTeamType = teamTypes.find(t => t.label === teamType);
        if (!selectedTeamType) {
            setError('Invalid team type selected');
            return;
        }

        // Determine leader_id 
        const finalLeaderId = leaderId || user?.id;
        if (!finalLeaderId) {
            setError('Unable to determine team leader');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await createTeamMutation.mutateAsync({
                name: teamName,
                team_type: selectedTeamType.value, // Use value, not label
                description: description || '',
                leader_id: finalLeaderId,
                member_ids: selectedMembers,
            });
        } catch (err) {
            // Error handled by mutation onError
            console.error('Failed to create team:', err);
        }
    };

    const inputClass = "w-full border rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all";
    const labelClass = "text-sm font-medium text-gray-700 mb-1 block";

    return (
        <div className="flex w-full min-h-screen">
            <div className="flex-1 min-w-0 p-8">
                <div className="max-w-3xl mx-auto space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => navigate('/admin/user-roles')}
                                    className="hover:bg-accent"
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                                <h1 className="text-3xl font-bold">Create Team</h1>
                            </div>
                            <p className="text-muted-foreground ml-12">Create a new team and assign members</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                onClick={handleSave}
                                disabled={!teamName.trim() || isLoadingTeamTypes || isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-4 w-4 mr-2" /> Save Team
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
                            <span className="block sm:inline">{error}</span>
                            <button
                                className="absolute top-0 bottom-0 right-0 px-4 py-3"
                                onClick={() => setError(null)}
                            >
                                <span className="text-red-500">×</span>
                            </button>
                        </div>
                    )}

                    {/* Form Card */}
                    <div className="bg-white rounded-lg border shadow-sm">
                        <div className="p-6 space-y-5">
                            {/* Team Name */}
                            <div>
                                <label className={labelClass}>Team Name *</label>
                                <input
                                    type="text"
                                    placeholder="Enter team name"
                                    className={inputClass}
                                    value={teamName}
                                    onChange={(e) => setTeamName(e.target.value)}
                                />
                            </div>

                            {/* Team Type */}
                            <div>
                                <label className={labelClass}>Team Type</label>
                                <CustomDropdown
                                    value={teamType}
                                    onChange={setTeamType}
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
                                />
                            </div>

                            {/* Add Members */}
                            <div>
                                <label className={labelClass}>Add Members</label>
                                <div className="relative" data-dropdown="member">
                                    <div className="w-full p-2 rounded border border-gray-300 hover:border-gray-400 bg-white flex flex-wrap gap-2 min-h-[38px] transition-colors">
                                        {usersLoading ? (
                                            <span className="text-gray-400 text-sm flex items-center gap-2">
                                                <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
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
                                                    className="flex-1 min-w-[120px] outline-none text-sm"
                                                />
                                            </>
                                        )}
                                    </div>

                                    {/* Dropdown */}
                                    {memberDropdownOpen && !usersLoading && filteredMemberOptions.length > 0 && (
                                        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
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
                </div>
            </div>
        </div>
    );
}