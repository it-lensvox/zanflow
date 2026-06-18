import { useState } from 'react';
import { X, Plus, Users, ChevronDown, Check, Search } from 'lucide-react';
import { workspaceApi, usersApi } from '@/services/api';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type MemberRole = 'admin' | 'manager' | 'developer' | 'annotator' | 'viewer';
interface SelectedMember {
  user_id: number;
  username: string;
  full_name: string;
  role: MemberRole;
}

const ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'developer', label: 'Developer' },
  { value: 'annotator', label: 'Annotator' },
  { value: 'viewer', label: 'Viewer' },
];

const ROLE_COLORS: Record<MemberRole, { bg: string; color: string }> = {
  admin:   { bg: '#FEE2E2', color: '#DC2626' },
  manager: { bg: '#FEF3C7', color: '#D97706' },
  developer:  { bg: '#DBEAFE', color: '#2563EB' },
  annotator: { bg: '#F0F9FF', color: '#0EA5E9' },
  viewer: { bg: '#F3F4F6', color: '#6B7280' },
};

export function CreateWorkspaceModal({ isOpen, onClose }: CreateWorkspaceModalProps) {
  const { user: currentUser } = useAuth();
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceDescription, setWorkspaceDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<SelectedMember[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [showErrorBanner, setShowErrorBanner] = useState(false);
  const [skippedMembers, setSkippedMembers] = useState<{ user_id: number; reason: string }[]>([]);
  const queryClient = useQueryClient();

  // Fetch users list
  const { data: usersData } = useQuery({
    queryKey: ['users-for-workspace'],
    queryFn: () => usersApi.list(),
    enabled: isOpen,
  });

  if (!isOpen) return null;

  const allUsers = usersData?.results || [];

  // Filter out current user and already selected members
  const availableUsers = allUsers.filter((u: any) =>
    u.id !== currentUser?.id &&
    !selectedMembers.some((m) => m.user_id === u.id) &&
    (
      memberSearch === '' ||
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(memberSearch.toLowerCase()) ||
      u.username.toLowerCase().includes(memberSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(memberSearch.toLowerCase())
    )
  );

  const addMember = (user: any) => {
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
    setSelectedMembers((prev) => [
      ...prev,
      { user_id: user.id, username: user.username, full_name: fullName, role: 'viewer' },
    ]);
    setMemberSearch('');
    setShowMemberDropdown(false);
  };

  const removeMember = (userId: number) => {
    setSelectedMembers((prev) => prev.filter((m) => m.user_id !== userId));
  };

  const updateMemberRole = (userId: number, role: MemberRole) => {
    setSelectedMembers((prev) =>
      prev.map((m) => (m.user_id === userId ? { ...m, role } : m))
    );
  };

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!workspaceName.trim()) {
      setError('Workspace name is required');
      setShowErrorBanner(true);
      return;
    }

    setIsLoading(true);
    setError('');
    setShowErrorBanner(false);
    setShowSuccessBanner(false);
    setSkippedMembers([]);

    try {
      // Build payload with members
      const payload: any = {
        name: workspaceName.trim(),
        ...(workspaceDescription.trim() && { description: workspaceDescription.trim() }),
        ...(selectedMembers.length > 0 && {
          members: selectedMembers.map((m) => ({
            user_id: m.user_id,
            role: m.role,
          })),
        }),
      };

      const response = await workspaceApi.createWorkspace(
        payload.name,
        payload.description,
        payload.members,
      );

      console.log('✅ Workspace created:', response);

      // Show skipped members if any
      if (response.members_skipped?.length > 0) {
        setSkippedMembers(response.members_skipped);
      }

      setShowSuccessBanner(true);
      setShowErrorBanner(false);

      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });

      // Switch to the new workspace
      const newId = response.id || response.workspace?.id;
      if (newId) {
        localStorage.setItem('active_workspace_id', String(newId));
        await workspaceApi.switchWorkspace(newId);
      }

      // Close modal after 2 seconds and reload
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 2000);

    } catch (error: any) {
      console.error('Failed to create workspace:', error);

      let errorMessage = 'Failed to create workspace';
      if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.data) {
        const errorData = error.response.data;
        if (errorData.name && Array.isArray(errorData.name)) {
          errorMessage = errorData.name[0];
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (typeof errorData === 'string') {
          errorMessage = errorData;
        }
      }

      setError(errorMessage);
      setShowSuccessBanner(false);
      setShowErrorBanner(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setWorkspaceName('');
    setWorkspaceDescription('');
    setSelectedMembers([]);
    setMemberSearch('');
    setShowMemberDropdown(false);
    setError('');
    setShowSuccessBanner(false);
    setShowErrorBanner(false);
    setSkippedMembers([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl flex flex-col" style={{ width: 540, maxWidth: '90vw', maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Plus className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Create New Workspace</h2>
              <p className="text-sm text-gray-500">Add a new workspace and invite members</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">

          {/* Success Banner */}
          {showSuccessBanner && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800 font-medium">
                ✅ Workspace created successfully! Redirecting...
              </p>
              {skippedMembers.length > 0 && (
                <p className="text-xs text-yellow-700 mt-1">
                  ⚠️ {skippedMembers.length} member(s) could not be added (not in your organization).
                </p>
              )}
            </div>
          )}

          {/* Error Banner */}
          {showErrorBanner && error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 font-medium">❌ {error}</p>
            </div>
          )}

          <div className="space-y-5">
            {/* Workspace Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Workspace Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="e.g., Marketing Team, Engineering"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-gray-400">(Optional)</span>
              </label>
              <textarea
                value={workspaceDescription}
                onChange={(e) => setWorkspaceDescription(e.target.value)}
                placeholder="Brief description of this workspace"
                rows={2}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                disabled={isLoading}
              />
            </div>

            {/* Add Members */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  Add Members <span className="text-gray-400">(Optional)</span>
                </div>
              </label>

              {/* Member search dropdown */}
              <div className="relative">
                <div
                  className="flex items-center gap-2 w-full px-4 py-3 border border-gray-300 rounded-lg cursor-text focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent"
                  onClick={() => setShowMemberDropdown(true)}
                >
                  <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => { setMemberSearch(e.target.value); setShowMemberDropdown(true); }}
                    onFocus={() => setShowMemberDropdown(true)}
                    placeholder="Search by name or email..."
                    className="flex-1 outline-none text-sm bg-transparent"
                    disabled={isLoading}
                  />
                </div>

                {/* Dropdown list */}
                {showMemberDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMemberDropdown(false)} />
                    <div className="absolute top-full mt-1 left-0 right-0 z-20 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                      {availableUsers.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500 text-center">
                          {memberSearch ? 'No users found' : 'All users already added'}
                        </div>
                      ) : (
                        availableUsers.map((user: any) => {
                          const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
                          return (
                            <div
                              key={user.id}
                              onClick={() => addMember(user)}
                              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
                            >
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-xs flex-shrink-0">
                                {getInitials(fullName)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{fullName}</p>
                                <p className="text-xs text-gray-500 truncate">{user.email}</p>
                              </div>
                              <span className="text-xs text-gray-400 capitalize">{user.role}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Selected Members List */}
              {selectedMembers.length > 0 && (
                <div className="mt-3 space-y-2">
                  {selectedMembers.map((member) => (
                    <div
                      key={member.user_id}
                      className="flex items-center gap-3 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg"
                    >
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-xs flex-shrink-0">
                        {getInitials(member.full_name)}
                      </div>

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{member.full_name}</p>
                        <p className="text-xs text-gray-500">@{member.username}</p>
                      </div>

                      {/* Role Dropdown */}
                      <div className="relative flex-shrink-0">
                        <select
                          value={member.role}
                          onChange={(e) => updateMemberRole(member.user_id, e.target.value as MemberRole)}
                          disabled={isLoading}
                          className="text-xs font-medium px-2 py-1 rounded-md border-0 cursor-pointer outline-none"
                          style={{
                            background: ROLE_COLORS[member.role].bg,
                            color: ROLE_COLORS[member.role].color,
                          }}
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() => removeMember(member.user_id)}
                        disabled={isLoading}
                        className="p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {selectedMembers.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  {selectedMembers.length} member{selectedMembers.length > 1 ? 's' : ''} will be added
                </p>
              )}
            </div>

            {/* Info note */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">
                <strong>Note:</strong> You will automatically become the admin of this workspace.
                Members can be added or changed later from workspace settings.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-xl flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !workspaceName.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Create Workspace
                {selectedMembers.length > 0 && ` + ${selectedMembers.length} member${selectedMembers.length > 1 ? 's' : ''}`}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}