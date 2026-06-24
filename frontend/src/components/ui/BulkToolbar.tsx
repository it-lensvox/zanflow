import React from 'react';

// ─── Design tokens ────────────────────────────────────────────────────────────
const BLUE = '#1663f6';
const LINE = '#e6ebf2';
const MUTED = '#667085';
const BG_SELECTED = '#EEF4FF';

interface BulkToolbarProps {
  /** Number of currently selected items */
  count: number;
  /** Called when the user clicks the count badge to deselect all */
  onClear: () => void;
  /** Text shown when nothing is selected */
  emptyHint?: string;
  /** Page-specific action buttons — rendered right of the count badge */
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