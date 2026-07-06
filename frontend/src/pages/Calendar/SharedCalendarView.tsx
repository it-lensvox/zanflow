import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Search, Copy, Check, Link2, Users, ChevronDown, Trash2, Globe, Lock, Loader2, Download } from 'lucide-react';
import { usersApi, eventApi, calendarShareApi, calendarLinkApi } from '@/services/api';

interface SharedUser {
    id: number;
    first_name: string;
    last_name: string;
    email?: string;
    permission: 'view' | 'edit' | 'full';
}

interface ShareCalendarModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUserId: number;
}

// ... rest of your component

export const ShareCalendarModal: React.FC<ShareCalendarModalProps> = ({
    isOpen,
    onClose,
    currentUserId,
}) => {
    const queryClient = useQueryClient();

    const [searchQuery, setSearchQuery] = useState('');
    const [showUserDropdown, setShowUserDropdown] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    const [isLinkEnabled, setIsLinkEnabled] = useState(false);
    const [shareLink, setShareLink] = useState('');
    const [activeLinkId, setActiveLinkId] = useState<number | null>(null);
    const [isLinkLoading, setIsLinkLoading] = useState(false);
    const [activePermissionDropdown, setActivePermissionDropdown] = useState<number | null>(null);
    const [pendingAction, setPendingAction] = useState<number | null>(null);

    // Fetch all users for search
    const { data: allUsers = [] } = useQuery({
        queryKey: ['users-list-share'],
        queryFn: usersApi.listAll,
        enabled: isOpen,
    });

    // Fetch existing calendar shares from backend
    const { data: sharesData = [], isLoading: isLoadingShares } = useQuery({
        queryKey: ['calendar-shares'],
        queryFn: calendarShareApi.list,
        enabled: isOpen,
    });

    const sharesArray = Array.isArray(sharesData) ? sharesData : (sharesData?.results || []);
    const myShares = sharesArray.filter((share: any) => share.owner === currentUserId);

    const { mutate: createShare, isPending: isCreating } = useMutation({
        mutationFn: calendarShareApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['calendar-shares'] });
            setSearchQuery('');
            setShowUserDropdown(false);
        },
        onError: (error: any) => {
            console.error('Failed to create share:', error);
            alert(error.response?.data?.detail || 'Failed to share calendar');
        },
    });

    // Update share permission mutation
    const { mutate: updateShare } = useMutation({
        mutationFn: ({ shareId, permission }: { shareId: number; permission: 'view' | 'edit' | 'full' }) =>
            calendarShareApi.update(shareId, { permission }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['calendar-shares'] });
            setActivePermissionDropdown(null);
            setPendingAction(null);
        },
        onError: (error: any) => {
            console.error('Failed to update share:', error);
            alert(error.response?.data?.detail || 'Failed to update permission');
            setPendingAction(null);
        },
    });

    // Delete share mutation
    const { mutate: deleteShare } = useMutation({
        mutationFn: calendarShareApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['calendar-shares'] });
            setPendingAction(null);
        },
        onError: (error: any) => {
            console.error('Failed to delete share:', error);
            alert(error.response?.data?.detail || 'Failed to remove share');
            setPendingAction(null);
        },
    });

    // Load existing public link on mount
    useEffect(() => {
        if (isOpen) {
            const loadExistingLink = async () => {
                try {
                    const links = await calendarLinkApi.list();
                    if (links.length > 0) {
                        const activeLink = links[0];
                        setShareLink(`${window.location.origin}/calendar/shared/${activeLink.token}`);
                        setActiveLinkId(activeLink.id);
                        setIsLinkEnabled(true);
                    } else {
                        setShareLink('');
                        setActiveLinkId(null);
                        setIsLinkEnabled(false);
                    }
                } catch (error) {
                    console.error('Failed to load calendar links:', error);
                }
            };
            loadExistingLink();
        }
    }, [isOpen]);

    // Filter users based on search (exclude already shared)
    const filteredUsers = allUsers.filter((user: any) => {
        if (user.id === currentUserId) return false;
        if (myShares.some((share: any) => share.shared_with === user.id)) return false;
        const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
        const email = (user.email || '').toLowerCase();
        const query = searchQuery.toLowerCase();
        return fullName.includes(query) || email.includes(query);
    });

    // ═══════════════ HANDLERS ═══════════════
    const handleAddUser = (user: any) => {
        createShare({
            shared_with: user.id,
            permission: 'view',
        });
    };

    const handleRemoveShare = (shareId: number) => {
        setPendingAction(shareId);
        deleteShare(shareId);
    };

    const handlePermissionChange = (shareId: number, permission: 'view' | 'edit' | 'full') => {
        setPendingAction(shareId);
        updateShare({ shareId, permission });
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(shareLink);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy link:', err);
        }
    };
    // Handle public link toggle
    const handleLinkToggle = async (enabled: boolean) => {
        setIsLinkLoading(true);
        try {
            if (enabled) {
                const newLink = await calendarLinkApi.create();
                setShareLink(`${window.location.origin}/calendar/shared/${newLink.token}`);
                setActiveLinkId(newLink.id);
                setIsLinkEnabled(true);
            } else {
                if (activeLinkId) {
                    await calendarLinkApi.delete(activeLinkId);
                }
                setShareLink('');
                setActiveLinkId(null);
                setIsLinkEnabled(false);
            }
        } catch (error) {
            console.error('Failed to toggle link:', error);
            alert('Failed to update public link');
        } finally {
            setIsLinkLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <Users size={20} className="text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Share Calendar</h2>
                            <p className="text-sm text-gray-500">Share your calendar with team members</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/80 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Search Users */}
                    <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Add people
                        </label>
                        <div className="relative">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setShowUserDropdown(true);
                                }}
                                onFocus={() => setShowUserDropdown(true)}
                                placeholder="Search by name or email..."
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                            />
                        </div>

                        {/* User Search Dropdown */}
                        {showUserDropdown && searchQuery && filteredUsers.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                {filteredUsers.map((user: any) => (
                                    <button
                                        key={user.id}
                                        onClick={() => handleAddUser(user)}
                                        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-medium">
                                            {user.first_name?.[0]}{user.last_name?.[0]}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">
                                                {user.first_name} {user.last_name}
                                            </p>
                                            {user.email && (
                                                <p className="text-xs text-gray-500">{user.email}</p>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {showUserDropdown && searchQuery && filteredUsers.length === 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-sm text-gray-500">
                                No users found
                            </div>
                        )}
                    </div>

                    {/* Shared Users List */}
                    {isLoadingShares ? (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 size={20} className="animate-spin text-indigo-500" />
                            <span className="ml-2 text-sm text-gray-500">Loading...</span>
                        </div>
                    ) : myShares.length > 0 ? (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Shared with ({myShares.length})
                            </label>
                            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-visible">
                                {myShares.map((share: any) => (
                                    <div key={share.id} className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white flex items-center justify-center text-sm font-medium">
                                                {share.shared_with_name?.split(' ').map((n: string) => n[0]).join('') || '?'}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">
                                                    {share.shared_with_name}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    Shared {new Date(share.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {/* Permission Dropdown */}
                                            <div className="relative">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActivePermissionDropdown(
                                                            activePermissionDropdown === share.id ? null : share.id
                                                        );
                                                    }}
                                                    disabled={pendingAction === share.id}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
                                                >
                                                    {pendingAction === share.id ? (
                                                        <Loader2 size={14} className="animate-spin" />
                                                    ) : (
                                                        <>
                                                            {share.permission === 'view' && 'View only'}
                                                            {share.permission === 'edit' && 'Can edit'}
                                                            {share.permission === 'full' && 'Full access'}
                                                            <ChevronDown size={14} />
                                                        </>
                                                    )}
                                                </button>

                                                {activePermissionDropdown === share.id && (
                                                    <>
                                                        <div
                                                            className="fixed inset-0 z-[60]"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActivePermissionDropdown(null);
                                                            }}
                                                        />
                                                        <div className="absolute right-0 bottom-full mb-2 z-[70] w-36 bg-white border border-gray-200 rounded-lg shadow-2xl py-1">
                                                            {[
                                                                { value: 'view', label: 'View only' },
                                                                { value: 'edit', label: 'Can edit' },
                                                                { value: 'full', label: 'Full access' },
                                                            ].map((option) => (
                                                                <button
                                                                    key={option.value}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handlePermissionChange(share.id, option.value as 'view' | 'edit' | 'full');
                                                                    }}
                                                                    className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-50 transition-colors ${share.permission === option.value
                                                                        ? 'text-indigo-600 font-medium bg-indigo-50'
                                                                        : 'text-gray-700'
                                                                        }`}
                                                                >
                                                                    {share.permission === option.value && <span className="mr-1">✓</span>}
                                                                    {option.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            <button
                                                onClick={() => handleRemoveShare(share.id)}
                                                disabled={pendingAction === share.id}
                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                                            >
                                                {pendingAction === share.id ? (
                                                    <Loader2 size={16} className="animate-spin" />
                                                ) : (
                                                    <Trash2 size={16} />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {/* Calendars Shared With Me */}
                    {(() => {
                        const sharedWithMe = sharesData.filter((share: any) => share.shared_with === currentUserId);
                        if (sharedWithMe.length === 0) return null;

                        return (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Calendars shared with you ({sharedWithMe.length})
                                </label>
                                <div className="space-y-2">
                                    {sharedWithMe.map((share: any) => (
                                        <div key={share.id} className="flex items-center justify-between p-2 bg-purple-50 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-purple-200 text-purple-700 flex items-center justify-center text-sm font-medium">
                                                    {share.owner_name?.split(' ').map((n: string) => n[0]).join('') || '?'}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{share.owner_name}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {share.permission === 'view' && 'View only'}
                                                        {share.permission === 'edit' && 'Can edit'}
                                                        {share.permission === 'full' && 'Full access'}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded">
                                                Enable "Shared: On" to view
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Divider */}
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200"></div>
                        </div>
                        <div className="relative flex justify-center">
                            <span className="px-3 bg-white text-sm text-gray-500">Or share via link</span>
                        </div>
                    </div>

                    {/* Share Link Section */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Link2 size={18} className="text-gray-500" />
                                <span className="text-sm font-medium text-gray-700">Public link</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isLinkEnabled}
                                    onChange={(e) => handleLinkToggle(e.target.checked)}
                                    disabled={isLinkLoading}
                                    className="sr-only peer"
                                />
                                <div className={`w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 ${isLinkLoading ? 'opacity-50' : ''}`}></div>
                                {isLinkLoading && (
                                    <Loader2 size={14} className="ml-2 animate-spin text-gray-400" />
                                )}                            </label>
                        </div>

                        {isLinkEnabled && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                                        <div className="px-3 py-2 bg-gray-100 border-r border-gray-200">
                                            <Globe size={16} className="text-gray-500" />
                                        </div>
                                        <input
                                            type="text"
                                            value={shareLink}
                                            readOnly
                                            className="flex-1 px-3 py-2 bg-transparent text-sm text-gray-600 focus:outline-none"
                                        />
                                    </div>
                                    <button
                                        onClick={handleCopyLink}
                                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all text-sm font-medium ${linkCopied
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                                            }`}
                                    >
                                        {linkCopied ? (
                                            <>
                                                <Check size={16} />
                                                Copied!
                                            </>
                                        ) : (
                                            <>
                                                <Copy size={16} />
                                                Copy
                                            </>
                                        )}
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                    <Lock size={12} />
                                    Anyone with this link can view your calendar (read-only)
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Export Calendar Section */}
                    <div className="pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-100 rounded-lg">
                                    <Download size={18} className="text-green-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-700">Export Calendar</p>
                                    <p className="text-xs text-gray-500">Download as ICS file for Google/Outlook</p>
                                </div>
                            </div>
                            <button
                                onClick={async () => {
                                    try {
                                        await eventApi.exportAllEvents();
                                    } catch (error) {
                                        console.error('Failed to export calendar:', error);
                                        alert('Failed to export calendar');
                                    }
                                }}
                                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors text-sm font-medium shadow-sm"
                            >
                                <Download size={16} />
                                Export All
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};