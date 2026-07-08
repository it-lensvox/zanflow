import React, { useState } from 'react';
import { MoreHorizontal, CheckSquare } from 'lucide-react';
import type { Project } from '@/types';
import { formatRelativeTime } from '@/lib/utils';
import { TEXT, MUTED, LINE } from '@/config/tokens';
import { getTypeHex, getTypeBg } from '@/config/projectTypeConfig';
import { StatusPill, MemberAvatars } from './ProjectPills';
import { stripHtml } from '@/lib/utils';

interface ProjectGridCardProps {
  project: Project;
  selected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onFav: (e: React.MouseEvent) => void;
  onClick: () => void;
}

export function ProjectGridCard({ project, selected, onSelect, onFav, onClick }: ProjectGridCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const taskType = (project as any).task_type || '';
  const accentHex = getTypeHex(taskType);
  const tintBg = getTypeBg(taskType);
  const members = (project as any).members || [];
  const docCount = (project as any).document_count ?? 0;
  const initial = (project.name?.[0] || '?').toUpperCase();

  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        border: `1px solid ${selected ? accentHex : LINE}`,
        borderRadius: 14,
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative',
        minWidth: 0,
        width: '100%',
        boxShadow: selected
          ? `0 0 0 2px ${accentHex}33, 0 4px 16px rgba(16,24,40,.08)`
          : '0 1px 4px rgba(16,24,40,.06)',
        transition: 'box-shadow .2s, border-color .2s',
      }}
      onMouseEnter={e => {
        if (!selected) e.currentTarget.style.boxShadow = '0 4px 20px rgba(16,24,40,.12)';
      }}
      onMouseLeave={e => {
        if (!selected) e.currentTarget.style.boxShadow = '0 1px 4px rgba(16,24,40,.06)';
      }}
    >
      {/* ── Top accent bar */}
      <div style={{ height: 4, background: accentHex, width: '100%', flexShrink: 0 }} />

      {/* ── Card body ── */}
      <div style={{ padding: '14px 16px 16px' }}>

        {/* ── Row 1:  Name + Status + Menu ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>

          {/* Name + status */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              margin: '0 0 5px', fontWeight: 700, fontSize: 16,
              color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {project.name}
            </p>
            <StatusPill status={(project as any).status} />
          </div>

          {/* ··· menu */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '2px 4px', borderRadius: 6, color: MUTED,
                display: 'flex', alignItems: 'center',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F7F8FB')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <MoreHorizontal size={17} />
            </button>
            {menuOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={e => { e.stopPropagation(); setMenuOpen(false); }} />
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 50,
                  background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(16,24,40,.12)', minWidth: 160, overflow: 'hidden',
                }}>
                  {[
                    { label: 'Open Project', action: (e: React.MouseEvent) => { e.stopPropagation(); setMenuOpen(false); onClick(); } },
                    { label: (project as any).is_favourite ? 'Remove Favourite' : 'Add to Favourites', action: (e: React.MouseEvent) => { setMenuOpen(false); onFav(e); } },
                  ].map(item => (
                    <button key={item.label} onClick={item.action}
                      style={{ width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: TEXT, textAlign: 'left', fontFamily: 'inherit' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F7F8FB')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Description ── */}
        {project.description ? (
          <p style={{
            margin: '0 0 14px', fontSize: 13, color: MUTED,
            lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          } as React.CSSProperties}>
            {stripHtml(project.description)}
          </p>
        ) : (
          <div style={{ height: 8 }} />
        )}

        {/* ── Progress bar ── */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: MUTED, fontWeight: 500 }}>Progress</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: accentHex }}>
              {(project as any).completion_percentage ?? 0}%
            </span>
          </div>
          <div style={{ height: 6, background: '#F3F4F6', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min((project as any).completion_percentage ?? 0, 100)}%`,
              background: accentHex,
              borderRadius: 99,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>

        {/* ── Footer: members + task count + time ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>

          {/* Stacked member avatars */}
          <MemberAvatars members={members} max={4} />

          {/* Task count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: MUTED, fontSize: 13 }}>
            <CheckSquare size={13} />
            <span style={{ fontWeight: 600 }}>
              {(project as any).task_count ?? docCount} tasks
            </span>
          </div>

          {/* Updated time */}
          <span style={{ fontSize: 12, color: MUTED, whiteSpace: 'nowrap' }}>
            {formatRelativeTime(project.updated_at || '')}
          </span>
        </div>
      </div>
    </div>
  );
}