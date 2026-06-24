import { useState } from 'react';
import { ChevronRight, ChevronDown, FolderOpen, ArrowLeft, Folder } from 'lucide-react';
import type { Project } from '@/types';
import { BLUE, LINE, TEXT, MUTED, TREE_GROUPS, projectColor } from '../projectConstants';

interface TreePanelProps {
  projects: Project[];
  selected: number | null;
  selectedGroup: string | null;
  onSelect: (id: number | null) => void;
  onSelectGroup: (label: string | null) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function TreePanel({ projects, selected, selectedGroup, onSelect, onSelectGroup, isOpen, onToggle }: TreePanelProps) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (label: string) =>
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });

  const rowSt = (active: boolean): React.CSSProperties => ({
    height: 29, display: 'flex', alignItems: 'center', gap: 8,
    color: active ? BLUE : '#27354d', fontSize: 12, cursor: 'pointer',
    borderRadius: 6, padding: '0 8px',
    background: active ? '#edf4ff' : 'transparent',
    fontWeight: active ? 700 : 500,
  });

  if (!isOpen) return (
    <div style={{ width: 44, minWidth: 44, borderRight: `1px solid ${LINE}`, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16, flexShrink: 0 }}>
      <button onClick={onToggle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, padding: 4 }} title="Show Tree">
        <ChevronRight className="w-4 h-4" />
      </button>
      <div style={{ marginTop: 12, writingMode: 'vertical-rl', fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: '.05em' }}>Tree View</div>
    </div>
  );

  return (
    <div style={{ width: 250, minWidth: 250, borderRight: `1px solid ${LINE}`, background: '#fff', padding: 16, overflowY: 'auto', flexShrink: 0 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontWeight: 800, fontSize: 14, color: TEXT }}>Project Tree</span>
        <button onClick={onToggle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED }}>
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>

      {/* All Projects row */}
      <div style={rowSt(selected === null && selectedGroup === null)}
        onClick={() => { onSelect(null); onSelectGroup(null); }}>
        <Folder className="w-3.5 h-3.5" style={{ color: '#f59e0b', flexShrink: 0 }} />
        <span style={{ flex: 1, fontWeight: 700 }}>All Projects</span>
        <span style={{ color: MUTED, fontSize: 11 }}>{projects.length}</span>
      </div>

      {/* Category group folders */}
      <div style={{ marginTop: 6 }}>
        {TREE_GROUPS.map(group => {
          const groupProjects = projects.filter(p =>
            group.types.includes(((p as any).task_type || '').toLowerCase())
          );
          if (groupProjects.length === 0) return null;

          const groupIsOpen = openGroups.has(group.label);
          const isGroupSelected = selectedGroup === group.label && selected === null;

          return (
            <div key={group.label}>
              {/* Group folder row */}
              <div
                style={{ ...rowSt(isGroupSelected), justifyContent: 'space-between' }}
                onClick={() => {
                  onSelect(null);
                  onSelectGroup(isGroupSelected ? null : group.label);
                  toggleGroup(group.label);
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  {groupIsOpen
                    ? <ChevronDown className="w-3 h-3" style={{ color: MUTED, flexShrink: 0 }} />
                    : <ChevronRight className="w-3 h-3" style={{ color: MUTED, flexShrink: 0 }} />
                  }
                  {groupIsOpen
                    ? <FolderOpen className="w-3.5 h-3.5" style={{ color: group.color, flexShrink: 0 }} />
                    : <Folder className="w-3.5 h-3.5" style={{ color: group.color, flexShrink: 0 }} />
                  }
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {group.label}
                  </span>
                </div>
                <span style={{ color: MUTED, fontSize: 11, flexShrink: 0 }}>{groupProjects.length}</span>
              </div>

              {/* Individual projects inside this group */}
              {groupIsOpen && (
                <div style={{ paddingLeft: 20, marginTop: 2 }}>
                  {groupProjects.map(p => (
                    <div key={p.id}
                      style={rowSt(selected === p.id)}
                      onClick={e => {
                        e.stopPropagation();
                        onSelect(selected === p.id ? null : p.id);
                        onSelectGroup(null);
                      }}
                    >
                      <Folder className="w-3 h-3" style={{ color: projectColor(p.name), flexShrink: 0 }} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </span>
                      <span style={{ color: MUTED, fontSize: 11, flexShrink: 0 }}>
                        {(p as any).document_count ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}