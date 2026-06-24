interface AvatarUser {
  name: string;
  avatar?: string | null;
}

interface AvatarStackProps {
  users: AvatarUser[];
  max?: number;
}

const AVATAR_COLORS = ['#1663F6', '#22C55E', '#8B5CF6', '#F59E0B', '#EF4444'];

export function AvatarStack({ users, max = 3 }: AvatarStackProps) {
  return (
    <div style={{ display: 'flex' }}>
      {users.slice(0, max).map((u, i) => (
        <div
          key={i}
          style={{
            width: 24, height: 24, borderRadius: '50%', border: '2px solid #fff',
            marginLeft: i === 0 ? 0 : -7,
            background: u.avatar ? 'transparent' : AVATAR_COLORS[i % AVATAR_COLORS.length],
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700, color: '#fff',
            position: 'relative', zIndex: max - i, overflow: 'hidden',
          }}
        >
          {u.avatar
            ? <img src={u.avatar} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            : u.name?.[0]?.toUpperCase() || '?'
          }
        </div>
      ))}
      {users.length > max && (
        <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid #fff', marginLeft: -7, background: '#E5E7EB', fontSize: 9, fontWeight: 700, color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          +{users.length - max}
        </div>
      )}
    </div>
  );
}