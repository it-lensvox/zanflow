import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Tag, X, Search, Plus, Trash2 } from 'lucide-react';
import { API_URL } from '@/services/api';

interface TagSelectorModalProps {
  isOpen:        boolean;
  onClose:       () => void;
  availableTags: any[];
  selectedCount: number;
  onConfirm:     (tagIds: number[]) => void;
  projects:      any[];
}

export function TagSelectorModal({ isOpen, onClose, availableTags, selectedCount, onConfirm, projects }: TagSelectorModalProps) {
  const queryClient = useQueryClient();
  const { data: freshLabels, refetch: refetchLabels } = useQuery({
    queryKey: ['labels-modal'],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const workspaceId = localStorage.getItem('active_workspace_id');
      const response = await fetch(`${API_URL}/documents/labels/`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'X-Workspace-ID': workspaceId || '' }
      });
      if (!response.ok) throw new Error('Failed to fetch labels');
      const data = await response.json();
      return data.results || data || [];
    },
    enabled: isOpen, staleTime: 0, refetchOnMount: true,
  });

  const [selectedTags,   setSelectedTags]   = useState<number[]>([]);
  const [searchTerm,     setSearchTerm]     = useState('');
  const [isSubmitting,   setIsSubmitting]   = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [deletingLabelId, setDeletingLabelId] = useState<number | null>(null);
  const [deleteConfirm,  setDeleteConfirm]  = useState<{ id: number; name: string } | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newLabelName,   setNewLabelName]   = useState('');
  const [newLabelColor,  setNewLabelColor]  = useState('#3B82F6');
  const [isCreating,     setIsCreating]     = useState(false);

  React.useEffect(() => {
    if (isOpen) { setSelectedTags([]); setSearchTerm(''); setSuccessMessage(''); setIsSubmitting(false); }
  }, [isOpen]);

  const handleDeleteLabel = async (tagId: number, tagName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm({ id: tagId, name: tagName });
  };

  const confirmDeleteLabel = async () => {
    if (!deleteConfirm) return;
    const { id: tagId, name: tagName } = deleteConfirm;
    setDeleteConfirm(null); setDeletingLabelId(tagId);
    try {
      const token = localStorage.getItem('access_token');
      const workspaceId = localStorage.getItem('active_workspace_id');
      const response = await fetch(`${API_URL}/documents/labels/${tagId}/`, {
        method: 'DELETE', credentials: 'include',
        headers: { 'Authorization': `Bearer ${token}`, 'X-Workspace-ID': workspaceId || '' },
      });
      if (response.ok || response.status === 204) {
        await refetchLabels(); await queryClient.invalidateQueries({ queryKey: ['labels'] });
        setSuccessMessage(`Label "${tagName}" deleted successfully`);
        setTimeout(() => setSuccessMessage(''), 3000);
        setSelectedTags(prev => prev.filter(id => id !== tagId));
      } else {
        const err = await response.json().catch(() => ({}));
        setSuccessMessage(`Failed: ${err.detail || 'Failed to delete label'}`);
      }
    } catch (error: any) { setSuccessMessage(`Failed: ${error.message || 'Failed to delete label'}`); }
    finally { setDeletingLabelId(null); }
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) { alert('Please enter a label name'); return; }
    setIsCreating(true);
    try {
      const token = localStorage.getItem('access_token');
      const workspaceId = localStorage.getItem('active_workspace_id');
      const urlParams = new URLSearchParams(window.location.search);
      const projectIdFromUrl = urlParams.get('project');
      let currentProjectId: number | null = projectIdFromUrl ? Number(projectIdFromUrl) : null;
      if (!currentProjectId && projects?.length > 0) {
        const first = Array.isArray(projects) ? projects[0] : (projects as any)?.results?.[0];
        currentProjectId = first?.id || null;
      }
      if (!currentProjectId) { setSuccessMessage('Failed: No project available. Please select a project first.'); setIsCreating(false); return; }
      const response = await fetch(`${API_URL}/documents/labels/`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'X-Workspace-ID': workspaceId || '' },
        body: JSON.stringify({ project: currentProjectId, name: newLabelName.trim(), color: newLabelColor })
      });
      if (!response.ok) {
        const errorData = await response.json();
        const msg = errorData.name?.[0] || errorData.project?.[0] ? `Project error: ${errorData.project[0]}` : errorData.detail || JSON.stringify(errorData);
        throw new Error(msg);
      }
      const newLabel = await response.json();
      await refetchLabels(); await queryClient.invalidateQueries({ queryKey: ['labels'] });
      await new Promise(r => setTimeout(r, 300));
      setNewLabelName(''); setNewLabelColor('#3B82F6'); setShowCreateForm(false);
      setSuccessMessage(`Label "${newLabel.name}" created! You can now select it.`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) { setSuccessMessage(`Failed: ${error.message || 'Failed to create label'}`); }
    finally { setIsCreating(false); }
  };

  if (!isOpen) return null;
  const labelsToUse: any[] = freshLabels || availableTags || [];
  const filteredTags = labelsToUse.filter((t: any) => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const toggleTag = (tagId: number) => setSelectedTags(prev => prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]);

  const isError = (msg: string) => msg.toLowerCase().includes('failed') || msg.toLowerCase().includes('error');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="relative w-full max-w-[520px] rounded-xl shadow-2xl" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #e5e7eb' }}>
          <div className="flex items-center gap-2"><Tag className="w-5 h-5" style={{ color: '#4169FF' }} /><span style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>Add Tags to {selectedCount} Document{selectedCount !== 1 ? 's' : ''}</span></div>
          <button onClick={onClose} style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X className="w-5 h-5" /></button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div className="relative">
            <Search className="absolute h-4 w-4" style={{ left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
            <input type="text" placeholder="Search tags..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '10px 40px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, outline: 'none' }}
              onFocus={e => e.currentTarget.style.borderColor = '#4169FF'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
          </div>
          <button onClick={() => setShowCreateForm(!showCreateForm)} className="w-full mb-4 py-2 px-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-500 transition-colors flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" />Create New Label
          </button>
          {showCreateForm && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="space-y-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Label Name</label><input type="text" value={newLabelName} onChange={e => setNewLabelName(e.target.value)} placeholder="e.g., Review, Contract, Legal" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Color</label><div className="flex gap-2 items-center"><input type="color" value={newLabelColor} onChange={e => setNewLabelColor(e.target.value)} className="w-12 h-10 rounded cursor-pointer" /><input type="text" value={newLabelColor} onChange={e => setNewLabelColor(e.target.value)} placeholder="#3B82F6" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg" /></div></div>
                <div className="flex gap-2">
                  <button onClick={handleCreateLabel} disabled={isCreating || !newLabelName.trim()} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">{isCreating ? 'Creating...' : 'Create'}</button>
                  <button onClick={() => { setShowCreateForm(false); setNewLabelName(''); setNewLabelColor('#3B82F6'); }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                </div>
              </div>
            </div>
          )}
          <div className="text-sm font-semibold text-gray-700 mb-2">AVAILABLE TAGS</div>
          {successMessage && (
            <div className="rounded-lg" style={{ padding: '12px 16px', background: isError(successMessage) ? '#FEF2F2' : '#D1FAE5', border: `1px solid ${isError(successMessage) ? '#FECACA' : '#10B981'}`, marginBottom: 16 }}>
              <div className="flex items-center gap-2">
                {isError(successMessage)
                  ? <svg className="w-5 h-5" fill="none" stroke="#DC2626" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  : <svg className="w-5 h-5" fill="none" stroke="#10B981" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                }
                <p style={{ fontSize: 14, fontWeight: 500, color: isError(successMessage) ? '#991B1B' : '#065F46', margin: 0 }}>{successMessage.replace(/^[❌✓]\s*/, '')}</p>
              </div>
            </div>
          )}
          {selectedTags.length > 0 && (
            <div className="rounded-lg" style={{ padding: '12px 16px', background: '#EEF2FF', border: '1px solid #c7d2fe' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>SELECTED ({selectedTags.length})</p>
              <div className="flex flex-wrap gap-2">
                {selectedTags.map(tagId => {
                  const tag = labelsToUse.find(t => t.id === tagId); if (!tag) return null;
                  return <span key={tagId} className="inline-flex items-center gap-2 rounded-md" style={{ padding: '6px 12px', fontSize: 13, fontWeight: 500, background: tag.color || '#7C3AED', color: '#fff', cursor: 'pointer' }} onClick={() => toggleTag(tagId)}>{tag.name}<X className="w-3 h-3" /></span>;
                })}
              </div>
            </div>
          )}
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AVAILABLE TAGS</p>
            <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 300 }}>
              {filteredTags.length > 0 ? filteredTags.map(tag => {
                const isSelected = selectedTags.includes(tag.id);
                return (
                  <div key={tag.id} onClick={() => toggleTag(tag.id)} className="flex items-center gap-3 rounded-lg cursor-pointer" style={{ padding: '12px 16px', border: `2px solid ${isSelected ? '#4169FF' : '#e5e7eb'}`, background: isSelected ? '#EEF2FF' : '#fff', transition: 'all 0.2s' }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f9fafb'; }} onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = '#fff'; }}>
                    <input type="checkbox" checked={isSelected} onChange={() => {}} onClick={e => e.stopPropagation()} style={{ accentColor: '#4169FF', width: 18, height: 18, cursor: 'pointer' }} />
                    <span className="inline-flex rounded-md flex-1" style={{ padding: '6px 12px', fontSize: 13, fontWeight: 500, background: tag.color || '#7C3AED', color: '#fff' }}>{tag.name}</span>
                    <button onClick={e => handleDeleteLabel(tag.id, tag.name, e)} disabled={deletingLabelId === tag.id} title="Delete label"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, color: '#ef4444', display: 'flex', alignItems: 'center', flexShrink: 0, opacity: deletingLabelId === tag.id ? 0.5 : 1 }}
                      onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      {deletingLabelId === tag.id ? <div style={{ width: 14, height: 14, border: '2px solid #ef4444', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                );
              }) : (
                <div className="flex flex-col items-center justify-center py-12 text-center" style={{ color: '#6b7280' }}>
                  <Tag className="w-10 h-10 mb-3" style={{ color: '#e5e7eb' }} />
                  <p style={{ fontSize: 14, fontWeight: 500 }}>No tags found</p>
                  <p style={{ fontSize: 12, marginTop: 4 }}>{searchTerm ? 'Try a different search term' : 'Ask your admin to create tags first'}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Delete confirm sub-modal */}
        {deleteConfirm && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}>
            <div className="bg-white rounded-xl shadow-xl p-6 mx-4 w-full max-w-sm">
              <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0"><Trash2 className="w-5 h-5 text-red-600" /></div><div><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>Delete Label</h3><p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>This cannot be undone</p></div></div>
              <p style={{ fontSize: 14, color: '#374151', marginBottom: 20 }}>Are you sure you want to delete <strong>"{deleteConfirm.name}"</strong>? It will be removed from all documents.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, height: 38, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', color: '#374151' }}>Cancel</button>
                <button onClick={confirmDeleteLabel} style={{ flex: 1, height: 38, border: 'none', borderRadius: 8, background: '#EF4444', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#fff' }}>Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid #e5e7eb' }}>
          <button onClick={onClose} className="rounded-lg" style={{ padding: '8px 20px', border: '1px solid #e5e7eb', background: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', color: '#1a1a1a' }}>Cancel</button>
          <button
            onClick={async () => {
              if (selectedTags.length === 0) { alert('Please select at least one tag'); return; }
              setIsSubmitting(true); setSuccessMessage('');
              try { await onConfirm(selectedTags); setSuccessMessage(`Successfully added ${selectedTags.length} tag(s) to ${selectedCount} document(s)!`); setTimeout(() => onClose(), 2000); }
              catch (error: any) { setSuccessMessage(` ${error.message || 'Failed to add tags'}`); }
              finally { setIsSubmitting(false); }
            }}
            disabled={selectedTags.length === 0 || isSubmitting}
            style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: selectedTags.length === 0 || isSubmitting ? '#D1D5DB' : '#4169FF', color: '#fff', fontSize: 14, fontWeight: 600, cursor: selectedTags.length === 0 || isSubmitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag className="w-4 h-4" />{isSubmitting ? 'Adding...' : `Add ${selectedTags.length > 0 ? selectedTags.length : ''} Tag${selectedTags.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}