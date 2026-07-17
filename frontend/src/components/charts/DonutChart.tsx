interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutSlice[];
  total: number;
}

export function DonutChart({ data, total }: DonutChartProps) {
  const R = 72; const r = 50; const cx = 82; const cy = 82;

  if (total === 0) return (
    <svg width={164} height={164} viewBox="0 0 164 164" style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={R} fill="#E5E7EB" />
      <circle cx={cx} cy={cy} r={r} fill="hsl(var(--card))" />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={28} fontWeight="800" fill="hsl(var(--muted-foreground))">0</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize={11} fill="hsl(var(--muted-foreground))">Total Tasks</text>
    </svg>
  );

  let cum = 0;
  function arc(s: number, pct: number) {
    if (pct >= 0.999) {
      return [
        `M${cx} ${cy - R}`,
        `A${R} ${R} 0 0 1 ${cx} ${cy + R}`,
        `A${R} ${R} 0 0 1 ${cx} ${cy - R}`,
        `L${cx} ${cy - r}`,
        `A${r} ${r} 0 0 0 ${cx} ${cy + r}`,
        `A${r} ${r} 0 0 0 ${cx} ${cy - r}`,
        'Z'
      ].join(' ');
    }
    const a1 = s * Math.PI * 2 - Math.PI / 2;
    const a2 = (s + pct) * Math.PI * 2 - Math.PI / 2;
    const x1 = cx + R * Math.cos(a1); const y1 = cy + R * Math.sin(a1);
    const x2 = cx + R * Math.cos(a2); const y2 = cy + R * Math.sin(a2);
    const ix1 = cx + r * Math.cos(a2); const iy1 = cy + r * Math.sin(a2);
    const ix2 = cx + r * Math.cos(a1); const iy2 = cy + r * Math.sin(a1);
    return `M${x1} ${y1} A${R} ${R} 0 ${pct > 0.5 ? 1 : 0} 1 ${x2} ${y2} L${ix1} ${iy1} A${r} ${r} 0 ${pct > 0.5 ? 1 : 0} 0 ${ix2} ${iy2}Z`;
  }

  const inflated = data.map(d => Math.max(d.value / total, 0.03));
  const inflatedSum = inflated.reduce((a, b) => a + b, 0);
  const normalized = inflated.map(v => v / inflatedSum);
  const slices = data.map((d, i) => { const start = cum; cum += normalized[i]; return { ...d, start, pct: normalized[i] }; });

  return (
    <svg width={164} height={164} viewBox="0 0 164 164" style={{ flexShrink: 0 }}>
      {slices.map((s, i) => s.pct > 0 ? <path key={i} d={arc(s.start, s.pct)} fill={s.color} fillRule="evenodd" /> : null)}
      <circle cx={cx} cy={cy} r={r - 2} fill="hsl(var(--card))" />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={28} fontWeight="800" fill="hsl(var(--foreground))">{total}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize={11} fill="hsl(var(--muted-foreground))">Total Tasks</text>
    </svg>
  );
}