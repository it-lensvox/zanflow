interface ProgressBarProps {
  pct: number;
  color: string;
}

export function ProgressBar({ pct, color }: ProgressBarProps) {
  return (
    <div style={{ height: 6, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 4 }} />
    </div>
  );
}