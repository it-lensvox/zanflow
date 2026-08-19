import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { workspaceApi } from '@/services/api';
import { ChevronDown, Check, Plus, Trash2, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

// ✅ Updated interface with created_by
interface Workspace {
  id: number;
  name: string;
  slug: string;
  description?: string;
  is_default: boolean;
  is_active: boolean;
  member_count: number;
  role: 'pm_admin' | 'workspace_admin' | 'workspace_member' | string;
  created_by?: number;
  created_at: string;
  updated_at: string;
}

interface WorkspaceSwitcherProps {
  onCreateWorkspace?: () => void;
}

export function WorkspaceSwitcher({ onCreateWorkspace }: WorkspaceSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspaceApi.getWorkspaces,
  });

  const workspaces = data?.workspaces || [];
  const activeWorkspaceId = data?.active_workspace_id || workspaceApi.getActiveWorkspaceId();
  const activeWorkspace = workspaces.find((w: Workspace) => w.id === activeWorkspaceId);

  useEffect(() => {
    if (workspaces.length > 0) {
    }
  }, [workspaces, user]);

  const handleSwitch = async (workspaceId: number) => {
    if (workspaceId === activeWorkspaceId) {
      setIsOpen(false);
      return;
    }

    setIsSwitching(true);

    try {
      await workspaceApi.switchWorkspace(workspaceId);
      window.location.reload();
    } catch (error: any) {
      console.error('❌ Failed to switch workspace:', error);
      alert(error.message || 'Failed to switch workspace');
      setIsSwitching(false);
    }
  };


  const handleDeleteClick = (workspace: Workspace, e: React.MouseEvent) => {
    e.stopPropagation();
    setWorkspaceToDelete(workspace);
    setShowDeleteConfirm(true);
    setIsOpen(false);
    setDeleteConfirmText('');
  };
  void handleDeleteClick;


  const handleDeleteConfirm = async () => {
    if (!workspaceToDelete) return;

    setIsDeleting(true);

    try {
      await workspaceApi.deleteWorkspace(workspaceToDelete.id);

      // If we deleted the active workspace, switch to default
      if (workspaceToDelete.id === activeWorkspaceId) {
        const defaultWorkspace = workspaces.find((w: Workspace) => w.is_default);
        if (defaultWorkspace) {
          localStorage.setItem('active_workspace_id', String(defaultWorkspace.id));
        }
      }

      setShowDeleteConfirm(false);
      setWorkspaceToDelete(null);

      // Refetch workspaces and reload
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      window.location.reload();

    } catch (error: any) {
      console.error('❌ Failed to delete workspace:', error);
      alert(error.message || 'Failed to delete workspace');
    } finally {
      setIsDeleting(false);
    }
  };

  const canDeleteWorkspace = (workspace: Workspace): boolean => {
    if (workspace.is_default) return false;
    if (workspace.created_by && user?.id) return workspace.created_by === user.id;
    return false;
  };
  void canDeleteWorkspace;

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
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Dropdown Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isSwitching}
          className="flex items-center justify-between w-full gap-2 bg-card hover:bg-accent transition-colors disabled:opacity-50 text-sm"
        >
          <span className="font-medium truncate">
            {isSwitching ? 'Switching...' : isLoading ? 'Loading...' : (activeWorkspace?.name || 'Select Workspace')}
          </span>
          <ChevronDown className="w-18 h-4 text-muted-foreground flex-shrink-0" />
        </button>

        {/* Dropdown Menu - Opens UPWARD */}
        {isOpen && (
          <div
            className="absolute left-0 right-0 bg-popover border border-border rounded-lg shadow-xl overflow-hidden"
            style={{
              top: 'calc(100% + 8px)',
              zIndex: 9999,
              width: '240px'
            }}
          >
            {isLoading ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">Loading workspaces...</div>
            ) : error ? (
              <div className="px-4 py-3 text-sm text-red-600">Failed to load workspaces</div>
            ) : workspaces.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">No workspaces found</div>
            ) : (
              <>
                {/* Workspace List */}
                <div className="max-h-[180px] overflow-y-auto">
                  {workspaces.map((workspace: Workspace) => {
                    const isActive = workspace.id === activeWorkspaceId;

                    return (
                      <div
                        key={workspace.id}
                        className="relative group"
                      >
                        <button
                          onClick={() => handleSwitch(workspace.id)}
                          disabled={isSwitching}
                          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-accent transition-colors border-b border-border last:border-b-0 text-left disabled:opacity-50"
                        >
                          <div className="flex-1 min-w-0 pr-8">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">
                                {workspace.name}
                              </span>
                              {workspace.is_default && (
                                <span className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                                  Default
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Users className="w-2.5 h-2.5 text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground">
                                {workspace.member_count} members
                              </span>
                              <span className="text-[10px] text-muted-foreground">·</span>
                              <span className="text-[10px] text-muted-foreground capitalize">
                                {workspace.role}
                              </span>
                            </div>
                          </div>
                          {isActive && (
                            <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          )}
                        </button>


                        {/* {canDelete && (
                          <button
                            onClick={(e) => handleDeleteClick(workspace, e)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-all"
                            title="Delete workspace"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )} */}
                      </div>
                    );
                  })}
                </div>


                {activeWorkspace && ['pm_admin', 'workspace_admin'].includes(activeWorkspace.role) && (
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onCreateWorkspace?.();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-white bg-[#1663f6] hover:bg-[#0f4bd4] transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span>New Workspace</span>
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && workspaceToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
          <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Delete Workspace?</h3>
                <p className="text-sm text-muted-foreground">This action cannot be undone</p>
              </div>
            </div>

            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 font-medium mb-2">
                You are about to permanently delete "{workspaceToDelete.name}"
              </p>
              <p className="text-xs text-red-700">
                This will permanently delete:
              </p>
              <ul className="text-xs text-red-700 list-disc list-inside mt-1 space-y-0.5">
                <li>All projects in this workspace</li>
                <li>All tasks and documents</li>
                <li>All team data and chat rooms</li>
                <li>All workspace members will lose access</li>
              </ul>
            </div>

            {/* ✅ Confirmation Input Section */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-foreground mb-2">
                Type <span className="font-semibold text-red-600">"{workspaceToDelete.name}"</span> to confirm:
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={workspaceToDelete.name}
                  className="w-full px-3 py-2 pr-10 border border-border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm bg-input text-foreground"
                  autoFocus
                />
                {/* ✅ Validation Icon */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {deleteConfirmText.length > 0 && (
                    <>
                      {deleteConfirmText === workspaceToDelete.name ? (
                        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              {deleteConfirmText.length > 0 && deleteConfirmText !== workspaceToDelete.name && (
                <p className="mt-1 text-xs text-red-600">
                  Workspace name does not match
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setWorkspaceToDelete(null);
                  setDeleteConfirmText('');
                }}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground bg-muted hover:bg-accent transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting || deleteConfirmText !== workspaceToDelete.name}
                className="flex-1 px-4 py-2 bg-red-600 rounded-lg text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Permanently
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}