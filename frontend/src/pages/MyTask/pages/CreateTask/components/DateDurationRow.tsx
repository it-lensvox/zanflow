import React from 'react';
import { Calendar, Clock } from 'lucide-react';
import { FormField } from './FormField';
import { LINE, INPUT_STYLE } from '../createTaskConstants';
import { useTheme } from '@/hooks/useTheme';

interface DateDurationRowProps {
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  duration: string;
  handleDurationChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function DateDurationRow({ startDate, setStartDate, endDate, setEndDate, duration, handleDurationChange }: DateDurationRowProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const dateInputStyle: React.CSSProperties = {
    ...INPUT_STYLE,
    cursor: 'pointer',
    colorScheme: isDark ? 'dark' : 'light',
  };

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12,
      padding: 16, background: 'hsl(var(--muted))',
      border: `1px solid hsl(var(--border))`, borderRadius: 10,
    }}>
      <FormField label="Start date" icon={<Calendar size={13} />}>
        <input
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          style={dateInputStyle}
          onFocus={e => { e.currentTarget.style.borderColor = '#1663f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(22,99,246,.08)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = LINE; e.currentTarget.style.boxShadow = 'none'; }}
        />
      </FormField>

      <FormField label="Due date" icon={<Calendar size={13} />}>
        <input
          type="date"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
          style={dateInputStyle}
          onFocus={e => { e.currentTarget.style.borderColor = '#1663f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(22,99,246,.08)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = LINE; e.currentTarget.style.boxShadow = 'none'; }}
        />
      </FormField>

      <FormField label="Duration" icon={<Clock size={13} />}>
        <input
          type="text"
          value={duration}
          onChange={handleDurationChange}
          placeholder="HH:MM:SS"
          style={INPUT_STYLE}
          onFocus={e => { e.currentTarget.style.borderColor = '#1663f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(22,99,246,.08)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = LINE; e.currentTarget.style.boxShadow = 'none'; }}
        />
      </FormField>
    </div>
  );
}