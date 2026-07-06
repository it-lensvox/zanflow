interface AvatarUser {
  name: string;
  avatar?: string | null;
}

interface AvatarStackProps {
  /** Pre-mapped users — used by Dashboard components */
  users?: AvatarUser[];
  /** Raw API project members — used by Project components */
  members?: any[];
  max?: number;
  /** Avatar circle size in px (default 24) */
  size?: number;
  emptyLabel?: string;
}

const AVATAR_COLORS = ['#1663F6', '#22C55E', '#8B5CF6', '#F59E0B', '#EF4444'];

/** Resolves a raw API member object into { name, avatar } */
function resolveMember(m: any): AvatarUser {
  return {
    name: m.user?.full_name || m.user?.first_name || m.username || m.first_name || '?',
    avatar: m.user?.avatar || m.avatar || null,
  };
}

export function AvatarStack({ users, members, max = 3, size = 24, emptyLabel = '—' }: AvatarStackProps) {
  const resolved: AvatarUser[] = members
    ? members.map(resolveMember)
    : (users || []);

  if (resolved.length === 0) {
    return <span style={{ fontSize: 11, color: '#667085' }}>{emptyLabel}</span>;
  }

  const shown = resolved.slice(0, max);
  const extra = resolved.length - max;
  const overlap = Math.round(size * 0.29);

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((u, i) => (
        <div
          key={i}
          title={u.name}
          style={{
            width: size, height: size, borderRadius: '50%', border: '2px solid #fff',
            marginLeft: i === 0 ? 0 : -overlap,
            background: u.avatar ? 'transparent' : AVATAR_COLORS[i % AVATAR_COLORS.length],
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: Math.round(size * 0.37), fontWeight: 700, color: '#fff',
            position: 'relative', zIndex: max - i, overflow: 'hidden', flexShrink: 0,
          }}
        >
          {u.avatar
            ? <img src={u.avatar} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            : u.name?.[0]?.toUpperCase() || '?'
          }
        </div>
      ))}
      {extra > 0 && (
        <div style={{ width: size, height: size, borderRadius: '50%', border: '2px solid #fff', marginLeft: -overlap, background: '#98a2b3', fontSize: Math.round(size * 0.37), fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          +{extra}
        </div>
      )}
    </div>
  );
}