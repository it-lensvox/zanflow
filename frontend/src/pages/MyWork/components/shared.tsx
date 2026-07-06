import { BLUE } from '../myWorkConstants';

export function Avatar({
  name,
  size = 28,
  color = BLUE,
  avatarUrl,
}: {
  name: string;
  size?: number;
  color?: string;
  avatarUrl?: string | null;
}) {
  const init = (name || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{
          width: size, height: size, borderRadius: '50%',
          objectFit: 'cover', flexShrink: 0,
          border: `1.5px solid ${color}44`,
        }}
        onError={e => {
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color + '22', color, fontWeight: 700,
      fontSize: size * 0.38, display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, border: `1.5px solid ${color}44`,
    }}>{init}</div>
  );
}