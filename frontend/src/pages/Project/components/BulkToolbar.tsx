import { Move, Settings } from 'lucide-react';
import { BLUE, LINE, TEXT, MUTED } from '../projectConstants';

interface BulkToolbarProps {
  count: number;
  onClear: () => void;
  onDelete: () => void;
  onMove: () => void;
}

export function BulkToolbar({ count, onClear, onDelete, onMove }: BulkToolbarProps) {
  const btn: React.CSSProperties = {
    height: 30, border: `1px solid ${LINE}`, borderRadius: 6, background: '#fff',
    padding: '0 11px', fontSize: 12, fontWeight: 700, display: 'inline-flex',
    gap: 6, alignItems: 'center', cursor: 'pointer', color: TEXT,
  };
  return (
    <div style={{ height: 50, borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', background: '#fff', flexShrink: 0 }}>
      {count > 0 ? (
        <>
          <div onClick={onClear} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', background: '#EEF2FF', color: BLUE, border: `1px solid ${BLUE}`, borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <input type="checkbox" checked readOnly style={{ accentColor: BLUE, width: 15, height: 15 }} />
            {count} selected
          </div>
          <button onClick={onMove} style={btn}><Move className="w-3.5 h-3.5" />Move</button>
          <button style={btn}><Settings className="w-3.5 h-3.5" />Edit</button>
        </>
      ) : (
        <span style={{ fontSize: 13, color: MUTED }}>Select projects to perform bulk actions</span>
      )}
    </div>
  );
}