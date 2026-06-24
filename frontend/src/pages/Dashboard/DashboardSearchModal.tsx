import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowRight } from 'lucide-react';

interface SearchResult {
  type: string;
  label: string;
  sub: string;
  onClick: () => void;
}

interface DashboardSearchModalProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: SearchResult[];
  onClose: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  Project:  '#1663F6',
  Task:     '#8B5CF6',
  Document: '#22C55E',
};

const QUICK_LINKS = [
  { label: 'Projects',  path: '/projects' },
  { label: 'My Tasks',  path: '/taskboard' },
  { label: 'Documents', path: '/documents' },
  { label: 'Calendar',  path: '/calendar' },
];

export function DashboardSearchModal({ searchQuery, setSearchQuery, searchResults, onClose }: DashboardSearchModalProps) {
  const navigate  = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => searchRef.current?.focus(), 50);
  }, []);

  const handleNav = (path: string) => {
    onClose();
    setSearchQuery('');
    navigate(path);
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80 }}
      onClick={onClose}
    >
      <div
        style={{ width: 560, background: '#fff', borderRadius: 14, boxShadow: '0 24px 60px rgba(0,0,0,.18)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >

        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid #E6EBF2' }}>
          <Search size={17} color="#9CA3AF" />
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search projects, tasks, documents…"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#172033', background: 'transparent' }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 20, lineHeight: 1 }}>×</button>
          )}
          <kbd style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 5, padding: '2px 7px', fontSize: 11, fontWeight: 700, color: '#6B7280' }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {searchQuery.trim().length < 2 ? (
            <div style={{ padding: '8px 0' }}>
              <div style={{ padding: '6px 18px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em' }}>QUICK LINKS</div>
              {QUICK_LINKS.map(item => (
                <div
                  key={item.label}
                  style={{ padding: '10px 18px', fontSize: 13, color: '#344054', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                  onClick={() => handleNav(item.path)}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F7F8FB')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <ArrowRight size={13} color="#9CA3AF" /> {item.label}
                </div>
              ))}
            </div>
          ) : searchResults.length === 0 ? (
            <div style={{ padding: '32px 18px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
              No results for "<strong>{searchQuery}</strong>"
            </div>
          ) : (
            <div style={{ padding: '8px 0' }}>
              <div style={{ padding: '6px 18px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em' }}>RESULTS</div>
              {searchResults.map((r, i) => (
                <div
                  key={i}
                  onClick={r.onClick}
                  style={{ padding: '10px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F7F8FB')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: `${TYPE_COLORS[r.type]}15`, color: TYPE_COLORS[r.type], flexShrink: 0 }}>{r.type}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#172033', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.label}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>{r.sub}</div>
                  </div>
                  <ArrowRight size={13} color="#D1D5DB" />
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}