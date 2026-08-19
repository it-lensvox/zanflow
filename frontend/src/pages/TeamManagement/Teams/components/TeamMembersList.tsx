import { TablePopover } from '@/components/common';
import { AvatarStack } from '@/components/ui/AvatarStack';
import { MUTED } from '@/config/tokens';
import type { Team } from '@/types';

export function TeamMembersList({ team }: { team: Team }) {
  const trigger = (
    <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
      <AvatarStack
        members={team.members || []}
        max={3}
        size={24}
        emptyLabel="—"
      />
    </div>
  );

  return (
    <TablePopover trigger={trigger} width="w-56">
      {/* Header */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid hsl(var(--border))',
        background: 'hsl(var(--muted))',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderRadius: '8px 8px 0 0',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--foreground))', textTransform: 'uppercase', letterSpacing: '.06em' }}>
          Team Members
        </span>
        <span style={{ fontSize: 10, background: 'hsl(var(--accent))', padding: '1px 6px', borderRadius: 4, color: 'hsl(var(--muted-foreground))', fontWeight: 600 }}>
          {team.members?.length || 0}
        </span>
      </div>

      {/* Members list */}
      <div style={{ maxHeight: 192, overflowY: 'auto', padding: '4px' }}>
        {(team.members || []).length === 0 ? (
          <p style={{ padding: '12px', fontSize: 12, color: MUTED, textAlign: 'center' }}>No members yet</p>
        ) : (
          team.members?.map(member => {
            const name = member.user.full_name || member.user.email || 'User';
            const initial = name.charAt(0).toUpperCase();
            return (
              <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6 }}
                onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--accent))'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: '#1663f618', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 10, fontWeight: 700,
                  color: '#1663f6', flexShrink: 0,
                }}>
                  {initial}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: 'hsl(var(--foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                    {name}
                  </p>
                  <p style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', textTransform: 'capitalize', margin: 0 }}>
                    {(member as any).role?.replace('_', ' ') || 'member'}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </TablePopover>
  );
}