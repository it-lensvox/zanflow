import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { projectsApi } from '@/services/api';

interface AttachProjectModalProps {
  isOpen:           boolean;
  onClose:          () => void;
  onAttach:         (projectId: number | null) => void;
  currentProjectId?: number | null;
}

export function AttachProjectModal({ isOpen, onClose, onAttach, currentProjectId }: AttachProjectModalProps) {
  const [projects,    setProjects]  = useState<import('@/types').ProjectMinimal[]>([]);
  const [loading,     setLoading]   = useState(false);
  const [selectedId,  setSelectedId] = useState<number | null>(currentProjectId ?? null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      projectsApi.list({ disable_pagination: true } as any)
        .then(res => setProjects(res.results || (res as any)))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  useEffect(() => { setSelectedId(currentProjectId ?? null); }, [currentProjectId, isOpen]);

  if (!isOpen) return null;

  const currentProject    = projects.find(p => p.id === currentProjectId);
  const remainingProjects = projects.filter(p => p.id !== currentProjectId);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-[400px] rounded-lg border border-border bg-card p-6 shadow-lg animate-in fade-in zoom-in-95 duration-200">
        <h2 className="text-lg font-semibold mb-4 text-foreground">Attach Note to Project</h2>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4 mb-6">
            {currentProject && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-md">
                <p className="text-[10px] text-green-500 font-bold uppercase tracking-wider mb-1">Currently Attached To</p>
                <p className="text-sm font-semibold text-foreground">{currentProject.name}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wider">
                {currentProject ? 'Change to another project' : 'Select a project'}
              </p>
              <div className="max-h-[200px] overflow-y-auto space-y-1 border border-border rounded-md p-1 bg-muted/20">
                <button onClick={() => setSelectedId(null)}
                  className={cn('w-full text-left px-3 py-2 text-sm rounded-md transition-colors', selectedId === null ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent text-foreground')}>
                  None (Make Personal Note)
                </button>
                {remainingProjects.map(p => (
                  <button key={p.id} onClick={() => setSelectedId(p.id)}
                    className={cn('w-full text-left px-3 py-2 text-sm rounded-md transition-colors', selectedId === p.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent text-foreground')}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent rounded-md transition-colors">Cancel</button>
          <button onClick={() => { onAttach(selectedId); onClose(); }} className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 rounded-md transition-colors">Confirm</button>
        </div>
      </div>
    </div>
  );
}