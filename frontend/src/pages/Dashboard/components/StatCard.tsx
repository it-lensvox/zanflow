import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Sparkline } from '@/components/charts/Sparkline';
import { CARD, TEXT, MUTED, SkeletonBlock } from '../index';

interface StatCardProps {
  label: string;
  value: number;
  change: string;
  sub: string;
  up: boolean;
  color: string;
  icon: React.ReactNode;
  sparkData: number[];
  isLoading?: boolean;
}

export function StatCard({ label, value, change, sub, up, color, icon, sparkData, isLoading }: StatCardProps) {
  return (
    <div style={{ ...CARD, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Icon + Label — always visible so layout doesn't shift */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: MUTED }}>{label}</span>
      </div>

      {/* Value */}
      {isLoading
       ? <div style={SkeletonBlock({ width: 64, height: 36, borderRadius: 8, style: { marginBottom: 4 } })} />
        : <div style={{ fontSize: 32, fontWeight: 800, color: TEXT, lineHeight: 1, marginBottom: 4 }}>{value}</div>
      }

      {/* Trend row */}
      {isLoading
        ? <div style={SkeletonBlock({ width: '80%', height: 14, style: { marginBottom: 10 } })} />
        : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10 }}>
            {up ? <TrendingUp size={11} color="#22C55E" /> : <TrendingDown size={11} color="#EF4444" />}
            <span style={{ fontSize: 11, fontWeight: 700, color: up ? '#22C55E' : '#EF4444' }}>{change}</span>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>{sub}</span>
          </div>
        )
      }

      {/* Sparkline pinned to bottom */}
      <div style={{ margin: '0 -18px -16px', overflow: 'hidden', borderRadius: '0 0 12px 12px' }}>
        {isLoading
          ? <div style={SkeletonBlock({ width: '100%', height: 48, borderRadius: 0 })} />
          : <Sparkline color={color} data={sparkData} />
        }
      </div>
    </div>
  );
}