import React from 'react';
import { BarChart3 } from 'lucide-react';
import type { ProjectDistributionItem } from '../index';
import { LINE, TEXT, MUTED, BLUE } from '@/config/tokens';

const ACCENT_PALETTE = ['#1663f6', '#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

interface Props {
  data:       ProjectDistributionItem[];
  totalTasks: number;
}

export function ProjectDistribution({ data, totalTasks }: Props) {
  if (!data.length) {
    return (
      <div style={{ ...CARD, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
        <BarChart3 size={28} color={MUTED} style={{ marginBottom: 8, opacity: .4 }} />
        <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>No project data yet</p>
      </div>
    );
  }

  return (
    <div style={CARD}>
      <SectionHeader icon={<BarChart3 size={15} />} title="Project Distribution" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {data.map((p, i) => {
          const pct = totalTasks > 0 ? Math.round((p.task_count / totalTasks) * 100) : 0;
          const color = ACCENT_PALETTE[i % ACCENT_PALETTE.length];
          return (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                  {p.project_name}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: TEXT, flexShrink: 0 }}>
                  {p.task_count} <span style={{ fontWeight: 400, color: MUTED }}>tasks</span>
                </span>
              </div>
              <div style={{ height: 6, background: 'hsl(var(--muted))', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width .5s' }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ borderTop: `1px solid ${LINE}`, marginTop: 16, paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: MUTED }}>Total tasks assigned</span>
        <span style={{ fontSize: 20, fontWeight: 800, color: TEXT }}>{totalTasks}</span>
      </div>
    </div>
  );
}

const CARD: React.CSSProperties = {
  background: 'hsl(var(--card))',
  border: `1px solid ${LINE}`,
  borderRadius: 14,
  padding: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,.06)',
};

export function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: `${BLUE}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: BLUE }}>
        {icon}
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: TEXT, letterSpacing: '-.01em' }}>{title}</span>
    </div>
  );
}