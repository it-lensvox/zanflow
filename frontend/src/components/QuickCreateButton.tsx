import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, CheckSquare, FolderKanban, FileText, Building2, CalendarPlus, Users } from 'lucide-react';
import { CreateProjectModal } from '@/pages/Project/CreateProjectModal';
import { CreateWorkspaceModal } from '@/components/Modals/CreateWorkspaceModal';
import { CreateDocumentModal } from '@/components/Modals/CreateDocumentModal';
// ── Types ──────────────────────────────────────────────────────────────────────
type CreateItem = {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  bg: string;
  action: 'modal' | 'navigate';
  target?: string;
};

// ── Main Component ─────────────────────────────────────────────────────────────
export function QuickCreateButton() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // ESC to close
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  const items: CreateItem[] = [
    {
      id: 'task',
      label: 'New Task',
      description: 'Create and assign a task',
      icon: <CheckSquare size={20} />,
      accent: '#F59E0B',
      bg: '#FFFBEB',
      action: 'navigate',
      target: '/taskboard/create',
    },
    {
      id: 'project',
      label: 'New Project',
      description: 'Start a new project',
      icon: <FolderKanban size={20} />,
      accent: '#1663F6',
      bg: '#EEF4FF',
      action: 'modal',
    },
    {
      id: 'document',
      label: 'New Document',
      description: 'Write or upload a doc',
      icon: <FileText size={20} />,
      accent: '#22C55E',
      bg: '#F0FDF4',
      action: 'modal',
    },
    {
      id: 'workspace',
      label: 'New Workspace',
      description: 'Create a workspace',
      icon: <Building2 size={20} />,
      accent: '#8B5CF6',
      bg: '#F5F3FF',
      action: 'modal',
    },
    {
      id: 'event',
      label: 'New Event',
      description: 'Schedule an event',
      icon: <CalendarPlus size={20} />,
      accent: '#EC4899',
      bg: '#FDF2F8',
      action: 'navigate',
      target: '/calendar',
    },
    {
      id: 'meeting',
      label: 'New Meeting',
      description: 'Set up a meeting',
      icon: <Users size={20} />,
      accent: '#14B8A6',
      bg: '#F0FDFA',
      action: 'navigate',
      target: '/calendar',
    },
  ];

  const handleItemClick = (item: CreateItem) => {
    if (item.action === 'navigate' && item.target) {
      navigate(item.target);
      setOpen(false);
    } else if (item.action === 'modal') {
      setActiveModal(item.id);
      setOpen(false);
    }
  };

  return (
    <>
      {/* ── Trigger Button ── */}
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: open ? '#0F4FD1' : '#1663F6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'background 0.15s, transform 0.15s',
          transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(22,99,246,0.35)',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
        onClick={() => setOpen(prev => !prev)}
        title="Quick create"
      >
        {open
          ? <X size={16} color="#fff" strokeWidth={2.5} />
          : <Plus size={18} color="#fff" strokeWidth={2.5} />
        }
      </div>

      {/* ── Modal Overlay ── */}
      {open && (
        <div
          ref={overlayRef}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: 80,
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              width: 520,
              background: '#fff',
              borderRadius: 20,
              boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid #F0F2F7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.01em' }}>
                  Create new
                </div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                  What would you like to create?
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: '#F3F4F6', border: 'none',
                  cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={14} color="#6B7280" />
              </button>
            </div>

            {/* Grid of items */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              padding: 16,
            }}>
              {items.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 16px',
                    background: '#FAFAFA',
                    border: '1.5px solid #F0F2F7',
                    borderRadius: 14,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = item.bg;
                    e.currentTarget.style.borderColor = item.accent + '40';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = `0 4px 16px ${item.accent}18`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#FAFAFA';
                    e.currentTarget.style.borderColor = '#F0F2F7';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    width: 42, height: 42,
                    borderRadius: 12,
                    background: item.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: item.accent,
                    border: `1px solid ${item.accent}20`,
                  }}>
                    {item.icon}
                  </div>

                  {/* Text */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 2 }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Footer */}
            <div style={{
              padding: '10px 20px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}>
              <kbd style={{
                background: '#F3F4F6', border: '1px solid #E5E7EB',
                borderRadius: 5, padding: '2px 7px',
                fontSize: 10, fontWeight: 700, color: '#6B7280',
              }}>esc</kbd>
              <span style={{ fontSize: 11, color: '#9CA3AF' }}>to close</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Project Modal ── */}
      <CreateProjectModal
        isOpen={activeModal === 'project'}
        onClose={() => setActiveModal(null)}
      />

      {/* ── Create Document Modal ── */}
      <CreateDocumentModal
        isOpen={activeModal === 'document'}
        onClose={() => setActiveModal(null)}
      />

      {/* ── Create Workspace Modal ── */}
      <CreateWorkspaceModal
        isOpen={activeModal === 'workspace'}
        onClose={() => setActiveModal(null)}
      />
    </>
  );
}