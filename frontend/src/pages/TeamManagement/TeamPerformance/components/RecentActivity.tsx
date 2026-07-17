import React from 'react';
import { Activity } from 'lucide-react';
import { getStatusColors } from '@/config/statusColors';
import { formatRelativeTime } from '@/lib/utils';
import type { RecentActivityItem } from '../index';
import { MUTED, TEXT, LINE } from '@/config/tokens';
import { SectionHeader } from './ProjectDistribution';

interface Props {
  activities: RecentActivityItem[];
}

export function RecentActivity({ activities }: Props) {
  const items = activities.slice(0, 8);

  if (!items.length) {
    return (
      <div style={CARD_STYLE}>
        <SectionHeader icon={<Activity size={15} />} title="Recent Activity" />
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <Activity size={28} color={MUTED} style={{ marginBottom: 8, opacity: .4 }} />
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>No recent activity</p>
        </div>
      </div>
    );
  }

  return (
    <div style={CARD_STYLE}>
      <SectionHeader icon={<Activity size={15} />} title="Recent Activity" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {items.map((a, i) => {
          const sc = getStatusColors(a.status);
          const isLast = i === items.length - 1;
          return (
            <div key={i} style={{ display: 'flex', gap: 12 }}>
              {/* Timeline */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 16, flexShrink: 0 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: sc.dot, flexShrink: 0, marginTop: 4 }} />
                {!isLast && <div style={{ width: 1.5, flex: 1, background: LINE, marginTop: 4 }} />}
              </div>

              {/* Content */}
              <div style={{ flex: 1, paddingBottom: isLast ? 0 : 16, minWidth: 0 }}>
                <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.task_name}
                </p>
                <p style={{ margin: '0 0 5px', fontSize: 11, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.project_name}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                    background: sc.bg, color: sc.text, textTransform: 'capitalize',
                  }}>
                    {a.status.replace('_', ' ')}
                  </span>
                  <span style={{ fontSize: 10, color: MUTED }}>
                    {formatRelativeTime(a.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const CARD_STYLE: React.CSSProperties = {
  background: 'hsl(var(--card))',
  border: `1px solid ${LINE}`,
  borderRadius: 14,
  padding: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,.06)',
};