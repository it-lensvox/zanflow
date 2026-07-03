import React from 'react';
import { BLUE, LINE, MUTED } from '@/config/tokens';

const BG_SELECTED = '#EEF4FF';

interface BulkToolbarProps {
  count: number;
  onClear: () => void;
  emptyHint?: string;
  children?: React.ReactNode;
}

export function BulkToolbar({
  count,
  onClear,
  emptyHint = 'Select items to perform bulk actions',
  children,
}: BulkToolbarProps) {
  return (
    <div
      style={{
        height:       50,
        borderBottom: `1px solid ${LINE}`,
        display:      'flex',
        alignItems:   'center',
        gap:          10,
        padding:      '0 16px',
        background:   '#fff',
        flexShrink:   0,
        flexWrap:     'wrap',
      }}
    >
      {count > 0 ? (
        <>
          {/* ── Count badge — click to deselect all ── */}
          <div
            onClick={onClear}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && onClear()}
            style={{
              display:    'flex',
              alignItems: 'center',
              gap:         8,
              padding:    '4px 12px',
              background:  BG_SELECTED,
              color:       BLUE,
              border:     `1px solid ${BLUE}`,
              borderRadius: 6,
              fontSize:    16,
              fontWeight:  700,
              cursor:     'pointer',
              userSelect: 'none',
              flexShrink:  0,
            }}
          >
            <input
              type="checkbox"
              checked
              readOnly
              style={{ accentColor: BLUE, width: 15, height: 15, cursor: 'pointer' }}
            />
            {count} selected
          </div>

          {/* ── Page-specific action buttons ── */}
          {children}
        </>
      ) : (
        <span style={{ fontSize: 16, color: MUTED }}>{emptyHint}</span>
      )}
    </div>
  );
}