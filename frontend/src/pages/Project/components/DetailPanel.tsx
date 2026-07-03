import { useState } from 'react';
import { ExternalLink, MoreHorizontal, Clock, FileText } from 'lucide-react';
import type { Project } from '@/types';
import { formatRelativeTime } from '@/lib/utils';
import { LINE, TEXT, MUTED } from '@/config/tokens';
import { getTypeHex, getTypeBg } from '@/config/projectTypeConfig';
import { StatusPill, TypePill, MemberAvatars } from './ProjectPills';

interface DetailPanelProps {
  project: Project;
  onClose: () => void;
  onOpen: () => void;
}

export function DetailPanel({ project, onClose, onOpen }: DetailPanelProps) {
  const [tab, setTab] = useState<'overview' | 'activity' | 'files'>('overview');
  const members    = (project as any).members || [];
  const accentHex  = getTypeHex((project as any).task_type);
  const tintBg     = getTypeBg((project as any).task_type);
  const lightAccent = `${accentHex}cc`;

  return (
    <div style={{ width: 305, minWidth: 305, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, padding: '18px 14px', overflow: 'auto', flexShrink: 0, boxShadow: '0 2px 8px rgba(16,24,40,.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: TEXT, lineHeight: 1.3, flex: 1, paddingRight: 8 }}>{project.name}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 22, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
      </div>

      {/* Folder art */}
      <div style={{ height: 128, margin: '20px 0 12px', borderRadius: 8, background: tintBg, display: 'grid', placeItems: 'center' }}>
        <div style={{ width: 120, height: 74, borderRadius: 12, background: `linear-gradient(135deg, ${lightAccent}, ${accentHex})`, boxShadow: `0 12px 24px ${accentHex}33`, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', width: 55, height: 20, borderRadius: '9px 9px 0 0', left: 12, top: -15, background: lightAccent }} />
          <span style={{ fontSize: 34, color: 'white', position: 'relative', zIndex: 1 }}>▥</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 25, borderBottom: `1px solid ${LINE}`, marginBottom: 12 }}>
        {(['overview', 'activity', 'files'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: tab === t ? accentHex : MUTED, borderBottom: tab === t ? `3px solid ${accentHex}` : '3px solid transparent', paddingBottom: 10, textTransform: 'capitalize' }}>
            {t}{t === 'files' && <span style={{ background: '#f0f2f5', color: MUTED, borderRadius: 10, padding: '1px 6px', fontSize: 11, marginLeft: 4 }}>0</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div>
          {[
            { label: 'Project Type', value: <TypePill type={(project as any).task_type} /> },
            { label: 'Status',       value: <StatusPill status={(project as any).status} /> },
            { label: 'Documents',    value: <b style={{ fontSize: 12 }}>{(project as any).document_count ?? 0} docs</b> },
            { label: 'Owner',        value: <b style={{ fontSize: 12 }}>{(project as any).created_by?.full_name || 'N/A'}</b> },
            { label: 'Created',      value: <b style={{ fontSize: 12 }}>{project.created_at ? new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}</b> },
            { label: 'Updated',      value: <b style={{ fontSize: 12 }}>{formatRelativeTime(project.updated_at || '')}</b> },
            { label: 'Team',         value: <MemberAvatars members={members} max={4} /> },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', alignItems: 'center', minHeight: 31, fontSize: 12 }}>
              <span style={{ color: MUTED }}>{label}</span>
              <span>{value}</span>
            </div>
          ))}
          {project.description && (
            <p style={{ marginTop: 10, fontSize: 12, color: MUTED, lineHeight: 1.5 }}>{project.description}</p>
          )}
        </div>
      )}

      {tab === 'activity' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', color: MUTED, fontSize: 13, gap: 8 }}>
          <Clock style={{ opacity: 0.3 }} />No activity yet
        </div>
      )}

      {tab === 'files' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', color: MUTED, fontSize: 13, gap: 8 }}>
          <FileText style={{ opacity: 0.3 }} />No files attached
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button onClick={onOpen} style={{ flex: 1, height: 41, background: accentHex, color: '#fff', borderRadius: 7, border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <ExternalLink className="w-4 h-4" />Open Project
        </button>
        <button style={{ width: 45, border: `1px solid ${LINE}`, borderRadius: 7, background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
          <MoreHorizontal className="w-4 h-4" style={{ color: MUTED }} />
        </button>
      </div>
    </div>
  );
}