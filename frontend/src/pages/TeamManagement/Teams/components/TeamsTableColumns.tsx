import React from 'react';
import { Star, Trash2 } from 'lucide-react';
import { TEXT, LINE } from '@/config/tokens';
import { TeamMembersList }    from './TeamMembersList';
import { AddMembersDropdown } from './AddMembersDropdown';
import type { Team } from '@/types';
import type { TableColumn } from '@/components/layout/DualView';

const BLUE = '#1663f6';

// ── Shared th/td style — matches Projects table exactly
export const th: React.CSSProperties = {
  textAlign: 'left',
  color: 'hsl(var(--foreground))',
  fontSize: 13,
  fontWeight: 800,
  padding: '13px 16px',
  borderBottom: `1px solid ${LINE}`,
  borderRight: `1px solid ${LINE}`,
  background: 'hsl(var(--muted))',
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 0,
  zIndex: 1,
};

export const td: React.CSSProperties = {
  padding: '13px 16px',
  borderBottom: `1px solid ${LINE}`,
  borderRight: `1px solid ${LINE}`,
  verticalAlign: 'middle',
  fontSize: 13,
  color: TEXT,
};

export function getTeamsTableColumns(
  onToggleFavorite: (e: React.MouseEvent, team: Team) => void,
  onMemberAdded: () => void,
  onDelete: (team: Team) => void,
): TableColumn<Team>[] {
  return [
    {
      key: 'name',
      label: 'Team Name',
      render: (team: Team) => (
        <div className="flex items-center justify-between gap-2 w-full group/teamname">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {/* Initial avatar — same style as project type icon in Projects table */}
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: `${BLUE}18`, border: `1px solid ${BLUE}20`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: BLUE, flexShrink: 0,
            }}>
              {(team.name?.[0] || '?').toUpperCase()}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {team.name}
            </span>
          </div>
          {/* Delete — visible only on row hover */}
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); onDelete(team); }}
            className="opacity-0 group-hover/teamname:opacity-100 transition-opacity"
            style={{
              padding: 5, borderRadius: 6, border: 'none', cursor: 'pointer',
              background: 'none', color: '#ef4444', display: 'flex', alignItems: 'center', flexShrink: 0,
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#ef444418'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
            title="Delete team"
          >
            <Trash2 style={{ width: 14, height: 14 }} />
          </button>
        </div>
      ),
    },
    {
      key: 'team_type',
      label: 'Team Type',
      width: '140px',
      render: (team: Team) => (
        <span style={{
          display: 'inline-flex', alignItems: 'center',
          padding: '3px 10px', borderRadius: 99,
          background: `${BLUE}12`, color: BLUE,
          fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
        }}>
          {team.team_type_display || team.team_type}
        </span>
      ),
    },
    {
      key: 'members',
      label: 'Members',
      width: '130px',
      render: (team: Team) => (
        <TeamMembersList team={team} />
      ),
    },
    {
      key: 'add_members' as any,
      label: 'Add Members',
      width: '110px',
      className: 'text-center',
      render: (team: Team) => (
        <AddMembersDropdown team={team} onMemberAdded={onMemberAdded} />
      ),
    },
    {
      key: 'is_favourite' as any,
      label: 'Favourite',
      width: '80px',
      className: 'text-center',
      render: (team: Team) => (
        <button
          onClick={e => onToggleFavorite(e, team)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
          className="hover:scale-110 transition-transform"
        >
          <Star
            size={16}
            style={{ color: team.is_favourite ? '#f59e0b' : '#d1d5db', transition: 'color .15s' }}
            fill={team.is_favourite ? '#f59e0b' : 'none'}
          />
        </button>
      ),
    },
  ];
}