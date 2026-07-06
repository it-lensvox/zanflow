import { STATUS_MAP, MUTED } from '../projectConstants';
import { getProjectTypeConfig } from '@/config/projectTypeConfig';
import { AvatarStack } from '@/components/ui/AvatarStack';

// ─── StatusPill ───
export function StatusPill({ status }: { status?: string }) {
  const s = STATUS_MAP[status || 'active'] ?? STATUS_MAP.draft;
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

export function TypePill({ type }: { type?: string }) {
  const t = getProjectTypeConfig(type);
  return (
    <span style={{ background: t.bg, color: t.color, border: `1px solid ${t.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
      {t.label}
    </span>
  );
}

// ─── MemberAvatars ──
export function MemberAvatars({ members, max = 3 }: { members: any[]; max?: number }) {
  return <AvatarStack members={members} max={max} size={22} emptyLabel="—" />;
}