import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BLUE, LINE, MUTED, TEXT } from '@/config/tokens';

// ─── Props ──
interface PaginationProps {
  currentPage:   number;
  totalPages:    number;
  totalItems:    number;
  pageSize:      number;
  onPageChange:  (page: number) => void;
  itemLabel?:    string;
  className?:    string;
}

// ─── Smart page number list with ellipsis ────
function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | '...')[] = [1];

  if (current > 3)             pages.push('...');
  if (current > 2)             pages.push(current - 1);
  if (current !== 1 && current !== total) pages.push(current);
  if (current < total - 1)     pages.push(current + 1);
  if (current < total - 2)     pages.push('...');

  pages.push(total);
  return pages;
}

// ─── Button base style helper 
function btnStyle(active: boolean, disabled: boolean): React.CSSProperties {
  return {
    height:      32,
    minWidth:    32,
    padding:     '0 4px',
    border:      `1px solid ${active ? '#88acff' : LINE}`,
    borderRadius: 6,
    background:   active   ? `${BLUE}12` : 'hsl(var(--card))',
    color:        disabled  ? 'hsl(var(--muted-foreground))'
                : active    ? BLUE
                :             MUTED,
    fontWeight:  active ? 700 : 600,
    fontSize:    14,
    cursor:      disabled ? 'not-allowed' : 'pointer',
    display:     'grid',
    placeItems:  'center',
    transition:  'background .15s, border-color .15s, color .15s',
    flexShrink:  0,
    fontFamily:  'inherit',
  };
}

// ─── Component 
export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  itemLabel = 'items',
  className = '',
}: PaginationProps) {
  if (totalItems === 0) return null;

  const from  = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const to    = Math.min(currentPage * pageSize, totalItems);
  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <div
      className={className}
      style={{
        height:          60,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'space-between',
        padding:         '0 16px',
        borderTop:       `1px solid ${LINE}`,
        background:      'hsl(var(--card))',
        flexShrink:      0,
        gap:             12,
        flexWrap:        'wrap',
      }}
    >
      {/* ── "Showing X–Y of Z" label ── */}
      <span style={{ fontSize: 14, color: TEXT, whiteSpace: 'nowrap', flexShrink: 0 }}>
        Showing{' '}
        <b style={{ color: TEXT }}>{from}–{to}</b>
        {' '}of{' '}
        <b style={{ color: TEXT }}>{totalItems}</b>
        {' '}{itemLabel}
      </span>

      {/* ── Page buttons ── */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'nowrap' }}>

        {/* Prev */}
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          style={btnStyle(false, currentPage === 1)}
          aria-label="Previous page"
         onMouseEnter={e => { if (currentPage !== 1) e.currentTarget.style.background = 'hsl(var(--accent))'; }}
          onMouseLeave={e => { if (currentPage !== 1) e.currentTarget.style.background = 'hsl(var(--card))'; }}
        >
          <ChevronLeft size={14} />
        </button>

        {/* Page numbers with ellipsis */}
        {pages.map((pg, i) =>
          pg === '...' ? (
            <span key={`ellipsis-${i}`} style={{ width: 32, textAlign: 'center', fontSize: 14, color: MUTED }}>…</span>
          ) : (
            <button
              key={pg}
              onClick={() => onPageChange(pg)}
              disabled={pg === currentPage}
              style={btnStyle(pg === currentPage, false)}
              aria-label={`Page ${pg}`}
              aria-current={pg === currentPage ? 'page' : undefined}
              onMouseEnter={e => { if (pg !== currentPage) e.currentTarget.style.background = 'hsl(var(--accent))'; }}
              onMouseLeave={e => { if (pg !== currentPage) e.currentTarget.style.background = 'hsl(var(--card))'; }}
            >
              {pg}
            </button>
          )
        )}

        {/* Next */}
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          style={btnStyle(false, currentPage === totalPages)}
          aria-label="Next page"
          onMouseEnter={e => { if (currentPage !== totalPages) e.currentTarget.style.background = 'hsl(var(--accent))'; }}
          onMouseLeave={e => { if (currentPage !== totalPages) e.currentTarget.style.background = 'hsl(var(--card))'; }}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}