import { Star, FileText } from 'lucide-react';
import type { Project } from '@/types';
import { formatRelativeTime } from '@/lib/utils';
import { BLUE, LINE, TEXT, MUTED, projectColor } from '../projectConstants';
import { StatusPill, MemberAvatars } from './ProjectPills';

interface ProjectGridCardProps {
  project: Project;
  selected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onFav: (e: React.MouseEvent) => void;
  onClick: () => void;
}

export function ProjectGridCard({ project, selected, onSelect, onFav, onClick }: ProjectGridCardProps) {
  const color = projectColor(project.name);
  const members = (project as any).members || [];
  return (
    <div
      onClick={onClick}
      style={{ border: `1px solid ${selected ? BLUE : LINE}`, borderRadius: 10, padding: 16, background: selected ? '#f7faff' : '#fff', cursor: 'pointer', boxShadow: '0 2px 8px rgba(16,24,40,.03)', transition: 'box-shadow .2s, border-color .2s', position: 'relative', minWidth: 0, width: '100%' }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.boxShadow = '0 4px 16px rgba(16,24,40,.08)'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.boxShadow = '0 2px 8px rgba(16,24,40,.03)'; }}
    >
      <input type="checkbox" checked={selected} onClick={onSelect} onChange={() => {}} style={{ position: 'absolute', top: 14, left: 14, accentColor: BLUE, width: 15, height: 15, cursor: 'pointer' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, paddingLeft: 24 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: color, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
          {project.name[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: '0 0 3px', fontWeight: 700, fontSize: 14, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</p>
          <StatusPill status={(project as any).status} />
        </div>
        <Star onClick={onFav} className="w-4 h-4" style={{ color: (project as any).is_favourite ? '#f59e0b' : '#d1d5db', cursor: 'pointer', flexShrink: 0 }} />
      </div>
      {project.description && (
        <p style={{ margin: '0 0 10px', fontSize: 12, color: MUTED, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as any}>
          {project.description}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <span style={{ fontSize: 12, color: MUTED, display: 'flex', alignItems: 'center', gap: 4 }}>
          <FileText className="w-3.5 h-3.5" />{(project as any).document_count ?? 0} docs
        </span>
        <MemberAvatars members={members} />
        <span style={{ fontSize: 11, color: MUTED }}>{formatRelativeTime(project.updated_at || '')}</span>
      </div>
    </div>
  );
}