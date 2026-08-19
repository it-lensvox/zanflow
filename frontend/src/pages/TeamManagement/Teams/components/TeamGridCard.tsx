import React from 'react';
import { Star } from 'lucide-react';
import { TEXT, MUTED, LINE } from '@/config/tokens';
import { AvatarStack } from '@/components/ui/AvatarStack';
import { AddMembersDropdown } from './AddMembersDropdown';
import type { Team } from '@/types';

interface TeamGridCardProps {
  team: Team;
  onToggleFavorite: (e: React.MouseEvent, team: Team) => void;
  onMemberAdded: () => void;
  onDelete: (team: Team) => void;
}

const BLUE = '#1663f6';

export function TeamGridCard({ team, onToggleFavorite, onMemberAdded, onDelete }: TeamGridCardProps) {
  const initial = (team.name?.[0] || '?').toUpperCase();

  return (
    <div
      style={{
        background: 'hsl(var(--card))',
        border: `1px solid ${LINE}`,
        borderRadius: 14,
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative',
        minWidth: 0,
        width: '100%',
        boxShadow: '0 1px 4px rgba(16,24,40,.06)',
        transition: 'box-shadow .2s, border-color .2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,.12)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(16,24,40,.06)'; }}
      className="group"
    >
      {/* ── Top accent bar */}
      <div style={{ height: 4, background: BLUE, width: '100%', flexShrink: 0 }} />

      <div style={{ padding: '14px 16px 16px' }}>

        {/* ── Row 1: Avatar initial + Name + Favourite */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `${BLUE}18`, border: `1px solid ${BLUE}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: BLUE, flexShrink: 0,
          }}>
            {initial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              margin: 0, fontSize: 14, fontWeight: 700, color: TEXT,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {team.name}
            </p>
            <span style={{ fontSize: 11, color: MUTED, textTransform: 'capitalize' }}>
              {team.team_type_display || team.team_type}
            </span>
          </div>
          <button
            type="button"
            onClick={e => onToggleFavorite(e, team)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}
          >
            <Star
              size={15}
              style={{ color: team.is_favourite ? '#f59e0b' : '#d1d5db', transition: 'color .15s' }}
              fill={team.is_favourite ? '#f59e0b' : 'none'}
            />
          </button>
        </div>

        {/* ── Divider */}
        <div style={{ height: 1, background: LINE, marginBottom: 10 }} />

        {/* ── Row 2: Member avatars (AvatarStack) + count + Add */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Same AvatarStack used in Project columns */}
            <AvatarStack members={team.members || []} max={3} size={22} emptyLabel="—" />
            <span style={{ fontSize: 12, color: MUTED }}>
              {team.member_count || 0} {team.member_count === 1 ? 'member' : 'members'}
            </span>
          </div>
          <AddMembersDropdown team={team} onMemberAdded={onMemberAdded} />
        </div>

        {/* ── Description (if present) */}
        {team.description && (
          <p style={{
            margin: '8px 0 0', fontSize: 12, color: MUTED,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {team.description}
          </p>
        )}

        {/* ── Footer: Delete (hover-only) */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button
            onClick={e => { e.stopPropagation(); onDelete(team); }}
            style={{
              fontSize: 11, color: '#ef4444', background: 'none',
              border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4,
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#ef444418'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}