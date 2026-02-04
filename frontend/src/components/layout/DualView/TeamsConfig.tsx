import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/common';
import { teamsApi, usersApi } from '@/services/api';
import type { Team } from '@/types';
import type { TableColumn } from '@/components/layout/DualView';
import { UserPlus } from 'lucide-react';

const TeamMembersList = ({ team }: { team: Team }) => {
    const [openMembersCard, setOpenMembersCard] = React.useState(false);

    return (
        <div className="relative inline-block">
            <div
                className="flex -space-x-1.5 items-center cursor-pointer hover:opacity-80"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpenMembersCard(!openMembersCard);
                }}
            >
                {team.members && team.members.length > 0 ? (
                    <>
                        {team.members.slice(0, 3).map((member: any) => (
                            <div
                                key={member.id}
                                className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700 ring-1 ring-white z-10"
                                title={member.user?.full_name || 'User'}
                            >
                                {member.user?.full_name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                        ))}
                        {team.members.length > 3 && (
                            <div className="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center text-[10px] font-bold text-white ring-1 ring-white z-0">
                                +{team.members.length - 3}
                            </div>
                        )}
                    </>
                ) : (
                    <span className="text-gray-400 text-[11px] pl-1">—</span>
                )}
            </div>

            {openMembersCard && (
                <>
                    <div
                        className="fixed inset-0 z-[100]"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            e.nativeEvent.stopImmediatePropagation();
                            setOpenMembersCard(false);
                        }}
                    />
                    <div className="absolute left-0 top-full mt-2 z-[999] w-64 bg-white border border-gray-200 rounded-lg shadow-xl text-left">
                        <div className="p-2 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-lg">
                            <span className="text-xs font-semibold text-gray-700">Team Members</span>
                            <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded text-gray-600">
                                {team.members?.length || 0}
                            </span>
                        </div>
                        <div className="max-h-48 overflow-y-auto p-1">
                            {team.members?.map((member) => (
                                <div key={member.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded">
                                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700 shrink-0">
                                        {member.user.full_name?.charAt(0) || 'U'}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-medium text-gray-700 truncate">{member.user.full_name}</p>
                                        <p className="text-[10px] text-gray-400 truncate capitalize">{member.role.replace('_', ' ')}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

// Add Members Component
interface AddMembersDropdownProps {
    team: Team;
    onMemberAdded: () => void;
}

const AddMembersDropdown: React.FC<AddMembersDropdownProps> = ({ team, onMemberAdded }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState('');
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const buttonRef = React.useRef<HTMLButtonElement>(null);
    const [dropdownPosition, setDropdownPosition] = React.useState<{ top: number; left: number } | null>(null);

    // Fetch users
    const { data: usersData, isLoading } = useQuery({
        queryKey: ['users'],
        queryFn: usersApi.list,
        staleTime: Infinity,
    });

    const allUsers = React.useMemo(() => {
        if (!usersData) return [];
        const data = (usersData as any).results || usersData;
        return Array.isArray(data) ? data : [];
    }, [usersData]);

    const availableUsers = React.useMemo(() => {
        const existingMemberIds = team.members?.map(m => m.user.id) || [];
        return allUsers.filter(user => !existingMemberIds.includes(user.id));
    }, [allUsers, team.members]);

    // Filter by search term
    const filteredUsers = React.useMemo(() => {
        if (!searchTerm.trim()) return availableUsers;
        const term = searchTerm.toLowerCase();
        return availableUsers.filter(user => {
            const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
            return fullName.includes(term) || user.username.toLowerCase().includes(term);
        });
    }, [availableUsers, searchTerm]);

    // Calculate dropdown position
    React.useEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + window.scrollY + 8,
                left: rect.left + window.scrollX,
            });
        }
    }, [isOpen]);

    // Handle click outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleAddMember = async (userId: number) => {
        try {
            const response = await teamsApi.addMember(team.id, { user_id: userId, role: 'member' });
            console.log('Member added successfully:', response);
            onMemberAdded();
            setSearchTerm('');
        } catch (error) {
            console.error('Failed to add member:', error);
        }
    };

    return (
        <>
            <button
                ref={buttonRef}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className="p-1.5 hover:bg-blue-50 rounded-md transition-colors text-blue-600"
                title="Add members"
            >
                <UserPlus className="w-4 h-4" />
            </button>

            {isOpen && dropdownPosition && (
                <div
                    ref={dropdownRef}
                    className="fixed z-[999] w-64 bg-white border border-gray-200 rounded-lg shadow-xl"
                    style={{
                        top: `${dropdownPosition.top}px`,
                        left: `${dropdownPosition.left}px`,
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="p-2 border-b border-gray-100">
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded outline-none focus:ring-1 focus:ring-blue-500"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                        {isLoading ? (
                            <div className="p-3 text-center text-xs text-gray-500">Loading users...</div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="p-3 text-center text-xs text-gray-500">
                                {searchTerm ? 'No users found' : 'No available users'}
                            </div>
                        ) : (
                            filteredUsers.map((user) => (
                                <div
                                    key={user.id}
                                    className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleAddMember(user.id);
                                    }}
                                >
                                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700 shrink-0">
                                        {user.first_name?.charAt(0) || user.username?.charAt(0) || 'U'}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[11px] font-medium text-gray-700 truncate">
                                            {user.first_name && user.last_name
                                                ? `${user.first_name} ${user.last_name}`
                                                : user.username}
                                        </p>
                                        <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

// Table columns configuration
export const getTeamsTableColumns = (
    onToggleFavorite: (e: React.MouseEvent, team: Team) => void,
    onMemberAdded: () => void,
    onDelete?: (team: Team) => void
): TableColumn<Team>[] => [
        {
            key: 'name',
            label: 'Team Name',
            render: (team: Team) => (
                <div className="flex items-center justify-between gap-2 w-full group/teamname">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-[13px] text-[#172b4d]">{team.name}</span>
                    </div>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (onDelete) onDelete(team);
                        }}
                        className="opacity-0 group-hover/teamname:opacity-100 p-1 hover:bg-red-50 rounded transition-all text-red-500 hover:text-red-700"
                        title="Delete team"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            ),
        },
        {
            key: 'team_type',
            label: 'Team Type',
            width: '150px',
            render: (team: Team) => (
                <Badge variant="secondary" className="text-[11px] capitalize">
                    {team.team_type_display || team.team_type}
                </Badge>
            ),
        },
        {
            key: 'members',
            label: 'Members',
            width: '120px',
            render: (team: Team) => <TeamMembersList team={team} />,
        },
        {
            key: 'add_members',
            label: 'Add Members',
            width: '120px',
            className: 'text-center',
            render: (team: Team) => (
                <AddMembersDropdown team={team} onMemberAdded={onMemberAdded} />
            ),
        },
        {
            key: 'favorite',
            label: 'Favorite',
            width: '80px',
            className: 'text-center',
            render: (team: Team) => (
                <button
                    onClick={(e) => onToggleFavorite(e, team)}
                    className="hover:scale-110 transition-transform focus:outline-none"
                >
                    {team.is_favourite ? (
                        <span className="text-yellow-500 text-lg">★</span>
                    ) : (
                        <span className="text-gray-300 text-lg hover:text-yellow-400">☆</span>
                    )}
                </button>
            ),
        },
    ];

// Grid card component
interface TeamGridCardProps {
    team: Team;
    onToggleFavorite: (e: React.MouseEvent, team: Team) => void;
    onMemberAdded: () => void;
}

export function TeamGridCard({ team, onToggleFavorite, onMemberAdded }: TeamGridCardProps) {
    return (
        <div className="bg-white rounded-xl p-4 transition-all duration-300 cursor-pointer text-gray-800 hover:shadow-lg hover:-translate-y-0.5 border border-[#d0d5dd] relative hover:z-50 h-full group">
            {/* Header: Team Name & Favorite */}
            <div className="flex justify-between items-start gap-2 mb-3">
                <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-900 line-clamp-1">{team.name}</span>
                    <Badge variant="secondary" className="text-[10px] capitalize mt-1">
                        {team.team_type_display || team.team_type}
                    </Badge>
                </div>

                <button
                    type="button"
                    onClick={(e) => onToggleFavorite(e, team)}
                    className="text-gray-300 hover:text-yellow-500 transition-colors focus:outline-none"
                >
                    <span className={`text-lg ${team.is_favourite ? 'text-yellow-500' : ''}`}>
                        {team.is_favourite ? '★' : '☆'}
                    </span>
                </button>
            </div>

            {/* Details: Members & Add */}
            <div className="space-y-2 text-xs text-gray-500 mb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <TeamMembersList team={team} />
                        <span className="text-[11px]">{team.member_count || 0} members</span>
                    </div>
                    <AddMembersDropdown team={team} onMemberAdded={onMemberAdded} />
                </div>
            </div>
        </div>
    );
}