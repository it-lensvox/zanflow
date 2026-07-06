import { ChevronDown, Download, TrendingUp, TrendingDown } from 'lucide-react';
import { AvatarStack } from '@/components/ui/AvatarStack';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { DonutChart } from '@/components/charts/DonutChart';
import { LineChart } from '@/components/charts/LineChart';
import { Sparkline } from '@/components/charts/Sparkline';
import { CARD, TEXT, MUTED, LINE, BLUE, BG, MONTH_BTN, SkeletonBlock } from '../index';
import type { DashboardTask } from '../hooks/useDashboard';
import type { Project } from '@/types';

// ── Metric card with sparkline (top row)
function MetricCard({
  label, value, sub, up, color, sparkData, isLoading,
}: {
  label: string; value: string; sub: string; up: boolean;
  color: string; sparkData: number[]; isLoading?: boolean;
}) {
  return (
    <div style={{ ...CARD, padding: '18px 20px 0', display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 6 }}>{label}</div>
      {isLoading
        ? <div style={SkeletonBlock({ width: 80, height: 32, borderRadius: 6, style: { marginBottom: 6 } })} />
        : <div style={{ fontSize: 28, fontWeight: 800, color: TEXT, lineHeight: 1.1 }}>{value}</div>
      }
      {isLoading
        ? <div style={SkeletonBlock({ width: '60%', height: 12, style: { marginBottom: 14 } })} />
        : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 14 }}>
            {up
              ? <TrendingUp size={11} color="#22C55E" />
              : <TrendingDown size={11} color="#EF4444" />
            }
            <span style={{ fontSize: 11, fontWeight: 700, color: up ? '#22C55E' : '#EF4444' }}>{sub}</span>
          </div>
        )
      }
      <div style={{ margin: '0 -20px', overflow: 'hidden' }}>
        <Sparkline color={color} data={sparkData} />
      </div>
    </div>
  );
}

// ── Bar chart for throughput
function ThroughputBar({ data, total }: { data: { label: string; count: number }[]; total: number }) {
  const maxVal = Math.max(...data.map(d => d.count), 1);
  const today = new Date().getDay(); // 0=Sun,1=Mon,...
  const todayIdx = today === 0 ? 6 : today - 1; // map to Mon=0

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100, paddingTop: 8 }}>
      {data.map((d, i) => {
        const h = Math.max((d.count / maxVal) * 80, d.count > 0 ? 8 : 4);
        const isToday = i === todayIdx;
        return (
          <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div
              style={{
                width: '100%', height: h, borderRadius: 4,
                background: isToday ? BLUE : '#BFDBFE',
                transition: 'height 0.3s ease',
              }}
            />
            <span style={{ fontSize: 10, color: isToday ? BLUE : MUTED, fontWeight: isToday ? 700 : 400 }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

interface LeaderboardRow {
  id: number; name: string; taskCount: number; pct: number;
  color: string; members: any[];
}

interface AnalyticsTabProps {
  tasksLoading: boolean;
  projectsLoading: boolean;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  completionRate: number;
  avgCycleTime: number;
  donut: { label: string; value: number; color: string }[];
  donutTotal: number;
  leaderboard: LeaderboardRow[];
  throughputData: { label: string; count: number }[];
  totalThroughput: number;
  chartSeries: { label: string; color: string; data: number[] }[];
  chartLabels: string[];
  selectedMonth: { year: number; month: number };
  setSelectedMonth: (m: { year: number; month: number }) => void;
  showChartMonthPicker: boolean;
  setShowChartMonthPicker: (fn: (v: boolean) => boolean) => void;
  projectCount: number;
}

export function AnalyticsTab({
  tasksLoading, projectsLoading,
  totalTasks, completedTasks, overdueTasks, completionRate, avgCycleTime,
  donut, donutTotal, leaderboard, throughputData, totalThroughput,
  chartSeries, chartLabels, selectedMonth, setSelectedMonth,
  showChartMonthPicker, setShowChartMonthPicker, projectCount,
}: AnalyticsTabProps) {
  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return { year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleString('en-US', { month: 'long', year: 'numeric' }) };
  });

  const currentMonthLabel = new Date(selectedMonth.year, selectedMonth.month).toLocaleString('en-US', {
    month: 'long', year: 'numeric',
  });

  return (
    <div>
      {/* ── Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: TEXT, letterSpacing: '-0.02em' }}>Workspace analytics</div>
          <div style={{ fontSize: 14, color: MUTED, marginTop: 4 }}>
            Performance across {projectCount} projects · last 30 days.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button style={{ ...MONTH_BTN, gap: 6 }}>
            <span style={{ fontSize: 13 }}>Last 30 days</span>
            <ChevronDown size={11} />
          </button>
          <button style={{ ...MONTH_BTN, gap: 6, background: '#fff' }}>
            <Download size={13} color={MUTED} />
            <span style={{ fontSize: 13 }}>Export</span>
          </button>
        </div>
      </div>

      {/* ── 4 metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <MetricCard
          label="Total Tasks" value={String(totalTasks)}
          sub="+12% MoM" up={true} color="#1663F6"
          sparkData={[10, 15, 18, 20, 22, 25, 28, totalTasks || 1]}
          isLoading={tasksLoading}
        />
        <MetricCard
          label="Completion rate" value={`${completionRate}%`}
          sub="+6 pts" up={true} color="#22C55E"
          sparkData={[50, 55, 60, 62, 65, 68, 70, completionRate || 1]}
          isLoading={tasksLoading}
        />
        <MetricCard
          label="Avg. cycle time" value={`${avgCycleTime}d`}
          sub="-0.5d" up={false} color="#8B5CF6"
          sparkData={[3.5, 3.2, 3.0, 2.8, 2.6, 2.5, 2.4, avgCycleTime || 1]}
          isLoading={tasksLoading}
        />
        <MetricCard
          label="Overdue" value={String(overdueTasks)}
          sub="+2" up={false} color="#EF4444"
          sparkData={[5, 6, 7, 6, 8, 7, 8, overdueTasks || 1]}
          isLoading={tasksLoading}
        />
      </div>

      {/* ── Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

        {/* Tasks by status donut */}
        <div style={{ ...CARD, padding: '20px 22px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 18 }}>Tasks by status</div>
          {tasksLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={SkeletonBlock({ width: 164, height: 164, borderRadius: '50%', style: { flexShrink: 0 } })} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[90, 70, 80, 60].map((w, i) => <div key={i} style={SkeletonBlock({ width: `${w}%`, height: 14 })} />)}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <DonutChart data={donut} total={donutTotal} />
              <div style={{ flex: 1 }}>
                {donut.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: i < donut.length - 1 ? 14 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: '#344054' }}>{d.label}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tasks over time line chart */}
        <div style={{ ...CARD, padding: '20px 22px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Tasks over time</span>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowChartMonthPicker(v => !v)} style={MONTH_BTN}>
                {currentMonthLabel} <ChevronDown size={11} />
              </button>
              {showChartMonthPicker && (
                <div style={{ position: 'absolute', top: 42, right: 0, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.10)', zIndex: 200, overflow: 'hidden', minWidth: 170 }}>
                  {monthOptions.map(opt => {
                    const active = selectedMonth.year === opt.year && selectedMonth.month === opt.month;
                    return (
                      <button
                        key={`${opt.year}-${opt.month}`}
                        onClick={() => { setSelectedMonth({ year: opt.year, month: opt.month }); setShowChartMonthPicker(() => false); }}
                        style={{ width: '100%', padding: '9px 14px', border: 'none', background: active ? '#EEF4FF' : '#fff', color: active ? BLUE : TEXT, fontSize: 14, fontWeight: active ? 700 : 500, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginBottom: 12 }}>
            {chartSeries.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 16, height: 2.5, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: MUTED }}>{s.label}</span>
              </div>
            ))}
          </div>
          {tasksLoading
            ? <div style={SkeletonBlock({ width: '100%', height: 210, borderRadius: 8 })} />
            : <LineChart series={chartSeries} labels={chartLabels} />
          }
        </div>
      </div>

      {/* ── Bottom row: Leaderboard + Throughput */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>

       {/* Project leaderboard */}
        <div style={{ ...CARD, padding: '20px 22px', flex: '0 0 60%', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Project leaderboard</span>
            <button style={{ fontSize: 13, fontWeight: 600, color: BLUE, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
              All →
            </button>
          </div>

          {projectsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={SkeletonBlock({ width: 24, height: 18, borderRadius: 4, style: { flexShrink: 0 } })} />
                  <div style={SkeletonBlock({ width: 28, height: 28, borderRadius: 7, style: { flexShrink: 0 } })} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={SkeletonBlock({ width: '50%', height: 13 })} />
                    <div style={SkeletonBlock({ width: '30%', height: 11 })} />
                  </div>
                  <div style={{ width: 160, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={SkeletonBlock({ width: '100%', height: 6, borderRadius: 4 })} />
                    <div style={SkeletonBlock({ width: 32, height: 13, borderRadius: 4 })} />
                  </div>
                </div>
              ))}
            </div>
          ) : leaderboard.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0', color: MUTED, fontSize: 14 }}>No project data yet</div>
          ) : (
            leaderboard.map((p, i) => (
              <div
                key={p.id}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', borderBottom: i < leaderboard.length - 1 ? `1px solid ${LINE}` : 'none', borderRadius: 6 }}
                onMouseEnter={e => (e.currentTarget.style.background = BG)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Rank */}
                <span style={{ fontSize: 13, fontWeight: 700, color: MUTED, width: 16, textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
                {/* Avatar */}
                <div style={{ width: 28, height: 28, borderRadius: 7, background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                  {(p.name || '?')[0].toUpperCase()}
                </div>
                {/* Name + count */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>{p.taskCount} tasks</div>
                </div>
                {/* Members */}
                <AvatarStack users={p.members.map((m: any) => ({ name: m.user?.first_name || m.user?.username || '?', avatar: m.user?.avatar || null }))} max={2} />
                {/* Progress */}
                <div style={{ width: 140, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ProgressBar pct={p.pct} color={p.color} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#344054', flexShrink: 0, width: 36, textAlign: 'right' }}>{p.pct}%</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Team throughput */}
        <div style={{ ...CARD, padding: '20px 20px', flex: '1 1 0', minWidth: 280 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Team throughput</span>
            <span style={{ fontSize: 12, color: MUTED }}>per day</span>
          </div>

          {tasksLoading ? (
            <>
              <div style={SkeletonBlock({ width: 80, height: 28, borderRadius: 6, style: { marginBottom: 16 } })} />
              <div style={SkeletonBlock({ width: '100%', height: 100, borderRadius: 8 })} />
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: TEXT }}>{totalThroughput}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <TrendingUp size={12} color="#22C55E" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#22C55E' }}>9%</span>
                </div>
              </div>
              <ThroughputBar data={throughputData} total={totalThroughput} />
            </>
          )}
        </div>

      </div>
    </div>
  );
}