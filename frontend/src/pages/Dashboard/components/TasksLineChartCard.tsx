import { ChevronDown } from 'lucide-react';
import { LineChart } from '@/components/charts/LineChart';
import { CARD, MONTH_BTN, TEXT, MUTED, LINE, BLUE, SkeletonBlock } from '../index';

interface LineSeries {
  label: string;
  color: string;
  data: number[];
}

interface TasksLineChartCardProps {
  chartSeries: LineSeries[];
  chartLabels: string[];
  selectedMonth: { year: number; month: number };
  setSelectedMonth: (m: { year: number; month: number }) => void;
  showChartMonthPicker: boolean;
  setShowChartMonthPicker: (fn: (v: boolean) => boolean) => void;
  isLoading?: boolean;
}

export function TasksLineChartCard({
  chartSeries,
  chartLabels,
  selectedMonth,
  setSelectedMonth,
  showChartMonthPicker,
  setShowChartMonthPicker,
  isLoading,
}: TasksLineChartCardProps) {
  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return {
      year: d.getFullYear(),
      month: d.getMonth(),
      label: d.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    };
  });

  const currentLabel = new Date(selectedMonth.year, selectedMonth.month).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div style={{ ...CARD, padding: '20px 22px', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Tasks Over Time</span>

        {/* Month picker */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowChartMonthPicker(v => !v)} style={MONTH_BTN}>
            {currentLabel}
            <ChevronDown size={11} />
          </button>
          {showChartMonthPicker && (
            <div style={{ position: 'absolute', top: 42, right: 0, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.10)', zIndex: 200, overflow: 'hidden', minWidth: 170 }}>
              {monthOptions.map(opt => {
                const active = selectedMonth.year === opt.year && selectedMonth.month === opt.month;
                return (
                  <button
                    key={`${opt.year}-${opt.month}`}
                    onClick={() => { setSelectedMonth({ year: opt.year, month: opt.month }); setShowChartMonthPicker(() => false); }}
                    style={{ width: '100%', padding: '9px 14px', border: 'none', background: active ? `${BLUE}18` : 'transparent', color: active ? BLUE : TEXT, fontSize: 14, fontWeight: active ? 700 : 500, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginBottom: 12 }}>
        {chartSeries.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span style={{ width: 16, height: 2.5, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: MUTED, whiteSpace: 'nowrap' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Chart or Skeleton */}
      {isLoading
        ? <div style={SkeletonBlock({ width: '100%', height: 210, borderRadius: 8 })} />
        : <LineChart series={chartSeries} labels={chartLabels} />
      }
    </div>
  );
}