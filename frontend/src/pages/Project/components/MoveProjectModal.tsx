import { useState } from 'react';
import type { Project } from '@/types';
import { projectsApi } from '@/services/api';
import { BLUE, LINE, TEXT, MUTED } from '@/config/tokens';
import { PROJECT_TYPE_OPTIONS as PROJECT_TYPES } from '@/config/projectTypeConfig';

interface MoveProjectModalProps {
  selectedIds: Set<number>;
  projects: Project[];
  onClose: () => void;
  onSuccess: () => void;
}

export function MoveProjectModal({ selectedIds, projects, onClose, onSuccess }: MoveProjectModalProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isMoving, setIsMoving]         = useState(false);
  const [error, setError]               = useState('');

  const selectedProjects = projects.filter(p => selectedIds.has(p.id));

  const handleMove = async () => {
    if (!selectedType) return;
    setIsMoving(true);
    setError('');
    try {
      await Promise.all(
        selectedProjects.map(p => projectsApi.update(p.id, { task_type: selectedType }))
      );
      onSuccess();
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to move projects. Please try again.');
      setIsMoving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: TEXT }}>Move to Project Type</h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: MUTED }}>
              Moving {selectedProjects.length} project{selectedProjects.length > 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 20 }}>✕</button>
        </div>

        {/* Selected projects preview */}
        <div style={{ padding: '12px 24px', background: '#f9fafb', borderBottom: `1px solid ${LINE}` }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Selected Projects</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {selectedProjects.map(p => (
              <span key={p.id} style={{ background: '#EEF2FF', color: BLUE, borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                {p.name}
              </span>
            ))}
          </div>
        </div>

        {/* Type options */}
        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select Destination</p>
          {PROJECT_TYPES.map(type => {
            const isSelected = selectedType === type.value;
            const isCurrent  = selectedProjects.every(p => (p as any).task_type === type.value);
            return (
              <div
                key={type.value}
                onClick={() => !isCurrent && setSelectedType(type.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 10, cursor: isCurrent ? 'not-allowed' : 'pointer',
                  border: `2px solid ${isSelected ? type.hex : LINE}`,
                  background: isSelected ? `${type.hex}10` : isCurrent ? '#f9fafb' : '#fff',
                  opacity: isCurrent ? 0.5 : 1,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: type.hex, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: TEXT }}>{type.label}</p>
                  <p style={{ margin: 0, fontSize: 12, color: MUTED }}>{type.description}</p>
                </div>
                {isCurrent  && <span style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>Current</span>}
               {isSelected && <span style={{ fontSize: 16, color: type.hex }}>✓</span>}
              </div>
            );
          })}
        </div>

        {/* Error */}
        {error && <p style={{ margin: '0 24px', fontSize: 13, color: '#ef4444' }}>{error}</p>}

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${LINE}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ height: 40, padding: '0 20px', borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: TEXT }}>
            Cancel
          </button>
          <button
            onClick={handleMove}
            disabled={!selectedType || isMoving}
            style={{ height: 40, padding: '0 20px', borderRadius: 8, border: 'none', background: selectedType ? BLUE : '#e5e7eb', color: selectedType ? '#fff' : MUTED, fontSize: 14, fontWeight: 700, cursor: selectedType ? 'pointer' : 'not-allowed' }}
          >
            {isMoving ? 'Moving...' : `Move ${selectedProjects.length} Project${selectedProjects.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}