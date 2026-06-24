import React from 'react';
import { List, Grid3X3, Network } from 'lucide-react';
import type { ViewMode } from './useViewMode';

export type { ViewMode } from './useViewMode';

// ─── Mode config 
const MODE_CONFIG: Record<string, { icon: React.FC<{ size: number }>; label: string }> = {
  table: { icon: ({ size }) => <List size={size} />,    label: 'List'  },
  grid:  { icon: ({ size }) => <Grid3X3 size={size} />, label: 'Grid'  },
  tree:  { icon: ({ size }) => <Network size={size} />, label: 'Tree'  },
};

// ─── Design tokens 
const ACTIVE_BG     = '#f5f8ff';
const ACTIVE_BORDER = '#a7c1ff';
const ACTIVE_COLOR  = '#1663f6';
const IDLE_COLOR    = '#667085';
const WRAP_BORDER   = '#e6ebf2';

// ─── Props
interface ViewToggleProps {
  viewMode:          ViewMode;
  onViewModeChange:  (mode: ViewMode) => void;
  modes?:            Array<'table' | 'grid' | 'tree'>;
  showLabels?:       boolean;
  className?:        string;
  height?:           number;
}

export function ViewToggle({
  viewMode,
  onViewModeChange,
  modes       = ['table', 'grid'],
  showLabels  = true,
  className   = '',
  height      = 40,
}: ViewToggleProps) {
  const iconSize = 14;

  return (
    <div
      className={className}
      style={{
        height,
        border: `1px solid ${WRAP_BORDER}`,
        borderRadius: 8,
        display:      'flex',
        alignItems:   'center',
        padding:      3,
        gap:          2,
        flexShrink:   0,
        background:   '#fff',
      }}
    >
      {modes.map(mode => {
        const cfg    = MODE_CONFIG[mode];
        const active = viewMode === mode;
        return (
          <button
            key={mode}
            onClick={() => onViewModeChange(mode)}
            title={cfg.label}
            style={{
              height:      height - 8,
              padding:     showLabels ? '0 10px' : '0 8px',
              borderRadius: 6,
              border:      active ? `1px solid ${ACTIVE_BORDER}` : 'none',
              background:  active ? ACTIVE_BG    : 'transparent',
              color:       active ? ACTIVE_COLOR : IDLE_COLOR,
              fontWeight:  active ? 800          : 600,
              fontSize:    16,
              cursor:      'pointer',
              display:     'flex',
              alignItems:  'center',
              gap:         showLabels ? 6 : 0,
              transition:  'background .15s, color .15s, border-color .15s',
              whiteSpace:  'nowrap',
              fontFamily:  'inherit',
            }}
            onMouseEnter={e => {
              if (!active) e.currentTarget.style.background = '#f7f8fb';
            }}
            onMouseLeave={e => {
              if (!active) e.currentTarget.style.background = 'transparent';
            }}
          >
            <cfg.icon size={iconSize} />
            {showLabels && <span>{cfg.label}</span>}
          </button>
        );
      })}
    </div>
  );
}