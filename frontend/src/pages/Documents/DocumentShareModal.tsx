import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Search, Share2, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/common';
import { documentsApi, usersApi, projectsApi } from '@/services/api';
import type { User as AppUser, Document } from '@/types';

interface DocumentShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document | null;
}

export function DocumentShareModal({ isOpen, onClose, document: doc }: DocumentShareModalProps) {
  const queryClient = useQueryClient();
  const [shareType, setShareType] = useState<'user' | 'project'>('user');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<{ id: number; label: string } | null>(null);
  const [selectedProject, setSelectedProject] = useState<{ id: number; label: string } | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['allUsers'],
    queryFn: usersApi.listAll,
    enabled: isOpen && shareType === 'user',
    select: (data: AppUser[]) =>
      data.map((user) => ({
        value: user.id,
        label: user.first_name && user.last_name
          ? `${user.first_name} ${user.last_name}`
          : user.username,
        email: user.email,
      })),
  });

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['allProjects'],
    queryFn: () => projectsApi.list(),
    enabled: isOpen && shareType === 'project',
    select: (data: any) => {
      const items = Array.isArray(data) ? data : data.results || [];
      return items.map((p: any) => ({
        value: p.id,
        label: p.name,
      }));
    },
  });

  const shareMutation = useMutation({
    mutationFn: ({ documentId, payload }: { documentId: string; payload: import('@/types').ShareDocumentPayload }) =>
      documentsApi.share(documentId, payload),
    onSuccess: (data) => {
      setSuccessMsg(data.detail || 'Document shared successfully!');
      setSelectedUser(null);
      setSearchQuery('');
      // Invalidate documents query so the list refreshes (shared doc moves to top via updated_at)
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      // Auto-close after brief delay
      setTimeout(() => {
        handleClose();
      }, 1500);
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to share document.');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: ({ documentId, payload }: { documentId: string; payload: { user_id?: number; project_id?: number } }) =>
      documentsApi.revokeShare(documentId, payload),
    onSuccess: () => {
      // ✅ Refresh document list so shared_with updates
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['documents-shared-with-me'] });
      setSuccessMsg('Access revoked successfully.');
      setTimeout(() => setSuccessMsg(''), 2000);
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to revoke access.');
    },
  });

  const handleClose = () => {
    setUserDropdownOpen(false);
    setProjectDropdownOpen(false);
    setSearchQuery('');
    setSelectedUser(null);
    setSelectedProject(null);
    setError('');
    setSuccessMsg('');
    onClose();
  };

  const handleShare = () => {
    if (!doc) return;
    if (shareType === 'user' && !selectedUser) return;
    if (shareType === 'project' && !selectedProject) return;
    
    setError('');
    setSuccessMsg('');
    
    const payload = shareType === 'user' 
      ? { user_id: selectedUser!.id }
      : { project_id: selectedProject!.id };
      
    shareMutation.mutate({ documentId: doc.id, payload });
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
        setProjectDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close modal on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  if (!isOpen || !doc) return null;

  const filteredUsers = usersData?.filter((u) =>
    u.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const filteredProjects = projectsData?.filter((p: any) =>
    p.label.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-md transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-[480px] bg-white rounded-xl shadow-2xl border border-gray-200 animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-800">Share Document</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Document name display */}
          <div className="text-sm text-gray-500">
            Sharing: <span className="font-medium text-gray-700">{doc.name}</span>
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

{successMsg && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700 border border-green-200">
              {successMsg}
            </div>
          )}

          {/* ✅ Currently Shared With section */}
          {doc.shared_with && doc.shared_with.length > 0 && (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                <Users className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-semibold text-gray-700">
                  Currently Shared With ({doc.shared_with.length})
                </span>
              </div>
              <div className="max-h-40 overflow-y-auto divide-y divide-gray-100">
                {doc.shared_with.map((user) => {
                  const name = user.full_name || user.username;
                  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                  const isRevoking = revokeMutation.isPending;
                  return (
                    <div key={user.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden flex-shrink-0"
                          style={{ background: user.avatar ? 'transparent' : '#4169FF' }}>
                          {user.avatar
                            ? <img src={user.avatar} alt={name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            : initials
                          }
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{name}</p>
                          <p className="text-xs text-gray-400">{user.username}</p>
                        </div>
                      </div>
                      {/* ✅ Revoke button */}
                      <button
                        onClick={() => {
                          if (!doc) return;
                          revokeMutation.mutate({
                            documentId: doc.id,
                            payload: { user_id: user.id },
                          });
                        }}
                        disabled={isRevoking}
                        title="Revoke access"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Revoke
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Share Type Selector */}

          {/* Share Type Selector */}
          <div className="flex items-center gap-4 mb-4">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
              <input
                type="radio"
                name="shareType"
                value="user"
                checked={shareType === 'user'}
                onChange={() => {
                  setShareType('user');
                  setSearchQuery('');
                }}
                className="text-blue-600 focus:ring-blue-500"
              />
              Share with User
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
              <input
                type="radio"
                name="shareType"
                value="project"
                checked={shareType === 'project'}
                onChange={() => {
                  setShareType('project');
                  setSearchQuery('');
                }}
                className="text-blue-600 focus:ring-blue-500"
              />
              Share with Project
            </label>
          </div>

          {/* User/Project selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Select {shareType === 'user' ? 'User' : 'Project'}
            </label>
            <div className="relative" ref={dropdownRef}>
              {/* Trigger / Input */}
              <div
                className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer"
                onClick={() => shareType === 'user' ? setUserDropdownOpen(!userDropdownOpen) : setProjectDropdownOpen(!projectDropdownOpen)}
              >
                {shareType === 'user' && selectedUser ? (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700">
                        {selectedUser.label.charAt(0)}
                      </div>
                      <span className="text-foreground">{selectedUser.label}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedUser(null);
                      }}
                      className="p-0.5 hover:bg-gray-100 rounded"
                    >
                      <X className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  </div>
                ) : shareType === 'project' && selectedProject ? (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-purple-100 flex items-center justify-center text-[10px] font-bold text-purple-700">
                        {selectedProject.label.charAt(0)}
                      </div>
                      <span className="text-foreground">{selectedProject.label}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProject(null);
                      }}
                      className="p-0.5 hover:bg-gray-100 rounded"
                    >
                      <X className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Click to select a {shareType}...</span>
                )}
              </div>

              {/* Dropdown */}
              {(userDropdownOpen || projectDropdownOpen) && (
                <div className="absolute z-[60] mt-1 w-full bg-popover border rounded-lg shadow-lg max-h-64 overflow-hidden">
                  {/* Search inside dropdown */}
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={`Search ${shareType}s...`}
                        className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>

                  {/* List */}
                  <div className="max-h-48 overflow-y-auto py-1">
                    {shareType === 'user' ? (
                      usersLoading ? (
                        <div className="px-3 py-4 text-sm text-gray-400 text-center">Loading users...</div>
                      ) : filteredUsers.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-gray-400 text-center">No users found</div>
                      ) : (
                        filteredUsers.map((user) => (
                          <div
                            key={user.value}
                            className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground text-sm ${
                              selectedUser?.id === user.value ? 'bg-accent/50' : ''
                            }`}
                            onClick={() => {
                              setSelectedUser({ id: user.value, label: user.label });
                              setUserDropdownOpen(false);
                              setSearchQuery('');
                            }}
                          >
                            <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-[11px] font-bold text-blue-700 flex-shrink-0">
                              {user.label.charAt(0)}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium truncate">{user.label}</span>
                              <span className="text-xs text-gray-400 truncate">{user.email}</span>
                            </div>
                            {selectedUser?.id === user.value && (
                              <svg className="w-4 h-4 text-blue-600 ml-auto flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        ))
                      )
                    ) : (
                      projectsLoading ? (
                        <div className="px-3 py-4 text-sm text-gray-400 text-center">Loading projects...</div>
                      ) : filteredProjects.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-gray-400 text-center">No projects found</div>
                      ) : (
                        filteredProjects.map((project: any) => (
                          <div
                            key={project.value}
                            className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground text-sm ${
                              selectedProject?.id === project.value ? 'bg-accent/50' : ''
                            }`}
                            onClick={() => {
                              setSelectedProject({ id: project.value, label: project.label });
                              setProjectDropdownOpen(false);
                              setSearchQuery('');
                            }}
                          >
                            <div className="h-7 w-7 rounded-full bg-purple-100 flex items-center justify-center text-[11px] font-bold text-purple-700 flex-shrink-0">
                              {project.label.charAt(0)}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium truncate">{project.label}</span>
                            </div>
                            {selectedProject?.id === project.value && (
                              <svg className="w-4 h-4 text-purple-600 ml-auto flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        ))
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <Button
            onClick={handleShare}
            disabled={(shareType === 'user' && !selectedUser) || (shareType === 'project' && !selectedProject) || shareMutation.isPending}
          >
            {shareMutation.isPending ? 'Sharing...' : 'Share'}
          </Button>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}