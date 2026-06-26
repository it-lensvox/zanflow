import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import { CARD, TEXT, MUTED, BLUE, BG, SkeletonBlock } from '../index';
import type { Document } from '@/types';

interface FileBadge {
  label: string;
  color: string;
  bg: string;
}

interface RecentActivityPanelProps {
  recentActivity: Document[];
  getFileBadge: (name: string) => FileBadge;
  handleDocumentClick: (doc: Document) => void;
  isLoading?: boolean;
}

export function RecentActivityPanel({ recentActivity, getFileBadge, handleDocumentClick, isLoading }: RecentActivityPanelProps) {
  return (
    <div style={{ ...CARD, padding: '20px 28px 20px 22px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Recent Activity</span>
        <Link to="/documents" style={{ fontSize: 13, fontWeight: 600, color: BLUE, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          View all <ArrowRight size={12} />
        </Link>
      </div>

      {/* List */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
         {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid #F3F4F6' }}>
              <div style={SkeletonBlock({ width: 40, height: 40, borderRadius: 8, style: { flexShrink: 0 } })} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={SkeletonBlock({ width: '65%', height: 14 })} />
                <div style={SkeletonBlock({ width: '40%', height: 11 })} />
              </div>
              <div style={SkeletonBlock({ width: 48, height: 11 })} />
            </div>
          ))}
        </div>
      ) : recentActivity.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: MUTED, fontSize: 14 }}>
          No recent activity
        </div>
      ) : (
        recentActivity.map((doc, i) => {
          const badge = getFileBadge(doc.name);
          return (
            <div
              key={doc.id}
              onClick={() => handleDocumentClick(doc)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: i < recentActivity.length - 1 ? '1px solid #F3F4F6' : 'none', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = BG)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* File type badge */}
              <div style={{ width: 40, height: 40, borderRadius: 8, background: badge.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: badge.color }}>{badge.label}</span>
              </div>

              {/* Name + project */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{doc.name}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Uploaded in {(doc as any).project_name || 'Workspace'}</div>
              </div>

              {/* Time */}
              <span style={{ fontSize: 12, color: MUTED, flexShrink: 0 }}>
                {doc.updated_at ? formatRelativeTime(doc.updated_at) : ''}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}