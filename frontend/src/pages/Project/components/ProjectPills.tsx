import { STATUS_MAP, TYPE_MAP, MUTED } from '../projectConstants';

// ─── StatusPill ───────────────────────────────────────────────────────────────
export function StatusPill({ status }: { status?: string }) {
  const s = STATUS_MAP[status || 'active'] ?? STATUS_MAP.draft;
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

// ─── TypePill ─────────────────────────────────────────────────────────────────
export function TypePill({ type }: { type?: string }) {
  const key = (type || 'internal').toLowerCase().replace(' ', '_');
  const t = TYPE_MAP[key] ?? TYPE_MAP.internal;
  return (
    <span style={{ background: t.bg, color: t.color, border: `1px solid ${t.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
      {type ?? 'Internal'}
    </span>
  );
}

// ─── MemberAvatars ────────────────────────────────────────────────────────────
const GRADS = [
  'linear-gradient(135deg,#204b72,#ffb17a)',
  'linear-gradient(135deg,#7c3aed,#60a5fa)',
  'linear-gradient(135deg,#059669,#34d399)',
  'linear-gradient(135deg,#dc2626,#fca5a5)',
];

export function MemberAvatars({ members, max = 3 }: { members: any[]; max?: number }) {
  const shown = members.slice(0, max);
  const extra = members.length - max;
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((m, i) => {
        const name = m.user?.full_name || m.username || m.first_name || '?';
        const avatarUrl = m.user?.avatar || m.avatar || null;
        return (
          <div key={i} title={name} style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid #fff', marginLeft: i === 0 ? 0 : -6, background: GRADS[i % GRADS.length], display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 700, color: '#fff', zIndex: max - i, position: 'relative', overflow: 'hidden' }}>
            {avatarUrl
              ? <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              : name[0]?.toUpperCase()
            }
          </div>
        );
      })}
      {extra > 0 && (
        <div style={{ marginLeft: -6, background: '#98a2b3', color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'grid', placeItems: 'center', fontSize: 10, border: '2px solid #fff', fontWeight: 700, position: 'relative' }}>
          +{extra}
        </div>
      )}
      {members.length === 0 && <span style={{ fontSize: 11, color: MUTED }}>—</span>}
    </div>
  );
}