import { DonutChart } from '@/components/charts/DonutChart';
import { CARD, TEXT, MUTED, SkeletonBlock } from '../index';


interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface TasksDonutCardProps {
  donut: DonutSlice[];
  donutTotal: number;
  isLoading?: boolean;
}

export function TasksDonutCard({ donut, donutTotal, isLoading }: TasksDonutCardProps) {
  return (
    <div style={{ ...CARD, padding: '20px 22px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Tasks by Status</span>
        <span style={{ fontSize: 13, color: MUTED }}>All tasks</span>
      </div>

      {/* Skeleton */}
      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={SkeletonBlock({ width: 164, height: 164, borderRadius: '50%', style: { flexShrink: 0 } })} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[90, 70, 80, 60].map((w, i) => <div key={i} style={SkeletonBlock({ width: `${w}%`, height: 14 })} />)}
          </div>
        </div>
      ) : (
        /* Chart + Legend */
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <DonutChart data={donut} total={donutTotal} />
          <div style={{ flex: 1 }}>
            {donut.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: i < donut.length - 1 ? 12 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: TEXT }}>{d.label}</span>
                </div>
                <span style={{ fontSize: 13, color: TEXT }}>
                  {d.value}{' '}
                  <span style={{ color: MUTED }}>({donutTotal > 0 ? Math.round((d.value / donutTotal) * 100) : 0}%)</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}