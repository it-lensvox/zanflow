interface LineSeries {
  label: string;
  color: string;
  data: number[];
}

interface LineChartProps {
  series: LineSeries[];
  labels?: string[];
}

export function LineChart({ series, labels }: LineChartProps) {
  const W = 620; const H = 210;
  const allMax = Math.max(...series.flatMap(s => s.data), 1);
  const n = series[0]?.data.length || 8;
  const step = W / (n - 1);
  const px = (i: number) => i * step;
  const py = (v: number) => H - (v / allMax) * (H - 20) - 16;
  const xLabels = labels || Array.from({ length: n }, (_, i) => `Day ${i + 1}`);
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((g, i) => (
          <line key={i} x1="0" x2={W} y1={py(allMax * g)} y2={py(allMax * g)} stroke="#E6EBF2" strokeWidth="1" />
        ))}
        {series.map((s, si) => {
          const pts = s.data.map((v, i) => `${px(i)},${py(v)}`).join(' ');
          return <polyline key={si} fill="none" stroke={s.color} strokeWidth="2" points={pts} strokeLinecap="round" strokeLinejoin="round" />;
        })}
        {series.map((s, si) => s.data.map((v, i) => (
          <circle key={`${si}-${i}`} cx={px(i)} cy={py(v)} r="3.5" fill={s.color} />
        )))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9CA3AF', padding: '4px 2px 0' }}>
        {xLabels.map((l, i) => <span key={i}>{l}</span>)}
      </div>
    </div>
  );
}