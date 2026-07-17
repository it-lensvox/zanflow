import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { LINE } from '@/config/tokens';

interface StatCardProps {
  icon:    LucideIcon;
  label:   string;
  value:   number | string;
  accent:  string;
  sub?:    string;
}

export function StatCard({ icon: Icon, label, value, accent, sub }: StatCardProps) {
  return (
    <div style={{
      background: 'hsl(var(--card))',
      border: `1px solid ${LINE}`,
      borderRadius: 12,
      padding: '16px 18px',
      display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: '0 1px 3px rgba(0,0,0,.06)',
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 10, flexShrink: 0,
        background: `${accent}14`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={18} color={accent} />
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'hsl(var(--foreground))', lineHeight: 1 }}>
          {value}
        </p>
        <p style={{ margin: '3px 0 0', fontSize: 11, color: 'hsl(var(--muted-foreground))', fontWeight: 500 }}>
          {label}
        </p>
        {sub && (
          <p style={{ margin: '2px 0 0', fontSize: 10, color: accent, fontWeight: 600 }}>{sub}</p>
        )}
      </div>
    </div>
  );
}